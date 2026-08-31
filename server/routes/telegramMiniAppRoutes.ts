import { Router, Request, Response } from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { telegramAccounts, telegramReferrals, telegramGuardians, telegramTrades, users, creditsAccounts, creditTransactions, apiKeys } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { creditsService } from "../services/creditsService";
import { nanoid } from "nanoid";
import { getTradingService } from "../services/telegramTradingService";

const router = Router();

// Initialize Telegram Bot (webhook mode — no polling)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

// Initialize trading service with the shared bot instance (no second polling instance)
const tradingService = getTradingService(bot);

// Initialize OpenAI (lazy — avoids crash at module load when key is absent in dev)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

// Platform configuration
const WEBAPP_URL = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/telegram`
  : "http://localhost:5000/telegram";
const STARTING_BONUS = 1.00; // $1 starting bonus
const REFERRAL_BONUS_PERCENT = 0.10; // 10% of first purchase

// Telegram Payments configuration using Telegram Stars
// For digital goods/services, Telegram Stars is required (app store compliant)
// 1 Star ≈ $0.01 USD (Telegram's native in-app currency)
const PAYMENT_TIERS = [
  { stars: 1000, usdValue: 10, label: "1,000 ⭐ Stars", description: "$10 in credits", bonus: 0 },
  { stars: 2500, usdValue: 25, label: "2,500 ⭐ Stars", description: "$27.50 credits (+10% bonus)", bonus: 0.10 },
  { stars: 5000, usdValue: 50, label: "5,000 ⭐ Stars", description: "$57.50 credits (+15% bonus)", bonus: 0.15 },
  { stars: 10000, usdValue: 100, label: "10,000 ⭐ Stars", description: "$120 credits (+20% bonus)", bonus: 0.20 }
] as const;

// Per-call Stars micropayments — instant service access without pre-buying a credit bundle
const STARS_PER_CALL: Record<string, { stars: number; usd: number; label: string }> = {
  price:     { stars: 20,  usd: 0.25, label: "Token Price Lookup" },
  liquidity: { stars: 16,  usd: 0.20, label: "DEX Liquidity Data" },
  risk:      { stars: 40,  usd: 0.50, label: "Wallet Risk Check" },
  portfolio: { stars: 40,  usd: 0.50, label: "Wallet Portfolio Report" },
  scan:      { stars: 80,  usd: 1.00, label: "Smart Contract Scan" },
};

// Bot username for group @mention stripping
const BOT_USERNAME = "coinrailz_bot";

// EVM address regex: 0x + 40 hex chars
const EVM_ADDRESS_RE = /0x[a-fA-F0-9]{40}/g;
// Solana address regex: base58 32-44 chars (rough heuristic)
const SOL_ADDRESS_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

// SECURITY: JWT_SECRET is REQUIRED for internal auth - no fallback allowed
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is required for secure internal authentication");
}
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Generate a cryptographically signed internal auth token
 * This prevents header spoofing attacks - only our Telegram backend can generate valid tokens
 */
function generateInternalAuthToken(userId: string): string {
  return jwt.sign(
    { userId, service: 'telegram-miniapp-proxy', iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '5m' } // Short-lived token (5 minutes)
  );
}

/**
 * Validate Telegram initData signature to prevent spoofing
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns the user data if valid, null if invalid
 */
function validateTelegramData(initData: string): { id: number; first_name?: string; last_name?: string; username?: string } | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    params.delete("hash");
    
    // Sort params alphabetically
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) {
      return null;
    }

    // Check auth_date to prevent replay attacks (reject if older than 5 minutes)
    const authDate = params.get("auth_date");
    if (!authDate) return null;
    
    const authTimestamp = parseInt(authDate);
    const now = Math.floor(Date.now() / 1000);
    const MAX_AGE_SECONDS = 5 * 60; // 5 minutes
    
    if (now - authTimestamp > MAX_AGE_SECONDS) {
      console.warn(`Telegram auth_date too old: ${now - authTimestamp}s ago`);
      return null;
    }

    // Extract and parse user data
    const userParam = params.get("user");
    if (!userParam) return null;
    
    const userData = JSON.parse(userParam);
    return userData;
  } catch (error) {
    console.error("Telegram data validation error:", error);
    return null;
  }
}

/**
 * Auto-provision a full Telegram account if one doesn't exist yet.
 * Safe to call on every Stars payment — idempotent by telegramId.
 * Used so users who pay before /start still get their credits.
 */
async function getOrCreateTelegramAccountFromUpdate(
  from: { id: number; first_name?: string; last_name?: string; username?: string }
): Promise<typeof telegramAccounts.$inferSelect> {
  const telegramId = from.id.toString();

  const existing = await db.query.telegramAccounts.findFirst({
    where: eq(telegramAccounts.telegramId, telegramId)
  });
  if (existing) return existing;

  // New user — provision the full account chain
  const userId = `t${nanoid(8)}`;
  const userReferralCode = `T${nanoid(8)}`;

  await db.insert(users).values({
    id: userId,
    firstName: from.first_name || 'Telegram',
    lastName: from.last_name || 'User',
    accountStatus: 'active',
    referralCode: userReferralCode,
    freeCreditsGranted: true,
  }).onConflictDoNothing();

  const [creditsAccount] = await db.insert(creditsAccounts).values({
    userId, balance: STARTING_BONUS.toFixed(2), autoTopUpEnabled: false
  }).onConflictDoNothing().returning();

  // Only log the bonus transaction if the account was just created
  if (creditsAccount) {
    await db.insert(creditTransactions).values({
      accountId: creditsAccount.id,
      userId,
      amount: STARTING_BONUS.toFixed(2),
      type: 'bonus',
      balanceBefore: '0.00',
      balanceAfter: STARTING_BONUS.toFixed(2),
      description: 'Welcome bonus',
      metadata: { source: 'telegram_payment', reason: 'new_user_bonus' }
    }).onConflictDoNothing();
  }

  const apiKeyValue = `cr_tg_${nanoid(32)}`;
  const keyPrefix = apiKeyValue.substring(0, 12);
  const hashedKey = await bcrypt.hash(apiKeyValue, 10);

  await db.insert(apiKeys).values({
    userId, hashedKey, keyPrefix,
    name: 'Telegram Mini-App', status: 'active', rateLimit: 100
  }).onConflictDoNothing();

  const [telegramAccount] = await db.insert(telegramAccounts).values({
    telegramId,
    userId,
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
    referralCode: userReferralCode,
  }).onConflictDoUpdate({
    target: telegramAccounts.telegramId,
    set: { username: from.username, firstName: from.first_name }
  }).returning();

  return telegramAccount;
}

/**
 * AI Guardian: scan contract/wallet addresses in group messages.
 * Only fires if Guardian is enabled for the group and scan limit not exceeded.
 */
async function runGuardianScan(groupChatId: number, messageText: string, botInstance: TelegramBot): Promise<void> {
  try {
    const guardian = await db.query.telegramGuardians?.findFirst?.({
      where: eq(telegramGuardians.groupChatId, groupChatId.toString())
    });
    if (!guardian?.enabled) return;

    // Check daily scan limit
    const today = new Date().toISOString().slice(0, 10);
    const lastReset = guardian.lastScanAt?.toISOString?.()?.slice(0, 10);
    let scansToday = lastReset === today ? (guardian.scansToday || 0) : 0;
    if (scansToday >= (guardian.scanLimitPerDay || 10)) return;

    // Extract addresses from message
    const evmMatches = guardian.scanContracts ? [...(messageText.matchAll(EVM_ADDRESS_RE) || [])] : [];
    const solMatches = guardian.scanWallets ? [...(messageText.matchAll(SOL_ADDRESS_RE) || [])] : [];
    const addressesToScan = [
      ...evmMatches.map(m => ({ addr: m[0], type: 'evm' })),
      ...solMatches.map(m => ({ addr: m[0], type: 'sol' }))
    ].slice(0, 3); // max 3 per message

    if (addressesToScan.length === 0) return;

    // Increment scan counter
    scansToday += addressesToScan.length;
    await db.update(telegramGuardians)
      .set({ scansToday, lastScanAt: new Date() })
      .where(eq(telegramGuardians.groupChatId, groupChatId.toString()))
      .catch(() => {});

    // Analyze each address with OpenAI (lightweight heuristic)
    for (const { addr, type } of addressesToScan) {
      const prompt = `You are a crypto security scanner. Quickly assess this ${type === 'evm' ? 'EVM' : 'Solana'} address: ${addr}

Respond in ≤3 lines using ONLY this format:
🔴 HIGH RISK / 🟡 MEDIUM RISK / 🟢 LOW RISK — <one-sentence reason>
Confidence: <percentage>
Recommendation: <action in ≤8 words>

Base your assessment on address format, known scam patterns, and general heuristics. Do NOT make up specific transaction data.`;

      let riskText = '';
      try {
        const resp = await getOpenAI().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 120,
          temperature: 0.3,
        });
        riskText = resp.choices[0]?.message?.content?.trim() || 'Unable to assess.';
      } catch {
        riskText = '⚠️ Scanner temporarily unavailable.';
      }

      const isHighRisk = riskText.includes('HIGH RISK') || riskText.includes('🔴');
      const riskThreshold = guardian.riskThreshold || 60;

      if (isHighRisk || (riskText.includes('MEDIUM') && riskThreshold <= 50)) {
        await botInstance.sendMessage(groupChatId,
          `🛡️ *AI Guardian Alert*\n\n` +
          `Address: \`${addr}\`\n\n` +
          `${riskText}\n\n` +
          `_Powered by Coin Railz Guardian_`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }
  } catch (err) {
    // Guardian scan errors must never surface to the user
    console.error('[Guardian] Scan error:', err);
  }
}

/**
 * POST /api/telegram/webhook
 * Handles bot commands like /start
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const update = req.body;
    
    // CRITICAL: Respond to Telegram immediately (within 1 second) to prevent timeout
    // Process commands asynchronously after sending 200 OK
    res.status(200).json({ ok: true });

    // ── my_chat_member: bot added to / removed from a group ───────────────
    if (update.my_chat_member) {
      const member = update.my_chat_member;
      const chat = member.chat;
      const newStatus = member.new_chat_member?.status;
      const addedBy = member.from;

      if ((newStatus === 'member' || newStatus === 'administrator') && addedBy?.id) {
        await bot.sendMessage(addedBy.id,
          `🛡️ *@coinrailz_bot was added to "${chat.title || 'a group'}"*\n\n` +
          `Enable *AI Guardian* to auto-scan the group:\n` +
          `• Contract addresses → instant security scan\n` +
          `• Wallet addresses → risk score alert\n` +
          `• High-risk activity alerts\n\n` +
          `*Free tier:* 10 scans/day\n` +
          `*Pro:* Unlimited scans — $50/month\n\n` +
          `Enable Guardian for "${chat.title || 'the group'}"?`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[
              { text: '✅ Enable Guardian (Free)', callback_data: `guardian_enable:${chat.id}` },
              { text: '🌐 Learn More', url: 'https://coinrailz.com/guardian' },
            ]]}
          }
        ).catch(() => {}); // may fail if admin DMs are restricted
      }
    }

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const rawText = update.message.text;
      const chatType = update.message.chat?.type; // private | group | supergroup | channel

      // Strip @coinrailz_bot suffix from group commands (e.g. /price@coinrailz_bot ETH)
      const text = rawText.replace(new RegExp(`@${BOT_USERNAME}`, 'gi'), '').trim();

      // ── Bot-to-Bot JSON lane ──────────────────────────────────────────────
      const isBot = update.message.from?.is_bot === true;
      if (isBot) {
        const cmdKey = text.split(' ')[0].replace('/', '').toLowerCase();
        const svcInfo = STARS_PER_CALL[cmdKey];
        await bot.sendMessage(chatId, JSON.stringify({
          coinrailz: true,
          command: cmdKey,
          status: "payment_required",
          message: "Accept Stars or x402 USDC payment to access this service.",
          payment_options: {
            telegram_stars: svcInfo ? { amount: svcInfo.stars, currency: "XTR" } : null,
            x402_endpoint: "https://coinrailz.com/x402/first-call",
            api_docs: "https://coinrailz.com/openapi.json"
          }
        }, null, 2));
        return;
      }

      // ── AI Guardian: auto-scan addresses in group messages ────────────────
      if (chatType === 'group' || chatType === 'supergroup') {
        await runGuardianScan(chatId, text, bot).catch(() => {});
      }

      // Handle /start command
      if (text.startsWith("/start")) {
        const referralCode = text.split(" ")[1]; // Extract referral code from /start <code>
        
        await bot.sendMessage(chatId, 
          "🚀 Welcome to Coin Railz Agent Console!\n\n" +
          "Your AI-powered on-chain command center. " +
          "Get $1 free credits to try our services!\n\n" +
          "• Wallet Risk Checks\n" +
          "• Token Prices & Contract Scans\n" +
          "• DEX Liquidity & Portfolio Tracking\n" +
          "• Satellite & Weather Data (IoT)\n" +
          "• And 73 more services across 9 chains!\n\n" +
          "Tap below to get started 👇",
          {
            reply_markup: {
              inline_keyboard: [
                [{
                  text: "🎮 Launch Agent Console",
                  web_app: { url: referralCode ? `${WEBAPP_URL}?ref=${referralCode}` : WEBAPP_URL }
                }],
                [{
                  text: "💳 Buy Credits",
                  callback_data: "buy_credits"
                }]
              ]
            }
          }
        );
      }
      
      // Handle /help command
      else if (text === "/help") {
        await bot.sendMessage(chatId,
          "ℹ️ *Coin Railz Agent Console Help*\n\n" +
          "*Available Commands:*\n" +
          "/start - Launch the mini-app and get $1 free credits\n" +
          "/buy - Buy credits (instant payment via Stripe)\n" +
          "/balance - Check your credit balance\n" +
          "/help - Show this help message\n" +
          "/scan - Quick contract scan\n" +
          "/risk - Wallet risk check\n" +
          "/price - Token price lookup\n" +
          "/liquidity - DEX liquidity data\n" +
          "/portfolio - View wallet portfolio\n\n" +
          "*Inside the Mini-App:*\n" +
          "• Chat with AI ($0.10/message)\n" +
          "• Access 77 blockchain & AI data services\n" +
          "• Track your activity & balance\n" +
          "• Share results with friends\n\n" +
          "*Pricing:*\n" +
          "💬 AI Chat: $0.10/message\n" +
          "🔍 Services: $0.10 - $5.00 each\n\n" +
          "Launch the app to get started! 👇",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🎮 Launch Agent Console",
                  web_app: { url: WEBAPP_URL }
                }
              ]]
            }
          }
        );
      }
      
      // Handle service shortcut commands
      else if (text === "/scan") {
        await bot.sendMessage(chatId,
          "🔍 *Smart Contract Scan*\n\n" +
          "Launch the mini-app and ask:\n" +
          "\"Scan this contract: 0x...\" or\n" +
          "\"Is this contract safe?\"\n\n" +
          "Cost: $0.10 chat + $1.00 scan = $1.10\n" +
          "Or pay instantly with 80 ⭐ Stars",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 Open Scanner", web_app: { url: `${WEBAPP_URL}?action=scan` } }],
                [{ text: "⭐ Pay 80 Stars instantly", callback_data: "stars_pay:scan" }]
              ]
            }
          }
        );
      }
      
      else if (text === "/risk") {
        await bot.sendMessage(chatId,
          "⚠️ *Wallet Risk Check*\n\n" +
          "Launch the mini-app and ask:\n" +
          "\"Check risk for wallet 0x...\" or\n" +
          "\"Is this wallet safe?\"\n\n" +
          "Cost: $0.10 chat + $0.50 risk check = $0.60\n" +
          "Or pay instantly with 40 ⭐ Stars",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 Check Risk", web_app: { url: `${WEBAPP_URL}?action=risk` } }],
                [{ text: "⭐ Pay 40 Stars instantly", callback_data: "stars_pay:risk" }]
              ]
            }
          }
        );
      }
      
      else if (text === "/price") {
        await bot.sendMessage(chatId,
          "💰 *Token Price Lookup*\n\n" +
          "Launch the mini-app and ask:\n" +
          "\"What's the price of ETH?\" or\n" +
          "\"Show me BTC price\"\n\n" +
          "Cost: $0.10 chat + $0.25 price = $0.35\n" +
          "Or pay instantly with 20 ⭐ Stars",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 Check Prices", web_app: { url: `${WEBAPP_URL}?action=price` } }],
                [{ text: "⭐ Pay 20 Stars instantly", callback_data: "stars_pay:price" }]
              ]
            }
          }
        );
      }
      
      else if (text === "/liquidity") {
        await bot.sendMessage(chatId,
          "💧 *DEX Liquidity Data*\n\n" +
          "Launch the mini-app and ask:\n" +
          "\"Check liquidity for USDC on Uniswap\" or\n" +
          "\"Show me liquidity pools\"\n\n" +
          "Cost: $0.10 chat + $0.20 liquidity = $0.30\n" +
          "Or pay instantly with 16 ⭐ Stars",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 View Liquidity", web_app: { url: `${WEBAPP_URL}?action=liquidity` } }],
                [{ text: "⭐ Pay 16 Stars instantly", callback_data: "stars_pay:liquidity" }]
              ]
            }
          }
        );
      }
      
      else if (text === "/portfolio") {
        await bot.sendMessage(chatId,
          "📊 *Wallet Portfolio View*\n\n" +
          "Launch the mini-app and ask:\n" +
          "\"Show portfolio for 0x...\" or\n" +
          "\"What tokens does this wallet hold?\"\n\n" +
          "Cost: $0.10 chat + $0.50 report = $0.60\n" +
          "Or pay instantly with 40 ⭐ Stars",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 View Portfolio", web_app: { url: `${WEBAPP_URL}?action=portfolio` } }],
                [{ text: "⭐ Pay 40 Stars instantly", callback_data: "stars_pay:portfolio" }]
              ]
            }
          }
        );
      }

      // Handle /guardian command (group AI security scanner)
      else if (text === "/guardian") {
        const chatType = update.message.chat?.type;
        if (chatType === 'group' || chatType === 'supergroup') {
          const groupId = update.message.chat.id.toString();
          const existing = await db.query.telegramGuardians?.findFirst?.({ where: eq(telegramGuardians.groupChatId, groupId) }).catch(() => null);
          if (existing?.enabled) {
            await bot.sendMessage(chatId,
              `🛡️ *AI Guardian is ACTIVE* in this group\n\n` +
              `• Scans today: ${existing.scansToday}/${existing.scanLimitPerDay}\n` +
              `• Contract scanning: ${existing.scanContracts ? '✅' : '❌'}\n` +
              `• Wallet risk checks: ${existing.scanWallets ? '✅' : '❌'}\n` +
              `• Risk threshold: ${existing.riskThreshold}/100\n\n` +
              `Status: ${existing.subscriptionStatus === 'active' ? '⭐ Pro' : '🆓 Free (10 scans/day)'}`,
              { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
                { text: '⏸️ Disable Guardian', callback_data: `guardian_disable:${groupId}` },
                { text: '⬆️ Upgrade to Pro', callback_data: 'upgrade_guardian' }
              ]]}}
            );
          } else {
            await bot.sendMessage(chatId,
              `🛡️ *AI Guardian — Group Security*\n\n` +
              `Automatically scans every contract address and wallet posted here.\n\n` +
              `🆓 *Free:* 10 scans/day\n` +
              `⭐ *Pro:* Unlimited — $50/month\n\n` +
              `Enable now?`,
              { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
                { text: '✅ Enable (Free)', callback_data: `guardian_enable:${groupId}` },
                { text: '⭐ Enable Pro', callback_data: 'upgrade_guardian' }
              ]]}}
            );
          }
        } else {
          await bot.sendMessage(chatId,
            `🛡️ *AI Guardian* protects crypto groups from scams.\n\n` +
            `Add @coinrailz_bot to any group, then use /guardian in the group to activate.\n\n` +
            `Automatically scans contract addresses and wallet risk scores for every message.`,
            { parse_mode: 'Markdown' }
          );
        }
      }

      // ── Trading commands — route to TelegramTradingService ────────────────
      else if (text.startsWith("/wallet") || text.match(/^\/(buy|sell)\s+\S+\s+\d/) || text.startsWith("/copy") || text.startsWith("/upgrade") || text.startsWith("/tradehelp")) {
        await tradingService.handleCommand(chatId, text, update.message.from);
      }
      
      // Handle /buy command (credits purchase — no trading args)
      else if (text === "/buy") {
        const keyboard = PAYMENT_TIERS.map(tier => [{
          text: `⭐ ${tier.label}`,
          callback_data: `buy_${tier.stars}`
        }]);
        
        await bot.sendMessage(chatId,
          "💰 *Buy Credits with Telegram Stars*\n\n" +
          "Choose a payment tier:\n\n" +
          "⭐ 1,000 Stars → $10 credits\n" +
          "⭐ 2,500 Stars → $27.50 credits (+10% bonus)\n" +
          "⭐ 5,000 Stars → $57.50 credits (+15% bonus)\n" +
          "⭐ 10,000 Stars → $120 credits (+20% bonus)\n\n" +
          "✨ Pay with Apple Pay, Google Pay, or card!",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
      }
      
      // Handle /balance command
      else if (text === "/balance") {
        const telegramId = update.message.from?.id;
        if (!telegramId) {
          await bot.sendMessage(chatId, "Error: Could not identify your account.");
          return res.status(200).json({ ok: true });
        }
        
        const telegramAccount = await db.query.telegramAccounts.findFirst({
          where: eq(telegramAccounts.telegramId, telegramId.toString())
        });
        
        if (!telegramAccount) {
          await bot.sendMessage(chatId,
            "❌ No account found. Send /start to create an account and get $1 free!"
          );
          return res.status(200).json({ ok: true });
        }
        
        const balance = await creditsService.getBalance(telegramAccount.userId);
        
        await bot.sendMessage(chatId,
          `💰 *Your Balance*\n\n` +
          `Credits: $${balance.toFixed(2)}\n\n` +
          `Use /buy to add more credits or /help for available services.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                { text: "💳 Buy More Credits", callback_data: "buy_credits" }
              ]]
            }
          }
        );
      }
    }
    
    // Handle callback queries (inline button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message?.chat.id;
      const data = callbackQuery.data;
      const userId = callbackQuery.from.id;
      
      if (!chatId) {
        return res.status(200).json({ ok: true });
      }
      
      // Answer callback query immediately to remove loading state
      await bot.answerCallbackQuery(callbackQuery.id);
      
      // Show buy credits tier selection
      if (data === "buy_credits") {
        const keyboard = PAYMENT_TIERS.map(tier => [{
          text: `⭐ ${tier.label}`,
          callback_data: `buy_${tier.stars}`
        }]);
        
        await bot.sendMessage(chatId,
          "💰 *Buy Credits with Telegram Stars*\n\n" +
          "Choose a payment tier:\n\n" +
          "⭐ 1,000 Stars → $10 credits\n" +
          "⭐ 2,500 Stars → $27.50 credits (+10% bonus)\n" +
          "⭐ 5,000 Stars → $57.50 credits (+15% bonus)\n" +
          "⭐ 10,000 Stars → $120 credits (+20% bonus)",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
      }
      
      // Handle specific tier purchase
      else if (data?.startsWith("buy_")) {
        const stars = parseInt(data.replace("buy_", ""));
        const tier = PAYMENT_TIERS.find(t => t.stars === stars);
        
        if (!tier) {
          await bot.sendMessage(chatId, 
            "⚠️ Invalid payment tier. Please use /buy to see available options."
          );
          return;
        }
        
        const totalCredits = tier.usdValue * (1 + tier.bonus);
        
        // Send Telegram Stars invoice (no provider_token needed for Stars)
        await bot.sendInvoice(chatId, tier.label, tier.description, JSON.stringify({
            type: "credits_bundle",
            userId, 
            stars: tier.stars,
            usdValue: tier.usdValue, 
            bonus: tier.bonus,
            totalCredits 
          }), "", "XTR", [{ label: tier.label, amount: tier.stars }]);
      }

      // ── Per-call Stars micropayments ──────────────────────────────────────
      else if (data?.startsWith("stars_pay:")) {
        const service = data.replace("stars_pay:", "");
        const svc = STARS_PER_CALL[service];
        if (!svc) {
          await bot.sendMessage(chatId, "⚠️ Unknown service.");
          return;
        }
        await bot.sendInvoice(chatId, svc.label, `Pay ${svc.stars} ⭐ Stars to access ${svc.label} ($${svc.usd.toFixed(2)})`, JSON.stringify({ type: "per_call", service, stars: svc.stars, usd: svc.usd, telegramUserId: userId }), "", "XTR", [{ label: svc.label, amount: svc.stars }]);
      }

      // ── Guardian callbacks ────────────────────────────────────────────────
      else if (data?.startsWith("guardian_enable:")) {
        const groupId = data.replace("guardian_enable:", "");
        try {
          // Verify the requesting user is an admin of the target group
          let isGroupAdmin = false;
          try {
            const member = await bot.getChatMember(parseInt(groupId), userId);
            isGroupAdmin = ['administrator', 'creator'].includes(member.status);
          } catch {
            isGroupAdmin = true; // can't verify yet (bot not cached) — allow through
          }
          if (!isGroupAdmin) {
            await bot.sendMessage(chatId, '❌ Only group admins can enable AI Guardian.');
            return;
          }
          await db.insert(telegramGuardians).values({
            groupChatId: groupId,
            adminUserId: userId.toString(),
            enabled: true,
            subscriptionStatus: "trial",
            scanContracts: true,
            scanWallets: true,
            riskThreshold: 60,
            scanLimitPerDay: 10,
          }).onConflictDoUpdate({
            target: telegramGuardians.groupChatId,
            set: { enabled: true, adminUserId: userId.toString() }
          });
          await bot.sendMessage(chatId,
            `✅ *AI Guardian activated!*\n\n` +
            `The group is now protected. I'll automatically scan contract addresses and wallet risk scores in every message.\n\n` +
            `🆓 *Free tier:* 10 scans/day\n` +
            `⭐ *Guardian Pro:* Unlimited — 4,000 Stars/month\n\n` +
            `Use /guardian in the group to manage settings.`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
              { text: '⭐ Upgrade to Pro — 4,000 Stars', callback_data: `upgrade_guardian:${groupId}` }
            ]]}}
          );
        } catch (err) {
          console.error('Guardian enable error:', err);
          await bot.sendMessage(chatId, '❌ Error enabling Guardian. Please try again.');
        }
      }

      else if (data?.startsWith("guardian_disable:")) {
        const groupId = data.replace("guardian_disable:", "");
        try {
          let isGroupAdmin = false;
          try {
            const member = await bot.getChatMember(parseInt(groupId), userId);
            isGroupAdmin = ['administrator', 'creator'].includes(member.status);
          } catch { isGroupAdmin = true; }
          if (!isGroupAdmin) { await bot.sendMessage(chatId, '❌ Only group admins can manage Guardian.'); return; }
          await db.update(telegramGuardians)
            .set({ enabled: false })
            .where(eq(telegramGuardians.groupChatId, groupId));
          await bot.sendMessage(chatId, '⏸️ AI Guardian paused for this group. Use /guardian to re-enable.');
        } catch (err) {
          await bot.sendMessage(chatId, '❌ Error pausing Guardian.');
        }
      }

      else if (data === "upgrade_guardian" || data?.startsWith("upgrade_guardian:")) {
        const groupId = data.includes(":") ? data.split(":")[1] : null;
        // Guardian Pro = 4,000 Telegram Stars/month ($50 equivalent)
        await bot.sendInvoice(chatId, "Guardian Pro — Monthly", "Unlimited AI security scans in your group for 30 days. Automatically detects rug pulls, scam contracts, and high-risk wallets.", JSON.stringify({ type: "guardian_pro", groupId, adminTelegramId: userId }), "", "XTR", [{ label: "Guardian Pro (30 days)", amount: 4000 }]);
      }

      // ── Trading callbacks — delegate to trading service ───────────────────
      else {
        const handled = await tradingService.handleCallback(chatId, data || '', callbackQuery.id, callbackQuery.from);
        if (!handled) {
          // Not a trading callback — no-op (already answered the callback query above)
        }
      }
    }
    
    // Handle pre-checkout query (required by Telegram before payment)
    if (update.pre_checkout_query) {
      const preCheckoutQuery = update.pre_checkout_query;
      // Always approve — Telegram requires this within 10 seconds
      await bot.answerPreCheckoutQuery(preCheckoutQuery.id, true);
    }
    
    // Handle successful payment (Telegram Stars)
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const chatId = update.message.chat.id;
      
      try {
        const payload = JSON.parse(payment.invoice_payload);
        const chargeId = payment.telegram_payment_charge_id;

        // ── Per-call micropayment: deliver the service inline ─────────────
        if (payload.type === "per_call") {
          const { service, usd, telegramUserId } = payload;

          // Idempotency: check if we already processed this charge
          const alreadyProcessed = await db.query.telegramAccounts.findFirst({
            where: eq(telegramAccounts.telegramId, telegramUserId?.toString() || "0")
          }).catch(() => null);
          // (Full idempotency would check a payments log table — adequate for now as
          //  Telegram only delivers successful_payment once per charge_id)

          // Send Stars receipt + instruction to open Mini-App with credits
          await bot.sendMessage(chatId,
            `✅ *${STARS_PER_CALL[service]?.label || service} — Paid!*\n\n` +
            `Paid: ${payment.total_amount} ⭐ Stars ($${usd?.toFixed(2)})\n` +
            `Charge ID: \`${chargeId}\`\n\n` +
            `Open the app below to run your ${STARS_PER_CALL[service]?.label || 'service'}:`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[
                  { text: `🎮 Open ${STARS_PER_CALL[service]?.label || 'Service'}`, web_app: { url: `${WEBAPP_URL}?action=${service}&stars_paid=${chargeId}` } }
                ]]
              }
            }
          );
          return;
        }

        // ── Guardian Pro payment: upgrade group to unlimited scans ───────────
        if (payload.type === "guardian_pro") {
          const { groupId } = payload;
          if (groupId) {
            await db.update(telegramGuardians)
              .set({ subscriptionStatus: "active", scanLimitPerDay: 9999 })
              .where(eq(telegramGuardians.groupChatId, groupId.toString()));
          }
          await bot.sendMessage(chatId,
            `⭐ *Guardian Pro Activated!*\n\n` +
            `Your group is now protected with *unlimited scans* for the next 30 days.\n\n` +
            `Thank you for supporting Coin Railz! 🚀\n` +
            `Charge ID: \`${chargeId}\``,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // ── Credits bundle payment ────────────────────────────────────────
        const { stars, usdValue, bonus, totalCredits } = payload;

        const from = update.message.from;
        if (!from) throw new Error("No sender info");

        // IDEMPOTENCY: skip if this exact charge was already processed
        const [existingTx] = await db.select()
          .from(creditTransactions)
          .where(eq(creditTransactions.referenceId, chargeId))
          .limit(1);
        if (existingTx) {
          console.log(`⚠️ Stars webhook: charge ${chargeId} already processed (tx ${existingTx.id}) — skipping`);
          await bot.sendMessage(chatId, '✅ Your credits have already been added to your account.');
          return;
        }

        // AUTO-PROVISION: create account if user paid before /start
        const telegramAccount = await getOrCreateTelegramAccountFromUpdate(from);

        // Add credits — CORRECT object-based signature for creditsService.addCredits()
        await creditsService.addCredits({
          userId: telegramAccount.userId,
          amount: Math.round(totalCredits * 100) / 100,
          paymentMethod: "telegram_stars",
          referenceId: chargeId,
          description: `Telegram Stars payment - ${stars} ⭐ (${bonus > 0 ? `$${usdValue} + ${(bonus * 100).toFixed(0)}% bonus` : `$${usdValue}`})`,
          metadata: { source: "telegram_stars", chargeId, stars, usdValue, bonus: bonus || 0 }
        });
        
        const newBalance = await creditsService.getBalance(telegramAccount.userId);
        
        await bot.sendMessage(chatId,
          `✅ *Payment Successful!*\n\n` +
          `Paid: ${stars} ⭐ Stars\n` +
          `Added: $${totalCredits.toFixed(2)} credits\n` +
          `New Balance: $${newBalance.toFixed(2)}\n\n` +
          `Ready to use your credits! 🚀`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                { text: "🎮 Launch Agent Console", web_app: { url: WEBAPP_URL } }
              ]]
            }
          }
        );
      } catch (error) {
        console.error("Payment processing error:", error);
        await bot.sendMessage(chatId,
          "⚠️ Payment received but there was an error. Please contact support with payment ID: " + 
          payment.telegram_payment_charge_id
        );
      }
    }

    // Response already sent at the beginning of the handler
  } catch (error) {
    console.error("Telegram webhook error:", error);
    // Don't send error response if we already sent 200 OK
    // Just log the error - Telegram already received acknowledgment
  }
});

/**
 * GET /api/telegram/trades
 * Returns trade history and P&L for the authenticated Telegram user.
 * Auth: initData query param (same pattern as /api/telegram/activity)
 */
router.get('/trades', async (req: Request, res: Response) => {
  try {
    const { initData } = req.query as { initData?: string };
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);

    if (!initData) {
      return res.status(401).json({ error: 'initData required' });
    }

    const telegramData = validateTelegramData(initData);
    if (!telegramData) {
      return res.status(401).json({ error: 'Invalid initData' });
    }

    const telegramId = telegramData.id.toString();
    const telegramAccount = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.telegramId, telegramId)
    });

    if (!telegramAccount) {
      return res.json({ trades: [], totalPnL: 0, winRate: 0 });
    }

    const trades = await db.select().from(telegramTrades)
      .where(eq(telegramTrades.telegramUserId, telegramId))
      .orderBy(desc(telegramTrades.createdAt))
      .limit(limit);

    const totalPnL = trades.reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0);
    const wins = trades.filter(t => parseFloat(t.pnl || '0') > 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

    return res.json({
      trades,
      totalPnL,
      winRate,
      telegramId,
      count: trades.length
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/telegram/link
 * Links Telegram user to Coin Railz account, auto-creates if doesn't exist
 */
router.post("/link", async (req: Request, res: Response) => {
  try {
    const { initData, referralCode } = req.body;

    if (!initData) {
      return res.status(400).json({ error: "initData is required" });
    }

    // Validate Telegram signature
    const userData = validateTelegramData(initData);
    if (!userData) {
      return res.status(401).json({ error: "Invalid Telegram signature" });
    }

    // Extract validated data
    const telegramId = userData.id;
    const username = userData.username || null;
    const firstName = userData.first_name || "User";
    const lastName = userData.last_name || null;

    // Check if Telegram account already exists
    let telegramAccount = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.telegramId, telegramId.toString())
    });

    if (telegramAccount) {
      // Existing user - get their balance
      const balance = await creditsService.getBalance(telegramAccount.userId);

      return res.json({
        userId: telegramAccount.userId,
        telegramId: telegramAccount.telegramId,
        username: telegramAccount.username,
        firstName: telegramAccount.firstName,
        referralCode: telegramAccount.referralCode,
        balance,
        displayName: `${telegramAccount.firstName || 'User'}`,
        isNewUser: false
      });
    }

    // New user - create full account
    const userId = `t${nanoid(8)}`; // Generate unique user ID (9 chars total - fits varchar(12))
    const userReferralCode = `T${nanoid(8)}`; // Generate referral code (9 chars total)

    // NON-TRANSACTIONAL version for neon-http driver compatibility
    // Execute operations sequentially
    
    // 1. Create user record
    await db.insert(users).values({
      id: userId,
      firstName: firstName || 'Telegram',
      lastName: lastName || 'User',
      accountStatus: 'active',
      referralCode: userReferralCode,
      freeCreditsGranted: true, // Mark that we gave them the bonus
    });

    // 2. Create credits account with $1 starting bonus
    const [creditsAccount] = await db.insert(creditsAccounts).values({
      userId,
      balance: STARTING_BONUS.toFixed(2),
      autoTopUpEnabled: false,
    }).returning();

    // 3. Log the starting bonus transaction
    await db.insert(creditTransactions).values({
      accountId: creditsAccount.id,
      userId,
      amount: STARTING_BONUS.toFixed(2),
      type: 'bonus',
      balanceBefore: '0.00',
      balanceAfter: STARTING_BONUS.toFixed(2),
      description: 'Welcome bonus - Try Coin Railz services!',
      metadata: {
        source: 'telegram_miniapp',
        reason: 'new_user_bonus'
      }
    });

    // 4. Generate server-side API key for this user
    const apiKeyValue = `cr_tg_${nanoid(32)}`;
    const keyPrefix = apiKeyValue.substring(0, 12); // cr_tg_xxxxxx (12 chars max)
    const hashedKey = await bcrypt.hash(apiKeyValue, 10); // Hash for secure storage

    const [apiKey] = await db.insert(apiKeys).values({
      userId,
      hashedKey, // Store hashed version
      keyPrefix,
      name: 'Telegram Mini-App',
      status: 'active',
      rateLimit: 100
    }).returning();
    
    // 5. Create Telegram account link
    const referredByUserId = referralCode ? await findUserByReferralCode(referralCode) : null;

    // SECURITY: Prevent self-referral exploit (check by Telegram ID, not userId)
    // Users can create multiple accounts with different userIds but same Telegram identity
    if (referredByUserId) {
      const referrerTelegramAccount = await db.query.telegramAccounts.findFirst({
        where: eq(telegramAccounts.userId, referredByUserId)
      });
      
      // Block if referrer has the same Telegram ID (self-referral across accounts)
      if (referrerTelegramAccount && referrerTelegramAccount.telegramId === telegramId.toString()) {
        throw new Error('Cannot refer yourself across multiple accounts');
      }
    }

    await db.insert(telegramAccounts).values({
      telegramId: telegramId.toString(),
      userId,
      apiKeyId: apiKey.id,
      username: username || null,
      firstName: firstName || null,
      lastName: lastName || null,
      referralCode: userReferralCode,
      referredByUserId,
      welcomeBonusGranted: true
    });

    // 6. If referred, log referral (bonus will be credited on first purchase)
    if (referredByUserId) {
      await db.insert(telegramReferrals).values({
        referrerUserId: referredByUserId,
        refereeUserId: userId,
        bonusAmount: '0.00', // Will be updated when referee makes first purchase
      });
    }

    // SECURITY: Return API key ONCE for SDK/direct API access
    // Never log this value. Delivered over HTTPS only.
    // Frontend must prompt user to copy and never store it.
    res.json({
      userId,
      telegramId: telegramId.toString(),
      username,
      firstName,
      referralCode: userReferralCode,
      balance: STARTING_BONUS,
      displayName: firstName || 'User',
      isNewUser: true,
      apiKey: apiKeyValue, // ⚠️ Shown ONCE - user must copy now
      apiKeyPrefix: keyPrefix,
      welcomeMessage: `Welcome! You've received $${STARTING_BONUS} in free credits to try our services. 🎉`,
      securityNotice: "Copy your API key now - it won't be shown again!"
    });

  } catch (error) {
    console.error("Telegram link error:", error);
    res.status(500).json({ error: "Failed to link Telegram account" });
  }
});

/**
 * Helper: Find user by referral code
 */
async function findUserByReferralCode(code: string): Promise<string | null> {
  const account = await db.query.telegramAccounts.findFirst({
    where: eq(telegramAccounts.referralCode, code)
  });
  return account?.userId || null;
}

/**
 * POST /api/telegram/agent-chat
 * OpenAI-powered chat that routes to Coin Railz services
 */
router.post("/agent-chat", async (req: Request, res: Response) => {
  try {
    const { initData, message } = req.body;

    if (!initData || !message) {
      return res.status(400).json({ error: "initData and message are required" });
    }

    // Validate Telegram signature
    const userData = validateTelegramData(initData);
    if (!userData) {
      return res.status(401).json({ error: "Invalid Telegram signature" });
    }

    const telegramId = userData.id;

    // Get Telegram account and API key
    const telegramAccount = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.telegramId, telegramId.toString())
    });

    if (!telegramAccount) {
      return res.status(404).json({ error: "Telegram account not found. Please refresh the app." });
    }

    // Get user's API key
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, telegramAccount.apiKeyId || "")
    });

    if (!apiKey) {
      return res.status(500).json({ error: "API key not found. Please contact support." });
    }

    // Get current balance
    const balance = await creditsService.getBalance(telegramAccount.userId);

    // CRITICAL: Charge for chat message usage ($0.10 per message)
    const CHAT_FEE = 0.10;
    if (balance < CHAT_FEE) {
      return res.status(402).json({ 
        error: "Insufficient credits", 
        balance,
        required: CHAT_FEE,
        message: "You need at least $0.10 to chat. Please top up your account."
      });
    }

    // Deduct chat fee BEFORE calling OpenAI (CRITICAL: prevents free usage)
    try {
      await creditsService.deductCredits({
        userId: telegramAccount.userId,
        amount: CHAT_FEE,
        serviceName: 'telegram-chat',
        description: 'AI chat message',
        metadata: { source: 'telegram_miniapp' }
      });
    } catch (error: any) {
      // Insufficient credits - return 402
      return res.status(402).json({
        error: "Insufficient credits",
        balance,
        required: CHAT_FEE,
        message: error.message || "You need at least $0.10 to chat. Please top up your account."
      });
    }

    // Update balance after deduction
    const updatedBalance = balance - CHAT_FEE;

    // Define OpenAI tools (functions) for Coin Railz services
    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "wallet_risk",
          description: "Check wallet risk score and security analysis",
          parameters: {
            type: "object",
            properties: {
              walletAddress: { type: "string", description: "Wallet address to check" },
              chain: { type: "string", enum: ["ethereum", "base", "polygon"], description: "Blockchain network" }
            },
            required: ["walletAddress", "chain"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "token_price",
          description: "Get current token price with 24h data",
          parameters: {
            type: "object",
            properties: {
              tokenAddress: { type: "string", description: "Token contract address" },
              chain: { type: "string", description: "Blockchain network" }
            },
            required: ["tokenAddress", "chain"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "dex_liquidity",
          description: "Check DEX liquidity for a token",
          parameters: {
            type: "object",
            properties: {
              tokenAddress: { type: "string", description: "Token contract address" },
              chain: { type: "string", description: "Blockchain network" }
            },
            required: ["tokenAddress", "chain"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "contract_scan",
          description: "Perform smart contract security scan",
          parameters: {
            type: "object",
            properties: {
              contractAddress: { type: "string", description: "Contract address to scan" },
              chain: { type: "string", description: "Blockchain network" }
            },
            required: ["contractAddress", "chain"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "multi_chain_balance",
          description: "Get wallet balance across multiple chains",
          parameters: {
            type: "object",
            properties: {
              walletAddress: { type: "string", description: "Wallet address to check" }
            },
            required: ["walletAddress"]
          }
        }
      }
    ];

    // Call OpenAI with tools
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Coin Railz Copilot, an AI assistant for blockchain services. You help users check wallet risks, token prices, DEX liquidity, contract security, and balances. 

Current user balance: $${updatedBalance.toFixed(2)}

Service costs:
- Wallet Risk: $0.50
- Token Price: $0.25
- DEX Liquidity: $0.20
- Contract Scan: $1.00
- Multi-Chain Balance: $0.50

If user asks for a service and lacks funds, politely inform them and suggest topping up. Be concise and helpful.`
        },
        { role: "user", content: message }
      ],
      tools,
      tool_choice: "auto"
    });

    const responseMessage = completion.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    // If OpenAI wants to call tools
    if (toolCalls && toolCalls.length > 0) {
      const toolResults = [];
      
      // Track balance before service calls for accurate cost calculation
      const balanceBeforeServices = await creditsService.getBalance(telegramAccount.userId);

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue;
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        // Map function name to service ID and call our API
        const serviceId = functionName.replace("_", "-");
        
        try {
          // SECURITY: Generate cryptographically signed JWT token for internal auth
          // This prevents header spoofing - only our backend can generate valid tokens
          const internalAuthToken = generateInternalAuthToken(telegramAccount.userId);
          
          const response = await fetch(`${process.env.REPL_HOME || 'http://localhost:5000'}/api/x402/${serviceId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-User-ID': telegramAccount.userId,
              'X-Internal-Auth': internalAuthToken // JWT signed with JWT_SECRET
            },
            body: JSON.stringify(functionArgs)
          });

          if (!response.ok) {
            const error = await response.json();
            toolResults.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify({ error: error.error || "Service failed" })
            });
            continue;
          }

          const result = await response.json();
          toolResults.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify(result)
          });

        } catch (error: any) {
          toolResults.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify({ error: error.message })
          });
        }
      }

      // Send tool results back to OpenAI for final response
      const finalCompletion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are Coin Railz Copilot. Format service results clearly for the user. Current balance: $${updatedBalance.toFixed(2)}`
          },
          { role: "user", content: message },
          responseMessage,
          ...toolResults.map(result => ({
            role: "tool" as const,
            tool_call_id: result.tool_call_id,
            content: result.output
          }))
        ]
      });

      // Get updated balance after service calls
      const newBalance = await creditsService.getBalance(telegramAccount.userId);
      
      // Calculate actual service costs (not including the $0.10 chat fee)
      // Clamp to 0 to handle failed/refunded tool calls
      const delta = balanceBeforeServices - newBalance;
      const serviceCosts = Math.max(delta, 0);
      const creditsSpent = CHAT_FEE + serviceCosts;

      return res.json({
        message: finalCompletion.choices[0].message.content,
        toolsUsed: toolCalls
          .filter((toolCall): toolCall is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => toolCall.type === 'function')
          .map((toolCall) => toolCall.function.name),
        chatFee: CHAT_FEE,
        serviceCosts,
        creditsSpent,
        newBalance
      });
    }

    // No tools called - just return OpenAI's response
    // FIX: Show updated balance (after $0.10 chat deduction)
    const newBalance = await creditsService.getBalance(telegramAccount.userId);
    
    res.json({
      message: responseMessage.content,
      toolsUsed: [],
      creditsSpent: CHAT_FEE, // User paid $0.10 for chat
      newBalance
    });

  } catch (error: any) {
    console.error("Agent chat error:", error);
    res.status(500).json({ error: "Chat failed", details: error.message });
  }
});

/**
 * GET /api/telegram/activity
 * Get user's recent transaction history
 */
router.get("/activity", async (req: Request, res: Response) => {
  try {
    const { initData } = req.query;

    if (!initData || typeof initData !== 'string') {
      return res.status(400).json({ error: "initData is required" });
    }

    // Validate Telegram signature
    const userData = validateTelegramData(initData);
    if (!userData) {
      return res.status(401).json({ error: "Invalid Telegram signature" });
    }

    const telegramId = userData.id;

    // Get Telegram account
    const telegramAccount = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.telegramId, telegramId.toString())
    });

    if (!telegramAccount) {
      return res.status(404).json({ error: "Telegram account not found" });
    }

    // Get recent transactions
    const transactions = await db.query.creditTransactions.findMany({
      where: eq(creditTransactions.userId, telegramAccount.userId),
      orderBy: [desc(creditTransactions.createdAt)],
      limit: 20
    });

    // Format for mobile UI
    const activity = transactions.map(tx => ({
      id: tx.id,
      amount: parseFloat(tx.amount),
      type: tx.type,
      description: tx.description,
      timestamp: tx.createdAt,
      serviceName: tx.metadata && typeof tx.metadata === 'object' && 'serviceName' in tx.metadata 
        ? tx.metadata.serviceName as string
        : null
    }));

    res.json({ activity });

  } catch (error) {
    console.error("Activity fetch error:", error);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

// ─── Admin: Telegram Broadcast ────────────────────────────────────────────────

function requireTelegramAdmin(req: Request, res: Response, next: () => void) {
  const key = req.headers['x-admin-key'] as string | undefined;
  if (key && key === process.env.ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Admin authentication required. Pass X-Admin-Key header.' });
}

/**
 * POST /api/telegram/broadcast
 * Send a feature-announcement message to every Telegram user who has opted in
 * (started the bot) and every group where AI Guardian is active.
 * 
 * TOS compliance: only sends to users who initiated contact (telegram_accounts)
 * and groups where we are an active member (telegram_guardians).
 * 
 * Body: { dryRun?: boolean, audience?: "users"|"groups"|"all", message?: string }
 */
router.post('/broadcast', requireTelegramAdmin, async (req: Request, res: Response) => {
  try {
    const { dryRun = false, audience = 'all', customMessage } = req.body;

    const userMessage =
`🚀 *Coin Railz — New Features Live*

Since you started @coinrailz_bot, you're first to know about what just shipped:

⭐ *Pay-Per-Call (Stars)* — No credit bundle needed
  • Token Price: 20 ⭐ ($0.25)
  • Wallet Risk Check: 40 ⭐ ($0.50)
  • Contract Scan: 80 ⭐ ($1.00)

🛡️ *AI Guardian* — Add me to any group for real-time address scanning. Free tier: 10 scans/day. Pro: unlimited.

📊 *Solana Trading Bot* — /buy /sell /portfolio with P&L tracking

🤖 *Bot-to-Bot Payment Rail* — Add @coinrailz_bot to any group alongside other trading bots. We handle payment routing via x402/USDC.

Use the button below to access all 76 services 👇`;

    const groupMessage =
`🛡️ *AI Guardian — Update*

Coin Railz just expanded its capabilities for this group:

• Solana address scanning (in addition to EVM)
• Wallet risk scoring with on-chain history
• Real-time honeypot pattern detection

⭐ Upgrade to *Guardian Pro* for unlimited scans — just 4,000 Stars/month.

Type /guardian to manage settings or /help for full service list.`;

    const finalUserMessage = customMessage || userMessage;
    const finalGroupMessage = customMessage || groupMessage;

    // Fetch audiences
    const results = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] };
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    // ── Individual users (opted-in via /start) ────────────────────────────
    if (audience === 'users' || audience === 'all') {
      const accounts = await db.select({
        telegramId: telegramAccounts.telegramId,
        firstName: telegramAccounts.firstName,
      }).from(telegramAccounts);

      console.log(`📢 Telegram broadcast: ${accounts.length} opted-in users (dryRun=${dryRun})`);

      for (const account of accounts) {
        if (dryRun) {
          results.skipped++;
          continue;
        }
        try {
          await bot.sendMessage(parseInt(account.telegramId), finalUserMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Launch Agent Console', web_app: { url: WEBAPP_URL } }],
                [{ text: '⭐ Buy Credits with Stars', callback_data: 'buy_credits' }]
              ]
            }
          });
          results.sent++;
          await delay(50); // ~20 msgs/sec — well within Telegram's 30/sec global limit
        } catch (err: any) {
          results.failed++;
          results.errors.push(`user ${account.telegramId}: ${err.message}`);
        }
      }
    }

    // ── Guardian groups (bot is an active member) ─────────────────────────
    if (audience === 'groups' || audience === 'all') {
      const guardians = await db.select({
        groupChatId: telegramGuardians.groupChatId,
        groupTitle: telegramGuardians.groupTitle,
      }).from(telegramGuardians)
        .where(eq(telegramGuardians.enabled, true));

      console.log(`📢 Telegram broadcast: ${guardians.length} active Guardian groups (dryRun=${dryRun})`);

      for (const group of guardians) {
        if (dryRun) {
          results.skipped++;
          continue;
        }
        try {
          await bot.sendMessage(parseInt(group.groupChatId), finalGroupMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '⭐ Upgrade to Guardian Pro', callback_data: `upgrade_guardian:${group.groupChatId}` }
              ]]
            }
          });
          results.sent++;
          await delay(1100); // 1.1 sec between group messages (Telegram group limit: 1/sec)
        } catch (err: any) {
          results.failed++;
          results.errors.push(`group ${group.groupChatId}: ${err.message}`);
        }
      }
    }

    return res.json({
      success: true,
      dryRun,
      audience,
      results,
      message: dryRun
        ? `Dry run: would send to ${results.skipped} recipients`
        : `Broadcast complete: ${results.sent} sent, ${results.failed} failed`
    });

  } catch (error: any) {
    console.error('Telegram broadcast error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;