import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { PERMISSIONS_LIST } from '../config/permissions';

const router = Router();

router.use(authMiddleware);

const roleSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional().nullable(),
  permissions: z.array(z.string()).refine(
    (perms) => perms.every((p) => PERMISSIONS_LIST.includes(p)),
    { message: 'Une ou plusieurs permissions sont invalides' }
  ),
});

// ─── GET /api/admin/roles ─────────────────────────────────────────────────────

router.get(
  '/roles',
  requirePermission('admin.roles'),
  async (_req: Request, res: Response) => {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    res.json({ data: roles });
  }
);

// ─── POST /api/admin/roles ────────────────────────────────────────────────────

router.post(
  '/roles',
  requirePermission('admin.roles'),
  async (req: Request, res: Response) => {
    const parse = roleSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const role = await prisma.role.create({
      data: {
        name: parse.data.name,
        description: parse.data.description ?? null,
        permissions: parse.data.permissions,
        isSystem: false, // cannot set via API
      },
    });

    res.status(201).json({ data: role });
  }
);

// ─── PUT /api/admin/roles/:id ─────────────────────────────────────────────────

router.put(
  '/roles/:id',
  requirePermission('admin.roles'),
  async (req: Request, res: Response) => {
    const existing = await prisma.role.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Rôle introuvable' });
      return;
    }

    // isSystem roles can update permissions but NOT name or isSystem
    const schema = existing.isSystem
      ? roleSchema.pick({ permissions: true }).extend({
          description: z.string().optional().nullable(),
        })
      : roleSchema;

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const permissionsChanged =
      JSON.stringify([...parse.data.permissions].sort()) !==
      JSON.stringify([...existing.permissions].sort());

    const role = await prisma.role.update({
      where: { id: req.params.id },
      data: {
        ...(existing.isSystem ? {} : { name: (parse.data as any).name }),
        description: parse.data.description ?? null,
        permissions: parse.data.permissions,
        // Invalidate all JWT tokens for this role immediately
        ...(permissionsChanged ? { roleUpdatedAt: new Date() } : {}),
      },
    });

    res.json({ data: role });
  }
);

// ─── DELETE /api/admin/roles/:id ──────────────────────────────────────────────

router.delete(
  '/roles/:id',
  requirePermission('admin.roles'),
  async (req: Request, res: Response) => {
    const existing = await prisma.role.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Rôle introuvable' });
      return;
    }

    if (existing.isSystem) {
      res.status(400).json({ error: 'Les rôles système ne peuvent pas être supprimés' });
      return;
    }

    if (existing._count.users > 0) {
      res.status(400).json({
        error: `Impossible de supprimer : ${existing._count.users} agent(s) utilisent ce rôle`,
        count: existing._count.users,
      });
      return;
    }

    await prisma.role.delete({ where: { id: req.params.id } });
    res.json({ data: { message: 'Rôle supprimé' } });
  }
);

// ─── POST /api/admin/roles/:id/duplicate ─────────────────────────────────────

router.post(
  '/roles/:id/duplicate',
  requirePermission('admin.roles'),
  async (req: Request, res: Response) => {
    const existing = await prisma.role.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Rôle introuvable' });
      return;
    }

    const role = await prisma.role.create({
      data: {
        name: `Copie de ${existing.name}`,
        description: existing.description,
        permissions: existing.permissions,
        isSystem: false,
      },
    });

    res.status(201).json({ data: role });
  }
);

export default router;
