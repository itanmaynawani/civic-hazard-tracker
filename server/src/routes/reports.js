import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  createReport,
  getReports,
  getNearby,
  upvoteReport,
  resolveReport,
} from '../controllers/reportController.js';

const router = Router();

// Stricter limit on anything that writes data, to keep crowdsourced input clean
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.get('/', getReports);
router.get('/nearby', getNearby);
router.post('/', writeLimiter, createReport);
router.patch('/:id/upvote', writeLimiter, upvoteReport);
router.patch('/:id/resolve', writeLimiter, resolveReport);

export default router;