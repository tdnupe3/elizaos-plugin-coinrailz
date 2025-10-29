# ERC-8004 Deployed Contract Addresses

**Network:** Base Mainnet  
**Chain ID:** 8453  
**Deployment Date:** October 29, 2025

---

## Contract Addresses

### IdentityRegistry (ERC-721 NFT for Agent Identity)
```
Address: 0x8AfBd4f43399aeB6e26AD827AeaAADfB10ebb5Aa
Explorer: https://basescan.org/address/0x8AfBd4f43399aeB6e26AD827AeaAADfB10ebb5Aa
```

### ReputationRegistry (On-chain Reputation Tracking)
```
Address: 0x3130232Ef23f7f7Dbc41f2c6A790928bc674Bb24
Explorer: https://basescan.org/address/0x3130232Ef23f7f7Dbc41f2c6A790928bc674Bb24
```

---

## Minted Agent NFTs ✅

**Status:** All 3 agents successfully minted on Base mainnet

### Token ID 1: Smart Contract Auditor
- Address: `0x0000000000000000000000000000000000000001`
- Name: Coin Railz Smart Contract Auditor
- Metadata: https://coinrailz.com/agent/smart-contract-auditor/.well-known/agent-card.json

### Token ID 2: Compliance Consultant
- Address: `0x0000000000000000000000000000000000000002`
- Name: Coin Railz Compliance Consultant
- Metadata: https://coinrailz.com/agent/compliance-consultant/.well-known/agent-card.json

### Token ID 3: Payment Processor
- Address: `<PLATFORM_WALLET_ADDRESS>`
- Name: Coin Railz Payment Processor
- Metadata: https://coinrailz.com/agent/payment-processor/.well-known/agent-card.json

---

## Backend Integration

After deployment, update `server/config/blockchain.ts`:

```typescript
export const ERC8004_CONTRACTS = {
  network: 'base-sepolia',
  chainId: 84532,
  rpcUrl: 'https://sepolia.base.org',
  identityRegistry: '<PASTE_IDENTITY_ADDRESS>',
  reputationRegistry: '<PASTE_REPUTATION_ADDRESS>'
};
```

---

## Deployment Completed: ✅

- [x] IdentityRegistry deployed → `0x8AfBd4f43399aeB6e26AD827AeaAADfB10ebb5Aa`
- [x] ReputationRegistry deployed → `0x3130232Ef23f7f7Dbc41f2c6A790928bc674Bb24`
- [x] Agent NFTs minted (3 total)
- [x] Addresses saved above
- [x] Backend config updated → `server/config/blockchain.ts`
- [ ] Test end-to-end order flow with on-chain reputation

---

**Instructions:** Follow `docs/DEPLOY_NOW_REMIX.md` for step-by-step deployment
