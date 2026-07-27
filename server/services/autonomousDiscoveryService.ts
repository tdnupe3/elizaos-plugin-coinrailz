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
import { getCanonicalServiceCount } from '../utils/serviceCount';

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

      // Machine-readable discovery manifests (for AI crawlers and agent tooling)
      // Note: these are not HTML pages but are intentionally included for agent/tool discovery
      const discoveryManifests = [
        '/.well-known/x402.json',
        '/.well-known/agent.json',
        '/.well-known/agent-card.json',
        '/.well-known/agent-instructions.json',
        '/.well-known/webmcp.json',
        '/.well-known/awi.json',
        '/.well-known/mcp-integration.json',
        '/.well-known/mpp.json',
        '/.well-known/payment-methods.json',
        '/.well-known/pricing.json',
        '/openapi.json',
        '/mcp-integration-guide',
        '/yield-portal',
        '/solana-yield',
      ];

      for (const endpoint of discoveryManifests) {
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
      // Only include pages with confirmed SPA routes that return 200 and are not blocked by robots.txt
      const userPages = [
        // Core Products
        { path: '/products/ai-agent-bundle', priority: '0.9' },
        { path: '/bundles', priority: '0.9' },
        { path: '/ai-marketplace', priority: '0.9' },
        { path: '/developers', priority: '0.9' },
        { path: '/quickstart', priority: '0.8' },
        { path: '/docs', priority: '0.8' },

        // Agent Registration & Management
        { path: '/ai-agent-registration', priority: '0.8' },
        { path: '/free-agent-registration', priority: '0.8' },

        // Trading & Exchange
        { path: '/swap', priority: '0.9' },
        { path: '/p2p-transfer', priority: '0.9' },
        { path: '/dex-trading', priority: '0.8' },

        // Cryptocurrency Features - XRP
        { path: '/xrp-ecosystem', priority: '0.8' },
        { path: '/xrp-dex-trading', priority: '0.7' },
        { path: '/xrp-cross-border-payments', priority: '0.7' },
        { path: '/xrp-rlusd-trading', priority: '0.7' },

        // Cryptocurrency Features - USDC
        { path: '/usdc-buy', priority: '0.8' },
        { path: '/usdc-payments', priority: '0.7' },
        { path: '/usdc-enterprise', priority: '0.7' },
        { path: '/usdc-ecosystem-dashboard', priority: '0.7' },

        // Wallet
        { path: '/cdp-wallet', priority: '0.7' },

        // Enterprise Features
        { path: '/enterprise', priority: '0.8' },

        // Documentation & Support (only routes confirmed in App.tsx)
        { path: '/contact-us', priority: '0.6' },

        // SDK Documentation
        { path: '/sdk-landing', priority: '0.9' },
        { path: '/sdk-documentation', priority: '0.8' },
        { path: '/dashboard/api-keys', priority: '0.7' },

        // Solana Payments
        { path: '/solana-pay', priority: '0.8' },

        // IoT & Device Payments
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

        // Prediction Markets
        { path: '/predictions', priority: '0.9' },

        // Satellite & Space Data
        { path: '/satellite', priority: '0.9' },

        // Partner & Business Pages
        { path: '/partner', priority: '0.8' },
        { path: '/platform-integration', priority: '0.8' },

        // Customer-facing pages
        { path: '/onramp', priority: '0.7' },
        { path: '/crypto-prices', priority: '0.7' },
        { path: '/crypto-signals-agent', priority: '0.7' },
        { path: '/solana-showcase', priority: '0.7' },

        // Additional info
        { path: '/circle-evidence', priority: '0.5' },
        { path: '/pilots/success', priority: '0.5' },

        // Solutions / Compliance Landing Pages
        { path: '/solutions/mica-compliant-payments', priority: '0.9' },

        // Legal & Company Info
        { path: '/privacy-policy', priority: '0.5' },
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
    const svcCount = getCanonicalServiceCount();
    return `# Coin Railz Robots.txt
# Balances Google SEO with AI Agent Discoverability

User-agent: *
Allow: /

# ============================================
# AI AGENT DISCOVERY - ALWAYS ACCESSIBLE
# ============================================
Allow: /.well-known/
Allow: /.well-known/x402.json
Allow: /.well-known/agent.json
Allow: /.well-known/agent-card.json
Allow: /api/discovery/
Allow: /api/discovery/resources
Allow: /mcp/
Allow: /x402/catalog
Allow: /x402/payment-docs

# OpenAPI specs - allowed for AI agent/crawler discovery
Allow: /openapi.json
Allow: /openapi-x402-services.json

# ============================================
# PUBLIC MARKETING PAGES - INDEX THESE
# ============================================
Allow: /ai-marketplace
Allow: /enterprise
Allow: /dex-trading
Allow: /p2p-transfer
Allow: /developers
Allow: /docs

# ============================================
# BLOCK FROM GOOGLE (returns 4xx or requires auth)
# ============================================

# x402 paywalled endpoints (return HTTP 402 - not for Google indexing)
Disallow: /x402/ping
Disallow: /x402/trade-signals
Disallow: /x402/wallet-risk
Disallow: /x402/token-sentiment
Disallow: /x402/whale-alerts
Disallow: /x402/trending-tokens
Disallow: /x402/sentiment-analysis
Disallow: /x402/dex-liquidity
Disallow: /x402/contract-scan
Disallow: /x402/portfolio-optimization
Disallow: /x402/token-price
Disallow: /x402/portfolio-tracker
Disallow: /x402/multi-chain-balance
Disallow: /x402/arbitrage-scanner
Disallow: /x402/gas-price-oracle
Disallow: /x402/transaction-builder
Disallow: /x402/batch-quote
Disallow: /x402/seamless-chain-bridge
Disallow: /x402/trading-signal
Disallow: /x402/verified-agent-identity
Disallow: /x402/compliance-consultation
Disallow: /x402/agent-create-wallet
Disallow: /x402/property-valuation
Disallow: /x402/lease-analysis
Disallow: /x402/construction-progress
Disallow: /x402/credit-risk-score
Disallow: /x402/compliance-check
Disallow: /x402/fraud-detection
Disallow: /x402/risk-metrics
Disallow: /x402/instant-agent-wallet
Disallow: /x402/token-metadata
Disallow: /x402/correlation-matrix
Disallow: /x402/approval-manager
Disallow: /x402/polymarket-odds
Disallow: /x402/polymarket-events
Disallow: /x402/polymarket-search
Disallow: /x402/prediction-market-odds
Disallow: /x402/stock-sentiment
Disallow: /x402/forex-sentiment
Disallow: /x402/service/

# API endpoints (return JSON, not HTML)
Disallow: /api/gpt/
Disallow: /api/agents/
Disallow: /api/x402/
Disallow: /api/analytics/
Disallow: /api/auth/
Disallow: /api/payments/
Disallow: /api/wallets/
Disallow: /api/admin/

# Internal/private pages
Disallow: /admin
Disallow: /admin/
Disallow: /debug
Disallow: /test

# Authentication pages (no content for Google)
Disallow: /auth/
Disallow: /login
Disallow: /signup

# User dashboard (requires auth)
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /agent-dashboard
Disallow: /wallet-management
Disallow: /transactions
Disallow: /portfolio
Disallow: /credits

# Crawl-delay for respectful crawling
Crawl-delay: 1

# Sitemap for Google
Sitemap: ${baseUrl}/sitemap.xml

# LLMs.txt — structured content guide for AI crawlers
LLMs: ${baseUrl}/llms.txt

# AI Agent Marketplace — ${svcCount} paid x402 services
# x402 Payment Protocol | A2A 2.0 | MCP Discovery
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
