/**
 * Wallet Management Example
 * Create wallets and check balances using the Coin Railz Solana SDK
 * 
 * Run with: npx ts-node examples/wallet-management.ts
 */

import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

async function main() {
  // Verify API key is set
  const apiKey = process.env.COINRAILZ_API_KEY;
  if (!apiKey) {
    console.error('ERROR: COINRAILZ_API_KEY environment variable is not set');
    console.error('Get your API key at: https://coinrailz.com/dashboard/api-keys');
    console.error('Then run: export COINRAILZ_API_KEY=your-key-here');
    process.exit(1);
  }

  const client = new CoinRailzSolana({
    apiKey
  });

  // Create a new Solana wallet for your AI agent
  console.log('Creating new Solana wallet...');
  const wallet = await client.createWallet();

  if (wallet.success) {
    console.log('Wallet created successfully!');
    console.log('Address:', wallet.wallet.address);
    console.log('Public Key:', wallet.wallet.publicKey);
    console.log('Network:', wallet.wallet.network);
    
    // IMPORTANT: Store the private key securely!
    console.log('Private Key:', wallet.privateKey);
    console.log('\n⚠️  SECURITY: Store this private key securely. Never commit to git.');
  } else {
    console.error('Failed to create wallet:', wallet);
    return;
  }

  // Check balance of an existing wallet
  const testAddress = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  console.log(`\nChecking balance for ${testAddress}...`);
  
  const balance = await client.getBalance(testAddress);

  if (balance.success) {
    console.log('Balance:', balance.balance.sol, 'SOL');
    console.log('Lamports:', balance.balance.lamports);
  } else {
    console.error('Failed to get balance:', balance);
  }
}

main().catch(console.error);
