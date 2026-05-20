/**
 * Instant Payment Service - Streamlined Data Product Purchasing
 * Focuses on security, accuracy guarantees, and simple payment flow
 */

import { stripe } from './stripeClient';
import { db } from '../db';
import { apiUsageTracking } from '../../shared/schema';


export interface DataProductPurchase {
  customerEmail: string;
  productType: 'credit_scoring' | 'market_intelligence' | 'risk_assessment' | 'bulk_data';
  monthlyQueries: number;
  agreedPrice: number;
  customerName?: string;
  companyName?: string;
}

export interface PaymentSession {
  sessionId: string;
  paymentUrl: string;
  apiKey: string;
  trialQueries: number;
  productDetails: {
    name: string;
    pricePerQuery: number;
    accuracyGuarantee: string;
    securityLevel: string;
    features: string[];
  };
}

export class InstantPaymentService {
  
  /**
   * Create instant payment session with trial access
   */
  static async createPaymentSession(purchase: DataProductPurchase): Promise<PaymentSession> {
    try {
      // Generate API key immediately for trial access
      const apiKey = `CRZ_${Date.now()}_${Math.random().toString(36).substr(2, 12).toUpperCase()}`;
      
      // Get product details with updated pricing
      const productDetails = this.getProductDetails(purchase.productType);
      
      // Calculate monthly cost
      const monthlyTotal = purchase.monthlyQueries * purchase.agreedPrice;
      
      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: purchase.customerEmail,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${productDetails.name} - Premium Data Access`,
                description: `${purchase.monthlyQueries} queries/month • ${productDetails.accuracyGuarantee} accuracy • ${productDetails.securityLevel}`,
                images: ['https://your-platform.com/data-security-badge.png'],
              },
              unit_amount: Math.round(monthlyTotal * 100), // Convert to cents
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          apiKey,
          productType: purchase.productType,
          monthlyQueries: purchase.monthlyQueries.toString(),
          pricePerQuery: purchase.agreedPrice.toString(),
          customerEmail: purchase.customerEmail,
          companyName: purchase.companyName || 'Individual',
        },
        mode: 'subscription',
        success_url: `https://your-platform.com/data-access-activated?session_id={CHECKOUT_SESSION_ID}&api_key=${apiKey}`,
        cancel_url: 'https://your-platform.com/checkout-cancelled',
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            apiKey,
            productType: purchase.productType,
          },
        },
      });
      
      // Store trial API access immediately
      await this.setupTrialAccess(apiKey, purchase);
      
      return {
        sessionId: session.id,
        paymentUrl: session.url!,
        apiKey,
        trialQueries: 100,
        productDetails
      };
      
    } catch (error: any) {
      console.error('Payment session creation failed:', error);
      throw new Error(`Payment setup failed: ${error.message}`);
    }
  }
  
  /**
   * Get product details with security and accuracy focus
   */
  private static getProductDetails(productType: string) {
    const products = {
      credit_scoring: {
        name: 'Credit Scoring API',
        pricePerQuery: 1.49,
        accuracyGuarantee: '92%',
        securityLevel: 'Bank-grade encryption',
        features: [
          'Real-time creditworthiness assessment',
          'Alternative data signals from transaction patterns',
          'Regulatory compliance built-in',
          'Encrypted data transmission',
          'Audit trail for all queries'
        ]
      },
      market_intelligence: {
        name: 'Market Intelligence API',
        pricePerQuery: 2.49,
        accuracyGuarantee: '89%',
        securityLevel: 'Enterprise security',
        features: [
          'Live cross-chain transaction flows',
          '30-second data updates',
          'Multi-currency sentiment analysis',
          'Encrypted real-time feeds',
          'Institutional-grade data quality'
        ]
      },
      risk_assessment: {
        name: 'Risk Assessment API',
        pricePerQuery: 1.89,
        accuracyGuarantee: '94%',
        securityLevel: 'Military-grade encryption',
        features: [
          'Real-time fraud detection',
          'AML compliance scoring',
          'Behavioral pattern recognition',
          'Regulatory audit trail',
          'Zero-knowledge data processing'
        ]
      },
      bulk_data: {
        name: 'Bulk Data Exports',
        pricePerQuery: 75.00,
        accuracyGuarantee: '96%',
        securityLevel: 'Zero-trust architecture',
        features: [
          'Anonymized transaction insights',
          'Custom data packages',
          'Historical trend analysis',
          'Enterprise security protocols',
          'Privacy-first design'
        ]
      }
    };
    
    return products[productType as keyof typeof products] || products.risk_assessment;
  }
  
  /**
   * Setup immediate trial access
   */
  private static async setupTrialAccess(apiKey: string, purchase: DataProductPurchase): Promise<void> {
    try {
      // Create trial record in database
      const trialRecord = {
        clientId: apiKey,
        apiEndpoint: purchase.productType,
        requestMethod: 'TRIAL_SETUP',
        responseTime: 0,
        queryCount: 100, // Free trial queries
        revenue: 0,
        timestamp: new Date(),
        processedAt: new Date()
      };
      
      console.log('Setting up trial access:', {
        apiKey,
        productType: purchase.productType,
        trialQueries: 100,
        customerEmail: purchase.customerEmail
      });
      
      // Store trial access (would use actual database in production)
      
    } catch (error) {
      console.error('Trial setup failed:', error);
      throw new Error('Trial access setup failed');
    }
  }
  
  /**
   * Verify payment and activate full access
   */
  static async verifyPaymentAndActivate(sessionId: string): Promise<{
    success: boolean;
    apiKey?: string;
    subscriptionId?: string;
    activationDetails?: any;
  }> {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid') {
        const apiKey = session.metadata?.apiKey;
        const productType = session.metadata?.productType;
        
        // Activate full subscription access
        await this.activateFullAccess(apiKey!, productType!);
        
        return {
          success: true,
          apiKey,
          subscriptionId: session.subscription as string,
          activationDetails: {
            productType,
            monthlyQueries: parseInt(session.metadata?.monthlyQueries || '1000'),
            pricePerQuery: parseFloat(session.metadata?.pricePerQuery || '1.89'),
            securityLevel: this.getProductDetails(productType!).securityLevel,
            accuracyGuarantee: this.getProductDetails(productType!).accuracyGuarantee
          }
        };
      }
      
      return { success: false };
      
    } catch (error: any) {
      console.error('Payment verification failed:', error);
      return { success: false };
    }
  }
  
  /**
   * Activate full subscription access
   */
  private static async activateFullAccess(apiKey: string, productType: string): Promise<void> {
    try {
      console.log('Activating full access:', { apiKey, productType });
      
      // In production, this would:
      // 1. Remove trial limits
      // 2. Enable full API access
      // 3. Set up billing tracking
      // 4. Send welcome email with security details
      
    } catch (error) {
      console.error('Full access activation failed:', error);
      throw new Error('Subscription activation failed');
    }
  }
  
  /**
   * Create instant trial without payment (for immediate value demonstration)
   */
  static async createInstantTrial(customerEmail: string, productType: string): Promise<{
    apiKey: string;
    trialQueries: number;
    expiresAt: Date;
    securityFeatures: string[];
    accuracyGuarantee: string;
  }> {
    try {
      const apiKey = `TRIAL_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      const productDetails = this.getProductDetails(productType);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Setup trial access
      await this.setupTrialAccess(apiKey, { 
        customerEmail, 
        productType: productType as any, 
        monthlyQueries: 100, 
        agreedPrice: 0 
      });
      
      return {
        apiKey,
        trialQueries: 100,
        expiresAt,
        securityFeatures: productDetails.features,
        accuracyGuarantee: productDetails.accuracyGuarantee
      };
      
    } catch (error: any) {
      console.error('Instant trial creation failed:', error);
      throw new Error(`Trial setup failed: ${error.message}`);
    }
  }
  
  /**
   * Get customer payment status and usage analytics
   */
  static async getCustomerAnalytics(apiKey: string): Promise<{
    currentUsage: number;
    monthlyLimit: number;
    accuracyRate: number;
    securityEvents: number;
    costSavings: number;
  }> {
    try {
      // Mock analytics - in production would query actual usage data
      return {
        currentUsage: 342,
        monthlyLimit: 5000,
        accuracyRate: 0.94,
        securityEvents: 0, // No security incidents
        costSavings: 1250.00 // Savings vs competitor pricing
      };
    } catch (error) {
      console.error('Analytics retrieval failed:', error);
      throw new Error('Unable to retrieve usage analytics');
    }
  }
}