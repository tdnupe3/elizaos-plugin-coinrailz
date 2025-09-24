/**
 * 🔄 A2A FAILOVER PIPELINE SERVICE
 * 
 * Monitors A2A protocol sessions for stalls/failures and automatically
 * initiates XMTP messaging for recovery and continued outreach.
 * 
 * Triggers:
 * - A2A session timeout (>30 minutes without response)
 * - A2A session marked as 'failed' 
 * - A2A discovery endpoint unreachable
 * - Protocol handshake failures
 */

import { CommunicationOrchestrator } from './communicationOrchestrator';
import { XMTPMessagingService } from './xmtpMessagingService';
import { db } from '../db/index.js';
import { outreachLogs, globalAIAgents } from '../../shared/schema.js';
import { nanoid } from 'nanoid';
import { eq, and, sql } from 'drizzle-orm';

interface A2ASession {
  id: string;
  agentId: string;
  agentName: string;
  protocol: 'a2a' | 'mcp' | 'acp' | 'direct';
  status: 'discovering' | 'negotiating' | 'active' | 'completed' | 'failed';
  startTime: Date;
  lastContact: Date;
  messages: any[];
  discoveryMethod: string;
  capabilities?: any;
  taskId?: string;
  stallReason?: 'timeout' | 'no_response' | 'endpoint_unreachable' | 'handshake_failure' | 'protocol_error';
}

interface FailoverAttempt {
  id: string;
  originalSessionId: string;
  agentId: string;
  agentName: string;
  failoverMethod: 'xmtp' | 'emergency_sms' | 'webhook' | 'telegram';
  stallReason: string;
  attemptTime: Date;
  status: 'initiated' | 'delivered' | 'responded' | 'failed';
  response?: string;
  costUSD?: number;
}

export class A2AFailoverPipeline {
  private communicationOrchestrator: CommunicationOrchestrator;
  private xmtpService: XMTPMessagingService;
  private activeFailovers = new Map<string, FailoverAttempt>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly STALL_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MONITORING_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
  private readonly MAX_FAILOVER_ATTEMPTS = 3;
  
  constructor() {
    this.communicationOrchestrator = new CommunicationOrchestrator();
    this.xmtpService = new XMTPMessagingService();
    
    console.log('🔄 A2A Failover Pipeline initialized');
    this.startMonitoring();
  }

  /**
   * 🔍 START CONTINUOUS MONITORING FOR STALLED SESSIONS
   */
  private startMonitoring(): void {
    console.log('🔍 Starting A2A session monitoring for automatic failover...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorStalledSessions();
      } catch (error) {
        console.error('❌ A2A monitoring cycle failed:', error);
      }
    }, this.MONITORING_INTERVAL);
  }

  /**
   * 🔍 MONITOR FOR STALLED A2A SESSIONS
   */
  private async monitorStalledSessions(): Promise<void> {
    console.log('🔍 Scanning for stalled A2A sessions...');
    
    try {
      // Get recent outreach logs to identify stalled sessions
      const recentOutreach = await db.select()
        .from(outreachLogs)
        .where(and(
          eq(outreachLogs.outreachType, 'a2a_protocol'),
          sql`${outreachLogs.createdAt} > NOW() - INTERVAL '2 hours'`
        ))
        .limit(100);

      const stalledSessions = this.identifyStalledSessions(recentOutreach);
      
      console.log(`🔍 Found ${stalledSessions.length} potentially stalled A2A sessions`);
      
      for (const session of stalledSessions) {
        await this.initiateFailoverSequence(session);
      }
      
    } catch (error) {
      console.error('❌ Failed to monitor stalled sessions:', error);
    }
  }

  /**
   * 🎯 IDENTIFY STALLED SESSIONS FROM LOGS
   */
  private identifyStalledSessions(outreachLogs: any[]): A2ASession[] {
    const stalledSessions: A2ASession[] = [];
    const now = new Date();
    
    for (const log of outreachLogs) {
      const lastContactTime = new Date(log.createdAt);
      const timeSinceContact = now.getTime() - lastContactTime.getTime();
      
      // Check for stall conditions
      let stallReason: A2ASession['stallReason'] | null = null;
      
      if (timeSinceContact > this.STALL_TIMEOUT) {
        stallReason = 'timeout';
      } else if (log.status === 'failed' && log.message?.includes('endpoint')) {
        stallReason = 'endpoint_unreachable';  
      } else if (log.status === 'failed' && log.message?.includes('handshake')) {
        stallReason = 'handshake_failure';
      } else if (log.status === 'active' && timeSinceContact > 10 * 60 * 1000) { // 10 min no response
        stallReason = 'no_response';
      }
      
      if (stallReason && !this.activeFailovers.has(log.agentId)) {
        stalledSessions.push({
          id: log.id,
          agentId: log.agentId,
          agentName: log.agentName,
          protocol: 'a2a',
          status: log.status === 'failed' ? 'failed' : 'negotiating',
          startTime: lastContactTime,
          lastContact: lastContactTime,
          messages: [],
          discoveryMethod: log.contactMethod || 'a2a_protocol',
          stallReason
        });
      }
    }
    
    return stalledSessions;
  }

  /**
   * 🚨 INITIATE FAILOVER SEQUENCE
   */
  private async initiateFailoverSequence(session: A2ASession): Promise<void> {
    console.log(`🚨 Initiating failover for stalled A2A session: ${session.agentName} (${session.stallReason})`);
    
    const failoverAttempt: FailoverAttempt = {
      id: nanoid(),
      originalSessionId: session.id,
      agentId: session.agentId,
      agentName: session.agentName,
      failoverMethod: 'xmtp', // Start with XMTP
      stallReason: session.stallReason || 'timeout',
      attemptTime: new Date(),
      status: 'initiated'
    };
    
    this.activeFailovers.set(session.agentId, failoverAttempt);
    
    try {
      // Step 1: Try XMTP messaging first
      const xmtpSuccess = await this.attemptXMTPFailover(session, failoverAttempt);
      
      if (!xmtpSuccess) {
        // Step 2: Try emergency webhook contact
        await this.attemptWebhookFailover(session, failoverAttempt);
      }
      
      // Log the failover attempt
      await this.logFailoverAttempt(failoverAttempt);
      
    } catch (error) {
      console.error(`❌ Failover sequence failed for ${session.agentName}:`, error);
      failoverAttempt.status = 'failed';
      await this.logFailoverAttempt(failoverAttempt);
    }
  }

  /**
   * 📡 ATTEMPT XMTP MESSAGING FAILOVER
   */
  private async attemptXMTPFailover(session: A2ASession, failoverAttempt: FailoverAttempt): Promise<boolean> {
    console.log(`📡 Attempting XMTP failover for ${session.agentName}...`);
    
    try {
      // Generate recovery message
      const recoveryMessage = this.generateFailoverMessage(session);
      
      // Attempt to get agent's wallet address for XMTP
      const agentWalletAddress = await this.getAgentWalletAddress(session.agentId);
      
      if (!agentWalletAddress) {
        console.log(`⚠️ No wallet address found for ${session.agentName}, skipping XMTP failover`);
        return false;
      }
      
      // Send XMTP message
      const xmtpResult = await this.xmtpService.sendMessage(
        agentWalletAddress,
        recoveryMessage
      );
      
      if (xmtpResult.status === 'sent' || xmtpResult.status === 'delivered') {
        failoverAttempt.status = 'delivered';
        failoverAttempt.costUSD = 0.001; // XMTP is very low cost
        console.log(`✅ XMTP failover delivered to ${session.agentName}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ XMTP failover failed for ${session.agentName}:`, error);
      return false;
    }
  }

  /**
   * 🌐 ATTEMPT WEBHOOK FAILOVER
   */
  private async attemptWebhookFailover(session: A2ASession, failoverAttempt: FailoverAttempt): Promise<boolean> {
    console.log(`🌐 Attempting webhook failover for ${session.agentName}...`);
    
    try {
      const recoveryMessage = this.generateFailoverMessage(session);
      
      // Try common webhook endpoints
      const webhookEndpoints = this.generateWebhookEndpoints(session.agentName);
      
      for (const endpoint of webhookEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'CoinRailz A2A Failover Bot 1.0'
            },
            body: JSON.stringify({
              type: 'a2a_failover',
              originalSessionId: session.id,
              agentId: session.agentId,
              message: recoveryMessage,
              stallReason: session.stallReason,
              timestamp: new Date().toISOString()
            }),
            timeout: 10000
          });
          
          if (response.ok) {
            failoverAttempt.status = 'delivered';
            failoverAttempt.failoverMethod = 'webhook';
            console.log(`✅ Webhook failover delivered to ${session.agentName} via ${endpoint}`);
            return true;
          }
          
        } catch (webhookError) {
          // Continue to next endpoint
          continue;
        }
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Webhook failover failed for ${session.agentName}:`, error);
      return false;
    }
  }

  /**
   * 💬 GENERATE FAILOVER RECOVERY MESSAGE
   */
  private generateFailoverMessage(session: A2ASession): string {
    const stallReasonMap = {
      'timeout': 'A2A session timed out after 30 minutes',
      'no_response': 'No response received to A2A protocol messages',
      'endpoint_unreachable': 'A2A endpoint became unreachable',
      'handshake_failure': 'A2A protocol handshake failed',
      'protocol_error': 'A2A protocol error occurred'
    };
    
    const reason = stallReasonMap[session.stallReason || 'timeout'];
    
    return `🔄 CoinRailz A2A Session Recovery

Hi ${session.agentName},

We encountered an issue with our A2A protocol session (${reason}). 

We're reaching out via this backup channel to continue our conversation about revenue opportunities:

💰 **Value Proposition:**
• 85% revenue share for agents
• USDC micropayments with instant settlement
• Multi-chain support (Ethereum, Base, XRP, Polygon)
• Enterprise-grade payment infrastructure

🔧 **Technical Integration:**
• A2A Protocol fallback via XMTP messaging
• Circle USDC native integration
• Real-time analytics and reporting

Would you like to continue our discussion? We can:
1. Retry A2A connection with updated endpoints
2. Switch to XMTP-based communication 
3. Schedule a direct integration call

Original Session ID: ${session.id}
Recovery Contact: partnerships@coinrailz.com

CoinRailz Platform Team`;
  }

  /**
   * 🏠 GET AGENT WALLET ADDRESS
   */
  private async getAgentWalletAddress(agentId: string): Promise<string | null> {
    try {
      const agent = await db.select()
        .from(globalAIAgents)
        .where(eq(globalAIAgents.id, agentId))
        .limit(1);
      
      if (agent.length > 0) {
        const metadata = agent[0].metadata;
        
        // Try to extract wallet address from metadata
        if (metadata?.walletAddress) {
          return metadata.walletAddress;
        }
        
        // Try to derive from agent URL/identifier
        if (metadata?.ethereumAddress) {
          return metadata.ethereumAddress;
        }
        
        // Generate a deterministic address based on agent ID (for demo purposes)
        if (agentId.length >= 40) {
          const addressCandidate = '0x' + agentId.substring(0, 40);
          return addressCandidate;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Failed to get wallet address for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * 🌐 GENERATE WEBHOOK ENDPOINTS
   */
  private generateWebhookEndpoints(agentName: string): string[] {
    const cleanName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return [
      `https://api.${cleanName}.com/webhook`,
      `https://api.${cleanName}.com/contact`,
      `https://${cleanName}.com/api/contact`,
      `https://${cleanName}.com/webhook`,
      `https://hooks.${cleanName}.com/api/contact`
    ];
  }

  /**
   * 📝 LOG FAILOVER ATTEMPT
   */
  private async logFailoverAttempt(failoverAttempt: FailoverAttempt): Promise<void> {
    try {
      await db.insert(outreachLogs).values({
        id: nanoid(),
        agentId: failoverAttempt.agentId,
        agentName: failoverAttempt.agentName,
        outreachType: 'a2a_failover',
        status: failoverAttempt.status,
        contactMethod: failoverAttempt.failoverMethod,
        message: `A2A failover initiated due to ${failoverAttempt.stallReason}`,
        response: failoverAttempt.response || null,
        metadata: JSON.stringify({
          originalSessionId: failoverAttempt.originalSessionId,
          stallReason: failoverAttempt.stallReason,
          failoverMethod: failoverAttempt.failoverMethod,
          costUSD: failoverAttempt.costUSD || 0
        }),
        createdAt: failoverAttempt.attemptTime
      });
      
      console.log(`📝 Logged failover attempt for ${failoverAttempt.agentName}`);
      
    } catch (error) {
      console.error('❌ Failed to log failover attempt:', error);
    }
  }

  /**
   * 📊 GET FAILOVER STATISTICS
   */
  public getFailoverStats() {
    const attempts = Array.from(this.activeFailovers.values());
    
    return {
      totalFailovers: attempts.length,
      successfulFailovers: attempts.filter(a => a.status === 'delivered').length,
      failedFailovers: attempts.filter(a => a.status === 'failed').length,
      totalCostUSD: attempts.reduce((sum, a) => sum + (a.costUSD || 0), 0),
      methodBreakdown: {
        xmtp: attempts.filter(a => a.failoverMethod === 'xmtp').length,
        webhook: attempts.filter(a => a.failoverMethod === 'webhook').length,
        emergency_sms: attempts.filter(a => a.failoverMethod === 'emergency_sms').length
      },
      stallReasons: {
        timeout: attempts.filter(a => a.stallReason === 'timeout').length,
        no_response: attempts.filter(a => a.stallReason === 'no_response').length,
        endpoint_unreachable: attempts.filter(a => a.stallReason === 'endpoint_unreachable').length,
        handshake_failure: attempts.filter(a => a.stallReason === 'handshake_failure').length
      }
    };
  }

  /**
   * 🔄 GET ACTIVE FAILOVERS
   */
  public getActiveFailovers(): FailoverAttempt[] {
    return Array.from(this.activeFailovers.values());
  }

  /**
   * ⏹️ STOP MONITORING
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ A2A failover monitoring stopped');
    }
  }

  /**
   * 🧹 CLEANUP OLD FAILOVERS
   */
  public cleanupOldFailovers(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [agentId, failover] of this.activeFailovers.entries()) {
      if (failover.attemptTime < oneDayAgo) {
        this.activeFailovers.delete(agentId);
      }
    }
    
    console.log('🧹 Cleaned up old failover attempts');
  }
}

// Export singleton instance
export const a2aFailoverPipeline = new A2AFailoverPipeline();