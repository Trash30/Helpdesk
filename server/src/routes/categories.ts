import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const categorySchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  slug: z.string().optional(),
  color: z.string().min(1, 'Couleur requise'),
  icon: z.string().min(1, 'Icône requise'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.array(
  z.object({ id: z.string().uuid(), position: z.number().int().min(0) })
);

// ─── GET /api/categories (auth — active only) ─────────────────────────────────

router.get('/categories', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });
  res.json({ data: categories });
});

// ─── GET /api/admin/categories ────────────────────────────────────────────────

router.get(
  '/admin/categories',
  requirePermission('admin.categories'),
  async (_req: Request, res: Response) => {
    const categories = await prisma.category.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { tickets: true } } },
    });
    res.json({ data: categories });
  }
);

// ─── POST /api/admin/categories ───────────────────────────────────────────────

router.post(
  '/admin/categories',
  requirePermission('admin.categories'),
  async (req: Request, res: Response) => {
    const parse = categorySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const data = parse.data;
    const slug = data.slug ? data.slug : slugify(data.name);

    const maxPos = await prisma.category.aggregate({ _max: { position: true } });
    const position = (maxPos._max.position ?? 0) + 1;

    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug,
        color: data.color,
        icon: data.icon,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        position,
      },
    });

    res.status(201).json({ data: category });
  }
);

// ─── PUT /api/admin/categories/:id ───────────────────────────────────────────

router.put(
  '/admin/categories/:id',
  requirePermission('admin.categories'),
  async (req: Request, res: Response) => {
    const parse = categorySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Catégorie introuvable' });
      return;
    }

    const data = parse.data;
    const slug = data.slug ? data.slug : slugify(data.name);

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { ...data, slug },
    });

    res.json({ data: category });
  }
);

// ─── DELETE /api/admin/categories/:id ────────────────────────────────────────

router.delete(
  '/admin/categories/:id',
  requirePermission('admin.categories'),
  async (req: Request, res: Response) => {
    const existing = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { tickets: { where: { deletedAt: null } } } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Catégorie introuvable' });
      return;
    }

    if (existing._count.tickets > 0) {
      res.status(400).json({
        error: `Impossible de supprimer : ${existing._count.tickets} ticket(s) utilisent cette catégorie`,
        count: existing._count.tickets,
      });
      return;
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ data: { message: 'Catégorie supprimée' } });
  }
);

// ─── PATCH /api/admin/categories/reorder ─────────────────────────────────────

router.patch(
  '/admin/categories/reorder',
  requirePermission('admin.categories'),
  async (req: Request, res: Response) => {
    const parse = reorderSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Format invalide' });
      return;
    }

    await prisma.$transaction(
      parse.data.map(({ id, position }) =>
        prisma.category.update({ where: { id }, data: { position } })
      )
    );

    res.json({ data: { message: 'Ordre mis à jour' } });
  }
);

export default router;
