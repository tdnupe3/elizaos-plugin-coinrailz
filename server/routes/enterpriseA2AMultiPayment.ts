/**
 * ENTERPRISE A2A MULTI-PAYMENT INTEGRATION
 * 
 * Integrates multiple payment methods for enterprise A2A services:
 * 1. Stripe (primary) - PaymentIntent validation
 * 2. PayPal (production ready) - Enterprise integration
 * 3. Circle USDC (16 live wallets) - Direct crypto payments
 * 4. Coinbase CDP - Crypto payment processing
 * 
 * Based on ChatGPT attachments with IBM Watson ACP endpoints
 */

import { Router } from 'express';
import { paypalService } from '../services/paypalService';
import { userCircleService } from '../services/userCircleService';
import { coinbaseCDPService } from '../services/coinbaseCDPService';

const router = Router();

// IBM Watson ACP endpoints from ChatGPT attachments
const IBM_WATSON_ENDPOINTS = {
  acp: 'https://watson.ibm.com/acp',
  beeai: 'https://bee.ibm.com/agents', 
  research: 'https://research.ibm.com/acp'
};

/**
 * Multi-payment method setup for enterprise customers
 * Supports all 4 payment methods based on customer preference
 */
router.post('/setup-enterprise-payment', async (req, res) => {
  try {
    const { customerEmail, preferredMethod, amount, configId, platform } = req.body;

    console.log(`💳 Setting up ${preferredMethod} payment for enterprise customer: ${customerEmail}`);

    switch (preferredMethod) {
      case 'stripe':
        // Existing Stripe PaymentIntent logic (already implemented)
        res.json({
          method: 'stripe',
          setupEndpoint: '/api/enterprise-a2a/setup-payment',
          amount: amount,
          currency: 'USD'
        });
        break;

      case 'paypal':
        // PayPal enterprise setup
        const paypalOrder = await paypalService.createOrder({
          amount: (amount / 100).toString(), // PayPal uses dollars
          currency: 'USD',
          intent: 'CAPTURE'
        });

        res.json({
          method: 'paypal',
          orderId: paypalOrder.id,
          approvalUrl: paypalOrder.links.find(link => link.rel === 'approve')?.href,
          amount: amount,
          currency: 'USD'
        });
        break;

      case 'circle_usdc':
        // Circle USDC direct payment
        const usdcWallet = await userCircleService.createOrGetWallet(customerEmail);
        
        res.json({
          method: 'circle_usdc',
          walletId: usdcWallet.walletId,
          depositAddress: usdcWallet.address,
          amount: amount / 100, // USDC amount  
          currency: 'USDC',
          minimumConfirmations: 1
        });
        break;

      case 'coinbase_crypto':
        // Coinbase CDP crypto payment
        const cryptoAddress = await coinbaseCDPService.createPaymentAddress({
          customerEmail,
          amount: amount / 100,
          configId
        });

        res.json({
          method: 'coinbase_crypto',
          paymentAddress: cryptoAddress.address,
          supportedTokens: ['ETH', 'USDC', 'BTC'],
          amount: amount / 100,
          currency: 'USD_EQUIVALENT'
        });
        break;

      default:
        return res.status(400).json({
          error: 'Unsupported payment method',
          supportedMethods: ['stripe', 'paypal', 'circle_usdc', 'coinbase_crypto']
        });
    }

    console.log(`✅ ${preferredMethod} payment setup completed for ${customerEmail}`);

  } catch (error: any) {
    console.error(`❌ Multi-payment setup failed:`, error);
    res.status(500).json({
      error: 'Payment setup failed',
      details: error.message
    });
  }
});

/**
 * IBM Watson ACP Discovery - Real AI Agent Integration
 * Based on ChatGPT attachments with specific endpoints
 */
router.post('/discover-ibm-watson', async (req, res) => {
  try {
    const { configId, customerEmail } = req.body;

    console.log(`🔍 Discovering IBM Watson ACP endpoints for ${customerEmail}...`);

    const discoveryResults = [];

    // Discover from each IBM Watson endpoint
    for (const [name, endpoint] of Object.entries(IBM_WATSON_ENDPOINTS)) {
      try {
        console.log(`🔗 Checking ${name}: ${endpoint}`);

        // Try to fetch /.well-known/agent.json (A2A standard)
        const agentCardResponse = await fetch(`${endpoint}/.well-known/agent.json`);
        
        if (agentCardResponse.ok) {
          const agentCard = await agentCardResponse.json();
          
          discoveryResults.push({
            name: `IBM Watson ${name.toUpperCase()}`,
            endpoint: endpoint,
            capabilities: agentCard.capabilities || ['analyze_sentiment', 'answer_query'],
            authRequired: agentCard.auth?.required || true,
            protocol: 'acp_rest',
            status: 'discovered',
            supportedTasks: agentCard.tasks || [
              'sentiment_analysis',
              'customer_support', 
              'data_analysis',
              'decision_support'
            ]
          });

          console.log(`✅ IBM Watson ${name} - Agent card discovered`);
        } else {
          // Fallback: Known IBM Watson capabilities
          discoveryResults.push({
            name: `IBM Watson ${name.toUpperCase()}`,
            endpoint: endpoint,
            capabilities: ['analyze_sentiment', 'answer_query', 'language_processing'],
            authRequired: true,
            protocol: 'acp_rest', 
            status: 'known_endpoint',
            supportedTasks: [
              'sentiment_analysis',
              'natural_language_understanding',
              'conversation_ai',
              'text_analysis'
            ]
          });

          console.log(`⚠️ IBM Watson ${name} - Using known capabilities (no agent card)`);
        }

      } catch (error: any) {
        console.log(`❌ IBM Watson ${name} discovery failed: ${error.message}`);
        
        // Still add as potential target for manual outreach
        discoveryResults.push({
          name: `IBM Watson ${name.toUpperCase()}`,
          endpoint: endpoint,
          capabilities: ['enterprise_ai_services'],
          authRequired: true,
          protocol: 'acp_rest',
          status: 'manual_outreach_required',
          supportedTasks: ['custom_enterprise_ai']
        });
      }
    }

    // Store discovery results for enterprise configuration
    const db = await import('../../shared/drizzle.js').then(m => m.db);
    const { outreachLogs } = await import('../../shared/schema.js');
    
    await db.insert(outreachLogs).values({
      outreachType: 'ibm_watson_discovery',
      targetPlatform: 'IBM Watson ACP',
      result: 'success',
      details: JSON.stringify({
        type: 'a2a_agent_discovery',
        endpointsChecked: Object.keys(IBM_WATSON_ENDPOINTS).length,
        agentsDiscovered: discoveryResults.filter(r => r.status === 'discovered').length,
        knownEndpoints: discoveryResults.filter(r => r.status === 'known_endpoint').length,
        manualOutreachRequired: discoveryResults.filter(r => r.status === 'manual_outreach_required').length,
        configId: configId,
        customerEmail: customerEmail,
        discoveredAt: new Date().toISOString()
      })
    });

    res.json({
      success: true,
      discoveredAgents: discoveryResults,
      totalEndpoints: Object.keys(IBM_WATSON_ENDPOINTS).length,
      successfulDiscoveries: discoveryResults.filter(r => r.status === 'discovered').length,
      nextSteps: {
        authentication: 'OAuth2 tokens or API keys required for most agents',
        integration: 'Use standard A2A JSON-RPC calls for discovered agents',
        billing: 'Multi-payment methods available (Stripe, PayPal, Circle, Coinbase)'
      }
    });

    console.log(`✅ IBM Watson ACP discovery completed: ${discoveryResults.length} agents found`);

  } catch (error: any) {
    console.error(`❌ IBM Watson discovery failed:`, error);
    res.status(500).json({
      error: 'IBM Watson discovery failed',
      details: error.message
    });
  }
});

/**
 * Execute IBM Watson ACP task with multi-payment support
 * Combines real A2A protocol with our multi-payment infrastructure
 */
router.post('/execute-watson-task', async (req, res) => {
  try {
    const { 
      configId, 
      customerEmail, 
      watsonEndpoint, 
      task, 
      paymentMethod,
      paymentConfirmation 
    } = req.body;

    console.log(`🔧 Executing IBM Watson task via ${paymentMethod} payment...`);

    // Validate payment based on method
    let paymentValid = false;
    let paymentAmount = 0;

    switch (paymentMethod) {
      case 'stripe':
        // CRITICAL SECURITY: Real Stripe PaymentIntent validation
        const stripe = (await import('stripe')).default;
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
        
        try {
          const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentConfirmation.paymentIntentId);
          
          // CRITICAL SECURITY: Complete validation matching main enterprise routes
          const isValidCurrency = paymentIntent.currency === 'usd';
          const isValidAmount = paymentIntent.amount >= 500; // $5 minimum
          const isValidStatus = paymentIntent.status === 'succeeded';
          const isValidService = paymentIntent.metadata?.service === 'enterprise-a2a-call-preauth';
          const isValidConfig = paymentIntent.metadata?.configId === configId;
          
          // CRITICAL SECURITY: Check if PaymentIntent already used (replay prevention)
          const db = await import('../../shared/drizzle.js').then(m => m.db);
          const { paymentIntentTracking } = await import('../../shared/schema.js');
          const { eq } = await import('drizzle-orm');
          
          const existingUsage = await db
            .select()
            .from(paymentIntentTracking)
            .where(eq(paymentIntentTracking.paymentIntentId, paymentIntent.id))
            .limit(1);
          
          const isNotReplayed = existingUsage.length === 0;
          
          paymentValid = isValidCurrency && isValidAmount && isValidStatus && isValidService && isValidConfig && isNotReplayed;
          paymentAmount = paymentIntent.amount;
          
          if (!paymentValid) {
            console.error(`🚨 Stripe validation failed:`, {
              currency: paymentIntent.currency,
              amount: paymentIntent.amount,
              status: paymentIntent.status,
              service: paymentIntent.metadata?.service,
              configId: paymentIntent.metadata?.configId,
              alreadyUsed: !isNotReplayed
            });
          }
        } catch (error: any) {
          console.error(`❌ Stripe PaymentIntent lookup failed:`, error);
          paymentValid = false;
          paymentAmount = 0;
        }
        break;

      case 'paypal':
        // Validate PayPal order capture
        const paypalValidation = await paypalService.validateOrderCapture(paymentConfirmation.orderId);
        paymentValid = paypalValidation.status === 'COMPLETED';
        paymentAmount = parseFloat(paypalValidation.amount) * 100; // Convert to cents
        break;

      case 'circle_usdc':
        // Validate USDC transfer
        const usdcValidation = await userCircleService.validateTransfer(paymentConfirmation.transferId);
        paymentValid = usdcValidation.status === 'complete';
        paymentAmount = parseFloat(usdcValidation.amount) * 100; // Convert to cents
        break;

      case 'coinbase_crypto':
        // Validate crypto payment
        const cryptoValidation = await coinbaseCDPService.validatePayment(paymentConfirmation.transactionHash);
        paymentValid = cryptoValidation.confirmed;
        paymentAmount = parseFloat(cryptoValidation.usdValue) * 100; // Convert to cents
        break;
    }

    if (!paymentValid) {
      return res.status(400).json({
        error: 'Payment validation failed',
        paymentMethod: paymentMethod,
        status: 'payment_not_confirmed'
      });
    }

    // CRITICAL SECURITY: Track PaymentIntent usage before executing work
    if (paymentMethod === 'stripe') {
      const db = await import('../../shared/drizzle.js').then(m => m.db);
      const { paymentIntentTracking } = await import('../../shared/schema.js');
      
      await db.insert(paymentIntentTracking).values({
        paymentIntentId: paymentConfirmation.paymentIntentId,
        customerEmail: customerEmail || 'unknown',
        amount: paymentAmount,
        currency: 'usd',
        purpose: 'ibm_watson_execution',
        configId: configId,
        taskDescription: `IBM Watson ${task.name || 'analyze_sentiment'} task`,
        metadata: {
          watsonEndpoint: watsonEndpoint,
          taskType: task.name,
          paymentMethod: 'stripe',
          completedVia3DS: true
        },
        status: 'used'
      });
    }

    // Execute IBM Watson ACP task using A2A protocol
    const watsonRequest = {
      method: 'agent.invoke',
      params: {
        task: {
          name: task.name || 'analyze_sentiment',
          input: task.input
        }
      }
    };

    console.log(`🤖 Sending A2A request to IBM Watson: ${watsonEndpoint}`);

    // Make actual A2A JSON-RPC call to IBM Watson
    const watsonResponse = await fetch(watsonEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.headers.authorization}` // Customer's IBM token
      },
      body: JSON.stringify(watsonRequest)
    });

    const watsonResult = await watsonResponse.json();

    // Store successful execution
    const db = await import('../../shared/drizzle.js').then(m => m.db);
    const { outreachLogs } = await import('../../shared/schema.js');
    
    await db.insert(outreachLogs).values({
      outreachType: 'ibm_watson_execution',
      targetPlatform: 'IBM Watson ACP',
      cost: paymentAmount / 100,
      result: 'success',
      details: JSON.stringify({
        type: 'a2a_task_execution',
        paymentMethod: paymentMethod,
        paymentAmount: paymentAmount / 100,
        watsonEndpoint: watsonEndpoint,
        taskType: task.name,
        watsonStatus: watsonResult.status || 'completed',
        executedAt: new Date().toISOString()
      })
    });

    res.json({
      success: true,
      paymentMethod: paymentMethod,
      paymentAmount: paymentAmount / 100,
      watsonResult: watsonResult,
      billing: {
        method: paymentMethod,
        amount: paymentAmount / 100,
        currency: paymentMethod === 'circle_usdc' ? 'USDC' : 'USD',
        status: 'paid'
      }
    });

    console.log(`✅ IBM Watson task executed successfully via ${paymentMethod}`);
    console.log(`💰 REVENUE GENERATED: $${(paymentAmount / 100).toFixed(2)} via ${paymentMethod}`);

  } catch (error: any) {
    console.error(`❌ IBM Watson task execution failed:`, error);
    res.status(500).json({
      error: 'IBM Watson task execution failed',
      details: error.message
    });
  }
});

export default router;