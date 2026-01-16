/**
 * Cloudflare Worker x402 Gateway for Coin Railz
 * 
 * This worker proxies x402 requests to Coin Railz services,
 * allowing integration with Cloudflare's Agent SDK ecosystem.
 * 
 * Exposes ALL 44 x402 services dynamically from the main catalog.
 */

export interface Env {
  COINRAILZ_BASE_URL: string;
  WALLET_ADDRESS?: string;
}

// Cache for the full service catalog (refreshed every 5 minutes)
let cachedCatalog: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchFullCatalog(baseUrl: string): Promise<any[]> {
  const now = Date.now();
  if (cachedCatalog && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedCatalog;
  }

  try {
    const response = await fetch(`${baseUrl}/mcp/services`);
    if (response.ok) {
      const data = await response.json() as any;
      cachedCatalog = data.services || data;
      cacheTimestamp = now;
      return cachedCatalog;
    }
  } catch (e) {
    // Fall back to cached or empty
  }
  
  return cachedCatalog || [];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for browser-based agents
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-402-Payment, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Fetch full catalog
    const services = await fetchFullCatalog(env.COINRAILZ_BASE_URL);

    // Health check
    if (path === '/' || path === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        gateway: 'coinrailz-x402',
        version: '2.1.0',
        totalServices: services.length,
        upstream: env.COINRAILZ_BASE_URL,
        documentation: 'https://coinrailz.com/docs',
        catalogEndpoint: `${url.origin}/catalog`,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Full service catalog
    if (path === '/catalog' || path === '/services') {
      return new Response(JSON.stringify({
        name: 'Coin Railz x402 Gateway',
        description: 'Universal payment infrastructure for AI agents - Crypto (x402), Fiat (Stripe), Credits, and FREE wallet provisioning',
        protocol: 'x402',
        totalServices: services.length,
        services: services.map((s: any) => ({
          id: s.id || s.serviceId,
          name: s.name,
          description: s.description,
          price: s.price || s.priceUsd,
          endpoint: `${url.origin}/${s.id || s.serviceId}`,
          x402Endpoint: s.endpoint || `${env.COINRAILZ_BASE_URL}/x402/${s.id || s.serviceId}`,
        })),
        documentation: 'https://coinrailz.com/docs',
        x402Spec: 'https://www.x402.org',
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Proxy service requests - match any service from the catalog
    const serviceId = path.replace(/^\/+/, '').replace(/\/x402\/?/, '');
    const service = services.find((s: any) => 
      (s.id || s.serviceId) === serviceId
    );
    
    if (!service && serviceId) {
      return new Response(JSON.stringify({
        error: 'Service not found',
        requestedService: serviceId,
        availableServices: services.slice(0, 10).map((s: any) => s.id || s.serviceId),
        totalAvailable: services.length,
        catalogUrl: `${url.origin}/catalog`,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!serviceId) {
      return new Response(JSON.stringify({
        error: 'No service specified',
        usage: `${url.origin}/<service-id>`,
        catalogUrl: `${url.origin}/catalog`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Forward to Coin Railz with x402 headers
    // CANONICAL ENDPOINT: /x402/{serviceId} (verified working in production)
    const upstreamUrl = service?.endpoint || `${env.COINRAILZ_BASE_URL}/x402/${serviceId}`;
    
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || 'unknown');
    headers.set('X-Gateway', 'cloudflare-coinrailz');

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' ? await request.text() : undefined,
      });

      // Clone response and add gateway headers
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set('X-Gateway', 'cloudflare-coinrailz');
      responseHeaders.set('X-Service', serviceId);
      Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Upstream service unavailable',
        service: serviceId,
        upstream: upstreamUrl,
        message: 'Please try again or contact support',
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  },
};
