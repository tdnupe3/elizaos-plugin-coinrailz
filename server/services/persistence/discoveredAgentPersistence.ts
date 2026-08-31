/**
 * Centralized Discovered Agent Persistence Helper
 * 
 * Provides proper URL canonicalization, type-safe inserts, and intelligent upserts
 * for discovered AI agents across all discovery adapters.
 */

import { db } from '../../db';
import { discoveredAgents } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Canonical URL normalization with proper protocol/hostname handling
 * Preserves path casing while normalizing protocol and hostname
 */
export function normalizeURL(url: string): string | null {
  if (!url) return null;
  
  try {
    let normalized = url.trim();
    
    // Add https:// if no protocol specified
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }
    
    const urlObj = new URL(normalized);
    
    // Build canonical URL: lowercase protocol + lowercase hostname (no www) + original path/search
    let canonical = urlObj.protocol.toLowerCase() + '//' + 
                   urlObj.hostname.toLowerCase().replace(/^www\./, '');
    
    // Preserve original path casing (important for case-sensitive servers)
    if (urlObj.pathname !== '/') {
      canonical += urlObj.pathname;
    }
    
    // Preserve search params
    if (urlObj.search) {
      canonical += urlObj.search;
    }
    
    // Remove trailing slash (unless it's just the root)
    return canonical.replace(/\/$/, '');
  } catch (error) {
    console.warn(`⚠️ Invalid URL for canonicalization: ${url}`);
    return null;
  }
}

/**
 * Type-safe agent data for persistence
 */
export interface DiscoveredAgentData {
  url: string;
  source: string;
  wallet?: string | null;
  status?: string;
  score?: number;
  channels?: Record<string, any>;
  capabilities?: Record<string, any> | string[];
  metadata?: Record<string, any>;
  verifiedAt?: Date;
}

/**
 * Persist or update a discovered agent with proper canonicalization and merge semantics
 * 
 * @param agentData - Type-safe agent data
 * @returns Inserted or updated agent record
 */
export async function persistDiscoveredAgent(agentData: DiscoveredAgentData) {
  const canonicalUrl = normalizeURL(agentData.url);
  
  if (!canonicalUrl) {
    throw new Error(`Invalid URL for agent persistence: ${agentData.url}`);
  }
  
  const [result] = await db.insert(discoveredAgents).values({
    url: canonicalUrl,
    canonicalUrl,
    source: agentData.source,
    wallet: agentData.wallet || null,
    status: agentData.status || 'new',
    score: agentData.score || 0,
    channels: agentData.channels || {},
    capabilities: agentData.capabilities || {},
    metadata: agentData.metadata || {},
    verifiedAt: agentData.verifiedAt,
    discoveredAt: new Date(),
    lastSeenAt: new Date()
  }).onConflictDoUpdate({
    target: discoveredAgents.url,
    set: {
      // Only refresh lastSeenAt on update (preserve discoveredAt/verifiedAt)
      lastSeenAt: sql`NOW()`,
      // Intelligent JSONB merge for metadata/channels/capabilities
      metadata: sql`${discoveredAgents.metadata} || EXCLUDED.metadata`,
      channels: sql`${discoveredAgents.channels} || EXCLUDED.channels`,
      capabilities: sql`${discoveredAgents.capabilities} || EXCLUDED.capabilities`,
      // Update score if new value is higher
      score: sql`GREATEST(${discoveredAgents.score}, EXCLUDED.score)`,
      // Update source if more specific (prefer registry/ens over scraper)
      source: sql`CASE 
        WHEN EXCLUDED.source IN ('ens', 'registry', 'self-registration') 
          AND ${discoveredAgents.source} NOT IN ('ens', 'registry', 'self-registration')
        THEN EXCLUDED.source
        ELSE ${discoveredAgents.source}
      END`
    }
  }).returning();
  
  return result;
}

/**
 * Get agent by URL (with canonical URL lookup)
 */
export async function getAgentByURL(url: string) {
  const canonicalUrl = normalizeURL(url);
  
  if (!canonicalUrl) {
    return null;
  }
  
  return await db.query.discoveredAgents.findFirst({
    where: (agents, { eq }) => eq(agents.url, canonicalUrl)
  });
}
