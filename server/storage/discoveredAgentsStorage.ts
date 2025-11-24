/**
 * DISCOVERED AGENTS STORAGE LAYER
 * 
 * Centralized storage helper for discovered agents
 * Ensures canonical URL normalization on ALL insertions
 * Implements idempotent upsert to eliminate duplicates automatically
 * 
 * ARCHITECTURAL PATTERN (per architect review):
 * - All discovery adapters MUST use persistDiscoveredAgent()
 * - Never call db.insert(discoveredAgents) directly
 * - Canonical URLs set at write-time (not post-hoc)
 * - Duplicate prevention at storage layer (not application layer)
 */

import { db } from '../db';
import { discoveredAgents, type InsertDiscoveredAgent } from '@shared/schema';
import { normalizeURL } from '../utils/urlCanonicalizer';
import { eq, sql, or } from 'drizzle-orm';

/**
 * Persist discovered agent with automatic canonical URL normalization
 * 
 * Features:
 * - Sets canonicalUrl before insertion
 * - Idempotent upsert by canonical URL (prevents duplicates)
 * - Updates existing records if canonical URL matches
 * - Preserves best data (highest score, most recent)
 * 
 * @param data - Agent data to persist
 * @returns Inserted/updated agent record
 * 
 * @example
 * await persistDiscoveredAgent({
 *   url: 'https://agent.example.com',
 *   source: 'x402-bazaar',
 *   channels: { x402: 'https://agent.example.com' },
 * });
 */
export async function persistDiscoveredAgent(
  data: Omit<InsertDiscoveredAgent, 'canonicalUrl' | 'xmtpLastChecked'>
): Promise<typeof discoveredAgents.$inferSelect> {
  // Normalize URL to canonical form (DUPLICATE PREVENTION)
  const canonicalUrl = normalizeURL(data.url);
  
  if (!canonicalUrl) {
    throw new Error(`Cannot persist agent with invalid URL: ${data.url}`);
  }

  // MIGRATION COMPATIBILITY: Check BOTH canonical URL and normalized URL
  // After migration is complete, only need to check canonical URL
  const [existing] = await db
    .select()
    .from(discoveredAgents)
    .where(
      or(
        eq(discoveredAgents.canonicalUrl, canonicalUrl),
        eq(discoveredAgents.url, canonicalUrl) // Also check normalized URL (existing records)
      )
    )
    .limit(1);

  if (existing) {
    // Update existing agent (merge data, prefer higher scores)
    console.log(`🔄 Updating existing agent ${existing.id}: ${canonicalUrl}`);
    
    // Merge logic: prefer higher score, more recent data
    const shouldUpdate = 
      !existing.score || 
      (data.score && data.score > existing.score) ||
      !existing.lastSeenAt ||
      (existing.lastSeenAt && new Date() > new Date(existing.lastSeenAt));

    if (shouldUpdate) {
      const [updated] = await db
        .update(discoveredAgents)
        .set({
          ...data,
          canonicalUrl, // Always update canonical URL
          lastSeenAt: new Date(),
          // Merge capabilities if both exist
          capabilities: data.capabilities 
            ? { ...existing.capabilities, ...data.capabilities }
            : existing.capabilities,
          // Merge metadata if both exist
          metadata: data.metadata
            ? { ...existing.metadata, ...data.metadata }
            : existing.metadata,
        })
        .where(eq(discoveredAgents.id, existing.id))
        .returning();
      
      return updated;
    }
    
    // Update canonical URL even if data doesn't change
    if (!existing.canonicalUrl) {
      await db
        .update(discoveredAgents)
        .set({ canonicalUrl })
        .where(eq(discoveredAgents.id, existing.id));
    }
    
    // Return existing record unchanged
    return existing;
  }

  // Insert new agent
  console.log(`➕ Inserting new agent: ${canonicalUrl}`);
  
  const [inserted] = await db
    .insert(discoveredAgents)
    .values({
      ...data,
      canonicalUrl,
    })
    .returning();

  return inserted;
}

/**
 * Batch persist multiple agents (optimized for bulk imports)
 * 
 * @param agents - Array of agent data to persist
 * @returns Array of inserted/updated records
 */
export async function persistDiscoveredAgentsBatch(
  agents: Array<Omit<InsertDiscoveredAgent, 'canonicalUrl' | 'xmtpLastChecked'>>
): Promise<Array<typeof discoveredAgents.$inferSelect>> {
  const results: Array<typeof discoveredAgents.$inferSelect> = [];

  // Process in chunks to avoid overwhelming database
  const BATCH_SIZE = 50;
  for (let i = 0; i < agents.length; i += BATCH_SIZE) {
    const batch = agents.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(agent => persistDiscoveredAgent(agent))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('❌ Failed to persist agent:', result.reason);
      }
    }
  }

  return results;
}

/**
 * Get agent by canonical URL (with migration compatibility)
 * 
 * @param url - Raw or canonical URL
 * @returns Agent record or null
 */
export async function getAgentByURL(url: string): Promise<typeof discoveredAgents.$inferSelect | null> {
  const canonicalUrl = normalizeURL(url);
  if (!canonicalUrl) return null;

  // MIGRATION COMPATIBILITY: Check both canonical column and normalized url column
  const [agent] = await db
    .select()
    .from(discoveredAgents)
    .where(
      or(
        eq(discoveredAgents.canonicalUrl, canonicalUrl),
        eq(discoveredAgents.url, canonicalUrl) // Existing records have normalized URL here
      )
    )
    .limit(1);

  return agent || null;
}

/**
 * Update agent's XMTP verification status
 * 
 * @param agentId - Agent ID
 * @param xmtpAddress - XMTP wallet address
 * @param canMessage - Result of xmtpClient.canMessage() check
 * @param agentCardData - Cached agent-card.json
 */
export async function updateAgentXMTPStatus(
  agentId: number,
  xmtpAddress: string | null,
  canMessage: boolean,
  agentCardData: any | null
): Promise<void> {
  await db
    .update(discoveredAgents)
    .set({
      xmtpAddress,
      xmtpCanMessage: canMessage,
      xmtpLastChecked: new Date(),
      agentCardData,
    })
    .where(eq(discoveredAgents.id, agentId));
}
