/**
 * CUSTOMER-AGENT MESSAGING SYSTEM
 * Real-time communication for service delivery coordination
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Message storage
const conversations = new Map();
const messages = new Map();
const notifications = new Map();

// Message schema
const messageSchema = z.object({
  orderId: z.string(),
  fromId: z.string(),
  fromType: z.enum(['customer', 'agent']),
  toId: z.string(),
  toType: z.enum(['customer', 'agent']),
  content: z.string().min(1, 'Message content required'),
  attachments: z.array(z.string()).optional(),
  messageType: z.enum(['text', 'file', 'milestone', 'system']).default('text')
});

// Send message
router.post('/send', async (req, res) => {
  try {
    const validation = messageSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message data',
        details: validation.error.issues
      });
    }

    const messageData = validation.data;
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const conversationId = `conv_${messageData.orderId}`;

    const message = {
      id: messageId,
      conversationId,
      ...messageData,
      timestamp: new Date().toISOString(),
      status: 'sent',
      readBy: [messageData.fromId] // Sender has read it
    };

    messages.set(messageId, message);

    // Update conversation
    let conversation = conversations.get(conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        orderId: messageData.orderId,
        participants: [
          { id: messageData.fromId, type: messageData.fromType },
          { id: messageData.toId, type: messageData.toType }
        ],
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 0
      };
    }

    conversation.lastMessageAt = message.timestamp;
    conversation.messageCount = (conversation.messageCount || 0) + 1;
    conversation.lastMessage = {
      id: messageId,
      content: message.content,
      fromType: message.fromType,
      timestamp: message.timestamp
    };

    conversations.set(conversationId, conversation);

    // Create notification for recipient
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const notification = {
      id: notificationId,
      userId: messageData.toId,
      type: 'new_message',
      title: `New message from ${messageData.fromType}`,
      content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      data: {
        messageId,
        conversationId,
        orderId: messageData.orderId
      },
      createdAt: new Date().toISOString(),
      read: false
    };

    if (!notifications.has(messageData.toId)) {
      notifications.set(messageData.toId, []);
    }
    notifications.get(messageData.toId).push(notification);

    res.status(201).json({
      success: true,
      data: {
        messageId,
        conversationId,
        message: {
          id: messageId,
          content: message.content,
          timestamp: message.timestamp,
          status: message.status
        },
        notificationSent: true
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Message sending failed'
    });
  }
});

// Get conversation messages
router.get('/conversation/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { userId, limit = 50, offset = 0 } = req.query;
  
  const conversationId = `conv_${orderId}`;
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    return res.json({
      success: true,
      data: {
        conversation: null,
        messages: [],
        total: 0
      }
    });
  }

  // Verify user is participant
  const isParticipant = conversation.participants.some(p => p.id === userId);
  if (!isParticipant && userId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to this conversation'
    });
  }

  // Get messages for this conversation
  const conversationMessages = Array.from(messages.values())
    .filter(msg => msg.conversationId === conversationId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(Number(offset), Number(offset) + Number(limit));

  // Mark messages as read by this user
  if (userId) {
    conversationMessages.forEach(msg => {
      if (!msg.readBy.includes(userId as string)) {
        msg.readBy.push(userId as string);
        messages.set(msg.id, msg);
      }
    });
  }

  res.json({
    success: true,
    data: {
      conversation,
      messages: conversationMessages,
      total: conversationMessages.length,
      unreadCount: conversationMessages.filter(msg => 
        userId && !msg.readBy.includes(userId as string)
      ).length
    }
  });
});

// Get user conversations
router.get('/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  const userConversations = Array.from(conversations.values())
    .filter(conv => conv.participants.some(p => p.id === userId))
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    .slice(Number(offset), Number(offset) + Number(limit));

  // Add unread count for each conversation
  const conversationsWithUnread = userConversations.map(conv => {
    const conversationMessages = Array.from(messages.values())
      .filter(msg => msg.conversationId === conv.id);
    
    const unreadCount = conversationMessages.filter(msg => 
      !msg.readBy.includes(userId) && msg.fromId !== userId
    ).length;

    return {
      ...conv,
      unreadCount
    };
  });

  res.json({
    success: true,
    data: {
      conversations: conversationsWithUnread,
      total: conversationsWithUnread.length
    }
  });
});

// Mark messages as read
router.post('/mark-read', (req, res) => {
  const { messageIds, userId } = req.body;

  if (!Array.isArray(messageIds) || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request data'
    });
  }

  let markedCount = 0;
  messageIds.forEach(messageId => {
    const message = messages.get(messageId);
    if (message && !message.readBy.includes(userId)) {
      message.readBy.push(userId);
      messages.set(messageId, message);
      markedCount++;
    }
  });

  res.json({
    success: true,
    data: {
      markedAsRead: markedCount,
      messageIds
    }
  });
});

// Send system message (for order updates)
router.post('/system-message', (req, res) => {
  const { orderId, content, data } = req.body;

  const messageId = `msg_sys_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const conversationId = `conv_${orderId}`;

  const message = {
    id: messageId,
    conversationId,
    orderId,
    fromId: 'system',
    fromType: 'system',
    toId: 'all',
    toType: 'all',
    content,
    messageType: 'system',
    timestamp: new Date().toISOString(),
    status: 'sent',
    readBy: [],
    data
  };

  messages.set(messageId, message);

  // Update conversation
  const conversation = conversations.get(conversationId);
  if (conversation) {
    conversation.lastMessageAt = message.timestamp;
    conversation.messageCount = (conversation.messageCount || 0) + 1;
    conversation.lastMessage = {
      id: messageId,
      content: message.content,
      fromType: 'system',
      timestamp: message.timestamp
    };
    conversations.set(conversationId, conversation);
  }

  res.json({
    success: true,
    data: {
      messageId,
      message: 'System message sent'
    }
  });
});

// Get user notifications
router.get('/notifications/:userId', (req, res) => {
  const { userId } = req.params;
  const { unreadOnly = false, limit = 50 } = req.query;

  const userNotifications = notifications.get(userId) || [];
  
  let filteredNotifications = userNotifications;
  if (unreadOnly === 'true') {
    filteredNotifications = userNotifications.filter(n => !n.read);
  }

  filteredNotifications = filteredNotifications
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Number(limit));

  res.json({
    success: true,
    data: {
      notifications: filteredNotifications,
      total: filteredNotifications.length,
      unreadCount: userNotifications.filter(n => !n.read).length
    }
  });
});

// Mark notifications as read
router.post('/notifications/mark-read', (req, res) => {
  const { userId, notificationIds } = req.body;

  const userNotifications = notifications.get(userId) || [];
  let markedCount = 0;

  userNotifications.forEach(notification => {
    if (notificationIds.includes(notification.id) && !notification.read) {
      notification.read = true;
      notification.readAt = new Date().toISOString();
      markedCount++;
    }
  });

  notifications.set(userId, userNotifications);

  res.json({
    success: true,
    data: {
      markedAsRead: markedCount
    }
  });
});

// Get messaging analytics
router.get('/analytics', (req, res) => {
  const allMessages = Array.from(messages.values());
  const allConversations = Array.from(conversations.values());

  const analytics = {
    totalMessages: allMessages.length,
    totalConversations: allConversations.length,
    messagesByType: {},
    averageMessagesPerConversation: allConversations.length > 0 ? 
      allMessages.length / allConversations.length : 0,
    activeConversations: allConversations.filter(conv => {
      const lastMessage = new Date(conv.lastMessageAt);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return lastMessage > dayAgo;
    }).length,
    responseTime: {
      average: '2.5 hours', // Would calculate from actual data
      median: '1.2 hours'
    }
  };

  // Count by message type
  allMessages.forEach(msg => {
    analytics.messagesByType[msg.messageType] = 
      (analytics.messagesByType[msg.messageType] || 0) + 1;
  });

  res.json({
    success: true,
    data: analytics
  });
});

export default router;