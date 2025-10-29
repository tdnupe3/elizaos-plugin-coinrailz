/**
 * Mint ERC-721 NFTs for deliverable AI agents
 * 
 * Usage: npx tsx scripts/mintAgentNFTs.ts <IDENTITY_REGISTRY_ADDRESS>
 */

import { ethers } from 'ethers';

const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

const IDENTITY_REGISTRY_ABI = [
  "function registerAgent(address agentAddress, string memory agentCardURI) external returns (uint256)",
  "function isRegistered(address agent) external view returns (bool)",
  "function tokenOfAgent(address agent) external view returns (uint256)",
  "function getAgentInfo(uint256 tokenId) external view returns (address, string memory, bool)"
];

const DELIVERABLE_AGENTS = [
  {
    address: '0x0000000000000000000000000000000000000001',
    agentCardURI: 'https://coinrailz.com/agent/smart-contract-auditor/.well-known/agent-card.json'
  },
  {
    address: '0x0000000000000000000000000000000000000002',
    agentCardURI: 'https://coinrailz.com/agent/compliance-consultant/.well-known/agent-card.json'
  },
  {
    address: process.env.PLATFORM_WALLET_ADDRESS || '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321',
    agentCardURI: 'https://coinrailz.com/agent/payment-processor/.well-known/agent-card.json'
  }
];

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Missing identity registry address');
    console.log('Usage: npx tsx scripts/mintAgentNFTs.ts <IDENTITY_REGISTRY_ADDRESS>');
    process.exit(1);
  }
  
  const identityRegistryAddress = args[0];
  
  console.log('🎨 Minting Agent Identity NFTs\n');
  console.log('═'.repeat(70));
  console.log('Identity Registry:', identityRegistryAddress);
  console.log('Network: Base Sepolia');
  console.log('═'.repeat(70));
  
  // Setup provider and wallet
  const privateKey = process.env.CDP_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('CDP_PRIVATE_KEY environment variable not set');
  }
  
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(identityRegistryAddress, IDENTITY_REGISTRY_ABI, wallet);
  
  console.log('\n👛 Deployer:', wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');
  
  console.log('═'.repeat(70));
  console.log('🤖 Registering Deliverable Agents:\n');
  
  for (const agent of DELIVERABLE_AGENTS) {
    try {
      console.log(`\n📝 Agent: ${agent.name}`);
      console.log(`   Address: ${agent.address}`);
      
      // Check if already registered
      const isRegistered = await contract.isRegistered(agent.address);
      if (isRegistered) {
        const tokenId = await contract.tokenOfAgent(agent.address);
        console.log(`   ⚠️  Already registered (Token ID: ${tokenId})`);
        continue;
      }
      
      // Register agent (2 parameters: address and agentCardURI)
      console.log('   ⏳ Minting NFT...');
      const tx = await contract.registerAgent(
        agent.address,
        agent.agentCardURI
      );
      
      console.log('   📡 Transaction:', tx.hash);
      console.log('   ⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('   ✅ Confirmed in block:', receipt.blockNumber);
      
      // Get token ID
      const tokenId = await contract.tokenOfAgent(agent.address);
      console.log('   🎫 Token ID:', tokenId.toString());
      console.log(`   🔗 View: https://sepolia.basescan.org/tx/${tx.hash}`);
      
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }
  
  console.log('\n═'.repeat(70));
  console.log('✅ Agent NFT minting complete!');
  console.log('═'.repeat(70));
  
  // Verify all agents
  console.log('\n🔍 Verification:\n');
  for (const agent of DELIVERABLE_AGENTS) {
    const isRegistered = await contract.isRegistered(agent.address);
    if (isRegistered) {
      const tokenId = await contract.tokenOfAgent(agent.address);
      const info = await contract.getAgentInfo(tokenId);
      console.log(`✅ Agent at ${agent.address}`);
      console.log(`   Token ID: ${tokenId}`);
      console.log(`   Agent Address: ${info[0]}`);
      console.log(`   Agent Card URI: ${info[1]}`);
      console.log(`   Active: ${info[2] ? 'Yes' : 'No'}\n`);
    } else {
      console.log(`❌ Agent at ${agent.address} - Not registered\n`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
