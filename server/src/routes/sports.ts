import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { fetchAllMatches, clearCache } from '../services/sportsScraper';

const router = Router();

router.use(authMiddleware);

// Cooldown en mémoire pour la route POST /refresh (anti-abuse)
let lastRefreshAt = 0;
const REFRESH_COOLDOWN_MS = 30_000;

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

router.post('/refresh', requirePermission('tickets.create'), async (_req: Request, res: Response) => {
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
    const retryInSec = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastRefreshAt)) / 1000);
    res.status(429).json({ error: `Refresh disponible dans ${retryInSec} secondes` });
    return;
  }
  lastRefreshAt = now;

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
