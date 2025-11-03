import { Request, Response, NextFunction } from 'express';
import { x402InteractionTracker } from '../services/x402InteractionTracker';

export function x402TrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  
  let responseIntercepted = false;
  
  const trackInteraction = (responseStatus: number, paid: boolean = false) => {
    if (responseIntercepted) return;
    responseIntercepted = true;
    
    // Try both req.path and req.originalUrl to handle router mounting
    const serviceId = extractServiceId(req.path) || extractServiceId(req.originalUrl || '');
    if (!serviceId) {
      console.log(`⚠️  Could not extract service ID from path: ${req.path} (originalUrl: ${req.originalUrl})`);
      return;
    }
    
    const walletAddress = extractWalletAddress(req);
    
    let interactionType: 'view' | 'attempt' | 'payment' | 'error' = 'view';
    
    if (paid) {
      interactionType = 'payment';
    } else if (responseStatus === 402) {
      interactionType = 'attempt';
    } else if (responseStatus >= 400) {
      interactionType = 'error';
    }
    
    x402InteractionTracker.trackInteraction({
      serviceId,
      walletAddress,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method,
      responseStatus,
      paid,
      interactionType,
    }).catch(err => {
      console.error('❌ Interaction tracking failed:', err.message);
    });
  };
  
  res.send = function(body: any) {
    trackInteraction(res.statusCode);
    return originalSend(body);
  };
  
  res.json = function(body: any) {
    const isPaid = body?.success === true && body?.paid === true;
    trackInteraction(res.statusCode, isPaid);
    return originalJson(body);
  };
  
  next();
}

function extractServiceId(path: string): string | null {
  // Path might be /service/... (from req.path) or /x402/service/... (from req.originalUrl)
  // Try both patterns to handle router mounting
  const patterns = [
    /\/service\/([^\/\?]+)/, // When mounted at /x402
    /\/x402\/service\/([^\/\?]+)/, // Full path
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
