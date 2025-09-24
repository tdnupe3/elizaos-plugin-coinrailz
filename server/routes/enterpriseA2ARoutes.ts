/**
 * 🏢 ENTERPRISE A2A API ROUTES - IMMEDIATE REVENUE GENERATOR
 * 
 * Revenue-generating API endpoints for enterprise A2A integrations
 * Based on ChatGPT's suggestion for vendor-agnostic adapter
 * 
 * PRICING: $0.05 per A2A call + setup fees
 */

import { Router } from 'express';
import enterpriseA2AAdapter, { EnterpriseConfig, A2ATask } from '../adapters/enterpriseA2AAdapter.js';

const router = Router();

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

        // MANDATORY: Confirm payment immediately to ensure collection
        const confirmedPayment = await stripeClient.paymentIntents.confirm(setupFeeCharge.id, {
          return_url: 'https://coinrailz.com/enterprise/setup-complete'
        });

        if (confirmedPayment.status !== 'succeeded') {
          // Remove the configuration since payment failed
          enterpriseA2AAdapter.removeConfig(configId);
          
          return res.status(402).json({
            success: false,
            error: 'Payment required - setup fee must be paid before configuration',
            paymentStatus: confirmedPayment.status,
            clientSecret: confirmedPayment.client_secret,
            requiresPayment: true
          });
        }

        // ONLY AFTER SUCCESSFUL PAYMENT: Store success record in database
        const db = await import('../../shared/drizzle.js').then(m => m.db);
        const { outreachLogs } = await import('../../shared/schema.js');
        
        await db.insert(outreachLogs).values({
          outreachType: 'a2a_billing',
          targetPlatform: config.platform,
          cost: 100.00,
          result: 'success',
          details: JSON.stringify({
            type: 'setup_fee',
            configId,
            stripePaymentIntent: confirmedPayment.id,
            amount: 100.00,
            paidAt: new Date().toISOString()
          })
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
      const estimatedUnits = Math.min(100, Math.max(10, task.estimatedUnits || 50)); // 10-100 units
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

      // MANDATORY: Confirm pre-authorization before any work
      const confirmedPreAuth = await stripeClient.paymentIntents.confirm(maxCallCharge.id);

      if (confirmedPreAuth.status !== 'succeeded') {
        return res.status(402).json({
          success: false,
          error: 'Payment pre-authorization failed - no enterprise work will be performed',
          paymentStatus: confirmedPreAuth.status,
          clientSecret: confirmedPreAuth.client_secret,
          maxCharge: 5.00,
          requiresPayment: true
        });
      }

      console.log(`✅ Payment pre-authorized ($5.00 max) - executing enterprise task`);

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
        const db = await import('../../shared/drizzle.js').then(m => m.db);
        const { outreachLogs } = await import('../../shared/schema.js');
        
        await db.insert(outreachLogs).values({
          outreachType: 'a2a_billing',
          targetPlatform: result.platform,
          cost: actualCharge,
          result: 'success',
          details: JSON.stringify({
            type: 'api_call',
            configId,
            method: task.method,
            stripePaymentIntent: confirmedPreAuth.id,
            amount: actualCharge,
            executionTime: result.executionTime,
            paidAt: new Date().toISOString(),
            refundAmount: refundAmount > 0 ? refundAmount / 100 : 0
          })
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
        sum + (task.estimatedUnits || 20), 0
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

      // MANDATORY: Confirm pre-authorization before any batch work
      const confirmedPreAuth = await stripeClient.paymentIntents.confirm(batchCharge.id);

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

      console.log(`✅ Batch payment pre-authorized ($${(preAuthAmount/100).toFixed(2)}) - executing ${tasks.length} tasks`);

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
      const db = await import('../../shared/drizzle.js').then(m => m.db);
      const { outreachLogs } = await import('../../shared/schema.js');
      
      await db.insert(outreachLogs).values({
        outreachType: 'a2a_billing',
        targetPlatform: 'batch_enterprise',
        cost: actualCharge,
        result: 'success',
        details: JSON.stringify({
          type: 'batch_api_calls',
          taskCount: tasks.length,
          successfulTasks: results.filter(r => r.success).length,
          totalBillableUnits,
          stripePaymentIntent: confirmedPreAuth.id,
          amount: actualCharge,
          paidAt: new Date().toISOString(),
          refundAmount: refundAmount > 0 ? refundAmount / 100 : 0
        })
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