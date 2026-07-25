---
name: Ethereum mainnet informational discovery signal
description: What was done to expose eip155:1 in 402 bodies without adding it to the accepts array
---

## The change

Added `eip155:1` as an informational discovery signal in three places in `paymentOrchestrator.ts`:

1. **Top-level `supportedNetworks` array** (after `accepts:`) — structured objects with network, name, token, contract, active=true, and a note explaining how to pay on Ethereum (send tx hash in X-PAYMENT header).
2. **`funding_guide.on_chain_usdc`** — restructured from a single Base entry to `networks: [Base, Ethereum]` array.
3. **`agent_instructions.system_prompt`** — path 4 now explicitly names `eip155:1`, USDC/USDT contract addresses, and the raw tx hash method.

## The enricher filter

`x402ResponseEnricher.ts` filter was updated: now only blocks the `"ethereum"` shorthand (legacy ZodError risk), but allows `"eip155:1"` (CAIP-2) through. This future-proofs the filter if Ethereum is ever added to the accepts array.

## Gas fee correction

Live Ethereum mainnet gas at time of change: **0.08 gwei** (~$0.016 for ERC-20 USDC transfer at $3000/ETH). Do NOT state that Ethereum gas is "$2-10/tx" — that was wrong stale data.

**Why:** Old comment in x402ResponseEnricher.ts said "Ethereum gas (~$2–10/tx) also makes it economically unviable for micropayments." This was removed. Gas at 0.08 gwei means a $0.05 service costs ~$0.016 in gas — viable.
