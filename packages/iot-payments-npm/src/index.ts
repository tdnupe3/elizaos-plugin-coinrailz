/**
 * @coinrailz/iot-payments
 * 
 * IoT Payments SDK - Device-to-device payments, metering, and credits
 * for IoT devices and DePIN networks.
 * 
 * Features:
 * - Device registration and account management
 * - Credits-based metering (pay-per-event)
 * - D2D transfers with 2% + $0.02 fee
 * - USDC on-chain payments
 * - Stripe integration for topups
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
  paymentMethod: 'stripe';
  stripePaymentMethodId?: string;
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

export const CREDITS_PACKS = {
  starter_25: { priceUSD: 25, credits: 2500, perCreditPrice: 0.01, creditsValueUSD: 25 },
  growth_100: { priceUSD: 100, credits: 12000, perCreditPrice: 0.00833, creditsValueUSD: 99.96 },
  enterprise_500: { priceUSD: 500, credits: 75000, perCreditPrice: 0.00667, creditsValueUSD: 500.25 },
} as const;

export const EVENT_TYPES = {
  message: { name: 'Message', defaultPrice: 0.01 },
  data_access: { name: 'Data Access', defaultPrice: 0.01 },
  unlock: { name: 'Unlock/Access', defaultPrice: 0.05 },
  stream_minute: { name: 'Stream Minute', defaultPrice: 0.02 },
  sensor_reading: { name: 'Sensor Reading', defaultPrice: 0.01 },
  api_call: { name: 'API Call', defaultPrice: 0.01 },
  compute_second: { name: 'Compute Second', defaultPrice: 0.001 },
  storage_mb: { name: 'Storage MB', defaultPrice: 0.001 },
} as const;

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

  async createAccount(input: CreateAccountInput): Promise<{ account: IoTAccount }> {
    return this.request('POST', '/api/iot/account', input);
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
}

export default CoinRailzIoT;
