/**
 * AI-Powered Trade Signals Example
 * 
 * This example shows how to get AI-powered trading signals
 * with confidence scores for any cryptocurrency.
 * 
 * Use case: Automated trading, signal generation
 */

const { CoinRailzClient } = require('../../sdk/typescript/coinrailz-client');

async function main() {
  // Initialize client
  const client = new CoinRailzClient({
    apiKey: process.env.COINRAILZ_API_KEY || 'cr_live_YOUR_API_KEY_HERE'
  });

  // Tokens to analyze
  const tokens = ['ETH', 'BTC', 'SOL', 'ARB'];
  const timeframe = '4h';
  const riskLevel = 'medium';

  console.log('🤖 Getting AI-powered trade signals...\n');
  console.log(`Timeframe: ${timeframe}`);
  console.log(`Risk Level: ${riskLevel}\n`);
  console.log('═'.repeat(60));

  for (const token of tokens) {
    try {
      // Get trade signal (costs $1.00 in credits)
      const signal = await client.getTradeSignals(token, timeframe, riskLevel);

      if (signal.success) {
        console.log(`\n${token} Trade Signal:`);
        console.log('─'.repeat(60));
        console.log(`Signal: ${getSignalEmoji(signal.signal)} ${signal.signal}`);
        console.log(`Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
        console.log(`Entry Price: $${signal.entry.toLocaleString()}`);
        console.log(`Target Price: $${signal.target.toLocaleString()}`);
        console.log(`Stop Loss: $${signal.stopLoss.toLocaleString()}`);
        console.log(`Expected Gain: ${signal.expectedGainPercent.toFixed(2)}%`);
        console.log(`Risk/Reward: ${signal.riskRewardRatio.toFixed(2)}`);
        
        // Additional analysis
        if (signal.technicalIndicators) {
          console.log('\n📊 Technical Indicators:');
          Object.entries(signal.technicalIndicators).forEach(([key, value]) => {
            console.log(`  • ${key}: ${value}`);
          });
        }
      }

    } catch (error) {
      console.error(`❌ Error getting signal for ${token}:`, error.message);
    }
  }

  console.log('\n' + '═'.repeat(60));

  // Check balance
  const balance = await client.getBalance();
  console.log(`\n💳 Credits remaining: $${balance.balance.toFixed(2)}`);

  // Show transaction history
  const transactions = await client.getTransactions(5);
  console.log(`\n📜 Recent Transactions (${transactions.length}):`);
  transactions.forEach(tx => {
    const sign = tx.type === 'credit' ? '+' : '-';
    console.log(`  ${sign}$${tx.amount.toFixed(2)} - ${tx.description}`);
  });
}

function getSignalEmoji(signal) {
  const emojis = {
    'BUY': '🟢',
    'SELL': '🔴',
    'HOLD': '🟡',
    'STRONG_BUY': '🟢🟢',
    'STRONG_SELL': '🔴🔴'
  };
  return emojis[signal] || '⚪';
}

// Run the example
main().catch(console.error);
