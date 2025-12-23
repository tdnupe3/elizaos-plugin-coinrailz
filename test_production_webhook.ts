import { Connection, Keypair, PublicKey, Transaction, SystemProgram, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const PRODUCTION_URL = 'https://coinrailz.com';

async function main() {
  console.log('🚀 Testing PRODUCTION Helius Webhook Integration');
  console.log(`🌐 Target: ${PRODUCTION_URL}\n`);

  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) { console.error('❌ No private key'); return; }

  let secretKey: Uint8Array;
  if (privateKey.length >= 85 && privateKey.length <= 90) {
    secretKey = bs58.decode(privateKey);
  } else {
    secretKey = new Uint8Array(JSON.parse(privateKey));
  }
  
  const keypair = Keypair.fromSecretKey(secretKey);
  console.log(`💳 Wallet: ${keypair.publicKey.toString()}`);

  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  const connection = new Connection(rpcUrl, 'confirmed');
  
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL\n`);

  // Create intent on PRODUCTION
  console.log('📝 Creating payment intent on PRODUCTION...');
  const intentResponse = await fetch(`${PRODUCTION_URL}/solana-pay/intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: '0.0005',
      tokenSymbol: 'SOL',
      serviceName: 'Token Price Feed',
      serviceSlug: 'sol-price-feed',
      customerWallet: keypair.publicKey.toString()
    })
  });

  if (!intentResponse.ok) {
    const error = await intentResponse.text();
    console.error(`❌ Failed to create intent: ${intentResponse.status} - ${error}`);
    return;
  }

  const intent = await intentResponse.json();
  console.log(`✅ Intent: ${intent.intentId}`);
  console.log(`   Memo: ${intent.payment.memoTag}\n`);

  // Send payment on-chain
  console.log('💸 Sending SOL on-chain (mainnet)...');
  const recipient = new PublicKey(intent.payment.recipientAddress);
  const amountLamports = Math.floor(parseFloat(intent.payment.amount) * 1e9);
  
  const tx = new Transaction()
    .add(SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: recipient, lamports: amountLamports }))
    .add(new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM_ID, data: Buffer.from(intent.payment.memoTag) }));
  
  const signature = await sendAndConfirmTransaction(connection, tx, [keypair], { commitment: 'confirmed' });
  console.log(`✅ TX confirmed: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}\n`);

  // Wait for Helius webhook (it sends to coinrailz.com production)
  console.log('⏳ Waiting for Helius webhook to hit PRODUCTION (15 seconds)...');
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  console.log('\n');

  // Check status on PRODUCTION
  const statusResponse = await fetch(`${PRODUCTION_URL}/solana-pay/intents/${intent.intentId}`);
  const status = await statusResponse.json();
  console.log(`📊 PRODUCTION Intent status: ${status.status}`);
  
  if (status.status === 'succeeded') {
    console.log('🎉 WEBHOOK WORKING! Payment auto-confirmed on PRODUCTION!');
  } else {
    console.log(`⚠️ Status: "${status.status}" - check production logs`);
  }
}

main().catch(console.error);
