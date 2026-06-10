import axios from 'axios';

export interface BaseYieldRates {
  aave:       { supplyApy: number; tvlUsdc: number };
  compound:   { supplyApy: number; tvlUsdc: number };
  morpho:     { supplyApy: number; tvlUsdc: number };
  bestProtocol: string;
  bestApy:    number;
  netApyAfterFee: number;
  vault:      {
    address:    string;
    shareToken: string;
    standard:   string;
  } | null;
}

export interface BaseYieldStats {
  vault: {
    address:   string;
    shareToken: string;
    standard:  string;
    totalAssets: string;
    totalSupply: string;
    pricePerShare: string;
    depositFeePct: number;
    performanceFeePct: number;
    currentProtocol: string;
  };
}

export interface BaseYieldPosition {
  wallet:      string;
  shares:      string;
  currentValueUsdc: string;
  depositedUsdc: string;
  yieldEarned: string;
  redeemHint:  object | null;
}

export interface BaseDepositTx {
  mode: 'approve+deposit' | 'permit';
  transactions: Array<{
    label: string;
    to:    string;
    data:  string;
    value: string;
    gas:   string;
    chainId: number;
  }>;
  amountUsdc: string;
  recipient:  string;
}

export interface BaseRedeemTx {
  to:      string;
  data:    string;
  value:   string;
  gas:     string;
  chainId: number;
  shares:  string;
  wallet:  string;
}

/**
 * HTTP client for the Coin Railz Base USDC Yield Vault API.
 *
 * Vault is an ERC-4626 contract on Base mainnet, auto-routing USDC across
 * Aave v3, Compound v3, and Morpho. Agents receive crUSDC shares.
 *
 * All endpoints are free (no x402 payment required).
 */
export class BaseYieldClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl?: string, timeoutMs = 10_000) {
    this.baseUrl = (baseUrl || process.env.COINRAILZ_BASE_URL || 'https://coinrailz.replit.app').replace(/\/$/, '');
    this.timeout = timeoutMs;
  }

  async getRates(): Promise<BaseYieldRates> {
    const { data } = await axios.get(`${this.baseUrl}/api/yield/rates`, { timeout: this.timeout });
    return data;
  }

  async getStats(): Promise<BaseYieldStats> {
    const { data } = await axios.get(`${this.baseUrl}/api/yield/stats`, { timeout: this.timeout });
    return data;
  }

  async getPosition(wallet: string): Promise<BaseYieldPosition> {
    const { data } = await axios.get(`${this.baseUrl}/api/yield/position/${wallet}`, { timeout: this.timeout });
    return data;
  }

  async getContract(): Promise<object> {
    const { data } = await axios.get(`${this.baseUrl}/api/yield/contract`, { timeout: this.timeout });
    return data;
  }

  async buildDepositTx(params: {
    wallet:     string;
    amount_usdc: number;
    mode?:      'approve+deposit' | 'permit';
  }): Promise<BaseDepositTx> {
    const mode   = params.mode === 'permit' ? 'permit' : undefined;
    const preset = params.amount_usdc;
    const url    = `${this.baseUrl}/api/yield/deposit-tx?recipient=${params.wallet}&preset=${preset}${mode ? '&mode=permit' : ''}`;
    const { data } = await axios.get(url, { timeout: this.timeout });
    return data;
  }

  async buildRedeemTx(wallet: string): Promise<BaseRedeemTx> {
    const { data } = await axios.get(`${this.baseUrl}/api/yield/redeem-tx?wallet=${wallet}`, { timeout: this.timeout });
    return data;
  }
}
