import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission, hasPermission } from '../middleware/permissions';
import { attachmentUpload } from '../utils/upload';

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
  attachmentUpload.array('files', 5),
  async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    const isInternal = req.body.isInternal === 'true' || req.body.isInternal === true;

    // Validate: content non-empty OR at least 1 file
    if (content.length === 0 && files.length === 0) {
      res.status(400).json({ error: 'Le contenu ou au moins un fichier est requis' });
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
        content,
        isInternal,
      },
    });

    // Create attachments linked to both the ticket and the comment
    if (files.length > 0) {
      await prisma.$transaction(
        files.map((file) =>
          prisma.attachment.create({
            data: {
              ticketId: ticket.id,
              commentId: comment.id,
              filename: file.filename,
              originalName: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              path: file.path,
              uploadedById: req.user!.id,
            },
          })
        )
      );
    }

    // Re-fetch comment with all relations
    const fullComment = await prisma.comment.findUnique({
      where: { id: comment.id },
      include: {
        author: { select: userSelect },
        attachments: {
          include: { uploadedBy: { select: userSelect } },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        ticketId: ticket.id,
        userId: req.user!.id,
        action: isInternal ? 'Note interne ajoutée' : 'Commentaire ajouté',
      },
    });

    res.status(201).json({ data: fullComment });
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
