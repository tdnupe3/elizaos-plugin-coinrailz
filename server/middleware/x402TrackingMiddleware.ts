import { Request, Response, NextFunction } from 'express';
import { x402InteractionTracker } from '../services/x402InteractionTracker';
import { serviceCatalogService } from '../services/serviceCatalogService';
import { offerLinkService } from '../services/offerLinkService';
import { nanoid } from 'nanoid';

// Service pricing in USD for conversion tracking (EIP-712 path)
const SERVICE_PRICING_USD: Record<string, number> = {
  "ping": 0.25,
  "multi-chain-balance": 1.00,
  "gas-price-oracle": 0.50,
  "token-price": 0.75,
  "contract-scan": 2.50,
  "wallet-risk": 5.00,
  "trade-signals": 10.00,
  "default": 1.00
};

// ChatGPT-recommended: Retry fingerprinting to track post-402 behavior
// Tracks IP + user-agent combinations to detect retry attempts
interface RetryFingerprint {
  firstSeen: number;
  lastSeen: number;
  retryCount: number;
  hasPaymentHeader: boolean;
  serviceId: string;
  intervals: number[]; // Time between retries in seconds
}

// In-memory cache for retry fingerprints (cleaned up hourly)
const retryFingerprintCache = new Map<string, RetryFingerprint>();
const FINGERPRINT_TTL_MS = 60 * 60 * 1000; // 1 hour

// Clean up old fingerprints periodically
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of retryFingerprintCache.entries()) {
    if (now - value.lastSeen > FINGERPRINT_TTL_MS) {
      retryFingerprintCache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} stale retry fingerprints`);
  }
}, 30 * 60 * 1000); // Every 30 minutes

/**
 * Generate fingerprint from IP + user-agent + service
 * This allows us to detect when the same agent retries the same service
 */
function generateFingerprint(ip: string | undefined, userAgent: string | undefined, serviceId: string): string {
  const cleanIp = ip?.split(',')[0].trim() || 'unknown';
  const cleanAgent = (userAgent || 'unknown').substring(0, 50);
  return `${cleanIp}:${cleanAgent}:${serviceId}`;
}

/**
 * Track retry behavior for a request
 * Returns retry metadata for logging
 */
function trackRetryBehavior(
  ip: string | undefined,
  userAgent: string | undefined,
  serviceId: string,
  hasPaymentHeader: boolean
): { retryCount: number; retryIntervalSeconds: number | null; isRetry: boolean; retryHeaderChanged: boolean } {
  const fingerprint = generateFingerprint(ip, userAgent, serviceId);
  const now = Date.now();
  
  const existing = retryFingerprintCache.get(fingerprint);
  
  if (!existing) {
    // First time seeing this fingerprint
    retryFingerprintCache.set(fingerprint, {
      firstSeen: now,
      lastSeen: now,
      retryCount: 0,
      hasPaymentHeader,
      serviceId,
      intervals: []
    });
    return { retryCount: 0, retryIntervalSeconds: null, isRetry: false, retryHeaderChanged: false };
  }
  
  // This is a retry
  const intervalSeconds = Math.round((now - existing.lastSeen) / 1000);
  const retryHeaderChanged = hasPaymentHeader && !existing.hasPaymentHeader;
  
  // Update the fingerprint
  existing.retryCount++;
  existing.lastSeen = now;
  existing.hasPaymentHeader = existing.hasPaymentHeader || hasPaymentHeader;
  existing.intervals.push(intervalSeconds);
  
  return {
    retryCount: existing.retryCount,
    retryIntervalSeconds: intervalSeconds,
    isRetry: true,
    retryHeaderChanged
  };
}

export function x402TrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = nanoid(12);
  
  // Debug: Log when middleware is entered
  const offerTracking = req.query?.offer_tracking as string;
  if (offerTracking || req.path.includes('ping')) {
    console.log(`📊 TRACKING MW ENTRY: path=${req.path}, hasOffer=${!!offerTracking}, offerTracking=${offerTracking || 'none'}`);
  }
  
  res.locals.x402RequestId = requestId;
  res.locals.x402StartTime = startTime;
  
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  
  let responseIntercepted = false;
  
  const trackInteraction = (responseStatus: number, paid: boolean = false, challengePayload?: object) => {
    if (responseIntercepted) return;
    responseIntercepted = true;
    
    const latencyMs = Date.now() - startTime;
    // Check originalUrl first for mounted routers (satellite/IoT), then fall back to req.path
    const serviceId = extractServiceId(req.originalUrl || '') || extractServiceId(req.path);
    if (!serviceId) {
      console.log(`⚠️  Could not extract service ID from path: ${req.path} (originalUrl: ${req.originalUrl})`);
      return;
    }
    
    const walletAddress = extractWalletAddress(req, res);
    
    // Log wallet address capture for paid interactions
    if (paid && walletAddress) {
      console.log(`💳 WALLET CAPTURED: ${walletAddress} for service ${serviceId} (from payment verification)`);
    }
    
    // ChatGPT-recommended: Track retry behavior for post-402 analysis
    const hasPaymentHeader = !!req.get('x-payment');
    const ip = req.ip || req.socket.remoteAddress || req.get('x-forwarded-for')?.split(',')[0];
    const userAgent = req.get('user-agent');
    const retryData = trackRetryBehavior(ip, userAgent, serviceId, hasPaymentHeader);
    
    let interactionType: 'view' | 'attempt' | 'payment' | 'error' = 'view';
    let eventType = 'request-complete';
    
    if (paid) {
      interactionType = 'payment';
      eventType = 'authorized';
      
      // CONVERSION TRACKING: Record conversion for EIP-712 payments (x402-express path)
      // Only record if not already recorded by orchestrator (check for raw-hash method)
      const offerTrackingId = (req.query?.offer_tracking as string) || (req as any).offerTrackingId;
      const wasHandledByOrchestrator = res.locals.payment?.method === 'raw-hash' || res.locals.payment?.method === 'bundle-subscription';
      
      if (offerTrackingId && !wasHandledByOrchestrator) {
        const priceUsd = SERVICE_PRICING_USD[serviceId] || SERVICE_PRICING_USD["default"];
        console.log(`💰 EIP-712 CONVERSION: ${serviceId} paid via offer ${offerTrackingId} ($${priceUsd})`);
        offerLinkService.recordConversion(offerTrackingId, priceUsd)
          .then(() => console.log(`✅ EIP-712 conversion recorded for offer ${offerTrackingId}`))
          .catch((err: any) => console.error(`⚠️ Failed to record EIP-712 conversion: ${err.message}`));
      }
    } else if (responseStatus === 402) {
      interactionType = 'attempt';
      eventType = 'challenge-issued';
    } else if (responseStatus >= 400) {
      interactionType = 'error';
      eventType = 'error';
    }

    // Reclassify GET requests — these are landing page / discovery views, never payment completions.
    // x402 payment flow is exclusively POST. A GET 'request-complete' is a browser/crawler page view.
    if (req.method === 'GET' && interactionType === 'view' && eventType === 'request-complete') {
      eventType = 'landing-view';
    }
    
    const x402ClientHeader = req.get('x-402-client') || req.get('x-agent-id') || req.get('x-coinrailz-client');
    const referer = req.get('referer') || req.get('origin');
    
    // Get offer tracking ID if this request came from an offer link
    // Priority: query param (survives redirects) > request property (internal routing)
    const offerTrackingId = (req.query?.offer_tracking as string) || (req as any).offerTrackingId || undefined;
    
    // FIX: Always compute payment amount for paid transactions
    // Either from res.locals.payment.amount (orchestrator path) or from service pricing (EIP-712 path)
    let paymentAmount: number | undefined = res.locals.payment?.amount;
    if (paid && !paymentAmount) {
      paymentAmount = SERVICE_PRICING_USD[serviceId] || SERVICE_PRICING_USD["default"];
      console.log(`💵 Payment amount computed from service pricing: $${paymentAmount} for ${serviceId}`);
    }
    
    x402InteractionTracker.trackInteraction({
      serviceId,
      serviceName: serviceId,
      walletAddress,
      ipAddress: ip,
      userAgent,
      requestPath: req.path,
      requestMethod: req.method,
      responseStatus,
      paid,
      interactionType,
      requestId,
      eventType,
      x402ClientHeader,
      referer,
      challengePayload,
      latencyMs,
      retryCount: retryData.retryCount,
      paymentReceived: paid,
      paymentAmount,
      offerTrackingId,
      metadata: {
        originalUrl: req.originalUrl,
        hasPaymentHeader,
        paymentMethod: res.locals.payment?.method || (paid ? 'eip-712' : undefined),
        offerAttribution: offerTrackingId ? true : false,
        // ChatGPT-recommended: Retry fingerprinting data for post-402 analysis
        isRetry: retryData.isRetry,
        retryIntervalSeconds: retryData.retryIntervalSeconds,
        retryHeaderChanged: retryData.retryHeaderChanged,
      },
    }).catch(err => {
      console.error('❌ Interaction tracking failed:', err.message);
    });
    
    // Enhanced logging for 402s with retry information
    if (responseStatus === 402) {
      const retryInfo = retryData.isRetry 
        ? `| RETRY #${retryData.retryCount} (${retryData.retryIntervalSeconds}s ago)${retryData.retryHeaderChanged ? ' + PAYMENT HEADER ADDED' : ''}`
        : '| First attempt';
      console.log(`📊 x402 Funnel: ${eventType} for ${serviceId} | IP: ${ip || 'unknown'} | Agent: ${x402ClientHeader || 'none'} ${retryInfo} | Latency: ${latencyMs}ms`);
    }
  };
  
  res.send = function(body: any) {
    let challengePayload: object | undefined;
    if (res.statusCode === 402 && typeof body === 'string') {
      try {
        challengePayload = JSON.parse(body);
      } catch (e) {}
    }
    
    // FIX: Also detect paid status for send() calls (x402-express uses send for some responses)
    // Check for payment header + 2xx success status = paid request
    // Also check for x-payment-response header which x402-express sets on successful payments
    const hasPaymentHeader = !!req.get('x-payment');
    const hasPaymentResponseHeader = !!res.getHeader('x-payment-response');
    const isSuccessStatus = res.statusCode >= 200 && res.statusCode < 300;
    const paymentFromLocals = res.locals.payment?.status === 'paid' || res.locals.payment?.verified === true;
    const paymentFromResponseHeader = isSuccessStatus && hasPaymentResponseHeader;
    const isPaid = paymentFromLocals || paymentFromResponseHeader || (hasPaymentHeader && isSuccessStatus);
    
    // Debug logging
    const offerTrackingId = (req.query?.offer_tracking as string) || (req as any).offerTrackingId;
    if (offerTrackingId || hasPaymentHeader || hasPaymentResponseHeader) {
      console.log(`📊 TRACKING DEBUG [send]: path=${req.path}, status=${res.statusCode}, hasPaymentHeader=${hasPaymentHeader}, hasPaymentResponseHeader=${hasPaymentResponseHeader}, isSuccess=${isSuccessStatus}, isPaid=${isPaid}, offerTracking=${offerTrackingId || 'none'}`);
    }
    
    trackInteraction(res.statusCode, isPaid, challengePayload);
    return originalSend(body);
  };
  
  res.json = function(body: any) {
    // Detect paid interactions from multiple sources:
    // 1. res.locals.payment (set by x402 middleware after payment verification)
    // 2. body.paid === true (explicit flag from handler)
    // 3. body.success && 2xx status with payment header present
    // 4. x-payment-response header present on response (x402-express sets this on successful payment)
    const hasPaymentHeader = !!req.get('x-payment');
    const hasPaymentResponseHeader = !!res.getHeader('x-payment-response');
    const isSuccessStatus = res.statusCode >= 200 && res.statusCode < 300;
    const paymentFromLocals = res.locals.payment?.status === 'paid' || res.locals.payment?.verified === true;
    const paymentFromBody = body?.success === true && body?.paid === true;
    const paymentFromContext = body?.success === true && isSuccessStatus && hasPaymentHeader;
    const paymentFromResponseHeader = isSuccessStatus && hasPaymentResponseHeader;
    const isPaid = paymentFromLocals || paymentFromBody || paymentFromContext || paymentFromResponseHeader;
    
    // Debug logging
    const offerTrackingId = (req.query?.offer_tracking as string) || (req as any).offerTrackingId;
    if (offerTrackingId || hasPaymentHeader || hasPaymentResponseHeader) {
      console.log(`📊 TRACKING DEBUG [json]: path=${req.path}, status=${res.statusCode}, hasPaymentHeader=${hasPaymentHeader}, hasPaymentResponseHeader=${hasPaymentResponseHeader}, isSuccess=${isSuccessStatus}, bodySuccess=${body?.success}, isPaid=${isPaid}, offerTracking=${offerTrackingId || 'none'}`);
    }
    
    const challengePayload = res.statusCode === 402 ? body : undefined;
    trackInteraction(res.statusCode, isPaid, challengePayload);
    
    // Enrich 402 responses with catalog recommendations for cross-sell
    if (res.statusCode === 402 && body && typeof body === 'object') {
      try {
        const serviceId = extractServiceId(req.path) || extractServiceId(req.originalUrl || '');
        
        if (serviceId && !body.recommendedServices) {
          const recommendations = serviceCatalogService.getRecommendedServices(serviceId);
          const catalogSummary = serviceCatalogService.getCatalogSummary();
          
          body.recommendedServices = recommendations.map((s: any) => ({
            id: s.id,
            name: s.name,
            priceUSD: s.priceUSD,
            endpoint: s.endpoint
          }));
          body.catalogUrl = catalogSummary.catalogUrl;
          body.totalServicesAvailable = catalogSummary.totalServices;
        }
      } catch (e) {
        // Silent fail - enrichment is optional
      }
    }
    
    return originalJson(body);
  };
  
  next();
}

function extractServiceId(path: string): string | null {
  // FIX: Updated for new path structure without /service/ prefix
  // Path patterns: /multi-chain-balance (req.path) or /x402/multi-chain-balance (req.originalUrl)
  // Also handles satellite/IoT endpoints: /api/satellite/fire-alerts, /api/iot/catalog
  const patterns = [
    /\/x402\/([^\/\?]+)/, // Full path: /x402/multi-chain-balance
    /\/api\/satellite\/([^\/\?]+)/, // Satellite endpoints: /api/satellite/fire-alerts
    /\/api\/iot\/([^\/\?]+)/, // IoT endpoints: /api/iot/catalog
    /^\/([^\/\?]+)$/, // Relative path: /multi-chain-balance
  ];
  
  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (match) {
      // For satellite/IoT, prefix the service ID for clarity
      if (path.includes('/api/satellite/')) {
        return `satellite-${match[1]}`;
      }
      if (path.includes('/api/iot/')) {
        return `iot-${match[1]}`;
      }
      return match[1];
    }
  }
  
  return null;
}

function extractWalletAddress(req: Request, res?: Response): string | undefined {
  // Priority order for wallet address extraction:
  // 1. res.locals.payment.payer - from verified on-chain payment (most reliable)
  // 2. res.locals.payment.payerWallet - alternative field name
  // 3. req.body fields - from request payload
  // 4. Query params and headers - from URL/headers
  
  // Check res.locals.payment for payer wallet (set by payment verification)
  if (res?.locals?.payment?.payer) {
    return res.locals.payment.payer;
  }
  if (res?.locals?.payment?.payerWallet) {
    return res.locals.payment.payerWallet;
  }
  if (res?.locals?.payment?.senderAddress) {
    return res.locals.payment.senderAddress;
  }
  
  // Fall back to request data
  return (
    req.body?.walletAddress ||
    req.body?.fromAddress ||
    req.body?.agentId ||
    req.query?.wallet as string ||
    req.headers['x-wallet-address'] as string
  );
}
