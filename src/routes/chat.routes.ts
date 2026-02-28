import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import {
  getMessages,
  sendMessage,
  deleteMessage,
  getUnreadCount,
  getConversations,
} from '../controllers/chat.controller';

const router = Router();

// Get all conversations for current user
router.get('/', authenticate, getConversations);

// Get unread message count
router.get('/unread/count', authenticate, getUnreadCount);

// Get messages with a specific user
router.get('/:recipientId', authenticate, getMessages);

// Send a message to a user
router.post(
  '/:recipientId',
  authenticate,
  [
    body('content').notEmpty().withMessage('Message content is required'),
    body('messageType')
      .optional()
      .isIn(['text', 'image', 'video', 'audio'])
      .withMessage('Invalid message type'),
  ],
  sendMessage
);

// Delete a message
router.delete('/:recipientId/:messageId', authenticate, deleteMessage);

export default router;
