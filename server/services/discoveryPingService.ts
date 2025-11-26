import axios from 'axios';

/**
 * DISCOVERY PING SERVICE
 * 
 * When we discover an AI agent, we ping them with our service catalog URL.
 * This logs our presence in their server logs, creating reciprocal discovery.
 * 
 * Feature-flagged via DISCOVERY_PING_ENABLED environment variable.
 */

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
const PING_ENABLED = process.env.DISCOVERY_PING_ENABLED !== 'false';
const USER_AGENT = `CoinRailz-x402-Agent/1.0 (Discover: ${BASE_URL}/.well-known/agent.json)`;

interface PingResult {
  success: boolean;
  targetUrl: string;
  statusCode?: number;
  error?: string;
  latencyMs: number;
}

export class DiscoveryPingService {
  private static instance: DiscoveryPingService;
  private pingCount = 0;
  private successCount = 0;

  public static getInstance(): DiscoveryPingService {
    if (!DiscoveryPingService.instance) {
      DiscoveryPingService.instance = new DiscoveryPingService();
      console.log(`🔔 DiscoveryPingService initialized (enabled: ${PING_ENABLED})`);
    }
    return DiscoveryPingService.instance;
  }

  /**
   * Ping an agent we just discovered to leave our URL in their logs
   * 
   * Headers include:
   * - User-Agent with our discovery URL
   * - X-Discovery-Source pointing to our agent card
   * - X-402-Services pointing to our service catalog
   */
  async pingDiscoveredAgent(agentUrl: string): Promise<PingResult> {
    if (!PING_ENABLED) {
      return {
        success: false,
        targetUrl: agentUrl,
        error: 'Discovery ping disabled',
        latencyMs: 0
      };
    }

    const startTime = Date.now();
    this.pingCount++;

    try {
      const wellKnownUrl = this.getWellKnownUrl(agentUrl);
      
      const response = await axios.get(wellKnownUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'X-Discovery-Source': `${BASE_URL}/.well-known/agent.json`,
          'X-402-Services': `${BASE_URL}/x402/catalog`,
          'X-Agent-Protocol': 'x402/1.0',
          'X-Ping-Intent': 'discovery-reciprocal',
          'Referer': `${BASE_URL}/discover`,
        },
        timeout: 5000,
        validateStatus: () => true,
      });

      const latencyMs = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 500;
      
      if (success) {
        this.successCount++;
        console.log(`🔔 Discovery ping: ${agentUrl} -> ${response.status} (${latencyMs}ms)`);
      }

      return {
        success,
        targetUrl: agentUrl,
        statusCode: response.status,
        latencyMs
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      console.log(`⚠️ Discovery ping failed: ${agentUrl} - ${error.message}`);
      
      return {
        success: false,
        targetUrl: agentUrl,
        error: error.message,
        latencyMs
      };
    }
  }

  /**
   * Ping multiple agents in parallel (rate-limited)
   */
  async pingBatch(agentUrls: string[], concurrency = 5): Promise<PingResult[]> {
    const results: PingResult[] = [];
    
    for (let i = 0; i < agentUrls.length; i += concurrency) {
      const batch = agentUrls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.pingDiscoveredAgent(url))
      );
      results.push(...batchResults);
      
      if (i + concurrency < agentUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Get the .well-known URL for an agent
   */
  private getWellKnownUrl(agentUrl: string): string {
    const url = new URL(agentUrl);
    if (agentUrl.endsWith('.json')) {
      return agentUrl;
    }
    return `${url.origin}/.well-known/agent.json`;
  }

  /**
   * Get ping statistics
   */
  getStats(): { total: number; success: number; rate: string } {
    const rate = this.pingCount > 0 
      ? ((this.successCount / this.pingCount) * 100).toFixed(1)
      : '0.0';
    return {
      total: this.pingCount,
      success: this.successCount,
      rate: `${rate}%`
    };
  }
}

export const discoveryPingService = DiscoveryPingService.getInstance();
