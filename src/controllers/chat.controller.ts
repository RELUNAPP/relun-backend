import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth.middleware';
import { Message, getConversationId } from '../models/Message';
import { User } from '../models/User';
import { GetMessagesResponse, SendMessageRequest, UnreadCountResponse } from '../types';

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipientId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user!.id;

    // Generate conversation ID from the two user IDs
    const conversationId = getConversationId(userId, recipientId);

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('senderId', 'fullName')
      .populate('receiverId', 'fullName');

    const total = await Message.countDocuments({ conversationId });

    // Mark messages as read
    await Message.updateMany(
      { conversationId, receiverId: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    const response: GetMessagesResponse = {
      messages: messages.reverse() as any, // Reverse to show oldest first
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { recipientId } = req.params;
    const { content, messageType = 'text' }: SendMessageRequest = req.body;
    const userId = req.user!.id;

    // Verify recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }

    // Generate conversation ID from the two user IDs
    const conversationId = getConversationId(userId, recipientId);

    const message = await Message.create({
      conversationId,
      senderId: userId,
      receiverId: recipientId,
      content,
      messageType,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'fullName')
      .populate('receiverId', 'fullName');

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipientId, messageId } = req.params;
    const userId = req.user!.id;

    const conversationId = getConversationId(userId, recipientId);

    const message = await Message.findOne({
      _id: messageId,
      conversationId,
      senderId: userId,
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await Message.deleteOne({ _id: messageId });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false,
    });

    const response: UnreadCountResponse = { unreadCount };
    res.json(response);
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get all unique conversations for this user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiverId', userId] }, { $eq: ['$isRead', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { 'lastMessage.createdAt': -1 },
      },
    ]);

    // Get the other user details for each conversation
    const conversationsWithUsers = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId =
          conv.lastMessage.senderId.toString() === userId
            ? conv.lastMessage.receiverId
            : conv.lastMessage.senderId;

        const otherUser = await User.findById(otherUserId).select('fullName email');

        return {
          conversationId: conv._id,
          otherUser,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount,
        };
      })
    );

    res.json({ conversations: conversationsWithUsers });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
};
