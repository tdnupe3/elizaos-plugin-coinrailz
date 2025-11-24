/**
 * XMTP SCAN SCHEDULER
 * 
 * Nightly automated scanning of discovered agents for XMTP support
 * Runs at 2 AM daily to minimize impact on production traffic
 */

import cron from 'node-cron';
import { xmtpAgentScanner } from '../services/xmtpAgentScanner';

export function startXMTPScanScheduler(): void {
  // Run nightly at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🕐 Starting scheduled XMTP agent scan (2:00 AM daily)...');
    
    try {
      const results = await xmtpAgentScanner.scanAllAgents({
        forceRescan: false, // Only scan stale/new agents
        maxAgents: 1000,
        batchSize: 10,
      });

      console.log(`✅ Scheduled XMTP scan complete:`, results);
      console.log(`📊 XMTP enabled: ${results.xmtpEnabled}/${results.scanned} agents (${Math.round((results.xmtpEnabled / results.scanned) * 100)}%)`);
      
    } catch (error) {
      console.error('❌ Scheduled XMTP scan failed:', error);
    }
  });

  console.log('⏰ XMTP scan scheduler started (runs nightly at 2:00 AM)');
}

export function stopXMTPScanScheduler(): void {
  cron.getTasks().forEach((task) => task.stop());
  console.log('🛑 XMTP scan scheduler stopped');
}
