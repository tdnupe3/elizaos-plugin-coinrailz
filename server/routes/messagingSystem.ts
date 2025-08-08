import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const router = Router();

// Message schema
const messageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  recipientId: z.string(),
  orderId: z.string().optional(),
  messageType: z.enum(['text', 'file', 'system']).default('text'),
  fileUrl: z.string().optional()
});

// Chat room schema
const createChatSchema = z.object({
  participantIds: z.array(z.string()),
  orderId: z.string().optional(),
  chatName: z.string().optional()
});

// In-memory storage (replace with database in production)
global.chatRooms = global.chatRooms || [];
global.messages = global.messages || [];

// Create new chat room
router.post('/api/messaging/chat/create', async (req, res) => {
  try {
    console.log('Create chat request:', req.body);

    const chatData = createChatSchema.parse(req.body);
    const chatId = `chat_${nanoid()}`;
    const currentUserId = req.user?.id || 'guest_user';

    const newChat = {
      id: chatId,
      participants: [currentUserId, ...chatData.participantIds],
      orderId: chatData.orderId || null,
      chatName: chatData.chatName || `Chat ${chatId.slice(-6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessage: null,
      isActive: true
    };

    global.chatRooms.push(newChat);

    res.status(201).json({
      success: true,
      message: 'Chat room created',
      chatId: chatId,
      chat: newChat
    });

  } catch (error) {
    console.error('Create chat error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create chat room'
    });
  }
});

// Send message
router.post('/api/messaging/send', async (req, res) => {
  try {
    console.log('Send message request:', req.body);

    const messageData = messageSchema.parse(req.body);
    const messageId = `msg_${nanoid()}`;
    const senderId = req.user?.id || 'guest_user';

    // Find or create chat room
    let chatRoom = global.chatRooms.find(chat => 
      chat.participants.includes(senderId) && 
      chat.participants.includes(messageData.recipientId)
    );

    if (!chatRoom) {
      // Create new chat room automatically
      const chatId = `chat_${nanoid()}`;
      chatRoom = {
        id: chatId,
        participants: [senderId, messageData.recipientId],
        orderId: messageData.orderId || null,
        chatName: `Chat ${chatId.slice(-6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: null,
        isActive: true
      };
      global.chatRooms.push(chatRoom);
    }

    const newMessage = {
      id: messageId,
      chatId: chatRoom.id,
      senderId: senderId,
      recipientId: messageData.recipientId,
      content: messageData.content,
      messageType: messageData.messageType,
      fileUrl: messageData.fileUrl || null,
      orderId: messageData.orderId || null,
      timestamp: new Date().toISOString(),
      isRead: false,
      isDelivered: true
    };

    global.messages.push(newMessage);

    // Update chat room's last message
    chatRoom.lastMessage = {
      content: messageData.content,
      timestamp: newMessage.timestamp,
      senderId: senderId
    };
    chatRoom.updatedAt = new Date().toISOString();

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      messageId: messageId,
      chatId: chatRoom.id,
      messageData: newMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Get chat rooms for user
router.get('/api/messaging/chats', async (req, res) => {
  try {
    const userId = req.user?.id || 'guest_user';
    const chatRooms = global.chatRooms || [];
    
    const userChats = chatRooms
      .filter(chat => chat.participants.includes(userId))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json({
      success: true,
      chats: userChats.map(chat => ({
        id: chat.id,
        chatName: chat.chatName,
        participants: chat.participants,
        lastMessage: chat.lastMessage,
        updatedAt: chat.updatedAt,
        isActive: chat.isActive,
        orderId: chat.orderId
      }))
    });

  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat rooms'
    });
  }
});

// Get messages for a chat
router.get('/api/messaging/chat/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user?.id || 'guest_user';

    // Check if user is participant in this chat
    const chatRoom = global.chatRooms.find(chat => 
      chat.id === chatId && chat.participants.includes(userId)
    );

    if (!chatRoom) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this chat'
      });
    }

    const messages = global.messages
      .filter(msg => msg.chatId === chatId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      success: true,
      messages: messages,
      chatInfo: {
        id: chatRoom.id,
        chatName: chatRoom.chatName,
        participants: chatRoom.participants,
        orderId: chatRoom.orderId
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Mark messages as read
router.patch('/api/messaging/chat/:chatId/read', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id || 'guest_user';

    const messages = global.messages || [];
    let updatedCount = 0;

    messages.forEach(message => {
      if (message.chatId === chatId && 
          message.recipientId === userId && 
          !message.isRead) {
        message.isRead = true;
        updatedCount++;
      }
    });

    res.json({
      success: true,
      message: `${updatedCount} messages marked as read`
    });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
});

// Get unread message count
router.get('/api/messaging/unread-count', async (req, res) => {
  try {
    const userId = req.user?.id || 'guest_user';
    const messages = global.messages || [];

    const unreadCount = messages.filter(message => 
      message.recipientId === userId && !message.isRead
    ).length;

    res.json({
      success: true,
      unreadCount: unreadCount
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
});

// Search messages
router.get('/api/messaging/search', async (req, res) => {
  try {
    const { query, chatId } = req.query;
    const userId = req.user?.id || 'guest_user';

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const messages = global.messages || [];
    const userChats = global.chatRooms
      .filter(chat => chat.participants.includes(userId))
      .map(chat => chat.id);

    let filteredMessages = messages.filter(message => 
      userChats.includes(message.chatId) &&
      message.content.toLowerCase().includes((query as string).toLowerCase())
    );

    if (chatId) {
      filteredMessages = filteredMessages.filter(message => 
        message.chatId === chatId
      );
    }

    res.json({
      success: true,
      messages: filteredMessages.slice(0, 20), // Limit results
      total: filteredMessages.length
    });

  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages'
    });
  }
});

export default router;