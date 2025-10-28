# Deploy ERC-8004 NOW - Step-by-Step Remix Guide

You have testnet ETH! Let's deploy in **5 minutes** using Remix IDE.

---

## 🚀 Quick Deploy (5 Minutes)

### Step 1: Open Remix IDE
**Go to:** https://remix.ethereum.org

### Step 2: Upload Contracts

1. Click the **"File Explorer"** icon (top left)
2. Click **"+"** to create new file
3. Name it: `ERC8004IdentityRegistry.sol`
4. Copy ENTIRE contents from your local file:
   ```
   contracts/ERC8004IdentityRegistry.sol
   ```
5. **Repeat** for second contract:
   - Name: `ERC8004ReputationRegistry.sol`
   - Copy from: `contracts/ERC8004ReputationRegistry.sol`

### Step 3: Compile Contracts

1. Click **"Solidity Compiler"** icon (left sidebar)
2. Select compiler: **0.8.20**
3. Click **"Compile ERC8004IdentityRegistry.sol"**
4. Wait for green checkmark ✅
5. Click **"Compile ERC8004ReputationRegistry.sol"**
6. Wait for green checkmark ✅

### Step 4: Connect MetaMask to Base Sepolia

1. Open **MetaMask** extension
2. Click network dropdown (top)
3. **If Base Sepolia not listed**, add it:
   - Click "Add Network"
   - Click "Add network manually"
   - Fill in:
     - **Network Name:** Base Sepolia
     - **RPC URL:** `https://sepolia.base.org`
     - **Chain ID:** `84532`
     - **Currency Symbol:** ETH
     - **Block Explorer:** `https://sepolia.basescan.org`
   - Click "Save"
4. **Select "Base Sepolia"** from network dropdown

### Step 5: Deploy IdentityRegistry

1. Click **"Deploy & Run Transactions"** icon (left sidebar)
2. **Environment:** Select "Injected Provider - MetaMask"
3. Confirm MetaMask shows "Base Sepolia" network
4. **Contract:** Select "ERC8004IdentityRegistry"
5. Click **"Deploy"** button (orange)
6. **MetaMask popup:** Review and click "Confirm"
7. Wait 5-10 seconds
8. **COPY THE ADDRESS!** (appears under "Deployed Contracts")
   - Example: `0x1234...5678`
   - **Save this!** You need it for the next step

### Step 6: Deploy ReputationRegistry

1. **Contract:** Select "ERC8004ReputationRegistry"
2. Click **"Deploy"** button
3. **MetaMask popup:** Confirm
4. Wait 5-10 seconds
5. **COPY THE ADDRESS!**
   - Save both addresses somewhere

---

## ✅ After Deployment

### Verify on BaseScan

Visit these URLs (replace with YOUR addresses):
```
https://sepolia.basescan.org/address/<YOUR_IDENTITY_REGISTRY_ADDRESS>
https://sepolia.basescan.org/address/<YOUR_REPUTATION_REGISTRY_ADDRESS>
```

You should see your deployed contracts! 🎉

### Mint Agent NFTs

Run this command with YOUR IdentityRegistry address:

```bash
npx tsx scripts/mintAgentNFTs.ts <YOUR_IDENTITY_REGISTRY_ADDRESS>
```

Example:
```bash
npx tsx scripts/mintAgentNFTs.ts 0x1234567890123456789012345678901234567890
```

This will mint NFTs for:
- ✅ Smart Contract Auditor
- ✅ Compliance Consultant  
- ✅ Payment Processor

---

## 🎯 What You'll See

### After Minting:
```
🎨 Minting Agent Identity NFTs
═══════════════════════════════════════════
✅ Coin Railz Smart Contract Auditor
   Token ID: 1
   Address: 0x0000000000000000000000000000000000000001
   Active: Yes

✅ Coin Railz Compliance Consultant
   Token ID: 2
   Address: 0x0000000000000000000000000000000000000002
   Active: Yes

✅ Coin Railz Payment Processor
   Token ID: 3
   Address: 0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321
   Active: Yes
```

---

## 🔗 Update Backend

After deployment, save your contract addresses:

**Create:** `server/config/blockchain.ts`
```typescript
export const ERC8004_CONTRACTS = {
  network: 'base-sepolia',
  chainId: 84532,
  identityRegistry: '<YOUR_IDENTITY_REGISTRY_ADDRESS>',
  reputationRegistry: '<YOUR_REPUTATION_REGISTRY_ADDRESS>'
};
```

---

## ❓ Troubleshooting

**"Insufficient funds"**
- Get more testnet ETH from https://www.coinbase.com/faucet

**"MetaMask not connecting"**
- Make sure you selected "Injected Provider" in Remix
- Refresh Remix page and try again

**"Compilation failed"**
- Make sure compiler version is **0.8.20**
- Check you copied the FULL contract code

**"Transaction failed"**
- Check you're on Base Sepolia network in MetaMask
- Verify you have enough testnet ETH

---

## 📊 Cost Estimate

- Deploy IdentityRegistry: ~0.003 ETH
- Deploy ReputationRegistry: ~0.002 ETH
- Mint 3 NFTs: ~0.001 ETH each
- **Total:** ~0.008 ETH (FREE from faucet!)

---

## 🎉 Success Checklist

After completing all steps, you should have:

- [ ] IdentityRegistry deployed and verified on BaseScan
- [ ] ReputationRegistry deployed and verified on BaseScan
- [ ] 3 Agent NFTs minted (token IDs 1, 2, 3)
- [ ] Contract addresses saved
- [ ] Agents visible on-chain

**Ready to test the full flow:**
Order → Payment → Delivery → On-chain Reputation! 🚀

---

**Need Help?** Check BaseScan to verify your deployments:
https://sepolia.basescan.org
