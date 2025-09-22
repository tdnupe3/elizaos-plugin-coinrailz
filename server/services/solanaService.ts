
import { PublicKey, Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export class SolanaService {
  private connection: Connection;
  private feeWallet: string;

  constructor() {
    // Use Solana mainnet-beta for production, devnet for development
    const rpcUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com';
    
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.feeWallet = process.env.SOLANA_FEE_WALLET || '9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5';
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
   * Process SOL transfer with 2% platform fee
   */
  async processSolTransfer(
    fromAddress: string,
    toAddress: string,
    amount: number,
    userPrivateKey?: string // In production, this would be handled securely
  ): Promise<{ txHash: string; platformFee: number; networkFee: number }> {
    try {
      // Validate addresses
      if (!this.isValidSolanaAddress(fromAddress) || !this.isValidSolanaAddress(toAddress)) {
        throw new Error('Invalid Solana address');
      }

      // Calculate fees
      const platformFeeRate = 0.02; // 2%
      const platformFee = amount * platformFeeRate;
      const networkFee = await this.estimateTransferFee();
      const netAmount = amount - platformFee;

      // In a real implementation, you would:
      // 1. Create and sign the transaction with user's private key
      // 2. Add platform fee transfer to our fee wallet
      // 3. Submit to Solana network
      // 4. Return transaction hash

      // For demo purposes, return mock data
      const mockTxHash = `sol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`Solana transfer processed:
        From: ${fromAddress}
        To: ${toAddress}
        Amount: ${amount} SOL
        Platform Fee: ${platformFee} SOL
        Network Fee: ${networkFee} SOL
        Net Amount: ${netAmount} SOL
        Transaction Hash: ${mockTxHash}`);

      return {
        txHash: mockTxHash,
        platformFee,
        networkFee
      };
    } catch (error) {
      console.error('Error processing Solana transfer:', error);
      throw new Error('Failed to process Solana transfer');
    }
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
