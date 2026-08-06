import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware);

// Cartes BMC = interfaces de gestion physique (iDRAC/iLO) de serveurs internes :
// on n'accepte que des IP privées RFC1918, jamais une adresse publique (même esprit
// que PRIVATE_IP_RE dans app.ts pour le CORS).
const PRIVATE_IPV4_RE =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;

const bmcCardSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  ip: z.string().refine(
    ip => PRIVATE_IPV4_RE.test(ip) && ip.split('.').every(octet => Number(octet) <= 255),
    'Adresse IPv4 privée invalide (10.x, 172.16-31.x ou 192.168.x attendu)'
  ),
  division: z.enum(['TOP14', 'PRO_D2']),
});

const IP_CONFLICT_MESSAGE = 'Cette adresse IP est déjà utilisée par une autre carte';

/** Prisma unique-constraint violation (P2002) — typed narrowing without `any`. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

// ─── GET /api/bmc-cards ──────────────────────────────────────────────────────

router.get(
  '/bmc-cards',
  requirePermission('bmc.view'),
  async (_req: Request, res: Response) => {
    const cards = await prisma.bmcCard.findMany({
      orderBy: { name: 'asc' },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ data: cards });
  }
);

// ─── POST /api/bmc-cards ─────────────────────────────────────────────────────

router.post(
  '/bmc-cards',
  requirePermission('bmc.manage'),
  async (req: Request, res: Response) => {
    const parse = bmcCardSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    try {
      const card = await prisma.bmcCard.create({
        data: { ...parse.data, createdById: req.user!.id },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      });
      res.status(201).json({ data: card });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        res.status(400).json({ error: IP_CONFLICT_MESSAGE });
        return;
      }
      console.error('[bmc-cards] create error', error);
      res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  }
);

// ─── PUT /api/bmc-cards/:id ──────────────────────────────────────────────────

router.put(
  '/bmc-cards/:id',
  requirePermission('bmc.manage'),
  async (req: Request, res: Response) => {
    const parse = bmcCardSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.bmcCard.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Carte BMC introuvable' });
      return;
    }

    try {
      const card = await prisma.bmcCard.update({
        where: { id: req.params.id },
        data: parse.data,
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      });
      res.json({ data: card });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        res.status(400).json({ error: IP_CONFLICT_MESSAGE });
        return;
      }
      console.error('[bmc-cards] update error', error);
      res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  }
);

// ─── DELETE /api/bmc-cards/:id ───────────────────────────────────────────────

router.delete(
  '/bmc-cards/:id',
  requirePermission('bmc.delete'),
  async (req: Request, res: Response) => {
    const existing = await prisma.bmcCard.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Carte BMC introuvable' });
      return;
    }

    await prisma.bmcCard.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }
);

export default router;
