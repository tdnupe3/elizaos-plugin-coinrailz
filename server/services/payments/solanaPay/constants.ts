/**
 * Solana Payment Processor - Constants and Configuration
 * ISOLATED: This module is completely separate from x402 EVM infrastructure
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

export interface SupportedToken {
  symbol: string;
  mint: string;
  decimals: number;
  name: string;
  ataRequired: boolean;
}

export const SUPPORTED_TOKENS: Record<string, SupportedToken> = {
  SOL: {
    symbol: 'SOL',
    mint: 'native',
    decimals: 9,
    name: 'Solana',
    ataRequired: false,
  },
  USDC: {
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    name: 'USD Coin',
    ataRequired: true,
  },
  USDT: {
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg',
    decimals: 6,
    name: 'Tether USD',
    ataRequired: true,
  },
};

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export const DEFAULT_INTENT_EXPIRATION_MINUTES = 15;

export const INTENT_STATUSES = {
  PENDING: 'pending',
  CONFIRMING: 'confirming',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const;

export type IntentStatus = typeof INTENT_STATUSES[keyof typeof INTENT_STATUSES];

export const SERVICE_SLUGS = {
  TOKEN_PRICE_FEED: 'sol-price-feed',
  TRENDING_TOKENS: 'sol-trending',
  WHALE_ALERTS: 'sol-whale-alerts',
  TRADE_SIGNALS: 'sol-trade-signals',
  SOLANA_PING: 'solana-ping',
  INSTANT_SOLANA_WALLET: 'instant-solana-wallet',
} as const;

export type ServiceSlug = typeof SERVICE_SLUGS[keyof typeof SERVICE_SLUGS];

export const SERVICE_PRICING = {
  [SERVICE_SLUGS.TOKEN_PRICE_FEED]: {
    name: 'Token Price Feed',
    description: 'Real-time Solana token prices via Jupiter/DexScreener',
    priceUsdc: '0.10',
    priceUsdt: '0.10',
    priceSol: '0.0005',
  },
  [SERVICE_SLUGS.TRENDING_TOKENS]: {
    name: 'Trending Tokens',
    description: 'Hot tokens on Solana DEXs with volume and price data',
    priceUsdc: '0.25',
    priceUsdt: '0.25',
    priceSol: '0.001',
  },
  [SERVICE_SLUGS.WHALE_ALERTS]: {
    name: 'Whale Wallet Alerts',
    description: 'Track large Solana wallet movements in real-time',
    priceUsdc: '0.50',
    priceUsdt: '0.50',
    priceSol: '0.002',
  },
  [SERVICE_SLUGS.TRADE_SIGNALS]: {
    name: 'Trade Signals',
    description: 'Simple trading signals for Solana tokens',
    priceUsdc: '0.75',
    priceUsdt: '0.75',
    priceSol: '0.003',
  },
  [SERVICE_SLUGS.SOLANA_PING]: {
    name: 'Solana Discovery Ping',
    description: 'Service health and availability check for registry monitoring',
    priceUsdc: '0.25',
    priceUsdt: '0.25',
    priceSol: '0.001',
  },
  [SERVICE_SLUGS.INSTANT_SOLANA_WALLET]: {
    name: 'Instant Solana Agent Wallet',
    description: 'Create a Solana wallet for AI agents instantly via Coinbase CDP',
    priceUsdc: '1.00',
    priceUsdt: '1.00',
    priceSol: '0.004',
  },
} as const;

class SolanaWalletManager {
  private static instance: SolanaWalletManager;
  private keypair: Keypair | null = null;
  private connection: Connection | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): SolanaWalletManager {
    if (!SolanaWalletManager.instance) {
      SolanaWalletManager.instance = new SolanaWalletManager();
    }
    return SolanaWalletManager.instance;
  }

  initialize(): boolean {
    if (this.initialized) return true;

    try {
      const privateKey = process.env.SOLANA_PRIVATE_KEY;
      if (!privateKey) {
        console.warn('⚠️ SOLANA_PRIVATE_KEY not configured - Solana payments disabled');
        return false;
      }

      let secretKey: Uint8Array;
      if (privateKey.length >= 85 && privateKey.length <= 90) {
        secretKey = bs58.decode(privateKey);
      } else {
        const parsed = JSON.parse(privateKey);
        secretKey = new Uint8Array(parsed);
      }

      this.keypair = Keypair.fromSecretKey(secretKey);
      
      const rpcUrl = process.env.SOLANA_RPC_URL || 
                     (process.env.HELIUS_API_KEY 
                       ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
                       : 'https://api.mainnet-beta.solana.com');
      
      this.connection = new Connection(rpcUrl, 'confirmed');
      this.initialized = true;
      
      console.log(`🔗 Solana Payment Wallet initialized: ${this.keypair.publicKey.toString()}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Solana wallet:', error);
      return false;
    }
  }

  getPublicKey(): PublicKey | null {
    if (!this.initialized) this.initialize();
    return this.keypair?.publicKey || null;
  }

  getPublicKeyString(): string | null {
    const pk = this.getPublicKey();
    return pk?.toString() || null;
  }

  getKeypair(): Keypair | null {
    if (!this.initialized) this.initialize();
    return this.keypair;
  }

  getConnection(): Connection | null {
    if (!this.initialized) this.initialize();
    return this.connection;
  }

  isReady(): boolean {
    return this.initialized && this.keypair !== null && this.connection !== null;
  }
}

export const solanaWalletManager = SolanaWalletManager.getInstance();

export function getTokenBySymbol(symbol: string): SupportedToken | undefined {
  return SUPPORTED_TOKENS[symbol.toUpperCase()];
}

export function getTokenByMint(mint: string): SupportedToken | undefined {
  return Object.values(SUPPORTED_TOKENS).find(t => t.mint === mint);
}

export function isTokenSupported(symbolOrMint: string): boolean {
  return !!getTokenBySymbol(symbolOrMint) || !!getTokenByMint(symbolOrMint);
}
