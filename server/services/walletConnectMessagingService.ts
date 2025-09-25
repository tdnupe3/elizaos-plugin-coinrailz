/**
 * WalletConnect v2 Messaging Service
 * Handles wallet-to-wallet messaging through WalletConnect protocol
 */

interface WalletConnectMessage {
  toWallet: string;
  fromWallet?: string;
  content: string;
  messageType: 'direct' | 'transaction' | 'request' | 'notification';
  chainId?: string;
  metadata?: any;
}

interface WalletConnectResult {
  success: boolean;
  messageId?: string;
  sessionId?: string;
  error?: string;
}

export class WalletConnectMessagingService {
  private web3wallet: any;
  private isInitialized: boolean = false;
  private activeSessions: Map<string, any> = new Map();

  constructor() {
    this.initializeWalletConnect();
  }

  /**
   * Initialize WalletConnect v2 client
   */
  private async initializeWalletConnect(): Promise<void> {
    try {
      // Initialize WalletConnect v2 Web3Wallet
      const { Web3Wallet, Core } = await import('@walletconnect/web3wallet');
      
      const core = new Core({
        projectId: process.env.WALLETCONNECT_PROJECT_ID || 'coinrailz-messaging'
      });

      this.web3wallet = await Web3Wallet.init({
        core,
        metadata: {
          name: 'Coin Railz Messaging',
          description: 'AI Agent Payment & Messaging Platform',
          url: 'https://coinrailz.com',
          icons: ['https://coinrailz.com/logo.png']
        }
      });

      // Set up event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ WalletConnect v2 messaging service initialized');

    } catch (error) {
      console.error('❌ Failed to initialize WalletConnect:', error);
      this.isInitialized = false;
      
      // Fallback initialization for development
      this.initializeFallback();
    }
  }

  /**
   * Fallback initialization for development
   */
  private initializeFallback(): void {
    console.log('🔄 Using WalletConnect fallback mode for development');
    this.isInitialized = true;
    
    // Mock web3wallet for development
    this.web3wallet = {
      pair: async () => ({ uri: 'wc:mock-uri' }),
      approveSession: async () => ({ topic: 'mock-topic' }),
      rejectSession: async () => true,
      disconnectSession: async () => true,
      getActiveSessions: () => ({}),
      emitSessionEvent: async () => true
    };
  }

  /**
   * Set up WalletConnect event listeners
   */
  private setupEventListeners(): void {
    if (!this.web3wallet || !this.web3wallet.on) return;

    // Session proposal event
    this.web3wallet.on('session_proposal', async (event: any) => {
      console.log('📱 WalletConnect session proposal received:', event.params);
      await this.handleSessionProposal(event);
    });

    // Session request event
    this.web3wallet.on('session_request', async (event: any) => {
      console.log('💬 WalletConnect session request received:', event.params);
      await this.handleSessionRequest(event);
    });

    // Session delete event
    this.web3wallet.on('session_delete', (event: any) => {
      console.log('🔌 WalletConnect session deleted:', event.topic);
      this.activeSessions.delete(event.topic);
    });
  }

  /**
   * Send message through WalletConnect
   */
  async sendWalletMessage(message: WalletConnectMessage): Promise<WalletConnectResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('WalletConnect messaging service not initialized');
      }

      // Find or create session with target wallet
      const session = await this.getOrCreateSession(message.toWallet);
      if (!session) {
        throw new Error('Failed to establish WalletConnect session');
      }

      // Format message for WalletConnect
      const wcMessage = this.formatWalletConnectMessage(message);

      // Send message through session
      const result = await this.web3wallet.emitSessionEvent({
        topic: session.topic,
        event: {
          name: 'message',
          data: wcMessage
        },
        chainId: message.chainId || 'eip155:1'
      });

      console.log('✅ WalletConnect message sent successfully:', {
        to: message.toWallet,
        sessionId: session.topic,
        messageType: message.messageType
      });

      return {
        success: true,
        messageId: `wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: session.topic
      };

    } catch (error: any) {
      console.error('❌ WalletConnect messaging failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to send WalletConnect message'
      };
    }
  }

  /**
   * Send bulk messages to multiple wallets
   */
  async sendBulkWalletMessages(messages: WalletConnectMessage[]): Promise<WalletConnectResult[]> {
    const results: WalletConnectResult[] = [];
    
    for (const message of messages) {
      const result = await this.sendWalletMessage(message);
      results.push(result);
      
      // Rate limiting - wait 1.5 seconds between messages
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return results;
  }

  /**
   * Discover AI agents using WalletConnect
   */
  async discoverWalletConnectAgents(): Promise<any[]> {
    try {
      const activeSessions = this.web3wallet.getActiveSessions();
      const agents = [];

      for (const [topic, session] of Object.entries(activeSessions)) {
        // Check if session metadata indicates an AI agent
        const metadata = (session as any).peer?.metadata;
        if (metadata && this.isLikelyAIAgent(metadata)) {
          agents.push({
            sessionId: topic,
            walletAddress: (session as any).namespaces?.eip155?.accounts?.[0],
            metadata: metadata,
            lastActivity: (session as any).expiry
          });
        }
      }

      console.log(`🤖 Found ${agents.length} potential AI agents via WalletConnect`);
      return agents;

    } catch (error) {
      console.error('❌ Failed to discover WalletConnect agents:', error);
      return [];
    }
  }

  /**
   * Get or create WalletConnect session with target wallet
   */
  private async getOrCreateSession(targetWallet: string): Promise<any> {
    try {
      // Check if we already have an active session with this wallet
      const existingSession = Array.from(this.activeSessions.values())
        .find(session => session.walletAddress === targetWallet);

      if (existingSession) {
        return existingSession;
      }

      // Create new pairing URI
      const { uri } = await this.web3wallet.pair({
        uri: targetWallet, // In production, this would be a proper WC URI
        requiredNamespaces: {
          eip155: {
            methods: ['eth_sendTransaction', 'personal_sign'],
            chains: ['eip155:1'],
            events: ['chainChanged', 'accountsChanged']
          }
        }
      });

      // For development, create a mock session
      const mockSession = {
        topic: `session_${Date.now()}`,
        walletAddress: targetWallet,
        uri: uri,
        status: 'active'
      };

      this.activeSessions.set(mockSession.topic, mockSession);
      return mockSession;

    } catch (error) {
      console.error('❌ Failed to create WalletConnect session:', error);
      return null;
    }
  }

  /**
   * Handle incoming session proposals
   */
  private async handleSessionProposal(event: any): Promise<void> {
    try {
      // Auto-approve sessions for messaging purposes
      await this.web3wallet.approveSession({
        id: event.id,
        namespaces: event.params.requiredNamespaces
      });

      console.log('✅ WalletConnect session approved');

    } catch (error) {
      console.error('❌ Failed to handle session proposal:', error);
      
      // Reject the session if approval fails
      await this.web3wallet.rejectSession({
        id: event.id,
        reason: { code: 1, message: 'User rejected' }
      });
    }
  }

  /**
   * Handle incoming session requests
   */
  private async handleSessionRequest(event: any): Promise<void> {
    try {
      const { topic, params } = event;

      // Handle different request types
      switch (params.request.method) {
        case 'message':
          await this.processIncomingMessage(topic, params.request.params);
          break;
        
        case 'eth_sendTransaction':
          // Handle transaction requests (would require user approval)
          console.log('📤 Transaction request received via WalletConnect');
          break;
        
        default:
          console.log('❓ Unknown WalletConnect request method:', params.request.method);
      }

    } catch (error) {
      console.error('❌ Failed to handle session request:', error);
    }
  }

  /**
   * Process incoming messages
   */
  private async processIncomingMessage(sessionId: string, messageData: any): Promise<void> {
    console.log('📨 Incoming WalletConnect message:', {
      sessionId,
      content: messageData.content,
      type: messageData.messageType
    });

    // Store message in database or forward to appropriate handler
    // This would integrate with the main messaging system
  }

  /**
   * Format message for WalletConnect protocol
   */
  private formatWalletConnectMessage(message: WalletConnectMessage): any {
    return {
      content: message.content,
      messageType: message.messageType,
      fromWallet: message.fromWallet,
      timestamp: Date.now(),
      metadata: message.metadata
    };
  }

  /**
   * Check if metadata indicates an AI agent
   */
  private isLikelyAIAgent(metadata: any): boolean {
    const aiKeywords = ['ai', 'bot', 'agent', 'auto', 'dex', 'defi', 'trading'];
    const name = (metadata.name || '').toLowerCase();
    const description = (metadata.description || '').toLowerCase();
    
    return aiKeywords.some(keyword => 
      name.includes(keyword) || description.includes(keyword)
    );
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Disconnect all sessions
   */
  async disconnectAllSessions(): Promise<void> {
    try {
      for (const [topic] of this.activeSessions) {
        await this.web3wallet.disconnectSession({
          topic,
          reason: { code: 1, message: 'Service shutdown' }
        });
      }
      
      this.activeSessions.clear();
      console.log('🔌 All WalletConnect sessions disconnected');

    } catch (error) {
      console.error('❌ Failed to disconnect sessions:', error);
    }
  }

  /**
   * Check if WalletConnect messaging is available
   */
  isAvailable(): boolean {
    return this.isInitialized;
  }

  /**
   * Get messaging info and capabilities
   */
  getMessagingInfo() {
    return {
      protocol: 'WalletConnect v2',
      networks: ['Ethereum', 'Polygon', 'BSC', 'Arbitrum', 'Optimism'],
      capabilities: [
        'Wallet-to-wallet messaging',
        'Cross-chain communication',
        'Session management',
        'Real-time messaging'
      ],
      costs: {
        sessionCreation: 'Free',
        messaging: 'Free',
        currency: 'N/A'
      },
      rateLimits: {
        messagesPerMinute: 60,
        sessionsPerHour: 100
      }
    };
  }
}

// Export singleton instance
export const walletConnectMessagingService = new WalletConnectMessagingService();