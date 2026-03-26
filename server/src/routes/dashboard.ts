import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { hasPermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const staleCutoff = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  // Current month boundaries
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  // For non-admin agents, scope all stats to their own tickets
  const isViewAll = hasPermission(req.user!, 'tickets.viewAll');
  const agentScope = isViewAll ? {} : { assignedToId: req.user!.id };

  const staleWhere = {
    status: { in: ['OPEN', 'IN_PROGRESS'] as ('OPEN' | 'IN_PROGRESS')[] },
    updatedAt: { lt: staleCutoff },
    deletedAt: null,
    ...agentScope,
  };

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
    staleTickets,
    myStaleTickets,
  ] = await Promise.all([
    prisma.ticket.count({ where: { status: 'OPEN', deletedAt: null, ...agentScope } }),
    prisma.ticket.count({ where: { status: 'IN_PROGRESS', deletedAt: null, ...agentScope } }),
    prisma.ticket.count({
      where: { resolvedAt: { gte: todayStart, lt: todayEnd }, deletedAt: null, ...agentScope },
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
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] }, deletedAt: null, ...agentScope },
      _count: { priority: true },
    }),
    prisma.ticket.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null, ...agentScope },
      _count: { categoryId: true },
    }),
    prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: { assignedToId: { not: null }, deletedAt: null, ...agentScope },
      _count: { assignedToId: true },
      orderBy: { _count: { assignedToId: 'desc' } },
      take: 10,
    }),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: isViewAll ? {} : { ticket: { assignedToId: req.user!.id } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        ticket: { select: { ticketNumber: true } },
      },
    }),
    // Stale tickets scoped to agent
    prisma.ticket.count({ where: staleWhere }),
    // myStaleTickets only meaningful for non-admin (same as staleTickets when scoped)
    !isViewAll ? Promise.resolve(null) : Promise.resolve(null),
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

  // ─── Club & Organisation breakdowns (admin/supervisor only) ───────────────
  const isAdmin = hasPermission(req.user!, 'tickets.viewAll');
  let ticketsByClub: {
    clubId: string;
    clubName: string;
    total: number;
    open: number;
    inProgress: number;
    pending: number;
    closed: number;
  }[] | undefined;
  let ticketsByOrganisation: {
    organisationId: string;
    organisationName: string;
    total: number;
    open: number;
    inProgress: number;
    pending: number;
    closed: number;
  }[] | undefined;

  if (isAdmin) {
    const ticketsWithClub = await prisma.ticket.findMany({
      where: { deletedAt: null },
      select: {
        status: true,
        client: {
          select: {
            clubId: true,
            club: {
              select: {
                id: true,
                name: true,
                organisationId: true,
                organisation: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Aggregate by club
    const clubMap = new Map<string, {
      clubName: string;
      total: number;
      open: number;
      inProgress: number;
      pending: number;
      closed: number;
    }>();

    // Aggregate by organisation
    const orgMap = new Map<string, {
      organisationName: string;
      total: number;
      open: number;
      inProgress: number;
      pending: number;
      closed: number;
    }>();

    for (const t of ticketsWithClub) {
      const club = t.client.club;
      if (club) {
        const entry = clubMap.get(club.id) ?? {
          clubName: club.name,
          total: 0, open: 0, inProgress: 0, pending: 0, closed: 0,
        };
        entry.total++;
        if (t.status === 'OPEN') entry.open++;
        else if (t.status === 'IN_PROGRESS') entry.inProgress++;
        else if (t.status === 'PENDING') entry.pending++;
        else if (t.status === 'CLOSED') entry.closed++;
        clubMap.set(club.id, entry);

        // Organisation via club
        const org = club.organisation;
        const orgEntry = orgMap.get(org.id) ?? {
          organisationName: org.name,
          total: 0, open: 0, inProgress: 0, pending: 0, closed: 0,
        };
        orgEntry.total++;
        if (t.status === 'OPEN') orgEntry.open++;
        else if (t.status === 'IN_PROGRESS') orgEntry.inProgress++;
        else if (t.status === 'PENDING') orgEntry.pending++;
        else if (t.status === 'CLOSED') orgEntry.closed++;
        orgMap.set(org.id, orgEntry);
      }
    }

    ticketsByClub = Array.from(clubMap.entries())
      .map(([clubId, data]) => ({ clubId, ...data }))
      .sort((a, b) => b.total - a.total);

    ticketsByOrganisation = Array.from(orgMap.entries())
      .map(([organisationId, data]) => ({ organisationId, ...data }))
      .sort((a, b) => b.total - a.total);
  }

  res.json({
    data: {
      openTickets,
      inProgressTickets,
      resolvedToday,
      staleTickets,
      ...(!isViewAll ? { myStaleTickets: staleTickets } : {}),
      csatGlobal: { ...global, vsLastMonth: Math.round(vsLastMonth * 10) / 10 },
      ticketsByPriority: priorityMap,
      ticketsByCategory,
      ticketsByAgent,
      recentActivity,
      ...(ticketsByClub ? { ticketsByClub } : {}),
      ...(ticketsByOrganisation ? { ticketsByOrganisation } : {}),
    },
  });
});

// ─── GET /api/dashboard/trends ───────────────────────────────────────────────

router.get('/trends', async (req: Request, res: Response) => {
  const days = 30;
  const now = new Date();

  // Generate last 30 days as dates
  const dateRange: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dateRange.push(d.toISOString().split('T')[0]);
  }

  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const agentScope = hasPermission(req.user!, 'tickets.viewAll') ? {} : { assignedToId: req.user!.id };

  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: startDate }, deletedAt: null, ...agentScope },
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
