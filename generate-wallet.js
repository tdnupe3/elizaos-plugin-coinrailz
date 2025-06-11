/**
 * Generate Real Production XRP Wallet
 * Run with: node generate-wallet.cjs
 */

import { Wallet } from 'xrpl';

function generateProductionWallet() {
  try {
    // Generate a real XRP wallet
    const wallet = Wallet.generate();
    
    console.log('='.repeat(80));
    console.log('REAL PRODUCTION XRP WALLET GENERATED');
    console.log('='.repeat(80));
    console.log('Address:', wallet.address);
    console.log('Public Key:', wallet.publicKey);
    console.log('Seed Phrase:', wallet.seed);
    console.log('='.repeat(80));
    console.log('SECURITY INSTRUCTIONS:');
    console.log('1. Save the seed phrase in a secure password manager');
    console.log('2. The seed phrase is your private key - NEVER share it');
    console.log('3. Add these to your environment variables for production:');
    console.log('   PLATFORM_XRP_ADDRESS=' + wallet.address);
    console.log('   PLATFORM_XRP_SEED=' + wallet.seed);
    console.log('4. This wallet can receive real XRP transactions');
    console.log('5. Fund this wallet with at least 10 XRP to activate it');
    console.log('='.repeat(80));
    
    return {
      address: wallet.address,
      publicKey: wallet.publicKey,
      seed: wallet.seed
    };
  } catch (error) {
    console.error('Error generating wallet:', error.message);
    throw error;
  }
}

// Generate the wallet
generateProductionWallet();