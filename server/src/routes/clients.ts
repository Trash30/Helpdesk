import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

const clientSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  roleId: z.string().uuid().optional().nullable(),
  organisationId: z.string().uuid().optional().nullable(),
  clubId: z.string().uuid().optional().nullable(),
  poleId: z.string().uuid().optional().nullable(),
  isSurveyable: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// ─── GET /api/clients ─────────────────────────────────────────────────────────

router.get(
  '/clients',
  requirePermission('clients.view'),
  async (req: Request, res: Response) => {
    const querySchema = z.object({
      search: z.string().optional(),
      roleId: z.string().optional(),
      organisationId: z.string().optional(),
      clubId: z.string().optional(),
      hasOpenTickets: z.coerce.boolean().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    });

    const parse = querySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Paramètres invalides' });
      return;
    }

    const { search, roleId, organisationId, clubId, hasOpenTickets, page, limit } = parse.data;

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (roleId) where.roleId = roleId;
    if (organisationId) where.organisationId = organisationId;
    if (clubId) where.clubId = clubId;

    if (hasOpenTickets) {
      where.tickets = {
        some: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] }, deletedAt: null },
      };
    }

    const skip = (page - 1) * limit;
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          role: true,
          organisation: true,
          club: true,
          pole: true,
          _count: { select: { tickets: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({ data: clients, total, page, totalPages: Math.ceil(total / limit) });
  }
);

// ─── POST /api/clients ────────────────────────────────────────────────────────

router.post(
  '/clients',
  requirePermission('clients.create'),
  async (req: Request, res: Response) => {
    const parse = clientSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const data = parse.data;

    if (!data.phone && !data.email) {
      res.status(400).json({ error: 'Un téléphone ou un email est requis' });
      return;
    }

    const client = await prisma.client.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        company: data.company ?? null,
        roleId: data.roleId ?? null,
        organisationId: data.organisationId ?? null,
        clubId: data.clubId ?? null,
        poleId: data.poleId ?? null,
        isSurveyable: data.isSurveyable ?? true,
        notes: data.notes ?? null,
      },
      include: { role: true, organisation: true, club: true, pole: true },
    });

    res.status(201).json({ data: client });
  }
);

// ─── GET /api/clients/:id ─────────────────────────────────────────────────────

router.get(
  '/clients/:id',
  requirePermission('clients.view'),
  async (req: Request, res: Response) => {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        role: true,
        organisation: true,
        club: true,
        pole: true,
        tickets: {
          where: { deletedAt: null },
          include: { category: true, assignedTo: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { tickets: true } },
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Client introuvable' });
      return;
    }

    // Compute stats
    const allTickets = client.tickets;
    const openTickets = allTickets.filter((t) =>
      ['OPEN', 'IN_PROGRESS', 'PENDING'].includes(t.status)
    ).length;
    const resolvedTickets = allTickets.filter((t) => t.status === 'CLOSED').length;

    const resolvedWithTime = allTickets.filter((t) => t.resolvedAt && t.createdAt);
    const avgResolutionHours =
      resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, t) => {
            const ms = t.resolvedAt!.getTime() - t.createdAt.getTime();
            return sum + ms / 3600000;
          }, 0) / resolvedWithTime.length
        : null;

    res.json({
      data: {
        ...client,
        stats: {
          total: allTickets.length,
          openTickets,
          resolvedTickets,
          avgResolutionHours: avgResolutionHours ? Math.round(avgResolutionHours) : null,
        },
      },
    });
  }
);

// ─── PUT /api/clients/:id ─────────────────────────────────────────────────────

router.put(
  '/clients/:id',
  requirePermission('clients.edit'),
  async (req: Request, res: Response) => {
    const parse = clientSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const data = parse.data;

    if (!data.phone && !data.email) {
      res.status(400).json({ error: 'Un téléphone ou un email est requis' });
      return;
    }

    const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Client introuvable' });
      return;
    }

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        company: data.company ?? null,
        roleId: data.roleId ?? null,
        organisationId: data.organisationId ?? null,
        clubId: data.clubId ?? null,
        poleId: data.poleId ?? null,
        isSurveyable: data.isSurveyable ?? existing.isSurveyable,
        notes: data.notes ?? null,
      },
      include: { role: true, organisation: true, club: true, pole: true },
    });

    res.json({ data: client });
  }
);

// ─── DELETE /api/clients/:id ──────────────────────────────────────────────────

router.delete(
  '/clients/:id',
  requirePermission('clients.delete'),
  async (req: Request, res: Response) => {
    const existing = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            tickets: {
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Client introuvable' });
      return;
    }

    const openCount = existing._count.tickets;
    if (openCount > 0) {
      res.status(400).json({
        error: `Impossible de supprimer ce client : ${openCount} ticket(s) en cours`,
        count: openCount,
      });
      return;
    }

    await prisma.client.delete({ where: { id: req.params.id } });
    res.json({ data: { message: 'Client supprimé' } });
  }
);

export default router;
