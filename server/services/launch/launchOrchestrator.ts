import { launcherWalletService, LauncherWalletStatus } from './launcherWalletService';
import { pumpfunService, generateBotAttractiveMetadata, LaunchConfig, LaunchResult, TokenMetadata } from './pumpfunService';
import { db } from '../../db';
import { tokenLauncherCampaigns, tokenLauncherLaunches } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export interface Campaign {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  mode: 'paper' | 'live';
  config: CampaignConfig;
  stats: CampaignStats;
  launches: LaunchRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignConfig {
  targetLaunches: number;
  initialLiquiditySol: number;
  priorityFeeMicroLamports: number;
  takeProfitMultiple: number;
  stopLossPercent: number;
  delayBetweenLaunchesMs: number;
  maxConcurrentPositions: number;
}

export interface CampaignStats {
  totalLaunches: number;
  successfulLaunches: number;
  failedLaunches: number;
  totalSpentSol: number;
  totalRecoveredSol: number;
  profitLossSol: number;
  profitLossUsd: number;
  bestPerformer?: {
    tokenMint: string;
    returnMultiple: number;
  };
}

export interface LaunchRecord {
  id: string;
  campaignId: string;
  tokenMint?: string;
  metadata: TokenMetadata;
  status: 'launched' | 'monitoring' | 'exited' | 'failed' | 'paper';
  launchTime: Date;
  exitTime?: Date;
  costSol: number;
  recoverySol: number;
  profitLossSol: number;
  bondingCurveProgress?: number;
  signature?: string;
  exitSignature?: string;
  error?: string;
}

export class LaunchOrchestrator {
  private static instance: LaunchOrchestrator;
  private activeCampaignId: string | null = null;
  private isRunning = false;

  public static getInstance(): LaunchOrchestrator {
    if (!this.instance) {
      this.instance = new LaunchOrchestrator();
    }
    return this.instance;
  }

  async getStatus(): Promise<{
    wallet: LauncherWalletStatus;
    activeCampaign: Campaign | null;
    isRunning: boolean;
    totalCampaigns: number;
  }> {
    const wallet = await launcherWalletService.getStatus();
    let activeCampaign: Campaign | null = null;
    let totalCampaigns = 0;

    try {
      const campaigns = await db.select().from(tokenLauncherCampaigns);
      totalCampaigns = campaigns.length;
      
      if (this.activeCampaignId) {
        const activeCampaignData = campaigns.find(c => c.id === this.activeCampaignId);
        if (activeCampaignData) {
          activeCampaign = await this.loadCampaignWithLaunches(activeCampaignData);
        }
      }
    } catch (error) {
      console.error('Error fetching campaigns from database:', error);
    }

    return {
      wallet,
      activeCampaign,
      isRunning: this.isRunning,
      totalCampaigns
    };
  }

  private async loadCampaignWithLaunches(dbCampaign: any): Promise<Campaign> {
    const launches = await db.select()
      .from(tokenLauncherLaunches)
      .where(eq(tokenLauncherLaunches.campaignId, dbCampaign.id))
      .orderBy(desc(tokenLauncherLaunches.createdAt));

    return {
      id: dbCampaign.id,
      name: dbCampaign.name,
      status: dbCampaign.status as Campaign['status'],
      mode: dbCampaign.mode as Campaign['mode'],
      config: dbCampaign.config as CampaignConfig,
      stats: dbCampaign.stats as CampaignStats,
      launches: launches.map(l => ({
        id: l.id,
        campaignId: l.campaignId,
        tokenMint: l.tokenMint || undefined,
        metadata: l.metadata as TokenMetadata,
        status: l.status as LaunchRecord['status'],
        launchTime: l.launchTime || new Date(),
        exitTime: l.exitTime || undefined,
        costSol: parseFloat(l.costSol || '0'),
        recoverySol: parseFloat(l.recoverySol || '0'),
        profitLossSol: parseFloat(l.profitLossSol || '0'),
        signature: l.signature || undefined,
        error: l.errorMessage || undefined
      })),
      createdAt: dbCampaign.createdAt || new Date(),
      updatedAt: dbCampaign.updatedAt || new Date()
    };
  }

  async createCampaign(name: string, config: Partial<CampaignConfig>, mode: 'paper' | 'live' = 'paper'): Promise<Campaign> {
    const id = `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const defaultConfig: CampaignConfig = {
      targetLaunches: 10,
      initialLiquiditySol: 0.5,
      priorityFeeMicroLamports: 200000,
      takeProfitMultiple: 3,
      stopLossPercent: 20,
      delayBetweenLaunchesMs: 30000,
      maxConcurrentPositions: 2,
      ...config
    };

    const stats: CampaignStats = {
      totalLaunches: 0,
      successfulLaunches: 0,
      failedLaunches: 0,
      totalSpentSol: 0,
      totalRecoveredSol: 0,
      profitLossSol: 0,
      profitLossUsd: 0
    };

    const wallet = await launcherWalletService.getStatus();

    await db.insert(tokenLauncherCampaigns).values({
      id,
      name,
      status: 'pending',
      mode,
      config: defaultConfig,
      stats,
      walletAddress: wallet.address
    });

    console.log(`📋 Created campaign: ${name} (${id}) - Mode: ${mode}`);
    
    return {
      id,
      name,
      status: 'pending',
      mode,
      config: defaultConfig,
      stats,
      launches: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async startCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    const dbCampaigns = await db.select()
      .from(tokenLauncherCampaigns)
      .where(eq(tokenLauncherCampaigns.id, campaignId));

    if (!dbCampaigns.length) {
      return { success: false, error: 'Campaign not found' };
    }

    const dbCampaign = dbCampaigns[0];
    const campaign = await this.loadCampaignWithLaunches(dbCampaign);

    if (this.isRunning) {
      return { success: false, error: 'Another campaign is already running' };
    }

    const wallet = await launcherWalletService.getStatus();
    
    if (campaign.mode === 'live' && !wallet.initialized) {
      return { success: false, error: 'Launcher wallet not initialized for live mode' };
    }

    const estimatedCost = await pumpfunService.estimateLaunchCost(campaign.config.initialLiquiditySol);
    const totalNeeded = estimatedCost.totalSol * campaign.config.targetLaunches;

    if (campaign.mode === 'live' && wallet.balanceSol < totalNeeded) {
      return { 
        success: false, 
        error: `Insufficient funds. Have ${wallet.balanceSol.toFixed(4)} SOL, need ~${totalNeeded.toFixed(4)} SOL for ${campaign.config.targetLaunches} launches` 
      };
    }

    await db.update(tokenLauncherCampaigns)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(tokenLauncherCampaigns.id, campaignId));

    campaign.status = 'running';
    this.activeCampaignId = campaignId;
    this.isRunning = true;

    console.log(`🚀 Starting campaign: ${campaign.name}`);
    
    this.runCampaignLoop(campaign);

    return { success: true };
  }

  private async runCampaignLoop(campaign: Campaign) {
    while (
      this.isRunning && 
      campaign.status === 'running' && 
      campaign.stats.totalLaunches < campaign.config.targetLaunches
    ) {
      try {
        const metadata = generateBotAttractiveMetadata();
        
        const launchConfig: LaunchConfig = {
          metadata,
          initialLiquiditySol: campaign.config.initialLiquiditySol,
          priorityFeeMicroLamports: campaign.config.priorityFeeMicroLamports,
          mode: campaign.mode
        };

        console.log(`\n🎯 Launch #${campaign.stats.totalLaunches + 1}: ${metadata.name} (${metadata.symbol})`);

        const result = await pumpfunService.launchToken(launchConfig);

        const launchId = `launch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const launchStatus = result.success ? (campaign.mode === 'paper' ? 'exited' : 'monitoring') : 'failed';
        let recoverySol = 0;
        let profitLossSol = -result.cost.totalSol;

        if (result.success && campaign.mode === 'paper') {
          const simulatedReturn = this.simulateTradeOutcome(campaign.config);
          recoverySol = result.cost.liquiditySol * simulatedReturn;
          profitLossSol = recoverySol - result.cost.totalSol;
          
          if (profitLossSol > 0) {
            console.log(`   ✅ Simulated profit: +${profitLossSol.toFixed(4)} SOL (${(simulatedReturn * 100 - 100).toFixed(1)}%)`);
          } else {
            console.log(`   ❌ Simulated loss: ${profitLossSol.toFixed(4)} SOL`);
          }
        }

        await db.insert(tokenLauncherLaunches).values({
          id: launchId,
          campaignId: campaign.id,
          tokenMint: result.tokenMint,
          metadata: metadata,
          status: launchStatus,
          launchTime: new Date(),
          exitTime: campaign.mode === 'paper' ? new Date() : null,
          costSol: result.cost.totalSol.toString(),
          recoverySol: recoverySol.toString(),
          profitLossSol: profitLossSol.toString(),
          signature: result.signature,
          pumpfunUrl: result.tokenMint ? `https://pump.fun/${result.tokenMint}` : null,
          errorMessage: result.error
        });

        campaign.stats.totalLaunches++;

        if (result.success) {
          campaign.stats.successfulLaunches++;
          campaign.stats.totalSpentSol += result.cost.totalSol;
          campaign.stats.totalRecoveredSol += recoverySol;
          campaign.stats.profitLossSol += profitLossSol;
        } else {
          campaign.stats.failedLaunches++;
          console.log(`   ❌ Launch failed: ${result.error}`);
        }

        campaign.stats.profitLossUsd = campaign.stats.profitLossSol * 220;
        campaign.updatedAt = new Date();

        await db.update(tokenLauncherCampaigns)
          .set({ 
            stats: campaign.stats, 
            updatedAt: new Date() 
          })
          .where(eq(tokenLauncherCampaigns.id, campaign.id));

        if (campaign.stats.totalLaunches < campaign.config.targetLaunches) {
          console.log(`   ⏳ Waiting ${campaign.config.delayBetweenLaunchesMs / 1000}s before next launch...`);
          await new Promise(resolve => setTimeout(resolve, campaign.config.delayBetweenLaunchesMs));
        }

      } catch (error: any) {
        console.error(`   ❌ Campaign error:`, error.message);
        campaign.stats.failedLaunches++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    campaign.status = 'completed';
    this.isRunning = false;
    this.activeCampaignId = null;

    await db.update(tokenLauncherCampaigns)
      .set({ 
        status: 'completed', 
        completedAt: new Date(),
        stats: campaign.stats,
        updatedAt: new Date() 
      })
      .where(eq(tokenLauncherCampaigns.id, campaign.id));

    console.log(`\n📊 Campaign Complete: ${campaign.name}`);
    console.log(`   Total launches: ${campaign.stats.totalLaunches}`);
    console.log(`   Successful: ${campaign.stats.successfulLaunches}`);
    console.log(`   Failed: ${campaign.stats.failedLaunches}`);
    console.log(`   Total spent: ${campaign.stats.totalSpentSol.toFixed(4)} SOL`);
    console.log(`   Total recovered: ${campaign.stats.totalRecoveredSol.toFixed(4)} SOL`);
    console.log(`   P&L: ${campaign.stats.profitLossSol.toFixed(4)} SOL (~$${campaign.stats.profitLossUsd.toFixed(2)})`);
  }

  private simulateTradeOutcome(config: CampaignConfig): number {
    const outcomes = [
      { probability: 0.50, multiplier: 0 },
      { probability: 0.20, multiplier: 0.3 },
      { probability: 0.15, multiplier: 0.8 },
      { probability: 0.08, multiplier: 1.5 },
      { probability: 0.04, multiplier: 3 },
      { probability: 0.02, multiplier: 10 },
      { probability: 0.01, multiplier: 50 }
    ];

    const roll = Math.random();
    let cumulative = 0;
    
    for (const outcome of outcomes) {
      cumulative += outcome.probability;
      if (roll < cumulative) {
        return outcome.multiplier;
      }
    }
    
    return 0;
  }

  async stopCampaign(campaignId: string): Promise<boolean> {
    const dbCampaigns = await db.select()
      .from(tokenLauncherCampaigns)
      .where(eq(tokenLauncherCampaigns.id, campaignId));

    if (!dbCampaigns.length) return false;

    await db.update(tokenLauncherCampaigns)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(tokenLauncherCampaigns.id, campaignId));

    this.isRunning = false;
    this.activeCampaignId = null;
    
    console.log(`⏸️ Campaign paused: ${dbCampaigns[0].name}`);
    return true;
  }

  async getCampaign(campaignId: string): Promise<Campaign | null> {
    const dbCampaigns = await db.select()
      .from(tokenLauncherCampaigns)
      .where(eq(tokenLauncherCampaigns.id, campaignId));

    if (!dbCampaigns.length) return null;

    return this.loadCampaignWithLaunches(dbCampaigns[0]);
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    const dbCampaigns = await db.select()
      .from(tokenLauncherCampaigns)
      .orderBy(desc(tokenLauncherCampaigns.createdAt));

    const campaigns: Campaign[] = [];
    for (const dbCampaign of dbCampaigns) {
      campaigns.push(await this.loadCampaignWithLaunches(dbCampaign));
    }
    return campaigns;
  }

  async runSingleLaunch(mode: 'paper' | 'live' = 'paper'): Promise<LaunchResult> {
    const metadata = generateBotAttractiveMetadata();
    
    const config: LaunchConfig = {
      metadata,
      initialLiquiditySol: 0.5,
      priorityFeeMicroLamports: 200000,
      mode
    };

    console.log(`🎯 Single launch: ${metadata.name} (${metadata.symbol}) - Mode: ${mode}`);
    
    return pumpfunService.launchToken(config);
  }
}

export const launchOrchestrator = LaunchOrchestrator.getInstance();
