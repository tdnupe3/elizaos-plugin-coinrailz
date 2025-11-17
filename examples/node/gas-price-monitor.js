/**
 * Gas Price Monitor Example
 * 
 * This example demonstrates real-time gas price monitoring
 * across multiple chains with fast/average/slow recommendations.
 * 
 * Use case: Transaction optimization, cost estimation
 */

const { CoinRailzClient } = require('../../sdk/typescript/coinrailz-client');

async function main() {
  const client = new CoinRailzClient({
    apiKey: process.env.COINRAILZ_API_KEY || 'cr_live_YOUR_API_KEY_HERE'
  });

  console.log('⛽ Real-time Gas Price Monitor\n');
  console.log('═'.repeat(70));

  // Monitor these chains
  const chains = ['ethereum', 'base', 'polygon', 'arbitrum', 'bnb'];

  try {
    const gasData = await client.getGasPrices(chains);

    if (gasData.success) {
      for (const [chain, prices] of Object.entries(gasData.data)) {
        console.log(`\n${chain.toUpperCase()}`);
        console.log('─'.repeat(70));
        console.log(`Fast (< 30s):     ${prices.fast} Gwei    (~$${estimateCost(prices.fast, chain)})`);
        console.log(`Average (< 2m):   ${prices.average} Gwei    (~$${estimateCost(prices.average, chain)})`);
        console.log(`Slow (< 10m):     ${prices.slow} Gwei    (~$${estimateCost(prices.slow, chain)})`);
        
        // Recommendation
        const recommendation = getRecommendation(prices);
        console.log(`\n💡 Recommendation: ${recommendation}`);
      }
    }

    console.log('\n' + '═'.repeat(70));

    // Balance check
    const balance = await client.getBalance();
    console.log(`\n💳 Credits: $${balance.balance.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function estimateCost(gwei, chain) {
  // Estimate cost for standard ERC20 transfer (~65,000 gas)
  const gasUnits = 65000;
  const ethPrice = 2850; // Approximate
  const bnbPrice = 320;
  const maticPrice = 0.85;

  let cost;
  if (chain === 'ethereum' || chain === 'base' || chain === 'arbitrum') {
    cost = (gwei * gasUnits * ethPrice) / 1e9;
  } else if (chain === 'bnb') {
    cost = (gwei * gasUnits * bnbPrice) / 1e9;
  } else if (chain === 'polygon') {
    cost = (gwei * gasUnits * maticPrice) / 1e9;
  }

  return cost.toFixed(2);
}

function getRecommendation(prices) {
  const avgGwei = prices.average;
  
  if (avgGwei < 10) return '✅ Great time to transact - low fees';
  if (avgGwei < 30) return '👍 Good time to transact - moderate fees';
  if (avgGwei < 50) return '⚠️ Fees are elevated - consider waiting';
  return '🚨 Very high fees - wait if not urgent';
}

// Run the example
main().catch(console.error);
