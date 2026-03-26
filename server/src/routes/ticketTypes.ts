import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

const ticketTypeSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.array(
  z.object({ id: z.string().uuid(), position: z.number().int().min(0) })
);

// ─── GET /api/ticket-types (auth only — active) ─────────────────────────────

router.get('/ticket-types', async (_req: Request, res: Response) => {
  const types = await prisma.ticketType.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });
  res.json({ data: types });
});

// ─── GET /api/admin/ticket-types ─────────────────────────────────────────────

router.get(
  '/admin/ticket-types',
  requirePermission('admin.clientRoles'),
  async (_req: Request, res: Response) => {
    const types = await prisma.ticketType.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { tickets: true } } },
    });
    res.json({ data: types });
  }
);

// ─── POST /api/admin/ticket-types ────────────────────────────────────────────

router.post(
  '/admin/ticket-types',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = ticketTypeSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const maxPosition = await prisma.ticketType.aggregate({ _max: { position: true } });
    const position = (maxPosition._max.position ?? 0) + 1;

    const type = await prisma.ticketType.create({
      data: {
        name: parse.data.name,
        isActive: parse.data.isActive ?? true,
        position,
      },
    });

    res.status(201).json({ data: type });
  }
);

// ─── PUT /api/admin/ticket-types/:id ─────────────────────────────────────────

router.put(
  '/admin/ticket-types/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = ticketTypeSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.ticketType.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Type de demande introuvable' });
      return;
    }

    const type = await prisma.ticketType.update({
      where: { id: req.params.id },
      data: parse.data,
    });

    res.json({ data: type });
  }
);

// ─── DELETE /api/admin/ticket-types/:id ──────────────────────────────────────

router.delete(
  '/admin/ticket-types/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const existing = await prisma.ticketType.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { tickets: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Type de demande introuvable' });
      return;
    }

    if (existing._count.tickets > 0) {
      res.status(400).json({
        error: `Impossible de supprimer : ${existing._count.tickets} ticket(s) utilisent ce type`,
        count: existing._count.tickets,
      });
      return;
    }

    await prisma.ticketType.delete({ where: { id: req.params.id } });
    res.json({ data: { message: 'Type de demande supprimé' } });
  }
);

// ─── PATCH /api/admin/ticket-types/reorder ───────────────────────────────────

router.patch(
  '/admin/ticket-types/reorder',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = reorderSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Format invalide' });
      return;
    }

    await prisma.$transaction(
      parse.data.map(({ id, position }) =>
        prisma.ticketType.update({ where: { id }, data: { position } })
      )
    );

    res.json({ data: { message: 'Ordre mis à jour' } });
  }
);

export default router;
