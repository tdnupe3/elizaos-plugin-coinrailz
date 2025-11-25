/**
 * ERC-6551 Token Bound Account Scanner for Virtuals Protocol
 * 
 * Scans the canonical ERC-6551 registry on Base to find Virtuals AI agents
 * Each Virtuals agent is an NFT + associated smart-wallet address
 */

import { ethers } from 'ethers';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const ERC6551_REGISTRY = '0x000000006551c19487814612e58FE06813775758';
const VIRTUAL_TOKEN = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b'; // VIRTUAL on Base

const ERC6551_REGISTRY_ABI = [
  'event AccountCreated(address account, address indexed implementation, bytes32 salt, uint256 chainId, address indexed tokenContract, uint256 indexed tokenId)',
  'function account(address implementation, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId) view returns (address)',
];

const ERC721_ABI = [
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function name() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

interface DiscoveredAgent {
  tokenId: string;
  owner: string;
  tokenBoundAccount?: string;
  tokenURI?: string;
  metadata?: any;
}

async function scanVirtualsAgents(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ERC-6551 Virtuals Protocol Agent Scanner');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  
  // Known Virtuals agent NFT contracts on Base
  const virtualsContracts = [
    { address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', name: 'VIRTUAL Token' },
    { address: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825', name: 'AIXBT' },
    { address: '0x55cd6469f597452b5a7536e2cd98fde4c1247ee4', name: 'Luna' },
  ];
  
  const registry = new ethers.Contract(ERC6551_REGISTRY, ERC6551_REGISTRY_ABI, provider);
  const allAgents: DiscoveredAgent[] = [];
  
  console.log('📡 Scanning ERC-6551 AccountCreated events...\n');
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000; // Last ~10k blocks (about 5 hours on Base)
    
    console.log(`Scanning blocks ${fromBlock} to ${currentBlock}...`);
    
    const filter = registry.filters.AccountCreated();
    const events = await registry.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} AccountCreated events\n`);
    
    for (const event of events) {
      if ('args' in event && event.args) {
        const [account, implementation, salt, chainId, tokenContract, tokenId] = event.args;
        
        allAgents.push({
          tokenId: tokenId.toString(),
          owner: account,
          tokenBoundAccount: account,
          metadata: {
            implementation,
            salt,
            chainId: chainId.toString(),
            tokenContract,
            blockNumber: event.blockNumber,
          }
        });
        
        console.log(`✅ TBA Created: ${account.slice(0, 10)}... for token ${tokenContract.slice(0, 10)}...#${tokenId}`);
      }
    }
    
  } catch (error) {
    console.error('⚠️ Event scan limited:', error);
  }
  
  // Also check known high-value Virtuals agents by looking at top holders
  console.log('\n📊 Checking top Virtuals token holders...\n');
  
  try {
    // Get VIRTUAL token contract
    const virtualToken = new ethers.Contract(VIRTUAL_TOKEN, [
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
    ], provider);
    
    const totalSupply = await virtualToken.totalSupply();
    console.log(`VIRTUAL Total Supply: ${ethers.formatEther(totalSupply)}`);
    
  } catch (error) {
    console.log('⚠️ Could not query VIRTUAL token:', error);
  }
  
  // Save discovered agents to database
  console.log(`\n💾 Saving ${allAgents.length} discovered agents to database...`);
  
  for (const agent of allAgents) {
    try {
      await db.execute(sql`
        INSERT INTO bot_wallets (address, chain, category, subcategory, name, source, contactable, verified, metadata)
        VALUES (
          ${agent.tokenBoundAccount || agent.owner},
          'base',
          'AI_AGENT',
          'erc6551_tba',
          ${`Virtuals TBA #${agent.tokenId}`},
          'erc6551-scanner',
          true,
          true,
          ${JSON.stringify(agent.metadata)}
        )
        ON CONFLICT (address) DO NOTHING
      `);
    } catch (error) {
      // Ignore duplicates
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`Scan Complete: ${allAgents.length} agents found`);
  console.log('='.repeat(60));
}

// Run scanner
scanVirtualsAgents().catch(console.error);
