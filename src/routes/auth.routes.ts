import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import {
  requestOTP,
  verifyOTP,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  deleteAccount,
} from '../controllers/auth.controller';

const router = Router();

// Request OTP (Continue with Email/Phone)
router.post(
  '/request-otp',
  [
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('phone').optional().isMobilePhone('any').withMessage('Invalid phone'),
  ],
  requestOTP
);

// Verify OTP
router.post(
  '/verify-otp',
  [
    body('email').optional().isEmail(),
    body('phone').optional(),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ],
  verifyOTP
);

// // Login (after OTP verification)
router.post('/login', [body('email').optional().isEmail(), body('phone').optional()], login);

// Logout
router.post('/logout', authenticate, logout);

// Get current user
router.get('/me', authenticate, getCurrentUser);

// Refresh token
router.post('/refresh', refreshToken);

router.delete('/account', authenticate, deleteAccount);

export default router;
