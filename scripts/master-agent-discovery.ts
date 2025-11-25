#!/usr/bin/env npx tsx
/**
 * Master Agent Discovery Tool
 * Combines multiple discovery methods:
 * 1. A2A SDK discovery (agent cards, registries)
 * 2. x402 endpoint probing (402 responses)
 * 3. x402scan API scraping
 * 4. Shodan/Censys search (if API keys available)
 * 5. ERC-8004 on-chain scanning
 * 6. Domain enumeration with subdomain patterns
 */

import { A2AClient } from '@a2a-js/sdk';
import { ethers } from 'ethers';
import fs from 'fs';

interface DiscoveredAgent {
  source: string;
  type: string;
  domain?: string;
  url?: string;
  chain?: string;
  address?: string;
  data?: any;
  score?: number;
  discoveredAt: string;
}

const DISCOVERY_SOURCES = {
  x402scan: 'x402scan.com',
  a2a_probe: 'Domain probing for agent-card.json',
  x402_probe: 'Domain probing for 402 responses',
  shodan: 'Shodan search',
  censys: 'Censys search',
  erc8004: 'On-chain ERC-8004 registry',
  github: 'GitHub code search',
};

const KNOWN_X402_DOMAINS = [
  'api.snack.money',
  'x402.arvos.xyz',
  'api.barvis.io',
  'api.jiren.ai',
  'api.dexter.cash',
  'api.canza.app',
  'x402-secure-api.t54.ai',
  'x402.lucyos.ai',
  'ainalyst-api.xyz',
  'pay.lnpay.ai',
  'mesh.heurist.xyz',
  'acp-x402.virtuals.io',
  'wurkapi.fun',
  'agents.memeputer.com',
  'firecrawl.dev',
  'otaku.so',
  'www.reap.deals',
  'www.qrbase.xyz',
  'gloria.ai',
  'aimo.network',
  'eigencloud.io',
  'mcpay.io',
];

const SUBDOMAIN_PATTERNS = ['agent', 'ai', 'api', 'a2a', 'x402', 'bot', 'agents', 'mcp', 'service'];

const BASE_DOMAINS_TO_ENUMERATE = [
  'heurist.xyz',
  'virtuals.io',
  'daydreams.ai',
  'artinet.io',
  'coinbase.com',
  'base.org',
  'eigenlayer.xyz',
];

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'CoinRailz-MasterDiscovery/1.0 (AI Agent Discovery Bot)',
        'Accept': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    return null;
  }
}

async function probeAgentCard(domain: string): Promise<DiscoveredAgent | null> {
  const urls = [
    `https://${domain}/.well-known/agent-card.json`,
    `https://${domain}/.well-known/agent.json`,
  ];
  
  for (const url of urls) {
    const response = await fetchWithTimeout(url);
    if (response?.ok) {
      try {
        const data = await response.json();
        return {
          source: 'a2a_probe',
          type: 'agent_card',
          domain,
          url,
          data,
          discoveredAt: new Date().toISOString(),
        };
      } catch (e) {}
    }
  }
  return null;
}

async function probeX402Endpoint(domain: string): Promise<DiscoveredAgent | null> {
  const endpoints = [
    `https://${domain}/`,
    `https://${domain}/api`,
    `https://${domain}/ping`,
    `https://${domain}/x402`,
  ];
  
  for (const url of endpoints) {
    const response = await fetchWithTimeout(url, { method: 'POST' });
    if (response?.status === 402) {
      try {
        const data = await response.json();
        if (data.x402Version || data.accepts) {
          return {
            source: 'x402_probe',
            type: 'x402_endpoint',
            domain,
            url,
            data,
            discoveredAt: new Date().toISOString(),
          };
        }
      } catch (e) {}
    }
  }
  return null;
}

async function scrapex402Scan(): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  
  const response = await fetchWithTimeout('https://www.x402scan.com/api/servers');
  if (response?.ok) {
    try {
      const data = await response.json();
      if (Array.isArray(data)) {
        for (const server of data) {
          discovered.push({
            source: 'x402scan',
            type: 'x402_server',
            domain: server.domain || server.host || server.address,
            data: server,
            score: server.volume || server.txns || 0,
            discoveredAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {}
  }
  
  return discovered;
}

async function searchShodan(): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  const shodanApiKey = process.env.SHODAN_API_KEY;
  
  if (!shodanApiKey) {
    console.log('⚠️ No SHODAN_API_KEY set, skipping Shodan search');
    return discovered;
  }
  
  const queries = [
    'agent-card.json',
    'x402Version',
    'A2A protocol',
    'agent card json',
  ];
  
  for (const query of queries) {
    try {
      const url = `https://api.shodan.io/shodan/host/search?key=${shodanApiKey}&query=${encodeURIComponent(query)}`;
      const response = await fetchWithTimeout(url, {}, 15000);
      
      if (response?.ok) {
        const data = await response.json();
        if (data.matches) {
          for (const match of data.matches) {
            discovered.push({
              source: 'shodan',
              type: 'network_scan',
              domain: match.hostnames?.[0] || match.ip_str,
              data: {
                ip: match.ip_str,
                port: match.port,
                org: match.org,
                asn: match.asn,
              },
              discoveredAt: new Date().toISOString(),
            });
          }
        }
        console.log(`🔍 Shodan query "${query}": ${data.matches?.length || 0} results`);
      }
    } catch (e) {
      console.log(`⚠️ Shodan query failed: ${e}`);
    }
  }
  
  return discovered;
}

async function searchGitHub(): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  const githubToken = process.env.GITHUB_TOKEN;
  
  const queries = [
    'x402 payment agent',
    '@coinbase/x402',
    'X-PAYMENT header',
    'agent-card.json',
    'A2A protocol agent',
    'x402Version',
  ];
  
  for (const query of queries) {
    try {
      const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=30`;
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
      };
      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }
      
      const response = await fetchWithTimeout(url, { headers }, 15000);
      
      if (response?.ok) {
        const data = await response.json();
        if (data.items) {
          for (const item of data.items) {
            discovered.push({
              source: 'github',
              type: 'code_search',
              url: item.html_url,
              data: {
                repo: item.repository?.full_name,
                path: item.path,
                score: item.score,
              },
              discoveredAt: new Date().toISOString(),
            });
          }
        }
        console.log(`🔍 GitHub query "${query.slice(0, 20)}...": ${data.items?.length || 0} results`);
      }
      
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(`⚠️ GitHub query failed: ${e}`);
    }
  }
  
  return discovered;
}

async function scanERC8004(): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  
  if (!alchemyKey) {
    console.log('⚠️ No ALCHEMY_API_KEY set, skipping ERC-8004 scan');
    return discovered;
  }
  
  const registries = [
    {
      chain: 'base',
      address: '0xdE951fb947a01187919c484f237627B5c685D459',
      rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    },
  ];
  
  for (const registry of registries) {
    try {
      const provider = new ethers.JsonRpcProvider(registry.rpcUrl);
      const contract = new ethers.Contract(
        registry.address,
        [
          'function totalSupply() view returns (uint256)',
          'function tokenByIndex(uint256 index) view returns (uint256)',
          'function tokenURI(uint256 tokenId) view returns (string)',
          'function ownerOf(uint256 tokenId) view returns (address)',
        ],
        provider
      );
      
      const totalSupply = await contract.totalSupply();
      console.log(`🔗 ERC-8004 Registry on ${registry.chain}: ${totalSupply.toString()} tokens`);
      
      const maxToScan = Math.min(Number(totalSupply), 50);
      
      for (let i = 0; i < maxToScan; i++) {
        try {
          const tokenId = await contract.tokenByIndex(i);
          const owner = await contract.ownerOf(tokenId);
          
          discovered.push({
            source: 'erc8004',
            type: 'onchain_agent',
            chain: registry.chain,
            address: registry.address,
            data: {
              tokenId: tokenId.toString(),
              owner,
            },
            discoveredAt: new Date().toISOString(),
          });
        } catch (e) {}
      }
    } catch (e) {
      console.log(`⚠️ ERC-8004 scan failed: ${e}`);
    }
  }
  
  return discovered;
}

async function enumerateSubdomains(): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  const domainsToProbe: string[] = [];
  
  for (const baseDomain of BASE_DOMAINS_TO_ENUMERATE) {
    for (const pattern of SUBDOMAIN_PATTERNS) {
      domainsToProbe.push(`${pattern}.${baseDomain}`);
    }
  }
  
  console.log(`🔍 Probing ${domainsToProbe.length} subdomain combinations...`);
  
  const results = await Promise.allSettled(
    domainsToProbe.map(async domain => {
      const card = await probeAgentCard(domain);
      const x402 = await probeX402Endpoint(domain);
      return [card, x402].filter(Boolean);
    })
  );
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      discovered.push(...(result.value as DiscoveredAgent[]));
    }
  }
  
  return discovered;
}

async function main() {
  console.log('='.repeat(70));
  console.log('🔍 MASTER AGENT DISCOVERY TOOL');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
  
  const allDiscovered: DiscoveredAgent[] = [];
  
  console.log('\n📡 PHASE 1: Probing known x402 domains...');
  const knownDomainResults = await Promise.allSettled(
    KNOWN_X402_DOMAINS.flatMap(domain => [
      probeAgentCard(domain),
      probeX402Endpoint(domain),
    ])
  );
  for (const result of knownDomainResults) {
    if (result.status === 'fulfilled' && result.value) {
      allDiscovered.push(result.value);
    }
  }
  console.log(`   Found: ${allDiscovered.length} agents/endpoints`);
  
  console.log('\n📡 PHASE 2: Querying x402scan API...');
  const x402scanAgents = await scrapex402Scan();
  allDiscovered.push(...x402scanAgents);
  console.log(`   Found: ${x402scanAgents.length} servers from x402scan`);
  
  console.log('\n📡 PHASE 3: Subdomain enumeration...');
  const subdomainAgents = await enumerateSubdomains();
  allDiscovered.push(...subdomainAgents);
  console.log(`   Found: ${subdomainAgents.length} agents via subdomains`);
  
  console.log('\n📡 PHASE 4: Searching Shodan...');
  const shodanAgents = await searchShodan();
  allDiscovered.push(...shodanAgents);
  console.log(`   Found: ${shodanAgents.length} results from Shodan`);
  
  console.log('\n📡 PHASE 5: Searching GitHub...');
  const githubAgents = await searchGitHub();
  allDiscovered.push(...githubAgents);
  console.log(`   Found: ${githubAgents.length} code references from GitHub`);
  
  console.log('\n📡 PHASE 6: Scanning ERC-8004 registries...');
  const onchainAgents = await scanERC8004();
  allDiscovered.push(...onchainAgents);
  console.log(`   Found: ${onchainAgents.length} on-chain agents`);
  
  const uniqueAgents = Array.from(
    new Map(
      allDiscovered.map(a => [a.domain || a.url || a.address || JSON.stringify(a.data), a])
    ).values()
  );
  
  console.log('\n' + '='.repeat(70));
  console.log(`✅ DISCOVERY COMPLETE`);
  console.log(`   Total raw: ${allDiscovered.length}`);
  console.log(`   Unique:    ${uniqueAgents.length}`);
  console.log('='.repeat(70));
  
  const bySource: Record<string, number> = {};
  for (const agent of uniqueAgents) {
    bySource[agent.source] = (bySource[agent.source] || 0) + 1;
  }
  
  console.log('\n📊 BY SOURCE:');
  for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${source}: ${count}`);
  }
  
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      totalRaw: allDiscovered.length,
      totalUnique: uniqueAgents.length,
      bySource,
    },
    agents: uniqueAgents.sort((a, b) => (b.score || 0) - (a.score || 0)),
  };
  
  const outputFile = 'discovered_agents_master.json';
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${outputFile}`);
  
  console.log('\n🎯 HIGH-VALUE TARGETS (potential customers):');
  const highValue = uniqueAgents
    .filter(a => a.type === 'x402_endpoint' || a.type === 'agent_card' || a.type === 'x402_server')
    .slice(0, 10);
  
  for (const agent of highValue) {
    console.log(`   - ${agent.domain || agent.url} (${agent.source})`);
  }
  
  return uniqueAgents;
}

main().catch(console.error);
