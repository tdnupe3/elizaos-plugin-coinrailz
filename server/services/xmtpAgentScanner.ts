/**
 * XMTP AGENT SCANNER SERVICE
 * 
 * Discovers which AI agents support XMTP messaging by:
 * 1. Fetching /.well-known/agent-card.json from agent domains
 * 2. Extracting XMTP address from contact.xmtp field
 * 3. Verifying reachability using xmtpClient.canMessage()
 * 4. Storing results in database with full audit trail
 * 
 * Based on ChatGPT recommendations for XMTP discovery.
 * Enables zero-cost targeted outreach to XMTP-enabled agents.
 */

import { XMTPMessagingService } from './xmtpMessagingService';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';

interface AgentCardContact {
  xmtp?: string;
  discord?: string;
  telegram?: string;
  email?: string;
  twitter?: string;
  [key: string]: any;
}

interface AgentCardJson {
  name?: string;
  description?: string;
  contact?: AgentCardContact;
  capabilities?: string[];
  [key: string]: any;
}

export class XMTPAgentScanner {
  private static instance: XMTPAgentScanner | null = null;
  private xmtpService: XMTPMessagingService;
  private isScanning = false;
  
  private constructor() {
    this.xmtpService = XMTPMessagingService.getInstance();
  }
  
  public static getInstance(): XMTPAgentScanner {
    if (!XMTPAgentScanner.instance) {
      XMTPAgentScanner.instance = new XMTPAgentScanner();
    }
    return XMTPAgentScanner.instance;
  }

  /**
   * Scan all discovered agents for XMTP support
   * DUPLICATE PREVENTION: Updates existing records via URL uniqueness
   */
  async scanAllAgents(options: {
    forceRescan?: boolean;
    maxAgents?: number;
    batchSize?: number;
  } = {}): Promise<{
    scanned: number;
    xmtpEnabled: number;
    xmtpDisabled: number;
    errors: number;
    duplicatesSkipped: number;
  }> {
    if (this.isScanning) {
      console.log('⚠️ XMTP scan already in progress, skipping...');
      return { scanned: 0, xmtpEnabled: 0, xmtpDisabled: 0, errors: 0, duplicatesSkipped: 0 };
    }

    this.isScanning = true;
    console.log('🔍 Starting XMTP agent discovery scan...');

    const stats = {
      scanned: 0,
      xmtpEnabled: 0,
      xmtpDisabled: 0,
      errors: 0,
      duplicatesSkipped: 0,
    };

    try {
      // Query agents that need XMTP scanning
      // FIX: Conditionally apply .where() to prevent undefined error on forceRescan
      let query = db.select().from(discoveredAgents);
      
      if (!options.forceRescan) {
        // Only scan new/stale agents (not rescanning everything)
        query = query.where(
          or(
            isNull(discoveredAgents.xmtpLastChecked), // Never checked
            sql`${discoveredAgents.xmtpLastChecked} < NOW() - INTERVAL '7 days'` // Stale (older than 7 days)
          )
        );
      }
      
      const agentsToScan = await query.limit(options.maxAgents || 1000);

      console.log(`📊 Found ${agentsToScan.length} agents to scan for XMTP support`);

      // Process in batches to avoid overwhelming XMTP network
      const batchSize = options.batchSize || 10;
      for (let i = 0; i < agentsToScan.length; i += batchSize) {
        const batch = agentsToScan.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(agentsToScan.length / batchSize)}`);

        await Promise.allSettled(
          batch.map(agent => this.scanSingleAgent(agent, stats))
        );

        // Rate limiting between batches
        if (i + batchSize < agentsToScan.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`✅ XMTP scan complete:`, stats);
      
    } catch (error) {
      console.error('❌ XMTP scan failed:', error);
    } finally {
      this.isScanning = false;
    }

    return stats;
  }

  /**
   * Scan a single agent for XMTP support
   * DUPLICATE PREVENTION: Normalizes URL and updates canonicalUrl column
   */
  private async scanSingleAgent(
    agent: any,
    stats: { scanned: number; xmtpEnabled: number; xmtpDisabled: number; errors: number; duplicatesSkipped: number }
  ): Promise<void> {
    try {
      stats.scanned++;
      
      // Normalize URL and persist canonical form (DUPLICATE PREVENTION)
      const canonicalUrl = XMTPAgentScanner.normalizeURL(agent.url);
      
      // Check if another agent with same canonical URL exists (DUPLICATE DETECTION)
      const [duplicate] = await db
        .select()
        .from(discoveredAgents)
        .where(
          and(
            eq(discoveredAgents.canonicalUrl, canonicalUrl),
            sql`${discoveredAgents.id} != ${agent.id}` // Different agent
          )
        )
        .limit(1);
      
      if (duplicate) {
        console.log(`⚠️ Found duplicate: ${agent.url} (${agent.id}) matches ${duplicate.url} (${duplicate.id})`);
        console.log(`🔗 Canonical URL: ${canonicalUrl}`);
        stats.duplicatesSkipped++;
        
        // Mark this agent for potential consolidation (don't scan it)
        await db
          .update(discoveredAgents)
          .set({
            status: 'duplicate', // Flag as duplicate for cleanup
            canonicalUrl, // Store canonical URL for reference
          })
          .where(eq(discoveredAgents.id, agent.id));
        
        return;
      }
      
      // Update canonical URL for this agent (DUPLICATE PREVENTION)
      await db
        .update(discoveredAgents)
        .set({ canonicalUrl })
        .where(eq(discoveredAgents.id, agent.id));
      
      // Extract domain from agent URL
      const domain = this.extractDomain(agent.url);
      if (!domain) {
        console.log(`⚠️ Invalid URL for agent ${agent.id}: ${agent.url}`);
        stats.errors++;
        return;
      }

      // Fetch agent-card.json (Method 1 from ChatGPT)
      const agentCardUrl = `https://${domain}/.well-known/agent-card.json`;
      const agentCard = await this.fetchAgentCard(agentCardUrl);

      if (!agentCard) {
        // No agent-card.json found, mark as XMTP disabled
        await this.updateAgentXMTPStatus(agent.id, null, false, null);
        stats.xmtpDisabled++;
        return;
      }

      // Extract XMTP address from contact.xmtp field
      const xmtpAddress = agentCard.contact?.xmtp;
      
      if (!xmtpAddress) {
        // Agent card exists but no XMTP address
        await this.updateAgentXMTPStatus(agent.id, null, false, agentCard);
        stats.xmtpDisabled++;
        console.log(`📋 ${domain}: No XMTP address in agent-card.json`);
        return;
      }

      // Verify XMTP reachability (Method 2 from ChatGPT)
      const canMessage = await this.xmtpService.canMessageAddress(xmtpAddress);

      // Update database with results
      await this.updateAgentXMTPStatus(agent.id, xmtpAddress, canMessage, agentCard);

      if (canMessage) {
        stats.xmtpEnabled++;
        console.log(`✅ ${domain}: XMTP ENABLED (${xmtpAddress})`);
      } else {
        stats.xmtpDisabled++;
        console.log(`❌ ${domain}: XMTP address found but NOT reachable (${xmtpAddress})`);
      }

    } catch (error) {
      console.error(`❌ Error scanning agent ${agent.id}:`, error);
      stats.errors++;
    }
  }

  /**
   * Fetch agent-card.json from agent domain
   * Security: HTTPS-only, timeouts, user-agent headers, skip non-200
   */
  private async fetchAgentCard(url: string): Promise<AgentCardJson | null> {
    try {
      // Security: Enforce HTTPS
      if (!url.startsWith('https://')) {
        console.log(`⚠️ Skipping non-HTTPS URL: ${url}`);
        return null;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'CoinRailz-XMTP-Scanner/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10-second timeout
      });

      // Security: Skip non-200 responses
      if (!response.ok) {
        console.log(`⚠️ Non-200 response from ${url}: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data as AgentCardJson;

    } catch (error) {
      // Silent fail for missing agent-card.json (expected for many agents)
      return null;
    }
  }

  /**
   * Calculate XMTP quality score (0-140)
   * Based on ChatGPT recommendations for agent prioritization
   * Fixed to prevent double-counting of Discord/GitHub across sources
   */
  private async calculateQualityScore(
    agent: any,
    xmtpAddress: string | null,
    canMessage: boolean,
    agentCardData: AgentCardJson | null
  ): Promise<number> {
    let score = 0;

    // XMTP present (+30)
    if (xmtpAddress) {
      score += 30;
    }

    // canMessage true (+40)
    if (canMessage) {
      score += 40;
    }

    // Valid agent-card.json (+10)
    if (agentCardData && agentCardData.name) {
      score += 10;
    }

    // Has Discord (+10) - Check both sources but only count once
    const hasDiscord = !!(agentCardData?.contact?.discord || (agent.channels as any)?.discord);
    if (hasDiscord) {
      score += 10;
    }

    // Active facilitator (+20) - check if agent has active status or recent activity
    if (agent.status === 'verified' || agent.successCount > 0) {
      score += 20;
    }

    // Has GitHub (+20) - Check both sources but only count once
    const hasGitHub = !!(agentCardData?.contact?.github || (agent.channels as any)?.github);
    if (hasGitHub) {
      score += 20;
    }

    // Updated recently (+10) - within last 30 days
    if (agent.lastSeenAt) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(agent.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceUpdate <= 30) {
        score += 10;
      }
    }

    // Ensure score stays within 0-140 range
    return Math.min(Math.max(score, 0), 140);
  }

  /**
   * Determine XMTP status based on scan results
   */
  private determineXMTPStatus(
    xmtpAddress: string | null,
    canMessage: boolean
  ): string {
    if (!xmtpAddress) {
      return 'not_supported'; // No XMTP address found
    }
    if (canMessage) {
      return 'reachable'; // XMTP enabled and can receive messages
    }
    return 'unreachable'; // XMTP address exists but cannot message
  }

  /**
   * Update agent's XMTP status in database
   * DUPLICATE PREVENTION: Uses UPDATE by unique ID (no duplicates possible)
   */
  private async updateAgentXMTPStatus(
    agentId: number,
    xmtpAddress: string | null,
    canMessage: boolean,
    agentCardData: AgentCardJson | null
  ): Promise<void> {
    // Get current agent data for quality score calculation
    const [agent] = await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.id, agentId))
      .limit(1);

    if (!agent) return;

    // Calculate quality score
    const qualityScore = await this.calculateQualityScore(
      agent,
      xmtpAddress,
      canMessage,
      agentCardData
    );

    // Determine status
    const xmtpStatus = this.determineXMTPStatus(xmtpAddress, canMessage);

    await db
      .update(discoveredAgents)
      .set({
        xmtpAddress,
        xmtpCanMessage: canMessage,
        xmtpStatus,
        xmtpQualityScore: qualityScore,
        xmtpLastChecked: new Date(),
        agentCardData: agentCardData as any,
      })
      .where(eq(discoveredAgents.id, agentId));
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // If URL is already just a domain
      if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(url)) {
        return url;
      }
      return null;
    }
  }

  /**
   * Normalize URL to prevent duplicates
   * DUPLICATE PREVENTION: Canonical form prevents URL variations from creating duplicates
   * 
   * Handles:
   * - Trailing slashes (example.com/ → example.com)
   * - Protocol variations (http:// → https://)
   * - www prefix normalization (www.example.com → example.com)
   * - Query parameter removal
   * - Fragment removal
   * - Lowercase hostname
   */
  static normalizeURL(url: string): string {
    try {
      // Parse URL
      const urlObj = new URL(url.trim());
      
      // Always use https protocol
      urlObj.protocol = 'https:';
      
      // Remove www prefix
      let hostname = urlObj.hostname.toLowerCase();
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      urlObj.hostname = hostname;
      
      // Remove trailing slash from pathname
      let pathname = urlObj.pathname;
      if (pathname.endsWith('/') && pathname !== '/') {
        pathname = pathname.slice(0, -1);
      }
      urlObj.pathname = pathname;
      
      // Clear query params and fragments
      urlObj.search = '';
      urlObj.hash = '';
      
      return urlObj.toString();
      
    } catch {
      // If parsing fails, try basic normalization
      let normalized = url.trim().toLowerCase();
      
      // Add https:// if no protocol
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
      }
      
      // Replace http:// with https://
      normalized = normalized.replace('http://', 'https://');
      
      // Remove www.
      normalized = normalized.replace('://www.', '://');
      
      // Remove trailing slash
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      
      return normalized;
    }
  }

  /**
   * Get XMTP-enabled agents for targeted outreach
   * DUPLICATE PREVENTION: Database unique constraint on URL ensures no duplicates returned
   */
  async getXMTPEnabledAgents(limit = 100): Promise<any[]> {
    const agents = await db
      .select()
      .from(discoveredAgents)
      .where(eq(discoveredAgents.xmtpCanMessage, true))
      .limit(limit);

    console.log(`📊 Found ${agents.length} XMTP-enabled agents for outreach`);
    return agents;
  }

  /**
   * Get XMTP adoption statistics
   */
  async getXMTPStats(): Promise<{
    totalAgents: number;
    xmtpEnabled: number;
    xmtpDisabled: number;
    notChecked: number;
    adoptionRate: number;
  }> {
    const [total] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discoveredAgents);

    const [enabled] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discoveredAgents)
      .where(eq(discoveredAgents.xmtpCanMessage, true));

    const [checked] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discoveredAgents)
      .where(sql`${discoveredAgents.xmtpLastChecked} IS NOT NULL`);

    const totalAgents = total.count || 0;
    const xmtpEnabled = enabled.count || 0;
    const checkedAgents = checked.count || 0;
    const xmtpDisabled = checkedAgents - xmtpEnabled;
    const notChecked = totalAgents - checkedAgents;
    const adoptionRate = checkedAgents > 0 ? (xmtpEnabled / checkedAgents) * 100 : 0;

    return {
      totalAgents,
      xmtpEnabled,
      xmtpDisabled,
      notChecked,
      adoptionRate: Math.round(adoptionRate * 100) / 100, // 2 decimal places
    };
  }

  /**
   * Scan specific high-value targets (Truth Terminal, ai16z, Luna, etc.)
   */
  async scanHighValueTargets(): Promise<{
    truthTerminal: boolean | null;
    ai16z: boolean | null;
    luna: boolean | null;
    fereAI: boolean | null;
  }> {
    console.log('🎯 Scanning high-value AI agent targets for XMTP support...');

    const targets = [
      { name: 'truthTerminal', domain: 'truth.terminal' }, // Placeholder - need actual domain
      { name: 'ai16z', domain: 'ai16z.com' }, // Placeholder
      { name: 'luna', domain: 'virtuals.io' }, // Placeholder
      { name: 'fereAI', domain: 'fere.ai' }, // Placeholder
    ];

    const results: any = {};

    for (const target of targets) {
      try {
        const agentCardUrl = `https://${target.domain}/.well-known/agent-card.json`;
        const agentCard = await this.fetchAgentCard(agentCardUrl);
        
        if (agentCard?.contact?.xmtp) {
          const canMessage = await this.xmtpService.canMessageAddress(agentCard.contact.xmtp);
          results[target.name] = canMessage;
          console.log(`${canMessage ? '✅' : '❌'} ${target.name}: XMTP ${canMessage ? 'ENABLED' : 'DISABLED'}`);
        } else {
          results[target.name] = null;
          console.log(`⚠️ ${target.name}: No XMTP address found`);
        }
      } catch (error) {
        results[target.name] = null;
        console.log(`❌ ${target.name}: Error checking XMTP`);
      }
    }

    return results;
  }
}

export const xmtpAgentScanner = XMTPAgentScanner.getInstance();
