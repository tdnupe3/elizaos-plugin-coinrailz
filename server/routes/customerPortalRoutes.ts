/**
 * CUSTOMER PORTAL API ROUTES
 * Backend endpoints for $2K-$200K enterprise customer dashboard
 */

import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { sdkLicenseSubscriptions, sdkLicenseTiers, users } from '../../shared/schema';
import authenticateUser from '../middleware/authMiddleware';

const router = Router();

/**
 * GET /api/sdk/customer/license
 * Get customer's license information
 */
router.get('/license', authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log(`🔍 Fetching license info for user: ${req.user.email}`);

    // Get customer's license
    const licenses = await db
      .select({
        id: sdkLicenseSubscriptions.id,
        licenseKey: sdkLicenseSubscriptions.licenseKey,
        companyName: sdkLicenseSubscriptions.companyName,
        contactEmail: sdkLicenseSubscriptions.contactEmail,
        tier: sdkLicenseTiers.name,
        status: sdkLicenseSubscriptions.status,
        billingCycle: sdkLicenseSubscriptions.billingCycle,
        expiresAt: sdkLicenseSubscriptions.endDate,
        price: sdkLicenseTiers.yearlyPrice,
        setupFee: sdkLicenseTiers.setupFee,
        monthlyVolumeLimit: sdkLicenseTiers.monthlyVolumeLimit,
        featuresEnabled: sdkLicenseTiers.features
      })
      .from(sdkLicenseSubscriptions)
      .innerJoin(sdkLicenseTiers, eq(sdkLicenseSubscriptions.tierId, sdkLicenseTiers.id))
      .where(
        and(
          eq(sdkLicenseSubscriptions.contactEmail, req.user.email ?? ''),
          eq(sdkLicenseSubscriptions.status, 'active')
        )
      )
      .orderBy(desc(sdkLicenseSubscriptions.createdAt))
      .limit(1);

    if (licenses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active license found for this account'
      });
    }

    const license = licenses[0];

    // Calculate usage metrics (simulated for now)
    const monthlyVolumeUsed = Math.floor(Math.random() * Number(license.monthlyVolumeLimit) * 0.7); // 0-70% usage

    const licenseInfo = {
      id: license.id,
      licenseKey: license.licenseKey,
      companyName: license.companyName,
      tier: license.tier,
      status: license.status,
      billingCycle: license.billingCycle,
      expiresAt: license.expiresAt,
      monthlyVolumeLimit: Number(license.monthlyVolumeLimit),
      monthlyVolumeUsed: monthlyVolumeUsed,
      featuresEnabled: license.featuresEnabled || [],
      price: license.price
    };

    console.log(`✅ License found: ${license.companyName} (${license.tier})`);

    res.json({
      success: true,
      license: licenseInfo
    });

  } catch (error) {
    console.error('❌ Failed to fetch license info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch license information'
    });
  }
});

/**
 * GET /api/sdk/customer/metrics
 * Get customer's usage metrics
 */
router.get('/metrics', authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log(`📊 Fetching metrics for user: ${req.user.email}`);

    // Get customer's license first
    const licenses = await db
      .select({ id: sdkLicenseSubscriptions.id, companyName: sdkLicenseSubscriptions.companyName })
      .from(sdkLicenseSubscriptions)
      .where(
        and(
          eq(sdkLicenseSubscriptions.contactEmail, req.user.email ?? ''),
          eq(sdkLicenseSubscriptions.status, 'active')
        )
      )
      .limit(1);

    if (licenses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active license found'
      });
    }

    // Simulate realistic enterprise metrics
    const metrics = {
      payments: {
        totalVolume: Math.floor(Math.random() * 500000) + 50000, // $50K-$550K
        monthlyVolume: Math.floor(Math.random() * 100000) + 20000, // $20K-$120K
        transactionCount: Math.floor(Math.random() * 1000) + 100, // 100-1100 transactions
        successRate: 98.5 + Math.random() * 1.5, // 98.5-100%
        averageAmount: 150 + Math.random() * 300 // $150-$450 average
      },
      agents: {
        totalAgents: Math.floor(Math.random() * 25) + 5, // 5-30 agents
        activeAgents: Math.floor(Math.random() * 15) + 3, // 3-18 active
        totalCalls: Math.floor(Math.random() * 10000) + 1000 // 1K-11K calls
      },
      compliance: {
        totalChecks: Math.floor(Math.random() * 2000) + 500, // 500-2500 checks
        flaggedTransactions: Math.floor(Math.random() * 20) + 2, // 2-22 flagged
        complianceScore: 92 + Math.random() * 8 // 92-100 score
      }
    };

    console.log(`✅ Metrics generated for ${licenses[0].companyName}`);

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    console.error('❌ Failed to fetch metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage metrics'
    });
  }
});

/**
 * GET /api/sdk/customer/billing
 * Get customer's billing history and payment methods
 */
router.get('/billing', authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log(`💳 Fetching billing info for user: ${req.user.email}`);

    // Get customer's license
    const licenses = await db
      .select({
        id: sdkLicenseSubscriptions.id,
        companyName: sdkLicenseSubscriptions.companyName,
        stripeCustomerId: sdkLicenseSubscriptions.stripeCustomerId,
        totalLifetimeRevenue: sdkLicenseSubscriptions.totalLifetimeRevenue
      })
      .from(sdkLicenseSubscriptions)
      .where(
        and(
          eq(sdkLicenseSubscriptions.contactEmail, req.user.email ?? ''),
          eq(sdkLicenseSubscriptions.status, 'active')
        )
      )
      .limit(1);

    if (licenses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active license found'
      });
    }

    const license = licenses[0];

    // Simulate billing history
    const billingHistory = [
      {
        id: 'inv_001',
        date: new Date().toISOString(),
        amount: 8000,
        status: 'paid',
        description: 'Growth Tier Annual License'
      },
      {
        id: 'inv_002', 
        date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 2000,
        status: 'paid',
        description: 'Startup Tier Annual License'
      }
    ];

    const paymentMethods = [
      {
        id: 'pm_001',
        type: 'card',
        last4: '4242',
        brand: 'visa',
        isDefault: true
      }
    ];

    console.log(`✅ Billing info retrieved for ${license.companyName}`);

    res.json({
      success: true,
      billing: {
        history: billingHistory,
        paymentMethods,
        totalLifetimeValue: Number(license.totalLifetimeRevenue || 0),
        stripeCustomerId: license.stripeCustomerId
      }
    });

  } catch (error) {
    console.error('❌ Failed to fetch billing info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing information'
    });
  }
});

/**
 * POST /api/sdk/customer/upgrade
 * Upgrade customer's license tier
 */
router.post('/upgrade', authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { targetTierId } = req.body;

    if (!targetTierId) {
      return res.status(400).json({
        success: false,
        error: 'Target tier ID is required'
      });
    }

    console.log(`⬆️ Processing upgrade request for user: ${req.user.email} to tier ${targetTierId}`);

    // Get target tier information
    const targetTier = await db
      .select()
      .from(sdkLicenseTiers)
      .where(eq(sdkLicenseTiers.id, targetTierId))
      .limit(1);

    if (targetTier.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Target tier not found'
      });
    }

    // For now, just return upgrade information
    // In a real implementation, this would create Stripe subscription changes
    
    const upgradeInfo = {
      targetTier: targetTier[0].name,
      newPrice: targetTier[0].yearlyPrice,
      effectiveDate: new Date().toISOString(),
      prorationAmount: 0 // Calculate based on current billing cycle
    };

    console.log(`✅ Upgrade prepared: ${upgradeInfo.targetTier} - $${upgradeInfo.newPrice}`);

    res.json({
      success: true,
      message: 'Upgrade request processed',
      upgrade: upgradeInfo
    });

  } catch (error) {
    console.error('❌ Failed to process upgrade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process upgrade request'
    });
  }
});

/**
 * POST /api/sdk/customer/regenerate-key
 * Regenerate customer's license key
 */
router.post('/regenerate-key', authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log(`🔑 Regenerating license key for user: ${req.user.email}`);

    // Generate new license key
    const newLicenseKey = `cr_${Math.random().toString(36).substring(2, 10)}_${Math.random().toString(36).substring(2, 10)}`;

    // Update the license key in database
    const updated = await db
      .update(sdkLicenseSubscriptions)
      .set({ 
        licenseKey: newLicenseKey,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(sdkLicenseSubscriptions.contactEmail, req.user.email ?? ''),
          eq(sdkLicenseSubscriptions.status, 'active')
        )
      )
      .returning({ 
        id: sdkLicenseSubscriptions.id,
        companyName: sdkLicenseSubscriptions.companyName 
      });

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active license found'
      });
    }

    console.log(`✅ License key regenerated for ${updated[0].companyName}`);

    res.json({
      success: true,
      message: 'License key regenerated successfully',
      newLicenseKey
    });

  } catch (error) {
    console.error('❌ Failed to regenerate license key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate license key'
    });
  }
});

/**
 * GET /api/sdk/customer/downloads
 * Get available SDK downloads for customer
 */
router.get('/downloads', authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log(`📦 Fetching downloads for user: ${req.user.email}`);

    // Get customer's license tier to determine available downloads
    const licenses = await db
      .select({
        tier: sdkLicenseTiers.name,
        features: sdkLicenseTiers.features
      })
      .from(sdkLicenseSubscriptions)
      .innerJoin(sdkLicenseTiers, eq(sdkLicenseSubscriptions.tierId, sdkLicenseTiers.id))
      .where(
        and(
          eq(sdkLicenseSubscriptions.contactEmail, req.user.email ?? ''),
          eq(sdkLicenseSubscriptions.status, 'active')
        )
      )
      .limit(1);

    if (licenses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active license found'
      });
    }

    const license = licenses[0];

    // Define available downloads based on tier
    const baseDownloads = [
      {
        id: 'typescript-sdk',
        name: 'TypeScript SDK',
        description: 'Full-featured TypeScript SDK with type definitions',
        version: '1.0.0',
        downloadUrl: '/api/sdk/download/typescript',
        size: '2.4 MB'
      },
      {
        id: 'documentation',
        name: 'API Documentation',
        description: 'Complete API reference and integration guide',
        version: '1.0.0',
        downloadUrl: '/api/sdk/download/docs',
        size: '8.1 MB'
      }
    ];

    const advancedDownloads = [
      {
        id: 'python-sdk',
        name: 'Python SDK',
        description: 'Python package for backend integration',
        version: '1.0.0',
        downloadUrl: '/api/sdk/download/python',
        size: '1.8 MB'
      },
      {
        id: 'examples',
        name: 'Code Examples',
        description: 'Integration examples and starter templates',
        version: '1.0.0',
        downloadUrl: '/api/sdk/download/examples',
        size: '12.3 MB'
      }
    ];

    const enterpriseDownloads = [
      {
        id: 'white-label',
        name: 'White Label Package',
        description: 'Customizable SDK for your brand',
        version: '1.0.0',
        downloadUrl: '/api/sdk/download/white-label',
        size: '15.2 MB'
      }
    ];

    let availableDownloads = [...baseDownloads];
    
    if (['Growth', 'Enterprise', 'Custom'].includes(license.tier)) {
      availableDownloads.push(...advancedDownloads);
    }
    
    if (['Enterprise', 'Custom'].includes(license.tier)) {
      availableDownloads.push(...enterpriseDownloads);
    }

    console.log(`✅ ${availableDownloads.length} downloads available for ${license.tier} tier`);

    res.json({
      success: true,
      downloads: availableDownloads,
      tier: license.tier
    });

  } catch (error) {
    console.error('❌ Failed to fetch downloads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available downloads'
    });
  }
});

export default router;