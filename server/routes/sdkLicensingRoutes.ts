import express from 'express';
import { sdkLicensingService } from '../services/sdkLicensingService';
import { z } from 'zod';
import { stripe } from '../services/stripeClient';

const router = express.Router();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}


// Validation schemas
const createSubscriptionSchema = z.object({
  tierId: z.number(),
  companyName: z.string().min(1),
  contactEmail: z.string().email(),
  contactName: z.string().min(1),
  phoneNumber: z.string().optional(),
  companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  useCase: z.string().optional(),
  billingCycle: z.enum(['monthly', 'yearly']),
  paymentMethod: z.enum(['stripe', 'crypto', 'wire_transfer', 'check']),
  allowedDomains: z.array(z.string()).optional(),
  webhookUrls: z.array(z.string().url()).optional(),
  signupSource: z.string().optional(),
});

// GET /api/sdk-licensing/tiers - Get all available license tiers
router.get('/tiers', async (req, res) => {
  try {
    const tiers = await sdkLicensingService.getSDKLicenseTiers();
    
    // Format response for public consumption
    const publicTiers = tiers.map(tier => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      yearlyPrice: parseFloat(tier.yearlyPrice),
      monthlyPrice: parseFloat(tier.monthlyPrice),
      setupFee: parseFloat(tier.setupFee || '0'),
      transactionFeeRate: `${(parseFloat(tier.transactionFeeRate) * 100).toFixed(2)}%`,
      fixedFeePerTransaction: parseFloat(tier.fixedFeePerTransaction),
      monthlyTransactionLimit: tier.monthlyTransactionLimit,
      monthlyVolumeLimit: tier.monthlyVolumeLimit ? parseFloat(tier.monthlyVolumeLimit) : null,
      supportLevel: tier.supportLevel,
      slaGuarantee: tier.slaGuarantee,
      customIntegrations: tier.customIntegrations,
      whiteLabeling: tier.whiteLabeling,
      dedicatedInfrastructure: tier.dedicatedInfrastructure,
      apiRequestsPerSecond: tier.apiRequestsPerSecond,
      webhookEndpoints: tier.webhookEndpoints,
      teamMembers: tier.teamMembers,
      features: tier.features,
      targetMarket: tier.targetMarket,
      // Calculate yearly savings
      yearlySavings: (parseFloat(tier.monthlyPrice) * 12) - parseFloat(tier.yearlyPrice),
      savingsPercentage: Math.round(((parseFloat(tier.monthlyPrice) * 12) - parseFloat(tier.yearlyPrice)) / (parseFloat(tier.monthlyPrice) * 12) * 100)
    }));

    res.json({
      success: true,
      tiers: publicTiers
    });
  } catch (error) {
    console.error('Error fetching SDK license tiers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch license tiers'
    });
  }
});

// GET /api/sdk-licensing/tiers/:id - Get specific license tier
router.get('/tiers/:id', async (req, res) => {
  try {
    const tierId = parseInt(req.params.id);
    const tier = await sdkLicensingService.getSDKLicenseTier(tierId);
    
    if (!tier) {
      return res.status(404).json({
        success: false,
        error: 'License tier not found'
      });
    }

    res.json({
      success: true,
      tier: {
        id: tier.id,
        name: tier.name,
        description: tier.description,
        yearlyPrice: parseFloat(tier.yearlyPrice),
        monthlyPrice: parseFloat(tier.monthlyPrice),
        setupFee: parseFloat(tier.setupFee || '0'),
        transactionFeeRate: `${(parseFloat(tier.transactionFeeRate) * 100).toFixed(2)}%`,
        fixedFeePerTransaction: parseFloat(tier.fixedFeePerTransaction),
        monthlyTransactionLimit: tier.monthlyTransactionLimit,
        monthlyVolumeLimit: tier.monthlyVolumeLimit ? parseFloat(tier.monthlyVolumeLimit) : null,
        supportLevel: tier.supportLevel,
        slaGuarantee: tier.slaGuarantee,
        features: tier.features,
        targetMarket: tier.targetMarket
      }
    });
  } catch (error) {
    console.error('Error fetching SDK license tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch license tier'
    });
  }
});

// POST /api/sdk-licensing/subscriptions - Create new SDK license subscription
router.post('/subscriptions', async (req, res) => {
  try {
    const validatedData = createSubscriptionSchema.parse(req.body);
    
    // Validate tier exists
    const tier = await sdkLicensingService.getSDKLicenseTier(validatedData.tierId);
    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier ID'
      });
    }

    // Create subscription
    const { subscription, licenseKey } = await sdkLicensingService.createSDKLicenseSubscription(validatedData);

    // If payment method is Stripe, create Stripe customer and subscription
    let stripeSubscription = null;
    if (validatedData.paymentMethod === 'stripe') {
      try {
        // Create Stripe customer
        const stripeCustomer = await stripe.customers.create({
          email: validatedData.contactEmail,
          name: validatedData.contactName,
          metadata: {
            companyName: validatedData.companyName,
            licenseId: subscription.id.toString(),
            tier: tier.name
          }
        });

        // Create Stripe subscription
        stripeSubscription = await sdkLicensingService.createStripeSubscription(
          subscription.id,
          stripeCustomer.id
        );
      } catch (stripeError) {
        console.error('Stripe subscription creation failed:', stripeError);
        // Continue without Stripe - they can set up payment later
      }
    }

    const amount = validatedData.billingCycle === 'yearly' 
      ? parseFloat(tier.yearlyPrice) 
      : parseFloat(tier.monthlyPrice);

    res.status(201).json({
      success: true,
      subscription: {
        id: subscription.id,
        licenseKey, // Only returned once during creation
        companyName: subscription.companyName,
        contactEmail: subscription.contactEmail,
        tier: {
          name: tier.name,
          transactionFeeRate: `${(parseFloat(tier.transactionFeeRate) * 100).toFixed(2)}%`,
          fixedFeePerTransaction: parseFloat(tier.fixedFeePerTransaction)
        },
        billingCycle: subscription.billingCycle,
        status: subscription.status,
        amount,
        setupFee: parseFloat(tier.setupFee || '0'),
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextBillingDate: subscription.nextBillingDate
      },
      stripeSubscription: stripeSubscription ? {
        id: stripeSubscription.id,
        clientSecret: typeof stripeSubscription.latest_invoice === 'object'
          ? ((stripeSubscription.latest_invoice as any).payment_intent as { client_secret?: string } | null)?.client_secret ?? null
          : null
      } : null,
      nextSteps: validatedData.paymentMethod === 'stripe' ? [
        'Complete payment setup using the Stripe client secret',
        'Save your license key securely - it will not be shown again',
        'Integrate the SDK using your license key',
        'Contact support for onboarding assistance'
      ] : [
        'Complete payment using your chosen method',
        'Save your license key securely - it will not be shown again',
        'Contact billing@coinrailz.com to activate your license',
        'Begin integration once payment is confirmed'
      ]
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Error creating SDK license subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription'
    });
  }
});

// POST /api/sdk-licensing/validate - Validate license key
router.post('/validate', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        error: 'License key is required'
      });
    }

    const validation = await sdkLicensingService.validateLicenseKey(licenseKey);
    
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: validation.reason
      });
    }

    const { subscription, tier } = validation;
    
    res.json({
      success: true,
      valid: true,
      subscription: {
        id: subscription!.id,
        companyName: subscription!.companyName,
        status: subscription!.status,
        endDate: subscription!.endDate,
        currentMonthTransactions: subscription!.currentMonthTransactions || 0,
        currentMonthVolume: parseFloat(subscription!.currentMonthVolume || '0'),
        totalLifetimeTransactions: subscription!.totalLifetimeTransactions,
        totalLifetimeVolume: parseFloat(subscription!.totalLifetimeVolume || '0')
      },
      tier: {
        name: tier!.name,
        transactionFeeRate: parseFloat(tier!.transactionFeeRate),
        fixedFeePerTransaction: parseFloat(tier!.fixedFeePerTransaction),
        monthlyTransactionLimit: tier!.monthlyTransactionLimit,
        monthlyVolumeLimit: tier!.monthlyVolumeLimit ? parseFloat(tier!.monthlyVolumeLimit) : null,
        supportLevel: tier!.supportLevel
      },
      limits: {
        transactionsRemaining: tier!.monthlyTransactionLimit ? 
          Math.max(0, tier!.monthlyTransactionLimit - (subscription!.currentMonthTransactions ?? 0)) : null,
        volumeRemaining: tier!.monthlyVolumeLimit ? 
          Math.max(0, parseFloat(tier!.monthlyVolumeLimit) - parseFloat(subscription!.currentMonthVolume || '0')) : null
      }
    });
  } catch (error) {
    console.error('Error validating license key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate license key'
    });
  }
});

// POST /api/sdk-licensing/calculate-fees - Calculate fees for a transaction
router.post('/calculate-fees', async (req, res) => {
  try {
    const { licenseKey, amount } = req.body;
    
    if (!licenseKey || !amount) {
      return res.status(400).json({
        success: false,
        error: 'License key and amount are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    const fees = await sdkLicensingService.calculateFees(licenseKey, amount);
    
    res.json({
      success: true,
      amount,
      fees: {
        transactionFee: fees.transactionFee,
        fixedFee: fees.fixedFee,
        totalFee: fees.totalFee,
        netAmount: fees.netAmount,
        feeRate: fees.feeRate
      }
    });
  } catch (error) {
    console.error('Error calculating fees:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate fees'
    });
  }
});

// GET /api/sdk-licensing/subscriptions/:id/analytics - Get subscription analytics
router.get('/subscriptions/:id/analytics', async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.id);
    
    if (isNaN(subscriptionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID'
      });
    }

    const analytics = await sdkLicensingService.getSubscriptionAnalytics(subscriptionId);
    
    res.json({
      success: true,
      analytics: {
        totalTransactions: analytics.totalTransactions,
        totalVolume: analytics.totalVolume,
        totalRevenue: analytics.totalRevenue,
        currentMonthTransactions: analytics.currentMonthTransactions,
        currentMonthVolume: analytics.currentMonthVolume,
        averageTransactionSize: Math.round(analytics.averageTransactionSize * 100) / 100,
        monthlyGrowthRate: Math.round(analytics.monthlyGrowthRate * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error fetching subscription analytics:', error);
    
    if (error instanceof Error && error.message === 'Subscription not found') {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

// POST /api/sdk-licensing/increment-usage - Internal endpoint for tracking usage
router.post('/increment-usage', async (req, res) => {
  try {
    const { licenseKey, amount } = req.body;
    
    if (!licenseKey || !amount) {
      return res.status(400).json({
        success: false,
        error: 'License key and amount are required'
      });
    }

    const validation = await sdkLicensingService.validateLicenseKey(licenseKey);
    
    if (!validation.valid || !validation.subscription) {
      return res.status(401).json({
        success: false,
        error: validation.reason
      });
    }

    await sdkLicensingService.incrementUsage(validation.subscription.id, amount);
    
    res.json({
      success: true,
      message: 'Usage incremented successfully'
    });
  } catch (error) {
    console.error('Error incrementing usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment usage'
    });
  }
});

// GET /api/sdk-licensing/pricing-calculator - Public pricing calculator
router.get('/pricing-calculator', async (req, res) => {
  try {
    const { 
      transactions = 1000, 
      averageAmount = 25,
      tier = 'startup'
    } = req.query;

    const monthlyTransactions = parseInt(transactions as string);
    const avgAmount = parseFloat(averageAmount as string);
    const monthlyVolume = monthlyTransactions * avgAmount;

    // Get all tiers for comparison
    const tiers = await sdkLicensingService.getSDKLicenseTiers();
    
    const calculations = tiers.map(tier => {
      const feeRate = parseFloat(tier.transactionFeeRate);
      const fixedFee = parseFloat(tier.fixedFeePerTransaction);
      
      const transactionFees = monthlyVolume * feeRate;
      const fixedFees = monthlyTransactions * fixedFee;
      const totalMonthlyFees = transactionFees + fixedFees;
      const netRevenue = monthlyVolume - totalMonthlyFees;
      
      // Check if within limits
      const withinLimits = (!tier.monthlyTransactionLimit || monthlyTransactions <= tier.monthlyTransactionLimit) &&
                          (!tier.monthlyVolumeLimit || monthlyVolume <= parseFloat(tier.monthlyVolumeLimit));

      return {
        tier: {
          id: tier.id,
          name: tier.name,
          yearlyPrice: parseFloat(tier.yearlyPrice),
          monthlyPrice: parseFloat(tier.monthlyPrice),
          transactionFeeRate: `${(feeRate * 100).toFixed(2)}%`,
          fixedFeePerTransaction: fixedFee,
          monthlyTransactionLimit: tier.monthlyTransactionLimit,
          monthlyVolumeLimit: tier.monthlyVolumeLimit ? parseFloat(tier.monthlyVolumeLimit) : null
        },
        calculation: {
          monthlyTransactions,
          monthlyVolume,
          transactionFees: Math.round(transactionFees * 100) / 100,
          fixedFees: Math.round(fixedFees * 100) / 100,
          totalMonthlyFees: Math.round(totalMonthlyFees * 100) / 100,
          netRevenue: Math.round(netRevenue * 100) / 100,
          effectiveFeeRate: monthlyVolume > 0 ? `${((totalMonthlyFees / monthlyVolume) * 100).toFixed(2)}%` : '0%',
          withinLimits,
          recommended: withinLimits && (tier.name.toLowerCase() === (req.query.tier as string || 'startup').toLowerCase())
        }
      };
    });

    res.json({
      success: true,
      input: {
        monthlyTransactions,
        averageTransactionAmount: avgAmount,
        monthlyVolume
      },
      calculations
    });
  } catch (error) {
    console.error('Error calculating pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate pricing'
    });
  }
});

export default router;