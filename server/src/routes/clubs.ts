import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

const clubSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  organisationId: z.string().uuid(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.array(
  z.object({ id: z.string().uuid(), position: z.number().int().min(0) })
);

// ─── GET /api/clubs (auth only — active) ─────────────────────────────────────

router.get('/clubs', async (req: Request, res: Response) => {
  const querySchema = z.object({
    organisationId: z.string().optional(),
  });

  const parse = querySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }

  const where: any = { isActive: true };
  if (parse.data.organisationId) where.organisationId = parse.data.organisationId;

  const clubs = await prisma.clientClub.findMany({
    where,
    orderBy: { position: 'asc' },
  });
  res.json({ data: clubs });
});

// ─── GET /api/admin/clubs ────────────────────────────────────────────────────

router.get(
  '/admin/clubs',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const querySchema = z.object({
      organisationId: z.string().optional(),
    });

    const parse = querySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Paramètres invalides' });
      return;
    }

    const where: any = {};
    if (parse.data.organisationId) where.organisationId = parse.data.organisationId;

    const clubs = await prisma.clientClub.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        organisation: true,
        _count: { select: { clients: true } },
      },
    });
    res.json({ data: clubs });
  }
);

// ─── POST /api/admin/clubs ───────────────────────────────────────────────────

router.post(
  '/admin/clubs',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = clubSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const maxPosition = await prisma.clientClub.aggregate({ _max: { position: true } });
    const position = (maxPosition._max.position ?? 0) + 1;

    const club = await prisma.clientClub.create({
      data: {
        name: parse.data.name,
        organisationId: parse.data.organisationId,
        isActive: parse.data.isActive ?? true,
        position,
      },
    });

    res.status(201).json({ data: club });
  }
);

// ─── PUT /api/admin/clubs/:id ────────────────────────────────────────────────

router.put(
  '/admin/clubs/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = clubSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.clientClub.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Club introuvable' });
      return;
    }

    const club = await prisma.clientClub.update({
      where: { id: req.params.id },
      data: parse.data,
    });

    res.json({ data: club });
  }
);

// ─── DELETE /api/admin/clubs/:id ─────────────────────────────────────────────

router.delete(
  '/admin/clubs/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const existing = await prisma.clientClub.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { clients: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Club introuvable' });
      return;
    }

    if (existing._count.clients > 0) {
      res.status(400).json({
        error: `Impossible de supprimer : ${existing._count.clients} client(s) utilisent ce club`,
        count: existing._count.clients,
      });
      return;
    }

    await prisma.clientClub.delete({ where: { id: req.params.id } });
    res.json({ data: { message: 'Club supprimé' } });
  }
);

// ─── PATCH /api/admin/clubs/reorder ──────────────────────────────────────────

router.patch(
  '/admin/clubs/reorder',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = reorderSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Format invalide' });
      return;
    }

    await prisma.$transaction(
      parse.data.map(({ id, position }) =>
        prisma.clientClub.update({ where: { id }, data: { position } })
      )
    );

    res.json({ data: { message: 'Ordre mis à jour' } });
  }
);

export default router;
