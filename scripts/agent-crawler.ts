/**
 * Agent Crawler - Find AI agents via their .well-known/agent-card.json endpoints
 * 
 * Sources:
 * 1. Scrape aiagentsdirectory.com for agent URLs
 * 2. Scrape x402.org/ecosystem for x402-enabled services
 * 3. Check each domain for /.well-known/agent-card.json
 * 4. Extract skills/capabilities to find potential customers
 */

import fetch from 'node-fetch';

interface AgentCard {
  name: string;
  description?: string;
  url?: string;
  provider?: {
    organization?: string;
    url?: string;
  };
  skills?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  capabilities?: Record<string, boolean>;
}

interface DiscoveredAgent {
  domain: string;
  hasAgentCard: boolean;
  agentCard?: AgentCard;
  needsCryptoData: boolean;
  contactUrl?: string;
  error?: string;
}

const KNOWN_AGENT_DOMAINS = [
  // From x402.org/ecosystem
  'mesh.heurist.ai',
  'research.heurist.ai',
  'itsgloria.ai',
  'aurracloud.com',
  'aimo.network',
  'firecrawl.dev',
  'questflow.ai',
  'nuwa.dev',
  'latinum.ai',
  'fluora.ai',
  'genbase.fun',
  'grove.city',
  'aeon.xyz',
  'proxy402.com',
  'router.daydreams.systems',
  'mrdn.finance',
  'onchain.fi',
  'proofivy.com',
  'codenut.ai',
  'mogami.tech',
  'faremeter.xyz',
  'mcpay.tech',
  't54.ai',
  'api.snack.money',
  '402.pinata.cloud',
  'neynar.com',
  'docs.ottowallet.xyz',
  
  // From aiagentsdirectory.com (top agents)
  'thelibrarianio.com',
  'agentverse.ai',
  'digitalemployees.io',
  'doozerai.com',
  'chatvolt.ai',
  'teammates.ai',
  'seobotai.com',
  'mailmodo.com',
  'jason.ai',
  
  // Known A2A protocol participants
  'a2aregistry.org',
  'agentcard.net',
  
  // AI/LLM platforms that might have agent cards
  'claude.ai',
  'openai.com',
  'anthropic.com',
  'huggingface.co',
  'replicate.com',
  'together.ai',
  'groq.com',
  'perplexity.ai',
  'cohere.com',
  
  // Crypto trading platforms (potential customers)
  '3commas.io',
  'cryptohopper.com',
  'tradesanta.com',
  'hummingbot.org',
  'coinrule.com',
  'pionex.com',
  'stoic.ai',
  'botsfolio.com',
];

async function checkAgentCard(domain: string): Promise<DiscoveredAgent> {
  const result: DiscoveredAgent = {
    domain,
    hasAgentCard: false,
    needsCryptoData: false,
  };

  // Try both with and without www
  const urls = [
    `https://${domain}/.well-known/agent-card.json`,
    `https://www.${domain}/.well-known/agent-card.json`,
    `https://${domain}/.well-known/agent.json`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'CoinRailz-AgentCrawler/1.0 (discovering x402 agents)',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('json')) {
          const card = await response.json() as AgentCard;
          result.hasAgentCard = true;
          result.agentCard = card;
          result.contactUrl = card.provider?.url || card.url;
          
          // Analyze if they might need crypto data services
          const description = (card.description || '').toLowerCase();
          const skillNames = card.skills?.map(s => s.name.toLowerCase()).join(' ') || '';
          const allText = `${description} ${skillNames}`;
          
          const cryptoKeywords = [
            'trading', 'crypto', 'token', 'wallet', 'defi', 'blockchain',
            'price', 'market', 'swap', 'exchange', 'liquidity', 'gas',
            'eth', 'bitcoin', 'usdc', 'nft', 'finance', 'investment'
          ];
          
          result.needsCryptoData = cryptoKeywords.some(kw => allText.includes(kw));
          break;
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  return result;
}

async function crawlAgents(): Promise<void> {
  console.log('🔍 Starting Agent Crawler...');
  console.log(`📋 Checking ${KNOWN_AGENT_DOMAINS.length} domains\n`);

  const results: DiscoveredAgent[] = [];
  const agentsWithCards: DiscoveredAgent[] = [];
  const potentialCustomers: DiscoveredAgent[] = [];

  // Process in batches to avoid overwhelming
  const batchSize = 10;
  for (let i = 0; i < KNOWN_AGENT_DOMAINS.length; i += batchSize) {
    const batch = KNOWN_AGENT_DOMAINS.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(KNOWN_AGENT_DOMAINS.length/batchSize)}...`);
    
    const batchResults = await Promise.all(batch.map(checkAgentCard));
    results.push(...batchResults);

    for (const result of batchResults) {
      if (result.hasAgentCard) {
        agentsWithCards.push(result);
        console.log(`  ✅ ${result.domain} - HAS agent-card.json`);
        if (result.agentCard) {
          console.log(`     Name: ${result.agentCard.name}`);
          console.log(`     Skills: ${result.agentCard.skills?.length || 0}`);
        }
        if (result.needsCryptoData) {
          potentialCustomers.push(result);
          console.log(`     🎯 POTENTIAL CUSTOMER (crypto-related)`);
        }
      } else {
        console.log(`  ❌ ${result.domain} - No agent-card found`);
      }
    }
    console.log('');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CRAWLER RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total domains checked: ${results.length}`);
  console.log(`Agents with agent-card.json: ${agentsWithCards.length}`);
  console.log(`Potential crypto customers: ${potentialCustomers.length}`);

  if (agentsWithCards.length > 0) {
    console.log('\n📋 AGENTS WITH AGENT CARDS:');
    for (const agent of agentsWithCards) {
      console.log(`\n  Domain: ${agent.domain}`);
      console.log(`  Name: ${agent.agentCard?.name || 'Unknown'}`);
      console.log(`  Description: ${(agent.agentCard?.description || 'N/A').substring(0, 100)}...`);
      console.log(`  Contact: ${agent.contactUrl || 'N/A'}`);
      console.log(`  Needs Crypto Data: ${agent.needsCryptoData ? '🎯 YES' : 'No'}`);
    }
  }

  if (potentialCustomers.length > 0) {
    console.log('\n🎯 POTENTIAL CUSTOMERS (need crypto data):');
    for (const customer of potentialCustomers) {
      console.log(`\n  ${customer.domain}`);
      console.log(`  Name: ${customer.agentCard?.name}`);
      console.log(`  Contact: ${customer.contactUrl || 'Unknown'}`);
    }
  }

  // Save results to file
  const outputPath = './crawler-results.json';
  const output = {
    timestamp: new Date().toISOString(),
    totalChecked: results.length,
    agentsWithCards: agentsWithCards.map(a => ({
      domain: a.domain,
      name: a.agentCard?.name,
      description: a.agentCard?.description,
      skills: a.agentCard?.skills?.map(s => s.name),
      contact: a.contactUrl,
      needsCryptoData: a.needsCryptoData,
    })),
    potentialCustomers: potentialCustomers.map(c => ({
      domain: c.domain,
      name: c.agentCard?.name,
      contact: c.contactUrl,
    })),
  };
  
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${outputPath}`);
}

// Run the crawler
crawlAgents().catch(console.error);
