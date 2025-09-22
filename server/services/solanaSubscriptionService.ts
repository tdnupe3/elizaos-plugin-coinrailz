import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Keypair,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { users } from '../../shared/schema';

export interface SolanaSubscription {
  id: string;
  userId: string;
  walletAddress: string;
  subscriptionType: 'premium_tools' | 'analytics_platform' | 'education_platform' | 'all_access';
  status: 'active' | 'expired' | 'pending';
  paymentAmount: number; // In SOL
  paymentSignature?: string;
  startDate: Date;
  endDate: Date;
  features: string[];
}

export interface PaymentResult {
  success: boolean;
  signature?: string;
  subscriptionId?: string;
  error?: string;
}

export class SolanaSubscriptionService {
  private connection: Connection;
  private platformWallet: Keypair | null = null;
  private subscriptionPrice = 1.0; // 1 SOL for premium access

  constructor() {
    const rpcUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com';
    
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Initialize platform wallet from environment
   */
  private async initialize(): Promise<string> {
    if (!this.platformWallet) {
      const privateKey = process.env.SOLANA_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('SOLANA_PRIVATE_KEY not configured');
      }
      
      try {
        const secretKey = JSON.parse(privateKey);
        this.platformWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
      } catch {
        throw new Error('Invalid SOLANA_PRIVATE_KEY format - should be JSON array of bytes');
      }
    }
    
    return this.platformWallet.publicKey.toString();
  }

  /**
   * 💳 Process subscription payment
   */
  async processSubscriptionPayment(
    userWalletAddress: string,
    subscriptionType: SolanaSubscription['subscriptionType'],
    userPrivateKey?: string
  ): Promise<PaymentResult> {
    try {
      console.log(`💳 Processing ${subscriptionType} subscription payment from ${userWalletAddress}`);
      
      const platformAddress = await this.initialize();
      
      if (!userPrivateKey) {
        return {
          success: false,
          error: 'User private key required for payment processing'
        };
      }

      // Create user keypair from private key
      let userKeypair: Keypair;
      try {
        const userSecretKey = JSON.parse(userPrivateKey);
        userKeypair = Keypair.fromSecretKey(new Uint8Array(userSecretKey));
      } catch {
        return {
          success: false,
          error: 'Invalid user private key format'
        };
      }

      // Verify user wallet address matches
      if (userKeypair.publicKey.toString() !== userWalletAddress) {
        return {
          success: false,
          error: 'Wallet address does not match private key'
        };
      }

      // Check user SOL balance
      const userBalance = await this.connection.getBalance(userKeypair.publicKey);
      const userSolBalance = userBalance / LAMPORTS_PER_SOL;
      
      if (userSolBalance < this.subscriptionPrice) {
        return {
          success: false,
          error: `Insufficient SOL balance: ${userSolBalance.toFixed(4)} (need ${this.subscriptionPrice})`
        };
      }

      // Create payment transaction
      const transaction = new Transaction();
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: this.platformWallet!.publicKey,
        lamports: Math.floor(this.subscriptionPrice * LAMPORTS_PER_SOL)
      });
      
      transaction.add(transferInstruction);
      
      // Add memo with subscription details
      const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
      const memoData = `COINRAILZ_SUBSCRIPTION:${subscriptionType}:${Date.now()}`;
      const memoInstruction = {
        keys: [],
        programId: memoProgram,
        data: Buffer.from(memoData, 'utf8')
      };
      
      transaction.add(memoInstruction);
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [userKeypair],
        { commitment: 'confirmed' }
      );

      // Create subscription record
      const subscriptionId = await this.createSubscription(
        userWalletAddress,
        subscriptionType,
        signature
      );

      console.log(`✅ Subscription payment successful: ${signature}`);
      
      return {
        success: true,
        signature,
        subscriptionId
      };
      
    } catch (error: any) {
      console.error('❌ Subscription payment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📋 Create subscription record
   */
  async createSubscription(
    walletAddress: string,
    subscriptionType: SolanaSubscription['subscriptionType'],
    paymentSignature: string
  ): Promise<string> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    const features = this.getSubscriptionFeatures(subscriptionType);

    // In production, store in database
    const subscription: SolanaSubscription = {
      id: subscriptionId,
      userId: walletAddress, // Using wallet as user ID for simplicity
      walletAddress,
      subscriptionType,
      status: 'active',
      paymentAmount: this.subscriptionPrice,
      paymentSignature,
      startDate,
      endDate,
      features
    };

    console.log(`📋 Created subscription: ${subscriptionId}`);
    console.log(`📅 Valid until: ${endDate.toISOString()}`);
    
    return subscriptionId;
  }

  /**
   * ✅ Verify active subscription
   */
  async verifySubscription(
    walletAddress: string,
    requiredFeature?: string
  ): Promise<{ isValid: boolean; subscription?: SolanaSubscription; message: string }> {
    try {
      // In production, query database for active subscriptions
      // For now, mock active subscription for demonstration
      
      const mockSubscription: SolanaSubscription = {
        id: `sub_${walletAddress.slice(0, 8)}`,
        userId: walletAddress,
        walletAddress,
        subscriptionType: 'all_access',
        status: 'active',
        paymentAmount: 1.0,
        paymentSignature: '5KZx...mock',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000), // 23 days from now
        features: this.getSubscriptionFeatures('all_access')
      };

      if (mockSubscription.status !== 'active') {
        return {
          isValid: false,
          message: `Subscription is ${mockSubscription.status}`
        };
      }

      if (new Date() > mockSubscription.endDate) {
        return {
          isValid: false,
          message: 'Subscription has expired'
        };
      }

      if (requiredFeature && !mockSubscription.features.includes(requiredFeature)) {
        return {
          isValid: false,
          message: `Feature '${requiredFeature}' not included in subscription`
        };
      }

      return {
        isValid: true,
        subscription: mockSubscription,
        message: 'Subscription is active'
      };
      
    } catch (error) {
      console.error('❌ Error verifying subscription:', error);
      return {
        isValid: false,
        message: 'Error verifying subscription'
      };
    }
  }

  /**
   * 🎫 Get subscription features
   */
  private getSubscriptionFeatures(subscriptionType: SolanaSubscription['subscriptionType']): string[] {
    const featureMap = {
      premium_tools: [
        'whale_tracking',
        'portfolio_analytics',
        'fee_optimizer',
        'security_scanner',
        'custom_alerts'
      ],
      analytics_platform: [
        'token_analytics',
        'wallet_analytics',
        'historical_data',
        'data_export',
        'trending_tokens'
      ],
      education_platform: [
        'all_courses',
        'qa_sessions',
        'certificates',
        'community_access',
        'priority_support'
      ],
      all_access: [
        'whale_tracking',
        'portfolio_analytics', 
        'fee_optimizer',
        'security_scanner',
        'custom_alerts',
        'token_analytics',
        'wallet_analytics',
        'historical_data',
        'data_export',
        'trending_tokens',
        'all_courses',
        'qa_sessions',
        'certificates',
        'community_access',
        'priority_support'
      ]
    };

    return featureMap[subscriptionType] || [];
  }

  /**
   * 💰 Get subscription pricing info
   */
  async getSubscriptionPricing(): Promise<{
    price: number;
    currency: 'SOL';
    features: { [key: string]: string[] };
    duration: string;
  }> {
    return {
      price: this.subscriptionPrice,
      currency: 'SOL',
      features: {
        premium_tools: this.getSubscriptionFeatures('premium_tools'),
        analytics_platform: this.getSubscriptionFeatures('analytics_platform'),
        education_platform: this.getSubscriptionFeatures('education_platform'),
        all_access: this.getSubscriptionFeatures('all_access')
      },
      duration: '30 days'
    };
  }

  /**
   * 📊 Get platform statistics
   */
  async getPlatformStats(): Promise<{
    totalSubscribers: number;
    activeSubscriptions: number;
    totalRevenue: number;
    popularPlan: string;
  }> {
    return {
      totalSubscribers: 1247, // Mock data
      activeSubscriptions: 894,
      totalRevenue: 1891.5, // In SOL
      popularPlan: 'all_access'
    };
  }
}

export const solanaSubscriptionService = new SolanaSubscriptionService();