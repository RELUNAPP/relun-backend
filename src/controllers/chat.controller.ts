import { Response } from 'express';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth.middleware';
import { Message, getConversationId } from '../models/Message';
import { isMatched } from '../models/Like';
import { User } from '../models/User';
import { GetMessagesResponse, SendMessageRequest, UnreadCountResponse } from '../types';

const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipientId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user!.id;

    if (!isValidObjectId(recipientId)) {
      res.status(400).json({ error: 'Invalid recipient id' });
      return;
    }

    if (!(await isMatched(userId, recipientId))) {
      res.status(403).json({ error: 'You can only chat with your matches' });
      return;
    }

    // Generate conversation ID from the two user IDs
    const conversationId = getConversationId(userId, recipientId);

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
      Message.countDocuments({ conversationId }),
    ]);

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

    if (!isValidObjectId(recipientId)) {
      res.status(400).json({ error: 'Invalid recipient id' });
      return;
    }

    // Replaces the old "recipient exists" check: a match implies both users exist.
    if (!(await isMatched(userId, recipientId))) {
      res.status(403).json({ error: 'You can only chat with your matches' });
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

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipientId, messageId } = req.params;
    const userId = req.user!.id;

    if (!isValidObjectId(recipientId) || !isValidObjectId(messageId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const conversationId = getConversationId(userId, recipientId);

    // Scoped to senderId, so a user can only delete their own messages.
    const result = await Message.deleteOne({
      _id: messageId,
      conversationId,
      senderId: userId,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

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
    // Aggregation pipelines are not cast by Mongoose, so the id must be an
    // ObjectId here or every $match and $eq below silently matches nothing.
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get all unique conversations for this user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userObjectId }, { receiverId: userObjectId }],
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
                { $and: [{ $eq: ['$receiverId', userObjectId] }, { $eq: ['$isRead', false] }] },
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

    // Fetch every participant in one query rather than one per conversation.
    const otherUserIds = conversations.map((conv) =>
      conv.lastMessage.senderId.equals(userObjectId)
        ? conv.lastMessage.receiverId
        : conv.lastMessage.senderId
    );

    const users = await User.find({ _id: { $in: otherUserIds } }).select('fullName email');
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    const conversationsWithUsers = conversations.map((conv, index) => ({
      conversationId: conv._id,
      otherUser: usersById.get(otherUserIds[index].toString()) ?? null,
      lastMessage: conv.lastMessage,
      unreadCount: conv.unreadCount,
    }));

    res.json({ conversations: conversationsWithUsers });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
};
