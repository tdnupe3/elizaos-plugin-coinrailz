---
name: Yield vault agent accounts
description: How API-key-based custodial yield accounts work on top of the ERC-4626 vault
---

## Design
API-key agents can deposit credits into yield without a wallet. Platform tracks fractional ownership.

**DB table**: `agent_yield_positions` — tracks (userId, amountDeposited, entryFee, usdcInVault, sharesAllocated, depositPricePerShare, protocol, status)

**Endpoints (all in yieldPortalRoutes.ts):**
- `POST /api/yield/deposit` — deducts credits, inserts position row
- `GET /api/yield/my-position` — queries active positions, computes live value from currentPricePerShare
- `POST /api/yield/withdraw` — marks positions withdrawn, addCredits back
- `GET /api/yield/deposit-tx?amount=X&recipient=0x...` — wallet path, returns 2 pre-built ERC-4626 txs (approve + deposit)

**Share math**: sharesAllocated = usdcInVault / pricePerShare at deposit time. Current value = sharesAllocated × currentPricePerShare.

**Why:**
- Agents already trust the platform with API keys and credits for paid services
- Extending to custodial yield removes all blockchain friction
- Wallet path still available for direct on-chain ownership
- Custody is disclosed clearly (API-key path vs wallet path)
