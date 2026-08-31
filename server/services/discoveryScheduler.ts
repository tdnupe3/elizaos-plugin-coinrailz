/**
 * Discovery Scheduler Service
 * 
 * Runs master-agent-discovery every 6 hours and stores results in PostgreSQL
 * Handles deduplication, verification, and automated outreach
 * 
 * Automated Outreach Flow:
 * 1. Discovery run completes → finds new agents
 * 2. Auto-outreach targets agents with on-chain addresses (programmatic inboxes)
 * 3. Messages tracked in agent_outreach_messages table
 * 4. Rate-limited to avoid spam (1 message/second, max 50/campaign)
 */

import cron, { type ScheduledTask } from 'node-cron';
import { spawn } from 'child_process';
import { db } from '../db';
import { discoveryRuns, discoveredAgents, agentOutreachMessages } from '@shared/schema';
import { eq, and, isNotNull, isNull, sql, desc, gte } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface DiscoveredAgent {
  source: string;
  type: string;
  domain?: string;
  url?: string;
  chain?: string;
  address?: string;
  data?: any;
  score?: number;
  discoveredAt: string;
}

interface DiscoveryOutput {
  timestamp: string;
  summary: {
    totalRaw: number;
    totalUnique: number;
    bySource: Record<string, number>;
  };
  agents: DiscoveredAgent[];
}

let isRunning = false;
let scheduledTask: ScheduledTask | null = null;

async function runMasterDiscovery(): Promise<DiscoveryOutput | null> {
  return new Promise((resolve) => {
    console.log('🔍 Starting master-agent-discovery.ts...');
    
    const scriptPath = path.join(process.cwd(), 'scripts', 'master-agent-discovery.ts');
    const child = spawn('npx', ['tsx', scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000, // 5 minute timeout
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const outputFile = path.join(process.cwd(), 'discovered_agents_master.json');
          if (fs.existsSync(outputFile)) {
            const output = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
            resolve(output);
          } else {
            console.error('❌ Output file not found');
            resolve(null);
          }
        } catch (error) {
          console.error('❌ Failed to parse output:', error);
          resolve(null);
        }
      } else {
        console.error(`❌ Discovery script exited with code ${code}`);
        console.error('stderr:', stderr);
        resolve(null);
      }
    });
    
    child.on('error', (error) => {
      console.error('❌ Failed to spawn discovery script:', error);
      resolve(null);
    });
  });
}

async function upsertDiscoveredAgent(agent: DiscoveredAgent): Promise<{ isNew: boolean; updated: boolean }> {
  const url = agent.url || `https://${agent.domain}`;
  
  try {
    const existing = await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.url, url))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(discoveredAgents).values({
        url,
        canonicalUrl: agent.domain || url.replace(/^https?:\/\//, '').split('/')[0],
        source: agent.source,
        wallet: agent.address,
        score: agent.score || 0,
        capabilities: agent.data?.skills || agent.data?.capabilities,
        metadata: {
          type: agent.type,
          chain: agent.chain,
          rawData: agent.data,
        },
        agentCardData: agent.type === 'agent_card' ? agent.data : null,
        xmtpAddress: agent.data?.contact?.xmtp || agent.data?.channels?.xmtp,
      });
      return { isNew: true, updated: false };
    } else {
      await db
        .update(discoveredAgents)
        .set({
          lastSeenAt: new Date(),
          score: Math.max(existing[0].score || 0, agent.score || 0),
          metadata: {
            ...existing[0].metadata as object,
            type: agent.type,
            chain: agent.chain,
            lastDiscovery: agent.data,
          },
        })
        .where(eq(discoveredAgents.url, url));
      return { isNew: false, updated: true };
    }
  } catch (error) {
    console.error(`Error upserting agent ${url}:`, error);
    return { isNew: false, updated: false };
  }
}

export async function executeDiscoveryRun(runType: 'scheduled' | 'manual' | 'triggered' = 'scheduled'): Promise<number> {
  if (isRunning) {
    console.log('⚠️ Discovery is already running, skipping...');
    return -1;
  }
  
  isRunning = true;
  const startTime = Date.now();
  
  const [runRecord] = await db.insert(discoveryRuns).values({
    runType,
    status: 'running',
    startedAt: new Date(),
  }).returning();
  
  console.log(`📋 Discovery run #${runRecord.id} started (${runType})`);
  
  try {
    const output = await runMasterDiscovery();
    
    if (!output) {
      await db
        .update(discoveryRuns)
        .set({
          status: 'failed',
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          errors: ['Failed to execute master discovery script'],
        })
        .where(eq(discoveryRuns.id, runRecord.id));
      
      isRunning = false;
      return runRecord.id;
    }
    
    let newAgents = 0;
    let updatedAgents = 0;
    
    for (const agent of output.agents) {
      const result = await upsertDiscoveredAgent(agent);
      if (result.isNew) newAgents++;
      if (result.updated) updatedAgents++;
    }
    
    await db
      .update(discoveryRuns)
      .set({
        status: 'completed',
        completedAt: new Date(),
        totalRaw: output.summary.totalRaw,
        totalUnique: output.summary.totalUnique,
        newAgents,
        updatedAgents,
        bySource: output.summary.bySource,
        rawOutput: output,
        durationMs: Date.now() - startTime,
      })
      .where(eq(discoveryRuns.id, runRecord.id));
    
    console.log(`✅ Discovery run #${runRecord.id} completed`);
    console.log(`   New agents: ${newAgents}, Updated: ${updatedAgents}`);
    console.log(`   Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    
    isRunning = false;
    return runRecord.id;
  } catch (error) {
    console.error('❌ Discovery run failed:', error);
    
    await db
      .update(discoveryRuns)
      .set({
        status: 'failed',
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        errors: [String(error)],
      })
      .where(eq(discoveryRuns.id, runRecord.id));
    
    isRunning = false;
    return runRecord.id;
  }
}

export async function getReachableAgents(): Promise<any[]> {
  return db
    .select()
    .from(discoveredAgents)
    .where(
      and(
        isNotNull(discoveredAgents.xmtpAddress),
        eq(discoveredAgents.xmtpCanMessage, true)
      )
    );
}

export async function getAgentsForOutreach(limit: number = 50): Promise<any[]> {
  return db
    .select()
    .from(discoveredAgents)
    .where(
      and(
        eq(discoveredAgents.status, 'new'),
        isNotNull(discoveredAgents.xmtpAddress)
      )
    )
    .orderBy(sql`${discoveredAgents.score} DESC`)
    .limit(limit);
}

export async function recordOutreachMessage(
  agentId: number,
  channel: string,
  recipientAddress: string,
  messageType: string,
  messageContent: string,
  campaignId?: string
): Promise<number> {
  const [record] = await db.insert(agentOutreachMessages).values({
    agentId,
    channel,
    recipientAddress,
    messageType,
    messageContent,
    status: 'pending',
    campaignId,
  }).returning();
  
  return record.id;
}

export async function updateOutreachStatus(
  messageId: number,
  status: 'sent' | 'delivered' | 'failed',
  errorMessage?: string
): Promise<void> {
  const updates: any = { status };
  
  if (status === 'sent') {
    updates.sentAt = new Date();
  } else if (status === 'delivered') {
    updates.deliveredAt = new Date();
  } else if (status === 'failed') {
    updates.errorMessage = errorMessage;
  }
  
  await db
    .update(agentOutreachMessages)
    .set(updates)
    .where(eq(agentOutreachMessages.id, messageId));
}

export async function getDiscoveryStats(): Promise<{
  totalAgents: number;
  newAgents: number;
  reachable: number;
  lastRunAt: Date | null;
  totalRuns: number;
}> {
  const [agentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(discoveredAgents);
  
  const [newCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(discoveredAgents)
    .where(eq(discoveredAgents.status, 'new'));
  
  const [reachableCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(discoveredAgents)
    .where(isNotNull(discoveredAgents.xmtpAddress));
  
  const [runCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(discoveryRuns);
  
  const [lastRun] = await db
    .select({ startedAt: discoveryRuns.startedAt })
    .from(discoveryRuns)
    .orderBy(sql`${discoveryRuns.startedAt} DESC`)
    .limit(1);
  
  return {
    totalAgents: Number(agentCount?.count || 0),
    newAgents: Number(newCount?.count || 0),
    reachable: Number(reachableCount?.count || 0),
    lastRunAt: lastRun?.startedAt || null,
    totalRuns: Number(runCount?.count || 0),
  };
}

export function startDiscoveryScheduler(intervalHours: number = 6): void {
  if (scheduledTask) {
    console.log('⚠️ Discovery scheduler already running');
    return;
  }
  
  const cronExpression = `0 */${intervalHours} * * *`;
  
  console.log(`📅 Starting discovery scheduler (every ${intervalHours} hours)`);
  console.log(`   Cron expression: ${cronExpression}`);
  
  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log('\n⏰ Scheduled discovery triggered at', new Date().toISOString());
    await executeDiscoveryRun('scheduled');
  });
  
  console.log('✅ Discovery scheduler started');
  console.log('   Next run will be at the next', intervalHours, 'hour mark');
}

export function stopDiscoveryScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('🛑 Discovery scheduler stopped');
  }
}

export async function runDiscoveryNow(): Promise<number> {
  console.log('🚀 Running discovery immediately...');
  return executeDiscoveryRun('manual');
}

/**
 * Run automated outreach — disabled, returns no-op
 */
export async function runAutomatedOutreach(_options: {
  minQualityScore?: number;
  maxAgents?: number;
  onlyReachable?: boolean;
} = {}): Promise<{
  targeted: number;
  sent: number;
  failed: number;
  skipped: number;
  creditsOffered: number;
}> {
  console.log('⏸️ Automated outreach disabled');
  return { targeted: 0, sent: 0, failed: 0, skipped: 0, creditsOffered: 0 };
}

/**
 * Get outreach campaign statistics
 */
export async function getOutreachStats(): Promise<{
  totalMessages: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  byChannel: Record<string, number>;
  recentCampaigns: Array<{
    campaignId: string;
    messagesCount: number;
    sentAt: Date | null;
  }>;
}> {
  const [totalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentOutreachMessages);
  
  const [sentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentOutreachMessages)
    .where(eq(agentOutreachMessages.status, 'sent'));
  
  const [deliveredCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentOutreachMessages)
    .where(eq(agentOutreachMessages.status, 'delivered'));
  
  const [failedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentOutreachMessages)
    .where(eq(agentOutreachMessages.status, 'failed'));
  
  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentOutreachMessages)
    .where(eq(agentOutreachMessages.status, 'pending'));
  
  // Get messages by channel
  const channelStats = await db
    .select({
      channel: agentOutreachMessages.channel,
      count: sql<number>`count(*)`
    })
    .from(agentOutreachMessages)
    .groupBy(agentOutreachMessages.channel);
  
  const byChannel: Record<string, number> = {};
  for (const stat of channelStats) {
    byChannel[stat.channel] = Number(stat.count);
  }
  
  // Get recent campaigns
  const recentCampaigns = await db
    .select({
      campaignId: agentOutreachMessages.campaignId,
      messagesCount: sql<number>`count(*)`,
      sentAt: sql<Date>`min(${agentOutreachMessages.sentAt})`
    })
    .from(agentOutreachMessages)
    .groupBy(agentOutreachMessages.campaignId)
    .orderBy(sql`min(${agentOutreachMessages.sentAt}) DESC`)
    .limit(10);
  
  return {
    totalMessages: Number(totalCount?.count || 0),
    sent: Number(sentCount?.count || 0),
    delivered: Number(deliveredCount?.count || 0),
    failed: Number(failedCount?.count || 0),
    pending: Number(pendingCount?.count || 0),
    byChannel,
    recentCampaigns: recentCampaigns.map(c => ({
      campaignId: c.campaignId || 'unknown',
      messagesCount: Number(c.messagesCount),
      sentAt: c.sentAt,
    })),
  };
}

/**
 * Get agents ready for outreach (have address, quality score >= 60, not yet contacted)
 */
export async function getAgentsReadyForOutreach(options: {
  limit?: number;
  minQualityScore?: number;
  onlyReachable?: boolean;
} = {}): Promise<any[]> {
  const { limit = 100, minQualityScore = 60, onlyReachable = false } = options;
  
  const conditions = [
    isNotNull(discoveredAgents.xmtpAddress),
    isNull(discoveredAgents.lastContactAt),
    gte(discoveredAgents.xmtpQualityScore, minQualityScore),
  ];
  
  if (onlyReachable) {
    conditions.push(eq(discoveredAgents.xmtpStatus, 'reachable'));
  }
  
  return db
    .select()
    .from(discoveredAgents)
    .where(and(...conditions))
    .orderBy(desc(discoveredAgents.xmtpQualityScore))
    .limit(limit);
}

/**
 * Get outreach recommendations — returns empty
 */
export async function getOutreachRecommendations(_limit = 20): Promise<any[]> {
  return [];
}
