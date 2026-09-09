import axios from 'axios';
import { PLUGIN_USER_AGENT } from '../version';

const BASE_URL = process.env.COIN_RAILZ_URL || 'https://coinrailz.com';

export interface SolanaYieldRates {
  success: boolean;
  usdc: { apy: number; formatted: string };
  onChain: { depositTvlUsdc: number; liquidityUsdc: number };
  utilizationPct: number;
  attribution: string;
}

export interface SolanaDepositTxBundle {
  success: boolean;
  transactions: Array<{ base64: string; description: string }>;
  bundle_expires_at: string;
  wallet: string;
  requestedRaw: string;
  feeRaw: string;
  idempotency_key?: string;
  instructions?: Record<string, string>;
}

export interface SolanaConfirmResult {
  success: boolean;
  verificationStatus: 'confirmed' | 'pending_verification';
  onChainVerified: boolean;
  verificationNote?: string;
  message?: string;
  existingEventId?: number;
}

export interface SolanaYieldPosition {
  success: boolean;
  hasPosition: boolean;
  wallet: string;
  currentValueUsdc?: number;
  depositedUsdcRaw?: string;
  status?: string;
  nextActions?: string[];
}

/**
 * Plain REST client for the Coin Railz Solana USDC Yield Portal.
 * No x402 payment required — all /api/solana-yield/* endpoints are free.
 * Separate from X402Client which is purpose-built for /x402/* paid services.
 */
export class SolanaYieldClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || BASE_URL;
  }

  async getRates(): Promise<SolanaYieldRates> {
    const resp = await axios.get(`${this.baseUrl}/api/solana-yield/rates`, {
      headers: { 'User-Agent': PLUGIN_USER_AGENT },
      timeout: 10_000,
    });
    return resp.data;
  }

  async getManifest(): Promise<any> {
    const resp = await axios.get(`${this.baseUrl}/api/solana-yield/manifest`, {
      headers: { 'User-Agent': PLUGIN_USER_AGENT },
      timeout: 10_000,
    });
    return resp.data;
  }

  async getStats(): Promise<any> {
    const resp = await axios.get(`${this.baseUrl}/api/solana-yield/stats`, {
      headers: { 'User-Agent': PLUGIN_USER_AGENT },
      timeout: 10_000,
    });
    return resp.data;
  }

  async getPosition(wallet: string): Promise<SolanaYieldPosition> {
    const resp = await axios.get(`${this.baseUrl}/api/solana-yield/position/${wallet}`, {
      headers: { 'User-Agent': PLUGIN_USER_AGENT },
      timeout: 10_000,
    });
    return resp.data;
  }

  async createDepositTx(params: {
    wallet: string;
    amount_usdc: number;
    idempotency_key?: string;
  }): Promise<SolanaDepositTxBundle> {
    const resp = await axios.post(
      `${this.baseUrl}/api/solana-yield/deposit-tx`,
      params,
      { headers: { 'Content-Type': 'application/json', 'User-Agent': PLUGIN_USER_AGENT }, timeout: 15_000 }
    );
    return resp.data;
  }

  async confirmDeposit(params: {
    wallet: string;
    txSignature: string;
    amountUsdcRaw?: string;
  }): Promise<SolanaConfirmResult> {
    const resp = await axios.post(
      `${this.baseUrl}/api/solana-yield/confirm`,
      params,
      { headers: { 'Content-Type': 'application/json', 'User-Agent': PLUGIN_USER_AGENT }, timeout: 20_000 }
    );
    return resp.data;
  }
}
