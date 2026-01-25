/**
 * XMTP Reachability Probe Script
 * 
 * Probes discovered agent wallet addresses for XMTP reachability.
 * Updates discovered_agents table with results.
 * 
 * Run: npx tsx server/scripts/probeXMTPReachability.ts
 */

import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, and, or, isNull, sql, ne } from 'drizzle-orm';
import { XMTPMessagingService } from '../services/xmtpMessagingService';

interface ProbeResults {
  total: number;
  probed: number;
  xmtpReachable: number;
  notReachable: number;
  errors: number;
  skipped: number;
}

async function probeXMTPReachability(): Promise<ProbeResults> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   XMTP REACHABILITY PROBE                                    ║');
  console.log('║   Checking 726 discovered agent wallets                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results: ProbeResults = {
    total: 0,
    probed: 0,
    xmtpReachable: 0,
    notReachable: 0,
    errors: 0,
    skipped: 0
  };

  try {
    // Get XMTP service instance
    const xmtpService = XMTPMessagingService.getInstance();
    
    // Wait for initialization
    console.log('🔧 Initializing XMTP service...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fetch all agents with wallet addresses that haven't been probed recently
    const agentsWithWallets = await db
      .select({
        id: discoveredAgents.id,
        url: discoveredAgents.url,
        wallet: discoveredAgents.wallet,
        source: discoveredAgents.source,
        xmtpCanMessage: discoveredAgents.xmtpCanMessage,
        xmtpLastChecked: discoveredAgents.xmtpLastChecked,
        score: discoveredAgents.score
      })
      .from(discoveredAgents)
      .where(
        and(
          sql`${discoveredAgents.wallet} IS NOT NULL`,
          sql`${discoveredAgents.wallet} != ''`,
          sql`${discoveredAgents.wallet} ~ '^0x[a-fA-F0-9]{40}$'`, // Valid EVM address
          or(
            isNull(discoveredAgents.xmtpLastChecked),
            sql`${discoveredAgents.xmtpLastChecked} < NOW() - INTERVAL '7 days'`
          )
        )
      )
      .orderBy(sql`${discoveredAgents.score} DESC NULLS LAST`)
      .limit(750);

    results.total = agentsWithWallets.length;
    console.log(`📊 Found ${results.total} agents with wallets to probe\n`);

    if (results.total === 0) {
      console.log('✅ All agents already probed recently. Nothing to do.');
      return results;
    }

    // Process in batches of 50 for efficiency
    const batchSize = 50;
    const reachableAddresses: string[] = [];
    
    for (let i = 0; i < agentsWithWallets.length; i += batchSize) {
      const batch = agentsWithWallets.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(agentsWithWallets.length / batchSize);
      
      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} agents)`);
      
      // Extract wallet addresses from batch
      const walletAddresses = batch.map(a => a.wallet!).filter(Boolean);
      
      try {
        // Bulk check XMTP reachability
        const { IdentifierKind } = await import('@xmtp/node-sdk');
        
        // Check via service's canMessageAddress for each
        for (const agent of batch) {
          try {
            const canMessage = await xmtpService.canMessageAddress(agent.wallet!);
            
            // Update database
            await db
              .update(discoveredAgents)
              .set({
                xmtpCanMessage: canMessage,
                xmtpLastChecked: new Date(),
                xmtpStatus: canMessage ? 'reachable' : 'unreachable',
                xmtpAddress: canMessage ? agent.wallet : null
              })
              .where(eq(discoveredAgents.id, agent.id));
            
            results.probed++;
            
            if (canMessage) {
              results.xmtpReachable++;
              reachableAddresses.push(agent.wallet!);
              console.log(`  ✅ ${agent.wallet?.slice(0, 10)}... XMTP REACHABLE`);
            } else {
              results.notReachable++;
            }
            
          } catch (err) {
            results.errors++;
            console.log(`  ❌ ${agent.wallet?.slice(0, 10)}... Error: ${(err as Error).message.slice(0, 50)}`);
          }
        }
        
      } catch (batchError) {
        console.error(`  ❌ Batch error: ${(batchError as Error).message}`);
        results.errors += batch.length;
      }
      
      // Progress update
      const progress = ((i + batch.length) / agentsWithWallets.length * 100).toFixed(1);
      console.log(`  📈 Progress: ${progress}% | Reachable: ${results.xmtpReachable}`);
      
      // Rate limiting
      if (i + batchSize < agentsWithWallets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 XMTP REACHABILITY PROBE COMPLETE');
    console.log('═'.repeat(60));
    console.log(`Total agents with wallets: ${results.total}`);
    console.log(`Probed: ${results.probed}`);
    console.log(`XMTP Reachable: ${results.xmtpReachable} ✅`);
    console.log(`Not Reachable: ${results.notReachable}`);
    console.log(`Errors: ${results.errors}`);
    console.log('═'.repeat(60));
    
    if (reachableAddresses.length > 0) {
      console.log('\n🎯 XMTP-REACHABLE ADDRESSES (Ready for outreach):');
      reachableAddresses.forEach((addr, i) => {
        console.log(`  ${i + 1}. ${addr}`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error during XMTP probe:', error);
  }

  return results;
}

// Run if executed directly
probeXMTPReachability()
  .then(results => {
    console.log('\n✅ Probe complete. Results:', results);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Probe failed:', err);
    process.exit(1);
  });
