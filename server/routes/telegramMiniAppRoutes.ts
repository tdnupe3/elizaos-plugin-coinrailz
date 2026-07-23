import { Router, Request, Response } from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { telegramAccounts, telegramReferrals, users, creditsAccounts, creditTransactions, apiKeys } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { creditsService } from "../services/creditsService";
import { nanoid } from "nanoid";

const router = Router();

// Initialize Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

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
 * POST /api/telegram/webhook
 * Handles bot commands like /start
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const update = req.body;
    
    // CRITICAL: Respond to Telegram immediately (within 1 second) to prevent timeout
    // Process commands asynchronously after sending 200 OK
    res.status(200).json({ ok: true });

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

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
          "Cost: $0.10 chat + $1.00 scan = $1.10",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🎮 Open Scanner",
                  web_app: { url: `${WEBAPP_URL}?action=scan` }
                }
              ]]
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
          "Cost: $0.10 chat + $0.50 risk check = $0.60",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🎮 Check Risk",
                  web_app: { url: `${WEBAPP_URL}?action=risk` }
                }
              ]]
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
          "Cost: $0.10 chat + $0.25 price = $0.35",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🎮 Check Prices",
                  web_app: { url: `${WEBAPP_URL}?action=price` }
                }
              ]]
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
          "Cost: $0.10 chat + $0.20 liquidity = $0.30",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🎮 View Liquidity",
                  web_app: { url: `${WEBAPP_URL}?action=liquidity` }
                }
              ]]
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
          "Cost: $0.10 chat + $0.50 report = $0.60",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🎮 View Portfolio",
                  web_app: { url: `${WEBAPP_URL}?action=portfolio` }
                }
              ]]
            }
          }
        );
      }
      
      // Handle /buy command
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
          return res.status(200).json({ ok: true });
        }
        
        const totalCredits = tier.usdValue * (1 + tier.bonus);
        
        // Send Telegram Stars invoice (no provider_token needed for Stars)
        await bot.sendInvoice(chatId, {
          title: tier.label,
          description: tier.description,
          payload: JSON.stringify({ 
            userId, 
            stars: tier.stars,
            usdValue: tier.usdValue, 
            bonus: tier.bonus,
            totalCredits 
          }),
          currency: "XTR", // XTR = Telegram Stars currency code
          prices: [{
            label: tier.label,
            amount: tier.stars // For Stars, amount is in Stars (not cents)
          }]
        });
      }
    }
    
    // Handle pre-checkout query (required by Telegram before payment)
    if (update.pre_checkout_query) {
      const preCheckoutQuery = update.pre_checkout_query;
      
      // Validate the payment - always approve for now
      await bot.answerPreCheckoutQuery(preCheckoutQuery.id, true);
    }
    
    // Handle successful payment (Telegram Stars)
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const chatId = update.message.chat.id;
      
      try {
        const payload = JSON.parse(payment.invoice_payload);
        const { stars, usdValue, bonus, totalCredits } = payload;
        
        // Find user's account
        const telegramId = update.message.from?.id;
        if (!telegramId) throw new Error("No telegram ID");
        
        const telegramAccount = await db.query.telegramAccounts.findFirst({
          where: eq(telegramAccounts.telegramId, telegramId.toString())
        });
        
        if (!telegramAccount) throw new Error("No account found");
        
        // Add credits to account
        await creditsService.addCredits(
          telegramAccount.userId,
          totalCredits,
          `Telegram Stars payment - ${stars} ⭐ (${bonus > 0 ? `$${usdValue} + ${(bonus * 100)}% bonus` : `$${usdValue}`})`,
          {
            source: "telegram_stars",
            paymentId: payment.telegram_payment_charge_id,
            stars,
            usdValue,
            bonus: bonus || 0
          }
        );
        
        // Get new balance
        const newBalance = await creditsService.getBalance(telegramAccount.userId);
        
        // Send success message
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
                {
                  text: "🎮 Launch Agent Console",
                  web_app: { url: WEBAPP_URL }
                }
              ]]
            }
          }
        );
      } catch (error) {
        console.error("Payment processing error:", error);
        await bot.sendMessage(chatId,
          "⚠️ Payment received but there was an error adding credits. Please contact support with this payment ID: " + 
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
      balance: STARTING_BONUS,
      autoTopUpEnabled: false,
    }).returning();

    // 3. Log the starting bonus transaction
    await db.insert(creditTransactions).values({
      accountId: creditsAccount.id,
      userId,
      amount: STARTING_BONUS,
      type: 'bonus',
      balanceBefore: '0.00',
      balanceAfter: STARTING_BONUS,
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
      rateLimit: 100,
      metadata: {
        source: 'telegram',
        telegramId: telegramId.toString()
      }
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
        bonusAmount: 0, // Will be updated when referee makes first purchase
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
    const completion = await openai.chat.completions.create({
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
      const finalCompletion = await openai.chat.completions.create({
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
        toolsUsed: toolCalls.map(tc => tc.function.name),
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

export default router;