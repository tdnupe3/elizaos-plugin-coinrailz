import { Request, Response, NextFunction } from 'express';
import { x402InteractionTracker } from '../services/x402InteractionTracker';
import { serviceCatalogService } from '../services/serviceCatalogService';
import { nanoid } from 'nanoid';

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
    const serviceId = extractServiceId(req.path) || extractServiceId(req.originalUrl || '');
    if (!serviceId) {
      console.log(`⚠️  Could not extract service ID from path: ${req.path} (originalUrl: ${req.originalUrl})`);
      return;
    }
    
    const walletAddress = extractWalletAddress(req);
    
    let interactionType: 'view' | 'attempt' | 'payment' | 'error' = 'view';
    let eventType = 'request-complete';
    
    if (paid) {
      interactionType = 'payment';
      eventType = 'authorized';
    } else if (responseStatus === 402) {
      interactionType = 'attempt';
      eventType = 'challenge-issued';
    } else if (responseStatus >= 400) {
      interactionType = 'error';
      eventType = 'error';
    }
    
    const x402ClientHeader = req.get('x-402-client') || req.get('x-agent-id') || req.get('x-coinrailz-client');
    const referer = req.get('referer') || req.get('origin');
    
    // Get offer tracking ID if this request came from an offer link
    // Priority: query param (survives redirects) > request property (internal routing)
    const offerTrackingId = (req.query?.offer_tracking as string) || (req as any).offerTrackingId || undefined;
    
    x402InteractionTracker.trackInteraction({
      serviceId,
      serviceName: serviceId,
      walletAddress,
      ipAddress: req.ip || req.socket.remoteAddress || req.get('x-forwarded-for')?.split(',')[0],
      userAgent: req.get('user-agent'),
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
      retryCount: 0,
      paymentReceived: paid,
      paymentAmount: res.locals.payment?.amount || undefined,
      offerTrackingId,
      metadata: {
        originalUrl: req.originalUrl,
        hasPaymentHeader: !!req.get('x-payment'),
        paymentMethod: res.locals.payment?.method,
        offerAttribution: offerTrackingId ? true : false,
      },
    }).catch(err => {
      console.error('❌ Interaction tracking failed:', err.message);
    });
    
    if (responseStatus === 402) {
      console.log(`📊 x402 Funnel: ${eventType} for ${serviceId} | IP: ${req.ip || 'unknown'} | Agent: ${x402ClientHeader || 'none'} | Latency: ${latencyMs}ms`);
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
  const patterns = [
    /\/x402\/([^\/\?]+)/, // Full path: /x402/multi-chain-balance
    /^\/([^\/\?]+)$/, // Relative path: /multi-chain-balance
  ];
  
  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function extractWalletAddress(req: Request): string | undefined {
  return (
    req.body?.walletAddress ||
    req.body?.fromAddress ||
    req.body?.agentId ||
    req.query?.wallet as string ||
    req.headers['x-wallet-address'] as string
  );
}
