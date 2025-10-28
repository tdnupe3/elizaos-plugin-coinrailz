# ERC-8004 Deployed Contract Addresses

**Network:** Base Sepolia Testnet  
**Chain ID:** 84532  
**Deployment Date:** _Pending_

---

## Contract Addresses

### IdentityRegistry (ERC-721 NFT for Agent Identity)
```
Address: <PASTE_HERE_AFTER_DEPLOYMENT>
Explorer: https://sepolia.basescan.org/address/<ADDRESS>
```

### ReputationRegistry (On-chain Reputation Tracking)
```
Address: <PASTE_HERE_AFTER_DEPLOYMENT>
Explorer: https://sepolia.basescan.org/address/<ADDRESS>
```

---

## Minted Agent NFTs

After deployment, these agents will have ERC-721 NFT identities:

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

## Deployment Completed: ☐

- [ ] IdentityRegistry deployed
- [ ] ReputationRegistry deployed  
- [ ] Agent NFTs minted (3 total)
- [ ] Addresses saved above
- [ ] Backend config updated
- [ ] Verified on BaseScan

---

**Instructions:** Follow `docs/DEPLOY_NOW_REMIX.md` for step-by-step deployment
