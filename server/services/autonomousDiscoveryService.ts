/**
 * Autonomous Discovery Service
 * Makes our agents discoverable without manual outreach
 * 
 * Methods:
 * 1. Submit to public AI agent directories (API/form POST)
 * 2. Create XML sitemap for web crawlers
 * 3. Ping search engines about our agent cards
 * 4. Monitor for incoming A2A discovery attempts
 * 5. ERC-8004 on-chain registration (when feasible)
 */

import { db } from '../db';
import { globalAIAgents } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { serviceCatalogService } from './serviceCatalogService';

interface DiscoveryTarget {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  type: 'api' | 'form' | 'ping';
  enabled: boolean;
}

class AutonomousDiscoveryService {
  private getBaseUrl(hostname?: string): string {
    // Production deployment detection (same as agent card routes)
    if (process.env.REPLIT_DEPLOYMENT === '1') {
      return 'https://coinrailz.com';
    }
    
    // Development: Use provided hostname or fallback
    if (hostname) {
      return `https://${hostname}`;
    }
    
    return process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:5000';
  }

  private discoveryTargets: DiscoveryTarget[] = [
    {
      name: 'AI Agents Directory Sitemap Ping',
      url: 'https://www.google.com/ping?sitemap=',
      method: 'GET',
      type: 'ping',
      enabled: true,
    },
    {
      name: 'Bing Sitemap Ping',
      url: 'https://www.bing.com/ping?sitemap=',
      method: 'GET',
      type: 'ping',
      enabled: true,
    },
    // More targets can be added as discovered
  ];

  /**
   * Generate XML sitemap for our agent cards
   * Makes us discoverable by web crawlers
   * Falls back to static sitemap if database is unavailable (autoscale cold start)
   */
  async generateAgentSitemap(hostname?: string): Promise<string> {
    const now = new Date().toISOString();
    const baseUrl = this.getBaseUrl(hostname);
    
    // Try to get agents from database, but don't fail if unavailable
    // CRITICAL: This MUST be bulletproof - Google Search Console needs valid XML
    let agents: any[] = [];
    try {
      if (db && globalAIAgents) {
        const result = await db.select().from(globalAIAgents);
        agents = Array.isArray(result) ? result : [];
      }
    } catch (dbError: any) {
      console.warn('⚠️ Database unavailable for sitemap, using static endpoints only:', dbError?.message || dbError);
      agents = []; // Ensure empty array on any failure
    }

    try {

      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Homepage
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${baseUrl}</loc>\n`;
      sitemap += `    <lastmod>${now}</lastmod>\n`;
      sitemap += `    <priority>1.0</priority>\n`;
      sitemap += `  </url>\n`;

      // Agent directory
      sitemap += `  <url>\n`;
      sitemap += `    <loc>${baseUrl}/api/agents/directory</loc>\n`;
      sitemap += `    <lastmod>${now}</lastmod>\n`;
      sitemap += `    <priority>0.9</priority>\n`;
      sitemap += `  </url>\n`;

      // x402 endpoints
      const x402Endpoints = [
        '/api/x402/capabilities',
        '/api/x402/create-payment',
        '/.well-known/x402.json',
        '/.well-known/agent.json',
        '/.well-known/agent-card.json',
        '/.well-known/agent-instructions.json',
        // x402 ping service
        '/x402/ping',
        '/x402',
        // Original 21 x402 services
        '/x402/multi-chain-balance',
        '/x402/gas-price-oracle',
        '/x402/token-price',
        '/x402/contract-scan',
        '/x402/wallet-risk',
        '/x402/trade-signals',
        '/x402/token-sentiment',
        '/x402/trending-tokens',
        '/x402/portfolio-tracker',
        '/x402/batch-quote',
        '/x402/whale-alerts',
        '/x402/transaction-builder',
        '/x402/token-metadata',
        '/x402/dex-liquidity',
        '/x402/approval-manager',
        '/x402/payment-processing',
        '/x402/instant-agent-wallet',
        '/x402/agent-create-wallet',
        '/x402/seamless-chain-bridge',
        '/x402/verified-agent-identity',
        '/x402/smart-contract-audit',
        '/x402/payment-processing',
        '/x402/compliance-consultation',
        // New 12 vertical expansion services
        '/x402/property-valuation',
        '/x402/lease-analysis',
        '/x402/construction-progress',
        '/x402/credit-risk-score',
        '/x402/fraud-detection',
        '/x402/compliance-check',
        '/x402/trading-signal',
        '/x402/portfolio-optimization',
        '/x402/sentiment-analysis',
        '/x402/arbitrage-scanner',
        '/x402/correlation-matrix',
        '/x402/risk-metrics',
        // Polymarket prediction market services (4 services)
        '/x402/polymarket-events',
        '/x402/polymarket-odds',
        '/x402/polymarket-search',
        '/x402/prediction-market-odds',
        // Traditional markets services (2 services) - added Dec 2025
        '/x402/stock-sentiment',
        '/x402/forex-sentiment',
        // Kalshi prediction market services (3 services) - added Feb 2026
        '/x402/kalshi-markets',
        '/x402/kalshi-odds',
        '/x402/kalshi-search',
        // Golden path & AI inference (2 services)
        '/x402/first-call',
        '/x402/ai-inference',
        // Solana (1 service)
        '/x402/solana-yield-finder',
        // SDK payment services (2 services)
        '/x402/sdk-payments-evm',
        '/x402/sdk-payments-solana',
        // Satellite & weather data services (6 services) - added Mar 2026
        '/x402/fire-alerts',
        '/x402/weather-imagery',
        '/x402/vegetation',
        '/x402/flood-detection',
        '/x402/air-quality',
        '/x402/land-use',
        // IoT & DePIN services (5 services) - added Mar 2026
        '/x402/fleet-telematics',
        '/x402/weather-station-data',
        '/x402/iot-sensor-reading',
        '/x402/iot-device-stream',
        '/x402/iot-bulk-data',
        // NASA Earthdata Intelligence API endpoints (Mar 2026)
        '/api/satellite/earthdata/catalog',
        '/api/satellite/earthdata/granules',
        '/api/satellite/earthdata/precipitation',
        '/api/satellite/earthdata/ocean-temp',
        '/api/satellite/earthdata/soil-moisture',
        '/api/satellite/earthdata/water-quality',
        // NASA Earthdata x402 direct routes (Jun 2026)
        '/x402/satellite-earthdata',
        '/x402/earthdata-sst',
        '/x402/earthdata-ocean-color',
        '/x402/earthdata-granules',
        '/x402/earthdata-precipitation',
        '/x402/earthdata-soil-moisture',
        // USDC Yield Vault (ERC-4626 on Base) (Jun 2026)
        '/api/yield/manifest',
        '/api/yield/rates',
        '/api/yield/stats',
        '/api/yield/deposit-tx',
        '/api/yield/redeem-tx',
        '/yield-portal',
        // Machine-to-machine discovery endpoints
        '/api/auth/capabilities',
        '/openapi.json',
        // AWI + WebMCP discovery manifests (Apr 2026)
        '/.well-known/webmcp.json',
        '/.well-known/awi.json',
        '/.well-known/mcp-integration.json',
        '/.well-known/mpp.json',
        '/.well-known/payment-methods.json',
        '/.well-known/pricing.json',
        // MCP integration guide (human-readable developer page)
        '/mcp-integration-guide'
      ];
      
      // GPT Action endpoints for ChatGPT integration
      const gptEndpoints = [
        '/api/gpt/credits-info',
        '/api/gpt/gas-prices',
        '/api/gpt/token-info',
        '/api/gpt/trending',
        '/api/gpt/wallet-analysis',
        '/api/gpt/trade-signals',
        '/api/gpt/polymarket',
        '/api/gpt/stock-sentiment',
        '/api/gpt/forex-sentiment',
        '/api/gpt/instant-wallet',
        '/api/gpt/arbitrage-scanner',
        '/api/gpt/multi-chain-balance',
        '/openapi-chatgpt.json'
      ];
      
      for (const endpoint of x402Endpoints) {
        sitemap += `  <url>\n`;
        sitemap += `    <loc>${baseUrl}${endpoint}</loc>\n`;
        sitemap += `    <lastmod>${now}</lastmod>\n`;
        sitemap += `    <priority>0.9</priority>\n`;
        sitemap += `  </url>\n`;
      }
      
      for (const endpoint of gptEndpoints) {
        sitemap += `  <url>\n`;
        sitemap += `    <loc>${baseUrl}${endpoint}</loc>\n`;
        sitemap += `    <lastmod>${now}</lastmod>\n`;
        sitemap += `    <priority>0.8</priority>\n`;
        sitemap += `  </url>\n`;
      }

      // SEO Service Pages - Server-side rendered, fully indexable (43 services)
      // These are the PRIMARY pages for Google to index (return 200 OK with full content)
      try {
        const catalog = serviceCatalogService.getCatalog();
        for (const service of catalog.services) {
          sitemap += `  <url>\n`;
          sitemap += `    <loc>${baseUrl}/services/${service.id}</loc>\n`;
          sitemap += `    <lastmod>${now}</lastmod>\n`;
          sitemap += `    <changefreq>weekly</changefreq>\n`;
          sitemap += `    <priority>0.9</priority>\n`;
          sitemap += `  </url>\n`;
        }
        console.log(`📍 Added ${catalog.services.length} SEO service pages to sitemap`);
      } catch (catalogError) {
        console.warn('⚠️ Failed to add SEO service pages to sitemap:', catalogError);
      }

      // User-facing pages - Products & Marketplace
      const userPages = [
        // Core Products
        { path: '/products/ai-agent-bundle', priority: '0.9' },
        { path: '/bundles', priority: '0.9' },
        { path: '/marketplace', priority: '0.9' },
        { path: '/ai-marketplace', priority: '0.9' },
        { path: '/x402-docs', priority: '0.8' },
        { path: '/developers', priority: '0.9' },
        { path: '/quickstart', priority: '0.8' },
        
        // Agent Registration & Management
        { path: '/ai-agent-registration', priority: '0.8' },
        { path: '/free-agent-registration', priority: '0.8' },
        { path: '/agent-dashboard', priority: '0.7' },
        { path: '/credits', priority: '0.7' },
        
        // Trading & Exchange
        { path: '/swap', priority: '0.9' },
        { path: '/buy-sell', priority: '0.9' },
        { path: '/p2p-transfer', priority: '0.9' },
        { path: '/dex-trading', priority: '0.8' },
        
        // Cryptocurrency Features - XRP
        { path: '/xrp', priority: '0.8' },
        { path: '/xrp/buy-sell', priority: '0.8' },
        { path: '/xrp/trade', priority: '0.8' },
        { path: '/xrp/explorer', priority: '0.7' },
        { path: '/xrp/liquidity', priority: '0.7' },
        { path: '/xrp/cross-border', priority: '0.8' },
        { path: '/xrp-ecosystem', priority: '0.7' },
        { path: '/xrp-dex-trading', priority: '0.7' },
        { path: '/xrp-cross-border-payments', priority: '0.7' },
        { path: '/xrp-rlusd-trading', priority: '0.7' },
        
        // Cryptocurrency Features - USDC
        { path: '/usdc', priority: '0.8' },
        { path: '/usdc/buy', priority: '0.8' },
        { path: '/usdc/send', priority: '0.8' },
        { path: '/usdc/bridge', priority: '0.7' },
        { path: '/usdc-buy', priority: '0.7' },
        { path: '/usdc-payments', priority: '0.7' },
        { path: '/usdc-enterprise', priority: '0.7' },
        { path: '/usdc-ecosystem-dashboard', priority: '0.7' },
        
        // User Dashboard & Wallet
        { path: '/wallet', priority: '0.8' },
        { path: '/wallet-management', priority: '0.7' },
        { path: '/cdp-wallet', priority: '0.7' },
        { path: '/dashboard', priority: '0.7' },
        { path: '/portfolio', priority: '0.7' },
        { path: '/transactions', priority: '0.7' },
        
        // Enterprise Features
        { path: '/enterprise', priority: '0.8' },
        { path: '/enterprise/api', priority: '0.7' },
        { path: '/enterprise/pricing', priority: '0.8' },
        { path: '/enterprise/compliance', priority: '0.7' },
        
        // Authentication & Account
        { path: '/login', priority: '0.6' },
        { path: '/signup', priority: '0.6' },
        { path: '/auth', priority: '0.6' },
        
        // Documentation & Support
        { path: '/docs', priority: '0.7' },
        { path: '/docs/getting-started', priority: '0.7' },
        { path: '/docs/api', priority: '0.7' },
        { path: '/docs/x402-protocol', priority: '0.8' },
        { path: '/faq', priority: '0.6' },
        { path: '/support', priority: '0.6' },
        { path: '/contact', priority: '0.6' },
        
        // SDK Documentation - AI Agent Payments (Jan 2026)
        { path: '/sdk', priority: '0.9' },
        { path: '/docs/sdk', priority: '0.9' },
        { path: '/docs/sdk/npm', priority: '0.8' },
        { path: '/docs/sdk/python', priority: '0.8' },
        { path: '/docs/sdk/solana', priority: '0.8' },
        { path: '/docs/sdk/docker', priority: '0.8' },
        { path: '/dashboard/api-keys', priority: '0.7' },
        
        // Solana Payments (Jan 2026)
        { path: '/solana', priority: '0.8' },
        { path: '/solana/payments', priority: '0.8' },
        { path: '/solana-pay', priority: '0.8' },
        
        // IoT & Device Payments (Jan 2026)
        { path: '/iot', priority: '0.9' },
        { path: '/iot/dashboard', priority: '0.7' },
        { path: '/iot/analytics', priority: '0.7' },
        { path: '/fleet', priority: '0.9' },
        { path: '/fleet/demo', priority: '0.7' },
        { path: '/weather', priority: '0.9' },
        { path: '/weather/demo', priority: '0.7' },
        { path: '/pilots/buy', priority: '0.9' },
        { path: '/pilot/onboard', priority: '0.7' },
        { path: '/partners', priority: '0.8' },
        { path: '/integrate', priority: '0.8' },
        { path: '/case-studies', priority: '0.7' },
        { path: '/credits/proof', priority: '0.6' },
        
        // Prediction Markets (Feb 2026)
        { path: '/predictions', priority: '0.9' },

        // Satellite & Space Data (Mar 2026)
        { path: '/satellite', priority: '0.9' },
        { path: '/satellite/earthdata', priority: '0.8' },
        
        // Partner & Business Pages
        { path: '/partner', priority: '0.8' },
        { path: '/pricing', priority: '0.9' },
        { path: '/plans', priority: '0.8' },
        { path: '/platform-integration', priority: '0.8' },
        { path: '/whitepaper', priority: '0.7' },
        { path: '/x402-partner', priority: '0.8' },
        { path: '/freelance-developer', priority: '0.7' },
        { path: '/emergency-consulting', priority: '0.7' },
        
        // Customer-facing pages
        { path: '/customer-dashboard', priority: '0.7' },
        { path: '/enterprise-portal', priority: '0.7' },
        { path: '/enterprise-outreach', priority: '0.6' },
        { path: '/marketplace-dashboard', priority: '0.7' },
        { path: '/order-management', priority: '0.6' },
        { path: '/my-orders', priority: '0.6' },
        { path: '/my-subscription', priority: '0.6' },
        { path: '/profile', priority: '0.6' },
        { path: '/settings', priority: '0.5' },
        { path: '/history', priority: '0.6' },
        { path: '/onramp', priority: '0.7' },
        { path: '/buy-crypto', priority: '0.7' },
        { path: '/crypto-prices', priority: '0.7' },
        { path: '/crypto-signals-agent', priority: '0.7' },
        { path: '/solana-showcase', priority: '0.7' },
        { path: '/auto-joiner', priority: '0.6' },
        { path: '/bots', priority: '0.6' },
        
        // Additional docs & info
        { path: '/documentation', priority: '0.7' },
        { path: '/contact-us', priority: '0.6' },
        { path: '/legal-disclaimers', priority: '0.5' },
        { path: '/circle-evidence', priority: '0.5' },
        { path: '/proof-of-execution', priority: '0.5' },
        { path: '/pilots/success', priority: '0.5' },
        { path: '/audit', priority: '0.6' },
        { path: '/audit-status', priority: '0.6' },
        { path: '/outreach', priority: '0.6' },
        
        // Legal & Company Info
        { path: '/about', priority: '0.5' },
        { path: '/privacy', priority: '0.5' },
        { path: '/privacy-policy', priority: '0.5' },
        { path: '/terms', priority: '0.5' },
        { path: '/terms-of-service', priority: '0.5' },
      ];
      
      for (const page of userPages) {
        sitemap += `  <url>\n`;
        sitemap += `    <loc>${baseUrl}${page.path}</loc>\n`;
        sitemap += `    <lastmod>${now}</lastmod>\n`;
        sitemap += `    <priority>${page.priority}</priority>\n`;
        sitemap += `  </url>\n`;
      }

      // Individual agent cards
      for (const agent of agents) {
        sitemap += `  <url>\n`;
        sitemap += `    <loc>${baseUrl}/agent/${agent.id}/.well-known/agent-card.json</loc>\n`;
        sitemap += `    <lastmod>${now}</lastmod>\n`;
        sitemap += `    <priority>0.8</priority>\n`;
        sitemap += `  </url>\n`;
      }

      sitemap += '</urlset>';

      return sitemap;
    } catch (error: any) {
      console.error('❌ Sitemap generation failed:', error?.message || error);
      // CRITICAL: Return minimal valid sitemap instead of throwing
      // This ensures Google Search Console can always fetch the sitemap
      return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${now}</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/sdk</loc>
    <lastmod>${now}</lastmod>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/solana</loc>
    <lastmod>${now}</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>`;
    }
  }

  /**
   * Ping search engines about our sitemap
   * Helps with crawler discovery
   */
  async pingSearchEngines(hostname?: string): Promise<{ success: boolean; results: any[] }> {
    const baseUrl = this.getBaseUrl(hostname);
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const results = [];

    for (const target of this.discoveryTargets.filter(t => t.type === 'ping' && t.enabled)) {
      try {
        const pingUrl = `${target.url}${encodeURIComponent(sitemapUrl)}`;
        
        console.log(`🔔 Pinging ${target.name}...`);
        const response = await fetch(pingUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'CoinRailz-AgentMarketplace/2.0',
          },
        });

        const result = {
          target: target.name,
          success: response.ok,
          status: response.status,
          timestamp: new Date().toISOString(),
        };

        results.push(result);
        
        if (response.ok) {
          console.log(`✅ ${target.name} pinged successfully`);
        } else {
          console.log(`⚠️ ${target.name} returned ${response.status}`);
        }
      } catch (error) {
        console.error(`❌ Failed to ping ${target.name}:`, error);
        results.push({
          target: target.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      success: results.some(r => r.success),
      results,
    };
  }

  /**
   * Create robots.txt content for better crawler access
   */
  generateRobotsTxt(hostname?: string): string {
    const baseUrl = this.getBaseUrl(hostname);
    return `User-agent: *
Allow: /
Allow: /api/agents/directory
Allow: /agent/*/\.well-known/agent-card.json
Allow: /.well-known/
Allow: /api/x402/

Sitemap: ${baseUrl}/sitemap.xml

# AI Agent Marketplace
# x402 Payment Protocol Support
# A2A 2.0 Discoverable Agents
# Contact: support@coinrailz.com
`;
  }

  /**
   * Execute full discovery campaign
   * Run this periodically to maintain discoverability
   */
  async executeDiscoveryCampaign(hostname?: string): Promise<{
    success: boolean;
    sitemap: boolean;
    searchEnginePings: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let sitemapGenerated = false;
    let successfulPings = 0;

    try {
      // Generate sitemap
      console.log('📍 Generating agent sitemap...');
      await this.generateAgentSitemap(hostname);
      sitemapGenerated = true;
      console.log('✅ Sitemap generated');
    } catch (error) {
      errors.push(`Sitemap generation failed: ${error}`);
    }

    try {
      // Ping search engines
      console.log('🔔 Pinging search engines...');
      const pingResults = await this.pingSearchEngines(hostname);
      successfulPings = pingResults.results.filter(r => r.success).length;
      console.log(`✅ ${successfulPings} search engines pinged successfully`);
    } catch (error) {
      errors.push(`Search engine pings failed: ${error}`);
    }

    return {
      success: errors.length === 0,
      sitemap: sitemapGenerated,
      searchEnginePings: successfulPings,
      errors,
    };
  }

  /**
   * Monitor for incoming A2A discovery attempts
   * Tracks which agents/systems are trying to discover us
   */
  async logDiscoveryAttempt(data: {
    sourceIp: string;
    userAgent: string;
    agentId?: string;
    endpoint: string;
  }): Promise<void> {
    try {
      console.log('🔍 Discovery attempt detected:', {
        ip: data.sourceIp,
        userAgent: data.userAgent,
        agentId: data.agentId,
        endpoint: data.endpoint,
        timestamp: new Date().toISOString(),
      });
      
      // In production, you'd log this to analytics/database
      // For now, console logging for monitoring
    } catch (error) {
      console.error('Failed to log discovery attempt:', error);
    }
  }
}

export const autonomousDiscoveryService = new AutonomousDiscoveryService();
