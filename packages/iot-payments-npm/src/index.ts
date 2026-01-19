/**
 * @coinrailz/iot-payments v1.1.0
 * 
 * IoT Payments SDK - Device-to-device payments, metering, credits,
 * and A2D (Agent-to-Device) data monetization for IoT/DePIN networks.
 * 
 * Features:
 * - Device registration and account management
 * - Credits-based metering (pay-per-event) - $0.005/event with volume tiers
 * - D2D transfers with 2% + $0.02 fee
 * - USDC on-chain payments
 * - Stripe/PayPal integration for topups
 * - A2D: Monetize device data for AI agents via x402 protocol
 * 
 * @example
 * ```typescript
 * import { CoinRailzIoT } from '@coinrailz/iot-payments';
 * 
 * const iot = new CoinRailzIoT({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://coinrailz.com'
 * });
 * 
 * // Create account
 * const account = await iot.createAccount({ accountName: 'My Fleet' });
 * 
 * // Register device
 * const device = await iot.registerDevice({
 *   deviceId: 'sensor-001',
 *   accountId: account.id
 * });
 * 
 * // Meter a billable event
 * await iot.chargePerMessage('sensor-001', 'temperature/readings');
 * 
 * // D2D transfer
 * await iot.transfer({
 *   fromDeviceId: 'sensor-001',
 *   toDeviceId: 'gateway-001',
 *   amount: 0.50
 * });
 * 
 * // A2D: Create a data product for AI agents
 * const product = await iot.createProduct({
 *   deviceId: 'sensor-001',
 *   productName: 'Temperature Data',
 *   productType: 'sensor_reading',
 *   priceUsd: 0.10,
 *   unit: 'reading'
 * });
 * // AI agents discover via browseCatalog() and pay via x402
 * ```
 */

export interface IoTConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface CreateAccountInput {
  accountName: string;
  ownerId?: string;
  ownerWallet?: string;
  tier?: 'starter' | 'growth' | 'enterprise';
  metadata?: Record<string, any>;
}

export interface RegisterDeviceInput {
  deviceId: string;
  accountId: string;
  deviceName?: string;
  deviceType?: 'iot_device' | 'sensor' | 'gateway' | 'actuator' | 'ai_agent';
  walletAddress?: string;
  chain?: 'base-mainnet' | 'ethereum-mainnet' | 'polygon-mainnet' | 'arbitrum-mainnet' | 'solana-mainnet';
  spendingLimit?: number;
  canReceivePayments?: boolean;
  canSendPayments?: boolean;
  metadata?: Record<string, any>;
}

export interface MeterEventInput {
  deviceId: string;
  eventType: 'message' | 'data_access' | 'unlock' | 'stream_minute' | 'sensor_reading' | 'api_call' | 'compute_second' | 'storage_mb';
  units?: number;
  unitPrice?: number;
  topic?: string;
  payload?: Record<string, any>;
  serviceId?: string;
  idempotencyKey?: string;
}

export interface TransferInput {
  fromDeviceId: string;
  toDeviceId?: string;
  toWallet?: string;
  amount: number;
  paymentMethod?: 'credits' | 'usdc_onchain';
  chain?: string;
  purpose?: string;
  reference?: string;
  idempotencyKey?: string;
}

export interface TopupInput {
  accountId: string;
  packId: 'starter_25' | 'growth_100' | 'enterprise_500';
  paymentMethod: 'stripe' | 'paypal';
  stripePaymentMethodId?: string;
  paypalOrderId?: string; // For capturing an approved PayPal order
}

// === A2D (Agent-to-Device) Interfaces ===

export interface CreateProductInput {
  deviceId: string;
  productName: string;
  productType: 'sensor_reading' | 'stream' | 'api_call' | 'bulk_data';
  description?: string;
  priceUsd: number;
  unit?: 'request' | 'minute' | 'mb' | 'reading';
  deliveryMode?: 'pull' | 'stream';
  expectedNetwork?: 'base' | 'ethereum' | 'polygon' | 'arbitrum';
  dataSchema?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateProductInput {
  productName?: string;
  description?: string;
  priceUsd?: number;
  status?: 'active' | 'paused' | 'deprecated';
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface DataProduct {
  id: string;
  deviceId: string;
  productName: string;
  productType: string;
  priceUsd: number;
  unit: string;
  deliveryMode: string;
  expectedNetwork: string;
  x402ServiceId: string;
  x402Endpoint: string;
  status: string;
}

export interface DataSale {
  id: string;
  productId: string;
  deviceId: string;
  amount: number;
  platformFee: number;
  sellerCredit: number;
  units: number;
  status: string;
  createdAt: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  type: string;
  description: string;
  priceUsd: number;
  unit: string;
  expectedNetwork: string;
  tags: string[];
  endpoint: string;
  totalSales: number;
}

export interface IoTAccount {
  id: string;
  accountName: string;
  tier: string;
  creditsBalance: number;
  status: string;
}

export interface IoTDevice {
  id: string;
  deviceId: string;
  accountId: string;
  deviceType: string;
  status: string;
}

export interface BalanceInfo {
  deviceId: string;
  accountId: string;
  balance: number;
  balanceFormatted: string;
  spendingLimit: number | null;
  todaySpent: number;
  canSendPayments: boolean;
  canReceivePayments: boolean;
}

export interface MeterResult {
  id: string;
  deviceId: string;
  eventType: string;
  units: number;
  unitPrice: number;
  totalCost: number;
  balanceAfter: number;
}

export interface TransferResult {
  id: string;
  fromDeviceId: string;
  toDeviceId: string | null;
  toWallet: string | null;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  paymentMethod: string;
  status: string;
}

// v1.1 Pricing - 50% reduction on base pricing, volume discounts available
export const CREDITS_PACKS = {
  starter_25: { priceUSD: 25, credits: 5000, perCreditPrice: 0.005, creditsValueUSD: 25 },
  growth_100: { priceUSD: 100, credits: 25000, perCreditPrice: 0.004, creditsValueUSD: 100, discount: 0.20 },
  enterprise_500: { priceUSD: 500, credits: 200000, perCreditPrice: 0.0025, creditsValueUSD: 500, discount: 0.50 },
} as const;

// Volume pricing tiers (based on monthly event count)
// Boundaries: standard 0-99,999, growth 100,000-999,999, scale 1,000,000+
export const VOLUME_TIERS = {
  standard: { minEvents: 0, maxEvents: 99999, pricePerEvent: 0.005 },
  growth: { minEvents: 100000, maxEvents: 999999, pricePerEvent: 0.0025 },
  scale: { minEvents: 1000000, maxEvents: null, pricePerEvent: 0.001 },
} as const;

export const EVENT_TYPES = {
  message: { name: 'Message', defaultPrice: 0.005, tier: 'standard' },
  data_access: { name: 'Data Access', defaultPrice: 0.005, tier: 'standard' },
  unlock: { name: 'Unlock/Access', defaultPrice: 0.05, tier: 'premium' },
  stream_minute: { name: 'Stream Minute', defaultPrice: 0.02, tier: 'premium' },
  sensor_reading: { name: 'Sensor Reading', defaultPrice: 0.005, tier: 'standard' },
  api_call: { name: 'API Call', defaultPrice: 0.005, tier: 'standard' },
  compute_second: { name: 'Compute Second', defaultPrice: 0.0005, tier: 'micro' },
  storage_mb: { name: 'Storage MB', defaultPrice: 0.0005, tier: 'micro' },
} as const;

// Get volume tier based on monthly event count
export function getVolumeTier(monthlyEvents: number) {
  if (monthlyEvents >= 1000000) return VOLUME_TIERS.scale;
  if (monthlyEvents >= 100000) return VOLUME_TIERS.growth;
  return VOLUME_TIERS.standard;
}

export const TRANSFER_FEE = {
  percentage: 0.02, // 2%
  flat: 0.02, // $0.02
  minFee: 0.02, // minimum fee
} as const;

export const MIN_TRANSFER_AMOUNT = 0.05; // $0.05 minimum transfer

export function calculateTransferFee(amount: number): { fee: number; netAmount: number } {
  const fee = Math.max(TRANSFER_FEE.minFee, amount * TRANSFER_FEE.percentage + TRANSFER_FEE.flat);
  const netAmount = Math.max(0, amount - fee);
  return { fee: Number(fee.toFixed(4)), netAmount: Number(netAmount.toFixed(4)) };
}

export class CoinRailzIoT {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: IoTConfig = {}) {
    this.apiKey = config.apiKey || process.env.COINRAILZ_API_KEY || '';
    this.baseUrl = config.baseUrl || process.env.COINRAILZ_BASE_URL || 'https://coinrailz.com';
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  async health(): Promise<any> {
    return this.request('GET', '/api/iot/health');
  }

  async createAccount(input: CreateAccountInput): Promise<{ account: IoTAccount; apiKey: string; apiKeyWarning: string }> {
    return this.request('POST', '/api/iot/account', input);
  }

  async rotateApiKey(accountId: string): Promise<{ apiKey: string; apiKeyWarning: string; accountId: string }> {
    return this.request('POST', `/api/iot/account/${accountId}/rotate-key`, {});
  }

  async getAccount(accountId: string): Promise<{ account: IoTAccount; devices: IoTDevice[] }> {
    return this.request('GET', `/api/iot/account/${accountId}`);
  }

  async registerDevice(input: RegisterDeviceInput): Promise<{ device: IoTDevice }> {
    return this.request('POST', '/api/iot/register', input);
  }

  async getBalance(deviceId: string): Promise<BalanceInfo> {
    const result = await this.request<any>('GET', `/api/iot/balance/${deviceId}`);
    return result;
  }

  async meter(input: MeterEventInput): Promise<{ event: MeterResult }> {
    return this.request('POST', '/api/iot/meter', input);
  }

  async chargePerMessage(deviceId: string, topic?: string, units: number = 1): Promise<{ event: MeterResult }> {
    return this.meter({
      deviceId,
      eventType: 'message',
      units,
      topic,
    });
  }

  async chargePerMinute(deviceId: string, streamId?: string, minutes: number = 1): Promise<{ event: MeterResult }> {
    return this.meter({
      deviceId,
      eventType: 'stream_minute',
      units: minutes,
      topic: streamId,
    });
  }

  async chargeForData(deviceId: string, bytes: number): Promise<{ event: MeterResult }> {
    const mb = Math.ceil(bytes / (1024 * 1024));
    return this.meter({
      deviceId,
      eventType: 'storage_mb',
      units: mb,
    });
  }

  async chargeForSensorReading(deviceId: string, readings: number = 1, topic?: string): Promise<{ event: MeterResult }> {
    return this.meter({
      deviceId,
      eventType: 'sensor_reading',
      units: readings,
      topic,
    });
  }

  async transfer(input: TransferInput): Promise<{ transfer: TransferResult }> {
    return this.request('POST', '/api/iot/transfer', {
      ...input,
      paymentMethod: input.paymentMethod || 'credits',
    });
  }

  async topup(input: TopupInput): Promise<any> {
    return this.request('POST', '/api/iot/topup', input);
  }

  async getTransactions(deviceId: string, limit: number = 50, offset: number = 0): Promise<any> {
    return this.request('GET', `/api/iot/transactions/${deviceId}?limit=${limit}&offset=${offset}`);
  }

  async getPacks(): Promise<any> {
    return this.request('GET', '/api/iot/packs');
  }

  // === A2D (Agent-to-Device) Methods ===
  // Enable devices to monetize their data for AI agents via x402 protocol

  /**
   * Create a data product that AI agents can purchase via x402
   * @example
   * const product = await iot.createProduct({
   *   deviceId: 'sensor-001',
   *   productName: 'Temperature Data',
   *   productType: 'sensor_reading',
   *   priceUsd: 0.10,
   *   unit: 'reading'
   * });
   */
  async createProduct(input: CreateProductInput): Promise<{ product: DataProduct }> {
    return this.request('POST', '/api/iot/products', input);
  }

  /**
   * Get product details by ID
   */
  async getProduct(productId: string): Promise<{ product: DataProduct }> {
    return this.request('GET', `/api/iot/products/${productId}`);
  }

  /**
   * List all products for a device
   */
  async getDeviceProducts(deviceId: string): Promise<{ products: DataProduct[] }> {
    return this.request('GET', `/api/iot/products/device/${deviceId}`);
  }

  /**
   * Update a product's settings
   */
  async updateProduct(productId: string, input: UpdateProductInput): Promise<{ product: DataProduct }> {
    return this.request('PATCH', `/api/iot/products/${productId}`, input);
  }

  /**
   * Get sales history for an account (seller view)
   */
  async getSales(accountId: string, limit: number = 50, offset: number = 0): Promise<{ sales: DataSale[]; count: number }> {
    return this.request('GET', `/api/iot/sales/${accountId}?limit=${limit}&offset=${offset}`);
  }

  /**
   * Browse available data products from all devices (AI agent discovery)
   * No authentication required - public catalog
   */
  async browseCatalog(): Promise<{ catalog: CatalogItem[]; count: number }> {
    return this.request('GET', '/api/iot/catalog');
  }
}

export default CoinRailzIoT;
