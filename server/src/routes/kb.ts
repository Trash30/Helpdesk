import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { KbStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { kbImageUpload } from '../utils/upload';
import path from 'path';

const router = Router();

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

router.use(authMiddleware);

// ─── GET /api/kb ──────────────────────────────────────────────────────────────
router.get(
  '/kb',
  requirePermission('kb.read'),
  async (req: Request, res: Response) => {
    const querySchema = z.object({
      search: z.string().optional(),
      categoryId: z.string().optional(),
      status: z.nativeEnum(KbStatus).optional(),
      tag: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });

    const parse = querySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Paramètres invalides' });
      return;
    }

    const { search, categoryId, status, tag, page, limit } = parse.data;

    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (tag) where.tags = { has: tag };

    const [articles, total] = await Promise.all([
      prisma.kbArticle.findMany({
        where,
        include: {
          category: true,
          author: { select: userSelect },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.kbArticle.count({ where }),
    ]);

    res.json({ data: articles, total, page, totalPages: Math.ceil(total / limit) });
  }
);

// ─── GET /api/kb/:id ──────────────────────────────────────────────────────────
router.get(
  '/kb/:id',
  requirePermission('kb.read'),
  async (req: Request, res: Response) => {
    const article = await prisma.kbArticle.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        category: true,
        author: { select: userSelect },
        sourceTicket: { select: { id: true, ticketNumber: true, title: true } },
        attachments: true,
      },
    });

    if (!article) {
      res.status(404).json({ error: 'Article introuvable' });
      return;
    }

    res.json({ data: article });
  }
);

// ─── POST /api/kb ─────────────────────────────────────────────────────────────
router.post(
  '/kb',
  requirePermission('kb.write'),
  async (req: Request, res: Response) => {
    const schema = z.object({
      title: z.string().min(1, 'Le titre est requis'),
      content: z.string().default(''),
      categoryId: z.string().uuid().optional().nullable(),
      tags: z.array(z.string()).default([]),
      status: z.nativeEnum(KbStatus).default('DRAFT'),
      sourceTicketId: z.string().uuid().optional().nullable(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { title, content, categoryId, tags, status, sourceTicketId } = parse.data;

    const article = await prisma.kbArticle.create({
      data: {
        title,
        content,
        categoryId: categoryId ?? null,
        tags,
        status,
        sourceTicketId: sourceTicketId ?? null,
        authorId: req.user!.id,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
      include: {
        category: true,
        author: { select: userSelect },
      },
    });

    res.status(201).json({ data: article });
  }
);

// ─── PUT /api/kb/:id ──────────────────────────────────────────────────────────
router.put(
  '/kb/:id',
  requirePermission('kb.write'),
  async (req: Request, res: Response) => {
    const schema = z.object({
      title: z.string().min(1).optional(),
      content: z.string().optional(),
      categoryId: z.string().uuid().optional().nullable(),
      tags: z.array(z.string()).optional(),
      status: z.nativeEnum(KbStatus).optional(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.kbArticle.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: 'Article introuvable' });
      return;
    }

    const updates = parse.data;
    const publishedAt =
      updates.status === 'PUBLISHED' && existing.status !== 'PUBLISHED'
        ? new Date()
        : existing.publishedAt;

    const article = await prisma.kbArticle.update({
      where: { id: req.params.id },
      data: { ...updates, publishedAt },
      include: {
        category: true,
        author: { select: userSelect },
      },
    });

    res.json({ data: article });
  }
);

// ─── DELETE /api/kb/:id ───────────────────────────────────────────────────────
router.delete(
  '/kb/:id',
  requirePermission('kb.write'),
  async (req: Request, res: Response) => {
    const existing = await prisma.kbArticle.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ error: 'Article introuvable' });
      return;
    }

    await prisma.kbArticle.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ data: { message: 'Article supprimé' } });
  }
);

// ─── POST /api/kb/:id/images ──────────────────────────────────────────────────
// Upload d'une image inline pour l'éditeur TipTap
router.post(
  '/kb/:id/images',
  requirePermission('kb.write'),
  kbImageUpload.single('file'),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Fichier requis' });
      return;
    }

    const article = await prisma.kbArticle.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!article) {
      res.status(404).json({ error: 'Article introuvable' });
      return;
    }

    const attachment = await prisma.kbAttachment.create({
      data: {
        articleId: article.id,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        uploadedById: req.user!.id,
      },
    });

    // Retourne l'URL publique pour insertion dans le contenu TipTap
    const url = `/uploads/kb/${file.filename}`;
    res.status(201).json({ data: { url, attachmentId: attachment.id } });
  }
);

export default router;
