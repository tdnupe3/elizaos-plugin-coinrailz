# coinrailz-agentkit

Coinbase AgentKit action provider for the [CoinRailz USDC Yield Vault](https://coinrailz.com/yield-portal) on Base.

**Fully compatible with `AgentKit.from()`** — implements the `ActionProvider` interface via duck-typing (`name`, `supportsNetwork`, `getActions`). No `@CreateAction` decorators or `reflect-metadata` required.

## Install

```bash
npm install coinrailz-agentkit
```

## Usage with Coinbase AgentKit

```typescript
import { AgentKit } from '@coinbase/agentkit'
import { CoinRailzYieldActionProvider } from 'coinrailz-agentkit'

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    new CoinRailzYieldActionProvider(),
    // ...other providers
  ],
})

// Your agent now understands:
// "Deposit $100 USDC to earn yield"
// "Deposit $50 in a single transaction"          ← EIP-2612 permit, ~50% less gas
// "Check my current yield position"
// "What APY am I earning?"
// "Withdraw my USDC"
// "Show me the vault contract addresses"
```

## 6 Actions

| Action | Description | Txs |
|--------|-------------|-----|
| `coinrailz_yield_deposit` | Approve + deposit USDC | 2 (any wallet) |
| `coinrailz_yield_deposit_permit` | EIP-2612 permit deposit | **1** (needs `signTypedData`) |
| `coinrailz_yield_redeem` | Redeem crUSDC for USDC | 1, 0% exit fee |
| `coinrailz_yield_check_position` | Live shares, value, yield, protocol allocation | — |
| `coinrailz_yield_get_rates` | Live APY across Aave v3 / Compound v3 / Morpho Blue | — |
| `coinrailz_yield_get_contract_info` | Addresses, Basescan links, audit status, fee structure | — |

## AgentKit Compatibility

This package uses duck-typing to be compatible with `AgentKit.from()` without hard-importing `@coinbase/agentkit`:

- `supportsNetwork(network)` — gates to `base-mainnet` and `base-sepolia` (EVM protocol family)
- `getActions(walletProvider)` — returns `{ name, description, schema, invoke }[]` with wallet bound via closure
- Works with AgentKit v0.x and v1.x

`@coinbase/agentkit` is an **optional** peer dependency — you only need it if you use `AgentKit.from()`.

## Usage standalone (no AgentKit)

```typescript
import { CoinRailzYieldActionProvider } from 'coinrailz-agentkit'

const provider = new CoinRailzYieldActionProvider()

// Check supported networks
console.log(provider.supportsNetwork({ protocolFamily: 'evm', networkId: 'base-mainnet' })) // true

// Deposit $100 USDC (2 txs)
const result = await provider.deposit(walletProvider, { amount_usd: 100 })

// Deposit $100 in 1 tx via EIP-2612 permit
const result2 = await provider.depositPermit(walletProvider, { amount_usd: 100 })

// Check position (with protocol allocation)
const pos = await provider.checkPosition(walletProvider, {})

// Verify contracts before depositing
const info = await provider.getContractInfo(walletProvider, {})

// Get live rates
const rates = await provider.getRates(walletProvider, {})

// Withdraw all
const redeem = await provider.redeem(walletProvider, {})
```

## Permit vs Standard Deposit

| Mode | Transactions | Gas | Requires |
|------|-------------|-----|----------|
| `coinrailz_yield_deposit` | 2 (approve + deposit) | ~270k | Any EVM wallet |
| `coinrailz_yield_deposit_permit` | **1** (permit + deposit) | **~130k** | `wallet.signTypedData` |

The permit flow uses EIP-2612 (supported by native USDC on Base) and routes through the [`PermitAndDeposit`](https://basescan.org/address/0x8d291ae2f9850c5c2899100f381ab43dc95b82cf) helper contract at `0x8d291ae2f9850c5c2899100f381ab43dc95b82cf`.

## Wallet Provider Interface

```typescript
interface EvmWalletProvider {
  getAddress(): string
  sendTransaction(tx: { to: `0x${string}`; data: `0x${string}` }): Promise<`0x${string}`>
  waitForTransactionReceipt(hash: `0x${string}`): Promise<{ status: string }>
  readContract(params: { address; abi; functionName; args? }): Promise<unknown>
  signTypedData?(params: { domain; types; primaryType; message }): Promise<`0x${string}`>
}
```

Coinbase AgentKit's `EvmWalletProvider`, CDP SDK wallets, viem `WalletClient`, and ethers `Signer` all satisfy this interface with minor adapters.

## Vault Details

- **Vault:** [`0x86e2508ca0de34530dc847645f60f0d46d95176a`](https://basescan.org/address/0x86e2508ca0de34530dc847645f60f0d46d95176a) — Base mainnet, ERC-4626
- **Auto-routes** to highest-yield protocol across Aave v3, Compound v3, Morpho Blue
- **Fees:** 0.5% entry, 15% performance on yield only, 0% exit
- **Fee caps:** 2% entry / 30% performance (hard-coded in bytecode — admin cannot exceed)
- **Status:** Unaudited — early deployment

## Links

- [Vault on Basescan](https://basescan.org/address/0x86e2508ca0de34530dc847645f60f0d46d95276a)
- [PermitAndDeposit on Basescan](https://basescan.org/address/0x8d291ae2f9850c5c2899100f381ab43dc95b82cf)
- [API manifest](https://coinrailz.com/api/yield/manifest)
- [Yield portal](https://coinrailz.com/yield-portal)
- [npm](https://www.npmjs.com/package/coinrailz-agentkit)
