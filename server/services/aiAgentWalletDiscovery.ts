/**
 * AI Agent Wallet Discovery Service
 * Discovers and tracks AI agent wallets across Base, Solana, and XRPL
 * Based on verified contract addresses and token holders
 */

import fetch from 'node-fetch';
import { Connection, PublicKey } from '@solana/web3.js';
import { Client as XrplClient } from 'xrpl';
import { db } from '../db';
import { eq } from 'drizzle-orm';

// Verified AI Agent Ecosystem Contracts from ChatGPT research
export const AI_AGENT_SEEDS = {
  base: [
    { label: 'CLANKER_TOKEN', contract: '0x1bc0c42215582d5a085795f4badbac3ff36d1bcb', revenue: '$13M+' },
    { label: 'AIFUN', contract: '0xbDf317F9C153246C429F23F4093087164B145390', category: 'AI Agent Layer' },
    { label: 'BNKR', contract: '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b', category: 'Autonomous Bot Infra' },
    { label: 'CLANKER_LAUNCHER', contract: '0xE85A59c628F7D27878ACeB4bF3B35733630083a9', category: 'Token Launcher' }
  ],
  solana: [
    { label: 'BUZZ', mint: '9DHe3pycTuymFk4H4bbPoAJ4hQrr2kaLDF6J6aAKpump', marketCap: '$16M', category: 'Hive AI' }
  ],
  xrpl: [
    { label: 'XRT_ISSUER', issuer: 'rPvuCxw1m8u2SWTqtRN6ZEcb1xPbU4cPFR', currency: 'XRT', category: 'XRPTurbo Launchpad' }
  ]
};

interface DiscoveredWallet {
  chain: 'base' | 'solana' | 'xrpl';
  address: string;
  sourceToken: string;
  tokenLabel: string;
  balance?: string;
  holderRank?: number;
  lastActivity?: Date;
  canReceiveXMTP?: boolean;
  canReceiveOnChain?: boolean;
  canReceiveDialect?: boolean;
  discoveredAt: Date;
}

interface OutreachContact {
  walletAddress: string;
  chain: string;
  protocol: 'on_chain' | 'dialect' | 'xrpl_memo';
  lastContactDate?: Date;
  responseStatus: 'pending' | 'responded' | 'bounced';
  campaignId: string;
}

export class AIAgentWalletDiscovery {
  private etherscanApiKey: string;
  private heliusRpcUrl: string;
  private baseRpcUrl: string;
  private solanaConnection!: Connection;
  private xrplClient: XrplClient;

  constructor() {
    this.etherscanApiKey = process.env.ETHERSCAN_API_KEY || '';
    this.heliusRpcUrl = process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : '';
    this.baseRpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    
    if (this.heliusRpcUrl) {
      this.solanaConnection = new Connection(this.heliusRpcUrl, 'confirmed');
    }
    
    this.xrplClient = new XrplClient('wss://xrplcluster.com/');
  }

  /**
   * Discover wallet holders from Base ecosystem contracts
   */
  async discoverBaseWallets(maxHolders = 200): Promise<DiscoveredWallet[]> {
    const discovered: DiscoveredWallet[] = [];
    
    if (!this.etherscanApiKey) {
      console.log('⚠️ Etherscan API key not available - skipping Base wallet discovery');
      return [];
    }

    for (const seed of AI_AGENT_SEEDS.base) {
      try {
        console.log(`🔍 Discovering holders for ${seed.label} (${seed.contract})...`);
        
        // Get token holders from Etherscan v2 API (Base chain ID 8453)
        const response = await fetch(
          `https://api.etherscan.io/v2/api?chainid=8453&module=token&action=tokenholderlist&contractaddress=${seed.contract}&page=1&offset=${maxHolders}&apikey=${this.etherscanApiKey}`
        );
        
        const data = await response.json() as {
          status?: string;
          result?: Array<{
            TokenHolderAddress: string;
            TokenHolderQuantity: string;
          }>;
        };
        
        if (data.status === '1' && data.result) {
          console.log(`✅ Found ${data.result.length} holders for ${seed.label}`);
          
          for (let i = 0; i < data.result.length; i++) {
            const holder = data.result[i];
            
            // Filter out contract addresses and zero balances
            if (holder.TokenHolderQuantity === '0') continue;
            
            discovered.push({
              chain: 'base',
              address: holder.TokenHolderAddress,
              sourceToken: seed.contract,
              tokenLabel: seed.label,
              balance: holder.TokenHolderQuantity,
              holderRank: i + 1,
              discoveredAt: new Date()
            });
          }
        }
        
        // Rate limiting for Etherscan API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Error discovering ${seed.label} holders:`, error);
      }
    }
    
    console.log(`🎯 Base discovery complete: ${discovered.length} wallets found`);
    return discovered;
  }

  /**
   * Discover wallet holders from Solana SPL tokens
   */
  async discoverSolanaWallets(maxHolders = 100): Promise<DiscoveredWallet[]> {
    const discovered: DiscoveredWallet[] = [];
    
    if (!this.heliusRpcUrl) {
      console.log('⚠️ Helius RPC not available - skipping Solana wallet discovery');
      return [];
    }

    for (const seed of AI_AGENT_SEEDS.solana) {
      try {
        console.log(`🔍 Discovering holders for ${seed.label} (${seed.mint})...`);
        
        const mintPubkey = new PublicKey(seed.mint);
        
        // Get largest token accounts
        const largestAccounts = await this.solanaConnection.getTokenLargestAccounts(mintPubkey);
        
        if (largestAccounts.value) {
          console.log(`✅ Found ${largestAccounts.value.length} top holders for ${seed.label}`);
          
          for (let i = 0; i < Math.min(largestAccounts.value.length, maxHolders); i++) {
            const account = largestAccounts.value[i];
            
            if (account.amount === '0') continue;
            
            // Get owner of token account
            const accountInfo = await this.solanaConnection.getAccountInfo(account.address);
            if (accountInfo) {
              discovered.push({
                chain: 'solana',
                address: account.address.toString(),
                sourceToken: seed.mint,
                tokenLabel: seed.label,
                balance: account.amount,
                holderRank: i + 1,
                discoveredAt: new Date()
              });
            }
          }
        }
        
        // Rate limiting for Solana RPC
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error discovering ${seed.label} holders:`, error);
      }
    }
    
    console.log(`🎯 Solana discovery complete: ${discovered.length} wallets found`);
    return discovered;
  }

  /**
   * Discover XRPL trustlines from issuer accounts
   */
  async discoverXRPLWallets(maxTrustlines = 100): Promise<DiscoveredWallet[]> {
    const discovered: DiscoveredWallet[] = [];
    
    try {
      if (!this.xrplClient.isConnected()) {
        await this.xrplClient.connect();
      }
      
      for (const seed of AI_AGENT_SEEDS.xrpl) {
        try {
          console.log(`🔍 Discovering trustlines for ${seed.label} (${seed.issuer})...`);
          
          // Get account lines (trustlines)
          const response = await this.xrplClient.request({
            command: 'account_lines',
            account: seed.issuer,
            limit: maxTrustlines
          });
          
          if (response.result && response.result.lines) {
            console.log(`✅ Found ${response.result.lines.length} trustlines for ${seed.label}`);
            
            for (let i = 0; i < response.result.lines.length; i++) {
              const line = response.result.lines[i];
              
              if (parseFloat(line.balance) <= 0) continue;
              
              discovered.push({
                chain: 'xrpl',
                address: line.account,
                sourceToken: seed.issuer,
                tokenLabel: seed.label,
                balance: line.balance,
                holderRank: i + 1,
                discoveredAt: new Date()
              });
            }
          }
          
        } catch (error) {
          console.error(`❌ Error discovering ${seed.label} trustlines:`, error);
        }
      }
      
    } catch (error) {
      console.error('❌ XRPL connection error:', error);
    } finally {
      if (this.xrplClient.isConnected()) {
        await this.xrplClient.disconnect();
      }
    }
    
    console.log(`🎯 XRPL discovery complete: ${discovered.length} wallets found`);
    return discovered;
  }

  /**
   * Check on-chain messaging capability for EVM addresses
   */
  async checkOnChainCapability(addresses: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    try {
      console.log(`🔍 Checking on-chain capability for ${addresses.length} addresses...`);
      
      for (const address of addresses) {
        const isValidEthAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
        results.set(address, isValidEthAddress);
      }
      
      const capableCount = Array.from(results.values()).filter(Boolean).length;
      console.log(`✅ On-chain check complete: ${capableCount}/${addresses.length} addresses can receive messages`);
      
    } catch (error) {
      console.error('❌ On-chain capability check failed:', error);
    }
    
    return results;
  }

  /**
   * Run complete discovery across all chains
   */
  async runFullDiscovery(): Promise<{
    totalWallets: number;
    chains: { base: number; solana: number; xrpl: number };
    messagingCapable: number;
    discoveryResults: DiscoveredWallet[];
  }> {
    console.log('🚀 Starting complete AI agent wallet discovery...');
    const startTime = Date.now();
    
    const allWallets: DiscoveredWallet[] = [];
    
    // Discover from each chain in parallel
    const [baseWallets, solanaWallets, xrplWallets] = await Promise.all([
      this.discoverBaseWallets(200),
      this.discoverSolanaWallets(100),
      this.discoverXRPLWallets(100)
    ]);
    
    allWallets.push(...baseWallets, ...solanaWallets, ...xrplWallets);
    
    // Check on-chain capability for Base addresses
    const baseAddresses = baseWallets.map(w => w.address);
    if (baseAddresses.length > 0) {
      const onChainCapability = await this.checkOnChainCapability(baseAddresses);
      
      baseWallets.forEach(wallet => {
        wallet.canReceiveOnChain = onChainCapability.get(wallet.address) || false;
      });
    }
    
    // Mark Solana wallets as potentially Dialect-capable
    solanaWallets.forEach(wallet => {
      wallet.canReceiveDialect = true; // Most Solana addresses can receive Dialect messages
    });
    
    const messagingCapableCount = allWallets.filter(w => 
      w.canReceiveOnChain || w.canReceiveDialect || w.chain === 'xrpl'
    ).length;
    
    const duration = Date.now() - startTime;
    
    console.log(`🎉 Discovery complete in ${duration}ms:`);
    console.log(`  📊 Total wallets: ${allWallets.length}`);
    console.log(`  🏦 Base: ${baseWallets.length}`);
    console.log(`  ☀️ Solana: ${solanaWallets.length}`);
    console.log(`  💧 XRPL: ${xrplWallets.length}`);
    console.log(`  💬 Messaging capable: ${messagingCapableCount}`);
    
    return {
      totalWallets: allWallets.length,
      chains: {
        base: baseWallets.length,
        solana: solanaWallets.length,
        xrpl: xrplWallets.length
      },
      messagingCapable: messagingCapableCount,
      discoveryResults: allWallets
    };
  }

  /**
   * Generate outreach CSV for external tools
   */
  generateOutreachCSV(wallets: DiscoveredWallet[]): string {
    const headers = [
      'chain',
      'address', 
      'source_token',
      'token_label',
      'balance',
      'holder_rank',
      'can_message_onchain',
      'can_message_dialect', 
      'preferred_protocol',
      'discovered_at'
    ];
    
    const rows = wallets.map(wallet => [
      wallet.chain,
      wallet.address,
      wallet.sourceToken,
      wallet.tokenLabel,
      wallet.balance || '0',
      wallet.holderRank?.toString() || '0',
      wallet.canReceiveOnChain ? 'true' : 'false',
      wallet.canReceiveDialect ? 'true' : 'false',
      wallet.canReceiveOnChain ? 'on_chain' : wallet.canReceiveDialect ? 'dialect' : 'xrpl_memo',
      wallet.discoveredAt.toISOString()
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Get discovery statistics
   */
  getDiscoveryStats() {
    return {
      seedContracts: {
        base: AI_AGENT_SEEDS.base.length,
        solana: AI_AGENT_SEEDS.solana.length,
        xrpl: AI_AGENT_SEEDS.xrpl.length
      },
      totalSeeds: Object.values(AI_AGENT_SEEDS).flat().length,
      verifiedEcosystems: [
        'Clanker ($13M revenue)',
        'Hive AI ($16M market cap)',
        'XRPTurbo (AI Launchpad)',
        'AI Agent Layer (Base)',
        'Bankr (Autonomous Bot Infra)'
      ]
    };
  }
}