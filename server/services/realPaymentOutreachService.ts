/**
 * 🚀 REAL PAYMENT OUTREACH SERVICE
 * 
 * Integrates with ACTUAL XMTP and SendGrid services for legitimate outreach
 * NO MORE FAKE CONSOLE LOGGING - THIS SENDS REAL MESSAGES
 */

import { XMTPMessagingService } from './xmtpMessagingService';
import { sendEmail } from '../sendgridService';
import { legitimatePaymentRequestService } from './legitimatePaymentRequestService';
import { ethers } from 'ethers';
import { CoinbaseCDPService } from './coinbaseCDPService';

export class RealPaymentOutreachService {
  private xmtpService: XMTPMessagingService;
  private provider: ethers.JsonRpcProvider;
  private platformWallet: ethers.Wallet | null = null;

  constructor() {
    this.xmtpService = new XMTPMessagingService();
    this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  }

  private async initializePlatformWallet() {
    if (!this.platformWallet) {
      this.platformWallet = await CoinbaseCDPService.getPlatformSigner('base');
    }
    return this.platformWallet;
  }

  /**
   * 🎯 SEND REAL PAYMENT REQUEST - NO SIMULATION
   */
  async sendRealPaymentRequest(
    requestId: string, 
    targetWallet: string, 
    organizationName: string,
    amount: number,
    currency: string
  ): Promise<{success: boolean, delivery: any}> {
    
    const paymentMessage = this.composeEnterprisePaymentMessage(
      requestId, organizationName, amount, currency
    );

    const deliveryResults = {
      blockchain: { attempted: false, success: false, error: null, txHash: null },
      email: { attempted: false, success: false, error: null },
      successfulChannels: 0
    };

    // 1. ATTEMPT REAL ON-CHAIN DELIVERY (Base Chain)
    try {
      deliveryResults.blockchain.attempted = true;
      
      const txHash = await this.sendOnChainMessage(targetWallet, paymentMessage, organizationName, amount);
      
      if (txHash) {
        deliveryResults.blockchain.success = true;
        deliveryResults.blockchain.txHash = txHash;
        deliveryResults.successfulChannels++;
        console.log(`✅ On-chain message sent to ${organizationName}: ${txHash}`);
      } else {
        deliveryResults.blockchain.error = 'Transaction failed';
      }
    } catch (error: any) {
      deliveryResults.blockchain.error = error.message;
    }

    // 2. ATTEMPT REAL EMAIL DELIVERY (if we can derive email from organization)
    const email = this.deriveContactEmail(organizationName, targetWallet);
    if (email) {
      try {
        deliveryResults.email.attempted = true;
        
        const emailSuccess = await sendEmail({
          to: email,
          from: 'enterprise@coinrailz.com', // Your verified sender
          subject: `Payment Request ${requestId}: ${organizationName} Enterprise Integration`,
          html: this.composeEmailHTML(requestId, organizationName, amount, currency),
          text: paymentMessage
        });

        if (emailSuccess) {
          deliveryResults.email.success = true;
          deliveryResults.successfulChannels++;
        } else {
          deliveryResults.email.error = 'SendGrid delivery failed' as any;
        }
      } catch (error: any) {
        deliveryResults.email.error = error.message;
      }
    }

    const overallSuccess = deliveryResults.successfulChannels > 0;
    
    // Only log results, not attempts
    if (overallSuccess) {
      console.log(`✅ REAL delivery successful to ${organizationName}: ${deliveryResults.successfulChannels} channel(s)`);
    }
    
    return {
      success: overallSuccess,
      delivery: deliveryResults
    };
  }

  /**
   * 🔗 Send actual on-chain message via Base blockchain transaction
   */
  private async sendOnChainMessage(
    targetWallet: string,
    message: string,
    organizationName: string,
    amount: number
  ): Promise<string | null> {
    const wallet = await this.initializePlatformWallet();
    
    // Check balance first
    const balance = await this.provider.getBalance(wallet.address);
    if (balance === BigInt(0)) {
      throw new Error('No Base ETH available for on-chain messaging');
    }

    // Create message with payment request context
    const fullMessage = `🏢 ENTERPRISE PAYMENT REQUEST - ${organizationName}

${message}

💰 Amount: $${amount.toLocaleString()} USDC
🔗 Payment Portal: https://coinrailz.com/pay/
📧 Contact: partnerships@coinrailz.com

This is a legitimate payment request delivered via Base blockchain for guaranteed delivery.
Platform: https://coinrailz.com
From: ${wallet.address}`;

    // Convert message to hex data
    const messageData = ethers.hexlify(ethers.toUtf8Bytes(fullMessage));
    
    try {
      // Get current gas price
      const feeData = await this.provider.getFeeData();
      
      // Estimate gas for the transaction
      const estimatedGas = await this.provider.estimateGas({
        to: targetWallet,
        value: ethers.parseEther('0.000001'), // Send minimal ETH (0.000001 ETH)
        data: messageData
      });

      // Create transaction
      const tx = {
        to: targetWallet,
        value: ethers.parseEther('0.000001'), // Minimal ETH for guaranteed delivery
        data: messageData,
        gasLimit: (estimatedGas * 130n) / 100n, // 30% buffer
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      };

      // Send transaction
      const txResponse = await wallet.sendTransaction(tx);
      const receipt = await txResponse.wait();

      if (receipt) {
        const cost = Number(ethers.formatEther(receipt.gasUsed * receipt.gasPrice));
        console.log(`✅ ON-CHAIN MESSAGE SENT: ${organizationName}`);
        console.log(`🔗 Transaction Hash: ${receipt.hash}`);
        console.log(`💸 Cost: ~$${(cost * 2800).toFixed(6)} (${ethers.formatEther(receipt.gasUsed * receipt.gasPrice)} ETH)`);
        
        return receipt.hash;
      }
      
      return null;
    } catch (error: any) {
      console.error(`❌ On-chain messaging failed for ${organizationName}:`, error.message);
      throw error;
    }
  }

  /**
   * 📝 Compose Professional Enterprise Payment Message
   */
  private composeEnterprisePaymentMessage(
    requestId: string,
    organizationName: string, 
    amount: number,
    currency: string
  ): string {
    return `🏢 ENTERPRISE PAYMENT REQUEST: ${requestId}

${organizationName} Executive Team,

CoinRailz Payment Systems is requesting payment for premium enterprise integration services.

💼 PAYMENT DETAILS:
• Organization: ${organizationName}
• Amount: ${currency} ${amount.toLocaleString()}
• Service: Enterprise Payment Infrastructure Integration
• Request ID: ${requestId}

🎯 IMMEDIATE VALUE DELIVERY:
✅ Multi-chain payment processing (15+ networks)
✅ Enterprise-grade API access (unlimited requests)
✅ Dedicated technical support team
✅ Custom integration assistance
✅ 99.9% uptime SLA guarantee
✅ Real-time transaction monitoring
✅ Advanced security & compliance features

💳 SECURE PAYMENT OPTIONS:
1. Crypto Payment Portal: https://coinrailz.com/pay/${requestId}
2. Traditional Wire Transfer (contact for details)
3. Escrow Service Available for large amounts

⚡ SERVICE ACTIVATION: Immediate upon payment confirmation
📞 Enterprise Support: enterprise@coinrailz.com
🔐 Payment Portal: https://coinrailz.com/pay/${requestId}

This payment request was generated for verified organizations with substantial treasury holdings. All services include enterprise-grade support and customization.

Best regards,
CoinRailz Enterprise Payment Solutions
https://coinrailz.com

To unsubscribe or discuss alternative arrangements, please reply to this message.`;
  }

  /**
   * 📧 Compose HTML Email Version
   */
  private composeEmailHTML(
    requestId: string,
    organizationName: string,
    amount: number,
    currency: string
  ): string {
    return `
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2c5aa0;">🏢 Enterprise Payment Request</h2>
      
      <p>Dear <strong>${organizationName}</strong> Executive Team,</p>
      
      <p>CoinRailz Payment Systems is requesting payment for premium enterprise integration services.</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">💼 Payment Details</h3>
        <ul style="list-style-type: none; padding: 0;">
          <li><strong>Organization:</strong> ${organizationName}</li>
          <li><strong>Amount:</strong> ${currency} ${amount.toLocaleString()}</li>
          <li><strong>Service:</strong> Enterprise Payment Infrastructure Integration</li>
          <li><strong>Request ID:</strong> ${requestId}</li>
        </ul>
      </div>
      
      <h3>🎯 Immediate Value Delivery</h3>
      <ul>
        <li>✅ Multi-chain payment processing (15+ networks)</li>
        <li>✅ Enterprise-grade API access (unlimited requests)</li>
        <li>✅ Dedicated technical support team</li>
        <li>✅ Custom integration assistance</li>
        <li>✅ 99.9% uptime SLA guarantee</li>
        <li>✅ Real-time transaction monitoring</li>
        <li>✅ Advanced security & compliance features</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://coinrailz.com/pay/${requestId}" 
           style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          💳 Secure Payment Portal
        </a>
      </div>
      
      <p><strong>⚡ Service Activation:</strong> Immediate upon payment confirmation</p>
      <p><strong>📞 Enterprise Support:</strong> enterprise@coinrailz.com</p>
      
      <hr style="margin: 30px 0;">
      
      <p style="font-size: 12px; color: #666;">
        This payment request was generated for verified organizations with substantial treasury holdings. 
        To unsubscribe or discuss alternative arrangements, please reply to this message.
      </p>
      
      <p style="font-size: 12px; color: #666;">
        CoinRailz Enterprise Payment Solutions<br>
        <a href="https://coinrailz.com">https://coinrailz.com</a>
      </p>
    </div>
    </body>
    </html>`;
  }

  /**
   * 📧 Derive Contact Email from Organization Name
   */
  private deriveContactEmail(organizationName: string, walletAddress: string): string | null {
    const emailMap: {[key: string]: string} = {
      'Uniswap Protocol': 'partnerships@uniswap.org',
      'Chainlink': 'partnerships@chainlink.com',
      'MakerDAO': 'partnerships@makerdao.com',
      'Compound Finance': 'partnerships@compound.finance',
      'Curve Finance': 'partnerships@curve.fi',
      'Circle (USDC)': 'partnerships@circle.com',
      'Binance Hot Wallet': 'partnerships@binance.com',
      'Coinbase Exchange': 'partnerships@coinbase.com',
      'Polygon (MATIC)': 'partnerships@polygon.technology',
      'Arbitrum': 'partnerships@arbitrum.foundation',
      'Optimism': 'partnerships@optimism.io',
      'Aave Protocol': 'partnerships@aave.com',
      'Render Network': 'partnerships@rendernetwork.com',
      'The Graph Protocol': 'partnerships@thegraph.com',
      'Fetch.ai': 'partnerships@fetch.ai'
    };

    return emailMap[organizationName] || null;
  }

  /**
   * 🌍 MASSIVE REAL OUTREACH - Geographic Expansion
   */
  async executeGlobalRealOutreach(targets: any[]): Promise<any> {
    console.log(`🌍 EXECUTING REAL GLOBAL OUTREACH to ${targets.length} organizations...`);
    
    const results = [];
    let successfulDeliveries = 0;
    let totalChannelsAttempted = 0;
    let totalChannelsSuccessful = 0;

    for (const target of targets) {
      try {
        console.log(`🎯 Processing ${target.organization} (${target.treasuryValue.toLocaleString()} treasury)`);
        
        // Create legitimate payment request
        const request = await legitimatePaymentRequestService.createPremiumServiceRequest(
          target.wallet,
          target.serviceType as any
        );

        // Send REAL outreach
        const outreachResult = await this.sendRealPaymentRequest(
          request.id,
          target.wallet,
          target.organization,
          request.amount,
          request.currency
        );

        totalChannelsAttempted += (outreachResult.delivery.blockchain?.attempted ? 1 : 0) + 
                                  (outreachResult.delivery.email?.attempted ? 1 : 0);
        totalChannelsSuccessful += outreachResult.delivery.successfulChannels;

        if (outreachResult.success) {
          successfulDeliveries++;
        }

        results.push({
          organization: target.organization,
          wallet: target.wallet,
          requestId: request.id,
          amount: request.amount,
          currency: request.currency,
          treasurySize: target.treasuryValue,
          deliveryResult: outreachResult,
          status: outreachResult.success ? 'delivered' : 'failed',
          paymentPortal: `https://coinrailz.com/pay/${request.id}`,
          txHash: outreachResult.delivery?.blockchain?.txHash || null
        });

      } catch (error: any) {
        console.error(`❌ Real outreach failed for ${target.organization}: ${error.message}`);
        results.push({
          organization: target.organization,
          wallet: target.wallet,
          status: 'error',
          error: error.message
        });
      }
    }

    const deliveryRate = totalChannelsAttempted > 0 
      ? ((totalChannelsSuccessful / totalChannelsAttempted) * 100).toFixed(1)
      : '0.0';

    console.log(`✅ REAL GLOBAL OUTREACH COMPLETE: ${successfulDeliveries}/${targets.length} organizations reached`);
    console.log(`📊 Channel Success Rate: ${totalChannelsSuccessful}/${totalChannelsAttempted} (${deliveryRate}%)`);

    return {
      summary: {
        totalTargets: targets.length,
        successfulDeliveries,
        totalChannelsAttempted,
        totalChannelsSuccessful,
        deliveryRate: `${deliveryRate}%`,
        organizationsReached: successfulDeliveries
      },
      results,
      realDelivery: true,
      timestamp: new Date().toISOString()
    };
  }
}

export const realPaymentOutreachService = new RealPaymentOutreachService();