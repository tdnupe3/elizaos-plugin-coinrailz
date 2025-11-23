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

interface X402BazaarResource {
  id: string;
  url: string;
  name: string;
  description?: string;
  facilitator: {
    id: string;
    network: string;
    status: 'active' | 'inactive';
  };
  pricing: {
    scheme: 'exact' | 'upto' | 'deferred';
    amount: string;
    currency: string;
  };
  discoverable: boolean;
  capabilities?: string[];
  endpoints?: Record<string, string>;
  metadata?: Record<string, any>;
}

interface BazaarResponse {
  resources: X402BazaarResource[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
  };
}

export class X402BazaarAdapter extends BaseDiscoveryAdapter {
  public name = 'Coinbase x402 Bazaar Adapter';
  public expectedYield = 200; // Bazaar has hundreds of real services
  public timeout = 90000; // 90 seconds for pagination
  public rateLimit = 10; // 10 requests/minute per Coinbase CDP

  private bazaarEndpoint = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources';
  
  async discover(options: { maxPages?: number } = {}): Promise<DiscoveredAgentRaw[]> {
    console.log(`🎯 Starting Coinbase x402 Bazaar discovery (REAL paying agents)...`);
    
    // Verify credentials
    if (!this.hasValidCredentials()) {
      console.error('❌ CDP credentials not configured - cannot access Bazaar');
      return [];
    }

    const discoveredAgents: DiscoveredAgentRaw[] = [];
    // Make maxPages configurable via options or env (default: 10 to capture more agents)
    const maxPages = options.maxPages || 
                     parseInt(process.env.X402_BAZAAR_MAX_PAGES || '10', 10);
    let currentPage = 0;
    let cursor: string | undefined;

    try {
      do {
        // Check rate limit
        if (!this.checkRateLimit()) {
          await this.waitForRateLimit();
        }

        // Fetch page of resources from Bazaar
        const response = await this.fetchBazaarPage(cursor);
        
        if (!response) {
          console.log('⚠️ No response from Bazaar - stopping pagination');
          break;
        }

        // Process resources
        const resources = response.resources || [];
        console.log(`📦 Processing page ${currentPage + 1}: ${resources.length} resources`);

        for (const resource of resources) {
          // Only include discoverable agents with active facilitators
          if (resource.discoverable && resource.facilitator.status === 'active') {
            const agent = this.normalizeAgent(resource, 'x402-bazaar');
            if (agent) {
              discoveredAgents.push(agent);
            }
          }
        }

        // Update pagination
        cursor = response.pagination?.cursor;
        currentPage++;

        // Respect rate limits (wait between pages)
        if (cursor && currentPage < maxPages) {
          await this.sleep(6000); // 6 seconds = 10 req/min
        }

      } while (cursor && currentPage < maxPages);

      console.log(`✅ Bazaar discovery complete: ${discoveredAgents.length} REAL agents from ${currentPage} pages`);
      
    } catch (error) {
      console.error(`❌ Bazaar discovery failed:`, error);
    }

    return discoveredAgents;
  }

  /**
   * Fetch a single page from Coinbase Bazaar with CDP authentication
   * Includes retry logic with exponential backoff for transient failures
   */
  private async fetchBazaarPage(cursor?: string): Promise<BazaarResponse | null> {
    return this.retryWithBackoff(async () => {
      const url = cursor 
        ? `${this.bazaarEndpoint}?cursor=${cursor}&limit=50`
        : `${this.bazaarEndpoint}?limit=50`;

      // Generate CDP HMAC authentication headers
      const headers = this.generateCDPAuthHeaders('GET', url);

      const response = await this.safeFetch(url, {
        method: 'GET',
        headers
      }, 30000);

      if (!response.ok) {
        const responseText = await response.text();
        console.error(`❌ Bazaar API error: HTTP ${response.status}`);
        console.error(`   URL: ${url}`);
        console.error(`   Response: ${responseText.substring(0, 500)}`);
        
        if (response.status === 429) {
          console.warn(`⏰ Rate limit hit (429) - will retry with backoff`);
          throw new Error('Rate limit exceeded');
        }
        if (response.status === 401 || response.status === 403) {
          console.error(`🔒 Authentication failed - check CDP credentials`);
          return null;
        }
        if (response.status >= 500) {
          console.warn(`🔄 Server error (${response.status}) - will retry`);
          throw new Error(`Server error: ${response.status}`);
        }
        return null;
      }

      const data = await this.safeJsonParse(response);
      console.log(`✅ Bazaar API response: HTTP ${response.status}`);
      console.log(`   Resources count: ${data?.resources?.length || 0}`);
      console.log(`   Has cursor: ${!!data?.pagination?.cursor}`);
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
   */
  protected normalizeAgent(rawData: X402BazaarResource, source: string): DiscoveredAgentRaw | null {
    try {
      const agent: DiscoveredAgentRaw = {
        url: rawData.url,
        source,
        channels: this.extractChannels(rawData),
        wallet: undefined, // Bazaar doesn't expose wallet addresses directly
        capabilities: {
          x402: true,
          pricing: rawData.pricing,
          facilitator: rawData.facilitator.network
        },
        metadata: {
          bazaarId: rawData.id,
          name: rawData.name,
          description: rawData.description,
          facilitator: {
            id: rawData.facilitator.id,
            network: rawData.facilitator.network,
            status: rawData.facilitator.status
          },
          pricing: {
            scheme: rawData.pricing.scheme,
            amount: rawData.pricing.amount,
            currency: rawData.pricing.currency
          },
          discoverable: rawData.discoverable,
          endpoints: rawData.endpoints,
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
    const channels: any = {
      x402: rawData.url // Primary x402 endpoint
    };

    // Add additional endpoints if available
    if (rawData.endpoints) {
      Object.assign(channels, rawData.endpoints);
    }

    return channels;
  }

  /**
   * Extract agent URL from Bazaar resource
   */
  protected extractAgentUrl(rawData: X402BazaarResource): string {
    return rawData.url;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.hasValidCredentials()) {
        return false;
      }

      // Try to fetch first page without storing results
      const response = await this.fetchBazaarPage();
      return !!response;
    } catch (error) {
      return false;
    }
  }
}
