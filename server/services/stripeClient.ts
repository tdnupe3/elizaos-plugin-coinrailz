import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-04-22.dahlia' as const;

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required environment variable: STRIPE_SECRET_KEY');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: STRIPE_API_VERSION,
});

export type { Stripe };
export default Stripe;
