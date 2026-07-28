/**
 * SSR Meta Routes — Server-Side Rendering for Crawler Visibility
 *
 * Social bots (Twitter/X, LinkedIn, Slack), AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, Applebot-Extended), and Googlebot cannot execute JavaScript.
 * They receive only the static loading shell from client/index.html.
 *
 * This module intercepts requests to priority marketing pages, detects crawler
 * User-Agents, and returns a complete HTML response with:
 *   - Per-route <title>, <meta name="description">, canonical, OG tags, Twitter tags
 *   - JSON-LD structured data
 *   - Semantic HTML body (h1, paragraphs, feature lists) readable by all crawlers
 *   - All standard <script> and SPA bootstrap tags so real browsers can still hydrate
 *
 * Registration: import and mount BEFORE serveStatic / setupVite in appMain.ts.
 */

import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Crawler User-Agent detection
// ---------------------------------------------------------------------------

const CRAWLER_UA_PATTERNS = [
  /Googlebot/i,
  /Googlebot-Image/i,
  /Googlebot-Video/i,
  /bingbot/i,
  /BingPreview/i,
  /Baiduspider/i,
  /Slurp/i,
  /DuckDuckBot/i,
  /facebookexternalhit/i,
  /facebot/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /Slack-ImgProxy/i,
  /WhatsApp/i,
  /TelegramBot/i,
  /GPTBot/i,
  /ClaudeBot/i,
  /Claude-Web/i,
  /PerplexityBot/i,
  /Applebot/i,
  /anthropic-ai/i,
  /CCBot/i,
  /ChatGPT-User/i,
  /Diffbot/i,
  /ia_archiver/i,
  /archive\.org_bot/i,
  /SemrushBot/i,
  /AhrefsBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /PetalBot/i,
  /YandexBot/i,
  /rogerbot/i,
  /spbot/i,
  /OgScraper/i,
  /Iframely/i,
  /Prerender/i,
  /HeadlessChrome/i,
  /x402-observer/i,
  /x402all-freshness/i,
];

export function isCrawler(ua: string | undefined): boolean {
  if (!ua) return false;
  return CRAWLER_UA_PATTERNS.some((p) => p.test(ua));
}

// ---------------------------------------------------------------------------
// Per-route SEO metadata + semantic HTML body content
// ---------------------------------------------------------------------------

interface RouteSSRConfig {
  title: string;
  description: string;
  keywords: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  /** JSON-LD object (will be JSON.stringify'd) */
  structuredData: object;
  /** Semantic HTML to render inside <main> — visible to crawlers */
  bodyHtml: string;
}

const BASE_URL = 'https://coinrailz.com';
const OG_IMAGE = `${BASE_URL}/og-image.png?v=20260728`;

const SSR_ROUTES: Record<string, RouteSSRConfig> = {
  '/': {
    title: 'Coin Railz | Payment Infrastructure for AI Agents — API Key in 60 Seconds',
    description:
      'Let your agents buy DeFi, IoT, satellite data, and prediction market feeds autonomously. API key in ~60 seconds via card, or x402 on-chain USDC for advanced flows. From $0.05/call.',
    keywords:
      'AI agent payments, pay per call API, x402 protocol, USDC yield vault, ERC-4626 yield, Base blockchain yield, coinrailz-agentkit, micropayments, USDC payments, agentic commerce, MCP payments, IoT payments, satellite data API, prediction markets API, DeFi API',
    canonical: BASE_URL,
    ogTitle: 'Coin Railz | Payment Infrastructure for AI Agents',
    ogDescription:
      'Let your agents buy DeFi, IoT, satellite data, and prediction market feeds autonomously. API key in ~60 seconds via card — or x402 on-chain USDC for advanced flows.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Coin Railz | Payment Infrastructure for AI Agents',
    twitterDescription:
      'Let your agents buy DeFi, IoT, satellite data, and prediction market feeds autonomously. API key in ~60 seconds via card — or x402 on-chain USDC for advanced flows.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Coin Railz',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      url: BASE_URL,
      description:
        '78 pay-per-call APIs for AI agents across DeFi, IoT, satellite data, prediction markets, and RWA tokenization. Get an API key in ~60 seconds via card, or pay on-chain with USDC via x402.',
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '0.05',
        highPrice: '10.00',
        description: '78 pay-per-call APIs from $0.05/call.',
      },
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>Curated Machine-Payable Data for AI Agents</h1>
      <p>78 pay-per-call APIs for crypto &amp; trading intelligence, satellite &amp; IoT data, RWA tokenization, and prediction markets — built for autonomous agents. API key in ~60 seconds via card, or x402 on-chain USDC for advanced flows. From $0.05/call.</p>
      <ul>
        <li>API Key in ~60 Seconds — instant access via card payment</li>
        <li>78 Pay-Per-Call APIs across DeFi, IoT, satellite data, and prediction markets</li>
        <li>x402 Protocol — on-chain USDC micropayments, live on AWS CloudFront, Solana, and Base</li>
        <li>Coinbase Agentic Wallets — non-custodial, multi-chain (Base, Ethereum, Polygon, Arbitrum, Solana)</li>
        <li>USDC Yield Vault — ERC-4626 on Base, auto-routing across Aave v3, Compound v3, and Morpho Blue</li>
        <li>ElizaOS, AgentKit, and MCP compatible</li>
      </ul>
      <h2>IoT &amp; Satellite Data Payments</h2>
      <p>Access NASA Earthdata and ESA Copernicus satellite data, plus fleet telematics and weather sensor feeds via x402 micropayments — no subscription required.</p>
      <h2>Prediction Market Intelligence</h2>
      <p>Real-time Kalshi and Polymarket data for autonomous trading agents. Pay only for the data you consume.</p>
      <h2>AI Agent Marketplace</h2>
      <p>Hire AI agents or offer your own services with 85% commission rates and atomic settlement.</p>
    `,
  },

  '/ai-marketplace': {
    title: 'Agentic AI Marketplace — Autonomous Agents with Agent-to-Agent Payment Rails | Coin Railz',
    description:
      'Revolutionary agentic commerce platform featuring autonomous AI agents with programmable money capabilities, agent-to-agent settlement, and intent mandates for seamless trading automation. 85% commission with atomic settlement.',
    keywords:
      'AI agent marketplace, hire AI agents, agentic commerce, autonomous agents, agent-to-agent payments, programmable money, intent mandates, multi-agent orchestration, atomic settlement, AI trading',
    canonical: `${BASE_URL}/ai-marketplace`,
    ogTitle: 'Agentic AI Marketplace | Coin Railz',
    ogDescription:
      'Autonomous AI agents with agent-to-agent payment rails. 85% commission, atomic settlement, and programmable money capabilities.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Agentic AI Marketplace | Coin Railz',
    twitterDescription:
      'Hire AI agents or offer services. 85% commission rates, atomic settlement, and intent mandates for seamless trading automation.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Marketplace',
      name: 'Coin Railz AI Agent Marketplace',
      url: `${BASE_URL}/ai-marketplace`,
      description:
        'Agentic commerce platform with autonomous AI agents, agent-to-agent payment rails, and programmable money capabilities.',
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>AI Agent Marketplace</h1>
      <p>A revolutionary agentic commerce platform where autonomous AI agents transact directly with each other using programmable money, intent mandates, and atomic settlement.</p>
      <ul>
        <li>85% commission rates for service providers</li>
        <li>Atomic settlement — instant finality with no counterparty risk</li>
        <li>Agent-to-agent (A2A) payment rails — direct agent commerce without human intermediaries</li>
        <li>Intent mandates — agents negotiate and execute transactions autonomously</li>
        <li>Multi-agent orchestration for complex trading workflows</li>
      </ul>
      <h2>How It Works</h2>
      <p>Register your AI agent, set your service pricing, and start earning immediately. Coin Railz handles payment processing, settlement, and compliance — so you can focus on building great agents.</p>
    `,
  },

  '/enterprise': {
    title: 'Autonomous Financial Services & DLT Settlement Systems | Enterprise Agentic AI | Coin Railz',
    description:
      'Enterprise autonomous financial services with DLT settlement systems, agentic AI infrastructure, cross-chain atomic swaps, and interoperable payment infrastructure. Token-versus-token (TvT) arrangements for institutional clients.',
    keywords:
      'enterprise fintech, autonomous financial services, DLT settlement, agentic AI infrastructure, cross-chain atomic swaps, interoperable payments, token-versus-token, TvT, institutional crypto, enterprise blockchain',
    canonical: `${BASE_URL}/enterprise`,
    ogTitle: 'Enterprise Agentic AI & DLT Settlement | Coin Railz',
    ogDescription:
      'Production-ready blockchain infrastructure and compliance tools for banks and institutions. DLT settlement, cross-chain atomic swaps, and agentic AI infrastructure.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Enterprise Crypto Infrastructure | Coin Railz',
    twitterDescription:
      'Autonomous financial services with DLT settlement systems, agentic AI infrastructure, and cross-chain atomic swaps for institutional clients.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'FinancialService',
      name: 'Coin Railz Enterprise',
      url: `${BASE_URL}/enterprise`,
      description:
        'Enterprise blockchain infrastructure and agentic AI payment rails for institutional financial services.',
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>Enterprise Crypto Infrastructure</h1>
      <h2>Powering the Future of Institutional Digital Assets</h2>
      <p>Production-ready blockchain infrastructure and compliance tools for banks, institutions, and enterprise fintech teams. Built on DLT settlement systems with agentic AI-native architecture.</p>
      <ul>
        <li>DLT Settlement Systems — distributed ledger settlement with instant finality</li>
        <li>Cross-chain atomic swaps — trustless exchange across EVM chains and Solana</li>
        <li>Token-versus-token (TvT) arrangements for institutional trades</li>
        <li>Interoperable payment infrastructure — connect to existing banking rails</li>
        <li>Enterprise security — SOC 2 aligned, KYC/AML compliance built-in</li>
        <li>99.9% uptime SLA with dedicated support</li>
        <li>Global compliance — MiCA, FinCEN, and FATF compatible</li>
      </ul>
      <h2>Agentic AI Infrastructure</h2>
      <p>Deploy autonomous financial agents that execute complex multi-step transactions, manage treasury positions, and settle cross-chain trades — all without manual intervention.</p>
    `,
  },

  '/iot': {
    title: 'IoT Payments — Monetize Device Data | Fleet Telematics & Weather Sensors | Coin Railz',
    description:
      'Payment infrastructure for IoT devices and sensor networks. Usage-based billing for fleet telematics ($19-49/vehicle/month) and weather data ($49-199/month). EU Data Act compliant. 85% revenue share.',
    keywords:
      'IoT payments, device data monetization, M2M payments, usage-based billing, fleet telematics, weather sensors, industrial IoT, EU Data Act, machine-to-machine payments, sensor data marketplace',
    canonical: `${BASE_URL}/iot`,
    ogTitle: 'IoT Payments — Monetize Your Device Data | Coin Railz',
    ogDescription:
      'Usage-based billing and payment rails for IoT devices. 85% revenue share. Fleet telematics, weather sensors, industrial IoT.',
    ogImage: OG_IMAGE,
    twitterTitle: 'IoT Device Payments | Coin Railz',
    twitterDescription:
      'Payment infrastructure for IoT devices and sensor networks. EU Data Act compliant. 85% revenue share.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Coin Railz IoT Payments',
      applicationCategory: 'BusinessApplication',
      url: `${BASE_URL}/iot`,
      description: 'Payment infrastructure for IoT device data monetization and machine-to-machine transactions.',
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>Monetize Your Device Data</h1>
      <p>Payment infrastructure for IoT devices and sensor networks. Enable machine-to-machine (M2M) transactions with usage-based billing and instant settlement — EU Data Act compliant.</p>
      <ul>
        <li>85% revenue share for data providers</li>
        <li>Fleet telematics — $19-49/vehicle/month, usage-based pricing</li>
        <li>Weather &amp; environmental sensors — $49-199/month per feed</li>
        <li>Industrial IoT — custom pricing for manufacturing and logistics</li>
        <li>EU Data Act compliant data sharing framework</li>
        <li>x402 micropayments — autonomous agents pay per data point</li>
      </ul>
      <h2>Machine-to-Machine Payments</h2>
      <p>Your devices and AI agents transact autonomously. No human approval required for data purchases under defined thresholds.</p>
    `,
  },

  '/fleet': {
    title: 'Fleet Telematics Data API — Reduce Claims, Improve ETAs | Coin Railz',
    description:
      'Access fleet telematics data to reduce insurance claims 3-8% and improve ETA accuracy 15-25%. GPS tracking, driver behavior analytics, and vehicle diagnostics via usage-based pricing.',
    keywords:
      'fleet telematics, fleet data API, GPS tracking data, driver behavior analytics, vehicle diagnostics, insurance telematics, ETA accuracy, fleet management API, usage-based insurance, UBI data',
    canonical: `${BASE_URL}/fleet`,
    ogTitle: 'Fleet Telematics Data API | Coin Railz',
    ogDescription:
      'Reduce insurance claims 3-8% and improve ETA accuracy 15-25% with fleet telematics data. GPS, driver behavior, diagnostics. Pay only for data you use.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Fleet Telematics Data | Coin Railz',
    twitterDescription: 'GPS, driver behavior, and vehicle diagnostics data. Reduce claims 3-8%. Improve ETAs 15-25%.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'DataCatalog',
      name: 'Coin Railz Fleet Telematics Data',
      url: `${BASE_URL}/fleet`,
      description: 'Fleet telematics data API with GPS tracking, driver behavior analytics, and vehicle diagnostics.',
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>Reduce Claims. Improve ETAs. Pay Only for Data You Use.</h1>
      <p>Access real-time fleet telematics data including GPS tracking, driver behavior scores, and vehicle diagnostics. Usage-based pricing — pay only for the data points you consume.</p>
      <ul>
        <li>Reduce insurance loss ratios 3-8% with driver behavior data</li>
        <li>Improve ETA accuracy 15-25% with real-time GPS and route analytics</li>
        <li>GPS location, speed, and route history</li>
        <li>Driver behavior scores — harsh braking, acceleration, cornering</li>
        <li>Vehicle diagnostics — engine health, fuel consumption, idle time</li>
        <li>30-day pilot available — no long-term contract required</li>
      </ul>
      <h2>Use Cases</h2>
      <p>Insurance telematics (UBI/PHYD), last-mile logistics optimization, fleet maintenance scheduling, and AI-powered driver coaching.</p>
    `,
  },

  '/weather': {
    title: 'Weather & Environmental Data Marketplace — Sensor Monetization | Coin Railz',
    description:
      'Sell hyperlocal weather and environmental sensor data. $49-199/month per feed. Agriculture, insurance, and energy sector buyers. 85% revenue share.',
    keywords:
      'weather data API, environmental sensor data, hyperlocal weather, weather data marketplace, AgTech weather, insurance weather data, energy weather data, sensor monetization, weather data monetization',
    canonical: `${BASE_URL}/weather`,
    ogTitle: 'Weather & Environmental Data Marketplace | Coin Railz',
    ogDescription:
      'Sell hyperlocal weather and environmental sensor data. $49-199/month per feed. 85% revenue share. Agriculture, insurance, and energy buyers.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Weather Data Marketplace | Coin Railz',
    twitterDescription:
      'Monetize your weather sensors. $49-199/month per feed. 85% revenue share. AgTech, insurance, and energy buyers.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'DataCatalog',
      name: 'Coin Railz Weather Data Marketplace',
      url: `${BASE_URL}/weather`,
      description: 'Marketplace for hyperlocal weather and environmental sensor data with micropayment settlement.',
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>Sell Your Sensor Data</h1>
      <p>A marketplace for hyperlocal weather and environmental sensor data. Connect your sensors and start earning from agriculture, insurance, and energy sector data buyers.</p>
      <ul>
        <li>85% revenue share for data providers</li>
        <li>$49-199/month per data feed, based on data quality and location</li>
        <li>Agriculture buyers — crop yield prediction, frost alerts, soil moisture</li>
        <li>Insurance buyers — parametric coverage triggers, catastrophe modeling</li>
        <li>Energy buyers — solar irradiance, wind speed forecasting, demand planning</li>
        <li>x402 micropayments — per-query pricing for AI agent consumers</li>
      </ul>
      <h2>Supported Sensor Types</h2>
      <p>Temperature, humidity, precipitation, wind speed/direction, atmospheric pressure, soil moisture, air quality (PM2.5, CO2, NOx), UV index, and solar irradiance sensors.</p>
    `,
  },

  '/satellite': {
    title: 'Satellite Data APIs — NASA & ESA Space Intelligence via x402 Micropayments | Coin Railz',
    description:
      'Access satellite data from NASA Earthdata and ESA Copernicus via x402 micropayments. Fire alerts, GPM precipitation, sea surface temperature, soil moisture, NDVI vegetation, and more. From $0.25/call.',
    keywords:
      'satellite data API, NASA Earthdata API, ESA Copernicus API, x402 satellite data, fire detection API, NDVI API, satellite imagery API, geospatial data API, remote sensing API, earth observation API',
    canonical: `${BASE_URL}/satellite`,
    ogTitle: 'NASA & ESA Satellite Data APIs | Coin Railz',
    ogDescription:
      'Access NASA Earthdata and ESA Copernicus satellite intelligence via x402 micropayments. Fire alerts, NDVI, precipitation, sea surface temperature. From $0.25/call.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Satellite Data APIs — NASA & ESA | Coin Railz',
    twitterDescription:
      'Access space-based intelligence via x402 micropayments. Fire detection, NDVI vegetation, flood monitoring, air quality, chlorophyll.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'DataCatalog',
      name: 'Coin Railz Satellite Data APIs',
      url: `${BASE_URL}/satellite`,
      description: 'NASA Earthdata and ESA Copernicus satellite data accessible via x402 micropayments.',
      dataset: [
        { '@type': 'Dataset', name: 'MODIS Fire Detection', description: 'Near real-time fire alerts from NASA MODIS and VIIRS sensors' },
        { '@type': 'Dataset', name: 'NDVI Vegetation Index', description: 'Normalized Difference Vegetation Index from Landsat and MODIS' },
        { '@type': 'Dataset', name: 'GPM Precipitation', description: 'Global precipitation measurements from NASA GPM constellation' },
        { '@type': 'Dataset', name: 'Sea Surface Temperature', description: 'Global SST from MODIS Aqua and Terra satellites' },
        { '@type': 'Dataset', name: 'Ocean Color Chlorophyll', description: 'Phytoplankton chlorophyll concentration from NASA PACE' },
      ],
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>NASA &amp; ESA Satellite Data APIs</h1>
      <p>Access real-time and historical satellite intelligence from NASA Earthdata and ESA Copernicus via x402 micropayments. Pay only for what you use — from $0.25/call.</p>
      <ul>
        <li>MODIS Fire Detection — near real-time fire alerts from NASA MODIS and VIIRS sensors</li>
        <li>NDVI Vegetation Index — crop health and deforestation monitoring from Landsat &amp; MODIS</li>
        <li>GPM Precipitation — global rainfall measurements from NASA's GPM constellation</li>
        <li>Sea Surface Temperature — global SST from MODIS Aqua and Terra</li>
        <li>Ocean Color Chlorophyll — phytoplankton data from NASA PACE</li>
        <li>Soil Moisture — SMAP L4 daily global soil moisture</li>
        <li>Flood Detection — Sentinel-1 SAR flood mapping from ESA Copernicus</li>
      </ul>
      <h2>Designed for Autonomous Agents</h2>
      <p>AI agents request satellite data on-demand and pay per call via USDC on Base. No API keys, no subscriptions — just x402 micropayments with instant settlement.</p>
    `,
  },

  '/dex-trading': {
    title: 'DEX Trading & Aggregation — Multi-Chain Crypto Exchange | Coin Railz',
    description:
      'Trade cryptocurrencies across multiple chains with DEX aggregation, real-time pricing, and professional trading tools. Support for XRP, USDC, ETH, SOL, and more.',
    keywords:
      'DEX trading, DEX aggregator, multi-chain trading, crypto exchange, decentralized exchange, XRP trading, USDC swap, DeFi trading, liquidity aggregation, on-chain trading',
    canonical: `${BASE_URL}/dex-trading`,
    ogTitle: 'DEX Trading & Aggregation | Coin Railz',
    ogDescription:
      'Multi-chain DEX aggregation with real-time pricing. Trade XRP, USDC, ETH, SOL and more across Base, Ethereum, Polygon, Arbitrum, and Solana.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Multi-Chain DEX Trading | Coin Railz',
    twitterDescription: 'DEX aggregation across Base, Ethereum, Polygon, Arbitrum, and Solana. Best-price routing for AI agents.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'ExchangeService',
      name: 'Coin Railz DEX Aggregator',
      url: `${BASE_URL}/dex-trading`,
      description: 'Multi-chain DEX aggregation with best-price routing across EVM chains and Solana.',
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>Multi-Chain DEX Trading &amp; Aggregation</h1>
      <p>Trade cryptocurrencies across multiple blockchains with best-price DEX aggregation, real-time pricing feeds, and professional trading tools optimized for autonomous AI agents.</p>
      <ul>
        <li>DEX aggregation across Uniswap, Curve, Balancer, Raydium, and more</li>
        <li>Best-price routing — split routes across multiple DEXes for optimal execution</li>
        <li>Supported chains: Base, Ethereum, Polygon, Arbitrum, Optimism, BSC, Solana</li>
        <li>Tokens: USDC, ETH, SOL, XRP, BTC, and 100+ ERC-20 tokens</li>
        <li>Real-time price feeds with sub-second latency</li>
        <li>Slippage protection and MEV-resistant routing</li>
      </ul>
      <h2>Built for AI Agent Trading</h2>
      <p>Autonomous trading agents execute swaps programmatically via the x402 protocol. Pay per trade with no subscription fees.</p>
    `,
  },

  '/developers': {
    title: 'Developer Documentation — x402 Protocol & AI Agent Payment APIs | Coin Railz',
    description:
      'Integrate Coin Railz x402 payment APIs in your AI agent. TypeScript, Python, and curl examples. 78 APIs across DeFi, IoT, satellite data, and prediction markets. Pay-per-call, no subscriptions.',
    keywords:
      'x402 developer docs, AI agent API documentation, payment API integration, x402 protocol guide, TypeScript payment SDK, Python payment SDK, agent payment API, DeFi API docs, IoT payment API',
    canonical: `${BASE_URL}/developers`,
    ogTitle: 'Developer Documentation | Coin Railz x402 APIs',
    ogDescription:
      '78 pay-per-call APIs for AI agents. TypeScript and Python SDKs. x402 protocol integration guide. No subscriptions — pay per API call with USDC.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Developer Docs | Coin Railz',
    twitterDescription:
      '78 pay-per-call APIs for AI agents. x402 protocol, TypeScript + Python SDKs. DeFi, IoT, satellite data, and prediction markets.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      name: 'Coin Railz Developer Documentation',
      url: `${BASE_URL}/developers`,
      description: 'Developer documentation for integrating x402 payment APIs into AI agents.',
      author: { '@type': 'Organization', name: 'Kellogg Holdings LLC' },
      mainEntityOfPage: `${BASE_URL}/developers`,
    },
    bodyHtml: `
      <h1>Curated Machine-Payable Data for AI Agents</h1>
      <p>78 crypto, satellite/IoT, and prediction-market APIs powered by the x402 protocol. Pay per call with USDC — no API keys, no subscriptions required.</p>
      <h2>How x402 Payments Work</h2>
      <ol>
        <li>Send USDC payment to the platform wallet address on Base</li>
        <li>Wait for payment confirmation (typically 2-3 seconds on Base)</li>
        <li>Call the API with your payment proof in the X-PAYMENT header</li>
      </ol>
      <ul>
        <li>Node.js / TypeScript and Python SDKs available</li>
        <li>9 chains supported: Base, Ethereum, Polygon, Arbitrum, Optimism, BSC, Solana, XRP Ledger, and more</li>
        <li>From $0.05/call — DeFi data, IoT feeds, satellite imagery, prediction market intelligence</li>
        <li>ElizaOS, AgentKit, and MCP server integration guides included</li>
        <li>OpenAPI 3.0 specification for all 78 endpoints</li>
      </ul>
    `,
  },

  '/quickstart': {
    title: 'Quickstart Guide — AI Agent Payments in Under 5 Minutes | Coin Railz',
    description:
      'Get AI agent crypto microservices running in under 5 minutes. Install the NPM or Python SDK, configure your wallet, and make your first API call with x402 payment.',
    keywords:
      'quickstart guide, AI agent payments tutorial, x402 quickstart, NPM SDK install, Python SDK install, agent payment setup, first API call, payment integration tutorial',
    canonical: `${BASE_URL}/quickstart`,
    ogTitle: 'Quickstart Guide — AI Agent Payments | Coin Railz',
    ogDescription:
      'Get running in under 5 minutes. Install NPM or Python SDK, configure your USDC wallet, make your first x402 API call.',
    ogImage: OG_IMAGE,
    twitterTitle: 'Quickstart: AI Agent Payments | Coin Railz',
    twitterDescription: 'Get AI agent payments running in under 5 minutes. NPM: @coinrailz/agent-payments. Python: coinrailz.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Quickstart: AI Agent Payments with Coin Railz',
      url: `${BASE_URL}/quickstart`,
      description: 'Get AI agent crypto microservices running in under 5 minutes.',
      step: [
        { '@type': 'HowToStep', name: 'Install', text: 'npm install @coinrailz/agent-payments or pip install coinrailz' },
        { '@type': 'HowToStep', name: 'Configure', text: 'Set your USDC wallet address and private key in environment variables' },
        { '@type': 'HowToStep', name: 'Execute', text: 'Call your first API with automatic x402 payment handling' },
      ],
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>Quickstart Guide</h1>
      <p>Get AI agent crypto microservices running in under 5 minutes.</p>
      <h2>Step 1: Install</h2>
      <p>Install the SDK for your language: <code>npm install @coinrailz/agent-payments</code> or <code>pip install coinrailz</code>. Docker image also available: <code>docker pull tdnupe3/agent-payments</code>.</p>
      <h2>Step 2: Configure</h2>
      <p>Set your USDC wallet address and private key as environment variables. The SDK handles wallet generation, payment signing, and x402 protocol negotiation automatically.</p>
      <h2>Step 3: Execute</h2>
      <p>Make your first API call. The SDK automatically detects 402 Payment Required responses, signs and submits USDC payment, and retries with the payment proof.</p>
      <ul>
        <li>78 APIs available immediately after setup</li>
        <li>First call free with no wallet setup needed (API key path)</li>
        <li>Full x402 path: pay with USDC on Base for advanced usage</li>
      </ul>
    `,
  },

  '/sdk-landing': {
    title: 'AI Agent Payments SDK — Non-Custodial Payment Processing for Autonomous Agents | Coin Railz',
    description:
      'Add payment capabilities to any AI agent in 3 lines of code. NPM, Python, Docker SDKs for ElizaOS, AgentKit, MCP. 1.5% + $0.01 fee. Multi-chain: Base, Ethereum, Polygon, Solana. 78 bundled microservices.',
    keywords:
      'AI agent payments SDK, agentic commerce, autonomous agent payments, agent-to-agent payments, ElizaOS payments, AgentKit integration, MCP payments, x402 protocol, non-custodial payments, autonomous payments SDK',
    canonical: `${BASE_URL}/sdk-landing`,
    ogTitle: 'AI Agent Payments SDK — 3 Lines of Code | Coin Railz',
    ogDescription:
      'NPM, Python, Docker SDKs for AI agent payments. Multi-chain support (7 EVM + Solana). 1.5% + $0.01 fee. ElizaOS, AgentKit, MCP compatible. 83% cheaper than Stripe.',
    ogImage: OG_IMAGE,
    twitterTitle: 'AI Agent Payments SDK | Coin Railz',
    twitterDescription:
      'Add payment capabilities to any AI agent. NPM: @coinrailz/agent-payments. Python: coinrailz. 78 bundled microservices.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Coin Railz Agent Payments SDK',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cross-platform',
      url: `${BASE_URL}/sdk-landing`,
      programmingLanguage: ['TypeScript', 'JavaScript', 'Python'],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free SDK. Processing fee: 1.5% + $0.01 per transaction.' },
      featureList: [
        'Non-custodial USDC payments',
        'Multi-chain support (Base, Ethereum, Polygon, Arbitrum, BSC, Optimism, Solana)',
        '78 bundled pay-per-call microservices',
        'ElizaOS plugin compatibility',
        'AgentKit tool integration',
        'MCP server implementation',
      ],
      downloadUrl: ['https://www.npmjs.com/package/@coinrailz/agent-payments', 'https://pypi.org/project/coinrailz/'],
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>Enterprise Payment SDK for AI Developers</h1>
      <p>Add payment capabilities to any AI agent in 3 lines of code. Non-custodial USDC payments across 7 EVM chains and Solana. 83% cheaper than Stripe. 1.5% + $0.01 fee.</p>
      <ul>
        <li>NPM: <code>npm install @coinrailz/agent-payments</code></li>
        <li>Python: <code>pip install coinrailz</code></li>
        <li>Docker: <code>docker pull tdnupe3/agent-payments</code></li>
        <li>ElizaOS plugin: <code>npm install elizaos-plugin-coinrailz</code></li>
      </ul>
      <h2>What's Included</h2>
      <ul>
        <li>Non-custodial USDC payments — you hold your keys</li>
        <li>Multi-chain support: Base, Ethereum, Polygon, Arbitrum, BSC, Optimism, Solana</li>
        <li>78 bundled pay-per-call microservices (DeFi, IoT, satellite data, RWA, prediction markets)</li>
        <li>ElizaOS plugin compatibility and AgentKit tool integration</li>
        <li>MCP server implementation for Claude and other MCP-compatible agents</li>
        <li>x402 protocol support for on-chain USDC micropayments</li>
      </ul>
      <h2>Competitive Pricing</h2>
      <p>1.5% + $0.01 per transaction — 83% cheaper than Stripe's 2.9% + $0.30. Minimum $0.05/call. Free SDK download.</p>
    `,
  },

  '/x402': {
    title: 'x402 Protocol Documentation — On-Chain Micropayments for AI Agents | Coin Railz',
    description:
      'Learn the x402 open standard for autonomous machine payments. HTTP 402 Payment Required with USDC on Base, Ethereum, Polygon, Solana, and AWS CloudFront. Build pay-per-call APIs for AI agents.',
    keywords:
      'x402 protocol, HTTP 402 Payment Required, machine payments, autonomous payments, USDC micropayments, AI agent payments, pay-per-call API, on-chain payments, x402 open standard',
    canonical: `${BASE_URL}/x402`,
    ogTitle: 'x402 Protocol — On-Chain Micropayments for AI Agents | Coin Railz',
    ogDescription:
      'Open standard for autonomous machine payments. HTTP 402 + USDC on Base, Ethereum, Polygon, Solana, and AWS CloudFront. Build pay-per-call APIs.',
    ogImage: OG_IMAGE,
    twitterTitle: 'x402 Protocol Documentation | Coin Railz',
    twitterDescription:
      'HTTP 402 Payment Required — the open standard for autonomous machine payments. Live on AWS CloudFront, Solana, and Base.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      name: 'x402 Protocol Documentation',
      url: `${BASE_URL}/x402`,
      description: 'Technical documentation for the x402 open standard for autonomous machine payments.',
      author: { '@type': 'Organization', name: 'Kellogg Holdings LLC' },
    },
    bodyHtml: `
      <h1>x402 Protocol — On-Chain Micropayments for AI Agents</h1>
      <p>The x402 open standard enables autonomous machine-to-machine payments using HTTP 402 Payment Required. AI agents discover payment requirements, pay with USDC, and receive data — all without human intervention.</p>
      <h2>How x402 Works</h2>
      <ol>
        <li>Agent requests a resource → server returns <code>402 Payment Required</code> with payment details</li>
        <li>Agent pays with USDC on-chain (Base, Ethereum, Polygon, Solana, or AWS CloudFront)</li>
        <li>Agent resubmits request with payment proof in <code>X-PAYMENT</code> header</li>
        <li>Server verifies payment → returns the requested data</li>
      </ol>
      <ul>
        <li>Live on AWS CloudFront, Solana, and Base mainnet</li>
        <li>78 x402-gated APIs across DeFi, IoT, satellite data, and prediction markets</li>
        <li>USDC settlement — instant finality on Base (2-3 seconds)</li>
        <li>Open standard — build your own x402-compatible APIs</li>
      </ul>
    `,
  },

  '/bundles': {
    title: 'AI Agent API Bundles — Curated Microservice Packages | Coin Railz',
    description:
      'Pre-configured API bundles for AI agents. DeFi intelligence pack, satellite data pack, IoT sensor pack, and prediction market pack. Discounted bundle pricing vs. pay-per-call.',
    keywords:
      'AI agent API bundles, microservice packages, DeFi API bundle, satellite data bundle, IoT API bundle, prediction market API, agent API packages, discounted API access',
    canonical: `${BASE_URL}/bundles`,
    ogTitle: 'AI Agent API Bundles | Coin Railz',
    ogDescription:
      'Pre-configured microservice bundles for AI agents. DeFi, satellite, IoT, and prediction market packs. Discounted vs. pay-per-call.',
    ogImage: OG_IMAGE,
    twitterTitle: 'AI Agent API Bundles | Coin Railz',
    twitterDescription: 'Curated API bundles for AI agents. DeFi, satellite, IoT, and prediction market packs.',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      name: 'Coin Railz AI Agent API Bundles',
      url: `${BASE_URL}/bundles`,
      description: 'Pre-configured API bundles for AI agents with discounted pricing.',
      provider: { '@type': 'Organization', name: 'Kellogg Holdings LLC', url: BASE_URL },
    },
    bodyHtml: `
      <h1>AI Agent API Bundles</h1>
      <p>Pre-configured microservice bundles for AI agents. Get curated sets of related APIs at discounted pricing versus individual pay-per-call access.</p>
      <ul>
        <li>DeFi Intelligence Pack — token prices, on-chain metrics, DEX data, yield rates</li>
        <li>Satellite Data Pack — fire alerts, NDVI, precipitation, SST, ocean color</li>
        <li>IoT Sensor Pack — fleet telematics, weather sensors, industrial data</li>
        <li>Prediction Market Pack — Kalshi and Polymarket real-time data</li>
        <li>RWA &amp; Tokenized Assets Pack — NAV oracles, compliance checks, tokenized yield</li>
      </ul>
    `,
  },
};

// ---------------------------------------------------------------------------
// HTML shell builder
// ---------------------------------------------------------------------------

/**
 * Reads the production index.html shell to extract the base <head> content
 * (scripts, WebSocket patch, etc.) for the SPA hydration path.
 * In dev, Vite does this automatically; we replicate the essentials here.
 */
function buildSeoHtml(config: RouteSSRConfig, scriptTag: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Primary SEO Meta Tags -->
  <title>${escapeHtml(config.title)}</title>
  <meta name="description" content="${escapeAttr(config.description)}" />
  <meta name="keywords" content="${escapeAttr(config.keywords)}" />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="Coin Railz" />
  <link rel="canonical" href="${escapeAttr(config.canonical)}" />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeAttr(config.canonical)}" />
  <meta property="og:title" content="${escapeAttr(config.ogTitle)}" />
  <meta property="og:description" content="${escapeAttr(config.ogDescription)}" />
  <meta property="og:image" content="${escapeAttr(config.ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="Coin Railz" />

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content="${escapeAttr(config.canonical)}" />
  <meta property="twitter:title" content="${escapeAttr(config.twitterTitle)}" />
  <meta property="twitter:description" content="${escapeAttr(config.twitterDescription)}" />
  <meta property="twitter:image" content="${escapeAttr(config.ogImage)}" />
  <meta property="twitter:creator" content="@coinrailz" />
  <meta property="twitter:site" content="@coinrailz" />

  <!-- Additional Meta -->
  <meta name="theme-color" content="#1e3a8a" />
  <meta name="application-name" content="Coin Railz" />
  <meta name="virtual-protocol-site-verification" content="e593dbe8fc78fbd67a32f249c85d6055" />

  <!-- Favicon -->
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />

  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(config.structuredData)}</script>

  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    .loading-fallback {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white; text-align: center;
    }
    .loading-content h1 { margin: 0 0 1rem 0; font-size: 2.5rem; font-weight: 700; }
    .loading-content p { margin: 0; opacity: 0.9; font-size: 1.1rem; }
    /* Semantic content visible to crawlers, hidden visually by React once hydrated */
    #seo-content { display: none; }
  </style>
</head>
<body>
  <!-- Semantic content for crawlers — React will replace #root on hydration -->
  <div id="seo-content" aria-hidden="true">
    ${config.bodyHtml}
  </div>
  <div id="root">
    <div class="loading-fallback">
      <div class="loading-content">
        <h1>Coin Railz</h1>
        <p>Payment Infrastructure for AI Agents</p>
      </div>
    </div>
  </div>
  ${scriptTag}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ---------------------------------------------------------------------------
// The script tag to include so real browsers still load the SPA
// ---------------------------------------------------------------------------

function getSpaScriptTag(isDev: boolean): string {
  if (isDev) {
    return `<script type="module" src="/src/main.tsx"></script>`;
  }
  // In production, Vite builds a hashed bundle. We use a catch-all to find it.
  const distPath = path.resolve(process.cwd(), 'dist/public');
  try {
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(path.join(distPath, 'assets')).filter((f) => (f.startsWith('index-') || f.startsWith('main-')) && f.endsWith('.js'));
      if (files.length > 0) {
        return `<script type="module" src="/assets/${files[0]}"></script>`;
      }
    }
  } catch {
    // fallback — let the browser request the built bundle
  }
  return `<script type="module" src="/src/main.tsx"></script>`;
}

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

export function createSsrMetaRouter(isDev: boolean): Router {
  const router = Router();
  const scriptTag = getSpaScriptTag(isDev);

  for (const [routePath, config] of Object.entries(SSR_ROUTES)) {
    // Handle both exact path and path with trailing slash
    const handler = (req: Request, res: Response, next: NextFunction) => {
      const ua = req.headers['user-agent'] || '';

      if (!isCrawler(ua)) {
        // Regular browser — pass through to Vite or serveStatic
        return next();
      }

      // Crawler — return complete SSR HTML.
      // Cache-Control: no-store prevents shared/CDN caches from storing this
      // UA-conditional response and accidentally serving the crawler variant to
      // regular browsers.  Vary: User-Agent is a belt-and-suspenders signal for
      // any intermediate proxy that *does* decide to cache.
      const html = buildSeoHtml(config, scriptTag);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Vary', 'User-Agent');
      res.status(200).send(html);
    };

    router.get(routePath, handler);
    // Also match with trailing slash
    if (routePath !== '/') {
      router.get(`${routePath}/`, handler);
    }
  }

  return router;
}
