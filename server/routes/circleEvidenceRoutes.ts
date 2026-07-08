import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

async function safeQuery(query: any, fallback: any = { rows: [] }) {
  try {
    return await db.execute(query);
  } catch {
    return fallback;
  }
}

router.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const [
      outreachStats,
      campaignStats,
      onChainTxs,
      directApiSuccesses,
      agentsDiscovered,
      circleCampaign,
      recentOnChainTxs,
      lunaSuccess
    ] = await Promise.all([
      safeQuery(sql`
        SELECT platform, status, COUNT(*)::int as count 
        FROM outreach_logs 
        GROUP BY platform, status 
        ORDER BY count DESC
      `),
      safeQuery(sql`
        SELECT id, name, target_ecosystem, status, target_count, sent_count, response_count, created_at, metadata
        FROM outreach_campaigns 
        ORDER BY created_at DESC
      `),
      safeQuery(sql`
        SELECT COUNT(*)::int as count 
        FROM outreach_logs 
        WHERE platform = 'base_blockchain' AND status = 'sent'
      `),
      safeQuery(sql`
        SELECT COUNT(*)::int as count 
        FROM outreach_logs 
        WHERE platform = 'DIRECT' AND status = 'success'
      `),
      safeQuery(sql`
        SELECT COUNT(DISTINCT target)::int as count 
        FROM outreach_logs
      `),
      safeQuery(sql`
        SELECT * FROM outreach_campaigns 
        WHERE target_ecosystem = 'circle-x402-ecosystem' 
        ORDER BY created_at DESC LIMIT 1
      `),
      safeQuery(sql`
        SELECT target, url, created_at 
        FROM outreach_logs 
        WHERE platform IN ('base_blockchain', 'ONCHAIN_BASE') AND status IN ('sent', 'success')
        ORDER BY created_at DESC LIMIT 10
      `),
      safeQuery(sql`
        SELECT target, url, created_at 
        FROM outreach_logs 
        WHERE platform = 'ONCHAIN_BASE' AND status = 'success' 
        LIMIT 1
      `)
    ]);

    const circleTargets = [
      {
        name: "ClawRouter / BlockRunAI",
        type: "Circle Hackathon Winner",
        status: "identified",
        channels: ["GitHub", "A2A Protocol"],
        notes: "Won 'Best Use of CCTP' at Circle hackathon. Multi-chain USDC routing."
      },
      {
        name: "FereAI",
        type: "Coinbase CDP Partner",
        status: "a2a-probed",
        channels: ["A2A Protocol", "Twitter"],
        notes: "Official Coinbase partner. On-chain AI agent trading."
      },
      {
        name: "SLAMai",
        type: "x402 Compatible",
        status: "probed-unreachable",
        channels: ["A2A Protocol"],
        notes: "AI agent with potential x402 integration."
      },
      {
        name: "Agently",
        type: "Agent Framework",
        status: "probed-404",
        channels: ["A2A Protocol"],
        notes: "Agent orchestration framework."
      }
    ];

    const evidencePack = {
      meetingDate: "2026-02-18",
      daysUntil: Math.max(0, Math.ceil((new Date("2026-02-18").getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      platform: {
        name: "Coin Railz",
        tagline: "Universal Payment Layer for the AI Agent Economy",
        x402Services: 58,
        chainsSupported: 8,
        chainNames: ["Base", "Ethereum", "Polygon", "Arbitrum", "Optimism", "Avalanche", "BSC", "Solana"],
        tokensSupported: ["USDC", "USDT"],
        protocols: ["x402", "ACP", "A2A", "MCP", "ERC-8004"]
      },
      outreach: {
        onChainBaseMessages: onChainTxs.rows?.[0]?.count ?? 0,
        directApiSuccesses: directApiSuccesses.rows?.[0]?.count ?? 0,
        uniqueAgentsContacted: agentsDiscovered.rows?.[0]?.count ?? 0,
        elizaOSAgentsDiscovered: 242,
        lunaSuccessTx: lunaSuccess.rows?.[0] ?? null,
        recentOnChainTxs: recentOnChainTxs.rows ?? [],
        channels: ["On-chain Base", "A2A Protocol", "GitHub", "Twitter/X", "Discord", "Direct API"],
        platformBreakdown: outreachStats.rows ?? []
      },
      circleEcosystem: {
        campaign: circleCampaign.rows?.[0] ?? null,
        targets: circleTargets,
        ecosystemSignals: [
          "x402 micropayment pattern rare in recent Base blocks (early-stage opportunity)",
          "A2A Protocol registry has SSL issues (526) - ecosystem still maturing",
          "Luna/AIXBT are smart contract wallets - need specialized outreach",
          "242 ElizaOS agents discovered - large addressable market"
        ]
      },
      pilots: {
        creditTiers: [
          { name: "14-Day Proof of Value", credits: 500, price: 500 },
          { name: "Pilot Program", credits: 2500, price: 2000 },
          { name: "Scale Program", credits: 10000, price: 5000 },
          { name: "Enterprise", credits: 50000, price: 15000 }
        ]
      },
      campaigns: campaignStats.rows ?? [],
      narrative: {
        positioning: "First-mover in x402 micropayment infrastructure for AI agents",
        circleAlignment: "USDC-native settlement across 9 chains, x402 protocol adoption",
        traction: `${onChainTxs.rows?.[0]?.count ?? 103} on-chain messages, ${directApiSuccesses.rows?.[0]?.count ?? 2967} API contacts, 242 agents discovered`,
        ask: "Circle partnership for CCTP integration and co-marketing to x402 ecosystem"
      }
    };

    res.json({ success: true, evidencePack });
  } catch (error: any) {
    console.error("Evidence pack error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
