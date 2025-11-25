/**
 * Agent Crawler V2 - Try multiple discovery methods
 * 
 * Methods:
 * 1. /.well-known/agent-card.json (A2A standard)
 * 2. /.well-known/ai-plugin.json (OpenAI ChatGPT plugins)
 * 3. /agents.json (Wild Card standard)
 * 4. /openapi.json or /swagger.json (API specs)
 * 5. Look for x402 payment headers
 */

import fetch from 'node-fetch';

interface DiscoveryResult {
  domain: string;
  agentCard: boolean;
  aiPlugin: boolean;
  agentsJson: boolean;
  openApi: boolean;
  x402Enabled: boolean;
  contactEmail?: string;
  apiDocs?: string;
  details: Record<string, any>;
}

const DOMAINS_TO_CHECK = [
  // x402 ecosystem (from x402.org)
  'mesh.heurist.ai',
  'itsgloria.ai', 
  'firecrawl.dev',
  'questflow.ai',
  'ottowallet.xyz',
  'neynar.com',
  'latinum.ai',
  'fluora.ai',
  'aeon.xyz',
  'daydreams.systems',
  'mrdn.finance',
  'pinata.cloud',
  'snack.money',
  'proofivy.com',
  'aurracloud.com',
  'aimo.network',
  'genbase.fun',
  'mcpay.tech',
  
  // Trading bots / crypto platforms
  'hummingbot.io',
  '3commas.io',
  'cryptohopper.com',
  'shrimpy.io',
  'coinrule.com',
  'bitsgap.com',
  'quadency.com',
  
  // AI agent frameworks
  'langchain.com',
  'autogpt.net',
  'crewai.com',
  'phidata.com',
];

async function checkEndpoint(url: string): Promise<{exists: boolean; data?: any}> {
  try {
    const response = await fetch(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'CoinRailz-Discovery/2.0',
        'Accept': 'application/json, text/plain, */*',
      },
    });
    
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const data = await response.json();
        return { exists: true, data };
      }
      return { exists: true };
    }
    
    // Check for x402 - a 402 response means they support x402!
    if (response.status === 402) {
      const paymentHeader = response.headers.get('x-payment') || 
                           response.headers.get('www-authenticate');
      return { exists: true, data: { x402: true, paymentHeader } };
    }
    
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

async function discoverAgent(domain: string): Promise<DiscoveryResult> {
  console.log(`\n🔍 Checking ${domain}...`);
  
  const result: DiscoveryResult = {
    domain,
    agentCard: false,
    aiPlugin: false,
    agentsJson: false,
    openApi: false,
    x402Enabled: false,
    details: {},
  };

  // Check multiple endpoints in parallel
  const checks = await Promise.all([
    checkEndpoint(`https://${domain}/.well-known/agent-card.json`),
    checkEndpoint(`https://${domain}/.well-known/ai-plugin.json`),
    checkEndpoint(`https://${domain}/agents.json`),
    checkEndpoint(`https://${domain}/.well-known/agents.json`),
    checkEndpoint(`https://${domain}/openapi.json`),
    checkEndpoint(`https://${domain}/api/openapi.json`),
    checkEndpoint(`https://${domain}/swagger.json`),
    checkEndpoint(`https://${domain}/api`), // Might trigger x402
    checkEndpoint(`https://api.${domain}/`),
  ]);

  // Process results
  if (checks[0].exists) {
    result.agentCard = true;
    result.details.agentCard = checks[0].data;
    console.log(`  ✅ Has agent-card.json`);
  }
  
  if (checks[1].exists) {
    result.aiPlugin = true;
    result.details.aiPlugin = checks[1].data;
    console.log(`  ✅ Has ai-plugin.json (ChatGPT plugin)`);
  }
  
  if (checks[2].exists || checks[3].exists) {
    result.agentsJson = true;
    result.details.agentsJson = checks[2].data || checks[3].data;
    console.log(`  ✅ Has agents.json`);
  }
  
  if (checks[4].exists || checks[5].exists || checks[6].exists) {
    result.openApi = true;
    result.apiDocs = `https://${domain}/openapi.json`;
    console.log(`  ✅ Has OpenAPI spec`);
  }

  // Check if any response was x402
  for (const check of checks) {
    if (check.data?.x402) {
      result.x402Enabled = true;
      result.details.x402 = check.data;
      console.log(`  🎯 X402 ENABLED!`);
      break;
    }
  }

  if (!result.agentCard && !result.aiPlugin && !result.agentsJson && !result.openApi && !result.x402Enabled) {
    console.log(`  ❌ No discoverable endpoints`);
  }

  return result;
}

async function main() {
  console.log('🚀 Agent Crawler V2 - Multi-method Discovery');
  console.log('='.repeat(50));
  
  const results: DiscoveryResult[] = [];
  
  for (const domain of DOMAINS_TO_CHECK) {
    const result = await discoverAgent(domain);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 DISCOVERY SUMMARY');
  console.log('='.repeat(50));
  
  const withAgentCard = results.filter(r => r.agentCard);
  const withAiPlugin = results.filter(r => r.aiPlugin);
  const withAgentsJson = results.filter(r => r.agentsJson);
  const withOpenApi = results.filter(r => r.openApi);
  const withX402 = results.filter(r => r.x402Enabled);
  const withAnything = results.filter(r => 
    r.agentCard || r.aiPlugin || r.agentsJson || r.openApi || r.x402Enabled
  );

  console.log(`\nTotal checked: ${results.length}`);
  console.log(`With agent-card.json: ${withAgentCard.length}`);
  console.log(`With ai-plugin.json: ${withAiPlugin.length}`);
  console.log(`With agents.json: ${withAgentsJson.length}`);
  console.log(`With OpenAPI spec: ${withOpenApi.length}`);
  console.log(`With x402 enabled: ${withX402.length}`);
  console.log(`With ANY discoverable endpoint: ${withAnything.length}`);

  if (withAnything.length > 0) {
    console.log('\n🎯 DISCOVERABLE AGENTS:');
    for (const r of withAnything) {
      console.log(`\n  ${r.domain}:`);
      if (r.agentCard) console.log(`    - agent-card.json ✓`);
      if (r.aiPlugin) console.log(`    - ai-plugin.json ✓`);
      if (r.agentsJson) console.log(`    - agents.json ✓`);
      if (r.openApi) console.log(`    - OpenAPI spec ✓`);
      if (r.x402Enabled) console.log(`    - x402 ENABLED ✓`);
    }
  }

  // Save results
  const fs = await import('fs');
  fs.writeFileSync('./crawler-results-v2.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Results saved to crawler-results-v2.json');
}

main().catch(console.error);
