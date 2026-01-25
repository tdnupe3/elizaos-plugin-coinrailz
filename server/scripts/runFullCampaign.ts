/**
 * FULL CAMPAIGN EXECUTION
 * 
 * Sends machine-readable x402 discovery messages to ALL remaining AI agent wallets on Base chain.
 * Only targets wallets that haven't been contacted yet.
 */

import { ethers } from 'ethers';
import { db } from '../db';
import { discoveredAgents } from '../../shared/schema';
import { sql, desc, isNull, and, ne, isNotNull } from 'drizzle-orm';
import { MachineReadableOutreach } from '../services/machineReadableOutreach';

const BASE_RPC = 'https://mainnet.base.org';
const CAMPAIGN_WALLET_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;
const BATCH_SIZE = 100;
const TX_DELAY_MS = 2000;

interface CampaignResult {
  wallet: string;
  txHash: string | null;
  status: 'sent' | 'failed';
  error?: string;
}

async function runFullCampaign(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   x402 FULL CAMPAIGN - ON-CHAIN OUTREACH                     ║');
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

  const outreach = MachineReadableOutreach.getInstance();
  
  const targetWallets = await db
    .select({
      id: discoveredAgents.id,
      wallet: discoveredAgents.wallet,
      source: discoveredAgents.source
    })
    .from(discoveredAgents)
    .where(
      and(
        isNotNull(discoveredAgents.wallet),
        ne(discoveredAgents.wallet, ''),
        sql`${discoveredAgents.wallet} ~ '^0x[a-fA-F0-9]{40}$'`,
        isNull(discoveredAgents.lastContactAt)
      )
    )
    .orderBy(desc(discoveredAgents.discoveredAt))
    .limit(1000);

  console.log(`\n📋 Remaining Uncontacted Wallets: ${targetWallets.length}`);
  
  if (targetWallets.length === 0) {
    console.log('✅ All wallets have been contacted!');
    process.exit(0);
  }

  const estimatedCost = targetWallets.length * 0.000002;
  console.log(`💵 Estimated Cost: ~$${(estimatedCost * 2800).toFixed(2)}`);

  if (Number(ethers.formatEther(balance)) < estimatedCost) {
    console.error('❌ Insufficient ETH for full campaign.');
    process.exit(1);
  }

  const feeData = await provider.getFeeData();
  console.log('\n⛽ Gas Price:', ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'), 'gwei');

  let successCount = 0;
  let failCount = 0;
  let totalGasUsed = 0n;
  let currentNonce = await provider.getTransactionCount(wallet.address);

  console.log('📊 Starting nonce:', currentNonce);
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
        gasLimit: 50000n,
        nonce: currentNonce
      });

      console.log(`${progress} ✅ Sent to ${target.wallet?.slice(0, 10)}... | TX: ${tx.hash.slice(0, 18)}...`);
      
      await db
        .update(discoveredAgents)
        .set({ lastContactAt: new Date() })
        .where(sql`${discoveredAgents.id} = ${target.id}`);

      successCount++;
      currentNonce++;

      if (i % 10 === 0) {
        const receipt = await tx.wait();
        totalGasUsed += receipt?.gasUsed || 0n;
      }

      await new Promise(r => setTimeout(r, TX_DELAY_MS));

    } catch (error: any) {
      console.log(`${progress} ❌ Failed: ${target.wallet?.slice(0, 10)}... | ${error.message?.slice(0, 40)}`);
      failCount++;
      
      if (error.message?.includes('nonce')) {
        currentNonce = await provider.getTransactionCount(wallet.address);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 CAMPAIGN RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Sent: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  const newBalance = await provider.getBalance(wallet.address);
  const spent = Number(ethers.formatEther(balance)) - Number(ethers.formatEther(newBalance));
  console.log(`💵 Total Spent: ${spent.toFixed(6)} ETH (~$${(spent * 2800).toFixed(4)})`);
  console.log(`💰 Remaining Balance: ${ethers.formatEther(newBalance)} ETH`);

  console.log('\n✅ Full campaign complete!');
}

runFullCampaign().catch(e => {
  console.error('Campaign failed:', e);
  process.exit(1);
});
