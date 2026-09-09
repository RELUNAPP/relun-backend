import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { registerPushToken, deletePushToken } from '../controllers/notification.controller';

const router = Router();

// Register this device for push notifications
router.post('/token', authenticate, registerPushToken);

// Stop pushing to this device (called on logout)
router.delete('/token', authenticate, deletePushToken);

export default router;
