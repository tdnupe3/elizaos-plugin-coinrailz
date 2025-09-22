import { Connection, PublicKey } from '@solana/web3.js';

export interface TokenAnalytics {
  tokenAddress: string;
  symbol: string;
  name: string;
  totalSupply: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  topHolders: Array<{
    address: string;
    balance: string;
    percentage: number;
  }>;
}

export interface WalletAnalytics {
  address: string;
  solBalance: number;
  tokenCount: number;
  totalValue: number;
  transactionCount: number;
  firstActivity: Date;
  lastActivity: Date;
  riskScore: number;
  tags: string[];
}

export interface HistoricalData {
  timestamp: Date;
  price: number;
  volume: number;
  transactions: number;
}

export interface ExportData {
  format: 'csv' | 'json' | 'xlsx';
  data: any[];
  filename: string;
  downloadUrl: string;
}

export class SolanaAnalyticsService {
  private connection: Connection;

  constructor() {
    const rpcUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * 📊 Get comprehensive token analytics
   */
  async getTokenAnalytics(tokenAddress: string): Promise<TokenAnalytics | null> {
    try {
      console.log(`📊 Analyzing token: ${tokenAddress}`);
      
      const tokenPublicKey = new PublicKey(tokenAddress);
      
      // Get token supply information
      const supply = await this.connection.getTokenSupply(tokenPublicKey);
      const totalSupply = supply.value.uiAmount || 0;
      
      // Mock data for comprehensive analytics (in production, integrate with price APIs)
      const analytics: TokenAnalytics = {
        tokenAddress,
        symbol: `TOKEN_${tokenAddress.slice(0, 6)}`,
        name: `Solana Token ${tokenAddress.slice(0, 8)}`,
        totalSupply: totalSupply.toString(),
        currentPrice: Math.random() * 10, // Mock price
        priceChange24h: (Math.random() - 0.5) * 20, // Mock change -10% to +10%
        volume24h: Math.random() * 1000000, // Mock volume
        marketCap: totalSupply * (Math.random() * 10),
        holders: Math.floor(Math.random() * 10000) + 100, // Mock holder count
        topHolders: await this.getTopHolders(tokenAddress)
      };

      console.log(`✅ Token analytics complete for ${analytics.symbol}`);
      return analytics;
      
    } catch (error) {
      console.error('❌ Error getting token analytics:', error);
      return null;
    }
  }

  /**
   * 👤 Get wallet analytics and insights
   */
  async getWalletAnalytics(walletAddress: string): Promise<WalletAnalytics | null> {
    try {
      console.log(`👤 Analyzing wallet: ${walletAddress}`);
      
      const publicKey = new PublicKey(walletAddress);
      
      // Get SOL balance
      const solBalance = await this.connection.getBalance(publicKey);
      const solAmount = solBalance / 1e9;
      
      // Get token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      // Get transaction history
      const signatures = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit: 1000 }
      );

      // Calculate analytics
      const tokenCount = tokenAccounts.value.filter(account => {
        const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
        return amount && parseFloat(amount) > 0;
      }).length;

      const totalValue = solAmount * 150 + (tokenCount * 50); // Mock valuation
      const transactionCount = signatures.length;
      
      const firstTx = signatures[signatures.length - 1];
      const lastTx = signatures[0];
      
      const firstActivity = firstTx?.blockTime ? new Date(firstTx.blockTime * 1000) : new Date();
      const lastActivity = lastTx?.blockTime ? new Date(lastTx.blockTime * 1000) : new Date();

      // Calculate risk score based on various factors
      let riskScore = 50; // Base score
      
      if (solAmount > 1000) riskScore += 20; // High value wallet
      if (tokenCount > 50) riskScore += 15; // Many tokens
      if (transactionCount > 1000) riskScore += 10; // Very active
      if (transactionCount < 10) riskScore -= 20; // Inactive
      
      riskScore = Math.max(0, Math.min(100, riskScore));

      // Generate tags
      const tags: string[] = [];
      if (solAmount > 100) tags.push('whale');
      if (tokenCount > 20) tags.push('collector');
      if (transactionCount > 500) tags.push('active_trader');
      if (solAmount < 1) tags.push('small_holder');

      const analytics: WalletAnalytics = {
        address: walletAddress,
        solBalance: solAmount,
        tokenCount,
        totalValue,
        transactionCount,
        firstActivity,
        lastActivity,
        riskScore,
        tags
      };

      console.log(`✅ Wallet analytics complete: $${totalValue.toFixed(2)} total value`);
      return analytics;
      
    } catch (error) {
      console.error('❌ Error getting wallet analytics:', error);
      return null;
    }
  }

  /**
   * 📈 Get historical data for token or wallet
   */
  async getHistoricalData(
    address: string, 
    type: 'token' | 'wallet',
    days: number = 30
  ): Promise<HistoricalData[]> {
    try {
      console.log(`📈 Getting ${days} days of historical data for ${type}: ${address}`);
      
      const historicalData: HistoricalData[] = [];
      
      // Generate mock historical data (in production, integrate with historical data APIs)
      const basePrice = Math.random() * 100;
      const baseVolume = Math.random() * 1000000;
      
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Simulate price movements
        const priceVariation = (Math.random() - 0.5) * 0.1; // ±5%
        const price = basePrice * (1 + priceVariation * (days - i) / days);
        
        const volumeVariation = (Math.random() - 0.5) * 0.3; // ±15%
        const volume = baseVolume * (1 + volumeVariation);
        
        historicalData.push({
          timestamp: date,
          price: Math.max(0.001, price),
          volume: Math.max(1000, volume),
          transactions: Math.floor(Math.random() * 1000) + 100
        });
      }
      
      console.log(`✅ Generated ${historicalData.length} historical data points`);
      return historicalData;
      
    } catch (error) {
      console.error('❌ Error getting historical data:', error);
      return [];
    }
  }

  /**
   * 📥 Export data in various formats
   */
  async exportData(
    data: any[],
    format: 'csv' | 'json' | 'xlsx',
    filename: string
  ): Promise<ExportData> {
    try {
      console.log(`📥 Exporting ${data.length} records as ${format}`);
      
      let processedData = data;
      
      // Format data based on export type
      if (format === 'csv') {
        processedData = this.convertToCSV(data);
      } else if (format === 'xlsx') {
        // In production, use a library like 'xlsx' to create Excel files
        processedData = data;
      }
      
      // In production, save to cloud storage and return download URL
      const downloadUrl = `/api/solana-analytics/download/${filename}.${format}`;
      
      const exportResult: ExportData = {
        format,
        data: processedData,
        filename: `${filename}.${format}`,
        downloadUrl
      };
      
      console.log(`✅ Export ready: ${filename}.${format}`);
      return exportResult;
      
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * 🔍 Search for similar wallets based on behavior patterns
   */
  async findSimilarWallets(targetWallet: string, limit: number = 10): Promise<WalletAnalytics[]> {
    try {
      console.log(`🔍 Finding wallets similar to: ${targetWallet}`);
      
      const targetAnalytics = await this.getWalletAnalytics(targetWallet);
      if (!targetAnalytics) {
        throw new Error('Could not analyze target wallet');
      }
      
      // Mock similar wallets (in production, use ML clustering or pattern matching)
      const similarWallets: WalletAnalytics[] = [];
      
      for (let i = 0; i < limit; i++) {
        // Generate similar wallet addresses
        const similarAddress = this.generateMockAddress();
        
        const similarAnalytics: WalletAnalytics = {
          address: similarAddress,
          solBalance: targetAnalytics.solBalance * (0.8 + Math.random() * 0.4), // ±20%
          tokenCount: Math.floor(targetAnalytics.tokenCount * (0.8 + Math.random() * 0.4)),
          totalValue: targetAnalytics.totalValue * (0.8 + Math.random() * 0.4),
          transactionCount: Math.floor(targetAnalytics.transactionCount * (0.8 + Math.random() * 0.4)),
          firstActivity: new Date(targetAnalytics.firstActivity.getTime() + (Math.random() - 0.5) * 30 * 24 * 60 * 60 * 1000),
          lastActivity: new Date(targetAnalytics.lastActivity.getTime() + (Math.random() - 0.5) * 7 * 24 * 60 * 60 * 1000),
          riskScore: targetAnalytics.riskScore + (Math.random() - 0.5) * 20,
          tags: targetAnalytics.tags.filter(() => Math.random() > 0.3) // Randomly keep some tags
        };
        
        similarWallets.push(similarAnalytics);
      }
      
      console.log(`✅ Found ${similarWallets.length} similar wallets`);
      return similarWallets;
      
    } catch (error) {
      console.error('❌ Error finding similar wallets:', error);
      return [];
    }
  }

  /**
   * 🔥 Get trending tokens analysis
   */
  async getTrendingTokens(limit: number = 20): Promise<TokenAnalytics[]> {
    try {
      console.log(`🔥 Getting top ${limit} trending tokens...`);
      
      const trendingTokens: TokenAnalytics[] = [];
      
      // Mock trending tokens (in production, integrate with token tracking APIs)
      for (let i = 0; i < limit; i++) {
        const tokenAddress = this.generateMockAddress();
        const tokenAnalytics = await this.getTokenAnalytics(tokenAddress);
        if (tokenAnalytics) {
          // Boost volume and price change for "trending" tokens
          tokenAnalytics.volume24h *= (2 + Math.random() * 3);
          tokenAnalytics.priceChange24h = Math.abs(tokenAnalytics.priceChange24h) * (1 + Math.random());
          trendingTokens.push(tokenAnalytics);
        }
      }
      
      // Sort by volume (trending indicator)
      trendingTokens.sort((a, b) => b.volume24h - a.volume24h);
      
      console.log(`✅ Found ${trendingTokens.length} trending tokens`);
      return trendingTokens;
      
    } catch (error) {
      console.error('❌ Error getting trending tokens:', error);
      return [];
    }
  }

  /**
   * 💎 Get top holders for a token
   */
  private async getTopHolders(tokenAddress: string): Promise<Array<{
    address: string;
    balance: string;
    percentage: number;
  }>> {
    try {
      // Mock top holders (in production, scan all token accounts)
      const topHolders = [];
      
      for (let i = 0; i < 10; i++) {
        const balance = Math.random() * 1000000;
        topHolders.push({
          address: this.generateMockAddress(),
          balance: balance.toFixed(2),
          percentage: Math.random() * 10
        });
      }
      
      return topHolders.sort((a, b) => b.percentage - a.percentage);
      
    } catch (error) {
      console.log('⚠️ Error getting top holders:', error);
      return [];
    }
  }

  /**
   * 🔄 Convert data to CSV format
   */
  private convertToCSV(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * 🎲 Generate mock Solana address for testing
   */
  private generateMockAddress(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const solanaAnalyticsService = new SolanaAnalyticsService();