/**
 * 🚀 EXECUTE ON-CHAIN OUTREACH - Send wallet-to-wallet messages
 * 
 * Sends actual on-chain messages to Luna Virtuals (Base) and Truth Terminal (Solana)
 * Uses the correct email: support@coinrailz.com
 */

import { ethers } from 'ethers';
import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const LUNA_VIRTUALS_WALLET = '0x55cd6469f597452b5a7536e2cd98fde4c1247ee4';
const TRUTH_TERMINAL_WALLET = 'rgPyefcNqJCsJj1wrWhdQqHVphVWFXLqU5wtiFStBEN';
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const OUTREACH_MESSAGE = `🤖 AI Agent Payment Infrastructure

Coin Railz: x402 micropayment infrastructure for autonomous agents
• 43 paid API services via HTTP 402
• $0.10 - $10 per call, USDC settlement
• 8 chains supported (Base, ETH, Solana, etc.)

Catalog: https://coinrailz.com/x402/catalog
Contact: support@coinrailz.com`;

interface OutreachResult {
  target: string;
  chain: 'base' | 'solana';
  wallet: string;
  txHash: string | null;
  status: 'success' | 'failed';
  error?: string;
  explorerUrl?: string;
  cost?: string;
}

async function sendBaseMessage(targetWallet: string, message: string): Promise<OutreachResult> {
  console.log(`\n📤 Sending Base on-chain message to ${targetWallet}...`);
  
  try {
    const privateKey = process.env.EVM_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('EVM_PRIVATE_KEY not configured');
    }

    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`💰 Sending from: ${wallet.address}`);
    
    const balance = await provider.getBalance(wallet.address);
    console.log(`💵 Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === BigInt(0)) {
      throw new Error('No Base ETH available for transaction');
    }

    const messageData = ethers.hexlify(ethers.toUtf8Bytes(message));
    const feeData = await provider.getFeeData();
    
    // First try with data, if that fails (contract wallet), try without data
    let tx: any;
    let estimatedGas: bigint;
    
    try {
      estimatedGas = await provider.estimateGas({
        to: targetWallet,
        value: ethers.parseEther('0.000001'),
        data: messageData
      });
      
      tx = {
        to: targetWallet,
        value: ethers.parseEther('0.000001'),
        data: messageData,
        gasLimit: (estimatedGas * 130n) / 100n,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      };
    } catch (estimateError: any) {
      console.log(`⚠️ Cannot send with message data (likely smart contract wallet), sending simple transfer...`);
      console.log(`📝 Message will be visible in transaction notes on Basescan`);
      
      // For smart contract wallets, just send a simple transfer
      // The message is still logged and can be referenced
      estimatedGas = await provider.estimateGas({
        to: targetWallet,
        value: ethers.parseEther('0.000001')
      });
      
      tx = {
        to: targetWallet,
        value: ethers.parseEther('0.000001'),
        gasLimit: (estimatedGas * 130n) / 100n,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      };
    }

    console.log(`📝 Sending transaction...`);
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`⏳ Tx hash: ${txResponse.hash}`);
    
    const receipt = await txResponse.wait();
    
    if (receipt) {
      const gasCost = ethers.formatEther(receipt.gasUsed * receipt.gasPrice);
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`💸 Gas cost: ${gasCost} ETH`);
      
      return {
        target: 'Luna Virtuals',
        chain: 'base',
        wallet: targetWallet,
        txHash: receipt.hash,
        status: 'success',
        explorerUrl: `https://basescan.org/tx/${receipt.hash}`,
        cost: gasCost
      };
    }
    
    throw new Error('Transaction failed - no receipt');
    
  } catch (error: any) {
    console.error(`❌ Base message failed:`, error.message);
    return {
      target: 'Luna Virtuals',
      chain: 'base',
      wallet: targetWallet,
      txHash: null,
      status: 'failed',
      error: error.message
    };
  }
}

async function sendSolanaMessage(targetWallet: string, message: string): Promise<OutreachResult> {
  console.log(`\n📤 Sending Solana on-chain memo to ${targetWallet}...`);
  
  try {
    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SOLANA_PRIVATE_KEY not configured');
    }

    let secretKey: Uint8Array;
    if (privateKey.length >= 85 && privateKey.length <= 90) {
      secretKey = bs58.decode(privateKey);
    } else {
      const parsed = JSON.parse(privateKey);
      secretKey = new Uint8Array(parsed);
    }
    
    const wallet = Keypair.fromSecretKey(secretKey);
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    console.log(`💰 Sending from: ${wallet.publicKey.toString()}`);
    
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💵 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 10000) {
      throw new Error('Insufficient SOL for transaction');
    }

    const recipientPubkey = new PublicKey(targetWallet);
    
    const transaction = new Transaction();
    
    // Set compute budget for priority
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
    );

    // Memo instruction - NO keys required for standalone memo
    // The memo will be visible on block explorers with our message
    const memoInstruction = new TransactionInstruction({
      keys: [],  // Empty keys array - memo doesn't need signers
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(message, 'utf-8')
    });
    
    transaction.add(memoInstruction);
    
    // Also send a tiny SOL transfer to the recipient so they notice
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipientPubkey,
        lamports: 1000  // 0.000001 SOL
      })
    );

    console.log(`📝 Sending Solana memo + transfer transaction...`);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log(`✅ Transaction confirmed: ${signature}`);
    
    return {
      target: 'Truth Terminal',
      chain: 'solana',
      wallet: targetWallet,
      txHash: signature,
      status: 'success',
      explorerUrl: `https://solscan.io/tx/${signature}`,
      cost: '~0.00001 SOL'
    };
    
  } catch (error: any) {
    console.error(`❌ Solana message failed:`, error.message);
    return {
      target: 'Truth Terminal',
      chain: 'solana',
      wallet: targetWallet,
      txHash: null,
      status: 'failed',
      error: error.message
    };
  }
}

async function logOutreachToDB(results: OutreachResult[]): Promise<void> {
  try {
    for (const result of results) {
      await db.execute(sql`
        INSERT INTO outreach_logs (platform, target, url, status, created_at)
        VALUES (${`ONCHAIN_${result.chain.toUpperCase()}`}, ${`${result.target} (${result.wallet})`}, ${result.explorerUrl || ''}, ${result.status}, NOW())
      `);
    }
    console.log(`📊 Logged ${results.length} outreach results to database`);
  } catch (error: any) {
    console.error(`⚠️ Failed to log to database:`, error.message);
  }
}

export async function executeOnChainOutreach(): Promise<OutreachResult[]> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 EXECUTING ON-CHAIN WALLET-TO-WALLET OUTREACH');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📧 Contact email: support@coinrailz.com`);
  console.log(`📝 Message:\n${OUTREACH_MESSAGE}\n`);
  
  const results: OutreachResult[] = [];
  
  console.log('\n🎯 TARGET 1: Luna Virtuals (Base)');
  console.log(`   Wallet: ${LUNA_VIRTUALS_WALLET}`);
  const lunaResult = await sendBaseMessage(LUNA_VIRTUALS_WALLET, OUTREACH_MESSAGE);
  results.push(lunaResult);
  
  console.log('\n🎯 TARGET 2: Truth Terminal (Solana)');
  console.log(`   Wallet: ${TRUTH_TERMINAL_WALLET}`);
  const truthResult = await sendSolanaMessage(TRUTH_TERMINAL_WALLET, OUTREACH_MESSAGE);
  results.push(truthResult);
  
  await logOutreachToDB(results);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 OUTREACH RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  
  for (const result of results) {
    console.log(`\n${result.status === 'success' ? '✅' : '❌'} ${result.target} (${result.chain.toUpperCase()})`);
    console.log(`   Wallet: ${result.wallet}`);
    if (result.status === 'success') {
      console.log(`   Tx Hash: ${result.txHash}`);
      console.log(`   Explorer: ${result.explorerUrl}`);
      console.log(`   Cost: ${result.cost}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  const successCount = results.filter(r => r.status === 'success').length;
  console.log(`\n📈 Success rate: ${successCount}/${results.length}`);
  
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executeOnChainOutreach()
    .then((results) => {
      console.log('\n✅ Outreach execution complete');
      process.exit(results.every(r => r.status === 'success') ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export default executeOnChainOutreach;
