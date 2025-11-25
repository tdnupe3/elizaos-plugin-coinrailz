#!/usr/bin/env npx tsx
/**
 * ERC-8004 On-Chain Agent Registry Scanner
 * Scans blockchain for registered AI agents using the ERC-8004 standard
 * 
 * ERC-8004 agents are ERC-721 tokens whose tokenURI points to agent registration JSON
 */

import { ethers } from 'ethers';
import fs from 'fs';

const ERC8004_IDENTITY_REGISTRY_ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const ERC721_ENUMERABLE_ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

const KNOWN_ERC8004_REGISTRIES = [
  {
    chain: 'base',
    name: 'Coin Railz Identity Registry',
    address: '0xdE951fb947a01187919c484f237627B5c685D459',
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  },
];

const CHAINS_TO_SCAN = [
  {
    name: 'base',
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'demo'}`,
    explorerApiUrl: 'https://api.basescan.org/api',
    explorerApiKey: process.env.BASESCAN_API_KEY || '',
  },
  {
    name: 'ethereum',
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'demo'}`,
    explorerApiUrl: 'https://api.etherscan.io/api',
    explorerApiKey: process.env.ETHERSCAN_API_KEY || '',
  },
];

interface DiscoveredAgent {
  source: string;
  chain: string;
  registryAddress: string;
  tokenId: string;
  owner: string;
  tokenURI?: string;
  metadata?: any;
}

async function fetchMetadata(uri: string): Promise<any> {
  if (!uri) return null;
  
  let fetchUrl = uri;
  if (uri.startsWith('ipfs://')) {
    fetchUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  
  try {
    const response = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'CoinRailz-ERC8004-Scanner/1.0' },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log(`⚠️ Could not fetch metadata from ${uri}`);
  }
  return null;
}

async function scanRegistry(
  provider: ethers.JsonRpcProvider,
  registryAddress: string,
  chainName: string
): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  
  try {
    const contract = new ethers.Contract(registryAddress, ERC721_ENUMERABLE_ABI, provider);
    
    let name = 'Unknown';
    let symbol = 'AGENT';
    try {
      name = await contract.name();
      symbol = await contract.symbol();
      console.log(`📋 Registry: ${name} (${symbol}) at ${registryAddress}`);
    } catch (e) {
      console.log(`📋 Registry at ${registryAddress} (name/symbol unavailable)`);
    }
    
    let totalSupply = 0n;
    try {
      totalSupply = await contract.totalSupply();
      console.log(`   Total tokens: ${totalSupply.toString()}`);
    } catch (e) {
      console.log('   Could not get total supply, scanning by events...');
      return await scanByEvents(provider, registryAddress, chainName);
    }
    
    const maxToScan = Math.min(Number(totalSupply), 100);
    
    for (let i = 0; i < maxToScan; i++) {
      try {
        const tokenId = await contract.tokenByIndex(i);
        const owner = await contract.ownerOf(tokenId);
        let tokenURI = '';
        
        try {
          tokenURI = await contract.tokenURI(tokenId);
        } catch (e) {
          // Token URI not available
        }
        
        const metadata = tokenURI ? await fetchMetadata(tokenURI) : null;
        
        discovered.push({
          source: 'erc8004_enumerable',
          chain: chainName,
          registryAddress,
          tokenId: tokenId.toString(),
          owner,
          tokenURI,
          metadata,
        });
        
        console.log(`   ✅ Token #${tokenId}: owner=${owner.slice(0, 10)}...`);
      } catch (e) {
        console.log(`   ⚠️ Could not fetch token at index ${i}`);
      }
    }
  } catch (e) {
    console.log(`⚠️ Error scanning registry ${registryAddress}: ${e}`);
  }
  
  return discovered;
}

async function scanByEvents(
  provider: ethers.JsonRpcProvider,
  registryAddress: string,
  chainName: string
): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  
  try {
    const contract = new ethers.Contract(registryAddress, ERC8004_IDENTITY_REGISTRY_ABI, provider);
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000);
    
    console.log(`   Scanning events from block ${fromBlock} to ${currentBlock}...`);
    
    const filter = contract.filters.Transfer();
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);
    
    const seenTokens = new Set<string>();
    
    for (const event of events) {
      if ('args' in event && event.args) {
        const tokenId = event.args.tokenId?.toString() || event.args[2]?.toString();
        
        if (tokenId && !seenTokens.has(tokenId)) {
          seenTokens.add(tokenId);
          
          try {
            const owner = await contract.ownerOf(tokenId);
            let tokenURI = '';
            
            try {
              tokenURI = await contract.tokenURI(tokenId);
            } catch (e) {}
            
            const metadata = tokenURI ? await fetchMetadata(tokenURI) : null;
            
            discovered.push({
              source: 'erc8004_events',
              chain: chainName,
              registryAddress,
              tokenId,
              owner,
              tokenURI,
              metadata,
            });
            
            console.log(`   ✅ Token #${tokenId} (from events)`);
          } catch (e) {
            // Token may have been burned
          }
        }
      }
    }
    
    console.log(`   Found ${discovered.length} tokens via events`);
  } catch (e) {
    console.log(`   ⚠️ Event scanning failed: ${e}`);
  }
  
  return discovered;
}

async function discoverRegistriesViaExplorer(chain: typeof CHAINS_TO_SCAN[0]): Promise<string[]> {
  const registries: string[] = [];
  
  if (!chain.explorerApiKey) {
    console.log(`   No API key for ${chain.name} explorer`);
    return registries;
  }
  
  try {
    const searchTerms = ['AgentRegistry', 'IdentityRegistry', 'ERC8004', 'TrustlessAgent'];
    
    for (const term of searchTerms) {
      const url = `${chain.explorerApiUrl}?module=contract&action=listcontracts&filter=verified&sort=desc&apikey=${chain.explorerApiKey}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.result && Array.isArray(data.result)) {
          for (const contract of data.result) {
            if (contract.ContractName?.includes(term) || contract.ContractName?.includes('Agent')) {
              registries.push(contract.Address);
              console.log(`   Found potential registry: ${contract.ContractName} at ${contract.Address}`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(`   Explorer API query failed for ${chain.name}`);
  }
  
  return registries;
}

async function main() {
  console.log('='.repeat(60));
  console.log('ERC-8004 On-Chain Agent Registry Scanner');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  const allDiscovered: DiscoveredAgent[] = [];
  
  console.log('\n📡 Phase 1: Scanning known ERC-8004 registries...');
  for (const registry of KNOWN_ERC8004_REGISTRIES) {
    console.log(`\n🔗 Chain: ${registry.chain}`);
    
    try {
      const provider = new ethers.JsonRpcProvider(registry.rpcUrl);
      const agents = await scanRegistry(provider, registry.address, registry.chain);
      allDiscovered.push(...agents);
    } catch (e) {
      console.log(`⚠️ Could not connect to ${registry.chain}`);
    }
  }
  
  console.log('\n📡 Phase 2: Discovering registries via block explorers...');
  for (const chain of CHAINS_TO_SCAN) {
    console.log(`\n🔗 Chain: ${chain.name}`);
    
    const potentialRegistries = await discoverRegistriesViaExplorer(chain);
    
    if (potentialRegistries.length > 0) {
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      
      for (const registryAddr of potentialRegistries.slice(0, 5)) {
        const agents = await scanRegistry(provider, registryAddr, chain.name);
        allDiscovered.push(...agents);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`Scan Complete: ${allDiscovered.length} agents found on-chain`);
  console.log('='.repeat(60));
  
  const output = {
    timestamp: new Date().toISOString(),
    totalFound: allDiscovered.length,
    agents: allDiscovered,
    scannedRegistries: KNOWN_ERC8004_REGISTRIES.map(r => ({
      chain: r.chain,
      address: r.address,
      name: r.name,
    })),
  };
  
  const outputFile = 'discovered_agents_onchain.json';
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${outputFile}`);
  
  const byChain: Record<string, number> = {};
  for (const agent of allDiscovered) {
    byChain[agent.chain] = (byChain[agent.chain] || 0) + 1;
  }
  
  console.log('\n📊 Summary by chain:');
  for (const [chain, count] of Object.entries(byChain)) {
    console.log(`  - ${chain}: ${count} agents`);
  }
  
  return allDiscovered;
}

main().catch(console.error);
