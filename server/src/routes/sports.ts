import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { fetchAllMatches, clearCache } from '../services/sportsScraper';

const router = Router();

router.use(authMiddleware);

// ─── GET /api/sports/matches ────────────────────────────────────────────────

router.get('/matches', async (_req: Request, res: Response) => {
  try {
    const result = await fetchAllMatches();
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Sports Route]', message);
    }
    res.status(500).json({ error: 'Impossible de recuperer les matchs sportifs' });
  }
});

// ─── POST /api/sports/refresh ────────────────────────────────────────────────

router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    clearCache();
    const result = await fetchAllMatches();
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Sports Route]', message);
    }
    res.status(500).json({ error: 'Impossible de rafraîchir les matchs sportifs' });
  }
});

export default router;
