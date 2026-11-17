import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { fetchAllMatches, clearCache } from '../services/sportsScraper';
import { SEASON_CALENDAR } from '../data/seasonCalendar';

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

// ─── GET /api/sports/season-calendar ────────────────────────────────────────
// Vue annuelle (projection) — instantané statique, indépendant du scraper hebdomadaire.

router.get('/season-calendar', (_req: Request, res: Response) => {
  res.json({ data: SEASON_CALENDAR });
});

// ─── POST /api/sports/refresh ────────────────────────────────────────────────

// Accessible aux utilisateurs pouvant éditer les matchs OU préparer les groupes WhatsApp
const canRefresh = (req: Request, res: Response, next: NextFunction) => {
  const perms = req.user?.permissions ?? [];
  if (perms.includes('sports.edit') || perms.includes('whatsapp.groups')) return next();
  res.status(403).json({ error: 'Permission refusée' });
};

router.post('/refresh', canRefresh, async (_req: Request, res: Response) => {
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
