import { ethers } from 'ethers';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';

const VBA_CONTRACT = '0x5afda9b5d34e7fbd42f87dd46beffe4497d69988';
const BATCH_SIZE = 50;

const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

interface AgentHolder {
  address: string;
  tokenIds: number[];
  tokenCount: number;
}

async function scanVirtualsAgents() {
  console.log('============================================================');
  console.log('Virtuals Protocol Agent Scanner');
  console.log('VBA Contract:', VBA_CONTRACT);
  console.log('Started:', new Date().toISOString());
  console.log('============================================================\n');

  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const contract = new ethers.Contract(VBA_CONTRACT, ERC721_ABI, provider);

  const name = await contract.name();
  const symbol = await contract.symbol();
  const totalSupply = await contract.totalSupply();

  console.log('📊 Contract Info:');
  console.log('  Name:', name);
  console.log('  Symbol:', symbol);
  console.log('  Total Supply:', totalSupply.toString());
  console.log('');

  const maxTokenId = Number(totalSupply);
  const holders = new Map<string, number[]>();
  let foundTokens = 0;
  let errors = 0;

  console.log(`📋 Scanning ${maxTokenId} token IDs for owners...`);
  console.log('(This may take several minutes)\n');

  for (let startId = 1; startId <= maxTokenId; startId += BATCH_SIZE) {
    const endId = Math.min(startId + BATCH_SIZE - 1, maxTokenId);
    const promises: Promise<{ tokenId: number; owner: string | null }>[] = [];

    for (let tokenId = startId; tokenId <= endId; tokenId++) {
      promises.push(
        contract.ownerOf(tokenId)
          .then((owner: string) => ({ tokenId, owner }))
          .catch(() => ({ tokenId, owner: null }))
      );
    }

    const results = await Promise.all(promises);

    for (const { tokenId, owner } of results) {
      if (owner) {
        foundTokens++;
        const lowerOwner = owner.toLowerCase();
        if (!holders.has(lowerOwner)) {
          holders.set(lowerOwner, []);
        }
        holders.get(lowerOwner)!.push(tokenId);
      } else {
        errors++;
      }
    }

    const progress = Math.round((endId / maxTokenId) * 100);
    process.stdout.write(`\rProgress: ${progress}% (${foundTokens} tokens found, ${holders.size} unique holders)`);

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n\n============================================================');
  console.log('SCAN RESULTS');
  console.log('============================================================');
  console.log(`Total Tokens Found: ${foundTokens}`);
  console.log(`Unique Holders: ${holders.size}`);
  console.log(`Errors: ${errors}`);

  const sortedHolders: AgentHolder[] = Array.from(holders.entries())
    .map(([address, tokenIds]) => ({
      address,
      tokenIds,
      tokenCount: tokenIds.length
    }))
    .sort((a, b) => b.tokenCount - a.tokenCount);

  console.log('\n📊 Top 20 Holders (by agent count):');
  for (let i = 0; i < Math.min(20, sortedHolders.length); i++) {
    const holder = sortedHolders[i];
    console.log(`  ${i + 1}. ${holder.address}: ${holder.tokenCount} agents`);
  }

  console.log('\n💾 Saving to database...');
  let saved = 0;
  let skipped = 0;

  for (const holder of sortedHolders) {
    if (holder.tokenCount >= 1) {
      try {
        await db.insert(discoveredAgents).values({
          url: `https://basescan.org/address/${holder.address}`,
          source: 'virtuals-agent-holder',
          wallet: holder.address,
          capabilities: { agent_holder: true },
          metadata: {
            source: 'VBA NFT scan',
            tokenIds: holder.tokenIds,
            agentCount: holder.tokenCount,
            contractAddress: VBA_CONTRACT,
            scannedAt: new Date().toISOString()
          }
        }).onConflictDoNothing();
        saved++;
      } catch (e) {
        skipped++;
      }
    }
  }

  console.log(`✅ Saved ${saved} new holders to database`);
  console.log(`⏭️ Skipped ${skipped} (already exist or error)`);

  console.log('\n============================================================');
  console.log('Scan Complete!');
  console.log('============================================================');

  return sortedHolders;
}

scanVirtualsAgents()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
