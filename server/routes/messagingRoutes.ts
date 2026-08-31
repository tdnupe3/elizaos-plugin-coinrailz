/**
 * Unified Messaging API Routes
 * Provides access to all messaging protocols for AI agents
 */

import { Router } from 'express';
import { z } from 'zod';
import { unifiedMessagingService } from '../services/unifiedMessagingService';
import { lensMessagingService } from '../services/lensMessagingService';
import { solanaSmsService } from '../services/solanaSmsService';
import { walletConnectMessagingService } from '../services/walletConnectMessagingService';

export const messagingRoutes = Router();

// Request validation schemas
const sendMessageSchema = z.object({
  to: z.string(),
  content: z.string().min(1).max(2000),
  type: z.enum(['email', 'sms', 'lens', 'solana_sms', 'walletconnect']),
  metadata: z.object({
    subject: z.string().optional(),
    phoneNumber: z.string().optional(),
    walletAddress: z.string().optional(),
    profileId: z.string().optional(),
    chainId: z.string().optional(),
    messageType: z.string().optional()
  }).optional()
});

const bulkMessageSchema = z.object({
  messages: z.array(sendMessageSchema),
  batchSize: z.number().min(1).max(100).default(10)
});

const outreachCampaignSchema = z.object({
  targetAgents: z.array(z.string()).min(1).max(50),
  message: z.string().min(1).max(2000),
  preferredProtocols: z.array(z.enum(['email', 'sms', 'lens', 'solana_sms', 'walletconnect'])).min(1)
});

// ============================================================================
// UNIFIED MESSAGING API
// ============================================================================

/**
 * Send message using unified messaging service
 */
messagingRoutes.post('/unified/send', async (req, res) => {
  try {
    console.log('📨 Unified messaging request:', req.body);
    
    const validation = sendMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid message data',
        details: validation.error.issues
      });
    }

    const result = await unifiedMessagingService.sendMessage(validation.data);
    
    console.log('✅ Unified message result:', {
      success: result.success,
      protocol: result.protocol,
      messageId: result.messageId
    });

    res.json({
      success: result.success,
      protocol: result.protocol,
      messageId: result.messageId,
      cost: result.cost,
      error: result.error
    });

  } catch (error: any) {
    console.error('❌ Unified messaging error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * Send bulk messages across protocols
 */
messagingRoutes.post('/unified/bulk', async (req, res) => {
  try {
    console.log('📬 Bulk messaging request:', req.body.messages?.length, 'messages');
    
    const validation = bulkMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid bulk message data',
        details: validation.error.issues
      });
    }

    const { messages, batchSize } = validation.data;
    const results = await unifiedMessagingService.sendBulkMessages(messages);
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0)
    };

    console.log('✅ Bulk messaging completed:', summary);

    res.json({
      success: true,
      summary,
      results: results.map(r => ({
        success: r.success,
        protocol: r.protocol,
        messageId: r.messageId,
        error: r.error
      }))
    });

  } catch (error: any) {
    console.error('❌ Bulk messaging error:', error);
    res.status(500).json({ error: 'Failed to send bulk messages' });
  }
});

/**
 * Discover AI agents across all protocols
 */
messagingRoutes.get('/unified/discover', async (req, res) => {
  try {
    console.log('🔍 AI agent discovery request');
    
    const discoveries = await unifiedMessagingService.discoverAIAgentsAcrossProtocols();
    
    const summary = {
      lens: discoveries.lens.length,
      solana: discoveries.solana.length,
      walletconnect: discoveries.walletconnect.length,
      onChain: Object.entries(discoveries).filter(([k]) => !['lens', 'solana', 'walletconnect'].includes(k)).reduce((sum, [, v]) => sum + (Array.isArray(v) ? v.length : 0), 0),
      total: Object.values(discoveries).flat().length
    };

    console.log('✅ AI agent discovery completed:', summary);

    res.json({
      success: true,
      summary,
      discoveries
    });

  } catch (error: any) {
    console.error('❌ AI agent discovery error:', error);
    res.status(500).json({ error: 'Failed to discover AI agents' });
  }
});

/**
 * Launch AI agent outreach campaign
 */
messagingRoutes.post('/unified/outreach', async (req, res) => {
  try {
    console.log('🚀 AI agent outreach campaign:', req.body);
    
    const validation = outreachCampaignSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid outreach campaign data',
        details: validation.error.issues
      });
    }

    const results = await unifiedMessagingService.sendAIAgentOutreach(validation.data);
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    console.log('✅ Outreach campaign completed:', summary);

    res.json({
      success: true,
      summary,
      results: results.map(r => ({
        success: r.success,
        protocol: r.protocol,
        messageId: r.messageId,
        error: r.error
      }))
    });

  } catch (error: any) {
    console.error('❌ Outreach campaign error:', error);
    res.status(500).json({ error: 'Failed to launch outreach campaign' });
  }
});

/**
 * Get protocol status and capabilities
 */
messagingRoutes.get('/unified/status', async (req, res) => {
  try {
    const status = unifiedMessagingService.getProtocolStatus();
    const info = unifiedMessagingService.getAllProtocolInfo();
    const stats = await unifiedMessagingService.getMessagingStats();
    
    res.json({
      success: true,
      status,
      info,
      stats
    });

  } catch (error: any) {
    console.error('❌ Status check error:', error);
    res.status(500).json({ error: 'Failed to get protocol status' });
  }
});

// ============================================================================
// LENS PROTOCOL MESSAGING
// ============================================================================

messagingRoutes.post('/lens/send', async (req, res) => {
  try {
    const { to, content, profileId } = req.body;
    
    if (!to || !content) {
      return res.status(400).json({ error: 'Missing required fields: to, content' });
    }

    const result = await lensMessagingService.sendMessage({
      to,
      content,
      profileId
    });

    res.json(result);

  } catch (error: any) {
    console.error('❌ Lens messaging error:', error);
    res.status(500).json({ error: 'Failed to send Lens message' });
  }
});

messagingRoutes.post('/lens/bulk', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const results = await lensMessagingService.sendBulkMessages(messages);
    
    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length
      }
    });

  } catch (error: any) {
    console.error('❌ Lens bulk messaging error:', error);
    res.status(500).json({ error: 'Failed to send Lens bulk messages' });
  }
});

messagingRoutes.get('/lens/discover', async (req, res) => {
  try {
    const { keywords } = req.query;
    const keywordArray = keywords ? String(keywords).split(',') : ['AI', 'agent', 'bot'];
    
    const profiles = await lensMessagingService.discoverAIAgentProfiles(keywordArray);
    
    res.json({
      success: true,
      profiles,
      count: profiles.length
    });

  } catch (error: any) {
    console.error('❌ Lens discovery error:', error);
    res.status(500).json({ error: 'Failed to discover Lens profiles' });
  }
});

messagingRoutes.get('/lens/info', async (req, res) => {
  try {
    const info = lensMessagingService.getMessagingInfo();
    const available = lensMessagingService.isAvailable();
    
    res.json({
      success: true,
      available,
      ...info
    });

  } catch (error: any) {
    console.error('❌ Lens info error:', error);
    res.status(500).json({ error: 'Failed to get Lens info' });
  }
});

// ============================================================================
// SOLANA SMS MESSAGING
// ============================================================================

messagingRoutes.post('/solana-sms/send', async (req, res) => {
  try {
    const { toWallet, phoneNumber, content, messageType = 'notification' } = req.body;
    
    if (!toWallet || !content) {
      return res.status(400).json({ error: 'Missing required fields: toWallet, content' });
    }

    const result = await solanaSmsService.sendSolanaMessage({
      toWallet,
      phoneNumber,
      content,
      messageType
    });

    res.json(result);

  } catch (error: any) {
    console.error('❌ Solana SMS error:', error);
    res.status(500).json({ error: 'Failed to send Solana SMS' });
  }
});

messagingRoutes.post('/solana-sms/bulk', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const results = await solanaSmsService.sendBulkSolanaMessages(messages);
    
    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length
      }
    });

  } catch (error: any) {
    console.error('❌ Solana SMS bulk error:', error);
    res.status(500).json({ error: 'Failed to send Solana SMS bulk messages' });
  }
});

messagingRoutes.post('/solana-sms/transaction-alert', async (req, res) => {
  try {
    const { walletAddress, transactionSignature, amount, type = 'received' } = req.body;
    
    if (!walletAddress || !transactionSignature || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: walletAddress, transactionSignature, amount' 
      });
    }

    const result = await solanaSmsService.sendTransactionAlert(
      walletAddress,
      transactionSignature,
      amount,
      type
    );

    res.json(result);

  } catch (error: any) {
    console.error('❌ Solana transaction alert error:', error);
    res.status(500).json({ error: 'Failed to send transaction alert' });
  }
});

messagingRoutes.get('/solana-sms/discover', async (req, res) => {
  try {
    const agents = await solanaSmsService.discoverSolanaAIAgents();
    
    res.json({
      success: true,
      agents,
      count: agents.length
    });

  } catch (error: any) {
    console.error('❌ Solana discovery error:', error);
    res.status(500).json({ error: 'Failed to discover Solana AI agents' });
  }
});

messagingRoutes.get('/solana-sms/info', async (req, res) => {
  try {
    const info = solanaSmsService.getMessagingInfo();
    const available = solanaSmsService.isAvailable();
    
    res.json({
      success: true,
      available,
      ...info
    });

  } catch (error: any) {
    console.error('❌ Solana SMS info error:', error);
    res.status(500).json({ error: 'Failed to get Solana SMS info' });
  }
});

// ============================================================================
// WALLETCONNECT v2 MESSAGING
// ============================================================================

messagingRoutes.post('/walletconnect/send', async (req, res) => {
  try {
    const { toWallet, content, messageType = 'direct', chainId } = req.body;
    
    if (!toWallet || !content) {
      return res.status(400).json({ error: 'Missing required fields: toWallet, content' });
    }

    const result = await walletConnectMessagingService.sendWalletMessage({
      toWallet,
      content,
      messageType,
      chainId
    });

    res.json(result);

  } catch (error: any) {
    console.error('❌ WalletConnect messaging error:', error);
    res.status(500).json({ error: 'Failed to send WalletConnect message' });
  }
});

messagingRoutes.post('/walletconnect/bulk', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const results = await walletConnectMessagingService.sendBulkWalletMessages(messages);
    
    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length
      }
    });

  } catch (error: any) {
    console.error('❌ WalletConnect bulk error:', error);
    res.status(500).json({ error: 'Failed to send WalletConnect bulk messages' });
  }
});

messagingRoutes.get('/walletconnect/discover', async (req, res) => {
  try {
    const agents = await walletConnectMessagingService.discoverWalletConnectAgents();
    
    res.json({
      success: true,
      agents,
      count: agents.length
    });

  } catch (error: any) {
    console.error('❌ WalletConnect discovery error:', error);
    res.status(500).json({ error: 'Failed to discover WalletConnect agents' });
  }
});

messagingRoutes.get('/walletconnect/sessions', async (req, res) => {
  try {
    const activeSessionsCount = walletConnectMessagingService.getActiveSessionsCount();
    
    res.json({
      success: true,
      activeSessions: activeSessionsCount
    });

  } catch (error: any) {
    console.error('❌ WalletConnect sessions error:', error);
    res.status(500).json({ error: 'Failed to get WalletConnect sessions' });
  }
});

messagingRoutes.get('/walletconnect/info', async (req, res) => {
  try {
    const info = walletConnectMessagingService.getMessagingInfo();
    const available = walletConnectMessagingService.isAvailable();
    
    res.json({
      success: true,
      available,
      ...info
    });

  } catch (error: any) {
    console.error('❌ WalletConnect info error:', error);
    res.status(500).json({ error: 'Failed to get WalletConnect info' });
  }
});

// ============================================================================
// TESTING ENDPOINTS
// ============================================================================

/**
 * Test all messaging protocols
 */
messagingRoutes.get('/test/all', async (req, res) => {
  try {
    console.log('🧪 Testing all messaging protocols...');
    
    const testResults = await unifiedMessagingService.testAllProtocols();
    
    res.json({
      success: true,
      testResults
    });

  } catch (error: any) {
    console.error('❌ Protocol testing error:', error);
    res.status(500).json({ error: 'Failed to test protocols' });
  }
});

export default messagingRoutes;