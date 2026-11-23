import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import {
  connect, getJob, getStatus, logout, startCreateGroupsJob,
} from '../services/whatsappService';

const router = Router();

router.use(authMiddleware, requirePermission('whatsapp.groups'));

// ─── GET /api/whatsapp/status ────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  res.json(getStatus());
});

// ─── POST /api/whatsapp/connect ──────────────────────────────────────────────

router.post('/connect', async (_req: Request, res: Response) => {
  try {
    res.json(await connect());
  } catch (err) {
    console.error('[WhatsApp] connect', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Connexion impossible' });
  }
});

// ─── POST /api/whatsapp/logout ───────────────────────────────────────────────

router.post('/logout', async (_req: Request, res: Response) => {
  await logout();
  res.json(getStatus());
});

// ─── POST /api/whatsapp/groups ───────────────────────────────────────────────

const E164 = /^\+\d{8,15}$/;

const createGroupsSchema = z.object({
  groups: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        name: z.string().trim().min(1).max(100),
        participants: z.array(z.string().regex(E164, 'Numéro E.164 attendu')).max(10),
      }),
    )
    .min(1)
    .max(40),
  // Photo de groupe : data URL PNG/JPEG (≈ 640×640, quelques centaines de Ko)
  picture: z
    .string()
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, 'Image invalide')
    .max(3_000_000)
    .nullable()
    .optional(),
});

router.post('/groups', (req: Request, res: Response) => {
  const parsed = createGroupsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Requête invalide' });
    return;
  }
  try {
    const job = startCreateGroupsJob(parsed.data.groups, parsed.data.picture ?? null);
    res.status(202).json(job);
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'Création impossible' });
  }
});

// ─── GET /api/whatsapp/groups/jobs/:id ───────────────────────────────────────

router.get('/groups/jobs/:id', (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Création introuvable' });
    return;
  }
  res.json(job);
});

export default router;
