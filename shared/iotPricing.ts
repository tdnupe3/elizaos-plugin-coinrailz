/**
 * IoT Payments Pricing Configuration
 * 
 * Production pricing for IoT credits, fees, and packs
 * 
 * Pricing Model:
 * - 1 credit = $0.01 USD = 1 billable event
 * - D2D Transfer Fee: 2% + $0.02
 * - Credits purchased via Stripe or USDC on-chain
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

// Credits Pack Definitions
export const IOT_CREDITS_PACKS = {
  starter_25: {
    id: "starter_25",
    name: "Starter Pack",
    priceUSD: 25.00,
    credits: 2500, // $0.01 per credit
    perCreditPrice: 0.01,
    discount: 0,
    description: "2,500 credits for small deployments",
    stripePriceId: null, // Set after Stripe product creation
  },
  growth_100: {
    id: "growth_100",
    name: "Growth Pack",
    priceUSD: 100.00,
    credits: 12000, // ~$0.0083 per credit (17% discount)
    perCreditPrice: 0.00833,
    discount: 0.17,
    description: "12,000 credits with 17% discount",
    stripePriceId: null,
  },
  enterprise_500: {
    id: "enterprise_500",
    name: "Enterprise Pack",
    priceUSD: 500.00,
    credits: 75000, // ~$0.0067 per credit (33% discount)
    perCreditPrice: 0.00667,
    discount: 0.33,
    description: "75,000 credits with 33% discount",
    stripePriceId: null,
  },
} as const;

export type IotCreditsPackId = keyof typeof IOT_CREDITS_PACKS;

// Billable Event Types
export const IOT_EVENT_TYPES = {
  message: { name: "Message", defaultUnitPrice: 0.01 },
  data_access: { name: "Data Access", defaultUnitPrice: 0.01 },
  unlock: { name: "Unlock/Access", defaultUnitPrice: 0.05 },
  stream_minute: { name: "Stream Minute", defaultUnitPrice: 0.02 },
  sensor_reading: { name: "Sensor Reading", defaultUnitPrice: 0.01 },
  api_call: { name: "API Call", defaultUnitPrice: 0.01 },
  compute_second: { name: "Compute Second", defaultUnitPrice: 0.001 },
  storage_mb: { name: "Storage MB", defaultUnitPrice: 0.001 },
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
