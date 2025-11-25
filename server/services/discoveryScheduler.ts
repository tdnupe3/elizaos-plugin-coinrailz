/**
 * Discovery Scheduler Service
 * 
 * Runs master-agent-discovery every 6 hours and stores results in PostgreSQL
 * Handles deduplication, XMTP verification, and automated outreach
 */

import cron from 'node-cron';
import { spawn } from 'child_process';
import { db } from '../db';
import { discoveryRuns, discoveredAgents, agentOutreachMessages } from '@shared/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
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
let scheduledTask: cron.ScheduledTask | null = null;

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

export async function getXmtpReachableAgents(): Promise<any[]> {
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
  xmtpReachable: number;
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
  
  const [xmtpCount] = await db
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
    xmtpReachable: Number(xmtpCount?.count || 0),
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
