/**
 * Direct Contract Method Testing
 * Try different ways to query the ERC-8004 contract
 */

import { ethers } from 'ethers';
import { ERC8004_CONTRACTS } from '../config/blockchain';

async function queryMethods() {
  console.log('\n🔬 TESTING CONTRACT METHODS\n');
  console.log('━'.repeat(60));

  const provider = new ethers.JsonRpcProvider(ERC8004_CONTRACTS.rpcUrl);
  
  // Try basic ERC-721 ABI first
  const basicERC721ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)"
  ];

  const contract = new ethers.Contract(
    ERC8004_CONTRACTS.contracts.identityRegistry,
    basicERC721ABI,
    provider
  );

  try {
    // 1. Basic ERC-721 queries
    console.log('\n📋 ERC-721 Standard Queries:');
    try {
      const name = await contract.name();
      console.log(`✅ Name: ${name}`);
    } catch (e) {
      console.log(`❌ name(): ${(e as Error).message.slice(0, 60)}`);
    }

    try {
      const symbol = await contract.symbol();
      console.log(`✅ Symbol: ${symbol}`);
    } catch (e) {
      console.log(`❌ symbol(): ${(e as Error).message.slice(0, 60)}`);
    }

    // 2. Check owner of tokens 1, 2, 3
    console.log('\n👤 Token Ownership:');
    for (const tokenId of [1, 2, 3]) {
      try {
        const owner = await contract.ownerOf(tokenId);
        console.log(`Token #${tokenId}: Owner = ${owner}`);
        
        // Check if it's a burn address
        if (owner === '0x0000000000000000000000000000000000000001') {
          console.log(`   ⚠️ Token #${tokenId} is owned by burn address 0x1`);
        }
      } catch (e) {
        console.log(`Token #${tokenId}: NOT MINTED (${(e as Error).message.slice(0, 40)})`);
      }
    }

    // 3. Try tokenURI (might contain agent card data)
    console.log('\n📝 Token URIs (Agent Card locations):');
    for (const tokenId of [1, 2, 3]) {
      try {
        const uri = await contract.tokenURI(tokenId);
        console.log(`Token #${tokenId} URI: ${uri}`);
      } catch (e) {
        console.log(`Token #${tokenId} URI: FAILED (${(e as Error).message.slice(0, 40)})`);
      }
    }

    // 4. Check balance of platform wallet
    console.log('\n💰 Platform Wallet Check:');
    const platformWallet = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
    try {
      const balance = await contract.balanceOf(platformWallet);
      console.log(`Platform wallet ${platformWallet} owns ${balance} tokens`);
    } catch (e) {
      console.log(`❌ balanceOf failed: ${(e as Error).message}`);
    }

    // 5. Summary
    console.log('\n━'.repeat(60));
    console.log('📊 ANALYSIS:');
    console.log('━'.repeat(60));
    console.log('\n1. If tokens exist with owner 0x1: They were minted then burned/transferred');
    console.log('2. If tokenURI works: Agent card data might be in IPFS/HTTP URIs');
    console.log('3. If platform wallet balance = 0: Tokens were transferred away');
    console.log('4. If getAgentInfo fails but tokenURI works: Use tokenURI instead');
    console.log('');

  } catch (error) {
    console.error('Query failed:', error);
  }
}

queryMethods().catch(console.error);
