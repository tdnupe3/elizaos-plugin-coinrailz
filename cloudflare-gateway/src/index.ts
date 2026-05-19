/**
 * Cloudflare Worker x402 Gateway for Coin Railz
 *
 * This worker proxies x402 requests to Coin Railz services,
 * allowing integration with Cloudflare's Agent SDK ecosystem.
 *
 * Exposes ALL 65 x402 services dynamically from the main catalog.
 */

export interface Env {
  COINRAILZ_BASE_URL: string;
  WALLET_ADDRESS?: string;
}

// Cache for the full service catalog (refreshed every 5 minutes)
let cachedCatalog: any[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchFullCatalog(baseUrl: string): Promise<any[]> {
  const now = Date.now();
  if (cachedCatalog.length > 0 && now - cacheTimestamp < CACHE_TTL) {
    return cachedCatalog;
  }

  try {
    const response = await fetch(`${baseUrl}/x402/catalog`);
    if (response.ok) {
      const data = (await response.json()) as any;
      cachedCatalog = data.services || [];
      cacheTimestamp = now;
      return cachedCatalog;
    }
  } catch (_e) {
    // Fall back to cached or empty
  }

  return cachedCatalog;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for browser-based agents
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, X-PAYMENT, Authorization, X-API-Key",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Fetch full catalog
    const services = await fetchFullCatalog(env.COINRAILZ_BASE_URL);

    // Health check
    if (path === "/" || path === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          gateway: "coinrailz-x402",
          version: "2.12.0",
          totalServices: services.length,
          upstream: env.COINRAILZ_BASE_URL,
          documentation: "https://coinrailz.com/docs",
          catalogEndpoint: `${url.origin}/catalog`,
          x402Version: 2,
          protocol: "x402",
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Full service catalog
    if (path === "/catalog" || path === "/services") {
      return new Response(
        JSON.stringify({
          name: "Coin Railz x402 Gateway",
          description:
            "Universal payment infrastructure for AI agents — Crypto (x402), Fiat (Stripe), Credits, and FREE wallet provisioning",
          protocol: "x402",
          x402Version: 2,
          totalServices: services.length,
          services: services.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            priceUSD: s.priceUSD,
            category: s.category,
            endpoint: `${url.origin}/${s.id}`,
            x402Endpoint: s.endpoint || `${env.COINRAILZ_BASE_URL}/x402/${s.id}`,
            discoverable: s.discoverable,
            firstCallFree: s.firstCallFree,
          })),
          documentation: "https://coinrailz.com/docs",
          x402Spec: "https://www.x402.org",
          facilitatorUrl:
            "https://api.cdp.coinbase.com/platform/v2/x402",
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Proxy service requests — match any service from the catalog
    const serviceId = path.replace(/^\/+/, "").split("/")[0];

    if (!serviceId) {
      return new Response(
        JSON.stringify({
          error: "No service specified",
          usage: `${url.origin}/<service-id>`,
          catalogUrl: `${url.origin}/catalog`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const service = services.find((s: any) => s.id === serviceId);

    if (!service) {
      return new Response(
        JSON.stringify({
          error: "Service not found",
          requestedService: serviceId,
          availableServices: services.slice(0, 10).map((s: any) => s.id),
          totalAvailable: services.length,
          catalogUrl: `${url.origin}/catalog`,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Forward to Coin Railz with x402 headers
    // CANONICAL ENDPOINT: /x402/{serviceId} (verified working in production)
    // Preserve query string from original request
    const upstreamBase =
      service.endpoint || `${env.COINRAILZ_BASE_URL}/x402/${serviceId}`;
    const upstreamUrl = url.search ? `${upstreamBase}${url.search}` : upstreamBase;

    const headers = new Headers(request.headers);
    headers.set(
      "X-Forwarded-For",
      request.headers.get("CF-Connecting-IP") || "unknown"
    );
    headers.set("X-Gateway", "cloudflare-coinrailz");

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body:
          request.method !== "GET" && request.method !== "HEAD"
            ? await request.text()
            : undefined,
      });

      // Clone response and add gateway headers
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set("X-Gateway", "cloudflare-coinrailz");
      responseHeaders.set("X-Service", serviceId);
      Object.entries(corsHeaders).forEach(([k, v]) =>
        responseHeaders.set(k, v)
      );

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Upstream service unavailable",
          service: serviceId,
          upstream: upstreamUrl,
          message: "Please try again or contact support",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  },
};
