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
import { eq, and, gte } from 'drizzle-orm';
import { 
  solanaPremiumSubscriptions,
  solanaPremiumSubscriptionInsertSchema,
  type InsertSolanaPremiumSubscription,
  type SelectSolanaPremiumSubscription
} from '../../shared/schema';
import { nanoid } from 'nanoid';

export type SolanaSubscription = SelectSolanaPremiumSubscription;

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
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
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
   * 📋 Create subscription record in database
   */
  async createSubscription(
    walletAddress: string,
    subscriptionType: SolanaSubscription['subscriptionType'],
    paymentSignature: string
  ): Promise<string> {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

      const features = this.getSubscriptionFeatures(subscriptionType);

      const subscriptionData: InsertSolanaPremiumSubscription = {
        userId: walletAddress, // Using wallet as user ID
        walletAddress,
        subscriptionType,
        status: 'active',
        paymentAmount: this.subscriptionPrice.toString(),
        paymentSignature,
        startDate,
        endDate,
        features
      };

      // Insert into database
      const [newSubscription] = await db
        .insert(solanaPremiumSubscriptions)
        .values(subscriptionData)
        .returning();

      console.log(`✅ Subscription created in database: ${newSubscription.id}`);
      console.log(`📅 Valid until: ${endDate.toISOString()}`);
      
      return newSubscription.id;
      
    } catch (error) {
      console.error('❌ Failed to create subscription in database:', error);
      throw new Error('Failed to create subscription record');
    }
  }

  /**
   * ✅ Verify active subscription from database
   */
  async verifySubscription(
    walletAddress: string,
    requiredFeature?: string
  ): Promise<{ isValid: boolean; subscription?: SolanaSubscription; message: string }> {
    try {
      // Query database for active subscriptions
      const subscriptions = await db
        .select()
        .from(solanaPremiumSubscriptions)
        .where(
          and(
            eq(solanaPremiumSubscriptions.walletAddress, walletAddress),
            eq(solanaPremiumSubscriptions.status, 'active'),
            gte(solanaPremiumSubscriptions.endDate, new Date())
          )
        )
        .orderBy(solanaPremiumSubscriptions.endDate);

      if (!subscriptions.length) {
        return {
          isValid: false,
          message: 'No active subscription found'
        };
      }

      // Get the most recent active subscription
      const subscription = subscriptions[subscriptions.length - 1];

      if (requiredFeature && !subscription.features.includes(requiredFeature)) {
        return {
          isValid: false,
          message: `Feature '${requiredFeature}' not included in subscription`
        };
      }

      return {
        isValid: true,
        subscription,
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
   * 📊 Get real platform statistics from database
   */
  async getPlatformStats(): Promise<{
    totalSubscribers: number;
    activeSubscriptions: number;
    totalRevenue: number;
    popularPlan: string;
  }> {
    try {
      // Get all subscriptions
      const allSubscriptions = await db
        .select()
        .from(solanaPremiumSubscriptions);

      // Count active subscriptions
      const activeSubscriptions = allSubscriptions.filter(sub => 
        sub.status === 'active' && new Date(sub.endDate) > new Date()
      ).length;

      // Calculate total revenue
      const totalRevenue = allSubscriptions.reduce((sum, sub) => 
        sum + parseFloat(sub.paymentAmount), 0
      );

      // Find most popular plan
      const planCounts = allSubscriptions.reduce((counts, sub) => {
        counts[sub.subscriptionType] = (counts[sub.subscriptionType] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      const popularPlan = Object.entries(planCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'all_access';

      // Count unique subscribers
      const uniqueWallets = new Set(allSubscriptions.map(sub => sub.walletAddress));

      return {
        totalSubscribers: uniqueWallets.size,
        activeSubscriptions,
        totalRevenue,
        popularPlan
      };
      
    } catch (error) {
      console.error('❌ Error getting platform stats:', error);
      // Fallback to zeros if database query fails
      return {
        totalSubscribers: 0,
        activeSubscriptions: 0,
        totalRevenue: 0,
        popularPlan: 'all_access'
      };
    }
  }
}

export const solanaSubscriptionService = new SolanaSubscriptionService();