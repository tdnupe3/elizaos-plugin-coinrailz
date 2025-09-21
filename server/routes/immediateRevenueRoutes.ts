/**
 * Immediate Revenue Generation Routes
 * Creates real Stripe Payment Links for instant revenue
 */
import express from 'express';
import { stripePaymentService, SERVICE_OFFERINGS } from '../services/stripePaymentLinks';

const router = express.Router();

/**
 * Create all Stripe Payment Links for immediate revenue
 */
router.post('/revenue/create-payment-links', async (req, res) => {
  try {
    console.log('🚀 Creating Stripe Payment Links for immediate revenue...');
    
    const paymentLinks = await stripePaymentService.createAllPaymentLinks();
    
    const summary = {
      success: true,
      message: 'Payment links created successfully',
      paymentLinks,
      totalRevenuePotential: SERVICE_OFFERINGS.reduce((sum, service) => sum + service.price, 0),
      services: SERVICE_OFFERINGS.length,
      ready: true
    };

    console.log('✅ Payment links created:', paymentLinks);
    res.json(summary);
    
  } catch (error) {
    console.error('❌ Failed to create payment links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment links',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all service offerings with payment links
 */
router.get('/revenue/offerings', async (req, res) => {
  try {
    const offerings = await stripePaymentService.getAllOfferings();
    
    res.json({
      success: true,
      offerings,
      totalServices: offerings.length,
      readyToSell: offerings.filter(o => o.paymentLink).length
    });
    
  } catch (error) {
    console.error('❌ Failed to get offerings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get offerings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get specific payment link by service ID
 */
router.get('/revenue/payment-link/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const paymentLink = await stripePaymentService.getPaymentLink(serviceId);
    
    if (!paymentLink) {
      return res.status(404).json({
        success: false,
        error: 'Service not found or payment link creation failed'
      });
    }

    const service = SERVICE_OFFERINGS.find(s => s.id === serviceId);
    
    res.json({
      success: true,
      service,
      paymentLink,
      message: 'Payment link ready for immediate sales'
    });
    
  } catch (error) {
    console.error(`❌ Failed to get payment link for ${req.params.serviceId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment link',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test payment link creation with $1 charge
 */
router.post('/revenue/test-payment', async (req, res) => {
  try {
    // Create a $1 test product to verify Stripe is working
    const testService = {
      id: 'test-payment',
      name: 'Test Payment - $1 Verification',
      price: 1,
      description: 'Verify Stripe payment processing is working',
      features: ['Confirms payment system is operational']
    };

    // Temporarily add to service offerings for testing
    const originalOfferings = [...SERVICE_OFFERINGS];
    SERVICE_OFFERINGS.push(testService);
    
    const paymentLink = await stripePaymentService.getPaymentLink('test-payment');
    
    // Remove test service
    SERVICE_OFFERINGS.length = originalOfferings.length;
    
    if (paymentLink) {
      res.json({
        success: true,
        message: 'Test payment link created successfully',
        testPaymentLink: paymentLink,
        instructions: 'Visit this link to test $1 payment processing'
      });
    } else {
      throw new Error('Failed to create test payment link');
    }
    
  } catch (error) {
    console.error('❌ Test payment creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test payment creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;