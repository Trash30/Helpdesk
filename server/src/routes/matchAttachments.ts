import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import multer, { FileFilterCallback } from 'multer';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { hasPermission } from '../middleware/permissions';
import { getUploadsPath } from '../utils/upload';

const router = Router();

// ─── Multer config: PDF only, 10 MB, single file ───────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const matchAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = getUploadsPath('match-attachments');
      ensureDir(dir);
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const uuid = crypto.randomUUID();
      const ext = path.extname(file.originalname) || '.pdf';
      cb(null, `${uuid}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont autoris\u00e9s'));
    }
  },
});

// ─── Zod validation ─────────────────────────────────────────────────────────

const matchAttachmentBodySchema = z.object({
  matchKey: z.string().min(1, 'matchKey est requis'),
  matchDate: z.string().min(1).refine((v) => !isNaN(Date.parse(v)), { message: 'matchDate doit être une date valide' }),
});

// All routes require authentication
router.use(authMiddleware);

// ─── POST /api/sports/match-attachments ─────────────────────────────────────

router.post(
  '/match-attachments',
  matchAttachmentUpload.single('file'),
  async (req: Request, res: Response) => {
    if (!hasPermission(req.user!, 'tickets.create')) {
      res.status(403).json({ error: 'Permission refus\u00e9e' });
      return;
    }

    const parsed = matchAttachmentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Aucun fichier PDF fourni' });
      return;
    }

    const { matchKey, matchDate } = parsed.data;

    // Dédoublonnage : refuser si un fichier avec le même nom existe déjà sur ce match
    const existing = await prisma.matchAttachment.findFirst({
      where: { matchKey, originalName: file.originalname },
    });
    if (existing) {
      fs.unlinkSync(file.path); // supprimer le fichier temporaire uploadé
      res.status(409).json({ error: 'Un fichier avec ce nom existe déjà pour ce match' });
      return;
    }

    const matchAttachment = await prisma.matchAttachment.create({
      data: {
        matchKey,
        matchDate: new Date(matchDate),
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        path: file.path,
        uploadedById: req.user!.id,
      },
    });

    res.status(201).json({ data: matchAttachment });
  }
);

// ─── POST /api/sports/match-attachments/query ────────────────────────────────
// Accepts { matchKeys: string[] } in body to avoid URL length limits with many keys.

router.post(
  '/match-attachments/query',
  async (req: Request, res: Response) => {
    // Tout utilisateur authentifié peut consulter les pièces jointes des matchs

    const schema = z.object({ matchKeys: z.array(z.string().min(1)).min(1).max(200) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'matchKeys (array de strings, max 200) est requis' });
      return;
    }
    const { matchKeys } = parsed.data;

    const attachments = await prisma.matchAttachment.findMany({
      where: { matchKey: { in: matchKeys } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: attachments });
  }
);

// ─── GET /api/sports/match-attachments/:id/download ─────────────────────────

router.get(
  '/match-attachments/:id/download',
  async (req: Request, res: Response) => {
    const attachment = await prisma.matchAttachment.findUnique({
      where: { id: req.params.id },
    });
    if (!attachment) {
      res.status(404).json({ error: 'Pi\u00e8ce jointe introuvable' });
      return;
    }

    const uploadsRoot = getUploadsPath();
    const filePath = path.isAbsolute(attachment.path)
      ? attachment.path
      : path.join(uploadsRoot, attachment.path);

    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(uploadsRoot))) {
      res.status(403).json({ error: 'Acc\u00e8s refus\u00e9' });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'Fichier introuvable sur le disque' });
      return;
    }

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.originalName)}"`
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(resolvedPath);
  }
);

// ─── DELETE /api/sports/match-attachments/:id ───────────────────────────────

router.delete(
  '/match-attachments/:id',
  async (req: Request, res: Response) => {
    if (!hasPermission(req.user!, 'admin.access')) {
      res.status(403).json({ error: 'Permission refus\u00e9e' });
      return;
    }

    const attachment = await prisma.matchAttachment.findUnique({
      where: { id: req.params.id },
    });
    if (!attachment) {
      res.status(404).json({ error: 'Pi\u00e8ce jointe introuvable' });
      return;
    }

    // Delete from disk — path traversal guard
    const filePath = path.isAbsolute(attachment.path)
      ? attachment.path
      : path.join(getUploadsPath(), attachment.path);

    const absolutePath = path.resolve(filePath);
    const uploadsRoot = path.resolve(getUploadsPath());
    if (!absolutePath.startsWith(uploadsRoot + path.sep)) {
      res.status(400).json({ error: 'Chemin invalide' });
      return;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await prisma.matchAttachment.delete({ where: { id: req.params.id } });

    res.json({ data: { message: 'Supprim\u00e9' } });
  }
);

export default router;
