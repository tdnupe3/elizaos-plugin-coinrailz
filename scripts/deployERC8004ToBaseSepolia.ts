/**
 * Deploy ERC-8004 Identity and Reputation Registries to Base Sepolia Testnet
 * 
 * Requirements:
 * - Testnet ETH in your wallet
 * - Private key in CDP_PRIVATE_KEY secret
 * 
 * Run: npx tsx scripts/deployERC8004ToBaseSepolia.ts
 */

import { ethers } from 'ethers';

// Base Sepolia configuration
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const CHAIN_ID = 84532;

// Deliverable agents to register
const DELIVERABLE_AGENTS = [
  {
    address: '0x0000000000000000000000000000000000000001',
    name: 'Coin Railz Smart Contract Auditor',
    metadataURI: 'https://coinrailz.com/agent/smart-contract-auditor/.well-known/agent-card.json'
  },
  {
    address: '0x0000000000000000000000000000000000000002',
    name: 'Coin Railz Compliance Consultant',
    metadataURI: 'https://coinrailz.com/agent/compliance-consultant/.well-known/agent-card.json'
  },
  {
    address: process.env.PLATFORM_WALLET_ADDRESS || '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321',
    name: 'Coin Railz Payment Processor',
    metadataURI: 'https://coinrailz.com/agent/payment-processor/.well-known/agent-card.json'
  }
];

// Solidity compiler output (manually compiled)
// Note: These are minimal ABIs - full compilation would require solc
const IDENTITY_REGISTRY_ABI = [
  "constructor()",
  "function registerAgent(address agent, string memory name, string memory metadataURI) external",
  "function revokeAgent(uint256 tokenId) external",
  "function getAgentInfo(uint256 tokenId) external view returns (address, string memory, string memory, bool)",
  "function isRegistered(address agent) external view returns (bool)",
  "function tokenOfAgent(address agent) external view returns (uint256)",
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)"
];

const REPUTATION_REGISTRY_ABI = [
  "constructor()",
  "function recordService(address agent, bool success, string memory feedback) external",
  "function getReputation(address agent) external view returns (uint256, uint256, uint256)",
  "function getServiceHistory(address agent) external view returns (uint256)"
];

async function main() {
  console.log('🚀 Deploying ERC-8004 Contracts to Base Sepolia Testnet\n');
  console.log('═'.repeat(70));
  
  // Get private key from environment
  const privateKey = process.env.CDP_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('CDP_PRIVATE_KEY environment variable not set');
  }
  
  // Setup provider and wallet
  console.log('📡 Connecting to Base Sepolia...');
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('👛 Deployer Address:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  const balanceETH = ethers.formatEther(balance);
  console.log('💰 Balance:', balanceETH, 'ETH');
  
  if (parseFloat(balanceETH) < 0.001) {
    throw new Error('Insufficient testnet ETH. Need at least 0.001 ETH. Get more from https://www.coinbase.com/faucet');
  }
  
  console.log('✅ Balance sufficient for deployment\n');
  console.log('═'.repeat(70));
  
  // Read contract bytecode
  // NOTE: In production, you would compile these with solc
  // For now, we'll use a pre-compiled bytecode approach
  
  console.log('\n⚠️  DEPLOYMENT METHOD:\n');
  console.log('Due to complexity of on-the-fly Solidity compilation, please use one of:');
  console.log('\n1. REMIX IDE (Recommended for testing):');
  console.log('   - Go to https://remix.ethereum.org');
  console.log('   - Upload contracts/ERC8004IdentityRegistry.sol');
  console.log('   - Upload contracts/ERC8004ReputationRegistry.sol');
  console.log('   - Compile with Solidity 0.8.20');
  console.log('   - Deploy to Base Sepolia using MetaMask');
  console.log('   - Network: Base Sepolia (Chain ID: 84532)');
  console.log('   - RPC: https://sepolia.base.org\n');
  
  console.log('2. HARDHAT (For production):');
  console.log('   - Install: npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox');
  console.log('   - Configure hardhat.config.ts with Base Sepolia');
  console.log('   - Run: npx hardhat run scripts/deployERC8004.js --network baseSepolia\n');
  
  console.log('3. FOUNDRY (Alternative):');
  console.log('   - Install Foundry: curl -L https://foundry.paradigm.xyz | bash');
  console.log('   - Deploy: forge create --rpc-url https://sepolia.base.org --private-key $CDP_PRIVATE_KEY\n');
  
  console.log('═'.repeat(70));
  console.log('\n📋 AFTER DEPLOYMENT:\n');
  console.log('Run this script to register agents:');
  console.log('npx tsx scripts/mintAgentNFTs.ts <IDENTITY_REGISTRY_ADDRESS>\n');
  
  console.log('═'.repeat(70));
  console.log('\n💡 QUICK START WITH REMIX:\n');
  console.log('1. Visit https://remix.ethereum.org');
  console.log('2. Create new file: ERC8004IdentityRegistry.sol');
  console.log('3. Copy from: contracts/ERC8004IdentityRegistry.sol');
  console.log('4. Repeat for ERC8004ReputationRegistry.sol');
  console.log('5. Compile both (Solidity 0.8.20)');
  console.log('6. Connect MetaMask to Base Sepolia');
  console.log('7. Deploy both contracts');
  console.log('8. Copy deployed addresses');
  console.log('9. Run: npx tsx scripts/mintAgentNFTs.ts <IDENTITY_ADDRESS>\n');
  
  console.log('═'.repeat(70));
  console.log('\n🔗 USEFUL LINKS:\n');
  console.log('Remix IDE: https://remix.ethereum.org');
  console.log('Base Sepolia Faucet: https://www.coinbase.com/faucet');
  console.log('BaseScan Testnet: https://sepolia.basescan.org');
  console.log('Add Base Sepolia to MetaMask:');
  console.log('  - Network Name: Base Sepolia');
  console.log('  - RPC URL: https://sepolia.base.org');
  console.log('  - Chain ID: 84532');
  console.log('  - Currency Symbol: ETH');
  console.log('  - Block Explorer: https://sepolia.basescan.org\n');
  
  console.log('═'.repeat(70));
  console.log('\n✅ Wallet ready for deployment!');
  console.log('   Address:', wallet.address);
  console.log('   Balance:', balanceETH, 'ETH');
  console.log('   Network: Base Sepolia (Chain ID: 84532)\n');
}

main()
  .then(() => {
    console.log('\n✅ Pre-deployment check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
