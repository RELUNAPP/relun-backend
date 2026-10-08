import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { blockUser, unblockUser, listBlocks, reportUser } from '../controllers/safety.controller';

const router = Router();

router.get('/blocks', authenticate, listBlocks);
router.post('/blocks/:userId', authenticate, blockUser);
router.delete('/blocks/:userId', authenticate, unblockUser);
router.post('/reports/:userId', authenticate, reportUser);

export default router;
