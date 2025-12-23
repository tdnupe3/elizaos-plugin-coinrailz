import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

async function sendTestTransaction() {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    console.log('ERROR: SOLANA_PRIVATE_KEY not set');
    return;
  }

  // Connect to Helius
  const heliusApiKey = process.env.HELIUS_API_KEY || '';
  const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, 'confirmed');
  
  // Parse private key - try JSON array format first, then base58
  let keypair: Keypair;
  try {
    if (privateKey.startsWith('[')) {
      const keyArray = JSON.parse(privateKey);
      keypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
    } else {
      const decoded = bs58.decode(privateKey);
      keypair = Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    console.log('ERROR: Invalid private key format', e);
    return;
  }

  console.log('Wallet:', keypair.publicKey.toString());
  
  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

  if (balance < 0.001 * LAMPORTS_PER_SOL) {
    console.log('ERROR: Insufficient balance');
    return;
  }

  // Send small transaction to self
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: keypair.publicKey, // Send to self
      lamports: 1000, // 0.000001 SOL
    })
  );

  console.log('Sending transaction...');
  const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
  console.log('✅ Transaction sent! Signature:', signature);
  console.log('Explorer:', `https://solscan.io/tx/${signature}`);
  console.log('Helius webhook should fire in ~5-10 seconds');
  
  return signature;
}

sendTestTransaction().catch(console.error);
