/**
 * PILOT CAMPAIGN EXECUTION
 * 
 * Sends machine-readable x402 discovery messages to 50 AI agent wallets on Base chain.
 * Uses CDP wallet to sign and broadcast transactions with JSON payload in calldata.
 */

import { ethers } from 'ethers';
import { db } from '../db';
import { discoveredAgents } from '../../shared/schema';
import { sql, desc } from 'drizzle-orm';
import { MachineReadableOutreach } from '../services/machineReadableOutreach';

const BASE_RPC = 'https://mainnet.base.org';
const CAMPAIGN_WALLET_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;
const PILOT_SIZE = 50;

interface CampaignResult {
  wallet: string;
  txHash: string | null;
  status: 'sent' | 'failed';
  error?: string;
  gasUsed?: string;
}

async function runPilotCampaign(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   x402 PILOT CAMPAIGN - ON-CHAIN OUTREACH                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!CAMPAIGN_WALLET_PRIVATE_KEY) {
    console.error('❌ EVM_PRIVATE_KEY not set. Cannot execute campaign.');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(CAMPAIGN_WALLET_PRIVATE_KEY, provider);
  
  console.log('📍 Campaign Wallet:', wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log('💰 ETH Balance:', ethers.formatEther(balance), 'ETH');
  console.log('💵 USD Value: $' + (Number(ethers.formatEther(balance)) * 2800).toFixed(2));

  if (Number(ethers.formatEther(balance)) < 0.0002) {
    console.error('❌ Insufficient ETH for campaign. Need at least 0.0002 ETH.');
    process.exit(1);
  }

  const outreach = MachineReadableOutreach.getInstance();
  
  const targetWallets = await db
    .select({
      id: discoveredAgents.id,
      wallet: discoveredAgents.wallet,
      source: discoveredAgents.source
    })
    .from(discoveredAgents)
    .where(sql`
      ${discoveredAgents.wallet} IS NOT NULL 
      AND ${discoveredAgents.wallet} != ''
      AND ${discoveredAgents.wallet} ~ '^0x[a-fA-F0-9]{40}$'
      AND ${discoveredAgents.lastContactAt} IS NULL
    `)
    .orderBy(desc(discoveredAgents.discoveredAt))
    .limit(PILOT_SIZE);

  console.log(`\n📋 Target Wallets: ${targetWallets.length}`);
  
  if (targetWallets.length === 0) {
    console.log('❌ No target wallets found. Run discovery first.');
    process.exit(1);
  }

  const feeData = await provider.getFeeData();
  console.log('\n⛽ Gas Price:', ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'), 'gwei');

  const results: CampaignResult[] = [];
  let successCount = 0;
  let failCount = 0;
  let totalGasUsed = 0n;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 SENDING MESSAGES...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 0; i < targetWallets.length; i++) {
    const target = targetWallets[i];
    const progress = `[${i + 1}/${targetWallets.length}]`;
    
    try {
      const trackingId = outreach.generateTrackingId();
      const payload = outreach.generateCompactPayload(trackingId);
      const calldata = outreach.payloadToCalldata(payload);

      const tx = await wallet.sendTransaction({
        to: target.wallet,
        data: calldata,
        value: 0n,
        gasLimit: 50000n
      });

      console.log(`${progress} ✅ Sent to ${target.wallet?.slice(0, 10)}... | TX: ${tx.hash.slice(0, 18)}...`);
      
      const receipt = await tx.wait();
      totalGasUsed += receipt?.gasUsed || 0n;

      await db
        .update(discoveredAgents)
        .set({ 
          lastContactAt: new Date()
        })
        .where(sql`${discoveredAgents.id} = ${target.id}`);

      results.push({
        wallet: target.wallet!,
        txHash: tx.hash,
        status: 'sent',
        gasUsed: receipt?.gasUsed?.toString()
      });
      successCount++;

      await new Promise(r => setTimeout(r, 500));

    } catch (error: any) {
      console.log(`${progress} ❌ Failed: ${target.wallet?.slice(0, 10)}... | ${error.message?.slice(0, 40)}`);
      results.push({
        wallet: target.wallet!,
        txHash: null,
        status: 'failed',
        error: error.message
      });
      failCount++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 CAMPAIGN RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Sent: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⛽ Total Gas Used: ${totalGasUsed.toString()}`);
  
  const gasPrice = feeData.gasPrice || 0n;
  const totalCostWei = totalGasUsed * gasPrice;
  const totalCostETH = Number(ethers.formatEther(totalCostWei));
  console.log(`💵 Total Cost: ${totalCostETH.toFixed(6)} ETH (~$${(totalCostETH * 2800).toFixed(4)})`);

  const newBalance = await provider.getBalance(wallet.address);
  console.log(`\n💰 Remaining Balance: ${ethers.formatEther(newBalance)} ETH`);

  console.log('\n✅ Pilot campaign complete!');
  console.log('📈 Monitor for responses at: https://coinrailz.com/admin/outreach');
}

runPilotCampaign().catch(e => {
  console.error('Campaign failed:', e);
  process.exit(1);
});
