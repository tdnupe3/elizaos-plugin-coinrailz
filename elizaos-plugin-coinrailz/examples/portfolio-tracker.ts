/**
 * Portfolio Tracker Agent with Coin Railz
 * 
 * This agent provides real-time portfolio tracking across
 * multiple chains with sentiment analysis and alerts.
 */

import { AgentRuntime, elizaLogger } from "@elizaos/core";
import { coinrailzPlugin } from "@elizaos/plugin-coinrailz";

interface WalletConfig {
  address: string;
  name: string;
  chains: string[];
}

async function main() {
  const runtime = new AgentRuntime({
    agentId: "coin-railz-portfolio-tracker",
    plugins: [coinrailzPlugin],
  });

  elizaLogger.log("📊 Portfolio Tracker Agent initialized\n");

  // Wallets to track
  const wallets: WalletConfig[] = [
    {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      name: "Main Wallet",
      chains: ["ethereum", "base", "polygon"]
    },
    {
      address: "0x28C6c06298d514Db089934071355E5743bf21d60",
      name: "Trading Wallet",
      chains: ["ethereum", "arbitrum"]
    }
  ];

  for (const wallet of wallets) {
    elizaLogger.log(`\n${'='.repeat(60)}`);
    elizaLogger.log(`📬 ${wallet.name}: ${wallet.address.slice(0, 10)}...`);
    elizaLogger.log(`${'='.repeat(60)}`);

    try {
      // Get multi-chain balance
      const balance = await runtime.processAction({
        action: "COINRAILZ_PAY_SERVICE",
        content: {
          serviceId: "multi-chain-balance",
          payload: {
            address: wallet.address,
            chains: wallet.chains
          }
        }
      });

      if (balance.success) {
        elizaLogger.log("\n💰 Native Balances:");
        for (const [chain, amount] of Object.entries(balance.balances)) {
          elizaLogger.log(`  ${chain}: ${amount}`);
        }

        if (balance.tokens && balance.tokens.length > 0) {
          elizaLogger.log("\n🪙 Token Holdings:");
          for (const token of balance.tokens) {
            elizaLogger.log(`  ${token.symbol}: ${token.balance} (${token.chain})`);
            
            // Get sentiment for major holdings
            if (parseFloat(token.balance) > 100) {
              const sentiment = await runtime.processAction({
                action: "COINRAILZ_PAY_SERVICE",
                content: {
                  serviceId: "token-sentiment",
                  payload: {
                    tokenSymbol: token.symbol,
                    chain: token.chain
                  }
                }
              });

              if (sentiment.success) {
                const emoji = sentiment.sentiment === 'bullish' ? '🟢' : 
                             sentiment.sentiment === 'bearish' ? '🔴' : '🟡';
                elizaLogger.log(`    ${emoji} Sentiment: ${sentiment.sentiment} (score: ${sentiment.score}/100)`);
              }
            }
          }
        }

        elizaLogger.log(`\n📈 Total Portfolio Value: $${balance.totalValueUsd || 'N/A'}`);
      }

      // Check for whale activity
      elizaLogger.log("\n🐋 Whale Activity:");
      const whaleAlerts = await runtime.processAction({
        action: "COINRAILZ_PAY_SERVICE",
        content: {
          serviceId: "whale-alerts",
          payload: {
            chain: wallet.chains[0],
            minValue: 500000
          }
        }
      });

      if (whaleAlerts.success && whaleAlerts.alerts) {
        elizaLogger.log(`  Found ${whaleAlerts.alerts.length} whale transactions`);
        whaleAlerts.alerts.slice(0, 3).forEach((alert: any) => {
          elizaLogger.log(`  • $${(alert.valueUsd / 1000000).toFixed(2)}M ${alert.tokenSymbol}`);
        });
      }

    } catch (error: any) {
      elizaLogger.error(`Error tracking ${wallet.name}:`, error.message);
    }
  }

  elizaLogger.log("\n\n✅ Portfolio tracking complete");
  elizaLogger.log("💡 Agent earns 85% of all service fees");
}

main().catch(console.error);
