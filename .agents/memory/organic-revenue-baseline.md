---
name: Organic revenue baseline — corrected Aug 2026
description: True organic revenue totals, payer profiles, and weekly trend. Previous "$51.60 total" figure in memory was WRONG.
---

# Organic Revenue Baseline (corrected Aug 15 2026)

## True totals (is_canary=false, status=SUCCEEDED)
- **373 organic succeeded payments**
- **$189.39 total organic revenue**
- **15 unique payers** (wallets + one Solana address)
- Active since: Nov 27, 2025

## Top payers
| Wallet | Revenue | Payments | Services | Active period |
|---|---|---|---|---|
| 0x92ca4cef... | $79.75 | 94 | 35 | Nov 27 – Dec 22, 2025 |
| 0x9cc42f3d... | $42.85 | 94 | 30 | Jun 12 – Jul 1, 2026 |
| 0x2f5134f7... | $31.70 | 48 | 18 | Dec 9, 2025 – Jan 10, 2026 |
| 0x0a2854fb... | $14.87 | 1 | 1 (ping) | Dec 14, 2025 |
| 0x74de5d4f... | $9.84 | 1 | 1 (gas-price-oracle) | Feb 18, 2026 |
| 0xa4bbe37f... | $5.45 | 109 | 1 (first-call) | May–Jun 2026 — NOTE: this is the platform facilitator wallet, semi-internal |
| 0x3803a192... | $2.90 | 14 | 8 (earthdata family) | Jun 2026 – Aug 11, 2026 — STILL ACTIVE |

## Revenue trend (weekly organic)
- Nov 24 2025: $77.90 (89 payments) — launch week peak
- Dec 8 2025: $25.62
- Dec 29 2025: $20.30
- Jun 8 2026: $12.70 — return of 0x9cc42f3d
- Jun 15 2026: $21.50 — 0x9cc42f3d peak
- Jun 22–29 2026: $11.20 — fading
- Jul 1 2026: 0x9cc42f3d goes dark (wallet depleted)
- Jul 2026 – present: only 0x3803a192 active ($0.25–0.50/week on earthdata services)
- Last organic payment: Aug 11, 2026 (satellite-earthdata, $0.25, 0x3803a192)
- Last 12h organic: ZERO

## What NOT to say
- ❌ "last organic payment was June 1" — WRONG, it was Aug 11
- ❌ "total organic revenue $51.60" — WRONG, it is $189.39
- ❌ "all payments are canary" when is_canary filter not applied — ALWAYS filter is_canary separately
- ✅ ALWAYS filter: WHERE (is_canary=false OR is_canary IS NULL) AND status='SUCCEEDED'

## Canary system
- Payer: 0x5837a864c03912ea14a5609968f73e75b9d42a7c
- 505 payments, $147.47 canary revenue
- Services: rotates through entire catalog on ~2h cycle
- is_canary=true on all rows — always exclude from organic analysis
