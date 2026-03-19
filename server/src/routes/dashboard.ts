import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  // Current month boundaries
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    openTickets,
    inProgressTickets,
    resolvedToday,
    allResponses,
    currentMonthResponses,
    lastMonthResponses,
    priorityCounts,
    categoryData,
    agentData,
    recentActivity,
  ] = await Promise.all([
    prisma.ticket.count({ where: { status: 'OPEN', deletedAt: null } }),
    prisma.ticket.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
    prisma.ticket.count({
      where: { resolvedAt: { gte: todayStart, lt: todayEnd }, deletedAt: null },
    }),
    prisma.surveyResponse.findMany({ select: { vocScore: true } }),
    prisma.surveyResponse.findMany({
      where: { createdAt: { gte: currentMonthStart } },
      select: { vocScore: true },
    }),
    prisma.surveyResponse.findMany({
      where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } },
      select: { vocScore: true },
    }),
    prisma.ticket.groupBy({
      by: ['priority'],
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] }, deletedAt: null },
      _count: { priority: true },
    }),
    prisma.ticket.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null },
      _count: { categoryId: true },
    }),
    prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: { assignedToId: { not: null }, deletedAt: null },
      _count: { assignedToId: true },
      orderBy: { _count: { assignedToId: 'desc' } },
      take: 10,
    }),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
        ticket: { select: { ticketNumber: true } },
      },
    }),
  ]);

  // CSAT computation helper
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
  const vsLastMonth = current.score - last.score;

  // Priority map
  const priorityMap: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const row of priorityCounts) {
    priorityMap[row.priority] = row._count.priority;
  }

  // Category data with names
  const categoryIds = categoryData
    .map((r) => r.categoryId)
    .filter(Boolean) as string[];

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const ticketsByCategory = categoryData
    .filter((r) => r.categoryId)
    .map((r) => ({
      name: catMap.get(r.categoryId!)?.name ?? 'Inconnue',
      color: catMap.get(r.categoryId!)?.color ?? '#888',
      count: r._count.categoryId,
    }));

  // Agent data with names
  const agentIds = agentData
    .map((r) => r.assignedToId)
    .filter(Boolean) as string[];

  const agents = await prisma.user.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const ticketsByAgent = agentData
    .filter((r) => r.assignedToId)
    .map((r) => ({
      agentName: agentMap.get(r.assignedToId!)
        ? `${agentMap.get(r.assignedToId!)!.firstName} ${agentMap.get(r.assignedToId!)!.lastName}`
        : 'Inconnu',
      count: r._count.assignedToId,
    }));

  res.json({
    data: {
      openTickets,
      inProgressTickets,
      resolvedToday,
      csatGlobal: { ...global, vsLastMonth: Math.round(vsLastMonth * 10) / 10 },
      ticketsByPriority: priorityMap,
      ticketsByCategory,
      ticketsByAgent,
      recentActivity,
    },
  });
});

// ─── GET /api/dashboard/trends ───────────────────────────────────────────────

router.get('/trends', async (_req: Request, res: Response) => {
  const days = 30;
  const now = new Date();

  // Generate last 30 days as dates
  const dateRange: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dateRange.push(d.toISOString().split('T')[0]);
  }

  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: startDate }, deletedAt: null },
    select: { createdAt: true },
  });

  // Count per day
  const countMap = new Map<string, number>();
  for (const t of tickets) {
    const day = t.createdAt.toISOString().split('T')[0];
    countMap.set(day, (countMap.get(day) ?? 0) + 1);
  }

  const trends = dateRange.map((date) => ({
    date,
    count: countMap.get(date) ?? 0,
  }));

  res.json({ data: trends });
});

export default router;
