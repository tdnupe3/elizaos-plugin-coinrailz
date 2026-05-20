/**
 * STRIPE PAYMENT SERVICE FOR SDK LICENSES
 * Real payment processing for $2K-$200K enterprise license purchases
 */

import { stripe } from './stripeClient';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sdkLicenseSubscriptions, sdkLicenseTiers } from '../../shared/schema';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}


export class StripeLicensePaymentService {
  
  /**
   * Create Stripe payment intent for SDK license purchase
   */
  static async createLicensePaymentIntent(
    licenseId: number,
    amount: number,
    currency: string = 'usd',
    metadata: Record<string, string> = {}
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      console.log(`💳 Creating Stripe payment intent for license ${licenseId}: $${amount}`);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          licenseId: licenseId.toString(),
          type: 'sdk_license',
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      console.log(`✅ Payment intent created: ${paymentIntent.id}`);
      
      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id
      };
      
    } catch (error: any) {
      console.error('❌ Failed to create payment intent:', error);
      throw new Error(`Payment intent creation failed: ${error.message}`);
    }
  }

  /**
   * Create Stripe subscription for recurring license billing
   */
  static async createLicenseSubscription(
    licenseId: number,
    customerEmail: string,
    customerName: string,
    priceId: string,
    metadata: Record<string, string> = {}
  ): Promise<{ clientSecret: string; subscriptionId: string; customerId: string }> {
    try {
      console.log(`🔄 Creating Stripe subscription for license ${licenseId}`);
      
      // Create or get customer
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: {
          licenseId: licenseId.toString(),
          type: 'sdk_license_customer'
        }
      });

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: priceId,
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          licenseId: licenseId.toString(),
          type: 'sdk_license',
          ...metadata
        }
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent;

      console.log(`✅ Subscription created: ${subscription.id}`);
      
      return {
        clientSecret: paymentIntent.client_secret!,
        subscriptionId: subscription.id,
        customerId: customer.id
      };
      
    } catch (error: any) {
      console.error('❌ Failed to create subscription:', error);
      throw new Error(`Subscription creation failed: ${error.message}`);
    }
  }

  /**
   * Handle successful payment and activate license
   */
  static async activateLicenseAfterPayment(paymentIntentId: string): Promise<boolean> {
    try {
      console.log(`🔄 Processing payment confirmation: ${paymentIntentId}`);
      
      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        console.log(`⚠️ Payment not successful: ${paymentIntent.status}`);
        return false;
      }

      const licenseId = parseInt(paymentIntent.metadata.licenseId);
      if (!licenseId) {
        console.error('❌ No license ID in payment metadata');
        return false;
      }

      // Activate the license
      const result = await db
        .update(sdkLicenseSubscriptions)
        .set({ 
          status: 'active',
          stripeCustomerId: paymentIntent.customer as string,
          // Store payment reference for tracking
          totalLifetimeRevenue: (paymentIntent.amount / 100).toString() // Convert from cents to string
        })
        .where(eq(sdkLicenseSubscriptions.id, licenseId))
        .returning({ 
          id: sdkLicenseSubscriptions.id,
          companyName: sdkLicenseSubscriptions.companyName 
        });

      if (result.length === 0) {
        console.error(`❌ License ${licenseId} not found for activation`);
        return false;
      }

      console.log(`✅ License ${licenseId} activated for ${result[0].companyName}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to activate license after payment:', error);
      return false;
    }
  }

  /**
   * Handle subscription payment success
   */
  static async activateLicenseAfterSubscription(subscriptionId: string): Promise<boolean> {
    try {
      console.log(`🔄 Processing subscription activation: ${subscriptionId}`);
      
      // Retrieve subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (subscription.status !== 'active') {
        console.log(`⚠️ Subscription not active: ${subscription.status}`);
        return false;
      }

      const licenseId = parseInt(subscription.metadata.licenseId);
      if (!licenseId) {
        console.error('❌ No license ID in subscription metadata');
        return false;
      }

      // Activate the license
      const result = await db
        .update(sdkLicenseSubscriptions)
        .set({ 
          status: 'active',
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id
        })
        .where(eq(sdkLicenseSubscriptions.id, licenseId))
        .returning({ 
          id: sdkLicenseSubscriptions.id,
          companyName: sdkLicenseSubscriptions.companyName 
        });

      if (result.length === 0) {
        console.error(`❌ License ${licenseId} not found for activation`);
        return false;
      }

      console.log(`✅ License ${licenseId} activated via subscription for ${result[0].companyName}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to activate license after subscription:', error);
      return false;
    }
  }

  /**
   * Create Stripe products and prices for license tiers
   */
  static async createLicenseProducts(): Promise<void> {
    try {
      console.log('🏭 Creating Stripe products for license tiers...');
      
      // Get license tiers from database
      const tiers = await db
        .select()
        .from(sdkLicenseTiers)
        .where(eq(sdkLicenseTiers.isActive, true));

      for (const tier of tiers) {
        console.log(`📦 Creating product for ${tier.name} tier...`);
        
        // Create product
        const product = await stripe.products.create({
          name: `${tier.name} SDK License`,
          description: tier.description || `${tier.name} tier SDK license for AI payment infrastructure`,
          metadata: {
            tierId: tier.id.toString(),
            tierName: tier.name,
            type: 'sdk_license'
          }
        });

        // Create yearly price
        const yearlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(Number(tier.yearlyPrice) * 100), // Convert to cents
          currency: 'usd',
          recurring: {
            interval: 'year',
          },
          metadata: {
            tierId: tier.id.toString(),
            billing: 'yearly'
          }
        });

        // Create monthly price
        const monthlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(Number(tier.monthlyPrice) * 100), // Convert to cents
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
          metadata: {
            tierId: tier.id.toString(),
            billing: 'monthly'
          }
        });

        console.log(`✅ Created ${tier.name}: Product ${product.id}, Yearly ${yearlyPrice.id}, Monthly ${monthlyPrice.id}`);
      }
      
      console.log('✅ All Stripe products created successfully');
      
    } catch (error) {
      console.error('❌ Failed to create Stripe products:', error);
      throw error;
    }
  }

  /**
   * Get Stripe price ID for a tier and billing cycle
   */
  static async getStripePriceId(tierId: number, billingCycle: 'monthly' | 'yearly'): Promise<string | null> {
    try {
      // Search for prices with matching metadata
      const prices = await stripe.prices.list({
        limit: 100,
        expand: ['data.product']
      });

      const matchingPrice = prices.data.find(price => 
        price.metadata.tierId === tierId.toString() && 
        price.metadata.billing === billingCycle
      );

      return matchingPrice?.id || null;
      
    } catch (error) {
      console.error('❌ Failed to find Stripe price:', error);
      return null;
    }
  }
}

export default StripeLicensePaymentService;