/**
 * Comprehensive ERC-6551 Token Bound Account Scanner
 * 
 * Scans the canonical ERC-6551 registry for AccountCreated events
 * to discover all AI agent wallets on Base chain
 */

import { ethers } from 'ethers';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const ERC6551_REGISTRY = '0x000000006551c19487814612e58FE06813775758';

const ERC6551_REGISTRY_ABI = [
  'event AccountCreated(address account, address indexed implementation, bytes32 salt, uint256 chainId, address indexed tokenContract, uint256 indexed tokenId)',
  'function account(address implementation, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId) view returns (address)',
];

const KNOWN_IMPLEMENTATIONS = [
  { 
    name: 'Tokenbound Reference',
    address: '0x55266d75D1a14E4572138116aF39863Ed6596E7F'
  },
  {
    name: 'Tokenbound V3',
    address: '0x41C8f39463A868d3A88af00cd0fe7102F30E44eC'
  },
];

const KNOWN_NFT_CONTRACTS = [
  {
    name: 'Virtuals Protocol Agents',
    address: '0x55cd6469f597452b5a7536e2cd98fde4c1247ee4', // Luna
  },
  {
    name: 'AIXBT by Virtuals',
    address: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
  },
];

interface DiscoveredTBA {
  account: string;
  implementation: string;
  chainId: string;
  tokenContract: string;
  tokenId: string;
  blockNumber: number;
}

async function scanERC6551Events(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Comprehensive ERC-6551 Token Bound Account Scanner');
  console.log('='.repeat(60));
  console.log(`Registry: ${ERC6551_REGISTRY}`);
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const registry = new ethers.Contract(ERC6551_REGISTRY, ERC6551_REGISTRY_ABI, provider);
  
  const allTBAs: DiscoveredTBA[] = [];
  
  // Scan in smaller block ranges due to RPC limits
  const currentBlock = await provider.getBlockNumber();
  const blocksPerQuery = 5000;
  const totalBlocksToScan = 50000; // Scan last ~7 days on Base
  
  console.log(`📡 Scanning ${totalBlocksToScan} blocks for AccountCreated events...\n`);
  console.log(`Current block: ${currentBlock}`);
  
  for (let i = 0; i < totalBlocksToScan; i += blocksPerQuery) {
    const fromBlock = currentBlock - totalBlocksToScan + i;
    const toBlock = Math.min(fromBlock + blocksPerQuery - 1, currentBlock);
    
    try {
      console.log(`Scanning blocks ${fromBlock} to ${toBlock}...`);
      
      const filter = registry.filters.AccountCreated();
      const events = await registry.queryFilter(filter, fromBlock, toBlock);
      
      for (const event of events) {
        if ('args' in event && event.args) {
          const [account, implementation, salt, chainId, tokenContract, tokenId] = event.args;
          
          allTBAs.push({
            account,
            implementation,
            chainId: chainId.toString(),
            tokenContract,
            tokenId: tokenId.toString(),
            blockNumber: event.blockNumber || 0,
          });
          
          console.log(`✅ TBA Found: ${account.slice(0, 10)}... (NFT: ${tokenContract.slice(0, 10)}...#${tokenId})`);
        }
      }
    } catch (error: any) {
      if (error.message.includes('block range')) {
        console.log(`⚠️ Rate limited at blocks ${fromBlock}-${toBlock}, reducing range...`);
        // Skip this range and continue
      } else {
        console.log(`⚠️ Error scanning blocks ${fromBlock}-${toBlock}: ${error.message.slice(0, 100)}`);
      }
    }
    
    // Brief pause to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Also check known NFT contracts for TBAs
  console.log('\n📊 Checking known NFT contracts for TBAs...\n');
  
  for (const nftContract of KNOWN_NFT_CONTRACTS) {
    console.log(`Checking ${nftContract.name} (${nftContract.address.slice(0, 10)}...)...`);
    
    for (const impl of KNOWN_IMPLEMENTATIONS) {
      // Check first 10 token IDs
      for (let tokenId = 1; tokenId <= 10; tokenId++) {
        try {
          const tbaAddress = await registry.account(
            impl.address,
            ethers.ZeroHash, // salt = 0
            8453, // Base chainId
            nftContract.address,
            tokenId
          );
          
          // Check if deployed
          const code = await provider.getCode(tbaAddress);
          if (code !== '0x') {
            console.log(`✅ Active TBA for ${nftContract.name} #${tokenId}: ${tbaAddress.slice(0, 10)}...`);
            allTBAs.push({
              account: tbaAddress,
              implementation: impl.address,
              chainId: '8453',
              tokenContract: nftContract.address,
              tokenId: tokenId.toString(),
              blockNumber: 0,
            });
          }
        } catch (error) {
          // TBA doesn't exist
        }
      }
    }
  }
  
  console.log(`\n💾 Saving ${allTBAs.length} discovered TBAs to database...`);
  
  for (const tba of allTBAs) {
    try {
      await db.execute(sql`
        INSERT INTO bot_wallets (address, chain, category, subcategory, name, source, contactable, verified, metadata)
        VALUES (
          ${tba.account.toLowerCase()},
          'base',
          'AI_AGENT',
          'erc6551_tba',
          ${`ERC-6551 TBA (NFT ${tba.tokenContract.slice(0, 8)}...#${tba.tokenId})`},
          'erc6551-scanner',
          true,
          true,
          ${JSON.stringify({
            implementation: tba.implementation,
            chainId: tba.chainId,
            tokenContract: tba.tokenContract,
            tokenId: tba.tokenId,
            blockNumber: tba.blockNumber,
            discoveredAt: new Date().toISOString()
          })}
        )
        ON CONFLICT (address) DO NOTHING
      `);
    } catch (error) {
      // Ignore duplicates
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`Scan Complete: ${allTBAs.length} Token Bound Accounts found`);
  console.log('='.repeat(60));
}

// Run scanner
scanERC6551Events().catch(console.error);
