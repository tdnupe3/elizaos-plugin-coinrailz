import { RequestHandler } from 'express';
import { storage } from '../storage';

// Extend Express session to include KYC info
declare module 'express-session' {
  interface SessionData {
    kycStatus?: {
      isVerified: boolean;
      level: string;
      provider: string;
      verifiedAt?: string;
    };
  }
}

// Check if user has valid KYC verification
export const requireKYC: RequestHandler = async (req, res, next) => {
  try {
    const sessionUser = req.session?.user;
    const replitUser = req.user as any;

    // Check for Coinbase OAuth user (automatically KYC verified)
    if (sessionUser?.coinbase?.isVerified) {
      req.session.kycStatus = {
        isVerified: true,
        level: 'complete',
        provider: 'coinbase',
        verifiedAt: new Date().toISOString()
      };
      return next();
    }

    // Check for existing user in database
    let userId = null;
    if (sessionUser?.claims?.sub) {
      userId = sessionUser.claims.sub;
    } else if (replitUser?.claims?.sub) {
      userId = replitUser.claims.sub;
    }

    if (userId) {
      const user = await storage.getUser(userId);
      if (user?.isKycVerified && user.kycLevel === 'complete') {
        req.session.kycStatus = {
          isVerified: true,
          level: user.kycLevel,
          provider: user.kycProvider || 'internal',
          verifiedAt: user.kycApprovedAt?.toISOString()
        };
        return next();
      }
    }

    // User not KYC verified
    return res.status(403).json({
      error: 'KYC_REQUIRED',
      message: 'This feature requires identity verification',
      details: {
        required: true,
        currentStatus: 'unverified',
        availableOptions: [
          'coinbase_oauth',
          'circle_kyc',
          'manual_kyc'
        ]
      }
    });

  } catch (error) {
    console.error('KYC verification error:', error);
    return res.status(500).json({
      error: 'VERIFICATION_ERROR',
      message: 'Unable to verify KYC status'
    });
  }
};

// Check KYC level for specific features
export const requireKYCLevel = (requiredLevel: 'basic' | 'complete' | 'enhanced'): RequestHandler => {
  return async (req, res, next) => {
    try {
      const kycStatus = req.session?.kycStatus;
      const sessionUser = req.session?.user;

      // Coinbase OAuth users have complete KYC
      if (sessionUser?.coinbase?.isVerified) {
        return next();
      }

      if (!kycStatus?.isVerified) {
        return res.status(403).json({
          error: 'KYC_REQUIRED',
          message: `This feature requires ${requiredLevel} KYC verification`,
          required_level: requiredLevel,
          current_level: 'none'
        });
      }

      const levels = ['basic', 'complete', 'enhanced'];
      const currentLevelIndex = levels.indexOf(kycStatus.level);
      const requiredLevelIndex = levels.indexOf(requiredLevel);

      if (currentLevelIndex < requiredLevelIndex) {
        return res.status(403).json({
          error: 'INSUFFICIENT_KYC_LEVEL',
          message: `This feature requires ${requiredLevel} KYC, you have ${kycStatus.level}`,
          required_level: requiredLevel,
          current_level: kycStatus.level,
          upgrade_options: ['coinbase_oauth', 'enhanced_kyc']
        });
      }

      next();
    } catch (error) {
      console.error('KYC level verification error:', error);
      return res.status(500).json({
        error: 'VERIFICATION_ERROR',
        message: 'Unable to verify KYC level'
      });
    }
  };
};

// Get current user's KYC status
export const getKYCStatus: RequestHandler = async (req, res) => {
  try {
    const sessionUser = req.session?.user;
    const replitUser = req.user as any;

    // Check for Coinbase OAuth user
    if (sessionUser?.coinbase?.isVerified) {
      return res.json({
        isVerified: true,
        level: 'complete',
        provider: 'coinbase',
        verifiedAt: new Date().toISOString(),
        features: {
          highLimitTransactions: true,
          internationalTransfers: true,
          advancedTrading: true,
          institutionalFeatures: true
        }
      });
    }

    // Check database user
    let userId = null;
    if (sessionUser?.claims?.sub) {
      userId = sessionUser.claims.sub;
    } else if (replitUser?.claims?.sub) {
      userId = replitUser.claims.sub;
    }

    if (userId) {
      const user = await storage.getUser(userId);
      if (user) {
        return res.json({
          isVerified: user.isKycVerified || false,
          level: user.kycLevel || 'none',
          provider: user.kycProvider || 'none',
          verifiedAt: user.kycApprovedAt?.toISOString() || null,
          features: {
            highLimitTransactions: user.kycLevel === 'complete',
            internationalTransfers: user.kycLevel === 'complete',
            advancedTrading: user.kycLevel === 'complete',
            institutionalFeatures: user.kycLevel === 'enhanced'
          }
        });
      }
    }

    // No verification found
    return res.json({
      isVerified: false,
      level: 'none',
      provider: 'none',
      verifiedAt: null,
      features: {
        highLimitTransactions: false,
        internationalTransfers: false,
        advancedTrading: false,
        institutionalFeatures: false
      },
      nextSteps: [
        {
          method: 'coinbase_oauth',
          title: 'Sign in with Coinbase',
          description: 'Instant verification using your existing Coinbase account',
          recommended: true
        },
        {
          method: 'circle_kyc',
          title: 'Complete KYC Verification',
          description: 'Upload identity documents for manual verification',
          timeframe: '1-3 business days'
        }
      ]
    });

  } catch (error) {
    console.error('Get KYC status error:', error);
    return res.status(500).json({
      error: 'STATUS_CHECK_ERROR',
      message: 'Unable to retrieve KYC status'
    });
  }
};