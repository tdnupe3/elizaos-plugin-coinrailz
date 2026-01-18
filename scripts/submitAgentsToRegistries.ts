/**
 * Submit Coin Railz Agents to A2A Registries
 * 
 * This script submits our 7 marketplace agents + platform agent
 * to real A2A registries for discovery by other agents.
 */

import fetch from 'node-fetch';

const COINRAILZ_DOMAIN = process.env.PUBLIC_BASE_URL ||
  (process.env.REPLIT_DEPLOYMENT === '1' ? 'https://coinrailz.com' :
   process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` :
   'https://coinrailz.com');

// Our 7 marketplace agents + platform agent
const AGENTS_TO_SUBMIT = [
  {
    id: 'smart-contract-auditor',
    name: 'Coin Railz Smart Contract Auditor',
    description: '$1,000 professional smart contract security audit service',
    price: '$1,000 per audit',
    category: 'security'
  },
  {
    id: 'compliance-consultant',
    name: 'Coin Railz Compliance Consultant',
    description: 'Crypto compliance and regulatory guidance',
    price: '$500-$2,000',
    category: 'legal'
  },
  {
    id: 'token-launcher',
    name: 'Coin Railz Token Launcher',
    description: 'End-to-end token deployment on Base Chain',
    price: '$2,500',
    category: 'deployment'
  },
  {
    id: 'liquidity-provider',
    name: 'Coin Railz Liquidity Provider',
    description: 'DEX liquidity provision and management',
    price: 'Variable',
    category: 'defi'
  },
  {
    id: 'treasury-manager',
    name: 'Coin Railz Treasury Manager',
    description: 'Multi-chain treasury and asset management',
    price: '1% AUM',
    category: 'finance'
  },
  {
    id: 'payment-processor',
    name: 'Coin Railz Payment Processor',
    description: 'USDC payment processing with instant settlement',
    price: '0.5% per transaction',
    category: 'payments'
  },
  {
    id: 'market-maker',
    name: 'Coin Railz Market Maker',
    description: 'Automated market making for new tokens',
    price: '$5,000 setup + 0.3% fee',
    category: 'trading'
  },
  {
    id: 'platform',
    name: 'Coin Railz Platform',
    description: 'Financial infrastructure for autonomous AI agents with x402 payments',
    price: 'Variable',
    category: 'infrastructure'
  }
];

interface RegistrySubmission {
  url: string;
  method: 'POST' | 'PUT';
  format: 'a2a-standard' | 'github-pr' | 'json-rpc';
  instructions?: string;
}

const REGISTRY_SUBMISSIONS: RegistrySubmission[] = [
  {
    url: 'https://github.com/a2aregistry/a2a-registry',
    method: 'POST',
    format: 'github-pr',
    instructions: 'a2aregistry.org is a static GitHub Pages site. Submit via PR to add agent card URL.'
  },
  {
    url: 'https://github.com/sing1ee/a2a-directory',
    method: 'POST',
    format: 'github-pr',
    instructions: 'Submit via Pull Request with agent-card.json'
  }
];

async function generateAgentCard(agent: typeof AGENTS_TO_SUBMIT[0]) {
  const agentCardUrl = `${COINRAILZ_DOMAIN}/agent/${agent.id}/.well-known/agent-card.json`;
  
  return {
    name: agent.name,
    description: agent.description,
    version: '1.0.0',
    protocolVersion: '0.3.0',
    url: `${COINRAILZ_DOMAIN}/agent/${agent.id}`,
    wellKnownURI: agentCardUrl,
    author: {
      name: 'Coin Railz',
      organization: 'Kellogg Holdings LLC',
      url: COINRAILZ_DOMAIN
    },
    provider: {
      organization: 'Coin Railz',
      url: COINRAILZ_DOMAIN
    },
    capabilities: {
      streaming: true,
      pushNotifications: false,
      x402Payments: true,
      onChainMessaging: true
    },
    skills: [{
      id: agent.id,
      name: agent.name,
      description: agent.description,
      inputModes: ['text'],
      outputModes: ['text', 'json'],
      pricing: agent.price,
      category: agent.category
    }],
    authentication: [{
      type: 'bearer',
      scheme: 'Bearer'
    }],
    payment: {
      methods: ['x402', 'usdc', 'marketplace-escrow'],
      commission: '15%',
      pricing: agent.price
    },
    metadata: {
      category: agent.category,
      license: 'Alabama MTL',
      jurisdiction: 'United States',
      platform: 'Base Chain',
      smartContract: '0xdE951fb947a01187919c484f237627B5c685D459'
    }
  };
}

async function submitToJsonRpcRegistry(registryUrl: string, agentCard: any) {
  try {
    const response = await fetch(registryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'register_agent',
        params: {
          agent_card: agentCard
        },
        id: 1
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Submitted ${agentCard.name} to ${registryUrl}`);
      return { success: true, result };
    } else {
      const error = await response.text();
      console.log(`❌ Failed to submit ${agentCard.name}: ${error}`);
      return { success: false, error };
    }
  } catch (error) {
    console.log(`❌ Error submitting to ${registryUrl}:`, (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function submitToA2AStandardRegistry(registryUrl: string, agentCard: any) {
  try {
    const response = await fetch(registryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CoinRailz-Registry-Submission/1.0'
      },
      body: JSON.stringify({
        name: agentCard.name,
        url: agentCard.wellKnownURI,
        agentCardUrl: agentCard.wellKnownURI,
        description: agentCard.description,
        category: agentCard.metadata?.category || 'infrastructure',
        provider: agentCard.provider?.organization || 'Coin Railz',
        capabilities: Object.keys(agentCard.capabilities || {}),
        skills: agentCard.skills?.map((s: any) => s.name) || []
      })
    });

    if (response.ok) {
      const result = await response.json().catch(() => ({ status: 'accepted' }));
      console.log(`✅ Submitted ${agentCard.name} to ${registryUrl}`);
      return { success: true, result };
    } else {
      const error = await response.text();
      console.log(`❌ Failed to submit ${agentCard.name} to ${registryUrl}: ${error.slice(0, 200)}`);
      return { success: false, error };
    }
  } catch (error) {
    console.log(`❌ Error submitting to ${registryUrl}:`, (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function main() {
  console.log('🚀 Submitting Coin Railz Agents to A2A Registries\n');
  console.log(`Platform: ${COINRAILZ_DOMAIN}`);
  console.log(`Smart Contract: 0xdE951fb947a01187919c484f237627B5c685D459 (Base Chain)\n`);

  const results = [];

  for (const agent of AGENTS_TO_SUBMIT) {
    console.log(`\n📝 Processing: ${agent.name}`);
    
    const agentCard = await generateAgentCard(agent);
    console.log(`Agent Card URL: ${agentCard.wellKnownURI}`);

    // Try each registry
    for (const registry of REGISTRY_SUBMISSIONS) {
      if (registry.format === 'json-rpc') {
        const result = await submitToJsonRpcRegistry(registry.url, agentCard);
        results.push({ agent: agent.name, registry: registry.url, result });
      } else if (registry.format === 'a2a-standard') {
        const result = await submitToA2AStandardRegistry(registry.url, agentCard);
        results.push({ agent: agent.name, registry: registry.url, result });
      } else if (registry.format === 'github-pr') {
        console.log(`📋 Manual submission required: ${registry.instructions}`);
        console.log(`   Create PR at: ${registry.url}`);
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n\n📊 SUBMISSION SUMMARY\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const successful = results.filter(r => r.result.success).length;
  const failed = results.filter(r => !r.result.success).length;
  
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${results.length}`);
  
  console.log('\n🔗 Agent Cards Published At:');
  for (const agent of AGENTS_TO_SUBMIT) {
    console.log(`   ${agent.name}:`);
    console.log(`   ${COINRAILZ_DOMAIN}/agent/${agent.id}/.well-known/agent-card.json\n`);
  }

  console.log('\n💡 Next Steps:');
  console.log('1. Monitor registries for approval/listing');
  console.log('2. Submit PRs to GitHub-based directories');
  console.log('3. Verify Agent Cards are accessible at /.well-known URLs');
  console.log('4. Wait for other agents to discover and contact us!\n');
}

main().catch(console.error);
