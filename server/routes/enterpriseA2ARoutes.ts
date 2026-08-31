/**
 * 🏢 ENTERPRISE A2A API ROUTES - IMMEDIATE REVENUE GENERATOR
 * 
 * Revenue-generating API endpoints for enterprise A2A integrations
 * Based on ChatGPT's suggestion for vendor-agnostic adapter
 * 
 * PRICING: $0.05 per A2A call + setup fees
 */

import { Router } from 'express';
import enterpriseA2AAdapter, { EnterpriseConfig, A2ATask } from '../adapters/enterpriseA2AAdapter';

const router = Router();
const getEstimatedUnits = (task: A2ATask, fallback: number): number => {
  const estimate = task.params?.estimatedUnits;
  return typeof estimate === 'number' && Number.isFinite(estimate) ? estimate : fallback;
};

/**
 * 💳 POST /api/enterprise-a2a/setup-payment
 * Capture customer payment method using SetupIntent
 * Required before any enterprise billing can work
 */
router.post('/setup-payment', async (req, res) => {
  try {
    const { customerEmail, customerName }: { customerEmail: string; customerName?: string } = req.body;
    
    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'customerEmail is required for payment setup'
      });
    }

    console.log(`💳 Setting up payment method for: ${customerEmail}`);
    
    const stripe = (await import('stripe')).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
    
    // Find or create customer
    let customer;
    const existingCustomers = await stripeClient.customers.list({
      email: customerEmail,
      limit: 1
    });
    
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripeClient.customers.create({
        email: customerEmail,
        name: customerName || customerEmail.split('@')[0],
        description: 'Enterprise A2A API Customer'
      });
    }
    
    // Create SetupIntent to capture payment method for automated billing
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: {
        service: 'enterprise-a2a-setup',
        customerEmail: customerEmail
      }
    });
    
    console.log(`✅ SetupIntent created for ${customerEmail}: ${setupIntent.id}`);
    
    res.json({
      success: true,
      setupIntent: {
        id: setupIntent.id,
        client_secret: setupIntent.client_secret,
        status: setupIntent.status
      },
      customer: {
        id: customer.id,
        email: customer.email
      },
      message: 'Complete payment method setup to enable enterprise billing'
    });
    
  } catch (error: any) {
    console.error('❌ Payment setup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ✅ POST /api/enterprise-a2a/plugin-complete
 * Complete enterprise setup after 3D Secure authentication for $100 setup fee
 * Uses existing confirmed PaymentIntent to avoid double charging
 */
router.post('/plugin-complete', async (req, res) => {
  try {
    const { paymentIntentId, configId, config }: { 
      paymentIntentId: string;
      configId: string; 
      config: EnterpriseConfig;
    } = req.body;
    
    if (!paymentIntentId || !configId || !config) {
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId, configId, and config are required'
      });
    }

    console.log(`🔄 Completing enterprise setup with confirmed PaymentIntent: ${paymentIntentId}`);
    
    // SECURITY: Check for PaymentIntent replay attacks
    const { db } = await import('../db');
    const { paymentIntentTracking } = await import('../../shared/schema');
    const { sql } = await import('drizzle-orm');
    
    const existingUsage = await db.select().from(paymentIntentTracking)
      .where(sql`payment_intent_id = ${paymentIntentId}`).limit(1);
    
    if (existingUsage.length > 0) {
      console.error(`🚨 PAYMENT REPLAY ATTACK BLOCKED: ${paymentIntentId} already used for ${existingUsage[0].purpose}`);
      return res.status(402).json({
        success: false,
        error: 'PaymentIntent already used - cannot replay payments for additional enterprise work',
        securityViolation: 'payment_replay_attack',
        originalUsage: {
          purpose: existingUsage[0].purpose,
          usedAt: existingUsage[0].usedAt,
          configId: existingUsage[0].configId
        }
      });
    }
    
    const stripe = (await import('stripe')).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
    
    // Retrieve and verify the PaymentIntent is confirmed
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({
        success: false,
        error: `Setup fee PaymentIntent not confirmed. Status: ${paymentIntent.status}`,
        paymentStatus: paymentIntent.status,
        clientSecret: paymentIntent.client_secret
      });
    }

    console.log(`✅ Setup fee PaymentIntent confirmed ($${(paymentIntent.amount/100).toFixed(2)}) - installing enterprise config`);

    // CRITICAL SECURITY: Validate PaymentIntent metadata before allowing setup
    const expectedAmount = 10000; // $100.00 setup fee for enterprise
    const expectedConfigId = configId;

    // CRITICAL SECURITY: Validate currency is USD to prevent foreign currency bypass attacks
    if (paymentIntent.currency !== 'usd') {
      console.error(`🚨 SETUP PAYMENT CURRENCY VIOLATION: Non-USD currency ${paymentIntent.currency} attempted for ${configId}`);
      return res.status(400).json({
        success: false,
        error: `Invalid payment currency. Enterprise setup requires USD payments only.`,
        securityViolation: 'invalid_currency',
        providedCurrency: paymentIntent.currency,
        requiredCurrency: 'usd'
      });
    }

    if (paymentIntent.amount < expectedAmount) {
      console.error(`🚨 SETUP PAYMENT VALIDATION FAILURE: Insufficient amount ${paymentIntent.amount} cents, required ${expectedAmount} cents for ${configId}`);
      return res.status(400).json({
        success: false,
        error: `Insufficient payment amount. Enterprise setup requires $${(expectedAmount/100).toFixed(2)} setup fee.`,
        securityViolation: 'insufficient_setup_payment',
        paid: paymentIntent.amount / 100,
        required: expectedAmount / 100
      });
    }

    if (!paymentIntent.metadata?.service || paymentIntent.metadata.service !== 'enterprise-a2a-setup') {
      console.error(`🚨 SETUP PAYMENT VALIDATION FAILURE: Invalid service "${paymentIntent.metadata?.service}", expected "enterprise-a2a-setup" for ${configId}`);
      return res.status(400).json({
        success: false,
        error: 'Payment service mismatch. This payment cannot be used for enterprise setup.',
        securityViolation: 'setup_service_mismatch',
        received: paymentIntent.metadata?.service,
        expected: 'enterprise-a2a-setup'
      });
    }

    if (!paymentIntent.metadata?.configId || paymentIntent.metadata.configId !== expectedConfigId) {
      console.error(`🚨 SETUP PAYMENT VALIDATION FAILURE: Invalid configId "${paymentIntent.metadata?.configId}", expected "${expectedConfigId}"`);
      return res.status(400).json({
        success: false,
        error: 'Payment config mismatch. This payment cannot be used for this enterprise configuration.',
        securityViolation: 'setup_config_mismatch',
        received: paymentIntent.metadata?.configId,
        expected: expectedConfigId
      });
    }

    console.log(`🔒 SETUP PAYMENT VALIDATION PASSED: Amount ${paymentIntent.amount}, Purpose ${paymentIntent.metadata.purpose}, Config ${paymentIntent.metadata.configId}`);

    // Re-install enterprise configuration with confirmed payment
    const success = await enterpriseA2AAdapter.pluginEnterpriseConfig(configId, config);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to install enterprise configuration after payment confirmation'
      });
    }

    // SECURITY: Track PaymentIntent usage to prevent replay attacks
    await db.insert(paymentIntentTracking).values({
      paymentIntentId: paymentIntent.id,
      customerEmail: paymentIntent.receipt_email || 'unknown',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      purpose: 'setup_fee',
      configId: configId,
      taskDescription: `Enterprise A2A setup for ${config.platform}`,
      metadata: {
        configPlatform: config.platform,
        completedVia3DS: true,
        stripePaymentIntentId: paymentIntent.id
      },
      status: 'used'
    });

    // Store setup fee billing record  
    const { outreachLogs } = await import('../../shared/schema');
    
    await db.insert(outreachLogs).values({
      platform: 'a2a_billing',
      target: config.platform,
      url: '',
      status: 'success'
    });

    console.log(`💰 REAL SETUP REVENUE GENERATED: $100.00 (Confirmed: ${paymentIntent.id})`);

    res.json({
      success: true,
      configId,
      config: {
        platform: config.platform,
        credentials: '[REDACTED]'
      },
      billing: {
        setupFee: 100.00,
        stripePaymentIntent: paymentIntent.id,
        status: paymentIntent.status,
        paidAt: new Date().toISOString()
      },
      message: 'Enterprise configuration installed successfully after 3D Secure completion',
      nextSteps: 'Use /api/enterprise-a2a/execute to run billable tasks'
    });
    
  } catch (error: any) {
    console.error('❌ Setup 3D Secure completion failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 💰 POST /api/enterprise-a2a/plugin-config
 * Allow teams to plug in their enterprise tenant configurations
 * REVENUE: $100 setup fee per enterprise integration (REAL STRIPE BILLING)
 */
router.post('/plugin-config', async (req, res) => {
  try {
    const { configId, config, customerEmail }: { 
      configId: string; 
      config: EnterpriseConfig;
      customerEmail?: string;
    } = req.body;
    
    if (!configId || !config) {
      return res.status(400).json({
        success: false,
        error: 'configId and config are required'
      });
    }

    console.log(`🏢 Enterprise config setup for: ${config.platform} (${configId})`);
    
    const success = await enterpriseA2AAdapter.pluginEnterpriseConfig(configId, config);
    
    if (success) {
      // 💰 REAL STRIPE BILLING - Charge $100 setup fee
      try {
        const stripe = (await import('stripe')).default;
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
        
        // MANDATORY: Customer email required for all enterprise billing
        if (!customerEmail) {
          // Remove configuration since no billing possible
          enterpriseA2AAdapter.removeConfig(configId);
          
          return res.status(402).json({
            success: false,
            error: 'Customer email required for $100 setup fee billing',
            setupRequired: true,
            setupEndpoint: '/api/enterprise-a2a/setup-payment',
            requiresPayment: true
          });
        }
        
        // Create or retrieve customer
        let customer;
        if (customerEmail) {
          const existingCustomers = await stripeClient.customers.list({
            email: customerEmail,
            limit: 1
          });
          
          if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
          } else {
            customer = await stripeClient.customers.create({
              email: customerEmail,
              description: `Enterprise A2A Customer - ${config.platform}`
            });
          }
        }

        // Create setup fee payment intent with automatic payment method
        const setupFeeCharge = await stripeClient.paymentIntents.create({
          amount: 10000, // $100.00 in cents
          currency: 'usd',
          description: `Enterprise A2A Setup - ${config.platform} Integration (${configId})`,
          automatic_payment_methods: {
            enabled: true,
          },
          ...(customer && {
            customer: customer.id,
            receipt_email: customerEmail
          }),
          metadata: {
            configId,
            platform: config.platform,
            service: 'enterprise-a2a-setup'
          }
        });

        // MANDATORY: Confirm setup fee using customer's stored payment method
        if (!customer) {
          return res.status(402).json({
            success: false,
            error: 'Customer required for setup fee payment',
            setupRequired: true,
            setupEndpoint: '/api/enterprise-a2a/setup-payment'
          });
        }
        
        // Retrieve customer's default payment method
        const paymentMethods = await stripeClient.paymentMethods.list({
          customer: customer.id,
          type: 'card',
          limit: 1
        });
        
        if (paymentMethods.data.length === 0) {
          // Remove the configuration since no payment method available
          enterpriseA2AAdapter.removeConfig(configId);
          
          return res.status(402).json({
            success: false,
            error: 'No payment method on file. Please setup payment method first.',
            setupRequired: true,
            setupEndpoint: '/api/enterprise-a2a/setup-payment',
            customerEmail: customerEmail || 'required'
          });
        }
        
        const confirmedPayment = await stripeClient.paymentIntents.confirm(setupFeeCharge.id, {
          payment_method: paymentMethods.data[0].id,
          off_session: true, // Use stored payment method for automated billing
          return_url: 'https://coinrailz.com/enterprise/setup-complete'
        });

        if (confirmedPayment.status === 'requires_action') {
          // Remove the configuration since 3D Secure is needed
          enterpriseA2AAdapter.removeConfig(configId);
          
          return res.status(402).json({
            success: false,
            error: 'Setup fee requires additional authentication (3D Secure) - complete authentication first',
            paymentStatus: confirmedPayment.status,
            paymentIntentId: confirmedPayment.id,
            clientSecret: confirmedPayment.client_secret,
            next_action: confirmedPayment.next_action,
            requiresAuthentication: true,
            completionEndpoint: '/api/enterprise-a2a/plugin-complete',
            configData: { configId, config },
            instructions: 'Complete 3D Secure authentication, then call /plugin-complete endpoint with paymentIntentId'
          });
        }

        if (confirmedPayment.status !== 'succeeded') {
          // Remove the configuration since payment failed
          enterpriseA2AAdapter.removeConfig(configId);
          
          return res.status(402).json({
            success: false,
            error: 'Setup fee payment failed - configuration cannot proceed',
            paymentStatus: confirmedPayment.status,
            clientSecret: confirmedPayment.client_secret,
            requiresPayment: true
          });
        }

        // ONLY AFTER SUCCESSFUL PAYMENT: Store success record in database
        const { db } = await import('../db');
        const { outreachLogs } = await import('../../shared/schema');
        
        await db.insert(outreachLogs).values({
          platform: 'a2a_billing',
          target: config.platform,
          url: '',
          status: 'success'
        });

        console.log(`💰 REAL REVENUE GENERATED: $100.00 setup fee for ${config.platform} (Confirmed: ${confirmedPayment.id})`);

        res.json({
          success: true,
          message: `${config.platform} integration configured and paid successfully`,
          configId,
          platform: config.platform,
          billing: {
            setupFee: 100,
            stripePaymentIntent: confirmedPayment.id,
            status: confirmedPayment.status,
            customerId: customer?.id,
            paidAt: new Date().toISOString()
          },
          perCallRate: 0.05
        });
      } catch (stripeError: any) {
        console.error('❌ MANDATORY BILLING FAILED - Blocking service:', stripeError);
        
        // MANDATORY: Remove any partial configuration and FAIL the request
        if (success) {
          enterpriseA2AAdapter.removeConfig(configId);
        }
        
        return res.status(402).json({
          success: false,
          error: 'Payment processing failed - configuration blocked',
          billingError: stripeError.message,
          setupFee: 100,
          requiresPayment: true
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to configure ${config.platform} integration`
      });
    }
    
  } catch (error: any) {
    console.error('❌ Enterprise config setup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ✅ POST /api/enterprise-a2a/complete
 * Complete enterprise work after 3D Secure authentication
 * Uses existing confirmed PaymentIntent to avoid double charging
 */
router.post('/complete', async (req, res) => {
  try {
    const { paymentIntentId, configId, task }: { 
      paymentIntentId: string;
      configId: string; 
      task: A2ATask;
    } = req.body;
    
    if (!paymentIntentId || !configId || !task) {
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId, configId, and task are required'
      });
    }

    console.log(`🔄 Completing enterprise task with confirmed PaymentIntent: ${paymentIntentId}`);
    
    // SECURITY: Check for PaymentIntent replay attacks
    const { db } = await import('../db');
    const { paymentIntentTracking } = await import('../../shared/schema');
    const { sql } = await import('drizzle-orm');
    
    const existingUsage = await db.select().from(paymentIntentTracking)
      .where(sql`payment_intent_id = ${paymentIntentId}`).limit(1);
    
    if (existingUsage.length > 0) {
      console.error(`🚨 PAYMENT REPLAY ATTACK BLOCKED: ${paymentIntentId} already used for ${existingUsage[0].purpose}`);
      return res.status(402).json({
        success: false,
        error: 'PaymentIntent already used - cannot replay payments for additional enterprise work',
        securityViolation: 'payment_replay_attack',
        originalUsage: {
          purpose: existingUsage[0].purpose,
          usedAt: existingUsage[0].usedAt,
          taskDescription: existingUsage[0].taskDescription
        }
      });
    }
    
    const stripe = (await import('stripe')).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
    
    // Retrieve and verify the PaymentIntent is confirmed
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({
        success: false,
        error: `PaymentIntent not confirmed. Status: ${paymentIntent.status}`,
        paymentStatus: paymentIntent.status,
        clientSecret: paymentIntent.client_secret
      });
    }

    console.log(`✅ PaymentIntent confirmed ($${(paymentIntent.amount/100).toFixed(2)}) - executing enterprise task`);

    // CRITICAL SECURITY: Validate PaymentIntent metadata before allowing work
    const expectedAmount = 500; // $5.00 minimum for enterprise execution
    const expectedConfigId = configId;

    // CRITICAL SECURITY: Validate currency is USD to prevent foreign currency bypass attacks
    if (paymentIntent.currency !== 'usd') {
      console.error(`🚨 EXECUTION PAYMENT CURRENCY VIOLATION: Non-USD currency ${paymentIntent.currency} attempted for ${configId}`);
      return res.status(400).json({
        success: false,
        error: `Invalid payment currency. Enterprise execution requires USD payments only.`,
        securityViolation: 'invalid_currency',
        providedCurrency: paymentIntent.currency,
        requiredCurrency: 'usd'
      });
    }

    if (paymentIntent.amount < expectedAmount) {
      console.error(`🚨 PAYMENT VALIDATION FAILURE: Insufficient amount ${paymentIntent.amount} cents, required ${expectedAmount} cents for ${configId}`);
      return res.status(400).json({
        success: false,
        error: `Insufficient payment amount. Enterprise execution requires minimum $${(expectedAmount/100).toFixed(2)}.`,
        securityViolation: 'insufficient_payment',
        paid: paymentIntent.amount / 100,
        required: expectedAmount / 100
      });
    }

    if (!paymentIntent.metadata?.service || paymentIntent.metadata.service !== 'enterprise-a2a-call-preauth') {
      console.error(`🚨 PAYMENT VALIDATION FAILURE: Invalid service "${paymentIntent.metadata?.service}", expected "enterprise-a2a-call-preauth" for ${configId}`);
      return res.status(400).json({
        success: false,
        error: 'Payment service mismatch. This payment cannot be used for enterprise execution.',
        securityViolation: 'service_mismatch',
        received: paymentIntent.metadata?.service,
        expected: 'enterprise-a2a-call-preauth'
      });
    }

    if (!paymentIntent.metadata?.configId || paymentIntent.metadata.configId !== expectedConfigId) {
      console.error(`🚨 PAYMENT VALIDATION FAILURE: Invalid configId "${paymentIntent.metadata?.configId}", expected "${expectedConfigId}"`);
      return res.status(400).json({
        success: false,
        error: 'Payment config mismatch. This payment cannot be used for this enterprise configuration.',
        securityViolation: 'config_mismatch',
        received: paymentIntent.metadata?.configId,
        expected: expectedConfigId
      });
    }

    console.log(`🔒 PAYMENT VALIDATION PASSED: Amount ${paymentIntent.amount}, Purpose ${paymentIntent.metadata.purpose}, Config ${paymentIntent.metadata.configId}`);

    // SECURITY: Track PaymentIntent usage before executing work
    await db.insert(paymentIntentTracking).values({
      paymentIntentId: paymentIntent.id,
      customerEmail: paymentIntent.receipt_email || 'unknown',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      purpose: 'execution',
      configId: configId,
      taskDescription: 'Enterprise A2A task execution',
      metadata: {
        taskType: 'enterprise_a2a',
        completedVia3DS: true,
        stripePaymentIntentId: paymentIntent.id
      },
      status: 'used'
    });

    // Execute enterprise task with confirmed payment
    const result = await enterpriseA2AAdapter.executeTask(configId, task);
    
    if (result.success && result.billableUnits) {
      const actualCharge = result.billableUnits * 0.05;
      const refundAmount = paymentIntent.amount - Math.round(actualCharge * 100);

      // SECURITY: Wrap refunds in try-catch to handle already-refunded PaymentIntents
      let refundSuccess = false;
      if (refundAmount > 0) {
        try {
          await stripeClient.refunds.create({
            payment_intent: paymentIntent.id,
            amount: refundAmount,
            reason: 'requested_by_customer',
            metadata: {
              reason: 'adjust_to_actual_usage_post_3ds',
              actualCharge: actualCharge.toString(),
              originalCharge: (paymentIntent.amount / 100).toString()
            }
          });
          refundSuccess = true;
        } catch (refundError: any) {
          console.error(`⚠️ Refund failed for ${paymentIntent.id}: ${refundError.message}`);
          // Work was performed successfully even if refund fails
          refundSuccess = false;
        }
      }

      // Store success record in database
      const { db } = await import('../db');
      const { outreachLogs } = await import('../../shared/schema');
      
      await db.insert(outreachLogs).values({
        platform: 'a2a_billing',
        target: configId,
        url: '',
        status: 'success'
      });

      console.log(`💰 REAL REVENUE GENERATED: $${actualCharge.toFixed(2)} (Confirmed: ${paymentIntent.id})`);

      res.json({
        ...result,
        billing: {
          charge: actualCharge,
          stripePaymentIntent: paymentIntent.id,
          status: paymentIntent.status,
          paidAt: new Date().toISOString(),
          refunded: refundAmount > 0 ? refundAmount / 100 : 0
        }
      });
    } else {
      // Full refund for failed calls
      try {
        await stripeClient.refunds.create({
          payment_intent: paymentIntent.id,
          reason: 'requested_by_customer',
          metadata: {
            reason: 'task_execution_failed_post_3ds'
          }
        });

        res.json({
          ...result,
          billing: {
            charge: 0,
            refunded: paymentIntent.amount / 100,
            reason: 'Task execution failed - full refund issued'
          }
        });
      } catch (refundError: any) {
        console.error(`⚠️ Failed task refund failed for ${paymentIntent.id}: ${refundError.message}`);
        res.json({
          ...result,
          billing: {
            charge: 0,
            refundStatus: 'failed',
            reason: 'Task execution failed but refund also failed'
          }
        });
      }
    }
    
  } catch (error: any) {
    console.error('❌ 3D Secure completion failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 💰 POST /api/enterprise-a2a/execute
 * Execute billable A2A task on enterprise agent
 * REVENUE: $0.05 per successful call (REAL STRIPE BILLING)
 */
router.post('/execute', async (req, res) => {
  try {
    const { configId, task, customerEmail }: { 
      configId: string; 
      task: A2ATask;
      customerEmail?: string;
    } = req.body;
    
    if (!configId || !task) {
      return res.status(400).json({
        success: false,
        error: 'configId and task are required'
      });
    }

    console.log(`💰 PRE-AUTHORIZING payment before executing enterprise task: ${task.method} on ${configId}`);
    
    // 💰 MANDATORY: PRE-AUTHORIZE PAYMENT BEFORE ANY ENTERPRISE WORK
    try {
      const stripe = (await import('stripe')).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
      
      // Find existing customer for billing
      let customer;
      if (customerEmail) {
        const existingCustomers = await stripeClient.customers.list({
          email: customerEmail,
          limit: 1
        });
        customer = existingCustomers.data[0];
      }

      // Dynamic pre-authorization based on estimated cost (min $5, max $50)
      const estimatedUnits = Math.min(100, Math.max(10, getEstimatedUnits(task, 50))); // 10-100 units
      const preAuthAmount = Math.max(500, Math.min(5000, estimatedUnits * 6)); // $5-$50 with 20% buffer
      
      const maxCallCharge = await stripeClient.paymentIntents.create({
        amount: preAuthAmount,
        currency: 'usd',
        description: `A2A API Call Pre-Authorization - ${task.method} on ${configId}`,
        automatic_payment_methods: {
          enabled: true,
        },
        ...(customer && {
          customer: customer.id,
          receipt_email: customerEmail
        }),
        metadata: {
          configId,
          method: task.method,
          service: 'enterprise-a2a-call-preauth'
        }
      });

      // MANDATORY: Confirm pre-authorization using customer's stored payment method
      if (!customer) {
        return res.status(402).json({
          success: false,
          error: 'Customer required for payment processing',
          setupRequired: true,
          setupEndpoint: '/api/enterprise-a2a/setup-payment'
        });
      }
      
      // Retrieve customer's default payment method
      const paymentMethods = await stripeClient.paymentMethods.list({
        customer: customer.id,
        type: 'card',
        limit: 1
      });
      
      if (paymentMethods.data.length === 0) {
        return res.status(402).json({
          success: false,
          error: 'No payment method on file. Please setup payment method first.',
          setupRequired: true,
          setupEndpoint: '/api/enterprise-a2a/setup-payment',
          customerEmail: customerEmail || 'required'
        });
      }
      
      const confirmedPreAuth = await stripeClient.paymentIntents.confirm(maxCallCharge.id, {
        payment_method: paymentMethods.data[0].id,
        return_url: 'https://coinrailz.com/billing/success' // Required for 3D Secure
      });

      if (confirmedPreAuth.status === 'requires_action') {
        return res.status(402).json({
          success: false,
          error: 'Payment requires additional authentication (3D Secure) - complete authentication first',
          paymentStatus: confirmedPreAuth.status,
          paymentIntentId: confirmedPreAuth.id,
          clientSecret: confirmedPreAuth.client_secret,
          next_action: confirmedPreAuth.next_action,
          preAuthAmount: preAuthAmount / 100,
          requiresAuthentication: true,
          completionEndpoint: '/api/enterprise-a2a/complete',
          instructions: 'Complete 3D Secure authentication, then call /complete endpoint with paymentIntentId'
        });
      }

      if (confirmedPreAuth.status !== 'succeeded') {
        return res.status(402).json({
          success: false,
          error: 'Payment pre-authorization failed - no enterprise work will be performed',
          paymentStatus: confirmedPreAuth.status,
          clientSecret: confirmedPreAuth.client_secret,
          preAuthAmount: preAuthAmount / 100,
          requiresPayment: true
        });
      }

      console.log(`✅ Payment CAPTURED and CONFIRMED ($${(preAuthAmount/100).toFixed(2)}) - executing enterprise task`);

      // ONLY AFTER PAYMENT CONFIRMED: Execute enterprise task
      const result = await enterpriseA2AAdapter.executeTask(configId, task);
      
      if (result.success && result.billableUnits) {
        const actualCharge = result.billableUnits * 0.05;
        const refundAmount = preAuthAmount - Math.round(actualCharge * 100); // Refund difference in cents

        // Refund the difference if any
        if (refundAmount > 0) {
          await stripeClient.refunds.create({
            payment_intent: confirmedPreAuth.id,
            amount: refundAmount,
            reason: 'requested_by_customer',
            metadata: {
              reason: 'adjust_to_actual_usage',
              actualCharge: actualCharge.toString(),
              originalCharge: (preAuthAmount / 100).toString()
            }
          });
        }

        // Store success record in database
        const { db } = await import('../db');
        const { outreachLogs } = await import('../../shared/schema');
        
        await db.insert(outreachLogs).values({
          platform: result.platform,
          target: configId,
          status: 'success',
        });

        console.log(`💰 REAL REVENUE GENERATED: $${actualCharge.toFixed(2)} for A2A call (Confirmed: ${confirmedPreAuth.id})`);

        res.json({
          ...result,
          billing: {
            units: result.billableUnits,
            rate: 0.05,
            charge: actualCharge,
            stripePaymentIntent: confirmedPreAuth.id,
            status: confirmedPreAuth.status,
            paidAt: new Date().toISOString(),
            refunded: refundAmount > 0 ? refundAmount / 100 : 0
          }
        });
      } else {
        // Full refund for failed calls
        await stripeClient.refunds.create({
          payment_intent: confirmedPreAuth.id,
          reason: 'requested_by_customer',
          metadata: {
            reason: 'task_execution_failed'
          }
        });

        res.json({
          ...result,
          billing: {
            charge: 0,
            refunded: preAuthAmount / 100,
            reason: 'Task execution failed - full refund issued'
          }
        });
      }
    } catch (stripeError: any) {
      console.error('❌ PAYMENT PRE-AUTHORIZATION FAILED - Blocking enterprise work:', stripeError);
      
      return res.status(402).json({
        success: false,
        error: 'Payment pre-authorization failed - no enterprise work performed',
        billingError: stripeError.message,
        maxCharge: 5.00,
        requiresPayment: true
      });
    }
    
  } catch (error: any) {
    console.error('❌ A2A task execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      platform: 'unknown',
      executionTime: 0
    });
  }
});

/**
 * ✅ POST /api/enterprise-a2a/batch-complete
 * Complete batch enterprise work after 3D Secure authentication
 * Uses existing confirmed PaymentIntent to avoid double charging
 */
router.post('/batch-complete', async (req, res) => {
  try {
    const { paymentIntentId, tasks }: { 
      paymentIntentId: string;
      tasks: Array<{ configId: string; task: A2ATask }>;
    } = req.body;
    
    if (!paymentIntentId || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId and tasks array are required'
      });
    }

    console.log(`🔄 Completing batch of ${tasks.length} enterprise tasks with confirmed PaymentIntent: ${paymentIntentId}`);
    
    // SECURITY: Check for PaymentIntent replay attacks
    const { db } = await import('../db');
    const { paymentIntentTracking } = await import('../../shared/schema');
    const { sql } = await import('drizzle-orm');
    
    const existingUsage = await db.select().from(paymentIntentTracking)
      .where(sql`payment_intent_id = ${paymentIntentId}`).limit(1);
    
    if (existingUsage.length > 0) {
      console.error(`🚨 PAYMENT REPLAY ATTACK BLOCKED: ${paymentIntentId} already used for ${existingUsage[0].purpose}`);
      return res.status(402).json({
        success: false,
        error: 'PaymentIntent already used - cannot replay payments for additional enterprise work',
        securityViolation: 'payment_replay_attack',
        originalUsage: {
          purpose: existingUsage[0].purpose,
          usedAt: existingUsage[0].usedAt,
          taskDescription: existingUsage[0].taskDescription
        }
      });
    }
    
    const stripe = (await import('stripe')).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
    
    // Retrieve and verify the PaymentIntent is confirmed
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({
        success: false,
        error: `Batch PaymentIntent not confirmed. Status: ${paymentIntent.status}`,
        paymentStatus: paymentIntent.status,
        clientSecret: paymentIntent.client_secret
      });
    }

    console.log(`✅ Batch PaymentIntent confirmed ($${(paymentIntent.amount/100).toFixed(2)}) - executing ${tasks.length} tasks`);

    // CRITICAL SECURITY: Validate PaymentIntent metadata before allowing batch work
    // Use the same pre-authorization logic as batch creation to validate expected amount
    const estimatedTotalUnits = tasks.reduce((sum, { task }) => 
      sum + getEstimatedUnits(task, 20), 0
    );
    const expectedMinAmount = Math.max(1000, Math.min(10000, estimatedTotalUnits * 6)); // Match creation logic
    const expectedTaskCount = tasks.length;

    // CRITICAL SECURITY: Validate currency is USD to prevent foreign currency bypass attacks
    if (paymentIntent.currency !== 'usd') {
      console.error(`🚨 BATCH PAYMENT CURRENCY VIOLATION: Non-USD currency ${paymentIntent.currency} attempted for ${tasks.length} tasks`);
      return res.status(400).json({
        success: false,
        error: `Invalid payment currency. Enterprise batch execution requires USD payments only.`,
        securityViolation: 'invalid_currency',
        providedCurrency: paymentIntent.currency,
        requiredCurrency: 'usd',
        taskCount: tasks.length
      });
    }

    if (paymentIntent.amount < expectedMinAmount) {
      console.error(`🚨 BATCH PAYMENT VALIDATION FAILURE: Insufficient amount ${paymentIntent.amount} cents, required ${expectedMinAmount} cents for ${tasks.length} tasks`);
      return res.status(400).json({
        success: false,
        error: `Insufficient payment amount. Batch execution requires minimum $${(expectedMinAmount/100).toFixed(2)} for ${tasks.length} tasks.`,
        securityViolation: 'insufficient_batch_payment',
        paid: paymentIntent.amount / 100,
        required: expectedMinAmount / 100,
        taskCount: tasks.length
      });
    }

    if (!paymentIntent.metadata?.service || paymentIntent.metadata.service !== 'enterprise-a2a-batch-preauth') {
      console.error(`🚨 BATCH PAYMENT VALIDATION FAILURE: Invalid service "${paymentIntent.metadata?.service}", expected "enterprise-a2a-batch-preauth" for batch`);
      return res.status(400).json({
        success: false,
        error: 'Payment service mismatch. This payment cannot be used for batch enterprise execution.',
        securityViolation: 'batch_service_mismatch',
        received: paymentIntent.metadata?.service,
        expected: 'enterprise-a2a-batch-preauth'
      });
    }

    if (!paymentIntent.metadata?.taskCount || parseInt(paymentIntent.metadata.taskCount) !== expectedTaskCount) {
      console.error(`🚨 BATCH PAYMENT VALIDATION FAILURE: Invalid task count "${paymentIntent.metadata?.taskCount}", expected "${expectedTaskCount}"`);
      return res.status(400).json({
        success: false,
        error: 'Payment task count mismatch. This payment cannot be used for this batch size.',
        securityViolation: 'batch_task_count_mismatch',
        received: paymentIntent.metadata?.taskCount,
        expected: expectedTaskCount
      });
    }

    console.log(`🔒 BATCH PAYMENT VALIDATION PASSED: Amount ${paymentIntent.amount}, Purpose ${paymentIntent.metadata.purpose}, Tasks ${paymentIntent.metadata.taskCount}`);

    // SECURITY: Track PaymentIntent usage before executing batch work
    await db.insert(paymentIntentTracking).values({
      paymentIntentId: paymentIntent.id,
      customerEmail: paymentIntent.receipt_email || 'unknown',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      purpose: 'batch',
      configId: tasks.map(t => t.configId).join(','),
      taskDescription: `Batch execution: ${tasks.length} enterprise A2A tasks`,
      metadata: {
        taskCount: tasks.length,
        completedVia3DS: true,
        stripePaymentIntentId: paymentIntent.id
      },
      status: 'used'
    });

    // Execute batch tasks with confirmed payment
    const results = await enterpriseA2AAdapter.executeBatch(tasks);
    
    // Calculate actual charges
    const totalBillableUnits = results.reduce((sum, result) => 
      sum + (result.success ? result.billableUnits || 0 : 0), 0
    );
    const actualCharge = totalBillableUnits * 0.05;
    const refundAmount = paymentIntent.amount - Math.round(actualCharge * 100);

    // SECURITY: Wrap refunds in try-catch to handle already-refunded PaymentIntents
    let refundSuccess = false;
    if (refundAmount > 0) {
      try {
        await stripeClient.refunds.create({
          payment_intent: paymentIntent.id,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            reason: 'adjust_to_actual_usage_batch_post_3ds',
            actualCharge: actualCharge.toString(),
            originalCharge: (paymentIntent.amount / 100).toString(),
            taskCount: tasks.length.toString()
          }
        });
        refundSuccess = true;
      } catch (refundError: any) {
        console.error(`⚠️ Batch refund failed for ${paymentIntent.id}: ${refundError.message}`);
        // Batch work was performed successfully even if refund fails
        refundSuccess = false;
      }
    } else {
      refundSuccess = true; // No refund needed
    }

    // Store success record in database
    const { outreachLogs } = await import('../../shared/schema');
    
    await db.insert(outreachLogs).values({
      platform: 'batch_enterprise',
      target: tasks.map(({ configId }) => configId).join(','),
      status: 'success',
    });

    console.log(`💰 REAL BATCH REVENUE GENERATED: $${actualCharge.toFixed(2)} for ${tasks.length} tasks (Confirmed: ${paymentIntent.id})`);

    res.json({
      success: true,
      results,
      billing: {
        totalCalls: tasks.length,
        successfulCalls: results.filter(r => r.success).length,
        billableUnits: totalBillableUnits,
        charge: actualCharge,
        stripePaymentIntent: paymentIntent.id,
        status: paymentIntent.status,
        paidAt: new Date().toISOString(),
        refunded: refundAmount > 0 ? refundAmount / 100 : 0,
        perCallRate: 0.05
      }
    });
    
  } catch (error: any) {
    console.error('❌ Batch 3D Secure completion failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 💰 POST /api/enterprise-a2a/batch-execute
 * Execute multiple A2A tasks in batch with MANDATORY PRE-AUTHORIZATION
 * REVENUE: $0.05 per successful call, NO FREE WORK ALLOWED
 */
router.post('/batch-execute', async (req, res) => {
  try {
    const { tasks, customerEmail }: { 
      tasks: Array<{ configId: string; task: A2ATask }>;
      customerEmail?: string;
    } = req.body;
    
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        error: 'tasks array is required'
      });
    }

    console.log(`💰 PRE-AUTHORIZING payment for batch of ${tasks.length} enterprise A2A tasks`);
    
    // 💰 MANDATORY: PRE-AUTHORIZE PAYMENT BEFORE ANY BATCH WORK
    try {
      const stripe = (await import('stripe')).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
      
      // Find existing customer for billing
      let customer;
      if (customerEmail) {
        const existingCustomers = await stripeClient.customers.list({
          email: customerEmail,
          limit: 1
        });
        customer = existingCustomers.data[0];
      }

      // Dynamic pre-authorization based on batch size (min $10, max $100 for batches)
      const estimatedTotalUnits = tasks.reduce((sum, { task }) => 
      sum + getEstimatedUnits(task, 20), 0
      );
      const preAuthAmount = Math.max(1000, Math.min(10000, estimatedTotalUnits * 6)); // $10-$100 with 20% buffer
      
      const batchCharge = await stripeClient.paymentIntents.create({
        amount: preAuthAmount,
        currency: 'usd',
        description: `A2A Batch Pre-Authorization - ${tasks.length} tasks`,
        automatic_payment_methods: {
          enabled: true,
        },
        ...(customer && {
          customer: customer.id,
          receipt_email: customerEmail
        }),
        metadata: {
          taskCount: tasks.length.toString(),
          estimatedUnits: estimatedTotalUnits.toString(),
          service: 'enterprise-a2a-batch-preauth'
        }
      });

      // MANDATORY: Confirm pre-authorization using customer's stored payment method
      if (!customer) {
        return res.status(402).json({
          success: false,
          error: 'Customer required for batch payment processing',
          setupRequired: true,
          setupEndpoint: '/api/enterprise-a2a/setup-payment'
        });
      }
      
      // Retrieve customer's default payment method
      const paymentMethods = await stripeClient.paymentMethods.list({
        customer: customer.id,
        type: 'card',
        limit: 1
      });
      
      if (paymentMethods.data.length === 0) {
        return res.status(402).json({
          success: false,
          error: 'No payment method on file for batch processing. Please setup payment method first.',
          setupRequired: true,
          setupEndpoint: '/api/enterprise-a2a/setup-payment',
          customerEmail: customerEmail || 'required'
        });
      }
      
      const confirmedPreAuth = await stripeClient.paymentIntents.confirm(batchCharge.id, {
        payment_method: paymentMethods.data[0].id,
        return_url: 'https://coinrailz.com/billing/success' // Required for 3D Secure
      });

      if (confirmedPreAuth.status === 'requires_action') {
        return res.status(402).json({
          success: false,
          error: 'Batch payment requires additional authentication (3D Secure) - complete authentication first',
          paymentStatus: confirmedPreAuth.status,
          paymentIntentId: confirmedPreAuth.id,
          clientSecret: confirmedPreAuth.client_secret,
          next_action: confirmedPreAuth.next_action,
          preAuthAmount: preAuthAmount / 100,
          requiresAuthentication: true,
          taskCount: tasks.length,
          completionEndpoint: '/api/enterprise-a2a/batch-complete',
          instructions: 'Complete 3D Secure authentication, then call /batch-complete endpoint with paymentIntentId'
        });
      }

      if (confirmedPreAuth.status !== 'succeeded') {
        return res.status(402).json({
          success: false,
          error: 'Batch payment pre-authorization failed - no enterprise work will be performed',
          paymentStatus: confirmedPreAuth.status,
          clientSecret: confirmedPreAuth.client_secret,
          preAuthAmount: preAuthAmount / 100,
          requiresPayment: true
        });
      }

      console.log(`✅ Batch payment CAPTURED and CONFIRMED ($${(preAuthAmount/100).toFixed(2)}) - executing ${tasks.length} tasks`);

      // ONLY AFTER PAYMENT CONFIRMED: Execute batch tasks
      const results = await enterpriseA2AAdapter.executeBatch(tasks);
      
      // Calculate actual charges
      const totalBillableUnits = results.reduce((sum, result) => 
        sum + (result.success ? result.billableUnits || 0 : 0), 0
      );
      const actualCharge = totalBillableUnits * 0.05;
      const refundAmount = preAuthAmount - Math.round(actualCharge * 100); // Refund difference in cents

      // Refund the difference if any
      if (refundAmount > 0) {
        await stripeClient.refunds.create({
          payment_intent: confirmedPreAuth.id,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            reason: 'adjust_to_actual_batch_usage',
            actualCharge: actualCharge.toString(),
            originalCharge: (preAuthAmount / 100).toString(),
            taskCount: tasks.length.toString()
          }
        });
      }

      // Store success record in database
      const { db } = await import('../db');
      const { outreachLogs } = await import('../../shared/schema');
      
      await db.insert(outreachLogs).values({
        platform: 'batch_enterprise',
        target: tasks.map(({ configId }) => configId).join(','),
        status: 'success',
      });

      console.log(`💰 REAL BATCH REVENUE GENERATED: $${actualCharge.toFixed(2)} for ${tasks.length} tasks (Confirmed: ${confirmedPreAuth.id})`);

      res.json({
        success: true,
        results,
        billing: {
          totalCalls: tasks.length,
          successfulCalls: results.filter(r => r.success).length,
          billableUnits: totalBillableUnits,
          charge: actualCharge,
          stripePaymentIntent: confirmedPreAuth.id,
          status: confirmedPreAuth.status,
          paidAt: new Date().toISOString(),
          refunded: refundAmount > 0 ? refundAmount / 100 : 0,
          perCallRate: 0.05
        }
      });
    } catch (stripeError: any) {
      console.error('❌ BATCH PAYMENT PRE-AUTHORIZATION FAILED - Blocking all enterprise work:', stripeError);
      
      return res.status(402).json({
        success: false,
        error: 'Batch payment pre-authorization failed - no enterprise work performed',
        billingError: stripeError.message,
        taskCount: tasks.length,
        requiresPayment: true
      });
    }
    
  } catch (error: any) {
    console.error('❌ Batch execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 📊 GET /api/enterprise-a2a/status
 * Get status of all enterprise integrations
 */
router.get('/status', async (req, res) => {
  try {
    const status = enterpriseA2AAdapter.getIntegrationStatus();
    
    res.json({
      success: true,
      integrations: status,
      totalIntegrations: status.length,
      activeIntegrations: status.filter(s => s.status === 'connected').length,
      expiredIntegrations: status.filter(s => s.status === 'expired').length
    });
    
  } catch (error: any) {
    console.error('❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🧹 POST /api/enterprise-a2a/cleanup
 * Cleanup expired connections
 */
router.post('/cleanup', async (req, res) => {
  try {
    const cleaned = enterpriseA2AAdapter.cleanupExpiredConnections();
    
    res.json({
      success: true,
      message: `Cleaned up ${cleaned} expired connections`,
      cleanedConnections: cleaned
    });
    
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🎯 POST /api/enterprise-a2a/discover
 * Discover capabilities of an A2A agent endpoint
 * Free discovery for potential customers
 */
router.post('/discover', async (req, res) => {
  try {
    const { agentHost, bearerToken }: { agentHost: string; bearerToken?: string } = req.body;
    
    if (!agentHost) {
      return res.status(400).json({
        success: false,
        error: 'agentHost is required'
      });
    }

    console.log(`🔍 Discovering A2A capabilities at: ${agentHost}`);
    
    // Import the discovery client
    const { default: a2aDiscoveryClient } = await import('../services/a2aDiscoveryClient.js');
    const agentCard = await a2aDiscoveryClient.discoverAgent(agentHost, bearerToken);
    
    if (agentCard) {
      res.json({
        success: true,
        agent: {
          name: agentCard.agent.name,
          description: agentCard.agent.description,
          version: agentCard.agent.version,
          capabilities: agentCard.agent.capabilities,
          endpoints: Object.keys(agentCard.agent.endpoints),
          authRequired: !!agentCard.agent.auth
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No A2A agent found at the specified host'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Agent discovery failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;