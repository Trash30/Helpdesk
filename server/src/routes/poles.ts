import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

const poleSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.array(
  z.object({ id: z.string().uuid(), position: z.number().int().min(0) })
);

// ─── GET /api/poles (auth only — active) ─────────────────────────────────────

router.get('/poles', async (_req: Request, res: Response) => {
  const poles = await prisma.clientPole.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });
  res.json({ data: poles });
});

// ─── GET /api/admin/poles ────────────────────────────────────────────────────

router.get(
  '/admin/poles',
  requirePermission('admin.clientRoles'),
  async (_req: Request, res: Response) => {
    const poles = await prisma.clientPole.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { tickets: true } } },
    });
    res.json({ data: poles });
  }
);

// ─── POST /api/admin/poles ───────────────────────────────────────────────────

router.post(
  '/admin/poles',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = poleSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const maxPosition = await prisma.clientPole.aggregate({ _max: { position: true } });
    const position = (maxPosition._max.position ?? 0) + 1;

    const pole = await prisma.clientPole.create({
      data: {
        name: parse.data.name,
        isActive: parse.data.isActive ?? true,
        position,
      },
    });

    res.status(201).json({ data: pole });
  }
);

// ─── PUT /api/admin/poles/:id ────────────────────────────────────────────────

router.put(
  '/admin/poles/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = poleSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.clientPole.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Pôle introuvable' });
      return;
    }

    const pole = await prisma.clientPole.update({
      where: { id: req.params.id },
      data: parse.data,
    });

    res.json({ data: pole });
  }
);

// ─── DELETE /api/admin/poles/:id ─────────────────────────────────────────────

router.delete(
  '/admin/poles/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const existing = await prisma.clientPole.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { tickets: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Pôle introuvable' });
      return;
    }

    if (existing._count.tickets > 0) {
      res.status(400).json({
        error: `Impossible de supprimer : ${existing._count.tickets} ticket(s) utilisent ce pôle`,
        count: existing._count.tickets,
      });
      return;
    }

    await prisma.clientPole.delete({ where: { id: req.params.id } });
    res.json({ data: { message: 'Pôle supprimé' } });
  }
);

// ─── PATCH /api/admin/poles/reorder ──────────────────────────────────────────

router.patch(
  '/admin/poles/reorder',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = reorderSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Format invalide' });
      return;
    }

    await prisma.$transaction(
      parse.data.map(({ id, position }) =>
        prisma.clientPole.update({ where: { id }, data: { position } })
      )
    );

    res.json({ data: { message: 'Ordre mis à jour' } });
  }
);

export default router;
