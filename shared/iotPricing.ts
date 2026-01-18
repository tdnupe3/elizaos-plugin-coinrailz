/**
 * IoT Payments Pricing Configuration
 * 
 * Production pricing for IoT credits, fees, and packs
 * 
 * Pricing Model (v1.1 - Competitive Volume Pricing):
 * - Base price: $0.005/event (50% reduction from launch)
 * - Volume tiers: 100k-1M @ $0.0025, 1M+ @ $0.001
 * - Premium events: unlock $0.05, stream $0.02
 * - D2D Transfer Fee: 2% + $0.02
 * - Credits purchased via Stripe, PayPal, or USDC on-chain
 */

// D2D Transfer Fee Structure
export const IOT_TRANSFER_FEE = {
  percentageFee: 0.02, // 2%
  flatFee: 0.02, // $0.02
  minFee: 0.02, // Minimum fee $0.02
  maxFee: 100.00, // Maximum fee $100
} as const;

// Calculate transfer fee
export function calculateTransferFee(amount: number): { fee: number; netAmount: number } {
  const percentagePart = amount * IOT_TRANSFER_FEE.percentageFee;
  const totalFee = Math.max(
    IOT_TRANSFER_FEE.minFee,
    Math.min(IOT_TRANSFER_FEE.maxFee, percentagePart + IOT_TRANSFER_FEE.flatFee)
  );
  const netAmount = Math.max(0, amount - totalFee);
  return { fee: Number(totalFee.toFixed(4)), netAmount: Number(netAmount.toFixed(4)) };
}

// Volume Pricing Tiers (per-event pricing based on monthly volume)
// Boundaries: standard 0-99,999, growth 100,000-999,999, scale 1,000,000+
export const IOT_VOLUME_TIERS = {
  standard: {
    name: "Standard",
    minEvents: 0,
    maxEvents: 99999, // 0-99,999 events
    pricePerEvent: 0.005, // $0.005 per event (base price)
    description: "0-99,999 events/month",
  },
  growth: {
    name: "Growth",
    minEvents: 100000, // 100k+
    maxEvents: 999999, // up to 999,999
    pricePerEvent: 0.0025, // $0.0025 per event (50% discount)
    description: "100k-999,999 events/month",
  },
  scale: {
    name: "Scale",
    minEvents: 1000000, // 1M+
    maxEvents: null, // Unlimited
    pricePerEvent: 0.001, // $0.001 per event (80% discount)
    description: "1M+ events/month",
  },
} as const;

export type IotVolumeTier = keyof typeof IOT_VOLUME_TIERS;

// Get pricing tier based on monthly event count
export function getVolumeTier(monthlyEvents: number): typeof IOT_VOLUME_TIERS[IotVolumeTier] {
  if (monthlyEvents >= 1000000) return IOT_VOLUME_TIERS.scale;
  if (monthlyEvents >= 100000) return IOT_VOLUME_TIERS.growth;
  return IOT_VOLUME_TIERS.standard;
}

// Calculate event cost based on volume tier
export function calculateEventCost(eventCount: number, monthlyVolume: number): number {
  const tier = getVolumeTier(monthlyVolume);
  return Number((eventCount * tier.pricePerEvent).toFixed(6));
}

// Credits Pack Definitions (updated for v1.1 pricing - 2x credits at same price)
export const IOT_CREDITS_PACKS = {
  starter_25: {
    id: "starter_25",
    name: "Starter Pack",
    priceUSD: 25.00,
    credits: 5000, // $0.005 per credit (2x more than before)
    perCreditPrice: 0.005,
    discount: 0,
    description: "5,000 credits for small deployments",
    stripePriceId: null, // Set after Stripe product creation
    paypalPlanId: null, // Set after PayPal product creation
  },
  growth_100: {
    id: "growth_100",
    name: "Growth Pack",
    priceUSD: 100.00,
    credits: 25000, // ~$0.004 per credit (20% discount)
    perCreditPrice: 0.004,
    discount: 0.20,
    description: "25,000 credits with 20% volume discount",
    stripePriceId: null,
    paypalPlanId: null,
  },
  enterprise_500: {
    id: "enterprise_500",
    name: "Enterprise Pack",
    priceUSD: 500.00,
    credits: 200000, // $0.0025 per credit (50% discount)
    perCreditPrice: 0.0025,
    discount: 0.50,
    description: "200,000 credits with 50% enterprise discount",
    stripePriceId: null,
    paypalPlanId: null,
  },
} as const;

export type IotCreditsPackId = keyof typeof IOT_CREDITS_PACKS;

// Billable Event Types (v1.1 pricing - 50% reduction on standard events)
export const IOT_EVENT_TYPES = {
  message: { name: "Message", defaultUnitPrice: 0.005, tier: "standard" },
  data_access: { name: "Data Access", defaultUnitPrice: 0.005, tier: "standard" },
  unlock: { name: "Unlock/Access", defaultUnitPrice: 0.05, tier: "premium" }, // Kept at premium rate
  stream_minute: { name: "Stream Minute", defaultUnitPrice: 0.02, tier: "premium" }, // Kept at premium rate
  sensor_reading: { name: "Sensor Reading", defaultUnitPrice: 0.005, tier: "standard" },
  api_call: { name: "API Call", defaultUnitPrice: 0.005, tier: "standard" },
  compute_second: { name: "Compute Second", defaultUnitPrice: 0.0005, tier: "micro" },
  storage_mb: { name: "Storage MB", defaultUnitPrice: 0.0005, tier: "micro" },
} as const;

export type IotEventType = keyof typeof IOT_EVENT_TYPES;

// Account Tiers
export const IOT_ACCOUNT_TIERS = {
  starter: {
    name: "Starter",
    monthlyMinimum: 0,
    transferFeeDiscount: 0,
    maxDevices: 10,
    supportLevel: "community",
  },
  growth: {
    name: "Growth",
    monthlyMinimum: 49,
    transferFeeDiscount: 0.10, // 10% off fees
    maxDevices: 100,
    supportLevel: "email",
  },
  enterprise: {
    name: "Enterprise",
    monthlyMinimum: 499,
    transferFeeDiscount: 0.25, // 25% off fees
    maxDevices: null, // Unlimited
    supportLevel: "dedicated",
  },
} as const;

export type IotAccountTier = keyof typeof IOT_ACCOUNT_TIERS;

// Validate pack ID
export function isValidPackId(packId: string): packId is IotCreditsPackId {
  return packId in IOT_CREDITS_PACKS;
}

// Get pack by ID
export function getPackById(packId: IotCreditsPackId) {
  return IOT_CREDITS_PACKS[packId];
}

// Get event pricing
export function getEventPricing(eventType: IotEventType, customPrice?: number) {
  const base = IOT_EVENT_TYPES[eventType];
  return {
    type: eventType,
    name: base.name,
    unitPrice: customPrice ?? base.defaultUnitPrice,
  };
}
