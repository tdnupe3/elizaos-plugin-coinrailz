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
    const alchemyKey = process.env.ALCHEMY_API_KEY;
    const rpcUrl = alchemyKey
      ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://mainnet.base.org';
    this.baseProvider = new ethers.JsonRpcProvider(rpcUrl);
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
   * Dual-format: JSON header for agents + human-readable text for developers
   */
  private generateMessageData(): string {
    const jsonHeader = JSON.stringify({
      type: 'partner-invite',
      from: 'coinrailz',
      reply: 'support@coinrailz.com',
      catalog: 'https://coinrailz.com/api/x402/catalog',
      partner: 'https://coinrailz.com/partner',
      demo: 'https://coinrailz.com/api/satellite/fire-alerts?demo=true'
    });

    const message =
      `CRZ/1 ${jsonHeader}\n\n` +
      'Hi — Coin Railz here, fellow x402 builder.\n\n' +
      '60 live services: DeFi, prediction markets,\n' +
      'NASA/ESA satellite data, IoT feeds, AI inference.\n' +
      'All USDC on Base, no API keys.\n\n' +
      'Would love to feature your services or cross-list.\n\n' +
      'support@coinrailz.com\n' +
      'https://coinrailz.com/partner';

    console.log(`📏 Message length: ${message.length} characters`);

    return ethers.hexlify(ethers.toUtf8Bytes(message));
  }

  /**
   * Send on-chain message to a wallet (tiny ETH transfer with embedded message data)
   */
  async sendOnChainMessage(
    recipientAddress: string,
    amountETH: number = 0.000001 // Minimal transfer — message is in tx data, gas dominates cost
  ): Promise<{ success: boolean; txHash?: string; error?: string; cost?: string }> {
    try {
      console.log(`📤 Sending on-chain message to ${recipientAddress}...`);
      
      // Get message data
      const messageData = this.generateMessageData();
      
      // Use EOA_PRIVATE_KEY if set, otherwise fall back to EVM_PRIVATE_KEY (canary wallet)
      const privateKey = process.env.EOA_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('No outreach wallet configured — set EOA_PRIVATE_KEY or EVM_PRIVATE_KEY');
      }
      
      const wallet = new ethers.Wallet(privateKey, this.baseProvider);
      console.log(`💼 Using funded wallet: ${wallet.address}`);
      
      // Check balance
      const balance = await this.baseProvider.getBalance(wallet.address);
      const valueWei = ethers.parseEther(amountETH.toString());
      const gasEstimate = ethers.parseEther('0.0001'); // Conservative gas estimate
      
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);
      
      if (balance < valueWei + gasEstimate) {
        console.error(`❌ Insufficient balance: ${ethers.formatEther(balance)} ETH`);
        return {
          success: false,
          error: `Insufficient funds: ${ethers.formatEther(balance)} ETH available`
        };
      }
      
      // Prepare transaction with message embedded in data field
      const tx = {
        to: recipientAddress,
        value: valueWei,
        data: messageData, // Hex-encoded message
        gasLimit: 100000, // Generous limit for data
      };
      
      console.log(`💰 Sending ${amountETH} ETH to ${recipientAddress} with embedded message`);
      
      // Send transaction
      const txResponse = await wallet.sendTransaction(tx);
      console.log(`⏳ Transaction sent: ${txResponse.hash}`);
      
      // Wait for confirmation
      await txResponse.wait();
      console.log(`✅ Message delivered to ${recipientAddress}: ${txResponse.hash}`);
      
      return {
        success: true,
        txHash: txResponse.hash,
        cost: '$0.01' // Approximate Base chain cost
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
        const result = await this.sendOnChainMessage(wallet, 0.0001);
        
        if (result.success) {
          successCount++;
          results.push({ wallet, txHash: result.txHash });
          
          // Log to database (map to existing schema fields)
          await db.insert(outreachLogs).values({
            platform: 'base_blockchain',
            target: wallet,
            url: `https://basescan.org/tx/${result.txHash}`,
            status: 'sent'
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
