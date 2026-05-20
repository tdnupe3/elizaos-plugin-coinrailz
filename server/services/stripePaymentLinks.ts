/**
 * Stripe Payment Links for Immediate Revenue Generation
 * Creates hosted payment links for CoinRailz AI Agent SDK services
 */
import { stripe } from './stripeClient';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}


export interface ServiceOffering {
  id: string;
  name: string;
  price: number; // in USD
  description: string;
  features: string[];
}

export const SERVICE_OFFERINGS: ServiceOffering[] = [
  {
    id: 'sdk-starter-kit',
    name: 'AI Agent SDK Starter Kit',
    price: 49,
    description: 'Get started with our competitive payment SDK',
    features: [
      'Complete SDK documentation and examples',
      'Basic integration guide',
      'Email support for setup questions',
      '0.99%-1.75% processing fees (vs 2.9% Stripe)',
      'USDC and Circle integration templates'
    ]
  },
  {
    id: 'guided-setup',
    name: 'Guided SDK Setup Call',
    price: 299,
    description: '1-hour live setup session with our team',
    features: [
      'Everything in Starter Kit',
      '60-minute screen-share setup session',
      'Custom integration for your AI agent',
      'Testing and troubleshooting included',
      'Priority support for 30 days'
    ]
  },
  {
    id: 'done-for-you',
    name: 'Done-For-You Integration',
    price: 999,
    description: 'Complete payment system implementation',
    features: [
      'Everything in Guided Setup',
      'Full payment system implementation',
      'Custom dashboard and analytics',
      'Webhook setup and testing',
      'Production deployment support',
      '90-day priority support and maintenance'
    ]
  }
];

export class StripePaymentLinksService {
  private stripe: Stripe;
  private paymentLinks: Map<string, string> = new Map(); // Cache payment links

  constructor() {
    this.stripe = stripe;
  }

  /**
   * Create or retrieve payment link for a service offering
   */
  async getPaymentLink(serviceId: string): Promise<string | null> {
    // Return cached link if exists
    if (this.paymentLinks.has(serviceId)) {
      return this.paymentLinks.get(serviceId)!;
    }

    const service = SERVICE_OFFERINGS.find(s => s.id === serviceId);
    if (!service) {
      console.error(`Service not found: ${serviceId}`);
      return null;
    }

    try {
      // Create Stripe product if it doesn't exist
      const products = await this.stripe.products.list({
        active: true,
        limit: 100
      });

      let product = products.data.find(p => p.metadata.serviceId === serviceId);

      if (!product) {
        product = await this.stripe.products.create({
          name: service.name,
          description: service.description,
          metadata: {
            serviceId: service.id,
            createdBy: 'coinrailz-automated'
          }
        });
        console.log(`✅ Created Stripe product: ${product.name}`);
      }

      // Create price for the product
      const prices = await this.stripe.prices.list({
        product: product.id,
        active: true
      });

      let price = prices.data.find(p => p.unit_amount === service.price * 100);

      if (!price) {
        price = await this.stripe.prices.create({
          product: product.id,
          unit_amount: service.price * 100, // Convert to cents
          currency: 'usd',
          metadata: {
            serviceId: service.id
          }
        });
        console.log(`✅ Created Stripe price: $${service.price} for ${service.name}`);
      }

      // Create payment link
      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [{
          price: price.id,
          quantity: 1,
        }],
        metadata: {
          serviceId: service.id,
          createdBy: 'coinrailz-automated'
        },
        after_completion: {
          type: 'hosted_confirmation',
          hosted_confirmation: {
            custom_message: `Thank you for purchasing ${service.name}! You'll receive setup instructions via email within 24 hours.`
          }
        }
      });

      // Cache the payment link
      this.paymentLinks.set(serviceId, paymentLink.url);
      
      console.log(`✅ Created payment link for ${service.name}: ${paymentLink.url}`);
      return paymentLink.url;

    } catch (error) {
      console.error(`❌ Failed to create payment link for ${serviceId}:`, error);
      return null;
    }
  }

  /**
   * Create all payment links at once
   */
  async createAllPaymentLinks(): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    for (const service of SERVICE_OFFERINGS) {
      const link = await this.getPaymentLink(service.id);
      if (link) {
        results[service.id] = link;
      }
    }

    return results;
  }

  /**
   * Get all service offerings with their payment links
   */
  async getAllOfferings(): Promise<Array<ServiceOffering & { paymentLink?: string }>> {
    const offerings = [];

    for (const service of SERVICE_OFFERINGS) {
      const paymentLink = await this.getPaymentLink(service.id);
      offerings.push({
        ...service,
        paymentLink: paymentLink || undefined
      });
    }

    return offerings;
  }
}

// Export singleton instance
export const stripePaymentService = new StripePaymentLinksService();