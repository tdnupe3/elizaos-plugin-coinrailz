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

// Using database storage for production persistence
import { storage } from "../storage";

// Create new chat room
router.post('/chat/create', async (req, res) => {
  try {
    console.log('Create chat request:', req.body);

    const chatData = createChatSchema.parse(req.body);
    const chatId = `chat_${nanoid()}`;
    const currentUserId = (req.user as any)?.id || 'guest_user';

    const chatRoomData = {
      chatId: chatId,
      participants: [currentUserId, ...chatData.participantIds],
      orderId: chatData.orderId || null,
      chatName: chatData.chatName || `Chat ${chatId.slice(-6)}`,
      lastMessage: null,
      isActive: true
    };

    const newChat = await storage.createChatRoom(chatRoomData);

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
router.post('/send', async (req, res) => {
  try {
    console.log('Send message request:', req.body);

    const messageData = messageSchema.parse(req.body);
    const messageId = `msg_${nanoid()}`;
    const senderId = (req.user as any)?.id || 'guest_user';

    // Find or create chat room using database
    let userChats = await storage.getChatRooms(senderId);
    let chatRoom = userChats.find((chat: any) => 
      JSON.stringify(chat.participants).includes(messageData.recipientId)
    );

    if (!chatRoom) {
      // Create new chat room automatically
      const chatId = `chat_${nanoid()}`;
      const chatRoomData = {
        chatId: chatId,
        participants: [senderId, messageData.recipientId],
        orderId: messageData.orderId || null,
        chatName: `Chat ${chatId.slice(-6)}`,
        lastMessage: null,
        isActive: true
      };
      chatRoom = await storage.createChatRoom(chatRoomData);
    }

    const messageDataForDB = {
      messageId: messageId,
      chatId: chatRoom.chatId,
      senderId: senderId,
      recipientId: messageData.recipientId,
      content: messageData.content,
      messageType: messageData.messageType,
      fileUrl: messageData.fileUrl || null,
      orderId: messageData.orderId || null,
      isRead: false,
      isDelivered: true
    };

    const newMessage = await storage.createMessage(messageDataForDB);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      messageId: messageId,
      chatId: chatRoom.chatId,
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
router.get('/chats', async (req, res) => {
  try {
    const userId = (req.user as any)?.id || 'guest_user';
    
    const userChats = await storage.getChatRooms(userId);

    res.json({
      success: true,
      chats: userChats.map((chat: any) => ({
        id: chat.chatId,
        chatId: chat.chatId,
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
router.get('/chat/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = (req.user as any)?.id || 'guest_user';

    // Check if user is participant in this chat
    const chatRoom = (await storage.getChatRooms(userId)).find(chat =>
      chat.chatId === chatId &&
      Array.isArray(chat.participants) &&
      chat.participants.includes(userId)
    );

    if (!chatRoom) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this chat'
      });
    }

    const messages = (await storage.getMessages(chatId))
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      success: true,
      messages: messages,
      chatInfo: {
        id: chatRoom.chatId,
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
    const userId = (req.user as unknown as { id?: string } | undefined)?.id || 'guest_user';

    let updatedCount = 0;

    const messages = await storage.getMessages(chatId);
    await Promise.all(messages
      .filter((message: any) => message.recipientId === userId && !message.isRead)
      .map(async (message: any) => {
        await storage.markMessageAsRead(message.messageId);
        updatedCount++;
      }));

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
    const userId = (req.user as unknown as { id?: string } | undefined)?.id || 'guest_user';
    const chats = await storage.getChatRooms(userId);
    const messages = (await Promise.all(chats.map(chat => storage.getMessages(chat.chatId)))).flat();

    const unreadCount = messages.filter((message: any) =>
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
    const userId = (req.user as unknown as { id?: string } | undefined)?.id || 'guest_user';

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const chats = await storage.getChatRooms(userId);
    const messages = (await Promise.all(chats.map(chat => storage.getMessages(chat.chatId)))).flat();
    const userChats = chats.map(chat => chat.chatId);

    let filteredMessages = messages.filter((message: any) =>
      userChats.includes(message.chatId) &&
      message.content.toLowerCase().includes((query as string).toLowerCase())
    );

    if (chatId) {
      filteredMessages = filteredMessages.filter((message: any) =>
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