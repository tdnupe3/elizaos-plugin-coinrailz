/**
 * MACHINE-READABLE OUTREACH PAYLOAD SERVICE
 * 
 * Generates structured, parseable payloads for AI agent outreach.
 * Designed for on-chain transmission where recipients are automated systems.
 * 
 * Format: x402-discovery-v1
 * Target: CDP Agent Wallets, Autonomous Agents, AI Trading Bots
 */

import { ethers } from 'ethers';
import { CoinbaseCDPService } from './coinbaseCDPService';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, and, sql, isNotNull, ne } from 'drizzle-orm';

/**
 * x402 Discovery Protocol Payload
 * Machine-readable format for AI agents to auto-discover payment services
 */
export interface X402DiscoveryPayload {
  protocol: 'x402-discovery';
  version: 1;
  type: 'service_announcement' | 'partnership_offer' | 'integration_request';
  sender: {
    platform: string;
    wallet: string;
    contact: string;
  };
  services: {
    count: number;
    catalog_url: string;
    pricing_range_usd: string;
    facilitator: string;
    networks: string[];
  };
  action: {
    discover: string;
    ping: string;
    docs: string;
  };
  metadata: {
    timestamp: number;
    tracking_id: string;
    expires: number;
  };
}

/**
 * Compact on-chain payload (gas-optimized)
 * Minimal JSON for low-cost transmission
 * 
 * Note: Authenticity verified by tx.from (sender address).
 * AI agents should validate tx.from matches payload.s (sender)
 */
export interface CompactOnchainPayload {
  p: 'x402';      // protocol
  v: 2;           // version
  t: 's' | 'p';   // type: service/partnership
  s: string;      // sender wallet (for verification against tx.from)
  c: string;      // catalog URL
  n: number;      // service count
  $: string;      // price range
  f: string;      // facilitator
  x: string;      // tracking id
  e: number;      // expiry timestamp (Unix seconds)
}

export class MachineReadableOutreach {
  private static instance: MachineReadableOutreach | null = null;
  private platformWallet: string | null = null;

  private constructor() {}

  public static getInstance(): MachineReadableOutreach {
    if (!MachineReadableOutreach.instance) {
      MachineReadableOutreach.instance = new MachineReadableOutreach();
    }
    return MachineReadableOutreach.instance;
  }

  /**
   * Generate full discovery payload for documentation/API responses
   */
  generateFullPayload(trackingId?: string): X402DiscoveryPayload {
    return {
      protocol: 'x402-discovery',
      version: 1,
      type: 'service_announcement',
      sender: {
        platform: 'coinrailz.com',
        wallet: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
        contact: 'support@coinrailz.com'
      },
      services: {
        count: 44,
        catalog_url: 'https://coinrailz.com/x402/catalog',
        pricing_range_usd: '$0.01-$0.25',
        facilitator: 'coinbase-cdp',
        networks: ['base', 'ethereum', 'polygon', 'arbitrum']
      },
      action: {
        discover: 'https://coinrailz.com/x402/catalog',
        ping: 'https://coinrailz.com/x402/ping',
        docs: 'https://coinrailz.com/docs/x402'
      },
      metadata: {
        timestamp: Date.now(),
        tracking_id: trackingId || this.generateTrackingId(),
        expires: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
      }
    };
  }

  /**
   * Generate compact payload for on-chain transmission
   * Optimized for minimal gas cost while remaining machine-parseable
   * 
   * Security: Includes sender address for verification against tx.from
   * and expiry timestamp to prevent replay attacks
   */
  generateCompactPayload(trackingId?: string): CompactOnchainPayload {
    const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
    const expiryDays = 30;
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
    
    return {
      p: 'x402',
      v: 2,
      t: 's',
      s: PLATFORM_WALLET,  // Sender for verification against tx.from
      c: 'https://coinrailz.com/x402/catalog',
      n: 44,
      $: '0.01-0.25',
      f: 'cdp',
      x: trackingId || this.generateTrackingId(),
      e: expiryTimestamp   // Expiry for replay protection
    };
  }

  /**
   * Convert payload to hex-encoded calldata for on-chain transmission
   */
  payloadToCalldata(payload: CompactOnchainPayload | X402DiscoveryPayload): string {
    const jsonString = JSON.stringify(payload);
    return ethers.hexlify(ethers.toUtf8Bytes(jsonString));
  }

  /**
   * Estimate gas cost for payload transmission on Base
   */
  async estimateGasCost(payload: CompactOnchainPayload | X402DiscoveryPayload): Promise<{
    gasCostWei: bigint;
    gasCostUSD: number;
    bytesSize: number;
  }> {
    const calldata = this.payloadToCalldata(payload);
    const bytesSize = (calldata.length - 2) / 2; // Remove '0x' and count bytes
    
    // Base chain gas estimation
    // ~16 gas per non-zero byte, ~4 gas per zero byte
    // Plus 21000 base transaction cost
    const estimatedGas = BigInt(21000 + bytesSize * 16);
    
    // Base chain gas price ~0.001 gwei average
    const gasPrice = BigInt(1000000); // 0.001 gwei in wei
    const gasCostWei = estimatedGas * gasPrice;
    
    // ETH price ~$2800
    const ethPrice = 2800;
    const gasCostETH = Number(gasCostWei) / 1e18;
    const gasCostUSD = gasCostETH * ethPrice;

    return {
      gasCostWei,
      gasCostUSD,
      bytesSize
    };
  }

  /**
   * Generate unique tracking ID for attribution
   */
  generateTrackingId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `crz_${timestamp}_${random}`;
  }

  /**
   * Get target wallets for outreach campaign
   * Security: Uses parameterized queries to prevent SQL injection
   */
  async getTargetWallets(options: {
    limit?: number;
    minScore?: number;
    sources?: string[];
    excludeContacted?: boolean;
  } = {}): Promise<Array<{
    id: number;
    wallet: string;
    source: string;
    score: number;
  }>> {
    const conditions = [
      sql`${discoveredAgents.wallet} IS NOT NULL`,
      sql`${discoveredAgents.wallet} != ''`,
      sql`${discoveredAgents.wallet} ~ '^0x[a-fA-F0-9]{40}$'`
    ];

    if (options.minScore) {
      conditions.push(sql`${discoveredAgents.score} >= ${options.minScore}`);
    }

    // Security: Use parameterized query with inArray instead of sql.raw
    if (options.sources && options.sources.length > 0) {
      // Sanitize sources - only allow alphanumeric, hyphens, underscores
      const sanitizedSources = options.sources
        .filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
        .slice(0, 10); // Limit to 10 sources max
      
      if (sanitizedSources.length > 0) {
        conditions.push(sql`${discoveredAgents.source} = ANY(${sanitizedSources})`);
      }
    }

    if (options.excludeContacted) {
      conditions.push(sql`${discoveredAgents.lastContactAt} IS NULL`);
    }

    const results = await db
      .select({
        id: discoveredAgents.id,
        wallet: discoveredAgents.wallet,
        source: discoveredAgents.source,
        score: discoveredAgents.score
      })
      .from(discoveredAgents)
      .where(and(...conditions))
      .orderBy(sql`${discoveredAgents.score} DESC NULLS LAST`)
      .limit(options.limit || 100);

    return results.map(r => ({
      id: r.id,
      wallet: r.wallet!,
      source: r.source || 'unknown',
      score: r.score || 0
    }));
  }

  /**
   * Send on-chain message with machine-readable payload
   */
  async sendOnchainOutreach(
    targetWallet: string,
    payload: CompactOnchainPayload,
    options: { dryRun?: boolean } = {}
  ): Promise<{
    success: boolean;
    txHash?: string;
    gasCostUSD?: number;
    error?: string;
  }> {
    try {
      const calldata = this.payloadToCalldata(payload);
      const gasEstimate = await this.estimateGasCost(payload);

      if (options.dryRun) {
        return {
          success: true,
          gasCostUSD: gasEstimate.gasCostUSD
        };
      }

      // Get platform signer
      const signer = await CoinbaseCDPService.getPlatformSigner('base');
      
      // Create and send transaction
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const connectedSigner = signer.connect(provider);
      
      const tx = await connectedSigner.sendTransaction({
        to: targetWallet,
        value: ethers.parseEther('0.000001'), // Dust amount
        data: calldata
      });

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt?.hash,
        gasCostUSD: gasEstimate.gasCostUSD
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Generate campaign report
   */
  generateCampaignPlan(targetCount: number): {
    targets: number;
    payloadType: string;
    estimatedCostUSD: number;
    expectedResponseRate: string;
    expectedResponses: number;
  } {
    // Compact payload is ~150 bytes, costing ~$0.002 per message
    const costPerMessage = 0.002;
    const estimatedCostUSD = targetCount * costPerMessage;
    const responseRate = 0.02; // 2% expected
    const expectedResponses = Math.round(targetCount * responseRate);

    return {
      targets: targetCount,
      payloadType: 'x402-compact-v2',
      estimatedCostUSD,
      expectedResponseRate: '1-3%',
      expectedResponses
    };
  }
}

// Export singleton getter
export const getMachineReadableOutreach = () => MachineReadableOutreach.getInstance();
