/**
 * X402 BAZAAR DISCOVERY ADAPTER - REAL PAYING AGENTS
 * 
 * Discovers AI agents from Coinbase's official x402 Bazaar (Discovery Layer).
 * These are REAL agents with active facilitators accepting USDC payments.
 * 
 * Source: https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources
 * Rate Limit: 10 requests/minute (Coinbase CDP API standard)
 */

import { BaseDiscoveryAdapter } from './baseAdapter';
import { DiscoveredAgentRaw } from '../services/agentDiscoveryService';
import crypto from 'crypto';

interface X402BazaarAccepts {
  asset: string;
  description?: string;
  extra?: Record<string, any>;
  maxAmountRequired: string;
  maxTimeoutSeconds?: number;
  mimeType?: string;
  network: string;
  outputSchema?: Record<string, any>;
  payTo: string;
  resource: string;
  scheme: string;
}

interface X402BazaarResource {
  accepts: X402BazaarAccepts[];
  lastUpdated: string;
  metadata?: Record<string, any>;
  resource: string;
  type: string;
  x402Version: number;
}

interface BazaarResponse {
  items: X402BazaarResource[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
  x402Version?: number;
}

export class X402BazaarAdapter extends BaseDiscoveryAdapter {
  public name = 'Coinbase x402 Bazaar Adapter';
  public expectedYield = 200; // Bazaar has hundreds of real services
  public timeout = 90000; // 90 seconds for pagination
  public rateLimit = 10; // 10 requests/minute per Coinbase CDP

  private bazaarEndpoint = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources';
  
  async discover(options: { maxPages?: number } = {}): Promise<DiscoveredAgentRaw[]> {
    console.log(`🎯 Starting Coinbase x402 Bazaar discovery (REAL paying agents)...`);
    
    // Discovery endpoint is PUBLIC - no credentials required
    // (Only payment verification needs CDP auth)

    const discoveredAgents: DiscoveredAgentRaw[] = [];
    const LIMIT = 100; // Items per page
    const maxPages = options.maxPages || 
                     parseInt(process.env.X402_BAZAAR_MAX_PAGES || '50', 10);
    let currentPage = 0;
    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore && currentPage < maxPages) {
        console.log(`📡 Fetching Bazaar page ${currentPage + 1}...`);
        // Check rate limit
        if (!this.checkRateLimit()) {
          await this.waitForRateLimit();
        }

        // Fetch page of resources from Bazaar (offset-based pagination)
        const response = await this.fetchBazaarPage(offset, LIMIT);
        
        if (!response) {
          console.log('⚠️ No response from Bazaar - stopping pagination');
          break;
        }

        // Process items (API returns 'items', not 'resources')
        const items = response.items || [];
        console.log(`📦 Processing page ${currentPage + 1}: ${items.length} resources (offset ${offset})`);
        
        if (items.length === 0) {
          console.log(`ℹ️ Page returned 0 items. Offset: ${offset}, Limit: ${LIMIT}, Response Items: ${JSON.stringify(response.items)}`);
        }

        for (const item of items) {
          // Normalize and add agent
          const agent = this.normalizeAgent(item, 'x402-bazaar');
          if (agent) {
            discoveredAgents.push(agent);
          }
        }

        // Update pagination (offset-based)
        const pagination = response.pagination;
        if (pagination) {
          offset += LIMIT;
          hasMore = offset < pagination.total;
          console.log(`   Progress: ${offset}/${pagination.total} (${Math.min(100, Math.round(offset / pagination.total * 100))}%)`);
        } else {
          hasMore = false;
        }
        
        currentPage++;

        // Respect rate limits with adaptive delay to avoid 429s
        if (hasMore && currentPage < maxPages) {
          // Use 7s delay to stay safely under Coinbase's 10 req/min rate limit
          const delayMs = parseInt(process.env.X402_BAZAAR_DELAY_MS || '7000', 10);
          await this.sleep(delayMs);
        }
      }

      console.log(`✅ Bazaar discovery complete: ${discoveredAgents.length} REAL agents from ${currentPage} pages`);
      
    } catch (error) {
      console.error(`❌ Bazaar discovery failed:`, error);
    }

    return discoveredAgents;
  }

  /**
   * Fetch a single page from Coinbase Bazaar
   * Discovery endpoint is PUBLIC - no authentication required
   * Uses offset-based pagination (limit/offset, not cursor)
   */
  private async fetchBazaarPage(offset: number, limit: number): Promise<BazaarResponse | null> {
    return this.retryWithBackoff(async () => {
      const url = `${this.bazaarEndpoint}?limit=${limit}&offset=${offset}`;

      // No authentication needed for discovery endpoint (it's public)
      const response = await this.safeFetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CoinRailz-x402-Platform/1.0'
        }
      }, 30000);

      if (!response.ok) {
        const responseText = await response.text();
        console.error(`❌ Bazaar API error: HTTP ${response.status}`);
        console.error(`   URL: ${url}`);
        console.error(`   Response: ${responseText.substring(0, 500)}`);
        
        if (response.status === 429) {
          // Parse retry-after header for smarter backoff
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            const waitSeconds = parseInt(retryAfter, 10);
            if (!isNaN(waitSeconds)) {
              console.warn(`⏰ Rate limit hit - waiting ${waitSeconds}s (from retry-after header)`);
              await this.sleep(waitSeconds * 1000);
            }
          }
          console.warn(`⏰ Rate limit hit (429) - will retry with backoff`);
          throw new Error('Rate limit exceeded');
        }
        if (response.status >= 500) {
          console.warn(`🔄 Server error (${response.status}) - will retry`);
          throw new Error(`Server error: ${response.status}`);
        }
        return null;
      }

      const data = await this.safeJsonParse(response);
      console.log(`✅ Bazaar API response: HTTP ${response.status}`);
      console.log(`   Items count: ${data?.items?.length || 0}`);
      console.log(`   Total available: ${data?.pagination?.total || 'unknown'}`);
      return data;
      
    }, 3, 2000); // 3 retries, 2-second base delay
  }

  /**
   * Generate Coinbase CDP authentication headers (HMAC signature)
   * Following: https://docs.cdp.coinbase.com/developer-platform/docs/authentication
   */
  private generateCDPAuthHeaders(method: string, url: string): Record<string, string> {
    const apiKeyId = process.env.CDP_API_KEY_ID!;
    const apiKeySecretBase64 = process.env.CDP_PRIVATE_KEY!; // CDP_API_KEY_SECRET as base64
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Parse URL to get path + query
    const urlObj = new URL(url);
    const requestPath = urlObj.pathname + urlObj.search;

    // Create signature payload: timestamp + method + path
    const payload = `${timestamp}${method}${requestPath}`;
    
    // CRITICAL FIX: Decode base64 secret before using in HMAC
    const decodedSecret = Buffer.from(apiKeySecretBase64, 'base64');
    
    // Generate HMAC-SHA256 signature and encode as base64 (not hex!)
    const signature = crypto
      .createHmac('sha256', decodedSecret)
      .update(payload)
      .digest('base64');

    return {
      'CB-ACCESS-KEY': apiKeyId,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
      'User-Agent': 'CoinRailz-x402-Platform/1.0'
    };
  }

  /**
   * Check if CDP credentials are configured
   */
  private hasValidCredentials(): boolean {
    return !!(process.env.CDP_API_KEY_ID && process.env.CDP_PRIVATE_KEY);
  }

  /**
   * Normalize Bazaar resource into DiscoveredAgentRaw format
   * Updated for x402 v2 API response format (items with accepts array)
   */
  protected normalizeAgent(rawData: X402BazaarResource, source: string): DiscoveredAgentRaw | null {
    try {
      if (!rawData.resource || !rawData.accepts || rawData.accepts.length === 0) {
        return null;
      }

      // Extract primary payment config from accepts array
      const primaryAccept = rawData.accepts[0];
      
      // Extract wallet address from payTo
      const wallet = primaryAccept.payTo;

      const agent: DiscoveredAgentRaw = {
        url: rawData.resource,
        source,
        channels: this.extractChannels(rawData),
        wallet,
        capabilities: {
          x402: true,
          x402Version: rawData.x402Version,
          pricing: {
            scheme: primaryAccept.scheme,
            maxAmount: primaryAccept.maxAmountRequired,
            network: primaryAccept.network,
            asset: primaryAccept.asset
          },
          networks: rawData.accepts.map(a => a.network)
        },
        metadata: {
          description: primaryAccept.description,
          lastUpdated: rawData.lastUpdated,
          type: rawData.type,
          mimeType: primaryAccept.mimeType,
          payTo: primaryAccept.payTo,
          assetInfo: primaryAccept.extra,
          outputSchema: primaryAccept.outputSchema,
          allAccepts: rawData.accepts.length > 1 ? rawData.accepts : undefined,
          ...rawData.metadata
        }
      };

      return this.validateAgent(agent) ? agent : null;
    } catch (error) {
      console.error(`❌ Error normalizing Bazaar resource:`, error);
      return null;
    }
  }

  /**
   * Extract communication channels from Bazaar resource
   */
  protected extractChannels(rawData: X402BazaarResource): any {
    return {
      x402: rawData.resource // Primary x402 endpoint
    };
  }

  /**
   * Extract agent URL from Bazaar resource
   */
  protected extractAgentUrl(rawData: X402BazaarResource): string {
    return rawData.resource;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Discovery endpoint is public - just verify API is reachable
      const response = await this.fetchBazaarPage(0, 1);
      const hasItems = response?.items && response.items.length > 0;
      const hasTotal = response?.pagination?.total && response.pagination.total > 0;
      return hasItems || hasTotal;
    } catch (error) {
      console.error(`❌ Bazaar health check failed:`, error);
      return false;
    }
  }
}
