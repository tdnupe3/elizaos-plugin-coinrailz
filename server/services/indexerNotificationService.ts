import axios from 'axios';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
const USER_AGENT = `CoinRailz-x402-Agent/1.0 (+${BASE_URL})`;

interface IndexerPingResult {
  indexer: string;
  url: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  latencyMs: number;
}

const INDEXER_TARGETS = [
  {
    name: 'x402scan',
    url: 'https://www.x402scan.com',
    description: 'x402 Protocol Transaction Scanner - Primary AI agent indexer'
  },
  {
    name: 'Coinbase Developer Portal',
    url: 'https://portal.cdp.coinbase.com',
    description: 'Coinbase Developer Platform - Agent discovery'
  },
  {
    name: 'IndexNow (Bing/Yandex/DuckDuckGo)',
    url: 'https://api.indexnow.org/indexnow',
    description: 'IndexNow Protocol for instant search engine indexing',
    method: 'POST',
    body: {
      host: new URL(BASE_URL).hostname,
      key: 'cr402coinrailzplatform20260308',
      urlList: [
        `${BASE_URL}/`,
        `${BASE_URL}/x402/catalog`,
        `${BASE_URL}/.well-known/agent.json`,
        `${BASE_URL}/.well-known/agent-card.json`,
        `${BASE_URL}/.well-known/agent-instructions.json`,
        `${BASE_URL}/sitemap.xml`,
        `${BASE_URL}/robots.txt`
      ]
    }
  },
  {
    name: 'A2A Protocol Registry Ping',
    url: 'https://a2a.dev/api/agents/ping',
    description: 'A2A Protocol agent registry notification'
  }
];

export class IndexerNotificationService {
  private static instance: IndexerNotificationService;
  private hasNotifiedThisSession = false;

  public static getInstance(): IndexerNotificationService {
    if (!IndexerNotificationService.instance) {
      IndexerNotificationService.instance = new IndexerNotificationService();
    }
    return IndexerNotificationService.instance;
  }

  async pingIndexer(target: typeof INDEXER_TARGETS[0]): Promise<IndexerPingResult> {
    const startTime = Date.now();
    
    try {
      const config: any = {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json, text/html, */*',
          'X-Discovery-Source': `${BASE_URL}/.well-known/agent-card.json`,
          'X-402-Catalog': `${BASE_URL}/x402/catalog`,
          'X-Agent-Protocol': 'x402/1.0',
          'Referer': BASE_URL
        },
        timeout: 10000,
        validateStatus: () => true
      };

      let response;
      if ((target as any).method === 'POST') {
        config.headers['Content-Type'] = 'application/json';
        response = await axios.post(target.url, (target as any).body, config);
      } else {
        response = await axios.get(target.url, config);
      }

      const latencyMs = Date.now() - startTime;
      // Only 2xx and 202 (Accepted) are true successes
      // 3xx redirects and 4xx errors should be flagged
      const success = response.status >= 200 && response.status < 300;

      return {
        indexer: target.name,
        url: target.url,
        success,
        statusCode: response.status,
        latencyMs
      };
    } catch (error: any) {
      return {
        indexer: target.name,
        url: target.url,
        success: false,
        error: error.message,
        latencyMs: Date.now() - startTime
      };
    }
  }

  async notifyAllIndexers(force = false): Promise<{
    results: IndexerPingResult[];
    summary: string;
    allSucceeded: boolean;
  }> {
    if (this.hasNotifiedThisSession && !force) {
      console.log('📢 Indexers already notified this session, skipping... (use force=true to retry)');
      return {
        results: [],
        summary: 'Already notified this session (use force to retry)',
        allSucceeded: true
      };
    }

    console.log('📢 Notifying indexers that Coin Railz is back online...');
    console.log(`   Base URL: ${BASE_URL}`);
    console.log(`   Services: 37 x402 microservices available`);

    const results: IndexerPingResult[] = [];

    for (const target of INDEXER_TARGETS) {
      const result = await this.pingIndexer(target);
      results.push(result);
      
      const status = result.success 
        ? `✅ ${result.statusCode}` 
        : `❌ ${result.error || result.statusCode}`;
      console.log(`   ${target.name}: ${status} (${result.latencyMs}ms)`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const allSucceeded = successCount === results.length;
    const summary = `Notified ${successCount}/${results.length} indexers`;
    
    // Only mark as notified if all succeeded - allows retry on partial failure
    if (allSucceeded) {
      this.hasNotifiedThisSession = true;
      console.log(`📢 Indexer notification complete: ${summary}`);
    } else {
      console.log(`⚠️ Indexer notification partial: ${summary} - scheduling background retries`);
      const failedTargets = INDEXER_TARGETS.filter((t, i) => !results[i]?.success);
      this.scheduleRetries(failedTargets).catch(() => {});
    }

    return { results, summary, allSucceeded };
  }

  private async scheduleRetries(
    failedTargets: typeof INDEXER_TARGETS,
    maxAttempts = 3
  ): Promise<void> {
    let remaining = [...failedTargets];
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const delayMs = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      console.log(`📢 Indexer retry #${attempt}: attempting ${remaining.map(t => t.name).join(', ')}`);
      const stillFailing: typeof INDEXER_TARGETS = [];
      
      for (const target of remaining) {
        const result = await this.pingIndexer(target);
        const status = result.success
          ? `✅ ${result.statusCode}`
          : `❌ ${result.error || result.statusCode}`;
        console.log(`   Retry #${attempt} ${target.name}: ${status} (${result.latencyMs}ms)`);
        if (!result.success) stillFailing.push(target);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (stillFailing.length === 0) {
        this.hasNotifiedThisSession = true;
        console.log(`📢 Indexer retry #${attempt} complete: all targets notified`);
        return;
      }
      remaining = stillFailing;
    }
    console.log(`⚠️ Indexer retries exhausted after ${maxAttempts} attempts: ${remaining.map(t => t.name).join(', ')} still unreachable`);
  }

  async pingSpecificEndpoints(): Promise<IndexerPingResult[]> {
    const endpoints = [
      { name: 'Our Agent Card', url: `${BASE_URL}/.well-known/agent-card.json` },
      { name: 'Our x402 Catalog', url: `${BASE_URL}/x402/catalog` },
      { name: 'Our Sitemap', url: `${BASE_URL}/sitemap.xml` },
      { name: 'Our Robots.txt', url: `${BASE_URL}/robots.txt` }
    ];

    console.log('🔍 Self-check: Verifying our discovery endpoints are accessible...');
    
    const results: IndexerPingResult[] = [];
    
    for (const ep of endpoints) {
      const result = await this.pingIndexer({ 
        name: ep.name, 
        url: ep.url, 
        description: 'Self-check' 
      });
      results.push(result);
      
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${ep.name}: ${result.statusCode || result.error}`);
    }

    return results;
  }
}

export const indexerNotificationService = IndexerNotificationService.getInstance();
