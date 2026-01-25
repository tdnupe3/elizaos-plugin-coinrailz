/**
 * UNIQUE WALLET CAMPAIGN
 * 
 * Sends one message per unique wallet address (no duplicates).
 */

import { ethers } from 'ethers';
import { db } from '../db';
import { discoveredAgents } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import { MachineReadableOutreach } from '../services/machineReadableOutreach';

const BASE_RPC = 'https://mainnet.base.org';
const CAMPAIGN_WALLET_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;
const TX_DELAY_MS = 1500;

async function runUniqueWalletCampaign(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   x402 UNIQUE WALLET CAMPAIGN                                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!CAMPAIGN_WALLET_PRIVATE_KEY) {
    console.error('❌ EVM_PRIVATE_KEY not set.');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(CAMPAIGN_WALLET_PRIVATE_KEY, provider);
  
  console.log('📍 Campaign Wallet:', wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log('💰 ETH Balance:', ethers.formatEther(balance), 'ETH (~$' + (Number(ethers.formatEther(balance)) * 2800).toFixed(2) + ')');

  const outreach = MachineReadableOutreach.getInstance();
  
  const contactedWallets = await db.execute(sql`
    SELECT DISTINCT wallet FROM discovered_agents WHERE last_contact_at IS NOT NULL
  `);
  const contactedSet = new Set((contactedWallets.rows as any[]).map(r => r.wallet?.toLowerCase()));
  
  const allWallets = await db.execute(sql`
    SELECT DISTINCT wallet 
    FROM discovered_agents 
    WHERE wallet IS NOT NULL 
      AND wallet != '' 
      AND wallet ~ '^0x[a-fA-F0-9]{40}$'
  `);
  
  const targetWallets = (allWallets.rows as any[])
    .filter(r => !contactedSet.has(r.wallet?.toLowerCase()))
    .map(r => r.wallet);

  console.log(`📋 Unique wallets to contact: ${targetWallets.length}`);
  console.log(`✅ Already contacted: ${contactedSet.size}`);
  
  if (targetWallets.length === 0) {
    console.log('✅ All unique wallets have been contacted!');
    process.exit(0);
  }

  const estimatedCost = targetWallets.length * 0.000002;
  console.log(`💵 Estimated Cost: ~$${(estimatedCost * 2800).toFixed(2)}`);

  let currentNonce = await provider.getTransactionCount(wallet.address);
  console.log('📊 Starting nonce:', currentNonce);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 SENDING TO UNIQUE WALLETS...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targetWallets.length; i++) {
    const targetWallet = targetWallets[i];
    const progress = `[${i + 1}/${targetWallets.length}]`;
    
    try {
      const trackingId = outreach.generateTrackingId();
      const payload = outreach.generateCompactPayload(trackingId);
      const calldata = outreach.payloadToCalldata(payload);

      const tx = await wallet.sendTransaction({
        to: targetWallet,
        data: calldata,
        value: 0n,
        gasLimit: 50000n,
        nonce: currentNonce
      });

      console.log(`${progress} ✅ ${targetWallet.slice(0, 12)}... TX: ${tx.hash.slice(0, 20)}...`);
      
      await db.execute(sql`
        UPDATE discovered_agents 
        SET last_contact_at = NOW() 
        WHERE LOWER(wallet) = LOWER(${targetWallet})
      `);

      successCount++;
      currentNonce++;
      await new Promise(r => setTimeout(r, TX_DELAY_MS));

    } catch (error: any) {
      console.log(`${progress} ❌ ${targetWallet.slice(0, 12)}... | ${error.message?.slice(0, 40)}`);
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
  console.log(`💵 Spent: ${spent.toFixed(6)} ETH (~$${(spent * 2800).toFixed(4)})`);
  console.log(`💰 Remaining: ${ethers.formatEther(newBalance)} ETH`);
  
  console.log('\n✅ Unique wallet campaign complete!');
}

runUniqueWalletCampaign().catch(e => {
  console.error('Campaign failed:', e);
  process.exit(1);
});
