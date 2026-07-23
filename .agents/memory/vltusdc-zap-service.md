---
name: vltUSDC ZapHelper — USDC-only deposit execution path
description: Server-side service that builds live-quoted calldata for USDC-only deposits into the Bankroll Network vltUSDC vault via ZapHelper on Ethereum mainnet.
---

## What was built

`server/services/vltUsdcZapService.ts` — USDC-only ZapHelper deposit builder.

**Key facts (all verified on-chain):**
- ZapHelper: `0x348A57b1dc6E3dCAa645DE6e4E864924B410525D`
- ABI confirmed 7-arg (selector `0x9248013e` in bytecode): `zapDeposit(uint256 usdcAmount, uint256 swapUsdcToVlt, uint256 minVltOut, uint256 minShares, uint256 deadline, address recipient, bytes swapData)`
- swapData = Universal Router `execute(bytes commands, bytes[] inputs, uint256 deadline)` calldata
- Route: `USDC –[V3 0.05%]→ WETH –[V2]→ VLT` (commands = `0x0008` = V3_SWAP_EXACT_IN then V2_SWAP_EXACT_IN)
- VLT/WETH V2 pair: `0x966053Ca4fca049173eb1F27E4cb168CCb794534` (VLT=token0, WETH=token1)
- V3 QuoterV2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` (USDC→WETH, fee=500, confirmed working)
- Vault: `0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f`

## Route encoding

```
commands = '0x0008'  // [V3_SWAP_EXACT_IN, V2_SWAP_EXACT_IN]
ADDRESS_THIS = '0x0000000000000000000000000000000000000001'  // keep in router
MSG_SENDER   = '0x0000000000000000000000000000000000000002'  // send to ZapHelper
MAX_UINT256  // use all router balance for V2 amountIn

V3 input: encode([ADDRESS_THIS, swapHalf, 0, packed(USDC+500+WETH), false])
V2 input: encode([MSG_SENDER, MaxUint256, minVltOut, [WETH, VLT], false])
swapData = UR_IFACE.encodeFunctionData('execute', [commands, [v3In, v2In], deadline])
```

## Security model (architect-approved, fail-closed)

**Slippage guards — BOTH must succeed or no calldata is returned:**
1. `minVltOut` = live QuoterV2 staticCall result × 0.99 (1% VLT swap slippage)
2. `minShares` = vault.previewDeposit(vltAmountRaw, usdcHalfRaw) × 0.98 (2% share slippage)

**Fail-closed on either guard:**
- Live VLT quote failure → `errorResult()`, no steps emitted
- `vault.previewDeposit` failure → `errorResult()`, no steps emitted
- No fallback tiers exist (proportional/minimum-safe tiers removed per architect review)

`ZapDepositResult.minSharesSource` is narrowed to `'vault-preview'` only.

## Split strategy

50% of USDC swapped to VLT via ZapHelper's swap path, 50% deposited as USDC. 1% slippage on VLT output, 2% slippage on shares from `vault.previewDeposit`.

## Address normalization

ethers.js v6 throws on bad EIP-55 checksum. Use `ethers.getAddress(recipient)` to normalize — agents send lowercase addresses regularly. Store as `addr` (not re-declaring `recipient` parameter).

## TSX module cache caveat

tsx (esbuild-based) can serve a stale compiled module if edits are made while the server is running and the module was already cached via dynamic import. **Fix:** add any trivial change to the file to change its hash, then do a full workflow restart. The ReferenceError will clear on the next request.

## Endpoints

- `POST /api/vault/vlt-zap-deposit` — standalone USDC-only endpoint
- `POST /x402/vlt-usdc-deposit` with `usdcOnly:true` — x402 route with mode flag
- `GET /x402/vlt-usdc-deposit` — discovery: documents both `balanced` and `usdcOnly` modes

**Why:** The big adoption blocker for vltUSDC was requiring agents to hold VLT. This eliminates it — any agent with USDC on Ethereum mainnet can deposit.
