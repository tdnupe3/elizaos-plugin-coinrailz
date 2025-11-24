/**
 * Test Outreach Campaign Script
 * 
 * Bypasses UI authentication to test webhook outreach directly
 */

import { XMTPAgentOutreachService } from '../services/xmtpAgentOutreach';

async function testCampaign() {
  console.log('🚀 Testing webhook outreach campaign...\n');

  const outreachService = XMTPAgentOutreachService.getInstance();

  try {
    const campaign = await outreachService.runOutreachCampaign({
      minQualityScore: 10,
      maxAgents: 115,
      onlyXMTP: false, // Use multi-channel (webhooks + fallbacks)
    });

    console.log('\n✅ Campaign Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Total Agents Targeted: ${campaign.agentsTargeted}`);
    console.log(`✅ Messages Sent: ${campaign.sent}`);
    console.log(`❌ Failed: ${campaign.failed}`);
    console.log(`⏭️  Skipped: ${campaign.skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (campaign.results && campaign.results.length > 0) {
      console.log('📝 Sample Results:');
      campaign.results.slice(0, 5).forEach((result: any) => {
        console.log(`  • ${result.agent?.url || 'Unknown'}: ${result.status} (${result.channel || 'no channel'})`);
      });
    }

    console.log('\n✅ Campaign test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Campaign failed:', error);
    process.exit(1);
  }
}

testCampaign();
