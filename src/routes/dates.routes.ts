import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import {
  browseDates,
  myDates,
  createDate,
  deleteDate,
  requestToJoin,
  respondToRequest,
} from '../controllers/dates.controller';

const router = Router();

router.get('/', authenticate, browseDates);
router.get('/mine', authenticate, myDates);

router.post(
  '/',
  authenticate,
  [
    body('activity').isString().trim().isLength({ min: 2, max: 80 }),
    body('place').isString().trim().isLength({ min: 2, max: 120 }),
    body('scheduledFor').isISO8601().withMessage('scheduledFor must be an ISO date-time'),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  ],
  createDate
);

router.delete('/:dateId', authenticate, deleteDate);
router.post('/:dateId/requests', authenticate, requestToJoin);
router.patch('/:dateId/requests/:requestId', authenticate, respondToRequest);

export default router;
