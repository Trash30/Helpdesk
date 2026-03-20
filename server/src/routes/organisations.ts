import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

const organisationSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.array(
  z.object({ id: z.string().uuid(), position: z.number().int().min(0) })
);

// ─── GET /api/organisations (auth only — active) ─────────────────────────────

router.get('/organisations', async (_req: Request, res: Response) => {
  const organisations = await prisma.clientOrganisation.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
    include: { clubs: true },
  });
  res.json({ data: organisations });
});

// ─── GET /api/admin/organisations ────────────────────────────────────────────

router.get(
  '/admin/organisations',
  requirePermission('admin.clientRoles'),
  async (_req: Request, res: Response) => {
    const organisations = await prisma.clientOrganisation.findMany({
      orderBy: { position: 'asc' },
      include: {
        clubs: true,
        _count: { select: { clients: true } },
      },
    });
    res.json({ data: organisations });
  }
);

// ─── POST /api/admin/organisations ───────────────────────────────────────────

router.post(
  '/admin/organisations',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = organisationSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const maxPosition = await prisma.clientOrganisation.aggregate({ _max: { position: true } });
    const position = (maxPosition._max.position ?? 0) + 1;

    const organisation = await prisma.clientOrganisation.create({
      data: {
        name: parse.data.name,
        isActive: parse.data.isActive ?? true,
        position,
      },
    });

    res.status(201).json({ data: organisation });
  }
);

// ─── PUT /api/admin/organisations/:id ────────────────────────────────────────

router.put(
  '/admin/organisations/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = organisationSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.clientOrganisation.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Organisation introuvable' });
      return;
    }

    const organisation = await prisma.clientOrganisation.update({
      where: { id: req.params.id },
      data: parse.data,
    });

    res.json({ data: organisation });
  }
);

// ─── DELETE /api/admin/organisations/:id ─────────────────────────────────────

router.delete(
  '/admin/organisations/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const existing = await prisma.clientOrganisation.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { clients: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Organisation introuvable' });
      return;
    }

    if (existing._count.clients > 0) {
      res.status(400).json({
        error: `Impossible de supprimer : ${existing._count.clients} client(s) utilisent cette organisation`,
        count: existing._count.clients,
      });
      return;
    }

    await prisma.clientOrganisation.delete({ where: { id: req.params.id } });
    res.json({ data: { message: 'Organisation supprimée' } });
  }
);

// ─── PATCH /api/admin/organisations/reorder ──────────────────────────────────

router.patch(
  '/admin/organisations/reorder',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = reorderSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Format invalide' });
      return;
    }

    await prisma.$transaction(
      parse.data.map(({ id, position }) =>
        prisma.clientOrganisation.update({ where: { id }, data: { position } })
      )
    );

    res.json({ data: { message: 'Ordre mis à jour' } });
  }
);

export default router;
