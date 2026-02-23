import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import {
  getProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  getUserProfile,
  getNearbyUsers,
} from '../controllers/profile.controller';

const router = Router();

// Get user profile
router.get('/', authenticate, getProfile);

// Update profile
router.put(
  '/',
  authenticate,
  [
    body('bio').optional().isString().isLength({ max: 500 }),
    body('city').optional().isString(),
    body('segment').optional().isIn(['relationship', 'fun']),
    body('lookingFor').optional().isArray(),
    body('interests').optional().isArray(),
    body('location.latitude').optional().isFloat({ min: -90, max: 90 }),
    body('location.longitude').optional().isFloat({ min: -180, max: 180 }),
  ],
  updateProfile
);

// Upload photo (supports single or multiple files, max 6 total)
router.post('/photos', authenticate, upload.array('photos', 6), uploadPhoto);
// router.post('/photos', authenticate, upload.fields([
//   { name: 'photo', maxCount: 1 },
//   { name: 'photos', maxCount: 6 }
// ]), uploadPhoto);

// Delete photo
router.delete('/photos/:photoId', authenticate, deletePhoto);

// Get nearby users for discovery/feed
router.get(
  '/discover',
  authenticate,
  [
    query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  ],
  getNearbyUsers
);

// Get another user's profile
router.get('/:userId', authenticate, getUserProfile);

export default router;
