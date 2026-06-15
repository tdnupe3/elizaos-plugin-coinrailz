---
name: Kalshi API v2 field changes (2026)
description: yes_price no longer exists; price fields and liquid series discovery for spread matching
---

## Rule
Kalshi trade-api v2 (as of June 2026) does NOT return `yes_price` (cents, 0-100).
Use `yes_ask_dollars`, `yes_bid_dollars`, `last_price_dollars` instead (USD decimal strings, 0.0–1.0).

**Why:** The existing KalshiHandler.ts was written for an older API shape. It silently returns 0 for all prices now (uses `typeof market.yes_price === 'number' ? market.yes_price : 0`). Any new handler that needs real prices must use the dollar fields.

## Price derivation
```typescript
const last = parseFloat(m.last_price_dollars || '0');
if (last > 0.01 && last < 1) return last;
const ask = parseFloat(m.yes_ask_dollars || '0');
const bid = parseFloat(m.yes_bid_dollars || '0');
if (ask > 0 && bid > 0) return (ask + bid) / 2;
return ask || bid || 0;
```

## Liquid series (confirmed June 2026)
Default `status=open` returns newest markets first (World Cup game markets with 0 liquidity).
Fetch from targeted series to get real prices:
- KXBTC, KXETH, KXFED, KXCPI, KXGDP, KXNBA, KXMLB, KXNHL

**How to apply:** Use `series_ticker=KXxxx` query param. Fetch sequentially with 200ms delay between series — parallel fetching of 8+ series reliably triggers 429.

## Polymarket /markets vs /events
`/events` endpoint does NOT have `outcomePrices`/`outcomes` at event level — they're on nested markets.
Use `/markets?active=true&closed=false&order=volume&ascending=false` instead.
Paginate with `&offset=100,200,300` to capture econ/sports markets beyond the top-100 World Cup markets.

## Cross-platform matching (Jaccard)
Threshold: 0.20. Add month names + year numbers (2020-2039) to stop words to prevent false-positive date matches. Add synonym normalization: btc→bitcoin, fed→federal, gdp→economy, nba→basketball, mlb→baseball, nhl→hockey, nfl→football.
