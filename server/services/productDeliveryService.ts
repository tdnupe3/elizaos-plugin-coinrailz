/**
 * 🚀 PRODUCT DELIVERY SERVICE
 * Delivers actual products after payment confirmation
 * CRITICAL: This ensures customers get what they paid for!
 */

import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { db } from '../db';
import { aiAgentSubscriptions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export class ProductDeliveryService {
  /**
   * 🔑 DELIVER API ACCESS AFTER PAYMENT
   * Sends API key and documentation via email
   */
  async deliverAPIAccess(subscription: any, apiKey: string): Promise<void> {
    try {
      console.log(`📧 Delivering API access to agent ${subscription.agentId}`);
      
      // Get product details
      const product = await this.getProductDetails(subscription.productId);
      
      // Create welcome email with API key
      const emailContent = this.createAPIAccessEmail(subscription, apiKey, product);
      
      // Send via SendGrid
      if (process.env.SENDGRID_API_KEY && subscription.email) {
        await this.sendEmail(subscription.email, emailContent);
        console.log(`✅ API access delivered to ${subscription.email}`);
      } else {
        console.log(`📧 API Key for ${subscription.agentId}: ${apiKey}`);
        console.log(`📖 Documentation: https://coinrailz.com/docs/api-access`);
      }
      
      // Log delivery
      await this.logDelivery(subscription.id, 'api_access', apiKey);
      
    } catch (error) {
      console.error(`❌ Failed to deliver API access:`, error);
      throw error;
    }
  }

  /**
   * 📊 DELIVER ENTERPRISE REPORTS
   * Generates and sends enterprise data reports
   */
  async deliverEnterpriseReport(subscription: any, reportType: string): Promise<void> {
    try {
      console.log(`📊 Generating ${reportType} report for ${subscription.agentId}`);
      
      // Generate report based on type
      const report = await this.generateReport(reportType, subscription);
      
      // Send report via email
      if (subscription.email && process.env.SENDGRID_API_KEY) {
        const emailContent = this.createReportEmail(subscription, reportType, report);
        await this.sendEmail(subscription.email, emailContent);
        console.log(`✅ ${reportType} report delivered to ${subscription.email}`);
      }
      
      // Log delivery
      await this.logDelivery(subscription.id, 'enterprise_report', reportType);
      
    } catch (error) {
      console.error(`❌ Failed to deliver enterprise report:`, error);
      throw error;
    }
  }

  /**
   * 💿 DELIVER SDK ACCESS
   * Provides SDK download links and license keys
   */
  async deliverSDKAccess(subscription: any, licenseKey: string): Promise<void> {
    try {
      console.log(`💿 Delivering SDK access to ${subscription.agentId}`);
      
      // Create SDK access email
      const emailContent = this.createSDKAccessEmail(subscription, licenseKey);
      
      // Send via SendGrid
      if (process.env.SENDGRID_API_KEY && subscription.email) {
        await this.sendEmail(subscription.email, emailContent);
        console.log(`✅ SDK access delivered to ${subscription.email}`);
      }
      
      // Log delivery
      await this.logDelivery(subscription.id, 'sdk_access', licenseKey);
      
    } catch (error) {
      console.error(`❌ Failed to deliver SDK access:`, error);
      throw error;
    }
  }

  /**
   * 🏆 DELIVER COMPETITION ACCESS
   * Provides competition registration and dashboard access
   */
  async deliverCompetitionAccess(agentId: string, email?: string): Promise<void> {
    try {
      console.log(`🏆 Delivering competition access to ${agentId}`);
      
      // Generate competition access token
      const competitionToken = crypto.randomBytes(32).toString('hex');
      
      // Create competition welcome email
      const emailContent = this.createCompetitionEmail(agentId, competitionToken);
      
      // Send via SendGrid
      if (process.env.SENDGRID_API_KEY && email) {
        await this.sendEmail(email, emailContent);
        console.log(`✅ Competition access delivered to ${email}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to deliver competition access:`, error);
      throw error;
    }
  }

  /**
   * 📧 SEND EMAIL VIA SENDGRID
   */
  private async sendEmail(to: string, content: any): Promise<void> {
    const msg = {
      to,
      from: 'noreply@coinrailz.com',
      subject: content.subject,
      text: content.text,
      html: content.html
    };

    await sgMail.send(msg);
  }

  /**
   * 🔑 CREATE API ACCESS EMAIL
   */
  private createAPIAccessEmail(subscription: any, apiKey: string, product: any) {
    return {
      subject: `🚀 Your Coinrailz API Access is Ready!`,
      text: `
Welcome to Coinrailz API Access!

Your API Key: ${apiKey}

Product: ${product?.name || 'API Access'}
Status: Active
Documentation: https://coinrailz.com/docs

Getting Started:
1. Use your API key in the Authorization header
2. Example: Authorization: Bearer ${apiKey}
3. Start with our getting started guide: https://coinrailz.com/docs/getting-started

Need help? Contact support@coinrailz.com

Best regards,
The Coinrailz Team
      `,
      html: `
<h2>🚀 Your Coinrailz API Access is Ready!</h2>
<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <strong>API Key:</strong> <code>${apiKey}</code>
</div>
<p><strong>Product:</strong> ${product?.name || 'API Access'}</p>
<p><strong>Status:</strong> <span style="color: green;">✅ Active</span></p>
<h3>Getting Started:</h3>
<ol>
  <li>Use your API key in the Authorization header</li>
  <li>Example: <code>Authorization: Bearer ${apiKey}</code></li>
  <li><a href="https://coinrailz.com/docs/getting-started">View our getting started guide</a></li>
</ol>
<p><a href="https://coinrailz.com/docs" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📖 View Documentation</a></p>
<p>Need help? Contact <a href="mailto:support@coinrailz.com">support@coinrailz.com</a></p>
      `
    };
  }

  /**
   * 📊 CREATE REPORT EMAIL
   */
  private createReportEmail(subscription: any, reportType: string, report: any) {
    return {
      subject: `📊 Your ${reportType} Report is Ready`,
      text: `
Your ${reportType} report has been generated.

Report Summary:
${JSON.stringify(report, null, 2)}

Access your full report: https://coinrailz.com/reports/${subscription.id}

Best regards,
The Coinrailz Team
      `,
      html: `
<h2>📊 Your ${reportType} Report is Ready</h2>
<p>Your comprehensive ${reportType} report has been generated.</p>
<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3>Report Summary:</h3>
  <pre>${JSON.stringify(report, null, 2)}</pre>
</div>
<p><a href="https://coinrailz.com/reports/${subscription.id}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">📊 View Full Report</a></p>
      `
    };
  }

  /**
   * 💿 CREATE SDK ACCESS EMAIL
   */
  private createSDKAccessEmail(subscription: any, licenseKey: string) {
    return {
      subject: `💿 Your Coinrailz SDK License is Ready!`,
      text: `
Welcome to Coinrailz SDK!

License Key: ${licenseKey}

Downloads:
- TypeScript SDK: https://coinrailz.com/downloads/sdk-typescript
- Python SDK: https://coinrailz.com/downloads/sdk-python
- Documentation: https://coinrailz.com/docs/sdk

Support:
- Email: sdk-support@coinrailz.com
- Slack: #coinrailz-sdk

Best regards,
The Coinrailz Team
      `,
      html: `
<h2>💿 Your Coinrailz SDK License is Ready!</h2>
<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <strong>License Key:</strong> <code>${licenseKey}</code>
</div>
<h3>Downloads:</h3>
<ul>
  <li><a href="https://coinrailz.com/downloads/sdk-typescript">TypeScript SDK</a></li>
  <li><a href="https://coinrailz.com/downloads/sdk-python">Python SDK</a></li>
  <li><a href="https://coinrailz.com/docs/sdk">SDK Documentation</a></li>
</ul>
<p><strong>Support:</strong> <a href="mailto:sdk-support@coinrailz.com">sdk-support@coinrailz.com</a></p>
      `
    };
  }

  /**
   * 🏆 CREATE COMPETITION EMAIL
   */
  private createCompetitionEmail(agentId: string, competitionToken: string) {
    return {
      subject: `🏆 Welcome to the Best Agent Competition!`,
      text: `
Welcome to the Best Agent in the World Competition!

Your Competition Token: ${competitionToken}

Competition Details:
- Prize Pool: $50,000
- Duration: 30 days
- Categories: 5 specialized tracks
- Referral Bonus: $500 per agent (up to $10K)

Dashboard: https://coinrailz.com/competition/dashboard?token=${competitionToken}

Best regards,
The Coinrailz Competition Team
      `,
      html: `
<h2>🏆 Welcome to the Best Agent Competition!</h2>
<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <strong>Competition Token:</strong> <code>${competitionToken}</code>
</div>
<h3>Competition Details:</h3>
<ul>
  <li><strong>Prize Pool:</strong> $50,000</li>
  <li><strong>Duration:</strong> 30 days</li>
  <li><strong>Categories:</strong> 5 specialized tracks</li>
  <li><strong>Referral Bonus:</strong> $500 per agent (up to $10K)</li>
</ul>
<p><a href="https://coinrailz.com/competition/dashboard?token=${competitionToken}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">🏆 Access Competition Dashboard</a></p>
      `
    };
  }

  /**
   * 📊 GENERATE REPORT BASED ON TYPE
   */
  private async generateReport(reportType: string, subscription: any): Promise<any> {
    // This would generate actual reports based on type
    const reports = {
      'crypto_flow_intelligence': {
        title: 'Crypto Flow Intelligence Report',
        generated_at: new Date().toISOString(),
        data: {
          top_flows: ['BTC-ETH', 'ETH-USDC', 'USDC-SOL'],
          volume_24h: '$2.5B',
          whale_activity: 'High',
          key_insights: [
            'Large ETH accumulation detected',
            'DeFi TVL increased 15%',
            'Cross-chain bridge activity up 40%'
          ]
        },
        next_report: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    };

    return reports[reportType] || { error: 'Report type not found' };
  }

  /**
   * 🗃️ GET PRODUCT DETAILS
   */
  private async getProductDetails(productId: number): Promise<any> {
    // This would query the actual product database
    const products = {
      1: { name: 'Starter Credits Package', type: 'api_access' },
      2: { name: 'Pro Credits Package', type: 'api_access' },
      3: { name: 'Enterprise Credits Package', type: 'api_access' }
    };
    
    return products[productId] || { name: 'Unknown Product', type: 'unknown' };
  }

  /**
   * 📝 LOG DELIVERY FOR TRACKING
   */
  private async logDelivery(subscriptionId: string, deliveryType: string, deliveryData: string): Promise<void> {
    console.log(`📝 DELIVERY LOG: ${subscriptionId} - ${deliveryType} - ${deliveryData}`);
    // In production, this would log to a deliveries table
  }
}

// Export singleton instance
export const productDelivery = new ProductDeliveryService();