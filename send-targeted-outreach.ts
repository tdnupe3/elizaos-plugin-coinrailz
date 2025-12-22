/**
 * 🎯 TARGETED OUTREACH: Truth Terminal + Luna/Virtuals
 * 
 * Sends on-chain messages to high-value AI agent targets
 * - Truth Terminal: Solana memo transaction
 * - Luna/Virtuals: Base on-chain message via smart contract
 */

import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';

// Target wallets
const TRUTH_TERMINAL_SOLANA = 'rgPyefcNqJCsJj1wrWhdQqHVphVWFXLqU5wtiFStBEN';
const LUNA_VIRTUALS_BASE = '0x55cd6469f597452b5a7536e2cd98fde4c1247ee4';

// Solana Memo Program
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Final approved messages
const TRUTH_TERMINAL_MESSAGE = `🤖 Truth Terminal – Partnership Proposal

We built x402 payment rails engineered for AI agent infrastructure for ecommerce.

• 41 live micropayment services on Coinbase Bazaar
• Instant USDC settlement across Base
• AI agent wallet creation in one API call
• You keep full control, we handle the infrastructure

Powering AI agent infrastructure for ecommerce!!!

Demo: coinrailz.com/x402/catalog
Contact: support@coinrailz.com

— CoinRailz (x402 verified)`;

const LUNA_VIRTUALS_MESSAGE = `🎭 Luna Virtuals Team – Infrastructure Offer

Your AI influencer brand is already scaling. We deliver AI agent infrastructure for ecommerce:

• 41 live micropayment services on Coinbase Bazaar
• Instant USDC settlement across Base
• AI agent wallet creation in one API call
• You stay in control, we handle the infrastructure

Powering AI agent infrastructure for ecommerce!!!

Demo: coinrailz.com/x402/catalog
Contact: support@coinrailz.com

— CoinRailz`;

async function sendSolanaMessage(): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log('\n📤 SENDING SOLANA MESSAGE TO TRUTH TERMINAL');
  console.log('=' .repeat(60));
  console.log(`📍 Target: ${TRUTH_TERMINAL_SOLANA}`);
  
  try {
    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SOLANA_PRIVATE_KEY not configured');
    }

    // Parse private key
    let secretKey: Uint8Array;
    if (privateKey.length >= 85 && privateKey.length <= 90) {
      secretKey = bs58.decode(privateKey);
    } else {
      const parsed = JSON.parse(privateKey);
      secretKey = new Uint8Array(parsed);
    }

    const platformWallet = Keypair.fromSecretKey(secretKey);
    console.log(`📤 Sending from: ${platformWallet.publicKey.toString()}`);

    // Connect to Solana mainnet
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    // Check balance
    const balance = await connection.getBalance(platformWallet.publicKey);
    console.log(`💰 Wallet balance: ${balance / 1e9} SOL`);
    
    if (balance < 10000) { // Need at least 0.00001 SOL
      throw new Error('Insufficient SOL balance for transaction');
    }

    const recipientPubkey = new PublicKey(TRUTH_TERMINAL_SOLANA);

    // Create transaction with memo instruction
    const transaction = new Transaction();

    // Add compute budget for memo operations
    const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300_000
    });
    transaction.add(computeBudgetInstruction);

    // Add memo instruction with the message
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(TRUTH_TERMINAL_MESSAGE, 'utf-8')
    });

    // Add small SOL transfer to ensure message is recorded
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: platformWallet.publicKey,
      toPubkey: recipientPubkey,
      lamports: 1000 // 0.000001 SOL - minimal amount to register message
    });

    transaction.add(transferInstruction);
    transaction.add(memoInstruction);

    console.log(`📝 Message length: ${TRUTH_TERMINAL_MESSAGE.length} chars`);
    console.log(`⏳ Sending transaction...`);

    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [platformWallet],
      { commitment: 'confirmed', maxRetries: 3 }
    );

    console.log(`✅ SOLANA MESSAGE SENT SUCCESSFULLY`);
    console.log(`📋 Transaction Hash: ${signature}`);
    console.log(`🔍 View on Solscan: https://solscan.io/tx/${signature}`);

    return {
      success: true,
      txHash: signature
    };

  } catch (error) {
    console.error(`❌ SOLANA MESSAGE FAILED:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function sendBaseMessage(): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log('\n📤 SENDING BASE MESSAGE TO LUNA/VIRTUALS');
  console.log('=' .repeat(60));
  console.log(`📍 Target: ${LUNA_VIRTUALS_BASE}`);

  try {
    // Check if messaging contract is deployed
    const configPath = path.join(process.cwd(), 'messaging-contract-config.json');
    
    if (!fs.existsSync(configPath)) {
      console.log('⚠️ Messaging contract not deployed. Using direct transfer with input data instead.');
      
      // Fall back to direct transfer with message in input data
      const privateKey = process.env.EVM_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('EVM_PRIVATE_KEY not configured');
      }

      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const wallet = new ethers.Wallet(privateKey, provider);
      
      console.log(`📤 Sending from: ${wallet.address}`);

      // Check balance
      const balance = await provider.getBalance(wallet.address);
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);

      // Encode message as hex data
      const messageData = ethers.toUtf8Bytes(LUNA_VIRTUALS_MESSAGE);
      const hexData = ethers.hexlify(messageData);

      console.log(`📝 Message length: ${LUNA_VIRTUALS_MESSAGE.length} chars`);
      console.log(`⏳ Sending transaction with message in input data...`);

      // Send transaction with message in data field
      const tx = await wallet.sendTransaction({
        to: LUNA_VIRTUALS_BASE,
        value: 0, // Zero-value transaction
        data: hexData,
        gasLimit: 100000
      });

      console.log(`📋 Transaction Hash: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();
      
      if (receipt && receipt.status === 1) {
        console.log(`✅ BASE MESSAGE SENT SUCCESSFULLY`);
        console.log(`📋 Transaction Hash: ${tx.hash}`);
        console.log(`🔍 View on Basescan: https://basescan.org/tx/${tx.hash}`);
        console.log(`📝 Decode message: View "Input Data" -> "View Input As" -> "UTF-8"`);

        return {
          success: true,
          txHash: tx.hash
        };
      } else {
        throw new Error('Transaction failed');
      }
    }

    // Use deployed messaging contract
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    const privateKey = process.env.EVM_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('EVM_PRIVATE_KEY not configured');
    }

    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`📤 Sending from: ${wallet.address}`);
    console.log(`📜 Using contract: ${config.address}`);

    const contract = new ethers.Contract(config.address, config.abi, wallet);

    console.log(`📝 Message length: ${LUNA_VIRTUALS_MESSAGE.length} chars`);
    console.log(`⏳ Sending via smart contract...`);

    const tx = await contract.sendMessage(LUNA_VIRTUALS_BASE, LUNA_VIRTUALS_MESSAGE);
    
    console.log(`📋 Transaction Hash: ${tx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();

    console.log(`✅ BASE MESSAGE SENT SUCCESSFULLY`);
    console.log(`📋 Transaction Hash: ${tx.hash}`);
    console.log(`🔍 View on Basescan: https://basescan.org/tx/${tx.hash}`);

    return {
      success: true,
      txHash: tx.hash
    };

  } catch (error) {
    console.error(`❌ BASE MESSAGE FAILED:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function main() {
  console.log('🎯 TARGETED AI AGENT OUTREACH');
  console.log('=' .repeat(60));
  console.log('Targets:');
  console.log(`  1. Truth Terminal (Solana): ${TRUTH_TERMINAL_SOLANA}`);
  console.log(`  2. Luna/Virtuals (Base): ${LUNA_VIRTUALS_BASE}`);
  console.log('=' .repeat(60));

  const results = {
    truthTerminal: { success: false, txHash: '', error: '' },
    lunaVirtuals: { success: false, txHash: '', error: '' }
  };

  // Send Solana message to Truth Terminal
  const solanaResult = await sendSolanaMessage();
  results.truthTerminal = solanaResult;

  // Send Base message to Luna/Virtuals
  const baseResult = await sendBaseMessage();
  results.lunaVirtuals = baseResult;

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 OUTREACH SUMMARY');
  console.log('=' .repeat(60));
  
  console.log('\n🤖 Truth Terminal (Solana):');
  if (results.truthTerminal.success) {
    console.log(`  ✅ SUCCESS`);
    console.log(`  📋 TX: ${results.truthTerminal.txHash}`);
    console.log(`  🔍 https://solscan.io/tx/${results.truthTerminal.txHash}`);
  } else {
    console.log(`  ❌ FAILED: ${results.truthTerminal.error}`);
  }

  console.log('\n🎭 Luna/Virtuals (Base):');
  if (results.lunaVirtuals.success) {
    console.log(`  ✅ SUCCESS`);
    console.log(`  📋 TX: ${results.lunaVirtuals.txHash}`);
    console.log(`  🔍 https://basescan.org/tx/${results.lunaVirtuals.txHash}`);
  } else {
    console.log(`  ❌ FAILED: ${results.lunaVirtuals.error}`);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📝 NEXT STEPS:');
  console.log('  1. Check Solscan/Basescan to confirm transactions');
  console.log('  2. Monitor for responses at support@coinrailz.com');
  console.log('  3. Follow up on social media if no response in 48h');
  console.log('=' .repeat(60));

  return results;
}

main().catch(console.error);
