import { Router, Request, Response } from "express";

const router = Router();

const BASE_URL = process.env.REPLIT_DEPLOYMENT === '1' 
  ? 'https://coinrailz.com' 
  : `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;

const FRAME_VERSION = "vNext";

const CURATED_SERVICES = [
  { id: "gas-price-oracle", name: "Gas Prices", emoji: "⛽", price: "$0.10", description: "Gas prices across 7 chains" },
  { id: "whale-alerts", name: "Whale Alerts", emoji: "🐋", price: "$0.35", description: "Latest whale movements" },
  { id: "token-price", name: "Token Price", emoji: "📊", price: "$0.25", description: "Real-time token prices" },
  { id: "wallet-risk", name: "Risk Check", emoji: "🔒", price: "$0.50", description: "Wallet risk scoring" },
  { id: "contract-scan", name: "Contract Scan", emoji: "🔍", price: "$1.00", description: "Smart contract security" },
  { id: "trending-tokens", name: "Trending", emoji: "🔥", price: "$0.50", description: "Trending tokens discovery" },
];

function generateFrameHtml(options: {
  title: string;
  description: string;
  imageUrl: string;
  buttons: { label: string; action: string; target?: string }[];
  postUrl?: string;
}): string {
  const buttonTags = options.buttons.slice(0, 4).map((btn, i) => {
    const idx = i + 1;
    let tags = `<meta property="fc:frame:button:${idx}" content="${btn.label}" />`;
    tags += `\n    <meta property="fc:frame:button:${idx}:action" content="${btn.action}" />`;
    if (btn.target) {
      tags += `\n    <meta property="fc:frame:button:${idx}:target" content="${btn.target}" />`;
    }
    return tags;
  }).join('\n    ');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta property="og:title" content="${options.title}" />
    <meta property="og:description" content="${options.description}" />
    <meta property="og:image" content="${options.imageUrl}" />
    <meta property="fc:frame" content="${FRAME_VERSION}" />
    <meta property="fc:frame:image" content="${options.imageUrl}" />
    <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
    ${options.postUrl ? `<meta property="fc:frame:post_url" content="${options.postUrl}" />` : ''}
    ${buttonTags}
    <title>${options.title}</title>
  </head>
  <body>
    <h1>${options.title}</h1>
    <p>${options.description}</p>
    <p>This is a Farcaster Frame. View it in Warpcast or a Farcaster client.</p>
  </body>
</html>`;
}

function generateOgImageSvg(title: string, subtitle: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <text x="600" y="250" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#00d4ff" text-anchor="middle">COIN RAILZ</text>
    <text x="600" y="340" font-family="Arial, sans-serif" font-size="36" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="600" y="400" font-family="Arial, sans-serif" font-size="24" fill="#888888" text-anchor="middle">${subtitle}</text>
    <text x="600" y="550" font-family="Arial, sans-serif" font-size="20" fill="#00d4ff" text-anchor="middle">x402 Micropayments | USDC on Base</text>
  </svg>`;
}

router.get("/", (req: Request, res: Response) => {
  const imageUrl = `${BASE_URL}/frame-og-image.png`;
  
  const html = generateFrameHtml({
    title: "Coin Railz - AI Agent Services",
    description: "Pay-per-call crypto intelligence for AI agents. Gas prices, whale alerts, risk scoring & more.",
    imageUrl,
    buttons: [
      { label: "⛽ Gas Prices ($0.10)", action: "post", target: `${BASE_URL}/api/frames/action/gas-price-oracle` },
      { label: "🐋 Whale Alerts ($0.35)", action: "post", target: `${BASE_URL}/api/frames/action/whale-alerts` },
      { label: "🔒 Risk Check ($0.50)", action: "post", target: `${BASE_URL}/api/frames/action/wallet-risk` },
      { label: "📋 More Services", action: "post", target: `${BASE_URL}/api/frames/services` },
    ],
    postUrl: `${BASE_URL}/api/frames/action`,
  });

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

router.get("/services", (req: Request, res: Response) => {
  const imageUrl = `${BASE_URL}/frame-og-image.png`;
  
  const html = generateFrameHtml({
    title: "Coin Railz Services",
    description: "Choose a service to get real-time crypto intelligence",
    imageUrl,
    buttons: [
      { label: "📊 Token Price ($0.25)", action: "post", target: `${BASE_URL}/api/frames/action/token-price` },
      { label: "🔍 Contract Scan ($1.00)", action: "post", target: `${BASE_URL}/api/frames/action/contract-scan` },
      { label: "🔥 Trending ($0.50)", action: "post", target: `${BASE_URL}/api/frames/action/trending-tokens` },
      { label: "⬅️ Back", action: "post", target: `${BASE_URL}/api/frames` },
    ],
    postUrl: `${BASE_URL}/api/frames/action`,
  });

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

router.get("/og-image.svg", (req: Request, res: Response) => {
  const svg = generateOgImageSvg("AI Agent Crypto Services", "Gas Prices • Whale Alerts • Risk Scoring • Contract Audits");
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(svg);
});

router.get("/og-image-services.svg", (req: Request, res: Response) => {
  const svg = generateOgImageSvg("All Services", "Token Prices • Contract Scan • Trending Tokens");
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(svg);
});

router.post("/action/:serviceId?", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  
  const serviceIdFromPath = req.params.serviceId;
  
  if (serviceIdFromPath) {
    const service = CURATED_SERVICES.find(s => s.id === serviceIdFromPath);
    
    if (service) {
      const x402Url = `${BASE_URL}/x402/${service.id}`;
      const imageUrl = `${BASE_URL}/frame-og-image.png`;
      const html = generateFrameHtml({
        title: `${service.emoji} ${service.name}`,
        description: `${service.description} - ${service.price} USDC`,
        imageUrl,
        buttons: [
          { label: `Pay ${service.price} & Get Data`, action: "link", target: x402Url },
          { label: "⬅️ Back", action: "post", target: `${BASE_URL}/api/frames` },
        ],
      });
      return res.send(html);
    }
  }
  
  const imageUrl = `${BASE_URL}/frame-og-image.png`;
  const html = generateFrameHtml({
    title: "Select a Service",
    description: "Choose a crypto intelligence service",
    imageUrl,
    buttons: [
      { label: "⛽ Gas Prices ($0.10)", action: "post", target: `${BASE_URL}/api/frames/action/gas-price-oracle` },
      { label: "🐋 Whale Alerts ($0.35)", action: "post", target: `${BASE_URL}/api/frames/action/whale-alerts` },
      { label: "🔒 Risk Check ($0.50)", action: "post", target: `${BASE_URL}/api/frames/action/wallet-risk` },
      { label: "📋 More Services", action: "post", target: `${BASE_URL}/api/frames/services` },
    ],
    postUrl: `${BASE_URL}/api/frames/action`,
  });
  res.send(html);
});

router.post("/services", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  const imageUrl = `${BASE_URL}/frame-og-image.png`;
  
  const html = generateFrameHtml({
    title: "More Services",
    description: "Additional crypto intelligence options",
    imageUrl,
    buttons: [
      { label: "📊 Token Price ($0.25)", action: "post", target: `${BASE_URL}/api/frames/action/token-price` },
      { label: "🔍 Contract Scan ($1.00)", action: "post", target: `${BASE_URL}/api/frames/action/contract-scan` },
      { label: "🔥 Trending ($0.50)", action: "post", target: `${BASE_URL}/api/frames/action/trending-tokens` },
      { label: "⬅️ Back", action: "post", target: `${BASE_URL}/api/frames/action` },
    ],
    postUrl: `${BASE_URL}/api/frames/action`,
  });
  res.send(html);
});

router.get("/catalog", (req: Request, res: Response) => {
  res.json({
    name: "Coin Railz Farcaster Frame",
    description: "Pay-per-call crypto intelligence for AI agents via x402",
    version: "1.0.0",
    frameUrl: `${BASE_URL}/api/frames`,
    services: CURATED_SERVICES.map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
      description: s.description,
      x402Endpoint: `${BASE_URL}/x402/${s.id}`,
    })),
    farcasterAccount: "@tkellogg1",
    documentation: "https://coinrailz.com/docs/farcaster-frame",
  });
});

export default router;
