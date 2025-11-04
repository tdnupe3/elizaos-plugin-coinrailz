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

export function usageAnalyticsMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = nanoid();
  const startTime = Date.now();
  
  const serviceId = extractServiceId(req.path);
  const userAgent = req.headers['user-agent'] || null;
  
  const analyticsContext: AnalyticsContext = {
    requestId,
    serviceId,
    startTime,
    userAgent: userAgent || undefined,
  };
  
  (req as any).analytics = analyticsContext;
  
  let analyticsLogged = false;
  
  const originalSend = res.send;
  const originalJson = res.json;
  
  const logRequest = async (responseData: any, statusCode: number) => {
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
      await db.insert(microserviceRequests).values({
        id: requestId,
        serviceId,
        requestInput: req.body || {},
        responseData: typeof responseData === 'string' ? { raw: responseData } : responseData,
        responseTime,
        paymentMethod,
        userAgent: userAgent || null,
        paymentStatus: statusCode === 200 ? 'completed' : statusCode === 402 ? 'pending' : 'failed',
        walletAddress: analyticsContext.walletAddress || null,
        error: statusCode >= 400 && statusCode !== 402 ? JSON.stringify(responseData) : null,
      });
    } catch (error) {
      console.error('❌ Failed to log analytics:', error);
    }
  };
  
  res.send = function(data: any) {
    logRequest(data, res.statusCode).catch(console.error);
    return originalSend.call(this, data);
  };
  
  res.json = function(data: any) {
    logRequest(data, res.statusCode).catch(console.error);
    return originalJson.call(this, data);
  };
  
  next();
}

function extractServiceId(path: string): string {
  const match = path.match(/\/x402\/([^\/]+)/);
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
    bySDK: {} as Record<string, number>,
    byService: {} as Record<string, number>,
    avgResponseTime: 0,
    uniqueWallets: new Set(requests.map(r => r.walletAddress).filter(Boolean)).size,
  };
  
  requests.forEach(req => {
    const sdk = detectSDK(req.userAgent || undefined);
    stats.bySDK[sdk] = (stats.bySDK[sdk] || 0) + 1;
    
    stats.byService[req.serviceId] = (stats.byService[req.serviceId] || 0) + 1;
  });
  
  const validResponseTimes = requests.filter(r => r.responseTime).map(r => r.responseTime!);
  if (validResponseTimes.length > 0) {
    stats.avgResponseTime = Math.round(
      validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length
    );
  }
  
  return stats;
}
