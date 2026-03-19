import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

const publicRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Trop de requêtes, veuillez réessayer dans une minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ─── GET /api/survey/:token ───────────────────────────────────────────────────

router.get('/survey/:token', publicRateLimit, async (req: Request, res: Response) => {
  const send = await prisma.surveySend.findUnique({
    where: { token: req.params.token },
    include: {
      ticket: true,
      response: true,
    },
  });

  if (!send) {
    res.status(404).json({ error: 'invalid' });
    return;
  }

  if (send.response) {
    res.status(410).json({ error: 'already_answered' });
    return;
  }

  if (Date.now() - send.createdAt.getTime() > THIRTY_DAYS_MS) {
    res.status(410).json({ error: 'expired' });
    return;
  }

  const template = await prisma.surveyTemplate.findFirst({
    where: { isActive: true },
  });

  const settings = await prisma.settings.findMany({
    where: { key: { in: ['company_name', 'logo_url'] } },
  });
  const settingsMap: Record<string, string> = {};
  for (const s of settings) settingsMap[s.key] = s.value;

  res.json({
    data: {
      ticket: {
        ticketNumber: send.ticket.ticketNumber,
        title: send.ticket.title,
      },
      questions: template?.questions ?? [],
      companyName: settingsMap['company_name'] ?? 'HelpDesk',
      logoUrl: settingsMap['logo_url'] ?? null,
    },
  });
});

// ─── POST /api/survey/:token/respond ─────────────────────────────────────────

router.post('/survey/:token/respond', publicRateLimit, async (req: Request, res: Response) => {
  const send = await prisma.surveySend.findUnique({
    where: { token: req.params.token },
    include: { response: true },
  });

  if (!send) {
    res.status(404).json({ error: 'Lien invalide' });
    return;
  }

  if (send.response) {
    res.status(410).json({ error: 'Vous avez déjà répondu à cette enquête' });
    return;
  }

  if (Date.now() - send.createdAt.getTime() > THIRTY_DAYS_MS) {
    res.status(410).json({ error: 'Ce lien a expiré' });
    return;
  }

  const schema = z.object({
    answers: z.array(
      z.object({
        questionId: z.string().min(1),
        value: z.any(),
      })
    ),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Format de réponse invalide' });
    return;
  }

  const { answers } = parse.data;

  // Fetch template to identify question types
  const template = await prisma.surveyTemplate.findFirst({ where: { isActive: true } });
  const questions = (template?.questions as any[]) ?? [];

  // Extract npsScore and vocScore
  let npsScore: number | null = null;
  let vocScore: number | null = null;

  for (const answer of answers) {
    const question = questions.find((q: any) => q.id === answer.questionId);
    if (!question) continue;

    if (question.type === 'nps' && answer.value !== null && answer.value !== undefined) {
      npsScore = parseInt(String(answer.value), 10);
    }
    if (question.type === 'csat' && answer.value !== null && answer.value !== undefined) {
      vocScore = parseFloat(String(answer.value));
    }
  }

  await prisma.surveyResponse.create({
    data: {
      surveySendId: send.id,
      ticketId: send.ticketId,
      clientEmail: send.clientEmail,
      answers: answers as any,
      npsScore,
      vocScore,
    },
  });

  res.json({ data: { message: 'Merci pour votre réponse' } });
});

// ─── GET /api/admin/surveys/csat-live ────────────────────────────────────────

router.get(
  '/admin/surveys/csat-live',
  authMiddleware,
  requirePermission('surveys.view'),
  async (_req: Request, res: Response) => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [allResponses, currentMonthResponses, lastMonthResponses] = await Promise.all([
      prisma.surveyResponse.findMany({ select: { vocScore: true } }),
      prisma.surveyResponse.findMany({
        where: { createdAt: { gte: currentMonthStart } },
        select: { vocScore: true },
      }),
      prisma.surveyResponse.findMany({
        where: { createdAt: { gte: lastMonthStart, lt: currentMonthStart } },
        select: { vocScore: true },
      }),
    ]);

    function computeCsat(responses: { vocScore: number | null }[]) {
      const scored = responses.filter((r) => r.vocScore !== null);
      const satisfied = scored.filter((r) => r.vocScore! >= 4).length;
      const neutral = scored.filter((r) => r.vocScore! === 3).length;
      const unsatisfied = scored.filter((r) => r.vocScore! <= 2).length;
      const total = scored.length;
      const score = total > 0 ? (satisfied / total) * 100 : 0;
      return { score, satisfied, neutral, unsatisfied, total };
    }

    const global = computeCsat(allResponses);
    const current = computeCsat(currentMonthResponses);
    const last = computeCsat(lastMonthResponses);
    const vsLastMonth = Math.round((current.score - last.score) * 10) / 10;

    res.json({ data: { ...global, vsLastMonth } });
  }
);

// ─── GET /api/admin/surveys/results ──────────────────────────────────────────

router.get(
  '/admin/surveys/results',
  authMiddleware,
  requirePermission('surveys.view'),
  async (req: Request, res: Response) => {
    const querySchema = z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    });

    const parse = querySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Paramètres invalides' });
      return;
    }

    const { dateFrom, dateTo, page, limit } = parse.data;
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const responseWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [allResponses, filteredResponses, npsFiltered, totalFiltered] = await Promise.all([
      prisma.surveyResponse.findMany({ select: { vocScore: true } }),
      prisma.surveyResponse.findMany({ where: responseWhere, select: { vocScore: true } }),
      prisma.surveyResponse.findMany({
        where: responseWhere,
        select: { npsScore: true },
      }),
      prisma.surveyResponse.count({ where: responseWhere }),
    ]);

    function computeCsat(responses: { vocScore: number | null }[]) {
      const scored = responses.filter((r) => r.vocScore !== null);
      const satisfied = scored.filter((r) => r.vocScore! >= 4).length;
      const neutral = scored.filter((r) => r.vocScore! === 3).length;
      const unsatisfied = scored.filter((r) => r.vocScore! <= 2).length;
      const total = scored.length;
      const score = total > 0 ? (satisfied / total) * 100 : 0;
      return { score, satisfied, neutral, unsatisfied, total };
    }

    const csatGlobal = computeCsat(allResponses);
    const csatFiltered = computeCsat(filteredResponses);

    // NPS calculation
    const npsScored = npsFiltered.filter((r) => r.npsScore !== null);
    const promoters = npsScored.filter((r) => r.npsScore! >= 9).length;
    const passives = npsScored.filter((r) => r.npsScore! >= 7 && r.npsScore! <= 8).length;
    const detractors = npsScored.filter((r) => r.npsScore! <= 6).length;
    const npsTotal = npsScored.length;
    const npsScore =
      npsTotal > 0
        ? Math.round(((promoters - detractors) / npsTotal) * 100)
        : null;

    // NPS per week (last 12 weeks)
    const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);
    const weeklyNps = await prisma.surveyResponse.findMany({
      where: { createdAt: { gte: twelveWeeksAgo }, npsScore: { not: null } },
      select: { npsScore: true, createdAt: true },
    });

    const weekMap = new Map<string, number[]>();
    for (const r of weeklyNps) {
      const weekStart = new Date(r.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().split('T')[0];
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(r.npsScore!);
    }

    const npsPerWeek = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, scores]) => {
        const p = scores.filter((s) => s >= 9).length;
        const d = scores.filter((s) => s <= 6).length;
        const score = Math.round(((p - d) / scores.length) * 100);
        return { week, score };
      });

    // Paginated responses
    const skip = (page - 1) * limit;
    const responses = await prisma.surveyResponse.findMany({
      where: responseWhere,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        surveySend: {
          include: { ticket: { select: { ticketNumber: true, title: true } } },
        },
      },
    });

    res.json({
      data: {
        csatGlobal,
        csatFiltered,
        npsScore,
        npsBreakdown: { promoters, passives, detractors },
        npsPerWeek,
        responses,
        total: totalFiltered,
        page,
        totalPages: Math.ceil(totalFiltered / limit),
      },
    });
  }
);

// ─── GET /api/admin/surveys/sends ────────────────────────────────────────────

router.get(
  '/admin/surveys/sends',
  authMiddleware,
  requirePermission('surveys.view'),
  async (req: Request, res: Response) => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    });

    const parse = querySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Paramètres invalides' });
      return;
    }

    const { page, limit } = parse.data;
    const skip = (page - 1) * limit;

    const [sends, total] = await Promise.all([
      prisma.surveySend.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ticket: { select: { ticketNumber: true, title: true } },
          response: { select: { id: true } },
        },
      }),
      prisma.surveySend.count(),
    ]);

    res.json({ data: sends, total, page, totalPages: Math.ceil(total / limit) });
  }
);

// ─── GET /api/admin/surveys/template ─────────────────────────────────────────

router.get(
  '/admin/surveys/template',
  authMiddleware,
  requirePermission('surveys.view'),
  async (_req: Request, res: Response) => {
    const template = await prisma.surveyTemplate.findFirst({
      where: { isActive: true },
    });
    res.json({ data: template });
  }
);

// ─── PUT /api/admin/surveys/template ─────────────────────────────────────────

router.put(
  '/admin/surveys/template',
  authMiddleware,
  requirePermission('surveys.configure'),
  async (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      questions: z.array(
        z.object({
          id: z.string().min(1),
          type: z.string().min(1),
          label: z.string().min(1),
          required: z.boolean(),
          order: z.number().int().min(1),
          helpText: z.string().optional(),
          config: z.record(z.any()).optional(),
          options: z.array(z.string()).optional(),
        })
      ),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    // Deactivate all existing templates
    await prisma.surveyTemplate.updateMany({ data: { isActive: false } });

    // Create new active version
    const template = await prisma.surveyTemplate.create({
      data: {
        name: parse.data.name ?? 'Modèle enquête',
        isActive: true,
        questions: parse.data.questions as any,
      },
    });

    res.json({ data: template });
  }
);

export default router;
