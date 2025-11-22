/**
 * x402-Gated Service Endpoints - Official x402-express Implementation
 * 
 * Uses official paymentMiddleware + facilitator pattern for x402scan/Bazaar compliance
 * Matches the working pattern from x402MicroserviceRoutesV2.ts
 * 
 * Features:
 * ✅ Official x402-express paymentMiddleware with Coinbase facilitator
 * ✅ Payment orchestrator for hybrid payment verification
 * ✅ Compliant with x402scan and Coinbase Bazaar requirements
 * ✅ Production-ready resource URLs
 */

import { Router, Request, Response } from 'express';
import { paymentMiddleware, Network } from 'x402-express';
import { facilitator } from '@coinbase/x402';
import { nanoid } from 'nanoid';
import { createPaymentOrchestrator } from '../middleware/paymentOrchestrator';
import { x402TrackingMiddleware } from '../middleware/x402TrackingMiddleware';
import { usageAnalyticsMiddleware } from '../middleware/usageAnalyticsMiddleware';

const router = Router();

// Apply analytics and interaction tracking to all x402 routes (MUST be first)
router.use(usageAnalyticsMiddleware);
router.use(x402TrackingMiddleware);

// Platform wallet for receiving payments
const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91') as `0x${string}`;

// Network for x402 payments
const NETWORK: Network = 'base';

// Public base URL for production discovery
const PUBLIC_BASE_URL: `${string}://${string}` = (process.env.REPLIT_DEPLOYMENT === '1' 
  ? 'https://coinrailz.com'
  : process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : 'http://localhost:5000') as `${string}://${string}`;

// Helper function to create properly typed resource URLs
function resourceUrl(path: string): `${string}://${string}` {
  return `${PUBLIC_BASE_URL}${path}` as `${string}://${string}`;
}

// Service pricing (in USD for x402-express, converted internally)
const SERVICE_PRICING = {
  'smart-contract-audit': 1000,  // $1000 USD
  'payment-processing': 50,      // $50 USD
  'compliance-consultation': 500, // $500 USD
};

// CRITICAL: Host header override for x402-express resource URL generation
router.use((req: Request, res: Response, next) => {
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    req.headers.host = 'coinrailz.com';
    req.headers['x-forwarded-host'] = 'coinrailz.com';
    req.headers['x-forwarded-proto'] = 'https';
  } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    const workspaceHost = `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    req.headers.host = workspaceHost;
    req.headers['x-forwarded-host'] = workspaceHost;
    req.headers['x-forwarded-proto'] = 'https';
  }
  next();
});

// Define x402 routes configuration (must match x402MicroserviceRoutesV2 structure)
// Paths are relative to /x402/service mount point
const x402Routes = {
  'POST /smart-contract-audit': {
    price: `$${SERVICE_PRICING['smart-contract-audit']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/smart-contract-audit'),
      name: 'Smart Contract Auditor',
      description: 'Comprehensive smart contract security audit with vulnerability detection',
      mimeType: 'application/json',
      maxTimeoutSeconds: 900,
    },
  },
  'POST /payment-processing': {
    price: `$${SERVICE_PRICING['payment-processing']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/payment-processing'),
      name: 'Payment Processor',
      description: 'Multi-chain payment processing service (hourly rate)',
      mimeType: 'application/json',
      maxTimeoutSeconds: 300,
    },
  },
  'POST /compliance-consultation': {
    price: `$${SERVICE_PRICING['compliance-consultation']}`,
    network: NETWORK,
    config: {
      discoverable: true,
      resource: resourceUrl('/x402/service/compliance-consultation'),
      name: 'Compliance Consultant',
      description: 'AML/KYC compliance consultation and risk assessment',
      mimeType: 'application/json',
      maxTimeoutSeconds: 600,
    },
  },
};

// Create x402 middleware with official facilitator
const x402Middleware = paymentMiddleware(
  PLATFORM_WALLET,
  x402Routes,
  facilitator
);

// Service Handlers

const smartContractAuditHandler = async (req: Request, res: Response) => {
  try {
    const { contractCode, contractName } = req.body;

    if (!contractCode) {
      return res.status(400).json({
        success: false,
        error: 'Contract code is required',
      });
    }

    const { SmartContractAuditHandler } = await import('../services/handlers/SmartContractAuditHandler');
    const handler = new SmartContractAuditHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'smart-contract-auditor',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['smart-contract-audit'],
      metadata: { protocol: 'x402', paymentVerified: true },
      contractCode,
      contractName: contractName || 'Contract',
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['smart-contract-audit'],
      currency: 'USDC',
      network: 'base',
    });
  } catch (error: any) {
    console.error('Smart contract audit execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Audit execution failed',
      details: error.message,
    });
  }
};

const paymentProcessingHandler = async (req: Request, res: Response) => {
  try {
    const { amount, currency, network, recipientAddress } = req.body;

    if (!amount || !currency || !network || !recipientAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, currency, network, recipientAddress',
      });
    }

    const { PaymentProcessorHandler } = await import('../services/handlers/PaymentProcessorHandler');
    const handler = new PaymentProcessorHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'payment-processor',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['payment-processing'],
      metadata: { protocol: 'x402', paymentVerified: true },
      paymentDetails: {
        amount,
        currency,
        network,
        recipientAddress,
      },
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['payment-processing'],
      currency: 'USDC',
      network: 'base',
    });
  } catch (error: any) {
    console.error('Payment processing execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment processing failed',
      details: error.message,
    });
  }
};

const complianceConsultationHandler = async (req: Request, res: Response) => {
  try {
    const { businessType, jurisdiction, transactionVolume } = req.body;

    if (!businessType || !jurisdiction) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: businessType, jurisdiction',
      });
    }

    const { ComplianceConsultantHandler } = await import('../services/handlers/ComplianceConsultantHandler');
    const handler = new ComplianceConsultantHandler();
    
    const result = await handler.execute({
      orderId: nanoid(),
      agentId: 'compliance-consultant',
      serviceType: 'x402_gated',
      customerId: req.ip || 'x402-autonomous',
      amount: SERVICE_PRICING['compliance-consultation'],
      metadata: { protocol: 'x402', paymentVerified: true },
      complianceRequirements: {
        businessType,
        jurisdiction,
        transactionVolume: transactionVolume || 0,
      },
    });

    res.json({
      success: true,
      result,
      amountPaid: SERVICE_PRICING['compliance-consultation'],
      currency: 'USDC',
      network: 'base',
    });
  } catch (error: any) {
    console.error('Compliance consultation execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Consultation execution failed',
      details: error.message,
    });
  }
};

// Register routes with payment orchestrator + x402 middleware
// Paths are relative to /x402/service mount point in server/index.ts
router.post('/smart-contract-audit',
  createPaymentOrchestrator('smart-contract-audit', SERVICE_PRICING['smart-contract-audit'], smartContractAuditHandler),
  x402Middleware,
  smartContractAuditHandler
);

router.post('/payment-processing',
  createPaymentOrchestrator('payment-processing', SERVICE_PRICING['payment-processing'], paymentProcessingHandler),
  x402Middleware,
  paymentProcessingHandler
);

router.post('/compliance-consultation',
  createPaymentOrchestrator('compliance-consultation', SERVICE_PRICING['compliance-consultation'], complianceConsultationHandler),
  x402Middleware,
  complianceConsultationHandler
);

export default router;
