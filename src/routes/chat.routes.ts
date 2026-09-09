import { Router } from 'express';
import { body } from 'express-validator';
import { MAX_MESSAGE_LENGTH, MESSAGE_TYPES } from '../models/Message';
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
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Message content is required')
      .isLength({ max: MAX_MESSAGE_LENGTH })
      .withMessage(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`),
    body('messageType').optional().isIn(MESSAGE_TYPES).withMessage('Invalid message type'),
  ],
  sendMessage
);

// Delete a message
router.delete('/:recipientId/:messageId', authenticate, deleteMessage);

export default router;
