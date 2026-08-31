/**
 * Solana Service - Native SOL and SPL Token Payments
 * Provides wallet generation, SOL transfers, and SPL token transfers (USDC)
 * Uses @solana/web3.js for blockchain interactions
 */

import { 
  PublicKey, 
  Connection, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Keypair,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl
} from '@solana/web3.js';
import bs58 from 'bs58';
import * as splTokenModule from '@solana/spl-token';

const {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} = splTokenModule as unknown as {
  createTransferInstruction: (
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: number | bigint,
  ) => TransactionInstruction;
  getAssociatedTokenAddress: (mint: PublicKey, owner: PublicKey) => Promise<PublicKey>;
  getOrCreateAssociatedTokenAccount: (
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey,
  ) => Promise<{ address: PublicKey }>;
};

export interface SolanaWallet {
  address: string;
  publicKey: string;
  privateKey: string;
  network: string;
  createdAt: string;
}

export interface SolanaTransactionResult {
  signature: string;
  status: 'confirmed' | 'pending' | 'failed';
  network: string;
  amount: string;
  currency: string;
  toAddress: string;
  fromAddress?: string;
  fee?: string;
}

export class SolanaService {
  private static instance: SolanaService;
  private connection: Connection;
  private feeWallet: string;
  private network: 'mainnet-beta' | 'devnet';
  private platformKeypair: Keypair | null = null;
  private initialized = false;

  constructor() {
    this.network = process.env.NODE_ENV === 'production' ? 'mainnet-beta' : 'devnet';
    
    const rpcUrl = process.env.SOLANA_RPC_URL || 
      (process.env.HELIUS_API_KEY 
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : clusterApiUrl(this.network));
    
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.feeWallet = process.env.SOLANA_FEE_WALLET || '9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5';
    this.initialize();
  }

  public static getInstance(): SolanaService {
    if (!this.instance) {
      this.instance = new SolanaService();
    }
    return this.instance;
  }

  private async initialize() {
    try {
      const privateKey = process.env.SOLANA_PRIVATE_KEY || process.env.SOLANA_PLATFORM_PRIVATE_KEY;
      if (privateKey) {
        const privateKeyBytes = bs58.decode(privateKey);
        this.platformKeypair = Keypair.fromSecretKey(privateKeyBytes);
        console.log(`✅ Solana platform wallet loaded: ${this.platformKeypair.publicKey.toBase58()}`);
      } else {
        console.warn('⚠️ SOLANA_PRIVATE_KEY not configured - real transfers disabled');
      }

      const version = await this.connection.getVersion();
      console.log(`✅ Solana RPC connected (${this.network}): version ${version['solana-core']}`);
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Solana service:', error);
    }
  }

  async getServiceStatus() {
    let rpcConnected = false;
    try {
      await this.connection.getVersion();
      rpcConnected = true;
    } catch {}

    return {
      initialized: this.initialized,
      network: this.network,
      rpcConnected,
      hasPlatformWallet: !!this.platformKeypair,
      platformAddress: this.platformKeypair?.publicKey.toBase58() || null,
    };
  }

  /**
   * Generate a new Solana wallet
   */
  async createWallet(): Promise<SolanaWallet> {
    const keypair = Keypair.generate();
    
    return {
      address: keypair.publicKey.toBase58(),
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
      network: this.network,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Validate Solana wallet address format
   */
  isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get SOL balance for an address
   */
  async getBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error getting Solana balance:', error);
      throw new Error('Failed to get Solana balance');
    }
  }

  /**
   * Calculate transaction fee for SOL transfer
   */
  async estimateTransferFee(): Promise<number> {
    try {
      // Get recent blockhash to estimate fee
      const { blockhash } = await this.connection.getRecentBlockhash();
      
      // Create a dummy transaction to estimate fee
      const dummyTx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: new PublicKey(this.feeWallet)
      });
      
      dummyTx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(this.feeWallet),
          toPubkey: new PublicKey(this.feeWallet),
          lamports: LAMPORTS_PER_SOL * 0.001 // 0.001 SOL
        })
      );

      const fee = await this.connection.getFeeForMessage(dummyTx.compileMessage());
      return (fee?.value || 5000) / LAMPORTS_PER_SOL; // Default 0.000005 SOL
    } catch (error) {
      console.error('Error estimating Solana fee:', error);
      return 0.000005; // Default fee in SOL
    }
  }

  /**
   * Send SOL via platform wallet (SDK payment flow)
   * Fee: 1.5% + $0.01 (handled by caller)
   */
  async sendSol(
    toAddress: string,
    amountSol: number,
    memo?: string
  ): Promise<SolanaTransactionResult> {
    if (!this.platformKeypair) {
      throw new Error('Platform wallet not configured - cannot send SOL');
    }

    if (!this.isValidSolanaAddress(toAddress)) {
      throw new Error('Invalid Solana destination address');
    }

    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.platformKeypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    if (memo) {
      console.log(`📝 SOL Transfer memo: ${memo}`);
    }

    try {
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.platformKeypair],
        { commitment: 'confirmed' }
      );

      console.log(`✅ SOL sent: ${signature}`);

      return {
        signature,
        status: 'confirmed',
        network: this.network,
        amount: amountSol.toString(),
        currency: 'SOL',
        toAddress,
        fromAddress: this.platformKeypair.publicKey.toBase58(),
      };
    } catch (error: any) {
      console.error('❌ SOL transfer failed:', error);
      throw new Error(`SOL transfer failed: ${error.message}`);
    }
  }

  /**
   * Send USDC (SPL Token) on Solana
   */
  async sendUsdc(
    toAddress: string,
    amountUsdc: number,
    memo?: string
  ): Promise<SolanaTransactionResult> {
    if (!this.platformKeypair) {
      throw new Error('Platform wallet not configured - cannot send USDC');
    }

    if (!this.isValidSolanaAddress(toAddress)) {
      throw new Error('Invalid Solana destination address');
    }

    const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const USDC_DECIMALS = 6;

    const toPubkey = new PublicKey(toAddress);
    const amount = Math.floor(amountUsdc * Math.pow(10, USDC_DECIMALS));

    try {
      const fromAta = await getAssociatedTokenAddress(USDC_MINT, this.platformKeypair.publicKey);
      
      const toAta = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.platformKeypair,
        USDC_MINT,
        toPubkey
      );

      const transaction = new Transaction().add(
        createTransferInstruction(
          fromAta,
          toAta.address,
          this.platformKeypair.publicKey,
          amount
        )
      );

      if (memo) {
        console.log(`📝 USDC Transfer memo: ${memo}`);
      }

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.platformKeypair],
        { commitment: 'confirmed' }
      );

      console.log(`✅ USDC sent on Solana: ${signature}`);

      return {
        signature,
        status: 'confirmed',
        network: this.network,
        amount: amountUsdc.toString(),
        currency: 'USDC',
        toAddress,
        fromAddress: this.platformKeypair.publicKey.toBase58(),
      };
    } catch (error: any) {
      console.error('❌ USDC transfer failed:', error);
      throw new Error(`USDC transfer failed: ${error.message}`);
    }
  }

  /**
   * Legacy method - Process SOL transfer with platform fee
   */
  async processSolTransfer(
    fromAddress: string,
    toAddress: string,
    amount: number,
    userPrivateKey?: string
  ): Promise<{ txHash: string; platformFee: number; networkFee: number }> {
    const platformFeeRate = 0.015; // 1.5%
    const platformFee = amount * platformFeeRate + 0.01;
    const networkFee = await this.estimateTransferFee();
    const netAmount = amount - platformFee;

    const result = await this.sendSol(toAddress, netAmount, `Transfer from ${fromAddress}`);

    return {
      txHash: result.signature,
      platformFee,
      networkFee
    };
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    try {
      // In production, check actual transaction status
      // For demo, return mock status
      if (txHash.startsWith('sol_')) {
        return 'confirmed';
      }
      return 'pending';
    } catch (error) {
      console.error('Error getting transaction status:', error);
      return 'failed';
    }
  }

  /**
   * Get current SOL price using real-time CoinGecko pricing
   */
  async getCurrentPrice(): Promise<number> {
    try {
      const { coinGeckoPricingService } = await import('./pricing/CoinGeckoPricingService');
      const price = await coinGeckoPricingService.getPrice('SOL');
      return price.usd;
    } catch (error) {
      console.warn('⚠️ Failed to get real-time SOL price, using emergency fallback:', error);
      return 220; // Current approximate emergency fallback
    }
  }
}

export const solanaService = new SolanaService();
