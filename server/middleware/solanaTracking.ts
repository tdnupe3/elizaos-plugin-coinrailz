/**
 * Solana Endpoint Tracking Middleware
 * Captures all hits to Solana Pay endpoints for analytics
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { solanaEndpointInteractions } from '@shared/schema.js';

interface TrackingData {
  endpoint: string;
  method: string;
  ipAddress?: string;
  userAgent?: string;
  userAgentCategory: string;
  walletAddress?: string;
  customerId?: string;
  statusCode: number;
  responseTimeMs?: number;
  success: boolean;
  intentId?: string;
  serviceSlug?: string;
  tokenSymbol?: string;
  requestedAmount?: string;
  isWebhook: boolean;
  webhookType?: string;
  txSignature?: string;
  errorType?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

function categorizeUserAgent(ua: string | undefined): string {
  if (!ua) return 'unknown';
  const uaLower = ua.toLowerCase();
  
  if (uaLower.includes('helius')) return 'helius';
  if (uaLower.includes('x402') || uaLower.includes('autonomous')) return 'ai_agent';
  if (uaLower.includes('bot') || uaLower.includes('crawler') || uaLower.includes('spider')) return 'bot';
  if (uaLower.includes('curl') || uaLower.includes('wget') || uaLower.includes('httpie')) return 'cli';
  if (uaLower.includes('postman') || uaLower.includes('insomnia')) return 'api_client';
  if (uaLower.includes('sdk') || uaLower.includes('node') || uaLower.includes('python') || uaLower.includes('axios')) return 'sdk';
  if (uaLower.includes('mozilla') || uaLower.includes('chrome') || uaLower.includes('safari') || uaLower.includes('firefox')) return 'browser';
  
  return 'unknown';
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    return ip.substring(0, 45);
  }
  return (req.ip || req.socket?.remoteAddress || 'unknown').substring(0, 45);
}

function extractRequestContext(req: Request): Partial<TrackingData> {
  const body = req.body || {};
  const params = req.params || {};
  
  return {
    walletAddress: body.customerWallet || body.walletAddress || body.address,
    customerId: body.customerId || (req as any).user?.id,
    intentId: params.id || body.intentId,
    serviceSlug: body.serviceSlug || body.service,
    tokenSymbol: body.tokenSymbol || body.token,
    requestedAmount: body.amount,
  };
}

export async function trackSolanaInteraction(data: TrackingData): Promise<void> {
  try {
    await db.insert(solanaEndpointInteractions).values({
      endpoint: data.endpoint,
      method: data.method,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent?.substring(0, 1000),
      userAgentCategory: data.userAgentCategory,
      walletAddress: data.walletAddress,
      customerId: data.customerId,
      statusCode: data.statusCode,
      responseTimeMs: data.responseTimeMs,
      success: data.success,
      intentId: data.intentId,
      serviceSlug: data.serviceSlug,
      tokenSymbol: data.tokenSymbol,
      requestedAmount: data.requestedAmount,
      isWebhook: data.isWebhook,
      webhookType: data.webhookType,
      txSignature: data.txSignature,
      errorType: data.errorType,
      errorMessage: data.errorMessage?.substring(0, 500),
      metadata: data.metadata,
    });
  } catch (error) {
    console.error('❌ Failed to track Solana interaction:', error);
  }
}

export function solanaTrackingMiddleware(isWebhook: boolean = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const endpoint = req.originalUrl.split('?')[0];
    const method = req.method;
    const userAgent = req.headers['user-agent'];
    const ipAddress = getClientIp(req);
    const requestContext = extractRequestContext(req);
    
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    
    let responseBody: any;
    let tracked = false;
    
    const trackRequest = () => {
      if (tracked) return;
      tracked = true;
      
      const responseTimeMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 400;
      
      let errorType: string | undefined;
      let errorMessage: string | undefined;
      
      if (!success && responseBody) {
        if (statusCode === 429) errorType = 'rate_limit';
        else if (statusCode === 401 || statusCode === 403) errorType = 'auth';
        else if (statusCode === 400) errorType = 'validation';
        else if (statusCode >= 500) errorType = 'server_error';
        
        errorMessage = responseBody?.error || responseBody?.message;
      }
      
      let webhookType: string | undefined;
      let txSignature: string | undefined;
      
      if (isWebhook && req.body) {
        webhookType = req.body[0]?.type || req.body.type || 'unknown';
        txSignature = req.body[0]?.signature || req.body.signature;
      }
      
      trackSolanaInteraction({
        endpoint,
        method,
        ipAddress,
        userAgent,
        userAgentCategory: categorizeUserAgent(userAgent),
        statusCode,
        responseTimeMs,
        success,
        isWebhook,
        webhookType,
        txSignature,
        errorType,
        errorMessage,
        ...requestContext,
        metadata: {
          query: Object.keys(req.query || {}).length > 0 ? req.query : undefined,
        },
      });
    };
    
    res.send = function(body: any) {
      responseBody = body;
      trackRequest();
      return originalSend(body);
    };
    
    res.json = function(body: any) {
      responseBody = body;
      trackRequest();
      return originalJson(body);
    };
    
    res.on('finish', trackRequest);
    
    next();
  };
}

export const trackSolanaEndpoint = solanaTrackingMiddleware(false);
export const trackSolanaWebhook = solanaTrackingMiddleware(true);
