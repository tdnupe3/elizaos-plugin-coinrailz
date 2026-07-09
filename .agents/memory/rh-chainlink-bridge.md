---
name: RH Chain Chainlink feeds + Bootstrap Bridge
description: Two new x402 services on Robinhood Chain (chainId 4663): price feed reader + USDC→USDG bridge
---

## rh-stock-price ($0.05)
- Handler: `server/routes/microservices/rhStockPrice.ts`
- Reads Chainlink `latestRoundData()` on RH Chain via viem public client
- 35+ feeds (all 8 decimals): AAPL, NVDA, SPY, TSLA, META, AMZN, MSFT, GOOGL, COIN, PLTR, AMD, GME, QQQ, BTC, ETH, USDG, LINK + more
- Feed address map exported as `RH_CHAIN_FEEDS` — maintained in the file itself
- Batch up to 10 symbols per call; single `symbol` or array `symbols` body param

## rh-bridge-usdc ($0.75)
- Handler: `server/routes/microservices/rhBridgeService.ts`
- Bridges fixed 0.50 USDC from Base treasury → USDG on RH Chain via Across Protocol
- Uses `WALLET = 0xa4bBE37f9A6Ae2dc36a607B91eB148C0ae163C91` as depositor (EVM_PRIVATE_KEY required)
- Across SpokePool on Base: `0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64`
- USDG on RH Chain: `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`
- Circuit breaker: checks USDC balance ≥ 1.0 USDC before bridging
- Handles USDC approval for SpokePool automatically (MAX_UINT256 once)
- Returns: depositTx (Base), estimatedUSDGOutput, estimatedFillTimeSec

**Why:** Per-call margin ~$0.22; treasury grows with volume (revenue > outflow per call).

## Service count history
- B20 Beryl (Jul 8 2026): 69 services
- RH DEX data (robinhood-token-price/dex-pools/chain-stats): 72 services
- RH Chainlink + Bridge (Jul 9 2026): 74 services
