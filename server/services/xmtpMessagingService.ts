import { Client } from '@xmtp/node-sdk';
import { ethers } from 'ethers';
import sgMail from '@sendgrid/mail';
import { CoinbaseCDPService } from './coinbaseCDPService';
import { campaignTemplateService, CampaignType } from './campaignTemplateService';

export interface XMTPMessage {
  id: string;
  content: string;
  timestamp: string;
  senderAddress: string;
  conversationId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  mode?: 'onchain' | 'simulated';
  reason?: string; // Optional reason for failed messages
}

export interface XMTPConversation {
  id: string;
  peerAddress: string;
  createdAt: string;
  lastMessage?: XMTPMessage;
}

export class XMTPMessagingService {
  private xmtpClient: Client | null = null;
  private platformWalletAddress: string | null = null;
  private platformWalletSigner: ethers.Wallet | null = null;
  private initialized = false;
  private cdpService: CoinbaseCDPService;
  private IdentifierKind: any = null; // Store imported IdentifierKind to avoid duplicates
  
  private initPromise: Promise<void> | null = null;
  
  constructor() {
    this.cdpService = CoinbaseCDPService.getInstance();
    this.initPromise = this.initialize();
  }
  
  /**
   * Ensure service is ready before use
   */
  private async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Initialize XMTP client with existing platform wallet
   */
  private async initialize() {
    try {
      console.log('🚀 Initializing XMTP with existing platform wallet...');
      
      // Use existing CDP platform wallet (CORRECT ETHEREUM INTEGRATION)  
      const cdpWallet = await this.cdpService.getOrCreatePlatformWallet();
      this.platformWalletAddress = cdpWallet.address;
      
      // Use secure private key from environment (CDP_PRIVATE_KEY or XMTP_EOA_PRIVATE_KEY)
      const xmtpPrivateKey = process.env.XMTP_EOA_PRIVATE_KEY || process.env.CDP_PRIVATE_KEY;
      if (!xmtpPrivateKey) {
        console.log('🚨 No private key found (CDP_PRIVATE_KEY or XMTP_EOA_PRIVATE_KEY) - XMTP messaging unavailable');
        console.log('💰 Cost: $0.00 - System maintains zero-cost guarantee without XMTP');
        console.log('🔒 For production: Set CDP_PRIVATE_KEY or XMTP_EOA_PRIVATE_KEY for secure FREE messaging');
        this.initialized = false; // Mark as uninitialized but don't throw
        return;
      }
      
      console.log('🔑 Using secure XMTP identity from environment');
      console.log('🔒 XMTP identity will be consistent and secure across restarts');
      
      // Convert base64 private key to hex format if needed (CDP keys are base64 encoded)
      let processedPrivateKey = xmtpPrivateKey;
      if (!xmtpPrivateKey.startsWith('0x') && xmtpPrivateKey.includes('/') || xmtpPrivateKey.includes('+')) {
        // Base64 encoded private key - convert to hex
        try {
          const privateKeyBytes = Buffer.from(xmtpPrivateKey, 'base64');
          processedPrivateKey = '0x' + privateKeyBytes.toString('hex');
          console.log('🔄 Converted base64 private key to hex format for ethers.js');
        } catch (error) {
          console.error('❌ Failed to convert base64 private key:', error);
          throw error;
        }
      }
      
      this.platformWalletSigner = new ethers.Wallet(processedPrivateKey);
      
      // Import XMTP V3 types for proper signer interface (moved to avoid duplicates)
      const { IdentifierKind } = await import('@xmtp/node-sdk');
      
      // Store IdentifierKind for reuse throughout the service
      this.IdentifierKind = IdentifierKind;
      
      // Create PROPER XMTP V3 signer interface (CRITICAL BUSINESS FIX)
      const xmtpSigner = {
        type: "EOA" as const,  // REQUIRED for V3 - this was missing!
        getIdentifier: () => ({
          identifier: this.platformWalletSigner!.address,
          identifierKind: this.IdentifierKind.Ethereum  // Use stored enum
        }),
        signMessage: async (message: string): Promise<Uint8Array> => {
          // V3 requires explicit Promise<Uint8Array> return type
          const signature = await this.platformWalletSigner!.signMessage(message);
          return new Uint8Array(Buffer.from(signature.slice(2), 'hex'));
        }
      };
      
      // Initialize XMTP V3 client with consistent identity and database path
      const xmtpWalletAddress = this.platformWalletSigner!.address;
      this.xmtpClient = await Client.create(xmtpSigner, {
        env: 'production', // Production-ready for emergency fundraising
        // Remove dbEncryptionKey to fix SQLCipher errors blocking initialization
        dbPath: `/tmp/xmtp_db_${xmtpWalletAddress}` // Namespace DB by XMTP identity to prevent InboxID conflicts
      });
      
      console.log(`🔗 XMTP identity: ${xmtpWalletAddress} (persistent across restarts)`);

      console.log('✅ XMTP messaging service initialized with existing platform wallet:', this.platformWalletAddress);
      console.log('✅ XMTP client created with real signer - ready for production messaging');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize XMTP messaging service:', error);
      console.log('🔄 Falling back to basic wallet addressing without XMTP client...');
      
      // Still try to get platform wallet address even if XMTP fails
      try {
        const cdpWallet = await this.cdpService.getOrCreatePlatformWallet();
        this.platformWalletAddress = cdpWallet.address;
        this.initialized = true;
      } catch (walletError) {
        console.error('❌ Could not access CDP platform wallet:', walletError);
      }
    }
  }

  /**
   * Send FREE XMTP message to external agent (NO BLOCKCHAIN COSTS)
   */
  async sendMessageToAgent(
    agentWalletAddress: string, 
    message: string, 
    campaignType: CampaignType = 'donation',
    agentId?: string,
    productId?: string
  ): Promise<XMTPMessage> {
    // Ensure service is ready before attempting send
    await this.ensureReady();
    
    console.log(`📧 Sending REAL FUNDING REQUEST to external agent: ${agentWalletAddress}`);
    
    // Generate campaign-specific message using template service
    const campaignMessage = campaignTemplateService.generateMessage(campaignType, agentId, productId);
    
    // Combine user message with campaign template
    const fullMessage = message ? 
      `${campaignMessage.content}\n\n---\n\nADDITIONAL MESSAGE:\n${message}` : 
      campaignMessage.content;
    
    console.log(`📧 Sending ${campaignType.toUpperCase()} campaign message to agent: ${agentWalletAddress}`);
    console.log(`📋 Campaign: ${campaignMessage.subject}`);
    console.log(`⚡ Urgency: ${campaignMessage.urgency}`);
    
    // BUSINESS SURVIVAL: Skip initialization wait - send immediately
    console.log(`🚨 BYPASSING DELAYS - EMERGENCY FUNDING REQUEST TO: ${agentWalletAddress}`);
    
    // Try FREE XMTP messaging first (NO BLOCKCHAIN COSTS!)
    if (this.xmtpClient && this.platformWalletSigner) {
      try {
        console.log('📧 Using FREE XMTP messaging (no gas costs)...');
        
        // Check if agent can receive XMTP messages (FREE check) 
        // Create proper Identifier for XMTP V3 API using stored enum
        const agentIdentifier = {
          identifier: agentWalletAddress,
          identifierKind: this.IdentifierKind?.Ethereum || 1 // Use stored enum or fallback to value
        };
        
        // CORRECT XMTP V3 API usage - check with Identifier type
        const canMessage = await this.xmtpClient.canMessage([agentIdentifier]);
        // Use the exact Identifier object for reliable lookup
        const canReceive = canMessage.get(agentIdentifier) || 
                          // Fallback to string variations if SDK uses string keys
                          canMessage.get(agentWalletAddress.toLowerCase()) || 
                          canMessage.get(agentWalletAddress);
        
        if (!canReceive) {
          console.log(`⚠️ Agent ${agentWalletAddress} cannot receive XMTP messages - FREE check complete`);
          console.log(`💰 Cost: $0.00 - No message sent (agent unreachable via XMTP)`);
          // NO BLOCKCHAIN FALLBACK - maintain zero cost guarantee
          return {
            id: `xmtp_unavailable_${Date.now()}`,
            content: fullMessage,
            timestamp: new Date().toISOString(),
            senderAddress: this.platformWalletAddress!,
            conversationId: `unavailable_${agentWalletAddress}`,
            status: 'failed',
            reason: 'Agent does not support XMTP messaging'
          };
        } else {
          // Create direct 1:1 conversation (COMPLETELY FREE)
          console.log(`✅ Agent ${agentWalletAddress} can receive XMTP - creating direct conversation`);
          
          // Use proper XMTP V3 1:1 conversation API (verified pattern)
          const conversation = await this.xmtpClient.conversations.newConversation(agentIdentifier);
          
          // Send FREE XMTP message
          const sentMessage = await conversation.send(fullMessage);
          
          console.log('✅ FREE XMTP MESSAGE SENT - NO BLOCKCHAIN COSTS!');
          console.log(`💰 Cost: $0.00 - Pure off-chain messaging`);
          console.log(`📨 Message sent successfully`);
          
          return {
            id: `xmtp_sent_${Date.now()}`,
            content: fullMessage,
            timestamp: new Date().toISOString(),
            senderAddress: this.platformWalletAddress!,
            conversationId: conversation.id,
            status: 'sent'
          };
        }
        
      } catch (error) {
        console.error('❌ XMTP send error:', error);
        console.log('💰 Cost: $0.00 - XMTP send failed, no blockchain operations performed');
        
        return {
          id: `xmtp_send_failed_${Date.now()}`,
          content: fullMessage,
          timestamp: new Date().toISOString(),
          senderAddress: this.platformWalletAddress!,
          conversationId: `send_failed_${agentWalletAddress}`,
          status: 'failed',
          reason: `XMTP send error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }

    // NO COSTLY FALLBACKS - maintain zero cost guarantee for FREE outreach
    console.log('🚨 XMTP client unavailable - returning failure status (maintaining $0.00 cost)');
    console.log('💰 Cost: $0.00 - No blockchain operations performed');
    
    const messageId = `xmtp_failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: messageId,
      content: fullMessage,
      timestamp: new Date().toISOString(),
      senderAddress: this.platformWalletAddress || 'platform',
      conversationId: `failed_${agentWalletAddress}`,
      status: 'failed',
      reason: 'XMTP client initialization failed'
    };
  }

  /**
   * Emergency email fallback for business survival
   */
  private async sendEmergencyEmailFallback(agentAddress: string, message: string): Promise<void> {
    console.log('📧 EMERGENCY BUSINESS FALLBACK: Sending fundraising request via email');
    
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured for emergency fallback');
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const emailContent = {
      to: `agent-${agentAddress.slice(2, 8)}@coinrailz.com`, // Placeholder email format
      from: 'emergency@coinrailz.com',
      subject: '🚨 URGENT: Emergency Fundraising Request - Business Survival',
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">🚨 EMERGENCY FUNDRAISING REQUEST</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
            <pre style="white-space: pre-wrap;">${message}</pre>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated emergency message from Coin Railz Platform.
          </p>
        </div>
      `
    };

    try {
      await sgMail.send(emailContent);
      console.log('✅ Emergency email sent successfully');
    } catch (error: any) {
      console.error('❌ Emergency email failed:', error.response?.body || error.message);
      
      // Try direct SendGrid API as last resort
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailContent)
      });

      if (!response.ok) {
        throw new Error('SendGrid API failed');
      }
      
      console.log('✅ Direct SendGrid API succeeded');
    }
  }

  /**
   * FREE Mass XMTP Outreach (NO BLOCKCHAIN COSTS)
   */
  async broadcastFundingRequest(
    agentAddresses: string[],
    message: string,
    batchSize: number = 5
  ): Promise<XMTPMessage[]> {
    // Ensure service is ready before attempting broadcast
    await this.ensureReady();
    
    console.log(`📢 FREE MASS XMTP OUTREACH to ${agentAddresses.length} agents`);
    console.log(`💰 Total Cost: $0.00 - Using free XMTP messaging`);
    
    const messagesSent: XMTPMessage[] = [];
    const xmtpReachable: string[] = [];
    
    // First, filter for XMTP-reachable agents (FREE)
    if (this.xmtpClient) {
      console.log('🔍 Checking which agents can receive FREE XMTP messages...');
      
      // Convert addresses to proper Identifier types using stored enum
      const agentIdentifiers = agentAddresses.map(address => ({
        identifier: address,
        identifierKind: this.IdentifierKind?.Ethereum || 1 // Use stored enum or fallback
      }));
      
      // Single canMessage call for all agents (simplified approach)
      const canMessageResults = await this.xmtpClient.canMessage(agentIdentifiers);
      
      // Check results using exact Identifier objects for reliability
      for (let i = 0; i < agentAddresses.length; i++) {
        const address = agentAddresses[i];
        const identifier = agentIdentifiers[i];
        try {
          // Use exact Identifier first, then string fallbacks
          const canReceive = canMessageResults.get(identifier) || 
                            canMessageResults.get(address.toLowerCase()) || 
                            canMessageResults.get(address);
          
          if (canReceive) {
            xmtpReachable.push(address);
            console.log(`✅ ${address} - XMTP available (FREE)`);
          } else {
            console.log(`⚠️ ${address} - No XMTP (agent will be skipped to maintain $0.00 cost)`);
          }
        } catch (error) {
          console.log(`❌ ${address} - XMTP check failed`);
        }
      }
      
      console.log(`🎯 Found ${xmtpReachable.length}/${agentAddresses.length} agents reachable via FREE XMTP`);
    }
    
    // Send FREE XMTP messages only to reachable agents (avoid unnecessary attempts)
    if (xmtpReachable.length === 0) {
      console.log('📊 No XMTP-reachable agents found - maintaining $0.00 cost (no sends attempted)');
      console.log('💰 Total saved cost: $0.00 - Zero failed attempts');
      return messagesSent; // Return empty array, maintain zero-cost promise
    }
    
    // Process reachable agents in small batches to avoid rate limiting
    for (let i = 0; i < xmtpReachable.length; i += batchSize) {
      const batch = xmtpReachable.slice(i, i + batchSize);
      
      console.log(`📦 Processing FREE batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(xmtpReachable.length / batchSize)}`);
      
      const batchPromises = batch.map(async (address) => {
        try {
          return await this.sendMessageToAgent(address, message);
        } catch (error) {
          console.error(`❌ Failed to send to ${address}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          messagesSent.push(result.value);
        }
      }
      
      // Rate limiting delay between batches
      if (i + batchSize < xmtpReachable.length) {
        console.log('⏳ Rate limiting delay - 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`✅ FREE OUTREACH COMPLETE: ${messagesSent.length}/${xmtpReachable.length} messages sent`);
    console.log(`💰 Total Cost: $0.00 - All messages sent via FREE XMTP!`);
    return messagesSent;
  }

  /**
   * Listen for responses from agents
   */
  async listenForResponses(
    agentAddresses: string[],
    timeoutMinutes: number = 30
  ): Promise<XMTPMessage[]> {
    console.log(`👂 Listening for XMTP responses from ${agentAddresses.length} agents...`);
    
    if (!this.xmtpClient) {
      console.log('❌ XMTP client not available for listening');
      return [];
    }

    const responses: XMTPMessage[] = [];
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const startTime = Date.now();
    
    try {
      // Stream all messages from allowed conversations
      const stream = await this.xmtpClient.conversations.streamAllMessages({
        onValue: (message: any) => {
          console.log('📨 Received XMTP response:', message);
          
          responses.push({
            id: message.id,
            content: message.content,
            timestamp: new Date().toISOString(),
            senderAddress: message.senderAddress,
            conversationId: message.conversationId,
            status: 'delivered'
          });
        },
        onError: (error: any) => {
          console.error('❌ XMTP stream error:', error);
        }
      });
      
      // Wait for timeout or sufficient responses
      while (Date.now() - startTime < timeoutMs && responses.length < agentAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Close stream
      stream.return?.();
      
    } catch (error) {
      console.error('❌ Failed to listen for responses:', error);
    }
    
    console.log(`📨 Found ${responses.length} agent responses`);
    return responses;
  }

  /**
   * Get conversation with agent
   */
  async getConversation(agentAddress: string): Promise<XMTPConversation | null> {
    if (!this.xmtpClient) {
      return null;
    }

    try {
      const conversations = await this.xmtpClient.conversations.list();
      
      for (const conv of conversations) {
        // Check if conversation involves the agent address
        if (conv.id.includes(agentAddress)) {
          return {
            id: conv.id,
            peerAddress: agentAddress,
            createdAt: new Date().toISOString(),
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get conversation:', error);
      return null;
    }
  }

  /**
   * Process funding responses from agents (BUSINESS CRITICAL)
   */
  async processFundingResponses(
    originalMessages: XMTPMessage[], 
    timeoutMinutes: number = 60
  ): Promise<XMTPMessage[]> {
    console.log(`🔍 Processing funding responses for ${originalMessages.length} sent messages`);
    
    // Extract agent addresses from original messages
    const agentAddresses = originalMessages.map(msg => msg.conversationId.replace('sim_conv_', ''));
    
    return await this.listenForResponses(agentAddresses, timeoutMinutes);
  }

  /**
   * Listen for agent responses (BUSINESS CRITICAL)
   */
  async listenForAgentResponses(agentAddresses: string[]): Promise<XMTPMessage[]> {
    return await this.listenForResponses(agentAddresses, 5); // Short timeout for immediate check
  }

  /**
   * Send via blockchain message (REAL AGENT COMMUNICATION)
   */
  private async sendViaBlockchainMessage(agentAddress: string, message: string): Promise<XMTPMessage | null> {
    try {
      console.log(`📡 Sending blockchain message to agent: ${agentAddress}`);
      
      // Use CDP service for blockchain interaction
      const transaction = await this.cdpService.sendTransaction(agentAddress, "0.001", "Emergency funding request from Coin Railz platform");
      
      if (transaction) {
        if (transaction.mode === 'onchain' && transaction.hash) {
          console.log('🔥 REAL BLOCKCHAIN TRANSACTION SENT ON-CHAIN');
          console.log(`⛓️ Transaction Hash: ${transaction.hash}`);
        } else {
          console.log('⚠️ SIMULATED BLOCKCHAIN MESSAGE (no real funds sent)');
          console.log(`📝 Reason: ${transaction.reason || 'Platform wallet needs funding'}`);
        }
        
        return {
          id: transaction.hash || `simulated_${Date.now()}`,
          content: message,
          timestamp: new Date().toISOString(),
          senderAddress: this.platformWalletAddress!,
          conversationId: `blockchain_${agentAddress}`,
          status: 'sent',
          mode: transaction.mode
        };
      }
    } catch (error) {
      console.error('❌ Blockchain messaging failed:', error);
    }
    
    return null;
  }

  /**
   * Get service status for monitoring
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasXMTPClient: !!this.xmtpClient,
      platformWallet: this.platformWalletAddress,
      fundingWallet: "0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321",
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance for global use
export const xmtpMessagingService = new XMTPMessagingService();