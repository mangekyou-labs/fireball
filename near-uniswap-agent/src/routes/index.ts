import { Router } from 'express';
import dexscreenerRoutes from './dexscreener';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// DexScreener routes
router.use('/', dexscreenerRoutes);

export default router; 