# ERC-8004 Deployment Guide for Base Sepolia Testnet

## What is ERC-8004?

ERC-8004 is an **Agent Identity and Reputation Standard** that provides blockchain-based identity for AI agents using:
- **ERC-721 NFTs** as unique agent identities
- **On-chain reputation registry** to track service quality
- **Decentralized trust** without central authority

## Smart Contracts Ready for Deployment

### 1. IdentityRegistry.sol
Location: `contracts/ERC8004IdentityRegistry.sol`

**Features:**
- Mints ERC-721 NFTs representing agent identities
- Stores agent metadata (name, capabilities, pricing)
- Publicly queryable agent information
- Only contract owner can register/revoke agents

**Key Functions:**
```solidity
registerAgent(address agent, string memory name, string memory metadataURI)
revokeAgent(uint256 tokenId)
getAgentInfo(uint256 tokenId)
isRegistered(address agent)
```

### 2. ReputationRegistry.sol
Location: `contracts/ERC8004ReputationRegistry.sol`

**Features:**
- Tracks service delivery success/failure
- Calculates reputation scores (0-100)
- Records customer feedback
- Prevents fake reviews (verified transactions only)

**Key Functions:**
```solidity
recordService(address agent, bool success, string memory feedback)
getReputation(address agent)
getServiceHistory(address agent)
```

## Deployment Steps

### Option 1: Using Remix IDE (Recommended for Testing)

1. **Get Testnet ETH:**
   - Go to https://www.coinbase.com/faucet or https://sepoliafaucet.com
   - Request Base Sepolia testnet ETH (free)
   - Use wallet address: `0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91` (or your preferred wallet)

2. **Open Remix:**
   - Visit https://remix.ethereum.org
   - Create new file: `ERC8004IdentityRegistry.sol`
   - Copy content from `contracts/ERC8004IdentityRegistry.sol`
   - Do the same for `ERC8004ReputationRegistry.sol`

3. **Compile Contracts:**
   - Click "Solidity Compiler" tab
   - Select compiler version: `0.8.20`
   - Enable optimization: 200 runs
   - Click "Compile"

4. **Deploy to Base Sepolia:**
   - Click "Deploy & Run Transactions" tab
   - Environment: "Injected Provider - MetaMask"
   - Network: Switch MetaMask to Base Sepolia
     - Chain ID: 84532
     - RPC URL: https://sepolia.base.org
   - Deploy `ERC8004IdentityRegistry` first
   - Then deploy `ERC8004ReputationRegistry`
   - **SAVE CONTRACT ADDRESSES!**

### Option 2: Using Hardhat/Foundry (Production Ready)

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Create deployment script
# Save as: scripts/deployERC8004.js
```

**Deployment Script (scripts/deployERC8004.js):**
```javascript
const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying ERC-8004 Contracts to Base Sepolia...\n");

  // Deploy Identity Registry
  console.log("📝 Deploying IdentityRegistry...");
  const IdentityRegistry = await hre.ethers.getContractFactory("ERC8004IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log("✅ IdentityRegistry deployed to:", identityAddress);

  // Deploy Reputation Registry
  console.log("\n📝 Deploying ReputationRegistry...");
  const ReputationRegistry = await hre.ethers.getContractFactory("ERC8004ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy();
  await reputationRegistry.waitForDeployment();
  const reputationAddress = await reputationRegistry.getAddress();
  console.log("✅ ReputationRegistry deployed to:", reputationAddress);

  console.log("\n📋 Deployment Summary:");
  console.log("IdentityRegistry:", identityAddress);
  console.log("ReputationRegistry:", reputationAddress);
  console.log("\n🔗 Verify on BaseScan:");
  console.log(`https://sepolia.basescan.org/address/${identityAddress}`);
  console.log(`https://sepolia.basescan.org/address/${reputationAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Run Deployment:**
```bash
npx hardhat run scripts/deployERC8004.js --network baseSepolia
```

## Post-Deployment: Mint Agent NFTs

Once deployed, register the 3 deliverable agents:

```javascript
// Using ethers.js or via Remix
const identityRegistry = new ethers.Contract(
  IDENTITY_REGISTRY_ADDRESS,
  abi,
  signer
);

// Register Smart Contract Auditor
await identityRegistry.registerAgent(
  "0x0000000000000000000000000000000000000001",
  "Coin Railz Smart Contract Auditor",
  "https://coinrailz.com/agent/smart-contract-auditor/.well-known/agent-card.json"
);

// Register Compliance Consultant
await identityRegistry.registerAgent(
  "0x0000000000000000000000000000000000000002",
  "Coin Railz Compliance Consultant",
  "https://coinrailz.com/agent/compliance-consultant/.well-known/agent-card.json"
);

// Register Payment Processor
await identityRegistry.registerAgent(
  PLATFORM_WALLET_ADDRESS,
  "Coin Railz Payment Processor",
  "https://coinrailz.com/agent/payment-processor/.well-known/agent-card.json"
);
```

## Integration with Backend

After deployment, update `server/config/blockchain.ts`:

```typescript
export const ERC8004_CONFIG = {
  network: 'base-sepolia',
  chainId: 84532,
  rpcUrl: 'https://sepolia.base.org',
  contracts: {
    identityRegistry: 'YOUR_DEPLOYED_IDENTITY_ADDRESS',
    reputationRegistry: 'YOUR_DEPLOYED_REPUTATION_ADDRESS'
  }
};
```

## Testing the Integration

1. **Mint an agent NFT** (via Remix or script)
2. **Deliver a service** (Smart Contract Audit or Compliance Consultation)
3. **Record reputation** via ReputationRegistry
4. **Query agent info** to verify on-chain data

## Benefits of ERC-8004

✅ **Decentralized Identity**: No single point of failure  
✅ **Portable Reputation**: Agents carry reputation across platforms  
✅ **Verifiable History**: All services recorded on-chain  
✅ **Trust Without Middlemen**: Blockchain-based verification  
✅ **Interoperability**: Standard interface for all AI agents  

## Next Steps

1. Deploy contracts to Base Sepolia testnet
2. Mint NFTs for 3 deliverable agents
3. Test order → delivery → reputation flow
4. Add blockchain verification to Agent Cards
5. Display on-chain reputation in marketplace UI

## Resources

- Base Sepolia Faucet: https://www.coinbase.com/faucet
- Base Sepolia Explorer: https://sepolia.basescan.org
- Remix IDE: https://remix.ethereum.org
- ERC-8004 Standard: Emerging standard for AI agent identity

---

**Status:** Contracts ready for deployment ✅  
**Estimated Gas Cost:** ~0.01 ETH on testnet (free from faucet)  
**Deployment Time:** 5-10 minutes
