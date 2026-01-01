/**
 * SDK Solana Payments API Routes
 * Endpoints for @coinrailz/agent-payments-solana (NPM), coinrailz-solana (Python)
 * 
 * PRICING: 1.5% + $0.01 per transaction
 * 
 * This is ADDITIVE - separate from existing EVM SDK routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { creditsService } from '../services/creditsService';
import { SolanaService } from '../services/solanaService';

const router = Router();

const solanaService = SolanaService.getInstance();

const SDK_BASE_FEE_PERCENT = 0.015;
const SDK_FIXED_FEE_CENTS = 1;
const SDK_MINIMUM_AMOUNT_CENTS = 5;
const SDK_VERSION = '1.0.0';

const sdkRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const SDK_RATE_LIMIT_WINDOW_MS = 60000;
const SDK_RATE_LIMIT_MAX = 60;

const authFailureMap = new Map<string, { count: number; resetAt: number; blocked: boolean }>();
const AUTH_FAILURE_WINDOW_MS = 300000;
const AUTH_FAILURE_MAX = 10;
const AUTH_BLOCK_DURATION_MS = 900000;

function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
         req.socket?.remoteAddress || 
         'unknown';
}

function checkAuthRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = authFailureMap.get(ip);
  
  if (!entry) return { allowed: true };
  
  if (entry.blocked && now < entry.resetAt) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  
  if (now > entry.resetAt) {
    authFailureMap.delete(ip);
    return { allowed: true };
  }
  
  return { allowed: true };
}

function recordAuthFailure(ip: string): void {
  const now = Date.now();
  const entry = authFailureMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    authFailureMap.set(ip, { count: 1, resetAt: now + AUTH_FAILURE_WINDOW_MS, blocked: false });
    return;
  }
  
  entry.count++;
  
  if (entry.count >= AUTH_FAILURE_MAX) {
    entry.blocked = true;
    entry.resetAt = now + AUTH_BLOCK_DURATION_MS;
    console.warn(`🚨 Solana SDK Auth: Blocking IP ${ip} for ${AUTH_BLOCK_DURATION_MS/1000}s after ${entry.count} failed attempts`);
  }
}

function checkSdkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const entry = sdkRateLimitMap.get(apiKey);
  
  if (!entry || now > entry.resetAt) {
    sdkRateLimitMap.set(apiKey, { count: 1, resetAt: now + SDK_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= SDK_RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

async function requireSdkApiKey(req: Request, res: Response, next: NextFunction) {
  const clientIP = getClientIP(req);
  
  const authCheck = checkAuthRateLimit(clientIP);
  if (!authCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      message: 'Too many failed authentication attempts. Please try again later.',
      retryAfter: authCheck.retryAfter
    });
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordAuthFailure(clientIP);
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid API key. Use: Authorization: Bearer {apiKey}'
    });
  }
  
  const apiKey = authHeader.slice(7);
  
  try {
    const validation = await creditsService.validateApiKey(apiKey);
    
    if (!validation.valid) {
      recordAuthFailure(clientIP);
      return res.status(401).json({
        success: false,
        error: 'INVALID_API_KEY',
        message: 'API key is invalid or revoked.'
      });
    }
    
    if (!checkSdkRateLimit(apiKey)) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Upgrade your plan for higher limits.'
      });
    }
    
    (req as any).sdkApiKey = apiKey;
    (req as any).sdkUserId = validation.userId;
    (req as any).sdkKeyId = validation.keyId;
    next();
    
  } catch (error: any) {
    console.error('Solana SDK API key validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Authentication service unavailable'
    });
  }
}

const SDK_MINIMUM_AMOUNT = SDK_MINIMUM_AMOUNT_CENTS / 100;

const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const sendSolSchema = z.object({
  to: z.string().regex(solanaAddressRegex, 'Invalid Solana address'),
  amount: z.number()
    .positive('Amount must be positive')
    .min(SDK_MINIMUM_AMOUNT, `Minimum transaction amount is $${SDK_MINIMUM_AMOUNT.toFixed(2)}`),
  currency: z.enum(['SOL', 'USDC']).default('USDC'),
  memo: z.string().max(200).optional(),
  idempotencyKey: z.string().max(64).optional()
});

function calculateSolanaFee(amount: number): { fee: number; netAmount: number } {
  const percentFee = amount * SDK_BASE_FEE_PERCENT;
  const fixedFee = SDK_FIXED_FEE_CENTS / 100;
  const totalFee = percentFee + fixedFee;
  const netAmount = amount - totalFee;
  
  return {
    fee: Math.round(totalFee * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100
  };
}

router.get('/status', async (req: Request, res: Response) => {
  try {
    const serviceStatus = await solanaService.getServiceStatus();
    
    res.json({
      success: true,
      service: 'Coin Railz Solana SDK',
      version: SDK_VERSION,
      status: serviceStatus.rpcConnected ? 'operational' : 'degraded',
      features: {
        payments: true,
        walletCreation: true,
        solTransfers: true,
        usdcTransfers: true
      },
      pricing: {
        processingFee: '1.5% + $0.01'
      },
      network: serviceStatus.network,
      currencies: ['SOL', 'USDC'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'STATUS_ERROR',
      message: 'Failed to get service status'
    });
  }
});

router.post('/wallet', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const wallet = await solanaService.createWallet();
    
    res.json({
      success: true,
      wallet: {
        address: wallet.address,
        publicKey: wallet.publicKey,
        network: wallet.network,
        createdAt: wallet.createdAt
      },
      message: 'Wallet created. Store private key securely - it cannot be recovered.',
      privateKey: wallet.privateKey
    });
  } catch (error: any) {
    console.error('Solana wallet creation error:', error);
    res.status(500).json({
      success: false,
      error: 'WALLET_ERROR',
      message: 'Failed to create wallet'
    });
  }
});

router.get('/balance/:address', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!solanaService.isValidSolanaAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ADDRESS',
        message: 'Invalid Solana address'
      });
    }
    
    const balance = await solanaService.getBalance(address);
    const status = await solanaService.getServiceStatus();
    
    res.json({
      success: true,
      address,
      balance: {
        sol: balance,
        lamports: Math.floor(balance * 1e9)
      },
      network: status.network,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Solana balance error:', error);
    res.status(500).json({
      success: false,
      error: 'BALANCE_ERROR',
      message: 'Failed to get balance'
    });
  }
});

router.post('/payments/send', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const validation = sendSolSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
        details: validation.error.errors
      });
    }
    
    const { to, amount, currency, memo } = validation.data;
    const transactionId = `sol_${nanoid(16)}`;
    
    const { fee, netAmount } = calculateSolanaFee(amount);
    
    console.log(`💳 Solana SDK Payment: ${transactionId} - $${amount} ${currency} to ${to} (fee: $${fee})`);
    
    let txStatus: 'pending' | 'processing' | 'confirmed' | 'failed' = 'pending';
    let signature: string | null = null;
    let executionError: string | null = null;
    
    try {
      const status = await solanaService.getServiceStatus();
      
      if (status.hasPlatformWallet) {
        let result;
        
        if (currency === 'SOL') {
          result = await solanaService.sendSol(to, netAmount, memo || `SDK payment ${transactionId}`);
        } else {
          result = await solanaService.sendUsdc(to, netAmount, memo || `SDK payment ${transactionId}`);
        }
        
        if (result?.signature) {
          txStatus = 'confirmed';
          signature = result.signature;
          console.log(`✅ Solana SDK Payment executed: ${signature}`);
        }
      } else {
        txStatus = 'pending';
        executionError = 'Solana platform wallet not configured';
        console.warn('⚠️ Solana platform wallet not configured - payment queued');
      }
    } catch (execError: any) {
      console.error('Solana payment execution error:', execError);
      executionError = execError.message;
      txStatus = 'pending';
    }
    
    const serviceStatus = await solanaService.getServiceStatus();
    
    res.status(txStatus === 'confirmed' ? 200 : 202).json({
      success: true,
      transactionId,
      status: txStatus,
      signature,
      amount: {
        gross: amount,
        fee,
        net: netAmount
      },
      currency,
      recipient: to,
      network: serviceStatus.network,
      explorerUrl: signature ? `https://solscan.io/tx/${signature}` : null,
      timestamp: new Date().toISOString(),
      ...(executionError && { warning: executionError })
    });
    
  } catch (error: any) {
    console.error('Solana SDK payment error:', error);
    res.status(500).json({
      success: false,
      error: 'PAYMENT_ERROR',
      message: 'Payment processing failed'
    });
  }
});

router.get('/transaction/:signature', requireSdkApiKey, async (req: Request, res: Response) => {
  try {
    const { signature } = req.params;
    const status = await solanaService.getTransactionStatus(signature);
    const serviceStatus = await solanaService.getServiceStatus();
    
    res.json({
      success: true,
      signature,
      status,
      network: serviceStatus.network,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'TRANSACTION_ERROR',
      message: 'Failed to get transaction status'
    });
  }
});

export default router;
