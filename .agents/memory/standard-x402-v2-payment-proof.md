---
name: Standard x402 v2 direct-payment proof
description: Scope and interpretation of the successful independent standard-client payment verification.
---

Coin Railz's direct x402 payment rail is proven compatible with the installed `@x402/fetch` v2 client and an EVM `ExactEvmScheme` signer.

**Why:** On 2026-08-26, a fresh isolated Base wallet completed one capped USDC payment to the direct `ping` service. The client made the expected initial 402 plus one paid retry, received the paid 200 response, the wallet balance decreased by the exact service price, and the production payment intent was marked `SUCCEEDED` and non-canary.

**How to apply:** Do not attribute the August 2026 organic-payment decline to a platform-wide inability of standard x402 v2 direct clients to pay. This proof does not cover a paid MCP `tools/call` execution; that is a distinct boundary if MCP revenue becomes a priority. The paid HTTP response did not include a settlement header, so verify completed direct payments through the payment intent ledger and on-chain balance/transaction evidence rather than requiring that header.