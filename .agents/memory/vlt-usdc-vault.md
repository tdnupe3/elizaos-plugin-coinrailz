---
name: vltUSDC Vault Integration
description: Bankroll Network vltUSDC vault on Ethereum — contract addresses, architecture, and implementation decisions
---

## Contract Addresses (Ethereum Mainnet)
- Vault (receives USDC, issues vltUSDC): `0x348A57b1dc6E3dCAa645DE6e4E864924B410525D`
- Share token (vltUSDC ERC-20): `0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f`
- Underlying pair (VLT/WETH Uniswap V2): `0x966053Ca4fca049173eb1F27E4cb168CCb794534`
- VLT token: `0x6b785a0322126826d8226d77e173d75DAfb84d11`
- USDC (Ethereum): `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

## Token Ordering in Pair
VLT (0x6b...) < WETH (0xC0...) alphabetically → VLT is token0, WETH is token1.
`getReserves()` → [reserve0=VLT, reserve1=WETH, blockTimestampLast]

## VLT/USDC Pair
Does NOT exist on Uniswap V2 Ethereum mainnet (returns zero address from factory).
The vault wraps VLT/WETH LP, not VLT/USDC. TVL is computed in USDC terms using ETH price from CoinGecko.

## Vault ABI
ERC-4626-style interface assumed (vault launched July 22 2026 — ABI not probed in dev due to missing ALCHEMY_API_KEY in bash).
- `deposit(uint256 assets, address receiver)` → selector 0x6e553f65
- `approve(address spender, uint256 amount)` → selector 0x095ea7b3 (on USDC contract)
If vault reverts on ERC-4626 deposit, try alternativeCalldata.zapInData (zapIn(uint256)) or alternativeCalldata.depositSingleData (deposit(uint256)).

## Architecture Decisions
**Why** (all architect-approved July 22 2026):
1. **Builder Pattern only** for x402 service: agent pays $0.50 on Base, gets unsigned calldata for Ethereum, agent signs/broadcasts themselves. Zero custody. Architect explicitly rejected cross-chain execution (bridge risk, liquidity buffer requirement).
2. **APR = "New"**: vault launched July 22 2026. "0%" looks dead; "New" looks like opportunity. APR will be calculated after 24-48h of fee data.
3. **VLT replenishment threshold = 1,000** (not 100): at 100 VLT (~$40), Ethereum L1 swap gas is a meaningful fraction of the trade. 1,000 VLT (~$390) keeps gas overhead under 1% (gas ~$0.50–1 total).

## Backend Services
- `server/services/vltUsdcVaultService.ts`: on-chain stats (cached 2min), reads pair reserves + vltUSDC totalSupply
- `server/services/vltUsdcDepositService.ts`: calldata builder, encodes approve + ERC-4626 deposit

## API Endpoints
- `GET /api/vlt-usdc/stats` — vault stats (registered in appMain.ts after VLT webhook)
- `POST /x402/vlt-usdc-deposit` — x402 service, $0.50, builder pattern (pays on Base)
- `GET /api/vault/vlt-deposit-calldata` — discovery info for Ethereum lane
- `POST /api/vault/vlt-deposit-calldata` — Ethereum USDC payment lane (router in vltVaultRoutes.ts, mounted at /api/vault)

## Ethereum Payment Lane
Ethereum mainnet (eip155:1) cannot be in x402 accepts array — x402-fetch PaymentRequirementsSchema enum excludes it; ZodError blocks ALL payments including Base/Solana.
Alternative: POST /api/vault/vlt-deposit-calldata — agent sends ONLY $0.50 service fee USDC to PLATFORM_WALLETS.ethereum on Ethereum. The deposit amountUsdc stays in the agent's wallet; it is a calldata parameter, not a transfer to Coin Railz. Agent POSTs { txHash (of $0.50 fee transfer), amountUsdc, recipient } → verifyTransactionPayment checks only SERVICE_FEE_MICRO (500_000) → returns same calldata as x402 service.
Uses existing verifyTransactionPayment() from hybridPaymentMiddleware.ts and used_transaction_hashes replay protection.
CRITICAL: Do NOT require amountUsdc + $0.50 as the transfer amount — the calldata tells the agent to deposit amountUsdc from THEIR wallet, so if they already sent it to us, the vault.deposit() call will revert.

## Ethereum Gas (corrected Jul 22 2026)
Ethereum gas is NOT $5–15 per operation. Current reality: simple USDC transfer ~$0.05–0.20, complex vault deposit (approve + ERC-4626 deposit with internal swap) ~$0.30–1.00 at normal base fees. Total cost to enter vault via Ethereum lane: ~$1.15–1.65 (fee + gas). Economically viable.

## Stats Fallback
In dev without ALCHEMY_API_KEY in env, on-chain reads fail. Service falls back gracefully with source="fallback" and TVL=0. ETH price from CoinGecko still resolves correctly. Struct and all fields are populated.
