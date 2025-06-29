/**
 * KYC Feature Gating Middleware
 * Implements progressive feature access based on user verification status
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    kycStatus: 'pending' | 'verified' | 'rejected' | 'basic';
    complianceLevel: 'basic' | 'enhanced' | 'institutional';
    riskScore: number;
  };
}

export interface KYCGateConfig {
  requiredStatus: 'pending' | 'verified';
  requiredComplianceLevel?: 'basic' | 'enhanced' | 'institutional';
  feature: string;
  maxAmount?: number;
  allowDemo?: boolean;
}

/**
 * Creates KYC gating middleware for specific features
 */
export function requireKYCStatus(config: KYCGateConfig) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Allow demo mode bypass for testing
      if (config.allowDemo && req.session?.demoUser) {
        return next();
      }

      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          feature: config.feature,
          upgradeRequired: true
        });
      }

      const user = req.user;

      // Check KYC status requirement
      if (config.requiredStatus === 'verified' && user.kycStatus !== 'verified') {
        return res.status(403).json({
          success: false,
          message: `KYC verification required for ${config.feature}`,
          currentStatus: user.kycStatus,
          requiredStatus: config.requiredStatus,
          feature: config.feature,
          upgradeRequired: true,
          upgradeUrl: '/kyc/verify'
        });
      }

      if (config.requiredStatus === 'pending' && !['pending', 'verified'].includes(user.kycStatus)) {
        return res.status(403).json({
          success: false,
          message: `KYC submission required for ${config.feature}`,
          currentStatus: user.kycStatus,
          requiredStatus: config.requiredStatus,
          feature: config.feature,
          upgradeRequired: true,
          upgradeUrl: '/kyc/start'
        });
      }

      // Check compliance level requirement
      if (config.requiredComplianceLevel) {
        const complianceLevels = ['basic', 'enhanced', 'institutional'];
        const currentLevel = complianceLevels.indexOf(user.complianceLevel);
        const requiredLevel = complianceLevels.indexOf(config.requiredComplianceLevel);

        if (currentLevel < requiredLevel) {
          return res.status(403).json({
            success: false,
            message: `${config.requiredComplianceLevel} compliance level required for ${config.feature}`,
            currentLevel: user.complianceLevel,
            requiredLevel: config.requiredComplianceLevel,
            feature: config.feature,
            upgradeRequired: true,
            upgradeUrl: '/kyc/upgrade'
          });
        }
      }

      // Check transaction amount limits
      if (config.maxAmount && req.body?.amount) {
        const amount = parseFloat(req.body.amount);
        
        if (amount > config.maxAmount) {
          const requiredLevel = amount > 10000 ? 'institutional' : 'enhanced';
          return res.status(403).json({
            success: false,
            message: `Transaction amount $${amount.toLocaleString()} requires ${requiredLevel} verification`,
            currentLevel: user.complianceLevel,
            requiredLevel,
            maxAllowedAmount: config.maxAmount,
            feature: config.feature,
            upgradeRequired: true
          });
        }
      }

      // All checks passed
      next();
    } catch (error) {
      console.error('KYC gating error:', error);
      res.status(500).json({
        success: false,
        message: 'Verification check failed',
        feature: config.feature
      });
    }
  };
}

/**
 * Predefined KYC gates for common features
 */
export const KYCGates = {
  // Basic features (no KYC required)
  referralAccess: requireKYCStatus({
    requiredStatus: 'pending',
    feature: 'Referral System',
    allowDemo: true
  }),

  // Fiat financial features (verification required)
  fiatSendMoney: requireKYCStatus({
    requiredStatus: 'verified',
    feature: 'Fiat P2P Transfers',
    maxAmount: 10000,
    allowDemo: true
  }),

  fiatReceiveMoney: requireKYCStatus({
    requiredStatus: 'verified',
    feature: 'Fiat P2P Receive',
    allowDemo: true
  }),

  bankTransactions: requireKYCStatus({
    requiredStatus: 'verified',
    feature: 'Bank Account Transactions',
    allowDemo: true
  }),

  // Crypto features (NO KYC required - basic account access)
  cryptoTrading: requireKYCStatus({
    requiredStatus: 'pending',
    feature: 'Cryptocurrency Trading',
    allowDemo: true
  }),

  cryptoTransfers: requireKYCStatus({
    requiredStatus: 'pending',
    feature: 'Crypto Transfers',
    allowDemo: true
  }),

  agentMarketplace: requireKYCStatus({
    requiredStatus: 'verified',
    feature: 'AI Agent Marketplace',
    allowDemo: true
  }),

  commissionWithdrawal: requireKYCStatus({
    requiredStatus: 'verified',
    feature: 'Commission Withdrawal',
    allowDemo: true
  }),

  // Enhanced features (enhanced KYC required)
  largeTransactions: requireKYCStatus({
    requiredStatus: 'verified',
    requiredComplianceLevel: 'enhanced',
    feature: 'Large Transactions',
    maxAmount: 50000
  }),

  // Institutional features
  institutionalTrading: requireKYCStatus({
    requiredStatus: 'verified',
    requiredComplianceLevel: 'institutional',
    feature: 'Institutional Trading'
  }),

  apiAccess: requireKYCStatus({
    requiredStatus: 'verified',
    requiredComplianceLevel: 'institutional',
    feature: 'API Access'
  })
};

/**
 * Middleware to add KYC status to response headers for frontend
 */
export function addKYCHeaders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user) {
    res.setHeader('X-KYC-Status', req.user.kycStatus);
    res.setHeader('X-Compliance-Level', req.user.complianceLevel);
    res.setHeader('X-Risk-Score', req.user.riskScore.toString());
  }
  next();
}

/**
 * Helper function to get user's maximum allowed transaction amount
 */
export function getMaxTransactionAmount(user: AuthenticatedRequest['user']): number {
  if (!user || user.kycStatus !== 'verified') return 0;
  
  switch (user.complianceLevel) {
    case 'institutional':
      return 1000000; // $1M
    case 'enhanced':
      return 50000; // $50K
    case 'basic':
      return 10000; // $10K
    default:
      return 0;
  }
}

/**
 * Helper function to check if feature is available to user
 */
export function isFeatureAvailable(
  user: AuthenticatedRequest['user'], 
  feature: keyof typeof KYCGates
): boolean {
  if (!user) return false;
  
  // Define feature requirements
  const requirements: Record<string, { status: string; level?: string }> = {
    referralAccess: { status: 'pending' },
    // Fiat transactions require KYC
    fiatSendMoney: { status: 'verified' },
    fiatReceiveMoney: { status: 'verified' },
    bankTransactions: { status: 'verified' },
    // Crypto transactions only need basic account
    cryptoTrading: { status: 'pending' },
    cryptoTransfers: { status: 'pending' },
    agentMarketplace: { status: 'verified' },
    commissionWithdrawal: { status: 'verified' },
    largeTransactions: { status: 'verified', level: 'enhanced' },
    institutionalTrading: { status: 'verified', level: 'institutional' },
    apiAccess: { status: 'verified', level: 'institutional' }
  };

  const req = requirements[feature];
  if (!req) return false;

  // Check status requirement
  if (req.status === 'verified' && user.kycStatus !== 'verified') return false;
  if (req.status === 'pending' && !['pending', 'verified'].includes(user.kycStatus)) return false;

  // Check compliance level if required
  if (req.level) {
    const levels = ['basic', 'enhanced', 'institutional'];
    const userLevel = levels.indexOf(user.complianceLevel);
    const requiredLevel = levels.indexOf(req.level);
    if (userLevel < requiredLevel) return false;
  }

  return true;
}