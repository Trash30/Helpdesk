import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission, hasPermission } from '../middleware/permissions';

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

router.use(authMiddleware);

// ─── POST /api/tickets/:id/comments ──────────────────────────────────────────

router.post(
  '/tickets/:id/comments',
  requirePermission('comments.create'),
  async (req: Request, res: Response) => {
    const schema = z.object({
      content: z.string().min(1, 'Le contenu est requis'),
      isInternal: z.boolean().default(false),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!ticket) {
      res.status(404).json({ error: 'Ticket introuvable' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: req.user!.id,
        content: parse.data.content,
        isInternal: parse.data.isInternal,
      },
      include: { author: { select: userSelect } },
    });

    await prisma.activityLog.create({
      data: {
        ticketId: ticket.id,
        userId: req.user!.id,
        action: parse.data.isInternal ? 'Note interne ajoutée' : 'Commentaire ajouté',
      },
    });

    res.status(201).json({ data: comment });
  }
);

// ─── DELETE /api/comments/:id ─────────────────────────────────────────────────

router.delete(
  '/comments/:id',
  async (req: Request, res: Response) => {
    if (
      !hasPermission(req.user!, 'comments.delete') &&
      !hasPermission(req.user!, 'comments.deleteAny')
    ) {
      res.status(403).json({ error: 'Permission refusée' });
      return;
    }

    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
    });
    if (!comment) {
      res.status(404).json({ error: 'Commentaire introuvable' });
      return;
    }

    // Can only delete own comment unless deleteAny
    if (
      comment.authorId !== req.user!.id &&
      !hasPermission(req.user!, 'comments.deleteAny')
    ) {
      res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres commentaires' });
      return;
    }

    await prisma.comment.delete({ where: { id: req.params.id } });

    await prisma.activityLog.create({
      data: {
        ticketId: comment.ticketId,
        userId: req.user!.id,
        action: 'Commentaire supprimé',
      },
    });

    res.json({ data: { message: 'Commentaire supprimé' } });
  }
);

export default router;
