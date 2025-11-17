/**
 * Multi-Chain Balance Check Example
 * 
 * This example demonstrates checking wallet balances across
 * multiple blockchains simultaneously.
 * 
 * Use case: Portfolio tracking, cross-chain analytics
 */

const { CoinRailzClient } = require('../../sdk/typescript/coinrailz-client');

async function main() {
  // Initialize client
  const client = new CoinRailzClient({
    apiKey: process.env.COINRAILZ_API_KEY || 'cr_live_YOUR_API_KEY_HERE'
  });

  // Wallet address to check
  const walletAddress = process.env.WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

  console.log('🔍 Fetching multi-chain balance...');
  console.log(`📬 Wallet: ${walletAddress}\n`);

  try {
    // Get balance across Ethereum, Base, Polygon, Arbitrum, BNB Chain
    const result = await client.getMultiChainBalance(walletAddress, [
      'ethereum',
      'base',
      'polygon',
      'arbitrum',
      'bnb'
    ]);

    console.log('💰 Native Token Balances:');
    console.log('─────────────────────────');
    
    if (result.success && result.balances) {
      for (const [chain, balance] of Object.entries(result.balances)) {
        const symbol = getChainSymbol(chain);
        console.log(`${chain.padEnd(12)} ${balance} ${symbol}`);
      }
    }

    if (result.tokens && result.tokens.length > 0) {
      console.log('\n🪙 Token Balances:');
      console.log('─────────────────────────');
      result.tokens.forEach(token => {
        console.log(`${token.symbol.padEnd(8)} ${token.balance} (${token.chain})`);
      });
    }

    console.log('\n📊 Total Portfolio Value (USD): $' + 
      (result.totalValueUsd || 'N/A'));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Show remaining balance
  const balance = await client.getBalance();
  console.log(`\n💳 Credits remaining: $${balance.balance.toFixed(2)}`);
}

function getChainSymbol(chain) {
  const symbols = {
    'ethereum': 'ETH',
    'base': 'ETH',
    'polygon': 'MATIC',
    'arbitrum': 'ETH',
    'bnb': 'BNB'
  };
  return symbols[chain.toLowerCase()] || 'TOKEN';
}

// Run the example
main().catch(console.error);
