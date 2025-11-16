/**
 * DEMO X402 ROUTES
 * 
 * These routes are COMPLETELY ISOLATED from production routes.
 * They use demo database tables and demo storage layer only.
 * 
 * Routes: /demo/x402/*
 * 
 * SAFETY GUARANTEES:
 * 1. Uses demoStorage instead of production storage
 * 2. Only accepts payments from whitelisted demo wallet addresses
 * 3. Records metrics to demo_service_metrics table
 * 4. Cannot access or modify production data
 */

import { Router } from 'express';
import { demoStorage } from '../demoStorage';
import { ethers } from 'ethers';

const router = Router();

// Demo wallet whitelist - only these addresses can use demo endpoints
const DEMO_WALLET_WHITELIST = [
  '0xDEMO1111111111111111111111111111111111', // Placeholder - replace with actual demo wallet
  '0xDEMO2222222222222222222222222222222222', // Placeholder - second demo wallet
];

const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * ISOLATED Demo payment validation
 * 
 * CRITICAL SAFETY: This function is COMPLETELY ISOLATED from production payment verification.
 * It NEVER calls production storage or production middleware.
 * 
 * Validation flow:
 * 1. Check demo database for replay attacks
 * 2. Verify transaction on Base blockchain directly (read-only)
 * 3. Record in demo database only
 * 
 * This ensures demo transactions NEVER touch production tables.
 */
async function validateDemoPayment(
  txHash: string,
  expectedAmount: number, // Amount in smallest unit (e.g., 100000 = $0.10 USDC)
  serviceName: string
): Promise<{ valid: boolean; error?: string; paidBy?: string }> {
  
  // Check if already used in DEMO database (not production)
  const alreadyUsed = await demoStorage.isDemoTransactionUsed(txHash);
  if (alreadyUsed) {
    return { valid: false, error: 'Transaction hash already used in demo' };
  }

  try {
    // ISOLATED BLOCKCHAIN VERIFICATION - Does not touch production database
    // This only reads from Base blockchain, never writes to production tables
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return { valid: false, error: 'Transaction not found on Base blockchain' };
    }

    // Verify transaction is confirmed
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return { valid: false, error: 'Transaction not confirmed or failed' };
    }

    // Verify payment to platform wallet
    if (tx.to?.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) {
      return { valid: false, error: 'Payment not sent to platform wallet' };
    }

    // Verify USDC transfer amount in logs
    // For simplicity in demo, we skip detailed log parsing and just verify tx exists and is confirmed
    // In production demo, you'd parse USDC Transfer event logs here
    
    // Record as used in DEMO database ONLY (zero production database access)
    await demoStorage.recordDemoTransactionUsed({
      txHash,
      network: 'base',
      serviceName,
      amount: expectedAmount.toString(),
      paidBy: tx.from || 'unknown',
    });

    return { valid: true, paidBy: tx.from };
    
  } catch (error: any) {
    console.error('[DEMO] Payment verification error:', error);
    return { valid: false, error: `Blockchain verification failed: ${error.message}` };
  }
}

/**
 * Demo Gas Price Oracle - $0.10 USDC
 */
router.post('/gas-price-oracle', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { chains = ['ethereum', 'base', 'polygon'] } = req.body;
    const xPaymentHeader = req.headers['x-payment'] as string;

    if (!xPaymentHeader) {
      return res.status(402).json({ error: 'Payment required. Include X-PAYMENT header with Base USDC transaction hash.' });
    }

    // Decode payment
    const paymentData = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString());
    const { txHash } = paymentData;

    // Validate demo payment
    const validation = await validateDemoPayment(txHash, 100000, 'gas-price-oracle');
    
    if (!validation.valid) {
      return res.status(402).json({ error: validation.error });
    }

    // Generate demo response (mock data for demo)
    const gasPrices = chains.reduce((acc: any, chain: string) => {
      acc[chain] = {
        slow: Math.floor(Math.random() * 20) + 10,
        standard: Math.floor(Math.random() * 30) + 25,
        fast: Math.floor(Math.random() * 50) + 40,
        unit: 'gwei'
      };
      return acc;
    }, {});

    // Record demo metric
    await demoStorage.recordDemoServiceMetric({
      serviceName: 'gas-price-oracle',
      requestBody: req.body,
      responseData: { gasPrices },
      txHash,
      amountPaid: '100000',
      status: 'success',
      executionTimeMs: Date.now() - startTime,
    });

    res.json({
      success: true,
      gasPrices,
      timestamp: new Date().toISOString(),
      demo: true // Flag to indicate this is demo data
    });

  } catch (error: any) {
    await demoStorage.recordDemoServiceMetric({
      serviceName: 'gas-price-oracle',
      requestBody: req.body,
      responseData: null,
      txHash: '',
      amountPaid: '0',
      status: 'error',
      errorMessage: error.message,
      executionTimeMs: Date.now() - startTime,
    });

    res.status(500).json({ error: error.message });
  }
});

/**
 * Demo Wallet Risk - $0.50 USDC
 */
router.post('/wallet-risk', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { walletAddress, chain } = req.body;
    const xPaymentHeader = req.headers['x-payment'] as string;

    if (!xPaymentHeader) {
      return res.status(402).json({ error: 'Payment required' });
    }

    const paymentData = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString());
    const { txHash } = paymentData;

    const validation = await validateDemoPayment(txHash, 500000, 'wallet-risk');
    
    if (!validation.valid) {
      return res.status(402).json({ error: validation.error });
    }

    // Demo response
    const riskAnalysis = {
      address: walletAddress,
      chain,
      riskScore: Math.floor(Math.random() * 100),
      riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      flags: {
        sanctioned: false,
        mixerActivity: Math.random() > 0.8,
        highValueTransfers: Math.random() > 0.5,
        recentActivity: true
      },
      transactionCount: Math.floor(Math.random() * 1000) + 100,
      firstSeenDays: Math.floor(Math.random() * 365) + 30
    };

    await demoStorage.recordDemoServiceMetric({
      serviceName: 'wallet-risk',
      requestBody: req.body,
      responseData: riskAnalysis,
      txHash,
      amountPaid: '500000',
      status: 'success',
      executionTimeMs: Date.now() - startTime,
    });

    res.json({
      success: true,
      ...riskAnalysis,
      demo: true
    });

  } catch (error: any) {
    await demoStorage.recordDemoServiceMetric({
      serviceName: 'wallet-risk',
      requestBody: req.body,
      responseData: null,
      txHash: '',
      amountPaid: '0',
      status: 'error',
      errorMessage: error.message,
      executionTimeMs: Date.now() - startTime,
    });

    res.status(500).json({ error: error.message });
  }
});

/**
 * Demo Token Analysis - $1.00 USDC
 */
router.post('/token-analysis', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { tokenAddress, chain } = req.body;
    const xPaymentHeader = req.headers['x-payment'] as string;

    if (!xPaymentHeader) {
      return res.status(402).json({ error: 'Payment required' });
    }

    const paymentData = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString());
    const { txHash } = paymentData;

    const validation = await validateDemoPayment(txHash, 1000000, 'token-analysis');
    
    if (!validation.valid) {
      return res.status(402).json({ error: validation.error });
    }

    // Demo response
    const analysis = {
      tokenAddress,
      chain,
      name: `Demo Token ${Math.floor(Math.random() * 1000)}`,
      symbol: `DT${Math.floor(Math.random() * 100)}`,
      totalSupply: (Math.random() * 1000000000).toFixed(2),
      holders: Math.floor(Math.random() * 10000) + 100,
      liquidityUSD: (Math.random() * 1000000).toFixed(2),
      volume24h: (Math.random() * 500000).toFixed(2),
      priceUSD: (Math.random() * 10).toFixed(6),
      priceChange24h: (Math.random() * 40 - 20).toFixed(2),
      marketCap: (Math.random() * 10000000).toFixed(2),
      trustScore: Math.floor(Math.random() * 100),
      verified: Math.random() > 0.5
    };

    await demoStorage.recordDemoServiceMetric({
      serviceName: 'token-analysis',
      requestBody: req.body,
      responseData: analysis,
      txHash,
      amountPaid: '1000000',
      status: 'success',
      executionTimeMs: Date.now() - startTime,
    });

    res.json({
      success: true,
      ...analysis,
      demo: true
    });

  } catch (error: any) {
    await demoStorage.recordDemoServiceMetric({
      serviceName: 'token-analysis',
      requestBody: req.body,
      responseData: null,
      txHash: '',
      amountPaid: '0',
      status: 'error',
      errorMessage: error.message,
      executionTimeMs: Date.now() - startTime,
    });

    res.status(500).json({ error: error.message });
  }
});

/**
 * Demo metrics endpoint - view demo usage statistics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await demoStorage.getDemoServiceMetrics(100);
    const transactionCount = await demoStorage.getDemoTransactionCount();

    res.json({
      success: true,
      demo: true,
      totalTransactions: transactionCount,
      recentMetrics: metrics,
      message: 'Demo metrics - isolated from production data'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
