#!/usr/bin/env npx tsx
/**
 * Chained Agent Discovery Tool
 * 
 * WORKFLOW:
 * 1. Query A2A registries for agent cards
 * 2. Extract endpoint URLs from discovered agent cards
 * 3. Probe those endpoints for additional agents (follow links)
 * 4. Send test messages to measure responsiveness
 * 5. Output prioritized list of potential customers
 * 
 * This creates a "snowball" effect where each discovery leads to more discoveries
 */

import fs from 'fs';

const AGENT_CARD_PATH = '/.well-known/agent.json';

interface AgentCard {
  name: string;
  description?: string;
  serviceUrl?: string;
  skills?: any[];
  endpoints?: Record<string, string>;
  tools?: any[];
  url?: string;
}

interface DiscoveredAgent {
  source: string;
  domain: string;
  agentCard?: AgentCard;
  x402Response?: any;
  responsiveness?: {
    pingTimeMs: number;
    status: 'fast' | 'slow' | 'unresponsive';
  };
  childAgents?: string[];
  discoveredAt: string;
}

const SEED_REGISTRIES = [
  'https://registry.a2aprotocol.ai',
  'https://registry.artinet.io',
];

const SEED_DOMAINS = [
  'www.reap.deals',
  'api.snack.money',
  'x402.arvos.xyz',
  'api.barvis.io',
  'api.jiren.ai',
  'api.dexter.cash',
  'api.canza.app',
  'wurkapi.fun',
  'firecrawl.dev',
  'mesh.heurist.xyz',
  'acp-x402.virtuals.io',
  'pay.lnpay.ai',
];

const discoveredDomains = new Set<string>();
const agentQueue: string[] = [];
const results: DiscoveredAgent[] = [];

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'CoinRailz-ChainedDiscovery/1.0',
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

async function fetchAgentCard(domain: string): Promise<AgentCard | null> {
  const paths = [
    `https://${domain}/.well-known/agent.json`,
    `https://${domain}/.well-known/agent-card.json`,
  ];
  
  for (const url of paths) {
    try {
      const response = await fetchWithTimeout(url);
      if (response?.ok) {
        const data = await response.json();
        console.log(`✅ Agent card found at ${domain}`);
        return { ...data, url };
      }
    } catch (e) {}
  }
  return null;
}

async function probe402Endpoint(domain: string): Promise<any> {
  const endpoints = [
    `https://${domain}/`,
    `https://${domain}/ping`,
    `https://${domain}/api`,
    `https://${domain}/x402/ping`,
  ];
  
  for (const url of endpoints) {
    try {
      const start = Date.now();
      const response = await fetchWithTimeout(url, { method: 'POST' });
      const pingTime = Date.now() - start;
      
      if (response?.status === 402) {
        const data = await response.json();
        if (data.x402Version || data.accepts) {
          console.log(`💰 x402 endpoint found at ${url} (${pingTime}ms)`);
          return { data, pingTimeMs: pingTime };
        }
      }
    } catch (e) {}
  }
  return null;
}

function extractLinkedDomains(agentCard: AgentCard): string[] {
  const domains: string[] = [];
  
  const extractDomain = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (e) {
      return null;
    }
  };
  
  if (agentCard.serviceUrl) {
    const d = extractDomain(agentCard.serviceUrl);
    if (d) domains.push(d);
  }
  
  if (agentCard.endpoints) {
    for (const url of Object.values(agentCard.endpoints)) {
      if (typeof url === 'string') {
        const d = extractDomain(url);
        if (d) domains.push(d);
      }
    }
  }
  
  if (agentCard.tools) {
    for (const tool of agentCard.tools) {
      if (tool.endpoints) {
        for (const endpoint of tool.endpoints) {
          if (endpoint.path && endpoint.path.startsWith('http')) {
            const d = extractDomain(endpoint.path);
            if (d) domains.push(d);
          }
        }
      }
    }
  }
  
  return [...new Set(domains)];
}

async function queryRegistry(registryUrl: string): Promise<AgentCard[]> {
  const agents: AgentCard[] = [];
  
  try {
    const response = await fetchWithTimeout(`${registryUrl}/agents`, {}, 15000);
    if (response?.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        agents.push(...data);
      } else if (data.agents) {
        agents.push(...data.agents);
      }
      console.log(`📋 Registry ${registryUrl} returned ${agents.length} agents`);
    }
  } catch (e) {
    console.log(`⚠️ Could not query registry ${registryUrl}`);
  }
  
  return agents;
}

async function sendTestMessage(domain: string): Promise<{ success: boolean; responseTimeMs: number }> {
  const start = Date.now();
  
  try {
    const response = await fetchWithTimeout(`https://${domain}${AGENT_CARD_PATH}`);
    
    if (response?.ok) {
      await response.json();
      return {
        success: true,
        responseTimeMs: Date.now() - start,
      };
    }
    
    return {
      success: false,
      responseTimeMs: Date.now() - start,
    };
  } catch (e) {
    return {
      success: false,
      responseTimeMs: Date.now() - start,
    };
  }
}

async function discoverAgent(domain: string): Promise<DiscoveredAgent | null> {
  if (discoveredDomains.has(domain)) {
    return null;
  }
  discoveredDomains.add(domain);
  
  console.log(`\n🔍 Discovering: ${domain}`);
  
  const agent: DiscoveredAgent = {
    source: 'chained_discovery',
    domain,
    discoveredAt: new Date().toISOString(),
  };
  
  const agentCard = await fetchAgentCard(domain);
  if (agentCard) {
    agent.agentCard = agentCard;
    
    const linkedDomains = extractLinkedDomains(agentCard);
    agent.childAgents = linkedDomains;
    
    for (const linked of linkedDomains) {
      if (!discoveredDomains.has(linked)) {
        agentQueue.push(linked);
        console.log(`   ➕ Queued linked domain: ${linked}`);
      }
    }
  }
  
  const x402Response = await probe402Endpoint(domain);
  if (x402Response) {
    agent.x402Response = x402Response.data;
    
    const pingTime = x402Response.pingTimeMs;
    agent.responsiveness = {
      pingTimeMs: pingTime,
      status: pingTime < 500 ? 'fast' : pingTime < 2000 ? 'slow' : 'unresponsive',
    };
  }
  
  if (!agent.agentCard && !agent.x402Response) {
    const testResult = await sendTestMessage(domain);
    if (testResult.success) {
      agent.responsiveness = {
        pingTimeMs: testResult.responseTimeMs,
        status: testResult.responseTimeMs < 500 ? 'fast' : 'slow',
      };
    }
  }
  
  if (agent.agentCard || agent.x402Response || agent.responsiveness) {
    return agent;
  }
  
  return null;
}

async function main() {
  console.log('='.repeat(70));
  console.log('🔗 CHAINED AGENT DISCOVERY');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
  
  console.log('\n📡 PHASE 1: Querying seed registries...');
  for (const registry of SEED_REGISTRIES) {
    const agents = await queryRegistry(registry);
    for (const agent of agents) {
      if (agent.serviceUrl) {
        try {
          const domain = new URL(agent.serviceUrl).hostname;
          agentQueue.push(domain);
        } catch (e) {}
      }
    }
  }
  
  console.log('\n📡 PHASE 2: Adding seed domains...');
  for (const domain of SEED_DOMAINS) {
    if (!discoveredDomains.has(domain)) {
      agentQueue.push(domain);
    }
  }
  
  console.log(`\n📡 PHASE 3: Processing queue (${agentQueue.length} domains)...`);
  
  const maxIterations = 100;
  let iterations = 0;
  
  while (agentQueue.length > 0 && iterations < maxIterations) {
    const domain = agentQueue.shift()!;
    iterations++;
    
    const agent = await discoverAgent(domain);
    if (agent) {
      results.push(agent);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n📡 PHASE 4: Measuring responsiveness for top agents...');
  const topAgents = results
    .filter(a => a.agentCard || a.x402Response)
    .slice(0, 20);
  
  for (const agent of topAgents) {
    if (!agent.responsiveness) {
      const testResult = await sendTestMessage(agent.domain);
      if (testResult.success) {
        agent.responsiveness = {
          pingTimeMs: testResult.responseTimeMs,
          status: testResult.responseTimeMs < 500 ? 'fast' : 'slow',
        };
        console.log(`   ⏱️ ${agent.domain}: ${testResult.responseTimeMs}ms`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ CHAINED DISCOVERY COMPLETE');
  console.log(`   Total discovered: ${results.length}`);
  console.log(`   With agent cards: ${results.filter(a => a.agentCard).length}`);
  console.log(`   With x402: ${results.filter(a => a.x402Response).length}`);
  console.log(`   Fast responders: ${results.filter(a => a.responsiveness?.status === 'fast').length}`);
  console.log('='.repeat(70));
  
  results.sort((a, b) => {
    const scoreA = (a.agentCard ? 2 : 0) + (a.x402Response ? 3 : 0) + (a.responsiveness?.status === 'fast' ? 1 : 0);
    const scoreB = (b.agentCard ? 2 : 0) + (b.x402Response ? 3 : 0) + (b.responsiveness?.status === 'fast' ? 1 : 0);
    return scoreB - scoreA;
  });
  
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      totalDiscovered: results.length,
      withAgentCards: results.filter(a => a.agentCard).length,
      withX402: results.filter(a => a.x402Response).length,
      fastResponders: results.filter(a => a.responsiveness?.status === 'fast').length,
    },
    agents: results,
  };
  
  const outputFile = 'discovered_agents_chained.json';
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${outputFile}`);
  
  console.log('\n🎯 TOP TARGETS (prioritized for outreach):');
  for (const agent of results.slice(0, 15)) {
    const features = [];
    if (agent.agentCard) features.push('A2A');
    if (agent.x402Response) features.push('x402');
    if (agent.responsiveness?.status === 'fast') features.push('⚡fast');
    console.log(`   ${agent.domain} [${features.join(', ')}]`);
  }
  
  return results;
}

main().catch(console.error);
