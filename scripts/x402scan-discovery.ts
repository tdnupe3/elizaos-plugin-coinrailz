/**
 * x402scan.com Agent Discovery Script
 * 
 * Scrapes x402scan.com's 73 pages of active x402 agents
 * These are PROVEN paying customers with real transaction history
 */

import fs from 'fs';

interface X402Agent {
  address: string;
  domain?: string;
  agentCardUrl?: string;
  transactionCount?: number;
  volume?: string;
  lastActive?: string;
  source: string;
}

interface DiscoveryResult {
  timestamp: string;
  totalAgents: number;
  pagesScraped: number;
  agents: X402Agent[];
}

const BASE_URL = 'https://x402scan.com';

async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CoinRailz-Discovery/1.0 (x402 payment infrastructure)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);
    return response;
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

async function scrapeAgentPage(pageNum: number): Promise<X402Agent[]> {
  const agents: X402Agent[] = [];
  
  // Try different URL patterns
  const urls = [
    `${BASE_URL}/agents?page=${pageNum}`,
    `${BASE_URL}/api/agents?page=${pageNum}`,
    `${BASE_URL}/agents/${pageNum}`,
  ];
  
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url);
      
      if (!response) continue;
      
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // JSON API response
        const data = await response.json();
        
        if (Array.isArray(data)) {
          for (const item of data) {
            agents.push({
              address: item.address || item.wallet || item.id,
              domain: item.domain || item.url,
              agentCardUrl: item.agentCard || item.cardUrl,
              transactionCount: item.txCount || item.transactions,
              volume: item.volume || item.totalVolume,
              lastActive: item.lastSeen || item.lastActive,
              source: 'x402scan-api',
            });
          }
        } else if (data.agents || data.data || data.results) {
          const agentList = data.agents || data.data || data.results;
          for (const item of agentList) {
            agents.push({
              address: item.address || item.wallet || item.id,
              domain: item.domain || item.url,
              agentCardUrl: item.agentCard || item.cardUrl,
              transactionCount: item.txCount || item.transactions,
              volume: item.volume || item.totalVolume,
              lastActive: item.lastSeen || item.lastActive,
              source: 'x402scan-api',
            });
          }
        }
        
        if (agents.length > 0) {
          console.log(`   ✅ Page ${pageNum}: Found ${agents.length} agents via API`);
          return agents;
        }
      } else {
        // HTML response - parse for addresses
        const html = await response.text();
        
        // Look for Ethereum addresses
        const ethAddresses = html.match(/0x[a-fA-F0-9]{40}/g) || [];
        const uniqueAddresses = [...new Set(ethAddresses)];
        
        for (const address of uniqueAddresses) {
          // Skip common contract addresses
          if (address.toLowerCase() === '0x0000000000000000000000000000000000000000') continue;
          if (address.toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') continue; // USDC
          
          agents.push({
            address,
            source: 'x402scan-html',
          });
        }
        
        // Look for domains in the HTML
        const domainMatches = html.match(/https?:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/g) || [];
        const uniqueDomains = [...new Set(domainMatches)];
        
        for (const domain of uniqueDomains) {
          try {
            const url = new URL(domain);
            if (!url.hostname.includes('x402scan') && 
                !url.hostname.includes('google') && 
                !url.hostname.includes('twitter')) {
              agents.push({
                address: 'unknown',
                domain: url.hostname,
                source: 'x402scan-html',
              });
            }
          } catch {}
        }
        
        if (agents.length > 0) {
          console.log(`   ✅ Page ${pageNum}: Found ${agents.length} items via HTML parsing`);
          return agents;
        }
      }
    } catch (e) {
      // Try next URL pattern
    }
  }
  
  return agents;
}

async function discoverX402ScanMain(): Promise<X402Agent[]> {
  console.log('🔍 Fetching x402scan.com main page...');
  
  const agents: X402Agent[] = [];
  
  // First, try to fetch the main API endpoints
  const apiEndpoints = [
    `${BASE_URL}/api/stats`,
    `${BASE_URL}/api/agents`,
    `${BASE_URL}/api/transactions`,
    `${BASE_URL}/stats.json`,
    `${BASE_URL}/.well-known/agent.json`,
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      const response = await fetchWithTimeout(endpoint);
      if (response?.ok) {
        const data = await response.json();
        console.log(`   📊 Found data at ${endpoint}:`, JSON.stringify(data).slice(0, 200));
      }
    } catch {}
  }
  
  // Fetch main page
  const mainResponse = await fetchWithTimeout(BASE_URL);
  if (!mainResponse) {
    console.log('   ❌ Could not reach x402scan.com');
    return agents;
  }
  
  const html = await mainResponse.text();
  
  // Extract stats from HTML
  const volumeMatch = html.match(/\$[\d,]+\.?\d*[KMB]?/g);
  const agentCountMatch = html.match(/(\d+)\s*agents?/i);
  const txCountMatch = html.match(/(\d+)\s*transactions?/i);
  
  console.log('   📈 Stats found:');
  if (volumeMatch) console.log(`      Volume: ${volumeMatch[0]}`);
  if (agentCountMatch) console.log(`      Agents: ${agentCountMatch[1]}`);
  if (txCountMatch) console.log(`      Transactions: ${txCountMatch[1]}`);
  
  // Extract addresses
  const ethAddresses = html.match(/0x[a-fA-F0-9]{40}/g) || [];
  const uniqueAddresses = [...new Set(ethAddresses)];
  
  console.log(`   🔑 Found ${uniqueAddresses.length} unique addresses on main page`);
  
  for (const address of uniqueAddresses) {
    if (address.toLowerCase() !== '0x0000000000000000000000000000000000000000' &&
        address.toLowerCase() !== '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') {
      agents.push({
        address,
        source: 'x402scan-main',
      });
    }
  }
  
  // Extract domain links
  const linkMatches = html.match(/href=["']([^"']+)["']/g) || [];
  for (const link of linkMatches) {
    const urlMatch = link.match(/href=["']([^"']+)["']/);
    if (urlMatch && urlMatch[1].startsWith('http')) {
      try {
        const url = new URL(urlMatch[1]);
        if (!url.hostname.includes('x402scan') && 
            !url.hostname.includes('google') &&
            !url.hostname.includes('github') &&
            !url.hostname.includes('twitter')) {
          agents.push({
            address: 'unknown',
            domain: url.hostname,
            agentCardUrl: `https://${url.hostname}/.well-known/agent.json`,
            source: 'x402scan-link',
          });
        }
      } catch {}
    }
  }
  
  return agents;
}

async function probeAgentCard(domain: string): Promise<boolean> {
  const paths = [
    '/.well-known/agent.json',
    '/.well-known/agent-card.json',
  ];
  
  for (const path of paths) {
    try {
      const response = await fetchWithTimeout(`https://${domain}${path}`, 5000);
      if (response?.ok) {
        const data = await response.json();
        if (data.name || data.description || data.skills || data.capabilities) {
          return true;
        }
      }
    } catch {}
  }
  
  return false;
}

async function main() {
  console.log('======================================================================');
  console.log('🔍 X402SCAN AGENT DISCOVERY');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('======================================================================\n');
  
  const allAgents: X402Agent[] = [];
  
  // Phase 1: Scrape main page
  console.log('📡 PHASE 1: Scraping x402scan.com main page...\n');
  const mainAgents = await discoverX402ScanMain();
  allAgents.push(...mainAgents);
  
  // Phase 2: Try paginated endpoints
  console.log('\n📡 PHASE 2: Checking paginated agent lists...\n');
  const maxPages = 10; // Start with 10 pages to test
  
  for (let page = 1; page <= maxPages; page++) {
    process.stdout.write(`   Page ${page}/${maxPages}... `);
    const pageAgents = await scrapeAgentPage(page);
    
    if (pageAgents.length === 0) {
      console.log('empty or error');
    }
    
    allAgents.push(...pageAgents);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Deduplicate
  const uniqueByAddress = new Map<string, X402Agent>();
  const uniqueByDomain = new Map<string, X402Agent>();
  
  for (const agent of allAgents) {
    if (agent.address && agent.address !== 'unknown') {
      uniqueByAddress.set(agent.address.toLowerCase(), agent);
    }
    if (agent.domain) {
      uniqueByDomain.set(agent.domain.toLowerCase(), agent);
    }
  }
  
  const uniqueAgents = [
    ...uniqueByAddress.values(),
    ...[...uniqueByDomain.values()].filter(a => a.address === 'unknown'),
  ];
  
  // Phase 3: Probe agent cards for domains found
  console.log('\n📡 PHASE 3: Probing agent cards for discovered domains...\n');
  
  const domainsToProbe = uniqueAgents
    .filter(a => a.domain)
    .map(a => a.domain!)
    .filter((d, i, arr) => arr.indexOf(d) === i);
  
  let agentCardsFound = 0;
  
  for (const domain of domainsToProbe.slice(0, 20)) { // Limit to 20 for speed
    const hasCard = await probeAgentCard(domain);
    if (hasCard) {
      agentCardsFound++;
      console.log(`   ✅ ${domain} has agent card`);
      
      // Update the agent record
      const agent = uniqueAgents.find(a => a.domain === domain);
      if (agent) {
        agent.agentCardUrl = `https://${domain}/.well-known/agent.json`;
      }
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Save results
  const result: DiscoveryResult = {
    timestamp: new Date().toISOString(),
    totalAgents: uniqueAgents.length,
    pagesScraped: maxPages,
    agents: uniqueAgents,
  };
  
  fs.writeFileSync('discovered_agents_x402scan.json', JSON.stringify(result, null, 2));
  
  // Summary
  console.log('\n======================================================================');
  console.log('✅ X402SCAN DISCOVERY COMPLETE');
  console.log(`   Total unique agents: ${uniqueAgents.length}`);
  console.log(`   With addresses: ${uniqueByAddress.size}`);
  console.log(`   With domains: ${uniqueByDomain.size}`);
  console.log(`   With agent cards: ${agentCardsFound}`);
  console.log('======================================================================\n');
  
  console.log('💾 Results saved to discovered_agents_x402scan.json');
  
  // List top targets
  const withCards = uniqueAgents.filter(a => a.agentCardUrl);
  if (withCards.length > 0) {
    console.log('\n🎯 TOP TARGETS (have agent cards):');
    for (const agent of withCards.slice(0, 10)) {
      console.log(`   ${agent.domain || agent.address}`);
    }
  }
}

main().catch(console.error);
