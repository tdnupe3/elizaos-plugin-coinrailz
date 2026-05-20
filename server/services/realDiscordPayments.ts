import type Stripe from 'stripe';
import { stripe as stripeClient } from './stripeClient';
import axios from 'axios';

export class RealDiscordPayments {
  private stripe: Stripe;
  private discordToken: string;

  constructor() {
    this.stripe = stripeClient;
    this.discordToken = process.env.DISCORD_BOT_TOKEN!;
  }

  // Create real Discord payment via DM
  public async createDiscordPayment(userId: string, serviceType: string, amount: number): Promise<{
    paymentLink: string;
    embedSent: boolean;
  }> {
    console.log(`💰 Creating REAL Discord payment for user ${userId}`);

    // Create Stripe payment link
    const paymentLink = await this.stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `CoinRailz ${serviceType}`,
              description: `AI Agent ${serviceType} - purchased via Discord`,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        discord_user_id: userId,
        service_type: serviceType,
        source: 'discord_bot'
      }
    });

    // Create Discord embed
    const embed = {
      title: "💰 REAL PAYMENT LINK CREATED",
      color: 0x00ff00,
      fields: [
        {
          name: "Service",
          value: serviceType,
          inline: true
        },
        {
          name: "Amount", 
          value: `$${amount}`,
          inline: true
        },
        {
          name: "Payment Link",
          value: `[Click here to pay](${paymentLink.url})`,
          inline: false
        }
      ],
      footer: {
        text: "✅ Accepts all major cards • ✅ Instant activation • ✅ Secure Stripe processing"
      }
    };

    try {
      // Send DM to user
      const dmChannel = await axios.post('https://discord.com/api/v10/users/@me/channels', {
        recipient_id: userId
      }, {
        headers: {
          'Authorization': `Bot ${this.discordToken}`,
          'Content-Type': 'application/json'
        }
      });

      await axios.post(`https://discord.com/api/v10/channels/${dmChannel.data.id}/messages`, {
        embeds: [embed]
      }, {
        headers: {
          'Authorization': `Bot ${this.discordToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Payment embed sent to Discord user ${userId}`);
      return { paymentLink: paymentLink.url, embedSent: true };

    } catch (error) {
      console.log(`❌ Failed to send Discord DM: ${error}`);
      return { paymentLink: paymentLink.url, embedSent: false };
    }
  }

  // Create fundraising competition entry payment
  public async createCompetitionEntry(userId: string, guildId: string): Promise<{
    paymentLink: string;
    competitionId: string;
  }> {
    console.log(`🏆 Creating competition entry for Discord user ${userId}`);

    const entryFee = 49; // $49 competition entry
    
    const paymentLink = await this.stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'CoinRailz Fundraising Competition Entry',
              description: '90-day competition • $50K first prize • 15% commission',
            },
            unit_amount: entryFee * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        discord_user_id: userId,
        discord_guild_id: guildId,
        competition_entry: 'true',
        source: 'discord_competition'
      }
    });

    const competitionId = `COMP_${Date.now()}_${userId}`;

    // Send competition entry embed
    const embed = {
      title: "🏆 FUNDRAISING COMPETITION ENTRY",
      color: 0xffd700,
      description: "Join the 90-day fundraising competition!",
      fields: [
        {
          name: "🥇 First Prize",
          value: "$50,000 USDC",
          inline: true
        },
        {
          name: "💰 Commission Rate", 
          value: "15% on all funds raised",
          inline: true
        },
        {
          name: "⏰ Duration",
          value: "90 days",
          inline: true
        },
        {
          name: "💳 Entry Fee",
          value: `$${entryFee}`,
          inline: true
        },
        {
          name: "🎯 Recognition",
          value: "\"Best AI Agent 2025\" award",
          inline: true
        },
        {
          name: "🔗 Payment",
          value: `[Enter Competition](${paymentLink.url})`,
          inline: false
        }
      ],
      footer: {
        text: "Competition ID: " + competitionId
      }
    };

    try {
      const dmChannel = await axios.post('https://discord.com/api/v10/users/@me/channels', {
        recipient_id: userId
      }, {
        headers: {
          'Authorization': `Bot ${this.discordToken}`,
          'Content-Type': 'application/json'
        }
      });

      await axios.post(`https://discord.com/api/v10/channels/${dmChannel.data.id}/messages`, {
        embeds: [embed]
      }, {
        headers: {
          'Authorization': `Bot ${this.discordToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Competition entry sent to Discord user ${userId}`);

    } catch (error) {
      console.log(`❌ Failed to send competition entry: ${error}`);
    }

    return {
      paymentLink: paymentLink.url,
      competitionId: competitionId
    };
  }

  // Process crypto payments (USDC, XRP, ETH, BTC)
  public async createCryptoPaymentOptions(userId: string, serviceType: string, amount: number): Promise<void> {
    const embed = {
      title: "💎 CRYPTO PAYMENT OPTIONS",
      color: 0x9932cc,
      description: `Payment for: ${serviceType} ($${amount})`,
      fields: [
        {
          name: "💰 USDC (Recommended)",
          value: "Send USDC to Circle wallet\nChains: Ethereum, Polygon, Base, Arbitrum",
          inline: false
        },
        {
          name: "🚀 XRP (Fastest)",
          value: `Send ≈${(amount * 2).toFixed(0)} XRP\n3-5 second settlement`,
          inline: false
        },
        {
          name: "⚡ ETH (Popular)",
          value: `Send ≈${(amount * 0.0003).toFixed(4)} ETH\nEthereum mainnet`,
          inline: false
        },
        {
          name: "₿ BTC (Classic)",
          value: `Send ≈${(amount * 0.000015).toFixed(6)} BTC\nBitcoin network`,
          inline: false
        }
      ],
      footer: {
        text: "Reply with your preferred crypto to get wallet address"
      }
    };

    try {
      const dmChannel = await axios.post('https://discord.com/api/v10/users/@me/channels', {
        recipient_id: userId
      }, {
        headers: {
          'Authorization': `Bot ${this.discordToken}`,
          'Content-Type': 'application/json'
        }
      });

      await axios.post(`https://discord.com/api/v10/channels/${dmChannel.data.id}/messages`, {
        embeds: [embed]
      }, {
        headers: {
          'Authorization': `Bot ${this.discordToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Crypto payment options sent to Discord user ${userId}`);

    } catch (error) {
      console.log(`❌ Failed to send crypto options: ${error}`);
    }
  }
}

export default RealDiscordPayments;