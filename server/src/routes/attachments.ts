import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { attachmentUpload, getUploadsPath } from '../utils/upload';

const router = Router();

router.use(authMiddleware);

// ─── POST /api/tickets/:id/attachments ───────────────────────────────────────

router.post(
  '/tickets/:id/attachments',
  requirePermission('tickets.edit'),
  attachmentUpload.array('files', 5),
  async (req: Request, res: Response) => {
    const ticket = await prisma.ticket.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!ticket) {
      res.status(404).json({ error: 'Ticket introuvable' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Aucun fichier fourni' });
      return;
    }

    const created = await prisma.$transaction(
      files.map((file) =>
        prisma.attachment.create({
          data: {
            ticketId: ticket.id,
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            uploadedById: req.user!.id,
          },
          include: { uploadedBy: true },
        })
      )
    );

    res.status(201).json({ data: created });
  }
);

// ─── GET /api/attachments/:id/download ───────────────────────────────────────

router.get(
  '/attachments/:id/download',
  requirePermission('tickets.view'),
  async (req: Request, res: Response) => {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
    });
    if (!attachment) {
      res.status(404).json({ error: 'Pièce jointe introuvable' });
      return;
    }

    const uploadsRoot = getUploadsPath();
    const filePath = path.isAbsolute(attachment.path)
      ? attachment.path
      : path.join(uploadsRoot, attachment.path);

    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(uploadsRoot))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'Fichier introuvable sur le disque' });
      return;
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
    );
    res.setHeader('Content-Type', attachment.mimetype);
    res.sendFile(resolvedPath);
  }
);

// ─── DELETE /api/attachments/:id ─────────────────────────────────────────────

router.delete(
  '/attachments/:id',
  requirePermission('tickets.edit'),
  async (req: Request, res: Response) => {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
    });
    if (!attachment) {
      res.status(404).json({ error: 'Pièce jointe introuvable' });
      return;
    }

    // Delete from disk
    const filePath = path.isAbsolute(attachment.path)
      ? attachment.path
      : path.join(getUploadsPath(), attachment.path);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.attachment.delete({ where: { id: req.params.id } });

    res.json({ data: { message: 'Pièce jointe supprimée' } });
  }
);

export default router;
