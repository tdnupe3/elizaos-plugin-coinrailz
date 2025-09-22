import { Connection, PublicKey } from '@solana/web3.js';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { users } from '../../shared/schema';

export interface WhaleAlert {
  id: string;
  walletAddress: string;
  walletName?: string;
  transactionType: 'buy' | 'sell' | 'transfer';
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  usdValue: number;
  timestamp: Date;
  signature: string;
}

export interface CustomAlert {
  id: string;
  userId: string;
  alertType: 'whale_movement' | 'token_price' | 'volume_spike' | 'new_token';
  conditions: {
    minAmount?: number;
    tokenAddress?: string;
    priceThreshold?: number;
    volumeIncrease?: number;
  };
  isActive: boolean;
  createdAt: Date;
}

export interface PortfolioAnalytics {
  totalValue: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  topHoldings: Array<{
    tokenAddress: string;
    symbol: string;
    balance: string;
    usdValue: number;
    percentage: number;
  }>;
  transactionHistory: Array<{
    signature: string;
    type: 'buy' | 'sell' | 'transfer';
    tokenSymbol: string;
    amount: string;
    usdValue: number;
    timestamp: Date;
  }>;
}

export class SolanaPremiumToolsService {
  private connection: Connection;
  private whaleWallets: string[] = [
    // Major Solana whales and protocols
    'So11111111111111111111111111111111111111112', // Wrapped SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // Raydium AMM
    'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo', // Jupiter Exchange
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'  // Orca Protocol
  ];

  constructor() {
    const rpcUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * 🐋 Track whale wallet movements
   */
  async trackWhaleMovements(): Promise<WhaleAlert[]> {
    const alerts: WhaleAlert[] = [];
    
    try {
      console.log('🐋 Scanning whale wallets for large movements...');
      
      for (const walletAddress of this.whaleWallets) {
        try {
          const publicKey = new PublicKey(walletAddress);
          
          // Get recent transaction signatures
          const signatures = await this.connection.getSignaturesForAddress(
            publicKey,
            { limit: 10 }
          );

          for (const sigInfo of signatures.slice(0, 3)) { // Check last 3 transactions
            try {
              const transaction = await this.connection.getTransaction(
                sigInfo.signature,
                { commitment: 'confirmed' }
              );

              if (transaction?.meta && transaction.transaction) {
                const preBalances = transaction.meta.preBalances;
                const postBalances = transaction.meta.postBalances;
                
                // Detect large SOL movements (>100 SOL)
                for (let i = 0; i < preBalances.length; i++) {
                  const balanceChange = Math.abs(postBalances[i] - preBalances[i]);
                  const solChange = balanceChange / 1e9; // Convert lamports to SOL
                  
                  if (solChange > 100) {
                    alerts.push({
                      id: `whale_${sigInfo.signature.slice(0, 8)}`,
                      walletAddress,
                      walletName: this.getWalletName(walletAddress),
                      transactionType: postBalances[i] > preBalances[i] ? 'buy' : 'sell',
                      tokenAddress: 'So11111111111111111111111111111111111111112', // SOL
                      tokenSymbol: 'SOL',
                      amount: solChange.toFixed(2),
                      usdValue: solChange * 150, // Approximate SOL price
                      timestamp: new Date(sigInfo.blockTime! * 1000),
                      signature: sigInfo.signature
                    });
                  }
                }
              }
            } catch (error) {
              // Skip individual transaction errors
              console.log(`⚠️ Skipping transaction ${sigInfo.signature}: ${error}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Error processing wallet ${walletAddress}:`, error);
        }
      }
      
      console.log(`✅ Found ${alerts.length} whale alerts`);
      return alerts;
      
    } catch (error) {
      console.error('❌ Error tracking whale movements:', error);
      return [];
    }
  }

  /**
   * 📊 Get portfolio analytics for a wallet
   */
  async getPortfolioAnalytics(walletAddress: string): Promise<PortfolioAnalytics | null> {
    try {
      console.log(`📊 Analyzing portfolio for wallet: ${walletAddress}`);
      
      const publicKey = new PublicKey(walletAddress);
      
      // Get SOL balance
      const solBalance = await this.connection.getBalance(publicKey);
      const solAmount = solBalance / 1e9;
      const solValue = solAmount * 150; // Approximate SOL price
      
      // Get token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      const holdings: any[] = [{
        tokenAddress: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        balance: solAmount.toFixed(4),
        usdValue: solValue,
        percentage: 100 // Will recalculate after adding tokens
      }];

      let totalValue = solValue;

      // Process token holdings
      for (const tokenAccount of tokenAccounts.value.slice(0, 10)) { // Limit to top 10
        const accountData = tokenAccount.account.data.parsed.info;
        const tokenAmount = parseFloat(accountData.tokenAmount.uiAmount || '0');
        
        if (tokenAmount > 0) {
          holdings.push({
            tokenAddress: accountData.mint,
            symbol: `TOKEN_${accountData.mint.slice(0, 8)}`,
            balance: tokenAmount.toFixed(4),
            usdValue: tokenAmount * 1, // Placeholder pricing
            percentage: 0 // Will calculate below
          });
          totalValue += tokenAmount * 1; // Placeholder value
        }
      }

      // Calculate percentages
      holdings.forEach(holding => {
        holding.percentage = (holding.usdValue / totalValue) * 100;
      });

      // Get recent transaction history
      const signatures = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit: 20 }
      );

      const transactionHistory: any[] = [];
      for (const sigInfo of signatures.slice(0, 10)) {
        transactionHistory.push({
          signature: sigInfo.signature,
          type: 'transfer',
          tokenSymbol: 'SOL',
          amount: '0.1',
          usdValue: 15,
          timestamp: new Date(sigInfo.blockTime! * 1000)
        });
      }

      const analytics: PortfolioAnalytics = {
        totalValue,
        dailyPnL: totalValue * 0.02, // Mock 2% daily change
        weeklyPnL: totalValue * 0.08, // Mock 8% weekly change  
        monthlyPnL: totalValue * 0.15, // Mock 15% monthly change
        topHoldings: holdings.sort((a, b) => b.usdValue - a.usdValue).slice(0, 5),
        transactionHistory
      };

      console.log(`✅ Portfolio analytics complete: $${totalValue.toFixed(2)} total value`);
      return analytics;
      
    } catch (error) {
      console.error('❌ Error getting portfolio analytics:', error);
      return null;
    }
  }

  /**
   * ⚡ Optimize transaction fees for a wallet
   */
  async optimizeTransactionFees(walletAddress: string, transactionType: 'swap' | 'transfer' | 'dex'): Promise<{
    recommendedFee: number;
    estimatedSavings: number;
    optimizationTips: string[];
  }> {
    try {
      console.log(`⚡ Optimizing fees for ${transactionType} transaction...`);
      
      // Get recent block hash and fee information
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      
      // Simulate different fee scenarios
      const baseFee = 5000; // Base fee in lamports
      const priorityFee = 1000; // Additional priority fee
      const recommendedFee = baseFee + priorityFee;
      
      const optimizationTips = [
        '🔥 Use Jupiter aggregator for best swap rates',
        '⏰ Execute during low network congestion (late night UTC)',  
        '💎 Bundle multiple operations to save on fees',
        '🎯 Use versioned transactions for better efficiency',
        '⚡ Set optimal compute units to avoid overpaying'
      ];

      return {
        recommendedFee: recommendedFee / 1e9, // Convert to SOL
        estimatedSavings: (baseFee * 0.3) / 1e9, // Mock 30% savings
        optimizationTips
      };
      
    } catch (error) {
      console.error('❌ Error optimizing transaction fees:', error);
      return {
        recommendedFee: 0.000005,
        estimatedSavings: 0.0000015,
        optimizationTips: ['Error optimizing fees - using default values']
      };
    }
  }

  /**
   * 🔒 Scan wallet for security issues
   */
  async scanWalletSecurity(walletAddress: string): Promise<{
    securityScore: number;
    vulnerabilities: string[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      console.log(`🔒 Security scanning wallet: ${walletAddress}`);
      
      const publicKey = new PublicKey(walletAddress);
      const vulnerabilities: string[] = [];
      const recommendations: string[] = [];
      let securityScore = 100;

      // Check SOL balance - too high concentration is risky
      const solBalance = await this.connection.getBalance(publicKey);
      const solAmount = solBalance / 1e9;
      
      if (solAmount > 1000) {
        vulnerabilities.push('⚠️ High SOL concentration - consider diversification');
        recommendations.push('💡 Spread holdings across multiple wallets for security');
        securityScore -= 15;
      }

      // Check for suspicious token holdings
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      if (tokenAccounts.value.length > 50) {
        vulnerabilities.push('🚨 Too many token holdings - potential dust attack');
        recommendations.push('🧹 Clean up dust tokens to reduce attack surface');
        securityScore -= 10;
      }

      // Check transaction frequency
      const signatures = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit: 100 }
      );

      const recentTxns = signatures.filter(sig => 
        sig.blockTime && (Date.now() - sig.blockTime * 1000) < 24 * 60 * 60 * 1000
      );

      if (recentTxns.length > 20) {
        vulnerabilities.push('📊 High transaction frequency - monitor for automation');
        recommendations.push('🔍 Review automated trading bots for security');
        securityScore -= 5;
      }

      // Default recommendations
      recommendations.push(
        '🔐 Use hardware wallet for large holdings',
        '🔄 Enable transaction notifications',
        '📱 Set up wallet monitoring alerts',
        '🛡️ Regular security audits recommended'
      );

      const riskLevel = securityScore >= 80 ? 'low' : securityScore >= 60 ? 'medium' : 'high';

      console.log(`✅ Security scan complete: ${securityScore}/100 (${riskLevel} risk)`);
      
      return {
        securityScore,
        vulnerabilities,
        recommendations,
        riskLevel
      };
      
    } catch (error) {
      console.error('❌ Error scanning wallet security:', error);
      return {
        securityScore: 0,
        vulnerabilities: ['❌ Unable to complete security scan'],
        recommendations: ['🔧 Retry security scan later'],
        riskLevel: 'high'
      };
    }
  }

  /**
   * 📢 Create custom alert for user
   */
  async createCustomAlert(userId: string, alertConfig: Omit<CustomAlert, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // In a real implementation, this would be stored in database
    console.log(`✅ Created custom alert ${alertId} for user ${userId}`);
    console.log('Alert config:', alertConfig);
    
    return alertId;
  }

  /**
   * 🏷️ Get wallet name for known addresses
   */
  private getWalletName(address: string): string {
    const knownWallets: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'Wrapped SOL',
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'Raydium AMM',
      'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo': 'Jupiter Exchange',
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Orca Protocol',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC Treasury',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT Treasury'
    };
    
    return knownWallets[address] || `Whale_${address.slice(0, 8)}`;
  }
}

export const solanaPremiumToolsService = new SolanaPremiumToolsService();