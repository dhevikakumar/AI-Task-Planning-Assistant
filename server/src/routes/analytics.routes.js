import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAnalyticsOverview } from '../services/analytics.service.js';

const router = Router();

router.use(authenticate);

router.get('/overview', async (req, res) => {
  try {
    return res.json(await getAnalyticsOverview(req.user.id));
  } catch (error) {
    console.error('Analytics overview error:', error);
    return res.status(500).json({ message: 'Unable to load analytics.' });
  }
});

export default router;
