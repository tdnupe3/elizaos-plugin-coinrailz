---
name: Semrush crawl history correction
description: SemrushBot has crawled Coin Railz since December 2024, not since July 2026. Prior assessment notes saying "first appeared" were wrong.
---

## Correction

SemrushBot (`Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)`) has been crawling Coin Railz across at least **8 distinct crawl waves** dating back to **December 2025** (earliest confirmed hit: 2025-12-04; 414 total hits as of Jul 2026):

| Wave | Date | Services hit |
|---|---|---|
| 1 | Dec 2025 | payment-processing, whale-alerts, contract-scan, polymarket, portfolio, trending, token-metadata, transaction-builder, compliance-check, construction-progress, instant-agent-wallet, token-price, gas-price-oracle, verified-agent-identity, batch-quote, dex-liquidity, token-sentiment, fraud-detection, polymarket-odds, trading-signal, risk-metrics, correlation-matrix, wallet-risk, portfolio-optimization, property-valuation, credit-risk-score, lease-analysis, arbitrage-scanner, sentiment-analysis, seamless-chain-bridge, approval-manager |
| 2 | Jan 2026 | Full catalog sweep |
| 3 | Feb 2026 | Full catalog sweep + satellite vertical |
| 4 | Mar 2026 | kalshi, compliance, trading, sentiment, satellite, first-call |
| 5 | Apr 2026 | Most catalog services |
| 6 | May 2026 | kalshi, satellite, risk, seamless-chain-bridge, whale-alerts |
| 7 | Jun 2026 | token-metadata, compliance-consultation, risk-metrics, trading-signal, kalshi, satellite |
| 8 | Jul 2026 | catalog, property-valuation, earthdata-sst, earthdata-soil-moisture, satellite-earthdata, compliance-consultation (ongoing) |

## How to Apply

- Do NOT report SemrushBot appearances as "new" in assessments — they are a long-running recurring presence
- Semrush crawl waves typically last 1–3 days then go quiet for weeks
- The ongoing Jul 2026 wave is focusing on satellite data (earthdata-sst, earthdata-soil-moisture) and compliance — consistent with these being the most recently added/prominent services
- Ahrefs (15.235.27.231, first appeared Jul 15 2026) and Bing (157.55.39.57, first appeared Jul 15 2026) ARE genuinely new as of Window 5
