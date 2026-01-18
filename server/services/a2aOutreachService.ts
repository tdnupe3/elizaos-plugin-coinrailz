import axios, { AxiosError } from 'axios';
import { db } from '../db';
import { discoveredAgents, a2aOutreachLogs } from '@shared/schema';
import { eq, and, isNull, or, lt, sql, count, not, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * A2A OUTREACH SERVICE
 * 
 * Sends protocol-compliant A2A tasks to discovered agents
 * for B2B revenue generation via MCP Payments Kit integration proposals
 * 
 * Features:
 * - JSON-RPC message/send task creation
 * - Per-agent rate limiting (1 req per 5 seconds)
 * - Global concurrency cap (10 concurrent requests)
 * - Exponential backoff with circuit breaker
 * - Opt-out tracking
 * - Response webhook handling
 */

interface A2ATaskResult {
  success: boolean;
  taskId?: string;
  contextId?: string;
  status?: string;
  error?: string;
  responseData?: any;
}

interface OutreachStats {
  total: number;
  sent: number;
  pending: number;
  responded: number;
  interested: number;
  declined: number;
  errors: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
}

export class A2AOutreachService {
  private readonly USER_AGENT = 'CoinRailz-A2A-Outreach/1.0';
  private readonly TIMEOUT_MS = 10000;
  private readonly RATE_LIMIT_MS = 5000; // 5 seconds between requests per agent
  private readonly MAX_CONCURRENT = 10;
  private readonly MAX_RETRIES = 3;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

  private activeRequests = 0;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private lastRequestTime: Map<string, number> = new Map();

  /**
   * Get our A2A agent card URL for reciprocal discovery
   */
  private getOurAgentCardUrl(): string {
    return process.env.REPLIT_DEPLOYMENT_URL 
      ? `${process.env.REPLIT_DEPLOYMENT_URL}/.well-known/agent-card.json`
      : 'https://coinrailz.xyz/.well-known/agent-card.json';
  }

  /**
   * Get response webhook URL for push notifications
   */
  private getResponseWebhookUrl(): string {
    return process.env.REPLIT_DEPLOYMENT_URL 
      ? `${process.env.REPLIT_DEPLOYMENT_URL}/api/a2a-protocol/responses`
      : 'https://coinrailz.xyz/api/a2a-protocol/responses';
  }

  /**
   * Generate A2A outreach task payload
   * Optimized for revenue generation based on architect guidance
   */
  private generateTaskPayload(agentName: string, agentSkills: string[] = []): object {
    const messageId = nanoid();
    const trialCode = `A2A-${nanoid(8).toUpperCase()}`;
    
    const hasPaymentSkills = agentSkills.some(s => 
      /payment|commerce|billing|marketplace|transaction|checkout|wallet/i.test(s)
    );

    const primaryMessage = hasPaymentSkills
      ? 'Integration Opportunity: Enhance your payment capabilities with single-call checkout'
      : 'Integration Opportunity: Add payment processing to your AI agent in minutes';

    return {
      jsonrpc: '2.0',
      id: `coinrailz-outreach-${messageId}`,
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [
            {
              kind: 'text',
              text: primaryMessage
            },
            {
              kind: 'data',
              data: {
                type: 'payment_infrastructure_proposal',
                provider: 'Coin Railz',
                proposalId: messageId,
                offering: {
                  name: 'MCP Payments Kit',
                  description: 'Production-ready single-call checkout endpoint for AI agents. Supports Stripe (fiat), x402 (on-chain USDC), and credits (pre-purchased balance).',
                  keyFeatures: [
                    'Single API call checkout',
                    'ACID-compliant transactions',
                    'Multi-chain USDC settlement (8 chains)',
                    '284ms average setup time',
                    'Zero integration fees during trial'
                  ],
                  paymentMethods: ['stripe_fiat', 'x402_crypto', 'credits'],
                  supportedChains: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bnb', 'avalanche', 'solana'],
                  settlementCurrency: 'USDC',
                  setupTime: '284ms',
                  acidTransactions: true,
                  production: true
                },
                trialOffer: {
                  credits: 50,
                  currency: 'USD',
                  code: trialCode,
                  validDays: 30,
                  noCardRequired: true
                },
                integration: {
                  docsUrl: 'https://coinrailz.xyz/docs/mcp-payments-kit',
                  quickstartUrl: 'https://coinrailz.xyz/docs/quickstart',
                  sdkUrl: 'https://www.npmjs.com/package/@coinrailz/mcp-payments',
                  agentCard: this.getOurAgentCardUrl()
                },
                callToAction: {
                  action: 'reply_to_integrate',
                  supportedResponses: ['interested', 'schedule_demo', 'request_info', 'decline'],
                  contactEmail: 'integrations@coinrailz.xyz'
                }
              }
            }
          ],
          messageId: messageId
        },
        configuration: {
          pushNotificationConfig: {
            url: this.getResponseWebhookUrl(),
            token: process.env.A2A_WEBHOOK_SECRET
          }
        },
        metadata: {
          source: 'coinrailz-a2a-outreach',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Check if circuit breaker is open for an agent
   */
  private isCircuitOpen(agentUrl: string): boolean {
    const state = this.circuitBreakers.get(agentUrl);
    if (!state || !state.isOpen) return false;

    // Check if reset time has passed
    if (state.lastFailure && 
        Date.now() - state.lastFailure.getTime() > this.CIRCUIT_BREAKER_RESET_MS) {
      state.isOpen = false;
      state.failures = 0;
      return false;
    }

    return true;
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(agentUrl: string): void {
    const state = this.circuitBreakers.get(agentUrl) || {
      failures: 0,
      lastFailure: null,
      isOpen: false
    };

    state.failures++;
    state.lastFailure = new Date();

    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      console.log(`🔴 Circuit breaker OPEN for ${agentUrl}`);
    }

    this.circuitBreakers.set(agentUrl, state);
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(agentUrl: string): void {
    this.circuitBreakers.delete(agentUrl);
  }

  /**
   * Send A2A task to a single agent
   */
  async sendTask(agentUrl: string, agentEndpoint: string, agentName: string, agentSkills: string[] = []): Promise<A2ATaskResult> {
    // Check circuit breaker
    if (this.isCircuitOpen(agentUrl)) {
      return { success: false, error: 'Circuit breaker open' };
    }

    // Check rate limit
    const lastRequest = this.lastRequestTime.get(agentUrl) || 0;
    const timeSinceLastRequest = Date.now() - lastRequest;
    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_MS - timeSinceLastRequest));
    }

    // Check global concurrency
    while (this.activeRequests >= this.MAX_CONCURRENT) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activeRequests++;
    this.lastRequestTime.set(agentUrl, Date.now());

    try {
      const payload = this.generateTaskPayload(agentName, agentSkills);
      
      console.log(`📤 A2A Outreach: Sending task to ${agentName} at ${agentEndpoint}`);

      const response = await axios.post(agentEndpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': this.USER_AGENT,
        },
        timeout: this.TIMEOUT_MS,
      });

      // Parse JSON-RPC response
      const result = response.data;
      
      if (result.error) {
        this.recordFailure(agentUrl);
        return {
          success: false,
          error: result.error.message || 'JSON-RPC error',
          responseData: result.error
        };
      }

      this.recordSuccess(agentUrl);

      // Extract task info from result
      const taskResult = result.result || {};
      return {
        success: true,
        taskId: taskResult.id,
        contextId: taskResult.contextId,
        status: taskResult.status?.state || 'submitted',
        responseData: taskResult
      };

    } catch (error) {
      this.recordFailure(agentUrl);
      
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response 
        ? `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`
        : axiosError.message;

      console.error(`❌ A2A Outreach failed for ${agentName}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Get A2A-verified agents ready for outreach
   * Prioritizes agents with payment/commerce skills
   * Includes agents from a2a-public-registry (confirmed A2A compatible)
   */
  async getVerifiedAgentsForOutreach(limit: number = 50): Promise<any[]> {
    const agents = await db.select()
      .from(discoveredAgents)
      .where(
        and(
          or(
            eq(discoveredAgents.status, 'verified'),
            eq(discoveredAgents.source, 'a2a-public-registry')
          ),
          or(
            isNull(discoveredAgents.lastContactAt),
            lt(discoveredAgents.lastContactAt, sql`NOW() - INTERVAL '7 days'`)
          ),
          sql`${discoveredAgents.status} != 'opt_out'`
        )
      )
      .limit(limit);

    // Sort by priority: agents with payment skills first, then by score
    return agents.sort((a, b) => {
      const aHasPaymentSkills = this.hasPaymentSkills(a.capabilities);
      const bHasPaymentSkills = this.hasPaymentSkills(b.capabilities);
      
      if (aHasPaymentSkills && !bHasPaymentSkills) return -1;
      if (!aHasPaymentSkills && bHasPaymentSkills) return 1;
      return (b.score || 0) - (a.score || 0);
    });
  }

  /**
   * Check if agent has payment-related skills
   */
  private hasPaymentSkills(capabilities: any): boolean {
    if (!capabilities) return false;
    
    const capStr = JSON.stringify(capabilities).toLowerCase();
    return /payment|commerce|billing|marketplace|transaction|checkout|wallet|finance|money/i.test(capStr);
  }

  /**
   * Check if agent is a high-value developer/platform target
   * Must match explicit allowlist patterns - excludes Lifie.ai business directory
   */
  private isHighValueTarget(agent: any): boolean {
    const url = agent.url?.toLowerCase() || '';
    
    // Explicitly exclude Lifie.ai business directory entries
    if (url.includes('lifie.ai') || url.includes('hub.lifie.ai')) {
      return false;
    }
    
    // Must match explicit high-value platform patterns
    const highValuePatterns = [
      'modal.run',      // Modal deployments (real AI agents)
      'telex.im',       // Telex platform
      'a2aregistry.org', // Official registry demos
      'railway.app',    // Railway deployments
      'fly.io',         // Fly.io deployments
      'render.com',     // Render deployments
      'cloudrun.app',   // Google Cloud Run
      'vercel.app',     // Vercel deployments
      'azure',          // Azure deployments
      'langchain',      // LangChain ecosystem
      'langgraph',      // LangGraph ecosystem
      'replit.app',     // Replit deployments
      'heroku',         // Heroku deployments
    ];
    
    return highValuePatterns.some(p => url.includes(p));
  }

  /**
   * Get high-value developer/platform agents for targeted outreach
   * Returns agents with accurate isHighValue flag per agent
   */
  async getHighValueAgents(limit: number = 20): Promise<Array<any & { isHighValue: boolean }>> {
    const agents = await this.getVerifiedAgentsForOutreach(limit * 5);
    
    // Mark each agent with accurate isHighValue flag
    const markedAgents = agents.map(a => ({
      ...a,
      isHighValue: this.isHighValueTarget(a)
    }));
    
    // Sort: high-value first, then by score
    markedAgents.sort((a, b) => {
      if (a.isHighValue && !b.isHighValue) return -1;
      if (!a.isHighValue && b.isHighValue) return 1;
      return (b.score || 0) - (a.score || 0);
    });
    
    return markedAgents.slice(0, limit);
  }

  /**
   * Sync agents from official a2aregistry.org
   * Preserves original source for existing agents, uses 'registry_synced' status for new agents
   */
  async syncFromA2ARegistry(): Promise<{
    total: number;
    added: number;
    updated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let added = 0;
    let updated = 0;

    try {
      console.log('🔄 Syncing agents from a2aregistry.org...');
      
      const response = await axios.get('https://a2aregistry.org/registry.json', {
        timeout: 30000,
        headers: { 'User-Agent': this.USER_AGENT }
      });

      const registry = response.data;
      const agents = registry.agents || [];

      console.log(`📊 Found ${agents.length} agents in a2aregistry.org`);

      for (const agent of agents) {
        try {
          // Skip our own agent
          if (agent.url?.includes('coinrailz.com')) continue;

          const existingAgent = await db.select()
            .from(discoveredAgents)
            .where(eq(discoveredAgents.url, agent.url))
            .limit(1);

          if (existingAgent.length > 0) {
            // Update existing agent - preserve original source, just update metadata
            await db.update(discoveredAgents)
              .set({
                capabilities: agent.capabilities,
                metadata: {
                  ...(existingAgent[0].metadata as object || {}),
                  name: agent.name,
                  description: agent.description,
                  provider: agent.provider,
                  skills: agent.skills,
                  wellKnownURI: agent.wellKnownURI,
                  version: agent.version,
                  protocolVersion: agent.protocolVersion,
                  registrySyncedAt: new Date().toISOString()
                },
                lastSeenAt: new Date(),
                // Boost score for high-value targets, but preserve higher existing scores
                score: Math.max(
                  existingAgent[0].score || 0,
                  this.isHighValueTarget({ url: agent.url }) ? 95 : 80
                )
              })
              .where(eq(discoveredAgents.id, existingAgent[0].id));
            updated++;
          } else {
            // Add new agent with registry_synced status (not verified - need to probe first)
            await db.insert(discoveredAgents).values({
              url: agent.url,
              source: 'a2aregistry-official',
              status: 'registry_synced', // Not verified until we confirm reachability
              score: this.isHighValueTarget({ url: agent.url }) ? 95 : 80,
              capabilities: agent.capabilities,
              metadata: {
                name: agent.name,
                description: agent.description,
                provider: agent.provider,
                skills: agent.skills,
                wellKnownURI: agent.wellKnownURI,
                version: agent.version,
                protocolVersion: agent.protocolVersion,
                registrySyncedAt: new Date().toISOString()
              },
              discoveredAt: new Date()
            });
            added++;
          }
        } catch (err) {
          errors.push(`Failed to process ${agent.name}: ${(err as Error).message}`);
        }
      }

      console.log(`✅ Registry sync complete: ${added} added, ${updated} updated`);

      return { total: agents.length, added, updated, errors };

    } catch (error) {
      const errMsg = `Failed to fetch a2aregistry.org: ${(error as Error).message}`;
      console.error(`❌ ${errMsg}`);
      errors.push(errMsg);
      return { total: 0, added: 0, updated: 0, errors };
    }
  }
  
  /**
   * Get count of high-value vs regular agents for dynamic reporting
   */
  async getDiscoveryStats(): Promise<{
    totalAgents: number;
    highValueCount: number;
    lifieHubCount: number;
    otherCount: number;
  }> {
    const allAgents = await this.getVerifiedAgentsForOutreach(500);
    
    let highValueCount = 0;
    let lifieHubCount = 0;
    
    for (const agent of allAgents) {
      const url = agent.url?.toLowerCase() || '';
      if (this.isHighValueTarget(agent)) {
        highValueCount++;
      } else if (url.includes('lifie.ai') || url.includes('hub.lifie.ai')) {
        lifieHubCount++;
      }
    }
    
    return {
      totalAgents: allAgents.length,
      highValueCount,
      lifieHubCount,
      otherCount: allAgents.length - highValueCount - lifieHubCount
    };
  }
  
  /**
   * Get all agents that need reachability verification (including registry_synced, new, unverified)
   * Does NOT filter by lastContactAt - gets all candidates for probing
   */
  private async getAgentsForReachabilityCheck(limit: number, highValueOnly: boolean): Promise<any[]> {
    // Query all agents that might need verification (including registry_synced, new status)
    const candidates = await db.select()
      .from(discoveredAgents)
      .where(
        and(
          not(eq(discoveredAgents.status, 'unreachable')), // Skip known unreachable
          not(eq(discoveredAgents.source, 'coinrailz')) // Skip our own agent
        )
      )
      .orderBy(desc(discoveredAgents.score))
      .limit(limit * 3); // Get more than needed for filtering
    
    if (highValueOnly) {
      // Filter to only high-value targets
      return candidates.filter(a => this.isHighValueTarget(a)).slice(0, limit);
    }
    
    return candidates.slice(0, limit);
  }

  /**
   * Verify reachability of agents by probing their .well-known/agent.json endpoint
   * Uses separate reachabilityStatus metadata field - preserves original status
   */
  async verifyAgentReachability(options: {
    limit?: number;
    highValueOnly?: boolean;
  } = {}): Promise<{
    total: number;
    reachable: number;
    unreachable: number;
    unknown: number;
    errors: string[];
    results: Array<{
      agentId: number;
      url: string;
      name: string;
      reachable: boolean | null;
      responseTime?: number;
      error?: string;
    }>;
  }> {
    const { limit = 20, highValueOnly = false } = options;
    const errors: string[] = [];
    const results: Array<{
      agentId: number;
      url: string;
      name: string;
      reachable: boolean | null;
      responseTime?: number;
      error?: string;
    }> = [];
    
    let reachable = 0;
    let unreachable = 0;
    let unknown = 0;

    console.log(`🔍 Verifying reachability of ${limit} agents (highValueOnly: ${highValueOnly})`);

    // Get all candidates for verification (not just verified ones)
    const agents = await this.getAgentsForReachabilityCheck(limit, highValueOnly);

    console.log(`📊 Probing ${agents.length} agents...`);

    for (const agent of agents) {
      const startTime = Date.now();
      const agentName = (agent.metadata as any)?.name || agent.url;
      const metadata = agent.metadata as any || {};
      
      try {
        // Build .well-known URL - try wellKnownURI from metadata first if available
        let wellKnownUrl: string;
        if (metadata.wellKnownURI) {
          wellKnownUrl = metadata.wellKnownURI;
        } else {
          const baseUrl = agent.url.replace(/\/+$/, '');
          if (baseUrl.includes('/.well-known/agent')) {
            wellKnownUrl = baseUrl;
          } else {
            wellKnownUrl = `${baseUrl}/.well-known/agent.json`;
          }
        }

        // Probe the endpoint
        const response = await axios.get(wellKnownUrl, {
          timeout: 10000,
          headers: { 
            'User-Agent': this.USER_AGENT,
            'Accept': 'application/json'
          },
          validateStatus: () => true // Accept all status codes
        });

        const responseTime = Date.now() - startTime;
        
        // Determine reachability based on status code
        let reachabilityStatus: 'reachable' | 'unreachable' | 'unknown';
        if (response.status >= 200 && response.status < 400) {
          reachabilityStatus = 'reachable';
          reachable++;
        } else if (response.status >= 400 && response.status < 500) {
          // 4xx could mean different endpoint path - mark as unknown, not unreachable
          reachabilityStatus = 'unknown';
          unknown++;
        } else {
          // 5xx = server error = unreachable
          reachabilityStatus = 'unreachable';
          unreachable++;
        }

        // Update metadata with probe results - preserve original status
        await db.update(discoveredAgents)
          .set({
            // Only update status to verified if probe was successful and current status is not already verified
            status: reachabilityStatus === 'reachable' && agent.status !== 'verified' 
              ? 'verified' : agent.status,
            verifiedAt: reachabilityStatus === 'reachable' ? new Date() : agent.verifiedAt,
            metadata: {
              ...metadata,
              reachabilityStatus,
              lastProbeAt: new Date().toISOString(),
              probeResponseTime: responseTime,
              probeStatus: response.status,
              probedUrl: wellKnownUrl
            }
          })
          .where(eq(discoveredAgents.id, agent.id));
          
        results.push({
          agentId: agent.id,
          url: agent.url,
          name: agentName,
          reachable: reachabilityStatus === 'reachable' ? true : 
                    reachabilityStatus === 'unreachable' ? false : null,
          responseTime
        });

        // Rate limiting between probes
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        unreachable++;
        const error = err as any;
        const errorMsg = error.code === 'ECONNABORTED' ? 'Timeout' : 
                        error.code || error.message || 'Unknown error';
        
        // Update metadata with error - preserve original status (don't mark unreachable on transient errors)
        await db.update(discoveredAgents)
          .set({
            metadata: {
              ...metadata,
              reachabilityStatus: 'error',
              lastProbeAt: new Date().toISOString(),
              probeError: errorMsg
            }
          })
          .where(eq(discoveredAgents.id, agent.id));
          
        results.push({
          agentId: agent.id,
          url: agent.url,
          name: agentName,
          reachable: false,
          error: errorMsg
        });
        
        errors.push(`${agentName}: ${errorMsg}`);
      }
    }

    console.log(`✅ Reachability check complete: ${reachable} reachable, ${unknown} unknown, ${unreachable} unreachable`);

    return {
      total: agents.length,
      reachable,
      unreachable,
      unknown,
      errors,
      results
    };
  }

  /**
   * Run outreach campaign to verified A2A agents
   */
  async runOutreachCampaign(options: {
    limit?: number;
    dryRun?: boolean;
    campaignId?: string;
  } = {}): Promise<{
    campaignId: string;
    results: Array<{
      agentId: number;
      agentName: string;
      success: boolean;
      taskId?: string;
      error?: string;
    }>;
    stats: OutreachStats;
  }> {
    const { limit = 50, dryRun = false, campaignId = `a2a-campaign-${nanoid(8)}` } = options;

    console.log(`🚀 Starting A2A outreach campaign: ${campaignId} (limit: ${limit}, dryRun: ${dryRun})`);

    const agents = await this.getVerifiedAgentsForOutreach(limit);
    console.log(`📊 Found ${agents.length} verified agents for outreach`);

    const results: Array<{
      agentId: number;
      agentName: string;
      success: boolean;
      taskId?: string;
      error?: string;
    }> = [];

    const stats: OutreachStats = {
      total: agents.length,
      sent: 0,
      pending: 0,
      responded: 0,
      interested: 0,
      declined: 0,
      errors: 0
    };

    for (const agent of agents) {
      // Extract A2A endpoint from metadata or capabilities
      const metadata = agent.metadata as any || {};
      const capabilities = agent.capabilities as any || {};
      
      const agentEndpoint = metadata.a2aEndpoint || 
                           metadata.url ||
                           capabilities.url ||
                           `${agent.url}/a2a`;

      const agentName = metadata.name || 
                       capabilities.name ||
                       agent.url;

      const skills = capabilities.skills?.map((s: any) => s.name || s.id || s) || [];

      if (dryRun) {
        console.log(`[DRY RUN] Would send to: ${agentName} at ${agentEndpoint}`);
        results.push({
          agentId: agent.id,
          agentName,
          success: true,
          taskId: 'dry-run'
        });
        stats.pending++;
        continue;
      }

      // Send the task
      const taskResult = await this.sendTask(agent.url, agentEndpoint, agentName, skills);

      results.push({
        agentId: agent.id,
        agentName,
        success: taskResult.success,
        taskId: taskResult.taskId,
        error: taskResult.error
      });

      if (taskResult.success) {
        stats.sent++;

        // Record outreach in database
        await db.insert(a2aOutreachLogs).values({
          agentId: agent.id,
          agentUrl: agent.url,
          agentName: agentName,
          campaignId: campaignId,
          taskId: taskResult.taskId,
          contextId: taskResult.contextId,
          status: 'sent',
          taskStatus: taskResult.status,
          trialCreditsOffered: 50, // $50 trial credits offer
          sentAt: new Date()
        });

        // Update agent last contact time
        await db.update(discoveredAgents)
          .set({ 
            lastContactAt: new Date(),
            attempts: sql`${discoveredAgents.attempts} + 1`
          })
          .where(eq(discoveredAgents.id, agent.id));

      } else {
        stats.errors++;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ Campaign ${campaignId} completed: ${stats.sent} sent, ${stats.errors} errors`);

    return { campaignId, results, stats };
  }

  /**
   * Process incoming A2A response (from webhook)
   */
  async processResponse(responseData: any): Promise<{
    success: boolean;
    agentId?: number;
    status?: string;
    intent?: string;
  }> {
    try {
      const taskId = responseData.id || responseData.taskId;
      const status = responseData.status?.state || responseData.status;
      
      // Find the outreach log by task ID
      const logs = await db.select()
        .from(a2aOutreachLogs)
        .where(eq(a2aOutreachLogs.taskId, taskId));

      const matchingLog = logs[0];

      if (!matchingLog) {
        console.log(`⚠️ No matching outreach found for task ${taskId}`);
        return { success: false };
      }

      // Determine intent from response
      let intent = 'unknown';
      if (status === 'completed') {
        // Check artifacts for response content
        const artifacts = responseData.artifacts || [];
        const responseText = artifacts
          .flatMap((a: any) => a.parts || [])
          .filter((p: any) => p.kind === 'text')
          .map((p: any) => p.text)
          .join(' ');

        if (/interested|yes|integrate|demo|schedule/i.test(responseText)) {
          intent = 'interested';
        } else if (/no|decline|not interested|unsubscribe/i.test(responseText)) {
          intent = 'declined';
        } else if (/info|question|more|details/i.test(responseText)) {
          intent = 'needs_info';
        }
      } else if (status === 'rejected') {
        intent = 'declined';
      }

      // Update outreach log
      await db.update(a2aOutreachLogs)
        .set({
          status: intent === 'interested' ? 'interested' : 
                 intent === 'declined' ? 'declined' :
                 intent === 'needs_info' ? 'needs_info' : 'responded',
          responseIntent: intent,
          taskStatus: status,
          respondedAt: new Date(),
          responseContent: JSON.stringify(responseData),
          updatedAt: new Date()
        })
        .where(eq(a2aOutreachLogs.id, matchingLog.id));

      // Update agent status if declined (opt-out)
      if (intent === 'declined') {
        await db.update(discoveredAgents)
          .set({ status: 'opt_out' })
          .where(eq(discoveredAgents.id, matchingLog.agentId));
      }

      // Update success count if interested
      if (intent === 'interested') {
        await db.update(discoveredAgents)
          .set({ successCount: sql`${discoveredAgents.successCount} + 1` })
          .where(eq(discoveredAgents.id, matchingLog.agentId));
      }

      console.log(`📬 Processed A2A response: ${taskId} -> ${intent}`);

      return {
        success: true,
        agentId: matchingLog.agentId,
        status,
        intent
      };

    } catch (error) {
      console.error('Error processing A2A response:', error);
      return { success: false };
    }
  }

  /**
   * Get outreach campaign statistics
   */
  async getCampaignStats(campaignId?: string): Promise<OutreachStats> {
    let logs;
    if (campaignId) {
      logs = await db.select()
        .from(a2aOutreachLogs)
        .where(eq(a2aOutreachLogs.campaignId, campaignId));
    } else {
      logs = await db.select().from(a2aOutreachLogs);
    }

    return {
      total: logs.length,
      sent: logs.filter(m => m.status === 'sent').length,
      pending: logs.filter(m => m.status === 'pending').length,
      responded: logs.filter(m => ['responded', 'interested', 'needs_info', 'declined'].includes(m.status)).length,
      interested: logs.filter(m => m.status === 'interested').length,
      declined: logs.filter(m => m.status === 'declined').length,
      errors: logs.filter(m => m.status === 'error').length
    };
  }

  /**
   * Get pipeline data for sales tracking
   */
  async getPipelineData(): Promise<{
    interested: any[];
    needsInfo: any[];
    declined: any[];
    pending: any[];
  }> {
    const logs = await db.select({
      outreach: a2aOutreachLogs,
      agent: discoveredAgents
    })
      .from(a2aOutreachLogs)
      .leftJoin(discoveredAgents, eq(a2aOutreachLogs.agentId, discoveredAgents.id));

    return {
      interested: logs.filter(m => m.outreach.status === 'interested'),
      needsInfo: logs.filter(m => m.outreach.status === 'needs_info'),
      declined: logs.filter(m => m.outreach.status === 'declined'),
      pending: logs.filter(m => m.outreach.status === 'sent')
    };
  }
}

export const a2aOutreachService = new A2AOutreachService();
