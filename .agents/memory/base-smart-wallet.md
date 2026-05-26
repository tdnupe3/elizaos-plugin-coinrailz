---
name: Base Smart Wallet
description: Coinbase's passkey-based smart contract wallet on Base chain, distinct from the Coinbase DeFi Wallet
---

## Rule
`keys.coinbase.com` is the **Base Smart Wallet** (ERC-4337 smart contract account, passkey login, page title is "Base").
`wallet.coinbase.com` is the **Coinbase Wallet** (DeFi wallet, seed phrase based).
These are two separate products. Both URLs return HTTP 200.

**Why:** Coinbase has been positioning the Base Smart Wallet as the flagship wallet for the onchain app ecosystem. The page title "Base" confirms the branding. We added a "Create Base Smart Wallet" button in CoinbaseWalletIntegration.tsx styled with blue/indigo gradient.

## How to Apply
- When adding or updating wallet integration UIs, include BOTH: Base Smart Wallet (keys.coinbase.com) as primary/recommended, Coinbase Wallet (wallet.coinbase.com) as secondary/advanced
- The Base Smart Wallet button uses the Fingerprint icon (passkey/biometric branding)
- Biz dev confirmed: prominent positioning aligns with Base ecosystem partnership opportunities
