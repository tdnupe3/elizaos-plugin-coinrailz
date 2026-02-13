import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface BazaarService {
  resource: string;
  type: string;
  x402Version: number;
  lastUpdated?: string;
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    payTo: string;
    maxAmountRequired?: string;
    maxTimeoutSeconds?: number;
    outputSchema?: any;
  }>;
  metadata?: any;
}

interface BazaarResponse {
  items: BazaarService[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

interface CrawlResult {
  totalServicesInBazaar: number;
  servicesCrawled: number;
  uniqueWallets: number;
  newWalletsAdded: number;
  existingWalletsUpdated: number;
  walletsByNetwork: Record<string, number>;
  topWallets: Array<{ wallet: string; serviceCount: number; sampleUrl: string; networks: string[] }>;
  errors: string[];
  durationMs: number;
}

const CDP_BAZAAR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources';
const PAGE_SIZE = 100;
const DELAY_BETWEEN_PAGES_MS = 5000;
const RETRY_DELAY_MS = 15000;
const MAX_RETRIES = 5;

async function fetchPage(offset: number, retries = 0): Promise<BazaarResponse | null> {
  try {
    const url = `${CDP_BAZAAR_URL}?type=http&limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url);

    if (response.status === 429) {
      if (retries < MAX_RETRIES) {
        const backoff = RETRY_DELAY_MS * Math.pow(2, retries);
        console.log(`⏳ Rate limited at offset ${offset}, waiting ${backoff / 1000}s (retry ${retries + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, backoff));
        return fetchPage(offset, retries + 1);
      }
      console.error(`❌ Rate limit exceeded after ${MAX_RETRIES} retries at offset ${offset}`);
      return null;
    }

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status} at offset ${offset}`);
      return null;
    }

    return await response.json() as BazaarResponse;
  } catch (error: any) {
    if (retries < MAX_RETRIES) {
      const backoff = RETRY_DELAY_MS * Math.pow(2, retries);
      console.log(`⚠️ Network error at offset ${offset}, retrying in ${backoff / 1000}s: ${error.message}`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchPage(offset, retries + 1);
    }
    console.error(`❌ Failed to fetch offset ${offset} after retries: ${error.message}`);
    return null;
  }
}

function extractWalletData(items: BazaarService[]): Map<string, {
  serviceCount: number;
  urls: string[];
  networks: Set<string>;
  prices: number[];
  metadata: any[];
}> {
  const walletMap = new Map<string, {
    serviceCount: number;
    urls: string[];
    networks: Set<string>;
    prices: number[];
    metadata: any[];
  }>();

  for (const item of items) {
    for (const accept of item.accepts) {
      const payTo = accept.payTo;
      if (!payTo) continue;

      const existing = walletMap.get(payTo) || {
        serviceCount: 0,
        urls: [],
        networks: new Set<string>(),
        prices: [],
        metadata: [],
      };

      existing.serviceCount++;
      if (existing.urls.length < 10) {
        existing.urls.push(item.resource);
      }
      existing.networks.add(accept.network || 'unknown');
      if (accept.maxAmountRequired) {
        existing.prices.push(Number(accept.maxAmountRequired));
      }
      if (item.metadata) {
        existing.metadata.push(item.metadata);
      }

      walletMap.set(payTo, existing);
    }
  }

  return walletMap;
}

function classifyWallet(wallet: string): 'evm' | 'solana' | 'unknown' {
  if (wallet.startsWith('0x') && wallet.length === 42) return 'evm';
  if (wallet.length >= 32 && wallet.length <= 44 && !wallet.startsWith('0x')) return 'solana';
  return 'unknown';
}

export async function crawlBazaarRegistry(maxPages?: number): Promise<CrawlResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log('🔍 Starting full Bazaar registry crawl...');

  const firstPage = await fetchPage(0);
  if (!firstPage) {
    return {
      totalServicesInBazaar: 0, servicesCrawled: 0, uniqueWallets: 0,
      newWalletsAdded: 0, existingWalletsUpdated: 0, walletsByNetwork: {},
      topWallets: [], errors: ['Failed to fetch first page'], durationMs: Date.now() - startTime,
    };
  }

  const totalServices = firstPage.pagination.total;
  const totalPages = Math.ceil(totalServices / PAGE_SIZE);
  const pagesToCrawl = maxPages ? Math.min(maxPages, totalPages) : totalPages;

  console.log(`📊 Bazaar has ${totalServices} services across ${totalPages} pages. Crawling ${pagesToCrawl} pages.`);

  const allWalletData = new Map<string, {
    serviceCount: number;
    urls: string[];
    networks: Set<string>;
    prices: number[];
    metadata: any[];
  }>();

  let servicesCrawled = 0;

  // Process first page
  const firstPageWallets = extractWalletData(firstPage.items);
  for (const [wallet, data] of firstPageWallets) {
    allWalletData.set(wallet, data);
  }
  servicesCrawled += firstPage.items.length;
  console.log(`📄 Page 1/${pagesToCrawl}: ${firstPage.items.length} services, ${firstPageWallets.size} wallets`);

  // Crawl remaining pages
  for (let page = 1; page < pagesToCrawl; page++) {
    const offset = page * PAGE_SIZE;

    await new Promise(r => setTimeout(r, DELAY_BETWEEN_PAGES_MS));

    const pageData = await fetchPage(offset);
    if (!pageData) {
      errors.push(`Failed to fetch page ${page + 1} (offset ${offset})`);
      continue;
    }

    const pageWallets = extractWalletData(pageData.items);
    for (const [wallet, data] of pageWallets) {
      const existing = allWalletData.get(wallet);
      if (existing) {
        existing.serviceCount += data.serviceCount;
        for (const url of data.urls) {
          if (existing.urls.length < 10) existing.urls.push(url);
        }
        for (const net of data.networks) existing.networks.add(net);
        existing.prices.push(...data.prices);
      } else {
        allWalletData.set(wallet, data);
      }
    }

    servicesCrawled += pageData.items.length;

    if ((page + 1) % 10 === 0) {
      console.log(`📄 Page ${page + 1}/${pagesToCrawl}: ${servicesCrawled} services crawled, ${allWalletData.size} unique wallets`);
    }
  }

  console.log(`✅ Crawl complete: ${servicesCrawled} services, ${allWalletData.size} unique wallets`);

  // Store in database
  let newCount = 0;
  let updatedCount = 0;
  const walletsByNetwork: Record<string, number> = {};

  for (const [wallet, data] of allWalletData) {
    const walletType = classifyWallet(wallet);
    const networkList = Array.from(data.networks);
    for (const net of networkList) {
      walletsByNetwork[net] = (walletsByNetwork[net] || 0) + 1;
    }

    const primaryUrl = data.urls[0] || '';

    try {
      const existing = await db.select()
        .from(discoveredAgents)
        .where(eq(discoveredAgents.wallet, wallet))
        .limit(1);

      if (existing.length > 0) {
        await db.update(discoveredAgents)
          .set({
            lastSeenAt: new Date(),
            score: Math.min(100, data.serviceCount * 5),
            capabilities: {
              serviceCount: data.serviceCount,
              networks: networkList,
              walletType,
              sampleUrls: data.urls,
              avgPrice: data.prices.length > 0
                ? (data.prices.reduce((a, b) => a + b, 0) / data.prices.length / 1e6).toFixed(4)
                : null,
            },
            metadata: {
              ...(typeof existing[0].metadata === 'object' && existing[0].metadata !== null ? existing[0].metadata : {}),
              bazaarServiceCount: data.serviceCount,
              bazaarNetworks: networkList,
              lastCrawled: new Date().toISOString(),
            },
          })
          .where(eq(discoveredAgents.wallet, wallet));
        updatedCount++;
      } else {
        // Check if URL already exists
        const existingUrl = await db.select()
          .from(discoveredAgents)
          .where(eq(discoveredAgents.url, primaryUrl))
          .limit(1);

        if (existingUrl.length === 0 && primaryUrl) {
          await db.insert(discoveredAgents).values({
            url: primaryUrl,
            source: 'bazaar-crawl',
            wallet,
            status: 'new',
            score: Math.min(100, data.serviceCount * 5),
            capabilities: {
              serviceCount: data.serviceCount,
              networks: networkList,
              walletType,
              sampleUrls: data.urls,
              avgPrice: data.prices.length > 0
                ? (data.prices.reduce((a, b) => a + b, 0) / data.prices.length / 1e6).toFixed(4)
                : null,
            },
            metadata: {
              bazaarServiceCount: data.serviceCount,
              bazaarNetworks: networkList,
              lastCrawled: new Date().toISOString(),
            },
          });
          newCount++;
        } else {
          // URL exists but wallet doesn't match — update wallet
          if (existingUrl.length > 0) {
            await db.update(discoveredAgents)
              .set({ wallet, lastSeenAt: new Date() })
              .where(eq(discoveredAgents.url, primaryUrl));
            updatedCount++;
          }
        }
      }
    } catch (error: any) {
      errors.push(`DB error for wallet ${wallet.slice(0, 10)}: ${error.message}`);
    }
  }

  // Build top wallets list
  const sortedWallets = Array.from(allWalletData.entries())
    .sort((a, b) => b[1].serviceCount - a[1].serviceCount)
    .slice(0, 30);

  const topWallets = sortedWallets.map(([wallet, data]) => ({
    wallet,
    serviceCount: data.serviceCount,
    sampleUrl: data.urls[0] || '',
    networks: Array.from(data.networks),
  }));

  const result: CrawlResult = {
    totalServicesInBazaar: totalServices,
    servicesCrawled,
    uniqueWallets: allWalletData.size,
    newWalletsAdded: newCount,
    existingWalletsUpdated: updatedCount,
    walletsByNetwork,
    topWallets,
    errors,
    durationMs: Date.now() - startTime,
  };

  console.log(`📊 Results: ${newCount} new wallets, ${updatedCount} updated, ${errors.length} errors`);
  console.log(`⏱️ Duration: ${(result.durationMs / 1000).toFixed(1)}s`);

  return result;
}
