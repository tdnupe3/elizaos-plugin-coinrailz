import TelegramBot from 'node-telegram-bot-api';

export class TelegramOutreachService {
  private bot: TelegramBot | null = null;
  private outreachQueue: OutreachMessage[] = [];
  private isRunning = false;
  private processedGroups = new Set<string>();

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.bot = new TelegramBot(token, { polling: false });
      console.log('✅ Telegram Outreach Service initialized');
    } else {
      console.log('⚠️ TELEGRAM_BOT_TOKEN not found - outreach disabled');
    }
  }

  /**
   * 🚀 PROMOTE @FeedAlphaBot to crypto groups (FREE)
   */
  async addTargetGroup(chatId: string, groupName?: string): Promise<void> {
    if (!this.bot) {
      console.log('❌ Telegram bot not initialized');
      return;
    }

    // Add to outreach queue with @FeedAlphaBot promotion
    const message: OutreachMessage = {
      chatId,
      groupName: groupName || chatId,
      message: this.getFeedAlphaBotPromoMessage(),
      scheduled: new Date(),
      attempts: 0,
      status: 'pending'
    };

    this.outreachQueue.push(message);
    console.log(`📥 Added ${groupName || chatId} to @FeedAlphaBot outreach queue`);
  }

  /**
   * 💰 START AUTOMATIC PROMOTION (FREE OPERATION)
   */
  async startOutreachCampaign(): Promise<void> {
    if (!this.bot || this.isRunning) {
      console.log('⚠️ Outreach already running or bot not available');
      return;
    }

    this.isRunning = true;
    console.log('🚀 STARTING @FeedAlphaBot promotion campaign...');

    while (this.outreachQueue.length > 0 && this.isRunning) {
      const message = this.outreachQueue.shift()!;
      
      try {
        // Send @FeedAlphaBot promotion
        await this.bot.sendMessage(message.chatId, message.message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        });

        console.log(`✅ Promoted @FeedAlphaBot to ${message.groupName}`);
        message.status = 'sent';
        this.processedGroups.add(message.chatId);

        // Wait 60 seconds between messages (anti-spam protection)
        await this.sleep(60000);

      } catch (error: any) {
        console.log(`❌ Failed to promote @FeedAlphaBot to ${message.groupName}: ${error.message}`);
        message.status = 'failed';
        message.attempts++;

        // Retry up to 3 times with longer delay
        if (message.attempts < 3) {
          message.scheduled = new Date(Date.now() + 300000); // Retry in 5 minutes
          this.outreachQueue.push(message);
        }
      }
    }

    this.isRunning = false;
    console.log('✅ @FeedAlphaBot outreach campaign completed');
  }

  /**
   * 📱 GET FEEDALPHABOT PROMOTION MESSAGE
   */
  private getFeedAlphaBotPromoMessage(): string {
    const messages = [
      `🤖 **NEW: Advanced Solana Trading Bot**

@FeedAlphaBot - Copy elite HFT wallets automatically!

🚀 **Features:**
• Real-time copy trading from top performers
• 1.5% fees vs 1%+ on BullX/Trojan  
• Advanced PumpFun integration
• Professional portfolio analytics
• 4-tier subscription system

💰 **Lower fees, better features than competitors!**

Try it now: https://t.me/FeedAlphaBot`,

      `📈 **Solana Trading Bot Launch**

Tired of BullX fees? Try @FeedAlphaBot!

✅ Copy trading from elite wallets
✅ Real-time PumpFun alerts  
✅ 1.5% fees (vs 1%+ competitors)
✅ Advanced portfolio tracking

🏆 **Better than BullX • Lower fees • More features**

Start trading: https://t.me/FeedAlphaBot`,

      `🚀 **@FeedAlphaBot - Advanced Solana Trading**

The only bot with:
• Elite HFT wallet copying
• Real-time market alerts
• Professional analytics
• Lower fees than BullX

💎 **Join the future of Solana trading**

Bot: https://t.me/FeedAlphaBot`
    ];

    // Rotate between different messages
    const messageIndex = this.processedGroups.size % messages.length;
    return messages[messageIndex];
  }

  /**
   * 📊 GET CAMPAIGN STATS
   */
  getCampaignStats(): OutreachStats {
    return {
      totalGroups: this.processedGroups.size,
      queuedMessages: this.outreachQueue.length,
      isRunning: this.isRunning,
      lastUpdate: new Date()
    };
  }

  /**
   * ⏸️ STOP CAMPAIGN
   */
  stopCampaign(): void {
    this.isRunning = false;
    console.log('⏸️ @FeedAlphaBot outreach campaign stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface OutreachMessage {
  chatId: string;
  groupName: string;
  message: string;
  scheduled: Date;
  attempts: number;
  status: 'pending' | 'sent' | 'failed';
}

interface OutreachStats {
  totalGroups: number;
  queuedMessages: number;
  isRunning: boolean;
  lastUpdate: Date;
}

// Export singleton instance
export const telegramOutreachService = new TelegramOutreachService();