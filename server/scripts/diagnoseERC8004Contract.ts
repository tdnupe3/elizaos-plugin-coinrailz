/**
 * ERC-8004 Contract Diagnostic Script
 * Verifies if documented agents (tokens #1, #2, #3) actually exist on-chain
 */

import { ethers } from 'ethers';
import { ERC8004_CONTRACTS, IDENTITY_REGISTRY_ABI } from '../config/blockchain';

async function diagnoseContract() {
  console.log('\n🔍 ERC-8004 CONTRACT DIAGNOSTIC\n');
  console.log('━'.repeat(60));
  console.log(`Network: Base Mainnet (Chain ID: ${ERC8004_CONTRACTS.chainId})`);
  console.log(`Contract: ${ERC8004_CONTRACTS.contracts.identityRegistry}`);
  console.log(`Explorer: ${ERC8004_CONTRACTS.explorerUrl}/address/${ERC8004_CONTRACTS.contracts.identityRegistry}`);
  console.log('━'.repeat(60));

  const provider = new ethers.JsonRpcProvider(ERC8004_CONTRACTS.rpcUrl);
  const contract = new ethers.Contract(
    ERC8004_CONTRACTS.contracts.identityRegistry,
    IDENTITY_REGISTRY_ABI,
    provider
  );

  try {
    // 1. Check if contract exists
    console.log('\n📍 Step 1: Verify Contract Exists');
    const code = await provider.getCode(ERC8004_CONTRACTS.contracts.identityRegistry);
    if (code === '0x') {
      console.log('❌ CRITICAL: No contract deployed at this address!');
      return;
    }
    console.log(`✅ Contract exists (${code.length} bytes of bytecode)`);

    // 2. Check ERC-721 basic info
    console.log('\n📍 Step 2: Query ERC-721 Metadata');
    try {
      const name = await contract.name();
      const symbol = await contract.symbol();
      const totalSupply = await contract.totalSupply();
      console.log(`✅ Name: ${name}`);
      console.log(`✅ Symbol: ${symbol}`);
      console.log(`✅ Total Supply: ${totalSupply.toString()} tokens`);
      
      if (totalSupply.toString() === '0') {
        console.log('\n⚠️ WARNING: Total supply is 0 - no agents have been minted!');
        console.log('   The documented agents (tokens #1, #2, #3) do not exist on-chain.');
        console.log('   Contract was deployed but no NFTs were minted.');
        return;
      }
    } catch (error) {
      console.log(`❌ Failed to get ERC-721 metadata: ${(error as Error).message}`);
    }

    // 3. Query documented token IDs (1, 2, 3)
    console.log('\n📍 Step 3: Check Documented Token IDs');
    console.log('   Documented in replit.md:');
    console.log('   - Token #1: Smart Contract Auditor');
    console.log('   - Token #2: Compliance Consultant');
    console.log('   - Token #3: Payment Processor');
    console.log('');
    
    for (const tokenId of [1, 2, 3]) {
      try {
        // Try to get owner
        const owner = await contract.ownerOf(tokenId);
        console.log(`✅ Token #${tokenId} EXISTS - Owner: ${owner}`);
        
        // Try to get agent info
        try {
          const agentInfo = await contract.getAgentInfo(tokenId);
          const [walletAddress, agentCardURI, isActive] = agentInfo;
          console.log(`   Agent Wallet: ${walletAddress}`);
          console.log(`   Agent Card URI: ${agentCardURI}`);
          console.log(`   Is Active: ${isActive}`);
        } catch (infoError) {
          console.log(`   ⚠️ getAgentInfo() failed: ${(infoError as Error).message}`);
        }
      } catch (error) {
        const errorMsg = (error as Error).message;
        if (errorMsg.includes('ERC721: invalid token ID') || errorMsg.includes('nonexistent token')) {
          console.log(`❌ Token #${tokenId} DOES NOT EXIST (not minted)`);
        } else {
          console.log(`❌ Token #${tokenId} query failed: ${errorMsg.slice(0, 80)}`);
        }
      }
    }

    // 4. Check Transfer events (minting events)
    console.log('\n📍 Step 4: Check Minting Events (Transfer from 0x0)');
    try {
      const filter = contract.filters.Transfer(ethers.ZeroAddress, null, null);
      const events = await contract.queryFilter(filter, 0, 'latest');
      console.log(`Found ${events.length} minting events`);
      
      if (events.length === 0) {
        console.log('❌ No minting events found - no agents were ever minted!');
      } else {
        for (const event of events.slice(0, 10)) {
          if ('args' in event) {
            console.log(`   Token #${event.args?.tokenId} minted to ${event.args?.to}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Failed to query events: ${(error as Error).message}`);
    }

    // 5. Summary
    console.log('\n━'.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('━'.repeat(60));
    console.log('\nThe contract exists on Base mainnet, but the documented agents');
    console.log('(tokens #1, #2, #3) need to be verified. Check the output above.');
    console.log('\nNext steps:');
    console.log('1. If totalSupply = 0: No agents minted - need to mint them');
    console.log('2. If tokens exist but getAgentInfo fails: ABI mismatch');
    console.log('3. If no Transfer events: Contract deployed but never used');
    console.log('');

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
  }
}

diagnoseContract().catch(console.error);
