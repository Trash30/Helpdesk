import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Priority, Status } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission, hasPermission } from '../middleware/permissions';
import { generateTicketNumber } from '../utils/ticketNumber';

const router = Router();

/** Fields to return for user relations — excludes password & sensitive data */
const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  isActive: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// All ticket routes require authentication
router.use(authMiddleware);

const createTicketSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional().default(''),
  clientId: z.string().min(1, 'Client requis'),
  categoryId: z.string().uuid().optional().nullable(),
  priority: z.nativeEnum(Priority).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  typeId: z.string().uuid().optional().nullable(),
  poleId: z.string().uuid().optional().nullable(),
});

const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  priority: z.nativeEnum(Priority).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  typeId: z.string().uuid().optional().nullable(),
  poleId: z.string().uuid().optional().nullable(),
});

// ─── GET /api/tickets ─────────────────────────────────────────────────────────

router.get(
  '/tickets',
  requirePermission('tickets.view'),
  async (req: Request, res: Response) => {
    const querySchema = z.object({
      status: z.union([z.string(), z.array(z.string())]).optional(),
      priority: z.union([z.string(), z.array(z.string())]).optional(),
      categoryId: z.string().optional(),
      assignedToId: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      search: z.string().optional(),
      organisationId: z.string().optional(),
      clubId: z.string().optional(),
      typeId: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    });

    const parse = querySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Paramètres invalides' });
      return;
    }

    const { status, priority, categoryId, assignedToId, dateFrom, dateTo, search, organisationId, clubId, typeId, page, limit } =
      parse.data;

    const where: any = { deletedAt: null };

    // Non-viewAll agents see only their assigned tickets
    if (!hasPermission(req.user!, 'tickets.viewAll')) {
      where.assignedToId = req.user!.id;
    } else if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      where.status = { in: statuses as Status[] };
    }

    if (priority) {
      const priorities = Array.isArray(priority) ? priority : [priority];
      where.priority = { in: priorities as Priority[] };
    }

    if (categoryId) where.categoryId = categoryId;
    if (organisationId) where.client = { ...where.client, organisationId };
    if (clubId) where.client = { ...where.client, clubId };
    if (typeId) where.typeId = typeId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        {
          client: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { include: { role: true, organisation: true, club: true } },
        pole: true,
          assignedTo: { select: userSelect },
          category: true,
          createdBy: { select: userSelect },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({
      data: tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }
);

// ─── POST /api/tickets ────────────────────────────────────────────────────────

router.post(
  '/tickets',
  requirePermission('tickets.create'),
  async (req: Request, res: Response) => {
    const parse = createTicketSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { title, description, clientId, categoryId, priority, assignedToId, typeId, poleId } = parse.data;

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      res.status(400).json({ error: 'Client introuvable' });
      return;
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title,
        description,
        clientId,
        categoryId: categoryId ?? null,
        priority: priority ?? 'MEDIUM',
        assignedToId: assignedToId ?? null,
        poleId: poleId ?? null,
        createdById: req.user!.id,
      },
      include: {
        client: { include: { role: true, organisation: true, club: true } },
        pole: true,
        assignedTo: { select: userSelect },
        category: true,
        createdBy: { select: userSelect },
      },
    });

    await prisma.activityLog.create({
      data: {
        ticketId: ticket.id,
        userId: req.user!.id,
        action: 'Ticket créé',
      },
    });

    res.status(201).json({ data: ticket });
  }
);

// ─── GET /api/tickets/:id ─────────────────────────────────────────────────────

router.get(
  '/tickets/:id',
  requirePermission('tickets.view'),
  async (req: Request, res: Response) => {
    const ticket = await prisma.ticket.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        client: { include: { role: true, organisation: true, club: true } },
        pole: true,
        assignedTo: { select: userSelect },
        category: true,
        createdBy: { select: userSelect },
        comments: {
          include: {
            author: { select: userSelect },
            attachments: {
              include: { uploadedBy: { select: userSelect } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          where: { commentId: null },
          include: { uploadedBy: { select: userSelect } },
          orderBy: { createdAt: 'asc' },
        },
        activityLogs: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: 'Ticket introuvable' });
      return;
    }

    res.json({ data: ticket });
  }
);

// ─── PUT /api/tickets/:id ─────────────────────────────────────────────────────

router.put(
  '/tickets/:id',
  requirePermission('tickets.edit'),
  async (req: Request, res: Response) => {
    const parse = updateTicketSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: 'Ticket introuvable' });
      return;
    }

    const updates = parse.data;
    const activityEntries: Array<{
      ticketId: string;
      userId: string;
      action: string;
      oldValue?: string;
      newValue?: string;
    }> = [];

    const fieldLabels: Record<string, string> = {
      title: 'Titre',
      description: 'Description',
      categoryId: 'Catégorie',
      priority: 'Priorité',
      assignedToId: 'Assigné',
      poleId: 'Pôle',
    };

    for (const [key, newVal] of Object.entries(updates)) {
      const oldVal = (existing as any)[key];
      if (oldVal !== newVal) {
        activityEntries.push({
          ticketId: existing.id,
          userId: req.user!.id,
          action: `${fieldLabels[key] ?? key} modifié`,
          oldValue: String(oldVal ?? ''),
          newValue: String(newVal ?? ''),
        });
      }
    }

    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: updates,
      include: {
        client: { include: { role: true, organisation: true, club: true } },
        pole: true,
        assignedTo: { select: userSelect },
        category: true,
        createdBy: { select: userSelect },
      },
    });

    if (activityEntries.length > 0) {
      await prisma.activityLog.createMany({ data: activityEntries });
    }

    res.json({ data: ticket });
  }
);

// ─── PATCH /api/tickets/:id/status ───────────────────────────────────────────

router.patch(
  '/tickets/:id/status',
  async (req: Request, res: Response) => {
    // Requires either tickets.edit or tickets.close
    if (
      !hasPermission(req.user!, 'tickets.edit') &&
      !hasPermission(req.user!, 'tickets.close')
    ) {
      res.status(403).json({ error: 'Permission refusée' });
      return;
    }

    const schema = z.object({
      status: z.nativeEnum(Status),
      closingNote: z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Statut invalide' });
      return;
    }

    const existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: 'Ticket introuvable' });
      return;
    }

    const { status, closingNote } = parse.data;

    // Closing note is mandatory when transitioning to CLOSED
    if (status === 'CLOSED' && (!closingNote || !closingNote.trim())) {
      res.status(400).json({ error: 'Une note de fermeture est obligatoire' });
      return;
    }

    const extra: any = {};
    if (status === 'CLOSED') {
      if (!existing.resolvedAt) extra.resolvedAt = new Date();
      extra.closedAt = new Date();
    }

    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { status, ...extra },
      include: { client: true, assignedTo: { select: userSelect }, category: true },
    });

    // Create internal comment with closing note when closing
    if (status === 'CLOSED' && closingNote) {
      await prisma.comment.create({
        data: {
          ticketId: existing.id,
          authorId: req.user!.id,
          content: closingNote.trim(),
          isInternal: true,
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        ticketId: existing.id,
        userId: req.user!.id,
        action: `Statut changé : ${existing.status} → ${status}`,
        oldValue: existing.status,
        newValue: status,
      },
    });

    res.json({ data: ticket });
  }
);

// ─── PATCH /api/tickets/:id/assign ───────────────────────────────────────────

router.patch(
  '/tickets/:id/assign',
  requirePermission('tickets.assign'),
  async (req: Request, res: Response) => {
    const schema = z.object({
      assignedToId: z.string().uuid().nullable(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Paramètre invalide' });
      return;
    }

    const existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: 'Ticket introuvable' });
      return;
    }

    const { assignedToId } = parse.data;
    let agentName = 'Personne';

    if (assignedToId) {
      const agent = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!agent) {
        res.status(400).json({ error: 'Agent introuvable' });
        return;
      }
      agentName = `${agent.firstName} ${agent.lastName}`;
    }

    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { assignedToId },
      include: { client: true, assignedTo: { select: userSelect }, category: true },
    });

    const action = assignedToId ? `Assigné à : ${agentName}` : 'Désassigné';
    await prisma.activityLog.create({
      data: {
        ticketId: existing.id,
        userId: req.user!.id,
        action,
        oldValue: existing.assignedToId ?? undefined,
        newValue: assignedToId ?? undefined,
      },
    });

    res.json({ data: ticket });
  }
);

// ─── DELETE /api/tickets/:id ──────────────────────────────────────────────────

router.delete(
  '/tickets/:id',
  requirePermission('tickets.delete'),
  async (req: Request, res: Response) => {
    const existing = await prisma.ticket.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: 'Ticket introuvable' });
      return;
    }

    // Soft delete
    await prisma.ticket.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ data: { message: 'Ticket supprimé' } });
  }
);

export default router;
