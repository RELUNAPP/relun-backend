import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.utils';
import { Message, getConversationId } from '../models/Message';
import { User } from '../models/User';
import {
  SocketSendMessageData,
  SocketTypingData,
  SocketMarkReadData,
  SocketNewMessageEvent,
  SocketUserTypingEvent,
  SocketMessagesReadEvent,
} from '../types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export const initializeSocketIO = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = verifyToken(token);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('[User connected]====>>', socket.userId);

    // Update user's online status
    if (socket.userId) {
      User.findByIdAndUpdate(socket.userId, { lastActive: new Date() }).catch(console.error);
    }

    // Join user's room
    socket.join(`user:${socket.userId}`);

    // Join conversation room
    socket.on('join_conversation', async (recipientId: string) => {
      try {
        if (socket.userId) {
          const conversationId = getConversationId(socket.userId, recipientId);
          socket.join(`conversation:${conversationId}`);
          console.log(`User ${socket.userId} joined conversation ${conversationId}`);
        }
      } catch (error) {
        console.error('Join conversation error:', error);
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (recipientId: string) => {
      if (socket.userId) {
        const conversationId = getConversationId(socket.userId, recipientId);
        socket.leave(`conversation:${conversationId}`);
        console.log(`User ${socket.userId} left conversation ${conversationId}`);
      }
    });

    // Send message
    socket.on('send_message', async (data: SocketSendMessageData) => {
      try {
        const { recipientId, content, messageType = 'text' } = data;

        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Verify recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          socket.emit('error', { message: 'Recipient not found' });
          return;
        }

        const conversationId = getConversationId(socket.userId, recipientId);

        // Create message
        const message = await Message.create({
          conversationId,
          senderId: socket.userId,
          receiverId: recipientId,
          content,
          messageType,
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'fullName')
          .populate('receiverId', 'fullName');

        // Emit to conversation room
        const newMessageEvent: SocketNewMessageEvent = {
          conversationId,
          message: populatedMessage as any,
        };
        io.to(`conversation:${conversationId}`).emit('new_message', newMessageEvent);

        // Emit to receiver's room for notification
        io.to(`user:${recipientId}`).emit('message_notification', newMessageEvent);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', async (data: SocketTypingData) => {
      try {
        const { recipientId, isTyping } = data;

        if (socket.userId) {
          const conversationId = getConversationId(socket.userId, recipientId);
          const typingEvent: SocketUserTypingEvent = {
            userId: socket.userId,
            isTyping,
          };
          socket.to(`conversation:${conversationId}`).emit('user_typing', typingEvent);
        }
      } catch (error) {
        console.error('Typing error:', error);
      }
    });

    // Mark messages as read
    socket.on('mark_read', async (data: SocketMarkReadData) => {
      try {
        const { recipientId } = data;

        if (socket.userId) {
          const conversationId = getConversationId(socket.userId, recipientId);

          await Message.updateMany(
            { conversationId, receiverId: socket.userId, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
          );

          // Notify sender
          const readEvent: SocketMessagesReadEvent = {
            conversationId,
            readBy: socket.userId,
          };
          socket.to(`conversation:${conversationId}`).emit('messages_read', readEvent);
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.userId);

      // Update last active
      if (socket.userId) {
        await User.findByIdAndUpdate(socket.userId, { lastActive: new Date() }).catch(
          console.error
        );
      }
    });
  });
};
