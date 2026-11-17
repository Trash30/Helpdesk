import { Router, Request, Response } from 'express';
import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { hasPermission, requirePermission } from '../middleware/permissions';

// Archivage des rapports hebdomadaires (CR) générés côté client en .docx.
// Le fichier est stocké en base (BYTEA) : il reste téléchargeable même si les notes changent ensuite.

const router = Router();
router.use(authMiddleware);

const MAX_REPORT_BYTES = 25 * 1024 * 1024;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const uploadQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  weekNumber: z.coerce.number().int().min(1).max(53),
  startOfWeek: z.coerce.date(),
  endOfWeek: z.coerce.date(),
  noteCount: z.coerce.number().int().min(0).max(1000),
});

// ─── POST /api/sports/reports ───────────────────────────────────────────────
// Corps : le .docx brut (application/octet-stream). Métadonnées en query string.

router.post(
  '/',
  requirePermission('sports.edit'),
  express.raw({ type: () => true, limit: MAX_REPORT_BYTES }),
  async (req: Request, res: Response) => {
    const parse = uploadQuerySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Paramètres invalides' });
      return;
    }
    const body = req.body as Buffer | undefined;
    // Un .docx est une archive ZIP : signature "PK\x03\x04"
    if (!Buffer.isBuffer(body) || body.length < 4 || body.readUInt32BE(0) !== 0x504b0304) {
      res.status(400).json({ error: 'Fichier .docx invalide' });
      return;
    }

    const { year, weekNumber, startOfWeek, endOfWeek, noteCount } = parse.data;
    const filename = `CR_S${String(weekNumber).padStart(2, '0')}_${year}.docx`;

    const report = await prisma.matchReport.create({
      data: {
        year, weekNumber, startOfWeek, endOfWeek, noteCount, filename,
        size: body.length,
        data: body,
        createdById: req.user!.id,
      },
      select: reportSelect,
    });

    res.status(201).json({ data: report });
  }
);

const reportSelect = {
  id: true, year: true, weekNumber: true, startOfWeek: true, endOfWeek: true,
  noteCount: true, filename: true, size: true, createdAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

// ─── GET /api/sports/reports ────────────────────────────────────────────────
// Historique (sans le contenu des fichiers), du plus récent au plus ancien.

router.get('/', async (_req: Request, res: Response) => {
  const reports = await prisma.matchReport.findMany({
    select: reportSelect,
    orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });
  res.json({ data: reports });
});

// ─── GET /api/sports/reports/:id/download ───────────────────────────────────

router.get('/:id/download', async (req: Request, res: Response) => {
  const report = await prisma.matchReport.findUnique({
    where: { id: req.params.id },
    select: { filename: true, data: true },
  });
  if (!report) {
    res.status(404).json({ error: 'Rapport introuvable' });
    return;
  }
  res.setHeader('Content-Type', DOCX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
  res.send(Buffer.from(report.data));
});

// ─── DELETE /api/sports/reports/:id ─────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  if (!hasPermission(req.user!, 'admin.access')) {
    res.status(403).json({ error: 'Permission refusée' });
    return;
  }
  const existing = await prisma.matchReport.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: 'Rapport introuvable' });
    return;
  }
  await prisma.matchReport.delete({ where: { id: req.params.id } });
  res.json({ data: { success: true } });
});

export default router;
