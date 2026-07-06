/**
 * Basic ElizaOS Agent with Coin Railz Plugin
 * 
 * This example shows how to create an ElizaOS agent that can use
 * Coin Railz micropayment services.
 */

import { AgentRuntime, elizaLogger } from "@elizaos/core";
import { coinrailzPlugin } from "@elizaos/plugin-coinrailz";

async function main() {
  // Create agent runtime with Coin Railz plugin
  const runtime = new AgentRuntime({
    // Your agent configuration
    agentId: "coin-railz-demo-agent",
    plugins: [coinrailzPlugin],
    // ... other config
  });

  elizaLogger.log("✅ Agent initialized with Coin Railz plugin");
  elizaLogger.log("📊 66 micropayment services available");
  elizaLogger.log("💰 Revenue share: 85% to you, 15% platform fee");

  // Example 1: Check multi-chain balance
  elizaLogger.log("\n🔍 Example 1: Multi-chain balance query");
  
  const balanceResponse = await runtime.processAction({
    action: "COINRAILZ_PAY_SERVICE",
    content: {
      serviceId: "multi-chain-balance",
      payload: {
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        chains: ["ethereum", "base", "polygon"]
      }
    }
  });

  console.log("Balance response:", balanceResponse);

  // Example 2: Get gas prices
  elizaLogger.log("\n⛽ Example 2: Gas price oracle");
  
  const gasResponse = await runtime.processAction({
    action: "COINRAILZ_PAY_SERVICE",
    content: {
      serviceId: "gas-price-oracle",
      payload: {
        chains: ["ethereum", "base"]
      }
    }
  });

  console.log("Gas prices:", gasResponse);

  // Example 3: Token price
  elizaLogger.log("\n💎 Example 3: Token price feed");
  
  const priceResponse = await runtime.processAction({
    action: "COINRAILZ_PAY_SERVICE",
    content: {
      serviceId: "token-price",
      payload: {
        tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        chain: "ethereum"
      }
    }
  });

  console.log("Token price:", priceResponse);

  elizaLogger.log("\n✅ All examples completed");
  elizaLogger.log("💡 Check your agent's wallet for revenue (85% of service fees)");
}

main().catch(console.error);
