/**
 * BACKFILL CANONICAL URLs - Migration Script
 * 
 * Populates canonical_url column for all existing agents
 * Must be run BEFORE adding unique index on canonical_url
 * 
 * Usage:
 *   npx tsx scripts/backfillCanonicalUrls.ts
 */

import { db } from '../server/db';
import { discoveredAgents } from '../shared/schema';
import { normalizeURL } from '../server/utils/urlCanonicalizer';
import { sql, isNotNull } from 'drizzle-orm';

async function backfillCanonicalUrls() {
  console.log('🔄 Starting canonical URL backfill migration...');
  
  try {
    // Fetch all agents without canonical URLs
    const agentsToUpdate = await db
      .select()
      .from(discoveredAgents)
      .where(sql`${discoveredAgents.canonicalUrl} IS NULL`);

    console.log(`📊 Found ${agentsToUpdate.length} agents without canonical URLs`);

    if (agentsToUpdate.length === 0) {
      console.log('✅ All agents already have canonical URLs. Nothing to do.');
      return {
        updated: 0,
        skipped: 0,
        total: 0
      };
    }

    let updated = 0;
    let skipped = 0;

    // Process in batches to avoid overwhelming database
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < agentsToUpdate.length; i += BATCH_SIZE) {
      const batch = agentsToUpdate.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(agentsToUpdate.length/BATCH_SIZE)} (${batch.length} agents)...`);

      await Promise.all(
        batch.map(async (agent) => {
          const canonicalUrl = normalizeURL(agent.url);
          
          if (!canonicalUrl) {
            console.warn(`⚠️ Invalid URL cannot be normalized: ${agent.url} (ID: ${agent.id})`);
            skipped++;
            return;
          }

          try {
            await db
              .update(discoveredAgents)
              .set({ canonicalUrl })
              .where(sql`${discoveredAgents.id} = ${agent.id}`);
            
            updated++;
          } catch (error) {
            console.error(`❌ Failed to update agent ${agent.id}:`, error);
            skipped++;
          }
        })
      );

      // Small delay between batches
      if (i + BATCH_SIZE < agentsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Backfill complete!`);
    console.log(`   - Updated: ${updated} agents`);
    console.log(`   - Skipped: ${skipped} agents (invalid URLs)`);
    console.log(`   - Total: ${agentsToUpdate.length} agents`);
    
    return {
      updated,
      skipped,
      total: agentsToUpdate.length
    };

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillCanonicalUrls()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { backfillCanonicalUrls };
