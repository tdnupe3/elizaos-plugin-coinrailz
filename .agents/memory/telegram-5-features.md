---
name: Telegram 5 Business Opportunities
description: Architecture decisions for all 5 Telegram features — trading bot, bot-to-bot, Guardian, Stars per-call, group support
---

# Telegram 5 Business Features — Architecture

## Trading Bot (webhook-mode)
- `getTradingService(bot)` is called ONCE in `telegramMiniAppRoutes.ts` with the shared bot instance
- No second TelegramBot instance — single bot for all features
- Route priority: `/wallet`, `/copy`, `/upgrade`, `/tradehelp` → tradingService; `/buy ETH 100` (with args + amount) → tradingService; bare `/buy` → credits purchase
- `tradingService.handleCallback()` returns `boolean` — if false, callback was not a trading action

## Bot-to-Bot JSON Lane
- `update.message.from?.is_bot === true` triggers JSON response (not plain text)
- JSON shape: `{ coinrailz, command, status: "payment_required", payment_options: { telegram_stars, x402_endpoint, api_docs } }`
- Bot-to-bot check fires BEFORE any other command handler (early return)

## AI Guardian
- `telegram_guardians` table created via direct SQL (drizzle-kit `push --force` hits interactive rename prompt for new tables; use direct SQL instead)
- `runGuardianScan()` is a module-level `async function` (hoisted) — safe to reference before text position in file
- Guardian scan uses `EVM_ADDRESS_RE` and `SOL_ADDRESS_RE` regexes defined at module level
- Only alerts if `isHighRisk` OR (MEDIUM + threshold ≤ 50) — avoids alert fatigue
- `scanLimitPerDay` default: 10 (trial/free tier)
- `my_chat_member` fires when bot is added to group — DMs the `addedBy` user with Guardian offer

## Stars Per-Call Micropayments
- Invoice payload now has `type` discriminator: `"credits_bundle"` or `"per_call"`
- `per_call` successful_payment delivers Mini-App URL with `?action={service}&stars_paid={chargeId}`
- Idempotency note: Telegram only delivers `successful_payment` once per charge_id; no duplicate processing concern at current scale
- `pre_checkout_query` must always approve — Telegram hard requirement within 10 seconds

## Group Support
- `rawText.replace(new RegExp(@coinrailz_bot, gi), '')` strips @mention from commands
- `chatType` guard: Guardian scan only fires in `group` / `supergroup`, never `private`

## Key Safety Rule
- `runGuardianScan` has a top-level try/catch — Guardian errors must NEVER surface to chat users
- `bot.sendMessage` in my_chat_member and Guardian uses `.catch(() => {})` — admin DMs may be restricted
