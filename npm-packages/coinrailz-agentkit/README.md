# coinrailz-agentkit

Coinbase AgentKit action provider for the [CoinRailz USDC Yield Vault](https://coinrailz.com/yield-portal) on Base.

**5 actions:**
- `coinrailz_yield_deposit` — approve + deposit USDC (2 txs, works with any wallet)
- `coinrailz_yield_deposit_permit` — EIP-2612 permit deposit (**1 tx**, requires `signTypedData`)
- `coinrailz_yield_redeem` — redeem crUSDC shares for USDC (1 tx, 0% exit fee)
- `coinrailz_yield_check_position` — live on-chain position query
- `coinrailz_yield_get_rates` — live APY across Aave v3, Compound v3, Morpho Blue

**Vault:** `0x86e2508ca0de34530dc847645f60f0d46d95176a` (Base mainnet, ERC-4626)  
**Auto-routes** to highest-yield protocol. 0.5% entry fee, 15% performance fee on yield, 0% exit.

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
  ],
})

// Your agent now understands:
// "Deposit $100 USDC to earn yield"
// "Check my current yield position"
// "What APY am I earning?"
// "Withdraw my USDC"
// "Deposit $50 USDC in a single transaction"  ← uses permit
```

## Usage standalone (no AgentKit)

```typescript
import { CoinRailzYieldActionProvider } from 'coinrailz-agentkit'

const provider = new CoinRailzYieldActionProvider()

// Deposit $100 USDC
const result = await provider.deposit(walletProvider, { amount_usd: 100 })
console.log(result) // "✅ Deposited $100 USDC..."

// 1-tx permit deposit (requires wallet.signTypedData)
const result2 = await provider.depositPermit(walletProvider, { amount_usd: 100 })

// Check position
const pos = await provider.checkPosition(walletProvider, {})

// Withdraw all
const redeem = await provider.redeem(walletProvider, {})
```

## Permit vs Standard Deposit

| Mode | Transactions | Requires |
|------|-------------|----------|
| `coinrailz_yield_deposit` | 2 (approve + deposit) | Any EVM wallet |
| `coinrailz_yield_deposit_permit` | **1** (permit + deposit) | `wallet.signTypedData` |

The permit flow uses EIP-2612 (supported by USDC on Base) and routes through the [`PermitAndDeposit`](https://basescan.org/address/0x8d291ae2f9850c5c2899100f381ab43dc95b82cf) helper contract.

## Wallet Provider Interface

Your wallet must implement:

```typescript
interface EvmWalletProvider {
  getAddress(): string
  sendTransaction(tx: { to: `0x${string}`; data: `0x${string}` }): Promise<`0x${string}`>
  waitForTransactionReceipt(hash: `0x${string}`): Promise<{ status: string }>
  readContract(params: { address: `0x${string}`; abi: ...; functionName: string; args?: ... }): Promise<unknown>
  signTypedData?(params: { domain; types; primaryType; message }): Promise<`0x${string}`>  // optional, for permit
}
```

Coinbase AgentKit's `EvmWalletProvider`, CDP SDK wallets, viem `WalletClient`, and ethers `Signer` all satisfy this interface with minor adapters.

## Links

- [Vault on Basescan](https://basescan.org/address/0x86e2508ca0de34530dc847645f60f0d46d95176a)
- [PermitAndDeposit on Basescan](https://basescan.org/address/0x8d291ae2f9850c5c2899100f381ab43dc95b82cf)
- [API manifest](https://coinrailz.com/api/yield/manifest)
- [Yield portal](https://coinrailz.com/yield-portal)
