import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { microserviceRequests } from '@shared/schema';

export interface AnalyticsContext {
  requestId: string;
  serviceId: string;
  startTime: number;
  paymentMethod?: 'eip712' | 'tx_hash' | null;
  walletAddress?: string;
  userAgent?: string;
}

function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    return ips.split(',')[0].trim();
  }
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function detectGateway(req: Request): string | null {
  const xGateway = req.headers['x-gateway'] as string | undefined;
  if (xGateway) {
    return xGateway.substring(0, 50);
  }
  const referer = req.headers['referer'] as string | undefined;
  if (referer?.includes('farcaster') || referer?.includes('warpcast')) {
    return 'farcaster-frame';
  }
  const origin = req.headers['origin'] as string | undefined;
  if (origin?.includes('workers.dev') || origin?.includes('cloudflare')) {
    return 'cloudflare-worker';
  }
  return null;
}

export function usageAnalyticsMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = nanoid();
  const startTime = Date.now();

  // Use originalUrl (full path e.g. /x402/trade-signals) not req.path which is
  // router-relative (e.g. /trade-signals) and would never match /x402/...
  const requestPath = req.originalUrl || req.path;
  const serviceId = extractServiceId(requestPath);
  const userAgent = req.headers['user-agent'] || null;
  const requestMethod = req.method;
  const clientIp = getClientIp(req);
  const paymentAttempted = !!req.headers['x-payment'];
  const sourceGateway = detectGateway(req);

  // DIAGNOSTIC: Log every x402 request with gateway info
  console.log(`📊 ANALYTICS MW: ${requestMethod} ${requestPath} | Gateway: ${sourceGateway || 'direct'} | UA: ${userAgent?.substring(0, 50)} | IP: ${clientIp}`);

  const analyticsContext: AnalyticsContext = {
    requestId,
    serviceId,
    startTime,
    userAgent: userAgent || undefined,
  };

  (req as any).analytics = analyticsContext;

  let analyticsLogged = false;

  const logRequest = async (statusCode: number) => {
    if (analyticsLogged) return;
    analyticsLogged = true;

    const responseTime = Date.now() - startTime;

    const paymentHeader = req.headers['x-payment'] as string | undefined;
    let paymentMethod: 'eip712' | 'tx_hash' | null = null;

    if (paymentHeader) {
      if (paymentHeader.startsWith('0x') && paymentHeader.length === 66) {
        paymentMethod = 'tx_hash';
      } else {
        paymentMethod = 'eip712';
      }
    }

    try {
      console.log(`📊 ANALYTICS DB INSERT: serviceId=${serviceId} requestId=${requestId} status=${statusCode}`);
      await db.insert(microserviceRequests).values({
        id: requestId,
        serviceId,
        requestInput: req.body || {},
        responseData: null,
        responseTime,
        paymentMethod,
        userAgent: userAgent || null,
        requestMethod,
        requestPath: requestPath.substring(0, 255),
        clientIp,
        paymentAttempted,
        sourceGateway,
        paymentStatus: statusCode === 200 ? 'completed' : statusCode === 402 ? 'pending' : 'failed',
        walletAddress: analyticsContext.walletAddress || null,
        error: statusCode >= 400 && statusCode !== 402 ? `HTTP ${statusCode}` : null,
      });
      console.log(`✅ ANALYTICS DB INSERT SUCCESS: ${requestId}`);
    } catch (error: any) {
      console.error(`❌ ANALYTICS DB INSERT FAILED: ${error.message} | ${error.code || 'no-code'}`);
    }
  };

  // Use res.on('finish') instead of overriding res.send/res.json.
  // 'finish' fires for ALL response types: json, send, redirect (308/301), end().
  // The old override pattern silently missed redirect responses.
  res.on('finish', () => {
    logRequest(res.statusCode).catch(console.error);
  });

  next();
}

function extractServiceId(path: string): string {
  // path should be originalUrl (e.g. /x402/trade-signals or /x402/service/trade-signals)
  const match = path.match(/\/x402\/(?:service\/)?([^/?#]+)/);
  return match ? match[1] : 'unknown';
}

export function detectSDK(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('agentkit')) return 'coinbase-agentkit';
  if (ua.includes('x402-fetch')) return 'x402-fetch';
  if (ua.includes('eliza')) return 'elizaos';
  if (ua.includes('python')) return 'python';
  if (ua.includes('node-fetch')) return 'node-fetch';
  if (ua.includes('axios')) return 'axios';
  if (ua.includes('curl')) return 'curl';
  if (ua.includes('postman')) return 'postman';
  
  return 'other';
}

export async function getUsageStats(timeframe: 'hour' | 'day' | 'week' = 'day') {
  const now = new Date();
  const startTime = new Date();
  
  switch (timeframe) {
    case 'hour':
      startTime.setHours(startTime.getHours() - 1);
      break;
    case 'day':
      startTime.setDate(startTime.getDate() - 1);
      break;
    case 'week':
      startTime.setDate(startTime.getDate() - 7);
      break;
  }
  
  const requests = await db.query.microserviceRequests.findMany({
    where: (table, { gte }) => gte(table.createdAt, startTime),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  
  const stats = {
    totalRequests: requests.length,
    byPaymentMethod: {
      eip712: requests.filter(r => r.paymentMethod === 'eip712').length,
      tx_hash: requests.filter(r => r.paymentMethod === 'tx_hash').length,
      no_payment: requests.filter(r => !r.paymentMethod).length,
    },
    byGateway: {} as Record<string, number>,
    bySDK: {} as Record<string, number>,
    byService: {} as Record<string, number>,
    avgResponseTime: 0,
    uniqueWallets: new Set(requests.map(r => r.walletAddress).filter(Boolean)).size,
  };
  
  requests.forEach(req => {
    const sdk = detectSDK(req.userAgent || undefined);
    stats.bySDK[sdk] = (stats.bySDK[sdk] || 0) + 1;
    
    stats.byService[req.serviceId] = (stats.byService[req.serviceId] || 0) + 1;
    
    const gateway = (req as any).sourceGateway || 'direct';
    stats.byGateway[gateway] = (stats.byGateway[gateway] || 0) + 1;
  });
  
  const validResponseTimes = requests.filter(r => r.responseTime).map(r => r.responseTime!);
  if (validResponseTimes.length > 0) {
    stats.avgResponseTime = Math.round(
      validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length
    );
  }
  
  return stats;
}
