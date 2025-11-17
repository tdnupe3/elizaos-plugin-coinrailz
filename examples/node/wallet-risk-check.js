/**
 * Wallet Risk Check Example
 * 
 * This example shows how to check the AML/fraud risk score
 * for any wallet address using Coin Railz micropayment services.
 * 
 * Use case: KYC/AML compliance, fraud detection
 */

const { CoinRailzClient } = require('../../sdk/typescript/coinrailz-client');

async function main() {
  // Initialize client with API key
  const client = new CoinRailzClient({
    apiKey: process.env.COINRAILZ_API_KEY || 'cr_live_YOUR_API_KEY_HERE'
  });

  // Example wallet addresses to check
  const walletsToCheck = [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Coinbase 1
    '0x28C6c06298d514Db089934071355E5743bf21d60', // Binance 14
    '0xYOUR_WALLET_HERE'
  ];

  console.log('🔍 Checking wallet risk scores...\n');

  for (const wallet of walletsToCheck) {
    try {
      // Check risk score (costs $0.50 in credits)
      const result = await client.getWalletRisk(wallet, 'ethereum');
      
      console.log(`Wallet: ${wallet}`);
      console.log(`├─ Risk Score: ${result.riskScore}/100`);
      console.log(`├─ Risk Level: ${result.riskLevel}`);
      console.log(`├─ Flags: ${result.flags.length > 0 ? result.flags.join(', ') : 'None'}`);
      console.log(`└─ Analysis: ${getRiskAnalysis(result.riskScore)}\n`);
      
    } catch (error) {
      console.error(`❌ Error checking ${wallet}:`, error.message);
    }
  }

  // Check current balance
  const balance = await client.getBalance();
  console.log(`\n💰 Remaining balance: $${balance.balance.toFixed(2)}`);
}

function getRiskAnalysis(score) {
  if (score < 20) return '✅ Very low risk - safe to transact';
  if (score < 40) return '⚠️ Low risk - proceed with caution';
  if (score < 60) return '⚠️ Medium risk - additional verification recommended';
  if (score < 80) return '🚨 High risk - avoid transaction';
  return '🚨 Very high risk - likely fraudulent';
}

// Run the example
main().catch(console.error);
