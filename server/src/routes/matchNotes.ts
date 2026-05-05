import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { hasPermission, requirePermission } from '../middleware/permissions';
import axios from 'axios';
import { promises as dns } from 'dns';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ─── Zod validation ─────────────────────────────────────────────────────────

const matchNoteBodySchema = z.object({
  content: z.string(),
  matchDate: z.string().min(1).refine((v) => !isNaN(Date.parse(v)), {
    message: 'matchDate doit être une date ISO valide',
  }),
  competition: z.string().min(1, 'competition est requis'),
  homeTeam: z.string().min(1, 'homeTeam est requis'),
  awayTeam: z.string().min(1, 'awayTeam est requis'),
  matchTime: z.string().default(''),
  venue: z.string().optional(),
  homeTeamLogo: z.string().optional(),
  awayTeamLogo: z.string().optional(),
  broadcasterLogo: z.string().url().optional(),
  status: z.enum(['VERT', 'ORANGE', 'ROUGE']).optional(),
});

// ─── GET /api/sports/match-notes/proxy-image ────────────────────────────────
// Proxy d'images pour éviter les problèmes CORS lors de la génération du rapport Word

// Plages d'adresses privées/locales interdites (RFC-1918, loopback, link-local)
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivateHost(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(hostname));
}

router.get('/proxy-image', async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) { res.status(400).json({ error: 'url requis' }); return; }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'URL invalide' }); return;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    res.status(400).json({ error: 'Protocole non autorisé' }); return;
  }

  if (isPrivateHost(parsed.hostname)) {
    res.status(403).json({ error: 'Hôte non autorisé' }); return;
  }

  // Pré-résolution DNS pour empêcher le DNS rebinding vers des IPs privées
  try {
    const resolvedIps: string[] = [];
    try {
      const ipv4 = await dns.resolve4(parsed.hostname);
      resolvedIps.push(...ipv4);
    } catch {
      // Pas d'enregistrement A — non bloquant si IPv6 répond
    }
    try {
      const ipv6 = await dns.resolve6(parsed.hostname);
      resolvedIps.push(...ipv6);
    } catch {
      // IPv6 optionnel
    }

    if (resolvedIps.length === 0) {
      res.status(404).json({ error: 'Hôte introuvable' }); return;
    }

    if (resolvedIps.some((ip) => isPrivateHost(ip))) {
      res.status(403).json({ error: 'Hôte non autorisé' }); return;
    }
  } catch {
    res.status(404).json({ error: 'Hôte introuvable' }); return;
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      maxRedirects: 0,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HelpDesk/1.0)' },
    });

    const contentType = (response.headers['content-type'] as string) || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(response.data as ArrayBuffer));
  } catch {
    res.status(404).json({ error: 'Image introuvable' });
  }
});

// ─── GET /api/sports/match-notes ────────────────────────────────────────────
// Récupère toutes les notes (pour charger les notes existantes au chargement du widget)

router.get('/', async (_req: Request, res: Response) => {
  const notes = await prisma.matchNote.findMany({
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { matchDate: 'asc' },
  });

  res.json({ data: notes });
});

// ─── GET /api/sports/match-notes/report/week ────────────────────────────────
// Retourne toutes les notes de la semaine courante triées chronologiquement

router.get('/report/week', async (_req: Request, res: Response) => {
  const now = new Date();

  // Calcul du lundi (début de semaine ISO)
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Calcul du numéro de semaine ISO
  const janFirst = new Date(now.getFullYear(), 0, 1);
  const janFirstDay = janFirst.getDay() || 7; // 1=Mon ... 7=Sun
  const firstThursday = new Date(janFirst);
  firstThursday.setDate(janFirst.getDate() + (4 - janFirstDay));
  const startOfIsoYear = new Date(firstThursday);
  startOfIsoYear.setDate(firstThursday.getDate() - 3); // Monday of week 1

  const diffMs = startOfWeek.getTime() - startOfIsoYear.getTime();
  const weekNumber = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  const notes = await prisma.matchNote.findMany({
    where: {
      matchDate: {
        gte: startOfWeek,
        lte: endOfWeek,
      },
    },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ competition: 'asc' }, { matchDate: 'asc' }, { matchTime: 'asc' }],
  });

  res.json({
    data: {
      weekNumber,
      year: now.getFullYear(),
      startOfWeek: startOfWeek.toISOString(),
      endOfWeek: endOfWeek.toISOString(),
      notes,
    },
  });
});

// ─── PUT /api/sports/match-notes/:matchKey ──────────────────────────────────
// Crée ou met à jour la note d'un match (upsert) — nécessite tickets.create

router.put('/:matchKey', requirePermission('tickets.create'), async (req: Request, res: Response) => {
  const matchKey = decodeURIComponent(req.params.matchKey);

  const parsed = matchNoteBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { content, matchDate, competition, homeTeam, awayTeam, matchTime, venue, homeTeamLogo, awayTeamLogo, broadcasterLogo, status } = parsed.data;

  const note = await prisma.matchNote.upsert({
    where: { matchKey },
    update: {
      content,
      broadcasterLogo: broadcasterLogo || null,
      status: status ?? 'VERT',
      updatedAt: new Date(),
    },
    create: {
      matchKey,
      content,
      matchDate: new Date(matchDate),
      competition,
      homeTeam,
      awayTeam,
      matchTime,
      venue: venue || null,
      homeTeamLogo: homeTeamLogo || null,
      awayTeamLogo: awayTeamLogo || null,
      broadcasterLogo: broadcasterLogo || null,
      status: status ?? 'VERT',
      authorId: req.user!.id,
    },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  res.json({ data: note });
});

// ─── DELETE /api/sports/match-notes/:matchKey ───────────────────────────────
// Supprime la note d'un match (admin uniquement)

router.delete('/:matchKey', async (req: Request, res: Response) => {
  if (!hasPermission(req.user!, 'admin.access')) {
    res.status(403).json({ error: 'Permission refusée' });
    return;
  }

  const matchKey = decodeURIComponent(req.params.matchKey);

  const existing = await prisma.matchNote.findUnique({
    where: { matchKey },
  });

  if (!existing) {
    res.status(404).json({ error: 'Note introuvable' });
    return;
  }

  await prisma.matchNote.delete({ where: { matchKey } });

  res.json({ data: { success: true } });
});

export default router;
