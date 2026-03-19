import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

const clientRoleSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  color: z.string().min(1, 'Couleur requise'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.array(
  z.object({ id: z.string().uuid(), position: z.number().int().min(0) })
);

// ─── GET /api/client-roles (auth only — active) ───────────────────────────────

router.get('/client-roles', async (req: Request, res: Response) => {
  const roles = await prisma.clientRole.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });
  res.json({ data: roles });
});

// ─── GET /api/admin/client-roles ─────────────────────────────────────────────

router.get(
  '/admin/client-roles',
  requirePermission('admin.clientRoles'),
  async (_req: Request, res: Response) => {
    const roles = await prisma.clientRole.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { clients: true } } },
    });
    res.json({ data: roles });
  }
);

// ─── POST /api/admin/client-roles ────────────────────────────────────────────

router.post(
  '/admin/client-roles',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = clientRoleSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const maxPosition = await prisma.clientRole.aggregate({ _max: { position: true } });
    const position = (maxPosition._max.position ?? 0) + 1;

    const role = await prisma.clientRole.create({
      data: {
        name: parse.data.name,
        color: parse.data.color,
        description: parse.data.description ?? null,
        isActive: parse.data.isActive ?? true,
        position,
      },
    });

    res.status(201).json({ data: role });
  }
);

// ─── PUT /api/admin/client-roles/:id ─────────────────────────────────────────

router.put(
  '/admin/client-roles/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = clientRoleSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.clientRole.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Rôle client introuvable' });
      return;
    }

    const role = await prisma.clientRole.update({
      where: { id: req.params.id },
      data: parse.data,
    });

    res.json({ data: role });
  }
);

// ─── DELETE /api/admin/client-roles/:id ──────────────────────────────────────

router.delete(
  '/admin/client-roles/:id',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const existing = await prisma.clientRole.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { clients: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Rôle client introuvable' });
      return;
    }

    if (existing._count.clients > 0) {
      res.status(400).json({
        error: `Impossible de supprimer : ${existing._count.clients} client(s) utilisent ce rôle`,
        count: existing._count.clients,
      });
      return;
    }

    await prisma.clientRole.delete({ where: { id: req.params.id } });
    res.json({ data: { message: 'Rôle client supprimé' } });
  }
);

// ─── PATCH /api/admin/client-roles/reorder ───────────────────────────────────

router.patch(
  '/admin/client-roles/reorder',
  requirePermission('admin.clientRoles'),
  async (req: Request, res: Response) => {
    const parse = reorderSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Format invalide' });
      return;
    }

    await prisma.$transaction(
      parse.data.map(({ id, position }) =>
        prisma.clientRole.update({ where: { id }, data: { position } })
      )
    );

    res.json({ data: { message: 'Ordre mis à jour' } });
  }
);

export default router;
