import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  conversionFunnelEvents,
  x402Interactions,
  x402OfferLinks,
  creditsTransactions,
  apiKeys,
  endpointHits,
  discoveredAgents,
} from '@shared/schema';
import { sql, eq, gte, desc, count, and } from 'drizzle-orm';
import { emitFirstContactAsync, type ContactSource } from '../services/funnelHelper.js';

const router = Router();

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const daysBack = parseInt(req.query.days as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const [agentCount] = await db
      .select({ total: count() })
      .from(discoveredAgents);

    const [walletCount] = await db
      .select({ total: sql<number>`COUNT(DISTINCT wallet)` })
      .from(discoveredAgents)
      .where(sql`wallet IS NOT NULL AND wallet != ''`);

    const [interactionCount] = await db
      .select({ total: count() })
      .from(x402Interactions)
      .where(gte(x402Interactions.createdAt, since));

    const [paidInteractions] = await db
      .select({ total: count() })
      .from(x402Interactions)
      .where(and(
        gte(x402Interactions.createdAt, since),
        eq(x402Interactions.paymentReceived, true)
      ));

    const [challengesIssued] = await db
      .select({ total: count() })
      .from(x402Interactions)
      .where(and(
        gte(x402Interactions.createdAt, since),
        eq(x402Interactions.eventType, 'challenge-issued')
      ));

    const [offerClicks] = await db
      .select({ total: sql<number>`COALESCE(SUM(click_count), 0)` })
      .from(x402OfferLinks)
      .where(gte(x402OfferLinks.createdAt, since));

    const [offerConversions] = await db
      .select({ total: count() })
      .from(x402OfferLinks)
      .where(and(
        gte(x402OfferLinks.createdAt, since),
        sql`converted_at IS NOT NULL`
      ));

    const [creditPurchases] = await db
      .select({ 
        total: count(),
        totalValue: sql<number>`COALESCE(SUM(CAST(dollar_value AS NUMERIC)), 0)`
      })
      .from(creditsTransactions)
      .where(and(
        gte(creditsTransactions.createdAt, since),
        eq(creditsTransactions.type, 'purchase')
      ));

    const [activeKeys] = await db
      .select({ total: count() })
      .from(apiKeys)
      .where(eq(apiKeys.status, 'active'));

    const [endpointUsage] = await db
      .select({ total: count() })
      .from(endpointHits)
      .where(gte(endpointHits.createdAt, since));

    const funnelStages = await db
      .select({
        stage: conversionFunnelEvents.stage,
        total: count(),
      })
      .from(conversionFunnelEvents)
      .where(gte(conversionFunnelEvents.createdAt, since))
      .groupBy(conversionFunnelEvents.stage);

    const stageMap = Object.fromEntries(funnelStages.map(s => [s.stage, s.total]));

    const topServices = await db
      .select({
        service: x402Interactions.serviceName,
        hits: count(),
      })
      .from(x402Interactions)
      .where(and(
        gte(x402Interactions.createdAt, since),
        sql`service_name IS NOT NULL`
      ))
      .groupBy(x402Interactions.serviceName)
      .orderBy(desc(count()))
      .limit(10);

    const recentFunnelEvents = await db
      .select()
      .from(conversionFunnelEvents)
      .orderBy(desc(conversionFunnelEvents.createdAt))
      .limit(20);

    const uniqueAgentSources = await db
      .select({
        source: discoveredAgents.source,
        total: count(),
      })
      .from(discoveredAgents)
      .groupBy(discoveredAgents.source)
      .orderBy(desc(count()))
      .limit(10);

    const firstContactBySource = await db.execute(sql`
      SELECT metadata->>'source' AS source, COUNT(*) AS total
      FROM conversion_funnel_events
      WHERE stage = 'first_contact'
        AND created_at >= ${since.toISOString()}
      GROUP BY metadata->>'source'
    `);

    const sourceMap: Record<string, number> = {};
    for (const row of firstContactBySource.rows as any[]) {
      if (row.source) sourceMap[row.source] = Number(row.total);
    }

    res.json({
      success: true,
      period: { days: daysBack, since: since.toISOString() },
      inboundFunnel: {
        label: 'Inbound Agent Funnel (scanner → paid)',
        stage1_first_contact: {
          label: 'First Contact (any entry point)',
          count: stageMap['first_contact'] || 0,
          bySource: {
            x402_challenge: sourceMap['x402_challenge'] || 0,
            well_known: sourceMap['well_known'] || 0,
            direct_trial: sourceMap['direct_trial'] || 0,
            landing_page: sourceMap['landing_page'] || 0,
            direct_purchase: sourceMap['direct_purchase'] || 0,
            mcp_call: sourceMap['mcp_call'] || 0,
            buy_page: sourceMap['buy_page'] || 0,
          },
          note: 'Unique actors per 7-day window per source, HMAC-keyed, deduplicated',
        },
        stage2_trial_claimed: {
          label: 'Trial Key Claimed',
          count: stageMap['trial_claimed'] || 0,
        },
        stage3_first_x402_call: {
          label: 'First Authenticated x402 Call',
          count: stageMap['first_x402_call'] || 0,
        },
        stage4_credit_purchased: {
          label: 'Credits Purchased (paid upgrade)',
          count: stageMap['credit_purchased'] || 0,
        },
        conversionRates: {
          contactToTrial: (stageMap['first_contact'] || 0) > 0
            ? `${(((stageMap['trial_claimed'] || 0) / (stageMap['first_contact'] || 1)) * 100).toFixed(1)}%`
            : '0%',
          trialToFirstCall: (stageMap['trial_claimed'] || 0) > 0
            ? `${(((stageMap['first_x402_call'] || 0) / (stageMap['trial_claimed'] || 1)) * 100).toFixed(1)}%`
            : '0%',
          firstCallToPaid: (stageMap['first_x402_call'] || 0) > 0
            ? `${(((stageMap['credit_purchased'] || 0) / (stageMap['first_x402_call'] || 1)) * 100).toFixed(1)}%`
            : '0%',
        },
      },
      funnel: {
        stage1_discovered: {
          label: 'Agents Discovered',
          count: agentCount.total,
          uniqueWallets: walletCount.total,
        },
        stage2_outreach: {
          label: 'Outreach Sent',
          count: stageMap['outreach_sent'] || 0,
          walletsContacted: stageMap['wallet_contacted'] || 0,
        },
        stage3_engagement: {
          label: 'Engagement (402 Challenges)',
          x402Challenges: challengesIssued.total,
          totalInteractions: interactionCount.total,
          offerClicks: offerClicks.total,
        },
        stage4_credits: {
          label: 'Credit Purchases',
          purchases: creditPurchases.total,
          totalRevenue: `$${Number(creditPurchases.totalValue).toFixed(2)}`,
        },
        stage5_apiKeys: {
          label: 'API Keys Issued',
          activeKeys: activeKeys.total,
        },
        stage6_usage: {
          label: 'x402 Paid Usage',
          paidCalls: paidInteractions.total,
          endpointHits: endpointUsage.total,
        },
      },
      conversionRates: {
        discoveryToOutreach: agentCount.total > 0
          ? `${(((stageMap['outreach_sent'] || 0) / agentCount.total) * 100).toFixed(1)}%`
          : '0%',
        outreachToEngagement: (stageMap['outreach_sent'] || 0) > 0
          ? `${((challengesIssued.total / (stageMap['outreach_sent'] || 1)) * 100).toFixed(1)}%`
          : '0%',
        engagementToCredits: challengesIssued.total > 0
          ? `${((creditPurchases.total / challengesIssued.total) * 100).toFixed(1)}%`
          : '0%',
        creditsToPaidUsage: creditPurchases.total > 0
          ? `${((paidInteractions.total / creditPurchases.total) * 100).toFixed(1)}%`
          : '0%',
      },
      topServices,
      agentSources: uniqueAgentSources,
      recentEvents: recentFunnelEvents,
      offerConversions: offerConversions.total,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Funnel analytics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/event', async (req: Request, res: Response) => {
  try {
    const { stage, walletAddress, agentUrl, campaignId, channel, txHash, creditsAmount, apiKeyPrefix, serviceName, metadata } = req.body;

    if (!stage) {
      return res.status(400).json({ success: false, error: 'stage is required' });
    }

    const validStages = [
      'first_contact', 'trial_claimed',
      'agent_discovered', 'wallet_identified', 'outreach_sent', 'wallet_contacted',
      'offer_clicked', 'demo_requested', 'credit_purchased', 'api_key_issued',
      'first_x402_call', 'paid_usage', 'pilot_converted',
    ];

    if (!validStages.includes(stage)) {
      return res.status(400).json({ success: false, error: `Invalid stage. Valid: ${validStages.join(', ')}` });
    }

    const [event] = await db
      .insert(conversionFunnelEvents)
      .values({
        stage,
        walletAddress: walletAddress || null,
        agentUrl: agentUrl || null,
        campaignId: campaignId || null,
        channel: channel || null,
        txHash: txHash || null,
        creditsAmount: creditsAmount ? String(creditsAmount) : null,
        apiKeyPrefix: apiKeyPrefix || null,
        serviceName: serviceName || null,
        metadata: metadata || null,
      })
      .returning();

    res.json({ success: true, event });
  } catch (error: any) {
    console.error('Funnel event error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/first-contact', async (req: Request, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';

    const source = (req.body?.source as ContactSource) || 'landing_page';
    const path = req.body?.path as string | undefined;

    const validSources: ContactSource[] = [
      'x402_challenge', 'well_known', 'direct_trial',
      'landing_page', 'direct_purchase', 'mcp_call', 'buy_page',
    ];

    if (!validSources.includes(source)) {
      return res.status(400).json({
        success: false,
        error: `Invalid source. Valid: ${validSources.join(', ')}`,
      });
    }

    emitFirstContactAsync(ip, source, path);

    return res.json({ success: true, recorded: true });
  } catch (error: any) {
    console.error('Funnel first-contact error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/circle-briefing', async (req: Request, res: Response) => {
  try {
    const [agentCount] = await db
      .select({ total: count() })
      .from(discoveredAgents);

    const [walletCount] = await db
      .select({ total: sql<number>`COUNT(DISTINCT wallet)` })
      .from(discoveredAgents)
      .where(sql`wallet IS NOT NULL AND wallet != ''`);

    const sourceBreakdown = await db
      .select({
        source: discoveredAgents.source,
        total: count(),
      })
      .from(discoveredAgents)
      .groupBy(discoveredAgents.source)
      .orderBy(desc(count()));

    const [totalInteractions] = await db
      .select({ total: count() })
      .from(x402Interactions);

    const [paidInteractions] = await db
      .select({ 
        total: count(),
        revenue: sql<number>`COALESCE(SUM(CAST(payment_amount AS NUMERIC)), 0)`
      })
      .from(x402Interactions)
      .where(eq(x402Interactions.paymentReceived, true));

    const [creditRevenue] = await db
      .select({ 
        total: count(),
        totalValue: sql<number>`COALESCE(SUM(CAST(dollar_value AS NUMERIC)), 0)`
      })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.type, 'purchase'));

    const [activeKeys] = await db
      .select({ total: count() })
      .from(apiKeys)
      .where(eq(apiKeys.status, 'active'));

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const [recentDiscoveries] = await db
      .select({ total: count() })
      .from(discoveredAgents)
      .where(gte(discoveredAgents.discoveredAt, last7Days));

    const funnelStages = await db
      .select({
        stage: conversionFunnelEvents.stage,
        total: count(),
      })
      .from(conversionFunnelEvents)
      .groupBy(conversionFunnelEvents.stage);

    const stageMap = Object.fromEntries(funnelStages.map(s => [s.stage, s.total]));

    res.json({
      title: 'Coin Railz - Circle Partnership Briefing',
      date: new Date().toISOString().split('T')[0],
      meeting: 'February 18, 2026',
      platform: {
        x402Services: 58,
        chainsSupported: 8,
        primarySettlement: 'USDC on Base',
        verticals: ['Satellite Data (NASA/ESA)', 'IoT/DePIN Device Payments', 'Trading Intelligence', 'Prediction Markets'],
      },
      networkEffect: {
        totalAgentsDiscovered: agentCount.total,
        uniqueWallets: walletCount.total,
        agentsLast7Days: recentDiscoveries.total,
        sources: sourceBreakdown.map(s => ({ source: s.source, count: s.total })),
        bazaarAgents: sourceBreakdown.find(s => s.source === 'x402-bazaar')?.total || 0,
        elizaOSPlugins: sourceBreakdown.find(s => s.source === 'elizaos-registry')?.total || 0,
      },
      traction: {
        totalX402Interactions: totalInteractions.total,
        paidTransactions: paidInteractions.total,
        creditPurchases: creditRevenue.total,
        totalCreditRevenue: `$${Number(creditRevenue.totalValue).toFixed(2)}`,
        activeApiKeys: activeKeys.total,
      },
      conversionFunnel: {
        walletsContacted: stageMap['wallet_contacted'] || stageMap['outreach_sent'] || 0,
        offerClicks: stageMap['offer_clicked'] || 0,
        creditsPurchased: stageMap['credit_purchased'] || creditRevenue.total,
        pilotsConverted: stageMap['pilot_converted'] || 0,
      },
      verticals: {
        satelliteData: {
          name: 'Satellite Data Intelligence',
          description: 'FREE NASA/ESA data repackaged via x402 micropayments for AI agents',
          products: 6,
          dataSources: ['NASA FIRMS', 'NASA GIBS', 'ESA Copernicus', 'OpenAQ'],
          pricing: '$0.02-$0.15 per request',
          demoEndpoint: '/api/satellite/fire-alerts?demo=true',
          catalogEndpoint: '/api/satellite/catalog',
        },
        iotDevicePayments: {
          name: 'IoT/DePIN Device Payments',
          description: 'Production-grade device payment infrastructure for IoT networks',
          features: ['Device registry', 'Credits system', 'D2D transfers', 'Multi-chain USDC'],
          pricing: 'Volume-based credits packages ($50-$10,000)',
          dashboardEndpoint: '/iot/dashboard',
        },
      },
      competitiveAdvantage: [
        'FREE satellite data from NASA/ESA repackaged via x402 micropayments',
        'Only multi-chain x402 payment infrastructure (8 chains)',
        'Native Coinbase Bazaar integration with 12,462 indexed resources',
        'ElizaOS ecosystem integration (242 plugins discovered)',
        'Sub-$0.01 micropayments for AI agent data consumption',
      ],
      liveDemo: {
        fireAlertsDemo: '/api/satellite/fire-alerts?demo=true (sample data, no payment)',
        fireAlertsPaid: '/api/satellite/fire-alerts (returns 402 with payment instructions)',
        weatherDemo: '/api/satellite/weather-imagery?demo=true (sample data, no payment)',
        catalog: '/api/satellite/catalog',
        funnel: '/api/funnel/summary',
        campaignTargets: '/api/funnel/campaign-targets',
      },
      ask: 'Strategic partnership for USDC settlement infrastructure and Circle ecosystem access',
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Circle briefing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaign-targets', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const topWallets = await db.execute(sql`
      SELECT 
        wallet,
        COUNT(*) as endpoint_count,
        MAX(url) as sample_url,
        source,
        MAX(last_seen_at) as last_seen
      FROM discovered_agents
      WHERE wallet IS NOT NULL AND wallet != '' AND LENGTH(wallet) = 42
      GROUP BY wallet, source
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `);

    const alreadyContacted = await db
      .select({ wallet: conversionFunnelEvents.walletAddress })
      .from(conversionFunnelEvents)
      .where(eq(conversionFunnelEvents.stage, 'wallet_contacted'));

    const contactedSet = new Set(alreadyContacted.map(r => r.wallet?.toLowerCase()));

    const targets = topWallets.rows.map((row: any) => {
      const isContacted = contactedSet.has(row.wallet?.toLowerCase());
      return {
        wallet: row.wallet,
        endpointCount: Number(row.endpoint_count),
        source: row.source,
        sampleUrl: row.sample_url,
        lastSeen: row.last_seen,
        alreadyContacted: isContacted,
        priority: Number(row.endpoint_count) > 100 ? 'high' : Number(row.endpoint_count) > 20 ? 'medium' : 'low',
        estimatedCost: '$0.01',
      };
    });

    const uncontacted = targets.filter(t => !t.alreadyContacted);

    res.json({
      success: true,
      campaign: {
        name: 'circle-prep-outreach',
        totalTargets: targets.length,
        uncontacted: uncontacted.length,
        alreadyContacted: targets.length - uncontacted.length,
        estimatedTotalCost: `$${(uncontacted.length * 0.01).toFixed(2)}`,
        network: 'Base',
        method: 'On-chain memo (ETH transfer with embedded message)',
      },
      targets,
      readyToExecute: uncontacted.length > 0,
      executeEndpoint: 'POST /api/onchain-outreach/execute',
    });
  } catch (error: any) {
    console.error('Campaign targets error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;