/**
 * TelegramTradingService — webhook-mode trading command handler
 *
 * DESIGN: No polling, no constructor side-effects. Instantiated once in the
 * webhook router and called with each incoming Telegram update object.
 *
 * PAPER TRADING MODE: executeTrade() returns clearly-labeled paper results
 * until real Jupiter/PumpPortal execution is wired in.
 *
 * Security: Solana private keys encrypted at rest with AES-256-GCM.
 * Session state cached in-memory; DB is source of truth (rehydrated on every command).
 */
import TelegramBot from 'node-telegram-bot-api';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { db } from '../db';
import { telegramUsers, userWallets } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { encryptPrivateKey, decryptPrivateKey, isEncrypted } from './walletEncryption';
import { pumpfunCopyTradingService } from './pumpfunCopyTradingService';

// ─── Configuration ───────────────────────────────────────────────────────────

const PAPER_TRADING_MODE = true; // Switch to false when Jupiter integration is live
const PLATFORM_FEE_RATE = 0.015; // 1.5% per trade — canonical value

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SOLANA_RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

if (!HELIUS_API_KEY) {
  console.warn('⚠️ HELIUS_API_KEY not set — using public Solana RPC (rate-limited)');
}

const SUBSCRIPTION_TIERS = {
  free:    { price: 0,   tradingLimitSOL: 0.1,   copyTrading: false, label: 'FREE' },
  basic:   { price: 10,  tradingLimitSOL: 1.0,   copyTrading: false, label: 'BASIC $10/mo' },
  pro:     { price: 50,  tradingLimitSOL: 10.0,  copyTrading: true,  label: 'PRO $50/mo' },
  premium: { price: 100, tradingLimitSOL: 100.0, copyTrading: true,  label: 'PREMIUM $100/mo' },
} as const;

type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

const TOKEN_MINTS: Record<string, string> = {
  SOL:  'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP:  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  WEN:  'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserSession {
  chatId: number;
  username?: string;
  subscriptionTier: SubscriptionTier;
  copyTradingEnabled: boolean;
  tradingBalance: number;
  totalPnL: number;
  lastActive: Date;
  wallet?: string; // public key only — private key always fetched from DB
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class TelegramTradingService {
  private bot: TelegramBot;
  private connection: Connection;
  private sessions = new Map<number, UserSession>();

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    console.log(`🤖 TelegramTradingService ready (RPC: ${HELIUS_API_KEY ? 'Helius' : 'public'}, mode: ${PAPER_TRADING_MODE ? 'PAPER TRADING' : 'LIVE'})`);
  }

  // ─── Public entry point ─────────────────────────────────────────────────

  /**
   * Called from webhook handler for every incoming update that contains a
   * trading-specific command. Returns true if it handled the command.
   */
  async handleCommand(chatId: number, text: string, from: any): Promise<boolean> {
    const t = text.trim();

    if (t.startsWith('/wallet')) {
      await this.cmdWallet(chatId, from);
      return true;
    }
    const buyMatch = t.match(/^\/buy\s+(\S+)\s+(\d+\.?\d*)/i);
    if (buyMatch) {
      await this.cmdBuy(chatId, buyMatch[1], parseFloat(buyMatch[2]));
      return true;
    }
    const sellMatch = t.match(/^\/sell\s+(\S+)\s+(\d+\.?\d*)/i);
    if (sellMatch) {
      await this.cmdSell(chatId, sellMatch[1], parseFloat(sellMatch[2]));
      return true;
    }
    if (t.startsWith('/copy')) {
      await this.cmdCopy(chatId);
      return true;
    }
    if (t.startsWith('/upgrade')) {
      await this.cmdUpgrade(chatId);
      return true;
    }
    if (t.startsWith('/tradehelp')) {
      await this.cmdTradeHelp(chatId);
      return true;
    }

    return false;
  }

  /**
   * Handle callback queries from trading inline keyboards.
   * Returns true if handled.
   */
  async handleCallback(chatId: number, data: string, callbackQueryId: string, from: any): Promise<boolean> {
    const tradingCallbacks = [
      'enable_copy_trading', 'disable_copy_trading',
      'upgrade_basic', 'upgrade_pro', 'upgrade_premium',
      'top_traders', 'deposit_sol', 'copy_trading', 'upgrade_menu',
    ];

    if (!tradingCallbacks.some(cb => data === cb || data.startsWith('upgrade_'))) {
      return false;
    }

    await this.bot.answerCallbackQuery(callbackQueryId);

    switch (data) {
      case 'enable_copy_trading':
        await this.enableCopyTrading(chatId);
        break;
      case 'disable_copy_trading':
        await this.disableCopyTrading(chatId);
        break;
      case 'upgrade_basic':
        await this.processUpgrade(chatId, 'basic');
        break;
      case 'upgrade_pro':
        await this.processUpgrade(chatId, 'pro');
        break;
      case 'upgrade_premium':
        await this.processUpgrade(chatId, 'premium');
        break;
      case 'top_traders':
        await this.showTopTraders(chatId);
        break;
      case 'copy_trading':
        await this.cmdCopy(chatId);
        break;
      case 'upgrade_menu':
        await this.cmdUpgrade(chatId);
        break;
      case 'deposit_sol':
        await this.cmdWallet(chatId, { id: chatId });
        break;
      default:
        return false;
    }

    return true;
  }

  // ─── Commands ────────────────────────────────────────────────────────────

  private async cmdWallet(chatId: number, from: any): Promise<void> {
    try {
      const session = await this.getOrCreateSession(chatId, from?.username);
      let walletAddress = session.wallet;

      if (!walletAddress) {
        // Generate new keypair, encrypt private key
        const keypair = Keypair.generate();
        walletAddress = keypair.publicKey.toString();
        const encryptedKey = encryptPrivateKey(bs58.encode(keypair.secretKey));

        await db.insert(userWallets).values({
          telegramUserId: chatId.toString(),
          address: walletAddress,
          privateKey: encryptedKey,
          chain: 'solana',
          isActive: true,
        });

        session.wallet = walletAddress;
        this.sessions.set(chatId, session);
      }

      const balanceLamports = await this.connection.getBalance(new PublicKey(walletAddress)).catch(() => 0);
      const balanceSOL = (balanceLamports / 1e9).toFixed(4);
      const tier = SUBSCRIPTION_TIERS[session.subscriptionTier];

      await this.bot.sendMessage(chatId,
        `💼 *Your Solana Wallet*\n\n` +
        `Address: \`${walletAddress}\`\n` +
        `Balance: *${balanceSOL} SOL*\n` +
        `Plan: *${tier.label}*\n` +
        `Trade limit: *${tier.tradingLimitSOL} SOL per trade*\n\n` +
        `Deposit SOL to start trading.\n` +
        (PAPER_TRADING_MODE ? `\n⚠️ *Paper trading mode* — trades are simulated for demo purposes.` : ''),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📈 Buy Tokens', callback_data: 'deposit_sol' },
              { text: '⬆️ Upgrade Plan', callback_data: 'upgrade_menu' },
            ]]
          }
        }
      );
    } catch (err) {
      console.error('cmdWallet error:', err);
      await this.bot.sendMessage(chatId, '❌ Error accessing wallet. Please try again.');
    }
  }

  private async cmdBuy(chatId: number, tokenSymbol: string, amountSOL: number): Promise<void> {
    try {
      const session = await this.getOrCreateSession(chatId);
      const tier = SUBSCRIPTION_TIERS[session.subscriptionTier];

      if (!session.wallet) {
        await this.bot.sendMessage(chatId, '👉 Set up your wallet first with /wallet');
        return;
      }
      if (amountSOL > tier.tradingLimitSOL) {
        await this.bot.sendMessage(chatId,
          `❌ Your *${tier.label}* plan limits trades to *${tier.tradingLimitSOL} SOL*.\n` +
          `You tried to trade ${amountSOL} SOL.\n\n/upgrade to increase your limit.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const tokenMint = TOKEN_MINTS[tokenSymbol.toUpperCase()];
      if (!tokenMint) {
        await this.bot.sendMessage(chatId,
          `❌ Token *${tokenSymbol}* not found.\n\nSupported: SOL, BONK, JUP, WEN, USDC, USDT`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await this.bot.sendMessage(chatId, `🔄 Placing buy order: ${amountSOL} SOL → ${tokenSymbol.toUpperCase()}...`);
      const result = await this.executeTrade('buy', tokenMint, amountSOL, chatId);

      if (result.success) {
        const fee = (amountSOL * PLATFORM_FEE_RATE).toFixed(4);
        await this.bot.sendMessage(chatId,
          `✅ *Buy Order ${PAPER_TRADING_MODE ? '(PAPER) ' : ''}Executed!*\n\n` +
          `Token: *${tokenSymbol.toUpperCase()}*\n` +
          `Amount: *${amountSOL} SOL*\n` +
          `Platform fee: *${fee} SOL (1.5%)*\n` +
          `Slippage: ${result.slippage?.toFixed(2)}%\n` +
          `Tx: \`${result.txHash}\`\n\n` +
          (PAPER_TRADING_MODE ? `_⚠️ This is a paper trade — no real funds moved._` : 'Happy trading! 🚀'),
          { parse_mode: 'Markdown' }
        );
      } else {
        await this.bot.sendMessage(chatId, `❌ Buy failed: ${result.error}`);
      }
    } catch (err) {
      console.error('cmdBuy error:', err);
      await this.bot.sendMessage(chatId, '❌ Error executing buy. Please try again.');
    }
  }

  private async cmdSell(chatId: number, tokenSymbol: string, amountSOL: number): Promise<void> {
    try {
      const session = await this.getOrCreateSession(chatId);

      if (!session.wallet) {
        await this.bot.sendMessage(chatId, '👉 Set up your wallet first with /wallet');
        return;
      }

      const tokenMint = TOKEN_MINTS[tokenSymbol.toUpperCase()];
      if (!tokenMint) {
        await this.bot.sendMessage(chatId,
          `❌ Token *${tokenSymbol}* not found.\n\nSupported: SOL, BONK, JUP, WEN, USDC, USDT`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await this.bot.sendMessage(chatId, `🔄 Placing sell order: ${tokenSymbol.toUpperCase()} → ${amountSOL} SOL...`);
      const result = await this.executeTrade('sell', tokenMint, amountSOL, chatId);

      if (result.success) {
        const fee = (amountSOL * PLATFORM_FEE_RATE).toFixed(4);
        await this.bot.sendMessage(chatId,
          `✅ *Sell Order ${PAPER_TRADING_MODE ? '(PAPER) ' : ''}Executed!*\n\n` +
          `Token: *${tokenSymbol.toUpperCase()}*\n` +
          `Amount: *${amountSOL} SOL*\n` +
          `Platform fee: *${fee} SOL (1.5%)*\n` +
          `Slippage: ${result.slippage?.toFixed(2)}%\n` +
          `Tx: \`${result.txHash}\`\n\n` +
          (PAPER_TRADING_MODE ? `_⚠️ This is a paper trade — no real funds moved._` : 'Profits secured! 💰'),
          { parse_mode: 'Markdown' }
        );
      } else {
        await this.bot.sendMessage(chatId, `❌ Sell failed: ${result.error}`);
      }
    } catch (err) {
      console.error('cmdSell error:', err);
      await this.bot.sendMessage(chatId, '❌ Error executing sell. Please try again.');
    }
  }

  private async cmdCopy(chatId: number): Promise<void> {
    try {
      const session = await this.getOrCreateSession(chatId);
      const tier = SUBSCRIPTION_TIERS[session.subscriptionTier];

      if (!tier.copyTrading) {
        await this.bot.sendMessage(chatId,
          `🚨 *Copy Trading requires Pro or Premium.*\n\n` +
          `Your plan: *${tier.label}*\n\n` +
          `Upgrade to Pro ($50/mo) to automatically copy trades from top-performing wallets.`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[
              { text: '⬆️ Upgrade to Pro', callback_data: 'upgrade_pro' }
            ]]}
          }
        );
        return;
      }

      let topWallets: any[] = [];
      try {
        const dash = await pumpfunCopyTradingService.getDashboardData();
        topWallets = dash.topWallets?.slice(0, 5) || [];
      } catch { /* service may be dormant */ }

      let msg = `🤖 *Copy Trading*\n\nStatus: ${session.copyTradingEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n`;
      if (topWallets.length > 0) {
        msg += `*Top Wallets:*\n`;
        topWallets.forEach((w: any, i: number) => {
          msg += `${i + 1}. \`${w.address?.slice(0, 8)}...\` Win: ${w.winRate?.toFixed(1)}% P&L: ${w.totalPnL?.toFixed(2)} SOL\n`;
        });
      }

      await this.bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: session.copyTradingEnabled ? '⏸️ Disable' : '▶️ Enable', callback_data: session.copyTradingEnabled ? 'disable_copy_trading' : 'enable_copy_trading' }
        ]]}
      });
    } catch (err) {
      console.error('cmdCopy error:', err);
      await this.bot.sendMessage(chatId, '❌ Error loading copy trading.');
    }
  }

  private async cmdUpgrade(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId,
      `⬆️ *Upgrade Your Plan*\n\n` +
      `💎 *FREE* — $0/mo · 0.1 SOL limit · Basic trading\n` +
      `🥉 *BASIC* — $10/mo · 1 SOL limit · Portfolio tracking\n` +
      `🥈 *PRO* — $50/mo · 10 SOL limit · Copy trading + Whale alerts\n` +
      `🥇 *PREMIUM* — $100/mo · 100 SOL limit · All features + API\n\n` +
      `Payment via Stripe secure checkout:`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: '🥉 Basic $10/mo', callback_data: 'upgrade_basic' }, { text: '🥈 Pro $50/mo', callback_data: 'upgrade_pro' }],
          [{ text: '🥇 Premium $100/mo', callback_data: 'upgrade_premium' }]
        ]}
      }
    );
  }

  private async cmdTradeHelp(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId,
      `📚 *Trading Commands*\n\n` +
      `/wallet — View your Solana wallet & balance\n` +
      `/buy TOKEN AMOUNT — Buy tokens (e.g. /buy BONK 0.5)\n` +
      `/sell TOKEN AMOUNT — Sell tokens (e.g. /sell JUP 0.2)\n` +
      `/copy — Enable/disable copy trading (Pro+)\n` +
      `/upgrade — Upgrade subscription tier\n\n` +
      `Supported tokens: SOL, BONK, JUP, WEN, USDC, USDT\n` +
      (PAPER_TRADING_MODE ? `\n⚠️ *Paper trading mode active.* Trades are simulated — no real SOL is spent.` : ''),
      { parse_mode: 'Markdown' }
    );
  }

  // ─── Callbacks ───────────────────────────────────────────────────────────

  private async enableCopyTrading(chatId: number): Promise<void> {
    const session = await this.getOrCreateSession(chatId);
    session.copyTradingEnabled = true;
    this.sessions.set(chatId, session);
    await db.update(telegramUsers)
      .set({ copyTradingEnabled: true })
      .where(eq(telegramUsers.chatId, chatId.toString()))
      .catch(() => {});
    await this.bot.sendMessage(chatId, '✅ Copy trading enabled! You will now mirror top wallet trades (paper mode).');
  }

  private async disableCopyTrading(chatId: number): Promise<void> {
    const session = await this.getOrCreateSession(chatId);
    session.copyTradingEnabled = false;
    this.sessions.set(chatId, session);
    await db.update(telegramUsers)
      .set({ copyTradingEnabled: false })
      .where(eq(telegramUsers.chatId, chatId.toString()))
      .catch(() => {});
    await this.bot.sendMessage(chatId, '⏸️ Copy trading disabled.');
  }

  private async processUpgrade(chatId: number, tier: 'basic' | 'pro' | 'premium'): Promise<void> {
    const plan = SUBSCRIPTION_TIERS[tier];
    const priceId = {
      basic: process.env.STRIPE_BASIC_PRICE_ID,
      pro: process.env.STRIPE_PRO_PRICE_ID,
      premium: process.env.STRIPE_PREMIUM_PRICE_ID,
    }[tier];

    const checkoutUrl = `https://coinrailz.com/subscribe?plan=${tier}&source=telegram&chat=${chatId}`;

    await this.bot.sendMessage(chatId,
      `💳 *Upgrade to ${plan.label}*\n\n` +
      `Price: $${plan.price}/month\n` +
      `Trade limit: ${plan.tradingLimitSOL} SOL per trade\n` +
      `Copy trading: ${plan.copyTrading ? '✅' : '❌'}\n\n` +
      `Complete payment here:\n${checkoutUrl}`,
      { parse_mode: 'Markdown' }
    );
  }

  private async showTopTraders(chatId: number): Promise<void> {
    try {
      const dash = await pumpfunCopyTradingService.getDashboardData();
      const wallets = dash.topWallets?.slice(0, 10) || [];
      let msg = `🏆 *Top Performing Traders*\n\n`;
      wallets.forEach((w: any, i: number) => {
        const emoji = i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`;
        msg += `${emoji} \`${w.address?.slice(0,8)}...${w.address?.slice(-4)}\`\n`;
        msg += `   Win: ${w.winRate?.toFixed(1)}% | P&L: ${w.totalPnL?.toFixed(2)} SOL\n\n`;
      });
      await this.bot.sendMessage(chatId, msg || 'No trader data available.', { parse_mode: 'Markdown' });
    } catch {
      await this.bot.sendMessage(chatId, '❌ Error loading top traders.');
    }
  }

  // ─── Session management ──────────────────────────────────────────────────

  private async getOrCreateSession(chatId: number, username?: string): Promise<UserSession> {
    if (this.sessions.has(chatId)) return this.sessions.get(chatId)!;

    // Rehydrate from DB
    const rows = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId.toString()));
    let session: UserSession;

    if (rows.length > 0) {
      const u = rows[0];
      // Lazy-encrypt plaintext private keys during rehydration
      const walletRows = await db.select().from(userWallets)
        .where(eq(userWallets.telegramUserId, chatId.toString()));
      let walletAddress: string | undefined;
      if (walletRows.length > 0) {
        const w = walletRows[0];
        walletAddress = w.address;
        if (!isEncrypted(w.privateKey)) {
          const encrypted = encryptPrivateKey(w.privateKey);
          await db.update(userWallets).set({ privateKey: encrypted })
            .where(eq(userWallets.telegramUserId, chatId.toString())).catch(() => {});
          console.log(`🔐 Lazy-encrypted plaintext key for user ${chatId}`);
        }
      }

      session = {
        chatId,
        username: u.username || undefined,
        subscriptionTier: (u.subscriptionTier as SubscriptionTier) || 'free',
        copyTradingEnabled: u.copyTradingEnabled || false,
        tradingBalance: parseFloat(u.tradingBalance || '0'),
        totalPnL: parseFloat(u.totalPnL || '0'),
        lastActive: new Date(),
        wallet: walletAddress,
      };
    } else {
      // New user — create DB record
      await db.insert(telegramUsers).values({
        chatId: chatId.toString(),
        username: username || null,
        subscriptionTier: 'free',
        copyTradingEnabled: false,
        tradingBalance: '0',
        totalPnL: '0',
        isActive: true,
      }).catch(() => {}); // ignore duplicate

      session = {
        chatId,
        username,
        subscriptionTier: 'free',
        copyTradingEnabled: false,
        tradingBalance: 0,
        totalPnL: 0,
        lastActive: new Date(),
      };
    }

    this.sessions.set(chatId, session);
    return session;
  }

  // ─── Trade execution ─────────────────────────────────────────────────────

  private async executeTrade(
    action: 'buy' | 'sell',
    tokenMint: string,
    amountSOL: number,
    chatId: number,
  ): Promise<{ success: boolean; txHash?: string; slippage?: number; error?: string }> {
    if (PAPER_TRADING_MODE) {
      await new Promise(r => setTimeout(r, 1200)); // simulate latency
      const mockTx = `PAPER_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(`📄 PAPER TRADE: ${action} ${amountSOL} SOL | chatId=${chatId} | fee=${(amountSOL * PLATFORM_FEE_RATE).toFixed(4)} SOL`);
      return { success: true, txHash: mockTx, slippage: Math.random() * 1.5 };
    }

    // TODO: Replace with real Jupiter/PumpPortal execution
    return { success: false, error: 'Live trading not yet enabled. Use /upgrade or contact support.' };
  }
}

// Singleton — created once with the shared bot instance from the webhook router
let _instance: TelegramTradingService | null = null;
export function getTradingService(bot: TelegramBot): TelegramTradingService {
  if (!_instance) _instance = new TelegramTradingService(bot);
  return _instance;
}
