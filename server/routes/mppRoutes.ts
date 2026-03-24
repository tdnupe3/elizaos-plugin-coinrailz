/**
 * MPP (Machine Payments Protocol) Routes
 *
 * Registers /mpp/* endpoints for 5 flagship services.
 * These are PARALLEL to the /x402/* endpoints — same service logic, different payment protocol.
 *
 * Payment protocol: MPP (https://mpp.dev)
 *   - Challenge: WWW-Authenticate: Payment challenge="<base64>"
 *   - Credential: Authorization: Payment <base64-credential>
 *   - Settlement: Tempo pathUSD on-chain
 *
 * Services:
 *   POST /mpp/ping              $0.25 — Echo/discovery
 *   POST /mpp/first-call        $0.05 — Golden path onboarding
 *   POST /mpp/ai-inference      $0.05 — GPT-4o-mini inference
 *   POST /mpp/gas-price-oracle  $0.10 — Multi-chain gas prices
 *   POST /mpp/token-metadata    $0.10 — Token metadata lookup
 *
 * MPP Catalog: GET /mpp/catalog
 */

import { Router, Request, Response } from "express";
import { createMppPaymentMiddleware, MPP_PROTOCOL_VERSION } from "../middleware/mppPaymentMiddleware";
import { SERVICE_PRICING_USD } from "@shared/pricing";
import {
  gasPriceOracleService,
  tokenMetadataService,
} from "./microservices";

const router = Router();

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://coinrailz.com";

router.use((req, res, next) => {
  res.setHeader("X-MPP-Protocol", MPP_PROTOCOL_VERSION);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-KEY");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, X-MPP-Protocol");
  next();
});

router.options("*", (_req, res) => {
  res.status(204).end();
});

router.get("/catalog", (_req: Request, res: Response) => {
  const baseUrl = PUBLIC_BASE_URL;
  res.json({
    protocol: "mpp",
    protocolVersion: MPP_PROTOCOL_VERSION,
    provider: "Coin Railz",
    providerUrl: baseUrl,
    description: "Multi-chain AI agent payment infrastructure. Pay with pathUSD via Tempo.",
    manifestUrl: `${baseUrl}/.well-known/mpp.json`,
    services: [
      {
        id: "ping",
        name: "Ping / Echo",
        endpoint: `${baseUrl}/mpp/ping`,
        method: "POST",
        amount: SERVICE_PRICING_USD["ping"].toFixed(2),
        currency: "pathUSD",
        description: "Echo service. Verify MPP payment flow. Returns platform info.",
      },
      {
        id: "first-call",
        name: "First Paid Call (Golden Path)",
        endpoint: `${baseUrl}/mpp/first-call`,
        method: "POST",
        amount: SERVICE_PRICING_USD["first-call"].toFixed(2),
        currency: "pathUSD",
        description: "Canonical onboarding endpoint for new agents. $0.05 per call.",
      },
      {
        id: "ai-inference",
        name: "AI Inference (GPT-4o-mini)",
        endpoint: `${baseUrl}/mpp/ai-inference`,
        method: "POST",
        amount: SERVICE_PRICING_USD["ai-inference"].toFixed(2),
        currency: "pathUSD",
        description: "GPT-4o-mini inference via USDC micropayment.",
      },
      {
        id: "gas-price-oracle",
        name: "Gas Price Oracle",
        endpoint: `${baseUrl}/mpp/gas-price-oracle`,
        method: "POST",
        amount: SERVICE_PRICING_USD["gas-price-oracle"].toFixed(2),
        currency: "pathUSD",
        description: "Real-time gas prices for Ethereum, Base, Polygon, and more.",
      },
      {
        id: "token-metadata",
        name: "Token Metadata",
        endpoint: `${baseUrl}/mpp/token-metadata`,
        method: "POST",
        amount: SERVICE_PRICING_USD["token-metadata"].toFixed(2),
        currency: "pathUSD",
        description: "Token name, symbol, decimals, and contract info across chains.",
      },
    ],
    alternativeProtocols: {
      x402: {
        description: "Pay with USDC on Base or Ethereum via x402 protocol",
        catalog: `${baseUrl}/x402/catalog`,
        facilitator: "https://x402.coinbase.com",
      },
      apiKey: {
        description: "Prepaid credits via API key. Free $5 trial.",
        trialEndpoint: `${baseUrl}/api/m2m/credits/trial`,
        purchaseEndpoint: `${baseUrl}/api/m2m/credits/checkout/session`,
      },
    },
  });
});

router.post(
  "/ping",
  createMppPaymentMiddleware("ping", SERVICE_PRICING_USD["ping"]),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { message } = req.body;
    const responseTime = Date.now() - startTime;
    res.json({
      success: true,
      service: "Coin Railz MPP Payment Infrastructure",
      protocol: "mpp",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      echo: message || "pong",
      chains: ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism", "tempo"],
      servicesAvailable: 5,
      documentation: `${PUBLIC_BASE_URL}/developers`,
      catalog: `${PUBLIC_BASE_URL}/mpp/catalog`,
      mppSpec: "https://mpp.dev",
      responseTimeMs: responseTime,
    });
  }
);

router.post(
  "/first-call",
  createMppPaymentMiddleware("first-call", SERVICE_PRICING_USD["first-call"]),
  async (req: Request, res: Response) => {
    const { agentId } = req.body;
    res.json({
      success: true,
      goldenPath: true,
      protocol: "mpp",
      service: "MPP Golden Path — First Paid Call",
      sessionId: `mpp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      payment: {
        verified: true,
        amount: `${SERVICE_PRICING_USD["first-call"].toFixed(2)} pathUSD`,
        chain: "Tempo",
        timestamp: new Date().toISOString(),
      },
      welcome: "Payment confirmed. You have successfully integrated with Coin Railz via MPP.",
      ...(agentId && { agentId }),
      nextServices: [
        {
          id: "gas-price-oracle",
          name: "Gas Price Oracle",
          price: `$${SERVICE_PRICING_USD["gas-price-oracle"].toFixed(2)} pathUSD`,
          endpoint: `${PUBLIC_BASE_URL}/mpp/gas-price-oracle`,
        },
        {
          id: "ai-inference",
          name: "AI Inference (GPT-4o-mini)",
          price: `$${SERVICE_PRICING_USD["ai-inference"].toFixed(2)} pathUSD`,
          endpoint: `${PUBLIC_BASE_URL}/mpp/ai-inference`,
        },
        {
          id: "token-metadata",
          name: "Token Metadata",
          price: `$${SERVICE_PRICING_USD["token-metadata"].toFixed(2)} pathUSD`,
          endpoint: `${PUBLIC_BASE_URL}/mpp/token-metadata`,
        },
      ],
      catalog: `${PUBLIC_BASE_URL}/mpp/catalog`,
    });
  }
);

router.post(
  "/ai-inference",
  createMppPaymentMiddleware("ai-inference", SERVICE_PRICING_USD["ai-inference"]),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({
          success: false,
          error: "AI inference service not configured",
          reason: "OPENAI_API_KEY not set. Contact support@coinrailz.com.",
        });
      }

      const { prompt, model: requestedModel, maxTokens, systemPrompt } = req.body;

      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ success: false, error: "prompt is required" });
      }

      if (requestedModel && requestedModel !== "gpt-4o-mini") {
        return res.status(400).json({
          success: false,
          error: "Unsupported model",
          reason: "This endpoint supports gpt-4o-mini only.",
          supported_model: "gpt-4o-mini",
        });
      }

      const model = "gpt-4o-mini";
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const messages: { role: "system" | "user"; content: string }[] = [];
      if (systemPrompt && typeof systemPrompt === "string") {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const completion = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: Math.min(Number(maxTokens) || 1024, 4096),
      });

      const responseTime = Date.now() - startTime;
      return res.json({
        success: true,
        protocol: "mpp",
        content: completion.choices[0]?.message?.content || "",
        model: completion.model,
        usage: completion.usage,
        finishReason: completion.choices[0]?.finish_reason,
        responseTimeMs: responseTime,
        serviceVersion: "1.0.0",
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/gas-price-oracle",
  createMppPaymentMiddleware("gas-price-oracle", SERVICE_PRICING_USD["gas-price-oracle"]),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      let chains = req.body.chains;
      if (!chains && req.body.chain) chains = [req.body.chain];
      if (!chains || !Array.isArray(chains) || chains.length === 0) {
        chains = ["ethereum", "base", "polygon"];
      }
      const result = await gasPriceOracleService(chains);
      const responseTime = Date.now() - startTime;
      return res.json({ ...result, protocol: "mpp", responseTimeMs: responseTime });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/token-metadata",
  createMppPaymentMiddleware("token-metadata", SERVICE_PRICING_USD["token-metadata"]),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { tokenAddress, chain } = req.body;
      if (!tokenAddress || !chain) {
        return res.status(400).json({ success: false, error: "tokenAddress and chain are required" });
      }
      const result = await tokenMetadataService(tokenAddress, chain);
      const responseTime = Date.now() - startTime;
      return res.json({ ...result, protocol: "mpp", responseTimeMs: responseTime });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
