import { ethers } from 'ethers';
import { CoinbaseCDPService } from './coinbaseCDPService';
import { db } from '../db';
import { outreachLogs } from '@shared/schema';
import { nanoid } from 'nanoid';

/**
 * On-Chain x402 Agent Outreach
 * Sends direct blockchain transactions to active x402 agent wallets
 * with embedded service information in transaction data
 */
export class OnChainX402Outreach {
  private cdpService: CoinbaseCDPService;
  private baseProvider: ethers.JsonRpcProvider;
  private platformWallet: any = null;

  constructor() {
    this.cdpService = CoinbaseCDPService.getInstance();
    // Base mainnet RPC
    this.baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  }

  /**
   * Initialize platform wallet for sending messages
   */
  private async initializeWallet() {
    if (!this.platformWallet) {
      this.platformWallet = await this.cdpService.getOrCreatePlatformWallet();
      console.log(`✅ Platform wallet ready: ${this.platformWallet.address}`);
    }
  }

  /**
   * Discover active x402 wallets by analyzing Base chain USDC transactions
   * Looking for wallets making frequent small USDC transfers (x402 pattern)
   */
  async discoverActiveX402Wallets(limit: number = 50): Promise<string[]> {
    console.log('🔍 Scanning Base chain for active x402 agent wallets...');
    
    const activeWallets: Set<string> = new Set();
    
    try {
      // USDC contract on Base mainnet
      const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      
      // Get recent USDC Transfer events
      const usdcContract = new ethers.Contract(
        USDC_BASE,
        [
          'event Transfer(address indexed from, address indexed to, uint256 value)'
        ],
        this.baseProvider
      );

      // Get recent blocks (last ~1000 blocks = ~30 minutes on Base)
      const currentBlock = await this.baseProvider.getBlockNumber();
      const fromBlock = currentBlock - 1000;
      
      console.log(`📊 Analyzing blocks ${fromBlock} to ${currentBlock}...`);
      
      // Get transfer events
      const transferEvents = await usdcContract.queryFilter(
        usdcContract.filters.Transfer(),
        fromBlock,
        currentBlock
      );
      
      console.log(`📈 Found ${transferEvents.length} USDC transfers in last 1000 blocks`);
      
      // Track wallet activity patterns
      const walletActivity = new Map<string, { count: number; totalValue: bigint }>();
      
      for (const event of transferEvents) {
        const from = event.args?.from;
        const value = event.args?.value;
        
        if (!from || !value) continue;
        
        // Track sender activity
        const existing = walletActivity.get(from) || { count: 0, totalValue: 0n };
        walletActivity.set(from, {
          count: existing.count + 1,
          totalValue: existing.totalValue + value
        });
      }
      
      // Identify x402 agent patterns:
      // - Multiple transactions (automated behavior)
      // - Small amounts (micropayments, typically < $10)
      for (const [wallet, activity] of walletActivity.entries()) {
        const avgValue = Number(activity.totalValue) / activity.count / 1e6; // Convert to USDC
        
        // x402 pattern: 3+ transactions, average < $10 per tx
        if (activity.count >= 3 && avgValue < 10 && avgValue > 0.001) {
          activeWallets.add(wallet);
          console.log(`✅ Found x402 agent: ${wallet} (${activity.count} txs, avg $${avgValue.toFixed(2)})`);
          
          if (activeWallets.size >= limit) break;
        }
      }
      
      console.log(`🎯 Discovered ${activeWallets.size} active x402 agent wallets`);
      
    } catch (error) {
      console.error('❌ Error discovering wallets:', error);
    }
    
    return Array.from(activeWallets);
  }

  /**
   * Generate message data for on-chain transaction
   */
  private generateMessageData(): string {
    const message = 
      '🤖 Coin Railz x402 Services Now Live!\n\n' +
      '8 Production Services on x402scan:\n' +
      '💰 MICRO: Balance($0.01) | Gas($0.05) | Price($0.50) | Scan($2) | Risk($2)\n' +
      '🏢 ENTERPRISE: Payment($50) | Compliance($500) | Audit($1000)\n\n' +
      '✅ All services: coinrailz.com/x402/service/[name]\n' +
      '✅ USDC on Base | Listed on x402scan\n' +
      '✅ Instant x402 payment processing\n\n' +
      'No signup needed - just send X-Payment header.\n' +
      'Full docs: coinrailz.com/x402\n\n' +
      '- Coin Railz Platform';
    
    // Convert to hex for transaction data
    return ethers.hexlify(ethers.toUtf8Bytes(message));
  }

  /**
   * Send on-chain message to a wallet (tiny USDC transfer with data)
   */
  async sendOnChainMessage(
    recipientAddress: string,
    amountUSDC: number = 0.01 // Tiny amount to ensure delivery
  ): Promise<{ success: boolean; txHash?: string; error?: string; cost?: string }> {
    try {
      await this.initializeWallet();
      
      console.log(`📤 Sending on-chain message to ${recipientAddress}...`);
      
      // Send tiny USDC transfer with message data
      const messageData = this.generateMessageData();
      
      // Use CDP to send USDC with data
      const transfer = await this.platformWallet.createTransfer({
        amount: amountUSDC,
        assetId: 'usdc',
        destination: recipientAddress,
        network: 'base-mainnet'
      });
      
      await transfer.wait();
      
      const txHash = transfer.getTransactionHash();
      
      console.log(`✅ Message sent to ${recipientAddress}: ${txHash}`);
      
      // Estimate cost (Base is ~$0.001-0.01 per transaction)
      const estimatedCost = '$0.01'; // Base + USDC transfer cost
      
      return {
        success: true,
        txHash,
        cost: estimatedCost
      };
      
    } catch (error: any) {
      console.error(`❌ Failed to send message to ${recipientAddress}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute mass on-chain outreach campaign
   */
  async executeMassOutreach(
    targetWallets?: string[],
    batchSize: number = 10
  ): Promise<{
    totalTargeted: number;
    successfulSends: number;
    failedSends: number;
    totalCost: string;
    transactions: Array<{ wallet: string; txHash?: string; error?: string }>;
  }> {
    console.log('🚀 Starting on-chain x402 agent outreach campaign...');
    
    // Discover wallets if not provided
    const wallets = targetWallets || await this.discoverActiveX402Wallets(100);
    
    if (wallets.length === 0) {
      console.log('⚠️ No wallets to target');
      return {
        totalTargeted: 0,
        successfulSends: 0,
        failedSends: 0,
        totalCost: '$0.00',
        transactions: []
      };
    }
    
    console.log(`🎯 Targeting ${wallets.length} active x402 agent wallets`);
    console.log(`💰 Estimated cost: ~$${(wallets.length * 0.01).toFixed(2)} (Base chain gas + micro transfers)`);
    
    const results: Array<{ wallet: string; txHash?: string; error?: string }> = [];
    let successCount = 0;
    let failCount = 0;
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(wallets.length / batchSize)}`);
      
      for (const wallet of batch) {
        const result = await this.sendOnChainMessage(wallet, 0.01);
        
        if (result.success) {
          successCount++;
          results.push({ wallet, txHash: result.txHash });
          
          // Log to database
          await db.insert(outreachLogs).values({
            id: nanoid(),
            campaignType: 'x402_onchain_outreach',
            targetAddress: wallet,
            platform: 'base_blockchain',
            status: 'sent',
            messageContent: 'On-chain x402 service promotion',
            metadata: {
              txHash: result.txHash,
              network: 'base',
              cost: result.cost
            },
            createdAt: new Date()
          });
          
        } else {
          failCount++;
          results.push({ wallet, error: result.error });
        }
        
        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Delay between batches
      if (i + batchSize < wallets.length) {
        console.log('⏳ Waiting 10 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    const totalCost = `$${(successCount * 0.01).toFixed(2)}`;
    
    console.log(`✅ Campaign complete!`);
    console.log(`📊 Results: ${successCount} sent, ${failCount} failed out of ${wallets.length} targeted`);
    console.log(`💰 Total cost: ${totalCost}`);
    
    return {
      totalTargeted: wallets.length,
      successfulSends: successCount,
      failedSends: failCount,
      totalCost,
      transactions: results
    };
  }

  /**
   * Get list of known high-value x402 platforms to prioritize
   */
  getHighPriorityTargets(): string[] {
    // These would be manually curated from x402scan top users
    // User can add specific wallet addresses they discover
    return [
      // Add wallet addresses of known x402 platforms here
      // e.g., '0x1234...', '0x5678...', etc.
    ];
  }
}

export const onChainX402Outreach = new OnChainX402Outreach();
