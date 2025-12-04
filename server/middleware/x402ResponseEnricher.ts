/**
 * x402 Response Enricher Middleware
 * 
 * SAFE APPROACH: This middleware only intercepts 402 responses AFTER they're generated,
 * adding missing fields required by x402 agents without modifying the payment verification flow.
 * 
 * Fields added/normalized:
 * - resource: Canonical coinrailz.com URL
 * - maxAmountRequiredUSD: Human-readable USD amount
 * - paymentInstructions: Step-by-step payment guide
 * - facilitatorUrl: Coinbase facilitator endpoint
 * - discoverable: true (for Bazaar indexing)
 */

import { Request, Response, NextFunction } from "express";
import { serviceCatalogService } from "../services/serviceCatalogService";

const CANONICAL_BASE_URL = process.env.PUBLIC_URL || 'https://coinrailz.com';
const FACILITATOR_URL = 'https://facilitator.x402.io';

function getCanonicalBaseUrl(): string {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    return 'https://coinrailz.com';
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return 'http://localhost:5000';
}

function microToUSD(microUnits: string | number): string {
  const micro = typeof microUnits === 'string' ? parseInt(microUnits, 10) : microUnits;
  if (isNaN(micro)) return '$0.00';
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

function normalizeResourceUrl(resource: string | undefined, endpoint: string): string {
  const baseUrl = getCanonicalBaseUrl();
  
  if (!resource) {
    return `${baseUrl}${endpoint}`;
  }
  
  if (resource.includes('localhost') || resource.includes('.repl.co') || resource.includes('.replit.dev')) {
    const path = resource.replace(/^https?:\/\/[^\/]+/, '');
    return `${baseUrl}${path}`;
  }
  
  return resource;
}

/**
 * Creates payment instructions object for 402 responses
 */
function createPaymentInstructions() {
  return {
    step1: "Obtain USDC on Base chain (chainId: 8453)",
    step2: "Sign EIP-3009 authorization for the exact amount",
    step3: "Include Base64-encoded authorization in X-PAYMENT header",
    step4: "Retry the request with X-PAYMENT header",
    alternativeStep3: "Or include raw transaction hash (0x...) in X-PAYMENT header after sending USDC to payTo address",
    supportedMethods: ["eip3009-authorization", "raw-transaction-hash"],
    network: "base",
    chainId: 8453,
    token: "USDC",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  };
}

/**
 * x402 Response Enricher Middleware
 * 
 * SAFE: Only modifies 402 responses, doesn't touch verification logic.
 * Must be applied BEFORE the x402 middleware (before paymentMiddleware runs)
 * so res.json is wrapped before x402-express calls it.
 */
export function x402ResponseEnricher() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      if (res.statusCode === 402 && body?.x402Version && body?.accepts) {
        const baseUrl = getCanonicalBaseUrl();
        const endpoint = req.originalUrl || req.path;
        
        body.facilitatorUrl = body.facilitatorUrl || FACILITATOR_URL;
        
        body.accepts = body.accepts.map((paymentReq: any) => {
          const enriched = { ...paymentReq };
          
          enriched.resource = normalizeResourceUrl(paymentReq.resource, endpoint);
          enriched.discoverable = true;
          
          if (paymentReq.maxAmountRequired && !paymentReq.maxAmountRequiredUSD) {
            enriched.maxAmountRequiredUSD = microToUSD(paymentReq.maxAmountRequired);
          }
          
          if (!enriched.extra) {
            enriched.extra = {};
          }
          enriched.extra.name = enriched.extra.name || "USD Coin";
          enriched.extra.version = enriched.extra.version || "2";
          enriched.extra.decimals = enriched.extra.decimals || 6;
          enriched.extra.chainId = enriched.extra.chainId || 8453;
          enriched.extra.chainName = enriched.extra.chainName || "Base";
          
          return enriched;
        });
        
        if (!body.paymentInstructions) {
          body.paymentInstructions = createPaymentInstructions();
        }
        
        try {
          const servicePath = req.path.replace(/^\/service\//, '').replace(/^\//, '').replace(/\/$/, '');
          const recommendations = serviceCatalogService.getRecommendedServices(servicePath);
          const catalogSummary = serviceCatalogService.getCatalogSummary();
          
          if (!body.recommendedServices) {
            body.recommendedServices = recommendations.map((s: any) => ({
              id: s.id,
              name: s.name,
              priceUSD: s.priceUSD,
              endpoint: s.endpoint
            }));
          }
          body.catalogUrl = body.catalogUrl || catalogSummary.catalogUrl;
          body.totalServicesAvailable = body.totalServicesAvailable || catalogSummary.totalServices;
        } catch (e: any) {
        }
        
        console.log(`📊 x402 Funnel: challenge-issued for ${req.path} | IP: ${req.ip} | Agent: ${req.headers['user-agent']?.substring(0, 20) || 'none'} | Latency: ${Date.now() - (res.locals.startTime || Date.now())}ms`);
      }
      
      return originalJson(body);
    };
    
    res.locals.startTime = Date.now();
    next();
  };
}

export default x402ResponseEnricher;
