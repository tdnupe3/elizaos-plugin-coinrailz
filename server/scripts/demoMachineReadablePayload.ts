/**
 * MACHINE-READABLE PAYLOAD DEMO
 * 
 * Demonstrates the x402-discovery payload format for AI agent outreach.
 * Shows both full and compact versions with gas cost estimates.
 * 
 * Run: npx tsx server/scripts/demoMachineReadablePayload.ts
 */

import { MachineReadableOutreach } from '../services/machineReadableOutreach';

async function demo() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   x402 MACHINE-READABLE OUTREACH PAYLOAD                     ║');
  console.log('║   For AI Agent On-Chain Discovery                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const service = MachineReadableOutreach.getInstance();
  const trackingId = service.generateTrackingId();

  // Generate full payload
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 FULL PAYLOAD (for API responses / documentation)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const fullPayload = service.generateFullPayload(trackingId);
  console.log(JSON.stringify(fullPayload, null, 2));

  // Generate compact payload
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 COMPACT PAYLOAD (for on-chain transmission)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const compactPayload = service.generateCompactPayload(trackingId);
  console.log(JSON.stringify(compactPayload, null, 2));

  // Show calldata
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 ENCODED CALLDATA (for blockchain transaction)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const calldata = service.payloadToCalldata(compactPayload);
  console.log(`Hex: ${calldata.slice(0, 100)}...`);
  console.log(`Full length: ${calldata.length} chars (${(calldata.length - 2) / 2} bytes)`);

  // Gas cost estimate
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 GAS COST ESTIMATES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const compactGas = await service.estimateGasCost(compactPayload);
  const fullGas = await service.estimateGasCost(fullPayload);

  console.log('\nCompact Payload:');
  console.log(`  Bytes: ${compactGas.bytesSize}`);
  console.log(`  Est. Cost: $${compactGas.gasCostUSD.toFixed(6)}`);

  console.log('\nFull Payload:');
  console.log(`  Bytes: ${fullGas.bytesSize}`);
  console.log(`  Est. Cost: $${fullGas.gasCostUSD.toFixed(6)}`);

  // Campaign plan
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 CAMPAIGN COST PROJECTIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const campaigns = [
    { targets: 50, name: 'Pilot (Top 50)' },
    { targets: 200, name: 'Medium (Top 200)' },
    { targets: 696, name: 'Full (All 696)' }
  ];

  for (const campaign of campaigns) {
    const plan = service.generateCampaignPlan(campaign.targets);
    console.log(`\n${campaign.name}:`);
    console.log(`  Targets: ${plan.targets}`);
    console.log(`  Est. Cost: $${plan.estimatedCostUSD.toFixed(2)}`);
    console.log(`  Expected Response Rate: ${plan.expectedResponseRate}`);
    console.log(`  Expected Responses: ${plan.expectedResponses}`);
  }

  // How AI agents can parse this
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 HOW AI AGENTS PARSE THIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`
  // Agent receives transaction with calldata
  const txData = transaction.input;
  const txFrom = transaction.from;
  
  // Decode UTF-8 from hex
  const jsonString = ethers.toUtf8String(txData);
  const payload = JSON.parse(jsonString);
  
  // SECURITY: Verify sender and expiry
  if (payload.p === 'x402') {
    // 1. Verify sender matches tx.from (prevent spoofing)
    if (payload.s.toLowerCase() !== txFrom.toLowerCase()) {
      throw new Error('Sender mismatch - potential spoof');
    }
    
    // 2. Check expiry (prevent replay attacks)
    if (Date.now() / 1000 > payload.e) {
      throw new Error('Payload expired');
    }
    
    // 3. Fetch the service catalog
    const catalog = await fetch(payload.c);
    const services = await catalog.json();
    
    // Agent can now discover and consume x402 services
    for (const service of services.resources) {
      // Make 402 request, receive challenge, pay, get data
    }
  }
  `);

  console.log('\n✅ Payload design complete!');
  console.log('Ready for on-chain outreach to discovered agent wallets.');
}

demo().catch(console.error);
