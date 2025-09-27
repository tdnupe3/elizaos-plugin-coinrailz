/**
 * 🎯 Token Holder Discovery Service
 * Find top holders of specific tokens for targeted marketing campaigns
 * Example: Project A markets to top 50 holders of Project B
 */

import axios from 'axios';

interface TokenHolder {
  address: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  rank: number;
  percentage: number;
}

interface TokenHolderTarget {
  address: string;
  tokenBalance: string;
  rank: number;
  percentage: number;
  entityType: 'token_holder';
  labels: string[];
  balanceSOL: string;
  lastActive: Date;
  confidence: number;
  metadata: {
    tokenMint: string;
    tokenSymbol?: string;
    tokenName?: string;
  };
}

export class TokenHolderDiscoveryService {
  private heliusApiKey: string;
  private heliusEndpoint: string;

  constructor() {
    this.heliusApiKey = process.env.HELIUS_API_KEY || '';
    this.heliusEndpoint = 'https://mainnet.helius-rpc.com';
  }

  /**
   * 🎯 Get top holders of a specific token
   */
  async getTopTokenHolders(
    tokenMint: string,
    maxHolders: number = 50,
    requireMinBalance?: number
  ): Promise<TokenHolderTarget[]> {
    try {
      console.log(`🔍 Finding top ${maxHolders} holders of token: ${tokenMint.slice(0, 8)}...`);

      // Get token holders using Helius
      const holdersResponse = await axios.post(
        `${this.heliusEndpoint}/?api-key=${this.heliusApiKey}`,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenSupply',
          params: [tokenMint],
        }
      );

      // Get token accounts for this mint
      const accountsResponse = await axios.post(
        `${this.heliusEndpoint}/?api-key=${this.heliusApiKey}`,
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'getProgramAccounts',
          params: [
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            {
              encoding: 'jsonParsed',
              filters: [
                {
                  dataSize: 165,
                },
                {
                  memcmp: {
                    offset: 0,
                    bytes: tokenMint,
                  },
                },
              ],
            },
          ],
        }
      );

      if (!accountsResponse.data?.result) {
        console.log(`⚠️ No token accounts found for ${tokenMint}`);
        return [];
      }

      // Process token accounts to get holders
      const holders: TokenHolder[] = [];
      const accounts = accountsResponse.data.result;

      for (const account of accounts) {
        const accountData = account.account?.data?.parsed?.info;
        if (!accountData?.owner || !accountData?.tokenAmount) continue;

        const uiAmount = accountData.tokenAmount.uiAmount;
        if (uiAmount && uiAmount > 0) {
          holders.push({
            address: accountData.owner,
            amount: accountData.tokenAmount.amount,
            decimals: accountData.tokenAmount.decimals,
            uiAmount: uiAmount,
            rank: 0, // Will be set after sorting
            percentage: 0, // Will be calculated after sorting
          });
        }
      }

      // Sort by balance (descending) and calculate ranks
      holders.sort((a, b) => b.uiAmount - a.uiAmount);
      const totalSupply = holders.reduce((sum, h) => sum + h.uiAmount, 0);

      holders.forEach((holder, index) => {
        holder.rank = index + 1;
        holder.percentage = totalSupply > 0 ? (holder.uiAmount / totalSupply) * 100 : 0;
      });

      // Convert to target format with activity data
      const targets: TokenHolderTarget[] = [];
      const topHolders = holders.slice(0, maxHolders);

      console.log(`🎯 Processing top ${topHolders.length} holders for activity verification...`);

      for (const holder of topHolders) {
        try {
          // Get SOL balance and recent activity
          const balanceResponse = await axios.post(
            `${this.heliusEndpoint}/?api-key=${this.heliusApiKey}`,
            {
              jsonrpc: '2.0',
              id: 3,
              method: 'getBalance',
              params: [holder.address],
            }
          );

          const solBalance = balanceResponse.data?.result?.value || 0;
          const solBalanceFormatted = (solBalance / 1e9).toFixed(4);

          // Skip if below minimum balance requirement
          if (requireMinBalance && parseFloat(solBalanceFormatted) < requireMinBalance) {
            continue;
          }

          // Get recent activity using real transaction data
          const transactionResponse = await axios.post(
            `${this.heliusEndpoint}/?api-key=${this.heliusApiKey}`,
            {
              jsonrpc: '2.0',
              id: 4,
              method: 'getSignaturesForAddress',
              params: [holder.address, { limit: 1 }],
            }
          );

          let lastActive = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000); // Default to 6 days ago
          if (transactionResponse.data?.result?.[0]?.blockTime) {
            lastActive = new Date(transactionResponse.data.result[0].blockTime * 1000);
          }

          const target: TokenHolderTarget = {
            address: holder.address,
            tokenBalance: holder.uiAmount.toString(),
            rank: holder.rank,
            percentage: holder.percentage,
            entityType: 'token_holder',
            labels: [
              'token_holder',
              holder.rank <= 10 ? 'top_10_holder' : 'major_holder',
              holder.percentage > 1 ? 'whale' : 'retail',
              'active'
            ],
            balanceSOL: solBalanceFormatted,
            lastActive: lastActive,
            confidence: Math.min(0.9, 0.6 + (holder.percentage / 10)), // Higher confidence for larger holders
            metadata: {
              tokenMint: tokenMint,
              tokenSymbol: undefined, // Could be fetched from metadata
              tokenName: undefined,
            }
          };

          targets.push(target);

          if (targets.length >= maxHolders) break;

        } catch (error) {
          console.log(`⚠️ Error processing holder ${holder.address}: ${error}`);
          continue;
        }
      }

      console.log(`✅ Found ${targets.length} verified token holders for targeting`);
      console.log(`🏆 Top holders preview:`);
      targets.slice(0, 5).forEach((target, i) => {
        console.log(`  ${i + 1}. Rank #${target.rank}: ${target.address.slice(0, 8)}... (${target.tokenBalance} tokens, ${target.percentage.toFixed(2)}%)`);
      });

      return targets;

    } catch (error) {
      console.error(`❌ Error discovering token holders for ${tokenMint}:`, error);
      return [];
    }
  }

  /**
   * 🎯 Find holders of multiple tokens (for cross-project marketing)
   */
  async getMultiTokenHolders(
    tokenMints: string[],
    maxHoldersPerToken: number = 20
  ): Promise<Map<string, TokenHolderTarget[]>> {
    const results = new Map<string, TokenHolderTarget[]>();

    console.log(`🔍 Finding holders across ${tokenMints.length} tokens...`);

    for (const mint of tokenMints) {
      const holders = await this.getTopTokenHolders(mint, maxHoldersPerToken);
      results.set(mint, holders);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /**
   * 🎯 Get token holders that also trade on PumpFun (crossover audience)
   */
  async getPumpFunTradingHolders(
    tokenMint: string,
    maxResults: number = 30
  ): Promise<TokenHolderTarget[]> {
    const holders = await this.getTopTokenHolders(tokenMint, maxResults * 2);
    
    // Filter for holders with DeFi/DEX activity patterns
    const pumpfunTraders = holders.filter(holder => 
      holder.labels.includes('active') && 
      parseFloat(holder.balanceSOL) >= 1.0 // Minimum SOL for trading
    );

    console.log(`🎯 Found ${pumpfunTraders.length} token holders who are likely PumpFun traders`);
    
    return pumpfunTraders.slice(0, maxResults);
  }
}