/**
 * Coinbase Bazaar Full Discovery Script
 * 
 * Scrapes ALL services from the official Coinbase x402 Bazaar API
 * These are LIVE, DEPLOYED services accepting x402 payments
 */

import fs from 'fs';

interface BazaarService {
  resource: string;
  maxAmountRequired?: string;
  description?: string;
  network?: string;
  payTo?: string;
  asset?: string;
  discoverable?: boolean;
  domain?: string;
  hasAgentCard?: boolean;
  agentCardData?: any;
  responseTimeMs?: number;
}

interface DiscoveryResult {
  timestamp: string;
  totalServices: number;
  uniqueDomains: number;
  withAgentCards: number;
  services: BazaarService[];
  topDomains: { domain: string; serviceCount: number }[];
}

const BAZAAR_API = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources';

async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CoinRailz-Discovery/1.0',
      },
    });
    clearTimeout(timeout);
    return response;
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchAllBazaarServices(): Promise<BazaarService[]> {
  const allServices: BazaarService[] = [];
  let offset = 0;
  const limit = 500;
  let hasMore = true;
  
  console.log('📡 Fetching services from Coinbase Bazaar API...\n');
  
  while (hasMore) {
    const url = `${BAZAAR_API}?limit=${limit}&offset=${offset}`;
    console.log(`   Fetching offset ${offset}...`);
    
    const response = await fetchWithTimeout(url, 30000);
    
    if (!response?.ok) {
      console.log(`   ❌ Failed to fetch offset ${offset}`);
      break;
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const item of data.items) {
      try {
        const url = new URL(item.resource);
        allServices.push({
          resource: item.resource,
          maxAmountRequired: item.maxAmountRequired,
          description: item.description,
          network: item.network,
          payTo: item.payTo,
          asset: item.asset,
          discoverable: item.discoverable,
          domain: url.hostname,
        });
      } catch {
        allServices.push({
          resource: item.resource,
          maxAmountRequired: item.maxAmountRequired,
          description: item.description,
          network: item.network,
          payTo: item.payTo,
          asset: item.asset,
          discoverable: item.discoverable,
        });
      }
    }
    
    console.log(`   ✅ Found ${data.items.length} services (total: ${allServices.length})`);
    
    if (data.items.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }
  }
  
  return allServices;
}

async function probeAgentCard(domain: string): Promise<{ hasCard: boolean; data?: any; responseTimeMs: number }> {
  const start = Date.now();
  
  const paths = [
    '/.well-known/agent.json',
    '/.well-known/agent-card.json',
  ];
  
  for (const path of paths) {
    try {
      const response = await fetchWithTimeout(`https://${domain}${path}`, 5000);
      const responseTimeMs = Date.now() - start;
      
      if (response?.ok) {
        const data = await response.json();
        if (data.name || data.description || data.skills || data.capabilities || data.services) {
          return { hasCard: true, data, responseTimeMs };
        }
      }
    } catch {}
  }
  
  return { hasCard: false, responseTimeMs: Date.now() - start };
}

async function main() {
  console.log('======================================================================');
  console.log('🏪 COINBASE BAZAAR FULL DISCOVERY');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('======================================================================\n');
  
  // Phase 1: Fetch all services
  console.log('📡 PHASE 1: Fetching all Bazaar listings...\n');
  const services = await fetchAllBazaarServices();
  
  console.log(`\n   Total services fetched: ${services.length}`);
  
  // Phase 2: Analyze domains
  console.log('\n📡 PHASE 2: Analyzing unique domains...\n');
  
  const domainCounts = new Map<string, number>();
  for (const service of services) {
    if (service.domain) {
      domainCounts.set(service.domain, (domainCounts.get(service.domain) || 0) + 1);
    }
  }
  
  const sortedDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ domain, serviceCount: count }));
  
  console.log(`   Unique domains: ${sortedDomains.length}`);
  console.log('\n   Top 20 domains by service count:');
  for (const { domain, serviceCount } of sortedDomains.slice(0, 20)) {
    console.log(`      ${domain}: ${serviceCount} services`);
  }
  
  // Phase 3: Probe agent cards for top domains
  console.log('\n📡 PHASE 3: Probing agent cards for top 50 domains...\n');
  
  let agentCardsFound = 0;
  const domainsToProbe = sortedDomains.slice(0, 50);
  
  for (const { domain } of domainsToProbe) {
    const result = await probeAgentCard(domain);
    
    if (result.hasCard) {
      agentCardsFound++;
      console.log(`   ✅ ${domain} has agent card (${result.responseTimeMs}ms)`);
      
      // Update services for this domain
      for (const service of services) {
        if (service.domain === domain) {
          service.hasAgentCard = true;
          service.agentCardData = result.data;
          service.responseTimeMs = result.responseTimeMs;
        }
      }
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Save results
  const result: DiscoveryResult = {
    timestamp: new Date().toISOString(),
    totalServices: services.length,
    uniqueDomains: sortedDomains.length,
    withAgentCards: agentCardsFound,
    services,
    topDomains: sortedDomains.slice(0, 100),
  };
  
  fs.writeFileSync('discovered_agents_bazaar.json', JSON.stringify(result, null, 2));
  
  // Summary
  console.log('\n======================================================================');
  console.log('✅ BAZAAR DISCOVERY COMPLETE');
  console.log(`   Total services: ${services.length}`);
  console.log(`   Unique domains: ${sortedDomains.length}`);
  console.log(`   With agent cards: ${agentCardsFound}/${domainsToProbe.length} probed`);
  console.log('======================================================================\n');
  
  console.log('💾 Results saved to discovered_agents_bazaar.json');
  
  // List services with agent cards
  const withCards = services.filter(s => s.hasAgentCard);
  if (withCards.length > 0) {
    console.log('\n🎯 DOMAINS WITH AGENT CARDS (potential A2A partners):');
    const uniqueWithCards = [...new Set(withCards.map(s => s.domain))];
    for (const domain of uniqueWithCards.slice(0, 20)) {
      const service = withCards.find(s => s.domain === domain);
      console.log(`   ${domain} (${service?.responseTimeMs}ms)`);
    }
  }
  
  // List pricing tiers
  console.log('\n💰 PRICING ANALYSIS:');
  const withPricing = services.filter(s => s.maxAmountRequired);
  const pricingGroups = new Map<string, number>();
  
  for (const service of withPricing) {
    const price = service.maxAmountRequired!;
    pricingGroups.set(price, (pricingGroups.get(price) || 0) + 1);
  }
  
  const sortedPricing = [...pricingGroups.entries()]
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .slice(0, 10);
  
  for (const [price, count] of sortedPricing) {
    const usdPrice = parseInt(price) / 1000000; // USDC has 6 decimals
    console.log(`   $${usdPrice.toFixed(4)}: ${count} services`);
  }
}

main().catch(console.error);
