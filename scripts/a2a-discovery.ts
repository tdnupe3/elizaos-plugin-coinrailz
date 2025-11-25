#!/usr/bin/env npx tsx
/**
 * A2A Agent Discovery Tool (Node.js)
 * Uses @a2a-js/sdk for agent discovery
 * Includes domain probing, x402 detection, and registry queries
 */

import { A2AClient } from '@a2a-js/sdk';
import fs from 'fs';

interface DiscoveredAgent {
  source: string;
  type?: string;
  domain?: string;
  url?: string;
  card?: any;
  x402Data?: any;
  agent?: any;
  registry?: string;
}

const KNOWN_AGENT_DOMAINS = [
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
];

const x402SCAN_TOP_SERVERS = [
  { domain: 'pay.lnpay.ai', volume: 7450, txns: 613800 },
  { domain: 'api.barvis.io', volume: 24190, txns: 401500 },
  { domain: 'x402.arvos.xyz', volume: 237660, txns: 382020 },
  { domain: 'x402-secure-api.t54.ai', volume: 52, txns: 368340 },
  { domain: 'api.jiren.ai', volume: 3480, txns: 348220 },
  { domain: 'api.canza.app', volume: 16350, txns: 293420 },
  { domain: 'api.dexter.cash', volume: 33940, txns: 198080 },
];

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'CoinRailz-AgentDiscovery/1.0',
        ...options.headers,
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchAgentCard(domain: string): Promise<DiscoveredAgent | null> {
  const urlsToTry = [
    `https://${domain}/.well-known/agent-card.json`,
    `https://${domain}/.well-known/agent.json`,
  ];
  
  for (const url of urlsToTry) {
    try {
      const response = await fetchWithTimeout(url);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found agent card at ${url}`);
        return { source: 'domain_probe', type: 'agent_card', domain, url, card: data };
      }
    } catch (e) {
      // Ignore errors
    }
  }
  return null;
}

async function probeFor402(domain: string): Promise<DiscoveredAgent | null> {
  const endpointsToTry = [
    `https://${domain}/`,
    `https://${domain}/api`,
    `https://${domain}/ping`,
  ];
  
  for (const url of endpointsToTry) {
    try {
      const response = await fetchWithTimeout(url, { method: 'POST' });
      if (response.status === 402) {
        const data = await response.json();
        if (data.x402Version || data.accepts) {
          console.log(`💰 Found x402 endpoint at ${url}`);
          return { source: 'domain_probe', type: 'x402_endpoint', domain, url, x402Data: data };
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  return null;
}

async function discoverViaA2ASDK(): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  
  for (const serverInfo of x402SCAN_TOP_SERVERS) {
    try {
      const client = new A2AClient(`https://${serverInfo.domain}`);
      
      try {
        const agentCard = await client.agentCard();
        if (agentCard) {
          console.log(`🤖 A2A SDK found agent at ${serverInfo.domain}`);
          discovered.push({
            source: 'a2a_sdk',
            type: 'a2a_agent',
            domain: serverInfo.domain,
            agent: agentCard,
          });
        }
      } catch (e) {
        // Agent card fetch failed, try basic probe
      }
    } catch (e) {
      console.log(`⚠️ Could not connect to ${serverInfo.domain}`);
    }
  }
  
  return discovered;
}

async function scrapex402ScanServers(): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];
  
  try {
    const response = await fetchWithTimeout('https://www.x402scan.com/api/servers', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        for (const server of data) {
          discovered.push({
            source: 'x402scan_api',
            type: 'x402_server',
            domain: server.domain || server.host,
            agent: server,
          });
        }
        console.log(`📊 x402scan API returned ${data.length} servers`);
      }
    }
  } catch (e) {
    console.log('⚠️ x402scan API not accessible, using cached data');
    for (const server of x402SCAN_TOP_SERVERS) {
      discovered.push({
        source: 'x402scan_cache',
        type: 'x402_server',
        domain: server.domain,
        agent: server,
      });
    }
  }
  
  return discovered;
}

async function main() {
  console.log('='.repeat(60));
  console.log('A2A Agent Discovery Tool (Node.js)');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  const allDiscovered: DiscoveredAgent[] = [];
  
  console.log('\n📡 Phase 1: Probing known agent domains for agent cards...');
  const cardResults = await Promise.allSettled(
    KNOWN_AGENT_DOMAINS.map(domain => fetchAgentCard(domain))
  );
  for (const result of cardResults) {
    if (result.status === 'fulfilled' && result.value) {
      allDiscovered.push(result.value);
    }
  }
  
  console.log('\n📡 Phase 2: Probing for x402 endpoints...');
  const x402Results = await Promise.allSettled(
    KNOWN_AGENT_DOMAINS.map(domain => probeFor402(domain))
  );
  for (const result of x402Results) {
    if (result.status === 'fulfilled' && result.value) {
      allDiscovered.push(result.value);
    }
  }
  
  console.log('\n📡 Phase 3: Using A2A SDK for discovery...');
  const sdkAgents = await discoverViaA2ASDK();
  allDiscovered.push(...sdkAgents);
  
  console.log('\n📡 Phase 4: Scraping x402scan for active servers...');
  const x402scanAgents = await scrapex402ScanServers();
  allDiscovered.push(...x402scanAgents);
  
  console.log('\n' + '='.repeat(60));
  console.log(`Discovery Complete: ${allDiscovered.length} agents/endpoints found`);
  console.log('='.repeat(60));
  
  const output = {
    timestamp: new Date().toISOString(),
    totalFound: allDiscovered.length,
    agents: allDiscovered,
  };
  
  const outputFile = 'discovered_agents_node.json';
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${outputFile}`);
  
  const bySource: Record<string, number> = {};
  for (const agent of allDiscovered) {
    bySource[agent.source] = (bySource[agent.source] || 0) + 1;
  }
  
  console.log('\n📊 Summary by source:');
  for (const [source, count] of Object.entries(bySource)) {
    console.log(`  - ${source}: ${count}`);
  }
  
  return allDiscovered;
}

main().catch(console.error);
