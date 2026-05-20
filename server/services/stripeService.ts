/**
 * Stripe Payment Service
 * Handles credit/debit card processing for P2P transfers
 */

import type Stripe from 'stripe';
import { stripe as stripeClient } from './stripeClient';
import { env } from '../environment';

interface PaymentIntentData {
  amount: number; // in cents
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
}

class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = stripeClient;
  }

  async testAuthentication(): Promise<boolean> {
    try {
      await this.stripe.balance.retrieve();
      return true;
    } catch (error) {
      console.error('Stripe authentication failed:', error);
      return false;
    }
  }

  async createPaymentIntent(data: PaymentIntentData): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount), // Ensure integer cents
        currency: data.currency.toLowerCase(),
        description: data.description,
        metadata: data.metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Failed to confirm payment intent:', error);
      throw new Error('Failed to confirm payment');
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Failed to retrieve payment intent:', error);
      throw new Error('Failed to retrieve payment intent');
    }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Failed to cancel payment intent:', error);
      throw new Error('Failed to cancel payment intent');
    }
  }

  async createTransfer(data: {
    amount: number; // in cents
    destination: string; // Stripe account ID for recipient
    description?: string;
  }): Promise<Stripe.Transfer> {
    try {
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(data.amount),
        currency: 'usd',
        destination: data.destination,
        description: data.description,
      });

      return transfer;
    } catch (error) {
      console.error('Failed to create transfer:', error);
      throw new Error('Failed to create transfer');
    }
  }

  async getAccountInfo(): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.retrieve();
      return account;
    } catch (error) {
      console.error('Failed to retrieve account info:', error);
      throw new Error('Failed to retrieve account info');
    }
  }

  isConfigured(): boolean {
    return !!(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY);
  }

  getPublishableKey(): string {
    return env.STRIPE_PUBLISHABLE_KEY || '';
  }
}

export const stripeService = new StripeService();