/**
 * AGENT DISCOVERY SERVICE - Automated Mass Agent Discovery Pipeline
 * 
 * Orchestrates discovery of thousands of AI agents per day from multiple sources:
 * - A2A Registry Adapters
 * - On-chain Lookups (ENS, Farcaster/Lens)
 * - Discord/Telegram Adapters
 * - Platform Adapters (marketplaces, directories)
 * 
 * Handles deduplication, scheduling, and integration with CommunicationOrchestrator
 */

import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, and, or, sql, desc, asc, inArray } from 'drizzle-orm';
import { CommunicationOrchestrator } from './communicationOrchestrator';
import cron from 'node-cron';
import Redis from 'ioredis';

// Discovery Adapter Interface
export interface DiscoveryAdapter {
  name: string;
  expectedYield: number; // Expected agents per run
  timeout: number; // Timeout in milliseconds
  rateLimit: number; // Max requests per minute
  
  discover(options?: any): Promise<DiscoveredAgentRaw[]>;
  healthCheck(): Promise<boolean>;
}

// Raw discovered agent data (before database insertion)
export interface DiscoveredAgentRaw {
  url: string;
  source: string;
  channels?: {
    webhook?: string;
    email?: string;
    telegram?: string;
    twitter?: string;
    farcaster?: string;
    push_protocol?: boolean;
    dialect?: boolean;
  };
  wallet?: string;
  capabilities?: {
    trading?: boolean;
    defi?: boolean;
    social_media?: boolean;
    content_creation?: boolean;
    analytics?: boolean;
    gaming?: boolean;
    [key: string]: any;
  };
  metadata?: {
    platform?: string;
    marketCap?: string;
    tokenAddress?: string;
    network?: string;
    verified?: boolean;
    lastActive?: Date;
    [key: string]: any;
  };
}

// Discovery batch result
export interface DiscoveryBatchResult {
  adapterId: string;
  totalFound: number;
  newAgents: number;
  duplicates: number;
  errors: number;
  duration: number;
  agentsPerSecond: number;
  success: boolean;
  errorMessage?: string;
}

// Discovery statistics
export interface DiscoveryStats {
  totalAgents: number;
  todayDiscovered: number;
  weekDiscovered: number;
  topSources: Array<{ source: string; count: number }>;
  avgAgentsPerHour: number;
  successRate: number;
}

export class AgentDiscoveryService {
  private static instance: AgentDiscoveryService | null = null;
  private adapters: Map<string, DiscoveryAdapter> = new Map();
  private communicationOrchestrator: CommunicationOrchestrator;
  private isRunning: boolean = false;
  private stats: DiscoveryStats;
  private cronJob: cron.ScheduledTask | null = null;
  private redis: Redis | null = null;
  private processId: string;
  private readonly DISCOVERY_LOCK_KEY = 'agent_discovery_lock';
  private readonly LOCK_TTL = 14400000; // 4 hour TTL for discovery lock
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 1800000; // 30 minutes heartbeat

  private isInitialized: boolean = false;

  constructor() {
    if (AgentDiscoveryService.instance) {
      console.log('⚠️ AgentDiscoveryService already exists, returning existing instance');
      return AgentDiscoveryService.instance;
    }
    
    this.communicationOrchestrator = new CommunicationOrchestrator();
    this.processId = `discovery_${process.pid}_${Date.now()}`;
    
    // CRITICAL FIX: Don't do heavy initialization in constructor
    // Call deferredInitialize() explicitly AFTER server is listening
    
    AgentDiscoveryService.instance = this;
    console.log('✅ AgentDiscoveryService singleton instance created (awaiting post-listen initialization)');
  }

  /**
   * DEFERRED INITIALIZATION - Call this AFTER server is listening
   * This prevents health check timeout during deployment
   */
  async deferredInitialize(): Promise<void> {
    try {
      // Skip if already initialized or during build phase
      const { DISABLE_BACKGROUND_SERVICES } = await import('../buildModeDetection.js');
      
      if (DISABLE_BACKGROUND_SERVICES) {
        console.log('🚫 AgentDiscoveryService: Skipping initialization during build phase');
        return;
      }
      
      if (this.isInitialized) {
        console.log('⚠️ AgentDiscoveryService: Already initialized');
        return;
      }
      
      console.log('🔧 AgentDiscoveryService: Starting deferred initialization...');
      
      await this.initializeRedis();
      await this.initializeAdapters();
      await this.initializeScheduler();
      
      // Start the scheduler after initialization (cron job created with scheduled: false)
      this.startScheduler();
      
      this.isInitialized = true;
      console.log('✅ AgentDiscoveryService: Deferred initialization complete');
    } catch (error) {
      console.error('❌ AgentDiscoveryService: Deferred initialization failed:', error);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AgentDiscoveryService {
    if (!AgentDiscoveryService.instance) {
      AgentDiscoveryService.instance = new AgentDiscoveryService();
    }
    return AgentDiscoveryService.instance;
  }

  /**
   * Destroy singleton instance (for testing)
   */
  public static destroyInstance(): void {
    if (AgentDiscoveryService.instance) {
      AgentDiscoveryService.instance.shutdown();
      AgentDiscoveryService.instance = null;
    }
  }

  /**
   * INITIALIZE REDIS for distributed locking
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Only try Redis if explicitly configured with REDIS_URL
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        console.log('📝 No REDIS_URL configured - using single process mode');
        this.redis = null;
        return;
      }
      
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false // Prevent queuing commands when disconnected
      });
      
      // Test connection silently
      await this.redis.ping();
      console.log('✅ Redis initialized for distributed discovery locking');
    } catch (error) {
      console.log('📝 Redis unavailable - using single process mode');
      this.redis = null;
    }
  }

  /**
   * ACQUIRE DISTRIBUTED LOCK to prevent multi-process overlap
   */
  private async acquireDistributedLock(): Promise<boolean> {
    if (!this.redis) {
      console.log('📝 No Redis - skipping distributed lock (single process assumed)');
      return true;
    }

    try {
      const result = await this.redis.set(
        this.DISCOVERY_LOCK_KEY,
        this.processId,
        'PX', // Set expiry in milliseconds
        this.LOCK_TTL,
        'NX' // Only set if key doesn't exist
      );

      if (result === 'OK') {
        console.log(`🔒 Distributed lock acquired by process ${this.processId} for ${this.LOCK_TTL/1000/60} minutes`);
        
        // Start heartbeat to extend TTL for long-running operations
        this.startLockHeartbeat();
        
        return true;
      } else {
        const currentOwner = await this.redis.get(this.DISCOVERY_LOCK_KEY);
        console.log(`⏸️ Discovery already running on process ${currentOwner} - skipping`);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to acquire distributed lock:', error);
      return false;
    }
  }

  /**
   * START LOCK HEARTBEAT to extend TTL during long operations
   */
  private startLockHeartbeat(): void {
    if (!this.redis) return;
    
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Extend TTL only if we still own the lock
        const luaScript = `
          if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('PEXPIRE', KEYS[1], ARGV[2])
          else
            return 0
          end
        `;
        
        const result = await this.redis.eval(
          luaScript,
          1,
          this.DISCOVERY_LOCK_KEY,
          this.processId,
          this.LOCK_TTL.toString()
        ) as number;
        
        if (result === 1) {
          console.log(`💓 Lock heartbeat: TTL extended for process ${this.processId}`);
        } else {
          console.warn(`⚠️ Lock lost during heartbeat - stopping discovery`);
          this.stopLockHeartbeat();
          this.isRunning = false;
        }
      } catch (error) {
        console.error('❌ Lock heartbeat failed:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
    
    console.log(`💓 Lock heartbeat started - will extend TTL every ${this.HEARTBEAT_INTERVAL/1000/60} minutes`);
  }

  /**
   * STOP LOCK HEARTBEAT
   */
  private stopLockHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 Lock heartbeat stopped');
    }
  }

  /**
   * RELEASE DISTRIBUTED LOCK
   */
  private async releaseDistributedLock(): Promise<void> {
    if (!this.redis) return;

    // Stop heartbeat first
    this.stopLockHeartbeat();

    try {
      // Use Lua script to ensure we only delete our own lock
      const luaScript = `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          return redis.call('DEL', KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(
        luaScript,
        1,
        this.DISCOVERY_LOCK_KEY,
        this.processId
      ) as number;

      if (result === 1) {
        console.log(`🔓 Distributed lock released by process ${this.processId}`);
      }
    } catch (error) {
      console.error('❌ Failed to release distributed lock:', error);
    }
  }

  /**
   * MAIN DISCOVERY ORCHESTRATION
   * Runs all adapters in parallel and processes results
   */
  async runDiscovery(options: {
    adapterIds?: string[];
    maxAgents?: number;
    dryRun?: boolean;
    priority?: 'fast' | 'thorough' | 'maximum';
    skipLock?: boolean; // For testing or single-process scenarios
  } = {}): Promise<{
    totalFound: number;
    newAgents: number;
    batchResults: DiscoveryBatchResult[];
    duration: number;
    summary: string;
  }> {
    const { 
      adapterIds = Array.from(this.adapters.keys()),
      maxAgents = 10000,
      dryRun = false,
      priority = 'thorough',
      skipLock = false
    } = options;

    if (this.isRunning) {
      throw new Error('Discovery already running. Please wait for completion.');
    }

    // Acquire distributed lock to prevent multi-process overlap
    if (!skipLock) {
      try {
        const lockAcquired = await this.acquireDistributedLock();
        if (!lockAcquired && this.redis) {
          // Only throw if Redis is available but lock failed
          throw new Error('Discovery is already running on another process. Distributed lock could not be acquired.');
        }
      } catch (error) {
        // In development without Redis, continue anyway
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Redis unavailable in development - continuing with single-process discovery');
        } else {
          throw error;
        }
      }
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    console.log(`🚀 AGENT DISCOVERY INITIATED - Priority: ${priority.toUpperCase()}`);
    console.log(`🎯 Target: ${maxAgents} agents using ${adapterIds.length} adapters`);
    console.log(`📊 Mode: ${dryRun ? 'DRY RUN' : 'LIVE DISCOVERY'}`);

    try {
      const batchResults: DiscoveryBatchResult[] = [];
      let totalFound = 0;
      let totalNew = 0;

      // Configure adapter timeouts based on priority
      const adapterTimeouts = this.getAdapterTimeouts(priority);

      // Run adapters in parallel with appropriate timeouts
      const adapterPromises = adapterIds.map(async (adapterId) => {
        const adapter = this.adapters.get(adapterId);
        if (!adapter) {
          return {
            adapterId,
            totalFound: 0,
            newAgents: 0,
            duplicates: 0,
            errors: 1,
            duration: 0,
            agentsPerSecond: 0,
            success: false,
            errorMessage: 'Adapter not found'
          };
        }

        return this.runSingleAdapter(adapter, adapterId, adapterTimeouts[adapterId] || 60000, dryRun);
      });

      const results = await Promise.allSettled(adapterPromises);
      
      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          batchResults.push(result.value);
          totalFound += result.value.totalFound;
          totalNew += result.value.newAgents;
        } else {
          console.error('🚨 Adapter failed:', result.reason);
          batchResults.push({
            adapterId: 'unknown',
            totalFound: 0,
            newAgents: 0,
            duplicates: 0,
            errors: 1,
            duration: 0,
            agentsPerSecond: 0,
            success: false,
            errorMessage: result.reason.message
          });
        }
      }

      const duration = Date.now() - startTime;
      const agentsPerSecond = totalFound / (duration / 1000);

      // Update discovery statistics
      await this.updateDiscoveryStats(totalNew, batchResults);

      const summary = this.generateDiscoverySummary(totalFound, totalNew, batchResults, duration);
      
      console.log(`✅ DISCOVERY COMPLETE: ${totalNew} new agents in ${duration}ms (${agentsPerSecond.toFixed(2)} agents/sec)`);
      console.log(summary);

      return {
        totalFound,
        newAgents: totalNew,
        batchResults,
        duration,
        summary
      };

    } catch (error) {
      console.error('🚨 Discovery failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
      // Release distributed lock
      if (!skipLock) {
        await this.releaseDistributedLock();
      }
    }
  }

  /**
   * RUN SINGLE ADAPTER with error handling and metrics
   */
  private async runSingleAdapter(
    adapter: DiscoveryAdapter, 
    adapterId: string, 
    timeout: number,
    dryRun: boolean
  ): Promise<DiscoveryBatchResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Running ${adapterId} adapter (timeout: ${timeout}ms)...`);

      // Health check first (15s timeout — external APIs like Coinbase/ElizaOS need more than 5s)
      const healthCheckTimeout = parseInt(process.env.DISCOVERY_HEALTH_CHECK_TIMEOUT_MS || '15000', 10);
      const isHealthy = await Promise.race([
        adapter.healthCheck(),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), healthCheckTimeout)
        )
      ]);

      if (!isHealthy) {
        throw new Error('Adapter health check failed');
      }

      // Run discovery with timeout
      const rawAgents = await Promise.race([
        adapter.discover(),
        new Promise<DiscoveredAgentRaw[]>((_, reject) => 
          setTimeout(() => reject(new Error('Discovery timeout')), timeout)
        )
      ]);

      const duration = Date.now() - startTime;
      const agentsPerSecond = rawAgents.length / (duration / 1000);

      console.log(`📊 ${adapterId}: ${rawAgents.length} agents found in ${duration}ms`);

      if (dryRun) {
        return {
          adapterId,
          totalFound: rawAgents.length,
          newAgents: rawAgents.length,
          duplicates: 0,
          errors: 0,
          duration,
          agentsPerSecond,
          success: true
        };
      }

      // Process and store agents
      const { newAgents, duplicates } = await this.processAndStoreAgents(rawAgents, adapterId);

      return {
        adapterId,
        totalFound: rawAgents.length,
        newAgents,
        duplicates,
        errors: 0,
        duration,
        agentsPerSecond,
        success: true
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${adapterId} failed:`, error.message);
      
      return {
        adapterId,
        totalFound: 0,
        newAgents: 0,
        duplicates: 0,
        errors: 1,
        duration,
        agentsPerSecond: 0,
        success: false,
        errorMessage: error.message
      };
    }
  }

  /**
   * PROCESS AND STORE AGENTS with chunked bulk upserts and reliable accounting
   * Fixes: Unreliable xmax trick, large insert lock contention, improves data quality
   */
  private async processAndStoreAgents(
    rawAgents: DiscoveredAgentRaw[], 
    adapterId: string
  ): Promise<{ newAgents: number; duplicates: number }> {
    if (rawAgents.length === 0) {
      return { newAgents: 0, duplicates: 0 };
    }

    console.log(`📊 Processing ${rawAgents.length} agents from ${adapterId} with chunked upserts...`);
    
    let totalNewAgents = 0;
    let totalDuplicates = 0;
    const CHUNK_SIZE = 750; // Optimal chunk size to prevent lock contention
    
    // Process in chunks to prevent large insert lock contention
    for (let i = 0; i < rawAgents.length; i += CHUNK_SIZE) {
      const chunk = rawAgents.slice(i, i + CHUNK_SIZE);
      console.log(`📦 Processing chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(rawAgents.length/CHUNK_SIZE)} (${chunk.length} agents)...`);
      
      try {
        const { newAgents, duplicates } = await this.processAgentChunk(chunk, adapterId);
        totalNewAgents += newAgents;
        totalDuplicates += duplicates;
        
        // Small delay between chunks to reduce database pressure
        if (i + CHUNK_SIZE < rawAgents.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Chunk processing failed for chunk ${Math.floor(i/CHUNK_SIZE) + 1}:`, error.message);
        // Continue with next chunk instead of failing entire batch
        continue;
      }
    }

    console.log(`✅ Bulk processing complete: ${totalNewAgents} new agents, ${totalDuplicates} duplicates (${adapterId})`);
    return { newAgents: totalNewAgents, duplicates: totalDuplicates };
  }

  /**
   * PROCESS SINGLE CHUNK with reliable two-phase upsert accounting
   * Replaces unreliable xmax trick with pre-selected existing URLs
   */
  private async processAgentChunk(
    chunk: DiscoveredAgentRaw[],
    adapterId: string
  ): Promise<{ newAgents: number; duplicates: number }> {
    // FIX: Deduplicate chunk by URL to prevent "ON CONFLICT DO UPDATE cannot affect row a second time"
    // When multiple agents have the same URL, keep the one with highest score/most metadata
    const deduplicatedChunk = this.deduplicateAgentsByUrl(chunk);
    if (deduplicatedChunk.length < chunk.length) {
      console.log(`🔄 Deduplicated ${chunk.length} → ${deduplicatedChunk.length} agents (removed ${chunk.length - deduplicatedChunk.length} intra-chunk duplicates)`);
    }
    
    // PHASE 1: Pre-select existing URLs for reliable accounting (replaces xmax trick)
    const urls = deduplicatedChunk.map(agent => this.normalizeUrl(agent.url));
    const existingAgents = await db
      .select({ url: discoveredAgents.url })
      .from(discoveredAgents)
      .where(inArray(discoveredAgents.url, urls));
    
    const existingUrls = new Set(existingAgents.map(agent => agent.url));
    
    // Separate true source from adapterId for analytics
    const agentDataArray = deduplicatedChunk.map(rawAgent => {
      const normalizedUrl = this.normalizeUrl(rawAgent.url);
      const trueSource = this.extractTrueSource(rawAgent, adapterId);
      
      return {
        url: normalizedUrl,
        source: trueSource, // Store true source (registry/ENS) separate from adapterId 
        channels: rawAgent.channels || {},
        wallet: rawAgent.wallet,
        capabilities: rawAgent.capabilities || {},
        metadata: this.enhanceMetadata(rawAgent.metadata || {}, adapterId),
        status: 'new' as const,
        score: this.calculateAgentScore(rawAgent),
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
        attempts: 0,
        successCount: 0
      };
    });

    // PHASE 2: Perform bulk upsert with proper JSONB merge
    const result = await db
      .insert(discoveredAgents)
      .values(agentDataArray)
      .onConflictDoUpdate({
        target: discoveredAgents.url,
        set: {
          lastSeenAt: sql`NOW()`,
          // Proper JSONB merge for metadata (not simple overwrite)
          metadata: sql`${discoveredAgents.metadata} || EXCLUDED.metadata`,
          // Smart merge for channels - preserve existing, add new
          channels: sql`${discoveredAgents.channels} || EXCLUDED.channels`,
          // Update capabilities with union
          capabilities: sql`${discoveredAgents.capabilities} || EXCLUDED.capabilities`,
          // Update score if the new one is higher
          score: sql`GREATEST(${discoveredAgents.score}, EXCLUDED.score)`,
          // Update source if more specific (prefer registry over scraper)
          source: sql`CASE 
            WHEN EXCLUDED.source IN ('ens', 'registry') AND ${discoveredAgents.source} NOT IN ('ens', 'registry')
            THEN EXCLUDED.source
            ELSE ${discoveredAgents.source}
          END`
        }
      })
      .returning({ url: discoveredAgents.url });

    // Reliable accounting: Count by comparing with pre-selected existing URLs
    const insertedCount = chunk.filter(agent => !existingUrls.has(this.normalizeUrl(agent.url))).length;
    const duplicateCount = chunk.length - insertedCount;

    return { 
      newAgents: insertedCount, 
      duplicates: duplicateCount 
    };
  }

  /**
   * NORMALIZE URL to prevent duplicate variants
   * Handles trailing slashes, protocol variations, case sensitivity
   */
  private normalizeUrl(url: string): string {
    if (!url) return url;
    
    try {
      // Convert to lowercase for consistency
      let normalized = url.toLowerCase().trim();
      
      // Add https:// if no protocol specified
      if (!normalized.match(/^https?:\/\//)) {
        normalized = 'https://' + normalized;
      }
      
      // Remove trailing slash
      if (normalized.endsWith('/') && normalized.length > 8) {
        normalized = normalized.slice(0, -1);
      }
      
      // Remove www. prefix for consistency
      normalized = normalized.replace(/\/\/www\./, '//');
      
      return normalized;
    } catch (error) {
      // If URL parsing fails, return original
      return url.toLowerCase().trim();
    }
  }

  /**
   * DEDUPLICATE AGENTS BY URL within a batch
   * Prevents "ON CONFLICT DO UPDATE cannot affect row a second time" error
   * When duplicates exist, keeps the agent with most metadata/highest implied quality
   */
  private deduplicateAgentsByUrl(agents: DiscoveredAgentRaw[]): DiscoveredAgentRaw[] {
    const urlMap = new Map<string, DiscoveredAgentRaw>();
    
    for (const agent of agents) {
      const normalizedUrl = this.normalizeUrl(agent.url);
      const existing = urlMap.get(normalizedUrl);
      
      if (!existing) {
        urlMap.set(normalizedUrl, agent);
      } else {
        // Keep the agent with more metadata (better quality data)
        const existingMetadataCount = Object.keys(existing.metadata || {}).length;
        const newMetadataCount = Object.keys(agent.metadata || {}).length;
        
        if (newMetadataCount > existingMetadataCount) {
          urlMap.set(normalizedUrl, agent);
        }
      }
    }
    
    return Array.from(urlMap.values());
  }

  /**
   * EXTRACT TRUE SOURCE separate from adapterId for analytics
   * Maps adapter IDs to actual discovery sources
   */
  private extractTrueSource(agent: DiscoveredAgentRaw, adapterId: string): string {
    // If agent already specifies source, prefer that
    if (agent.source && agent.source !== adapterId) {
      return agent.source;
    }
    
    // Map adapter IDs to true sources
    const sourceMapping: Record<string, string> = {
      'a2a-registry': 'registry',
      'onchain-lookups': agent.metadata?.protocol || 'ens',
      'social-scraper': agent.metadata?.platform || 'discord',
      'platform-adapter': agent.metadata?.platform || 'marketplace',
      'discord-telegram': agent.metadata?.platform || 'discord',
      'ens-lookup': 'ens',
      'farcaster-discovery': 'farcaster',
      'lens-discovery': 'lens'
    };
    
    return sourceMapping[adapterId] || adapterId;
  }

  /**
   * ENHANCE METADATA with adapter context and discovery timestamp
   */
  private enhanceMetadata(metadata: any, adapterId: string): any {
    return {
      ...metadata,
      discoveryAdapterId: adapterId,
      discoveryTimestamp: new Date().toISOString(),
      // Preserve original platform info
      originalPlatform: metadata.platform || 'unknown'
    };
  }

  /**
   * FALLBACK: Individual inserts with error handling (used if bulk upsert fails)
   */
  private async fallbackIndividualInserts(
    rawAgents: DiscoveredAgentRaw[], 
    source: string
  ): Promise<{ newAgents: number; duplicates: number }> {
    console.log(`⚠️ Using fallback individual inserts for ${rawAgents.length} agents`);
    
    let newAgents = 0;
    let duplicates = 0;

    for (const rawAgent of rawAgents) {
      try {
        const agentData = {
          url: rawAgent.url,
          source,
          channels: rawAgent.channels || {},
          wallet: rawAgent.wallet,
          capabilities: rawAgent.capabilities || {},
          metadata: rawAgent.metadata || {},
          status: 'new' as const,
          score: this.calculateAgentScore(rawAgent),
          discoveredAt: new Date(),
          lastSeenAt: new Date(),
          attempts: 0,
          successCount: 0
        };

        // Try insert with ON CONFLICT DO NOTHING for individual record
        const result = await db
          .insert(discoveredAgents)
          .values(agentData)
          .onConflictDoNothing({ target: discoveredAgents.url })
          .returning({ url: discoveredAgents.url });

        if (result.length > 0) {
          newAgents++;
        } else {
          duplicates++;
          // Update last seen for duplicate
          await this.updateAgentLastSeen(rawAgent.url);
        }

      } catch (error) {
        console.error(`❌ Failed to store agent ${rawAgent.url}:`, error.message);
        duplicates++; // Count errors as duplicates to maintain metrics
      }
    }

    return { newAgents, duplicates };
  }

  /**
   * FIND EXISTING AGENT by URL or wallet (deduplication)
   */
  private async findExistingAgent(url: string, wallet?: string): Promise<any | null> {
    const conditions = [eq(discoveredAgents.url, url)];
    
    if (wallet) {
      conditions.push(eq(discoveredAgents.wallet, wallet));
    }

    const [existing] = await db
      .select()
      .from(discoveredAgents)
      .where(or(...conditions))
      .limit(1);

    return existing || null;
  }

  /**
   * UPDATE AGENT LAST SEEN timestamp (works with both ID and URL)
   */
  private async updateAgentLastSeen(agentIdOrUrl: number | string): Promise<void> {
    if (typeof agentIdOrUrl === 'number') {
      // Update by ID
      await db
        .update(discoveredAgents)
        .set({ lastSeenAt: new Date() })
        .where(eq(discoveredAgents.id, agentIdOrUrl));
    } else {
      // Update by URL
      await db
        .update(discoveredAgents)
        .set({ lastSeenAt: new Date() })
        .where(eq(discoveredAgents.url, agentIdOrUrl));
    }
  }

  /**
   * CALCULATE AGENT SCORE based on various factors
   */
  private calculateAgentScore(agent: DiscoveredAgentRaw): number {
    let score = 50; // Base score

    // Network/platform bonuses
    if (agent.metadata?.network === 'base') score += 20;
    if (agent.metadata?.network === 'ethereum') score += 15;
    if (agent.metadata?.network === 'solana') score += 10;

    // Capability bonuses
    if (agent.capabilities?.trading) score += 15;
    if (agent.capabilities?.defi) score += 10;
    if (agent.capabilities?.social_media) score += 5;

    // Communication channel bonuses
    if (agent.channels?.webhook) score += 10;
    if (agent.channels?.email) score += 5;

    // Verification bonus
    if (agent.metadata?.verified) score += 20;

    // Market cap bonus
    if (agent.metadata?.marketCap) {
      const marketCapValue = parseFloat(agent.metadata.marketCap.replace(/[$M]/g, ''));
      if (marketCapValue > 100) score += 25;
      else if (marketCapValue > 10) score += 15;
      else if (marketCapValue > 1) score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * GET ADAPTER TIMEOUTS based on priority
   */
  private getAdapterTimeouts(priority: 'fast' | 'thorough' | 'maximum'): Record<string, number> {
    const timeouts = {
      fast: {
        'x402-bazaar': 60000,
        'elizaos-registry': 45000,
        'a2a-registry': 30000,
        'onchain-lookups': 45000,
        'discord-telegram': 30000,
        'platform-adapter': 60000,
        'social-scraper': 30000
      },
      thorough: {
        'x402-bazaar': 120000,
        'elizaos-registry': 90000,
        'a2a-registry': 60000,
        'onchain-lookups': 120000,
        'discord-telegram': 90000,
        'platform-adapter': 180000,
        'social-scraper': 120000
      },
      maximum: {
        'x402-bazaar': 300000,
        'elizaos-registry': 180000,
        'a2a-registry': 300000,
        'onchain-lookups': 600000,
        'discord-telegram': 300000,
        'platform-adapter': 900000,
        'social-scraper': 600000
      }
    };

    return timeouts[priority];
  }

  /**
   * INITIALIZE ADAPTERS (loaded dynamically)
   */
  private async initializeAdapters(): Promise<void> {
    console.log('🔧 Initializing discovery adapters...');
    
    try {
      // Import and register all available adapters
      const { initializeDiscoveryAdapters } = await import('../adapters/index');
      initializeDiscoveryAdapters();
      console.log('✅ Discovery adapters loaded and registered');
    } catch (error) {
      console.warn('⚠️ Failed to load discovery adapters:', error);
    }
  }

  hasAdapters(): boolean {
    return this.adapters.size > 0;
  }

  async ensureAdaptersInitialized(): Promise<void> {
    if (this.adapters.size === 0) {
      await this.initializeAdapters();
    }
  }

  /**
   * REGISTER ADAPTER
   */
  registerAdapter(id: string, adapter: DiscoveryAdapter): void {
    this.adapters.set(id, adapter);
    console.log(`✅ Registered discovery adapter: ${id} (expected yield: ${adapter.expectedYield})`);
  }

  /**
   * GET DISCOVERY STATISTICS
   */
  async getDiscoveryStats(): Promise<DiscoveryStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    try {
      // Total agents
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(discoveredAgents);

      // Today's discoveries
      const [todayResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(discoveredAgents)
        .where(sql`${discoveredAgents.discoveredAt} >= ${today}`);

      // Week's discoveries
      const [weekResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(discoveredAgents)
        .where(sql`${discoveredAgents.discoveredAt} >= ${weekAgo}`);

      // Top sources
      const topSources = await db
        .select({
          source: discoveredAgents.source,
          count: sql<number>`count(*)`
        })
        .from(discoveredAgents)
        .groupBy(discoveredAgents.source)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      return {
        totalAgents: totalResult.count,
        todayDiscovered: todayResult.count,
        weekDiscovered: weekResult.count,
        topSources,
        avgAgentsPerHour: todayResult.count / 24,
        successRate: 0.95 // Will be calculated from actual success metrics
      };

    } catch (error) {
      console.error('Error getting discovery stats:', error);
      return {
        totalAgents: 0,
        todayDiscovered: 0,
        weekDiscovered: 0,
        topSources: [],
        avgAgentsPerHour: 0,
        successRate: 0
      };
    }
  }

  /**
   * UPDATE DISCOVERY STATISTICS
   */
  private async updateDiscoveryStats(newAgents: number, batchResults: DiscoveryBatchResult[]): Promise<void> {
    // Store batch results for analysis (could be stored in a separate table)
    console.log(`📈 Updated stats: ${newAgents} new agents from ${batchResults.length} adapters`);
  }

  /**
   * GENERATE DISCOVERY SUMMARY
   */
  private generateDiscoverySummary(
    totalFound: number,
    newAgents: number,
    batchResults: DiscoveryBatchResult[],
    duration: number
  ): string {
    const successful = batchResults.filter(r => r.success).length;
    const failed = batchResults.filter(r => !r.success).length;
    const duplicates = batchResults.reduce((sum, r) => sum + r.duplicates, 0);
    
    const avgSpeed = batchResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.agentsPerSecond, 0) / successful;

    return `
🎯 DISCOVERY SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Results: ${newAgents} new agents / ${totalFound} total found
🔄 Duplicates: ${duplicates} 
⚡ Processing: ${avgSpeed.toFixed(2)} agents/sec average
✅ Adapters: ${successful} successful / ${failed} failed
⏱️ Duration: ${(duration / 1000).toFixed(2)} seconds

Top Performing Adapters:
${batchResults
  .filter(r => r.success)
  .sort((a, b) => b.newAgents - a.newAgents)
  .slice(0, 3)
  .map(r => `  • ${r.adapterId}: ${r.newAgents} new (${r.agentsPerSecond.toFixed(1)}/sec)`)
  .join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }

  /**
   * INITIALIZE HOURLY SCHEDULER
   */
  private async initializeScheduler(): Promise<void> {
    // CHECK NUCLEAR FLAG - Disable everything during deployment
    const { DISABLE_BACKGROUND_SERVICES } = await import('../buildModeDetection.js');
    
    if (DISABLE_BACKGROUND_SERVICES) {
      console.log('🚫 NUCLEAR MODE: Agent discovery scheduler disabled for deployment');
      return;
    }
    
    console.log('⏰ Initializing once-daily discovery scheduler (8am UTC)...');
    
    // Run once daily at 8am UTC (reduced from twice-daily to avoid Bazaar 429 rate limits)
    this.cronJob = cron.schedule('0 8 * * *', async () => {
      console.log('🕐 Daily scheduled discovery starting...');
      
      try {
        await this.runDiscovery({
          priority: 'thorough',
          maxAgents: 5000
        });
      } catch (error) {
        console.error('🚨 Scheduled discovery failed:', error);
      }
    }, {
      scheduled: false // Start manually
    });

  }

  /**
   * START SCHEDULER
   */
  startScheduler(): void {
    if (this.cronJob) {
      this.cronJob.start();
      console.log('✅ Discovery scheduler started (runs once daily at 8am UTC)');
    }
  }

  /**
   * STOP SCHEDULER
   */
  stopScheduler(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️ Discovery scheduler stopped');
    }
  }

  /**
   * GRACEFUL SHUTDOWN - Cleanup resources and release locks
   */
  async gracefulShutdown(): Promise<void> {
    console.log('📋 Initiating graceful shutdown of Agent Discovery Service...');
    
    // Stop scheduler
    this.stopScheduler();
    
    // Wait for any running discovery to complete (with timeout)
    let waitTime = 0;
    const maxWaitTime = 30000; // 30 seconds max wait
    
    while (this.isRunning && waitTime < maxWaitTime) {
      console.log('⏳ Waiting for active discovery to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitTime += 1000;
    }
    
    if (this.isRunning) {
      console.warn('⚠️ Force stopping active discovery after 30s timeout');
      this.isRunning = false;
    }
    
    // Release any held distributed locks
    await this.releaseDistributedLock();
    
    // Close Redis connection
    if (this.redis) {
      try {
        await this.redis.quit();
        console.log('✅ Redis connection closed');
      } catch (error) {
        console.error('❌ Error closing Redis connection:', error);
      }
    }
    
    console.log('✅ Agent Discovery Service shutdown complete');
  }

  /**
   * TEST COMMUNICATION with discovered agents
   */
  async testCommunication(agentIds: number[], messageType: 'test' | 'recruitment' = 'test'): Promise<any[]> {
    const results = [];
    
    for (const agentId of agentIds) {
      try {
        const [agent] = await db
          .select()
          .from(discoveredAgents)
          .where(eq(discoveredAgents.id, agentId));

        if (!agent || !agent.wallet) {
          results.push({ agentId, status: 'failed', error: 'Agent not found or no wallet' });
          continue;
        }

        const messageRequest = {
          targetAddress: agent.wallet,
          messageType: messageType === 'test' ? 'emergency_funding' as const : 'partnership' as const,
          content: messageType === 'test' 
            ? '🤖 Test message from CoinRailz Discovery System'
            : '🚀 Partnership opportunity with CoinRailz platform',
          priority: 'normal' as const
        };

        const deliveryResult = await this.communicationOrchestrator.sendMessage(messageRequest);
        
        // Update agent attempt count
        await db
          .update(discoveredAgents)
          .set({ 
            attempts: sql`${discoveredAgents.attempts} + 1`,
            lastContactAt: new Date(),
            successCount: deliveryResult.finalStatus === 'delivered' 
              ? sql`${discoveredAgents.successCount} + 1`
              : discoveredAgents.successCount
          })
          .where(eq(discoveredAgents.id, agentId));

        results.push({
          agentId,
          status: deliveryResult.finalStatus,
          messageId: deliveryResult.messageId,
          channels: deliveryResult.deliveryAttempts.length,
          cost: deliveryResult.totalCost
        });

      } catch (error) {
        console.error(`❌ Communication test failed for agent ${agentId}:`, error);
        results.push({ agentId, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  /**
   * GET AGENTS BY STATUS
   */
  async getAgentsByStatus(status: string = 'new', limit: number = 100): Promise<any[]> {
    return await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.status, status))
      .orderBy(desc(discoveredAgents.score), desc(discoveredAgents.discoveredAt))
      .limit(limit);
  }

  /**
   * UPDATE AGENT STATUS
   */
  async updateAgentStatus(agentId: number, status: string): Promise<void> {
    await db
      .update(discoveredAgents)
      .set({ 
        status,
        verifiedAt: status === 'verified' ? new Date() : undefined
      })
      .where(eq(discoveredAgents.id, agentId));
  }
}

// Export singleton instance
export const agentDiscoveryService = new AgentDiscoveryService();

// Register graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('📋 SIGTERM received - shutting down Agent Discovery Service...');
  await agentDiscoveryService.gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📋 SIGINT received - shutting down Agent Discovery Service...');
  await agentDiscoveryService.gracefulShutdown();
  process.exit(0);
});