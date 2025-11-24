/**
 * AGENT DATABASE CLEANUP SERVICE
 * 
 * Consolidates duplicate agent entries in the discovered_agents table
 * by merging records with the same canonical URL.
 * 
 * DUPLICATE ELIMINATION: Architectural fix per architect review
 */

import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { XMTPAgentScanner } from './xmtpAgentScanner';

export class AgentDatabaseCleanup {
  /**
   * Consolidate duplicate agents by canonical URL
   * Keeps the agent with highest score/most recent data
   */
  static async consolidateDuplicates(): Promise<{
    duplicatesFound: number;
    duplicatesRemoved: number;
    canonicalUrlsSet: number;
  }> {
    console.log('🧹 Starting agent database cleanup...');
    
    const stats = {
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      canonicalUrlsSet: 0,
    };

    try {
      // Step 1: Set canonical URLs for all agents that don't have one
      const agentsWithoutCanonical = await db
        .select()
        .from(discoveredAgents)
        .where(sql`${discoveredAgents.canonicalUrl} IS NULL`)
        .limit(10000);

      console.log(`📋 Found ${agentsWithoutCanonical.length} agents without canonical URL`);

      for (const agent of agentsWithoutCanonical) {
        const canonical = XMTPAgentScanner.normalizeURL(agent.url);
        
        await db
          .update(discoveredAgents)
          .set({ canonicalUrl: canonical })
          .where(eq(discoveredAgents.id, agent.id));
        
        stats.canonicalUrlsSet++;
      }

      console.log(`✅ Set canonical URLs for ${stats.canonicalUrlsSet} agents`);

      // Step 2: Find duplicate canonical URLs
      const duplicates = await db.execute<{
        canonical_url: string;
        count: number;
        ids: number[];
      }>(sql`
        SELECT 
          canonical_url,
          COUNT(*) as count,
          ARRAY_AGG(id ORDER BY score DESC, last_seen_at DESC) as ids
        FROM discovered_agents
        WHERE canonical_url IS NOT NULL
        GROUP BY canonical_url
        HAVING COUNT(*) > 1
      `);

      stats.duplicatesFound = duplicates.rows.length;
      console.log(`🔍 Found ${stats.duplicatesFound} duplicate canonical URLs`);

      // Step 3: For each duplicate group, keep the best agent and delete others
      for (const dup of duplicates.rows) {
        const ids = dup.ids as number[];
        const keepId = ids[0]; // Highest score/most recent
        const removeIds = ids.slice(1); // All others

        console.log(`🔗 Canonical URL: ${dup.canonical_url}`);
        console.log(`   Keeping agent ${keepId}, removing ${removeIds.length} duplicates: ${removeIds.join(', ')}`);

        // Delete duplicate agents
        for (const removeId of removeIds) {
          await db
            .delete(discoveredAgents)
            .where(eq(discoveredAgents.id, removeId));
          
          stats.duplicatesRemoved++;
        }
      }

      console.log(`✅ Agent database cleanup complete:`, stats);
      return stats;

    } catch (error) {
      console.error('❌ Agent database cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get duplicate statistics without removing them
   */
  static async getDuplicateStats(): Promise<{
    totalAgents: number;
    uniqueCanonicalUrls: number;
    duplicateCount: number;
    agentsWithoutCanonical: number;
  }> {
    const [total] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discoveredAgents);

    const [unique] = await db
      .select({ count: sql<number>`count(DISTINCT canonical_url)::int` })
      .from(discoveredAgents)
      .where(sql`${discoveredAgents.canonicalUrl} IS NOT NULL`);

    const [withoutCanonical] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discoveredAgents)
      .where(sql`${discoveredAgents.canonicalUrl} IS NULL`);

    return {
      totalAgents: total.count || 0,
      uniqueCanonicalUrls: unique.count || 0,
      duplicateCount: (total.count || 0) - (unique.count || 0),
      agentsWithoutCanonical: withoutCanonical.count || 0,
    };
  }
}
