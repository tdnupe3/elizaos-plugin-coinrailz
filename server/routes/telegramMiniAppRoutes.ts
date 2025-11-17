import { Router, Request, Response } from "express";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import crypto from "crypto";
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
const WEBAPP_URL = process.env.REPL_HOME ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/telegram/app` : "http://localhost:5000/telegram/app";
const STARTING_BONUS = 1.00; // $1 starting bonus
const REFERRAL_BONUS_PERCENT = 0.10; // 10% of first purchase

/**
 * Validate Telegram initData signature to prevent spoofing
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramData(initData: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    params.delete("hash");
    
    // Sort params alphabetically
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    return calculatedHash === hash;
  } catch (error) {
    console.error("Telegram data validation error:", error);
    return false;
  }
}

/**
 * POST /api/telegram/webhook
 * Handles bot commands like /start
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const update = req.body;

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
          "• Token Prices\n" +
          "• Contract Scans\n" +
          "• DEX Liquidity\n" +
          "• And 14 more services!\n\n" +
          "Tap below to get started 👇",
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🎮 Launch Agent Console",
                  web_app: { url: referralCode ? `${WEBAPP_URL}?ref=${referralCode}` : WEBAPP_URL }
                }
              ]]
            }
          }
        );
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/telegram/link
 * Links Telegram user to Coin Railz account, auto-creates if doesn't exist
 */
router.post("/link", async (req: Request, res: Response) => {
  try {
    const { telegramId, username, firstName, lastName, referralCode } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: "telegramId is required" });
    }

    // Check if Telegram account already exists
    let telegramAccount = await db.query.telegramAccounts.findFirst({
      where: eq(telegramAccounts.telegramId, telegramId.toString())
    });

    if (telegramAccount) {
      // Existing user - get their balance
      const balance = await creditsService.getBalance(telegramAccount.userId);

      return res.json({
        userId: telegramAccount.userId,
        balance,
        displayName: `${telegramAccount.firstName || 'User'}`,
        isNewUser: false
      });
    }

    // New user - create full account
    const userId = `t${nanoid(8)}`; // Generate unique user ID (9 chars total - fits varchar(12))
    const userReferralCode = `T${nanoid(8)}`; // Generate referral code (9 chars total)

    // Start transaction
    await db.transaction(async (tx) => {
      // 1. Create user record
      await tx.insert(users).values({
        id: userId,
        firstName: firstName || 'Telegram',
        lastName: lastName || 'User',
        accountStatus: 'active',
        referralCode: userReferralCode,
        freeCreditsGranted: true, // Mark that we gave them the bonus
      });

      // 2. Create credits account with $1 starting bonus
      const [creditsAccount] = await tx.insert(creditsAccounts).values({
        userId,
        balance: STARTING_BONUS,
        autoTopUpEnabled: false,
      }).returning();

      // 3. Log the starting bonus transaction
      await tx.insert(creditTransactions).values({
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
      const keyPrefix = apiKeyValue.substring(0, 14); // cr_tg_xxxxxx

      const [apiKey] = await tx.insert(apiKeys).values({
        userId,
        keyValue: apiKeyValue,
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

      await tx.insert(telegramAccounts).values({
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
        await tx.insert(telegramReferrals).values({
          referrerUserId: referredByUserId,
          refereeUserId: userId,
          bonusAmount: 0, // Will be updated when referee makes first purchase
        });
      }
    });

    res.json({
      userId,
      balance: STARTING_BONUS,
      displayName: firstName || 'User',
      isNewUser: true,
      welcomeMessage: `Welcome! You've received $${STARTING_BONUS} in free credits to try our services. 🎉`
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
    const { telegramId, message } = req.body;

    if (!telegramId || !message) {
      return res.status(400).json({ error: "telegramId and message are required" });
    }

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

Current user balance: $${balance.toFixed(2)}

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

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        // Map function name to service ID and call our API
        const serviceId = functionName.replace("_", "-");
        
        try {
          // Call our own x402 service with user's API key
          const response = await fetch(`${process.env.REPL_HOME || 'http://localhost:5000'}/api/x402/${serviceId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': apiKey.keyValue
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
            content: `You are Coin Railz Copilot. Format service results clearly for the user. Current balance: $${balance.toFixed(2)}`
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

      return res.json({
        message: finalCompletion.choices[0].message.content,
        toolsUsed: toolCalls.map(tc => tc.function.name),
        creditsSpent: balance - newBalance,
        newBalance
      });
    }

    // No tools called - just return OpenAI's response
    res.json({
      message: responseMessage.content,
      toolsUsed: [],
      creditsSpent: 0,
      newBalance: balance
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
    const { telegramId } = req.query;

    if (!telegramId) {
      return res.status(400).json({ error: "telegramId is required" });
    }

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