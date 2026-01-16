/**
 * Cloudflare Worker x402 Gateway for Coin Railz
 * 
 * This worker proxies x402 requests to Coin Railz services,
 * allowing integration with Cloudflare's Agent SDK ecosystem.
 */

export interface Env {
  COINRAILZ_BASE_URL: string;
  WALLET_ADDRESS?: string;
}

const SERVICES = [
  { id: 'gas-price-oracle', price: '$0.10', description: 'Gas prices across 7 chains' },
  { id: 'whale-alerts', price: '$0.35', description: 'Whale wallet movements' },
  { id: 'token-price', price: '$0.25', description: 'Real-time token prices' },
  { id: 'wallet-risk', price: '$0.50', description: 'Wallet risk scoring' },
  { id: 'contract-scan', price: '$1.00', description: 'Smart contract security' },
  { id: 'trending-tokens', price: '$0.50', description: 'Trending token discovery' },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/' || path === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        gateway: 'coinrailz-x402',
        version: '1.0.0',
        services: SERVICES.length,
        upstream: env.COINRAILZ_BASE_URL,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Service catalog
    if (path === '/catalog' || path === '/services') {
      return new Response(JSON.stringify({
        name: 'Coin Railz x402 Gateway',
        description: 'Pay-per-call crypto intelligence for AI agents',
        services: SERVICES.map(s => ({
          ...s,
          endpoint: `${url.origin}/${s.id}`,
          x402Endpoint: `${env.COINRAILZ_BASE_URL}/x402/v2/${s.id}`,
        })),
        documentation: 'https://coinrailz.com/docs',
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Proxy service requests
    const serviceId = path.replace('/', '').replace('/x402/', '');
    const service = SERVICES.find(s => s.id === serviceId);
    
    if (!service) {
      return new Response(JSON.stringify({
        error: 'Service not found',
        availableServices: SERVICES.map(s => s.id),
        catalogUrl: `${url.origin}/catalog`,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Forward to Coin Railz with x402 headers
    const upstreamUrl = `${env.COINRAILZ_BASE_URL}/x402/v2/${serviceId}`;
    
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

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Upstream service unavailable',
        service: serviceId,
        upstream: upstreamUrl,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
};
