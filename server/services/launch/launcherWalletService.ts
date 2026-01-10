import { 
  PublicKey, 
  Connection, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Keypair,
  sendAndConfirmTransaction,
  clusterApiUrl,
  ComputeBudgetProgram
} from '@solana/web3.js';
import bs58 from 'bs58';

export interface LauncherWalletStatus {
  address: string;
  balanceSol: number;
  balanceUsd: number;
  network: string;
  initialized: boolean;
}

export class LauncherWalletService {
  private static instance: LauncherWalletService;
  private connection: Connection;
  private keypair: Keypair | null = null;
  private network: 'mainnet-beta' | 'devnet';
  private initialized = false;

  constructor() {
    this.network = process.env.NODE_ENV === 'production' ? 'mainnet-beta' : 'devnet';
    
    const rpcUrl = process.env.SOLANA_RPC_URL || 
      (process.env.HELIUS_API_KEY 
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : clusterApiUrl(this.network));
    
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.initialize();
  }

  public static getInstance(): LauncherWalletService {
    if (!this.instance) {
      this.instance = new LauncherWalletService();
    }
    return this.instance;
  }

  private async initialize() {
    try {
      const privateKey = process.env.TOKEN_LAUNCHER_PRIVATE_KEY;
      if (privateKey) {
        const privateKeyBytes = bs58.decode(privateKey);
        this.keypair = Keypair.fromSecretKey(privateKeyBytes);
        console.log(`✅ Token launcher wallet loaded: ${this.keypair.publicKey.toBase58()}`);
        this.initialized = true;
      } else {
        console.warn('⚠️ TOKEN_LAUNCHER_PRIVATE_KEY not configured - launcher disabled');
      }
    } catch (error) {
      console.error('❌ Failed to initialize launcher wallet:', error);
    }
  }

  getKeypair(): Keypair | null {
    return this.keypair;
  }

  getConnection(): Connection {
    return this.connection;
  }

  getAddress(): string | null {
    return this.keypair?.publicKey.toBase58() || null;
  }

  async getStatus(): Promise<LauncherWalletStatus> {
    const address = this.getAddress();
    let balanceSol = 0;
    let balanceUsd = 0;

    if (address && this.keypair) {
      try {
        const lamports = await this.connection.getBalance(this.keypair.publicKey);
        balanceSol = lamports / LAMPORTS_PER_SOL;
        balanceUsd = balanceSol * 220;
      } catch (error) {
        console.error('Failed to get launcher wallet balance:', error);
      }
    }

    return {
      address: address || 'NOT_CONFIGURED',
      balanceSol,
      balanceUsd,
      network: this.network,
      initialized: this.initialized
    };
  }

  async sendSolWithPriority(
    toAddress: string,
    amountSol: number,
    priorityFeeMicroLamports: number = 200000
  ): Promise<string> {
    if (!this.keypair) {
      throw new Error('Launcher wallet not initialized');
    }

    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction();

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeMicroLamports
      })
    );

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.keypair],
      { commitment: 'confirmed' }
    );

    return signature;
  }
}

export const launcherWalletService = new LauncherWalletService();
