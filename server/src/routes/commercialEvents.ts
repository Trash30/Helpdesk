import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { hasPermission, requirePermission } from '../middleware/permissions';

const router = Router();
router.use(authMiddleware);

const commercialEventSchema = z.object({
  clientName: z.string().min(1, 'Nom du client requis'),
  startDate: z.string().min(1).refine((v) => !isNaN(Date.parse(v)), { message: 'Date de début invalide' }),
  endDate: z.string().min(1).refine((v) => !isNaN(Date.parse(v)), { message: 'Date de fin invalide' }),
  location: z.string().min(1, 'Lieu requis'),
  techContactFirstName: z.string().min(1, 'Prénom du contact requis'),
  techContactLastName: z.string().min(1, 'Nom du contact requis'),
  techContactEmail: z.string().email('Email du contact invalide'),
  techContactPhone: z.string().min(1, 'Téléphone du contact requis'),
  competition: z.string().min(1, 'Compétition requise'),
  notes: z.string().min(1, 'Notes requises'),
});

// GET /api/commercial-events — liste (tous ou filtre J+30)
// Accessible à tout utilisateur avec events.create
router.get('/commercial-events', requirePermission('events.create'), async (req: Request, res: Response) => {
  const horizon = req.query.horizon as string;
  const where: Record<string, unknown> = { createdById: req.user!.id };
  if (horizon === '30') {
    const now = new Date();
    const plus30 = new Date(now);
    plus30.setDate(now.getDate() + 30);
    plus30.setHours(23, 59, 59, 999);
    where['startDate'] = { gte: now, lte: plus30 };
  }
  const events = await prisma.commercialEvent.findMany({
    where,
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { startDate: 'asc' },
  });
  res.json({ data: events });
});

// GET /api/commercial-events/today — événements du jour (pour TodayEventsPage)
// Accessible à tous les utilisateurs authentifiés (pas seulement commerciaux)
router.get('/commercial-events/today', async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const events = await prisma.commercialEvent.findMany({
    where: { startDate: { gte: startOfDay, lte: endOfDay } },
    select: {
      id: true,
      clientName: true,
      startDate: true,
      endDate: true,
      location: true,
      competition: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { startDate: 'asc' },
  });
  res.json({ data: events });
});

// POST /api/commercial-events — créer un événement
router.post('/commercial-events', requirePermission('events.create'), async (req: Request, res: Response) => {
  const parsed = commercialEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const data = parsed.data;
  const event = await prisma.commercialEvent.create({
    data: {
      clientName: data.clientName,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      location: data.location,
      techContactFirstName: data.techContactFirstName,
      techContactLastName: data.techContactLastName,
      techContactEmail: data.techContactEmail,
      techContactPhone: data.techContactPhone,
      competition: data.competition,
      notes: data.notes,
      createdById: req.user!.id,
    },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.status(201).json({ data: event });
});

// DELETE /api/commercial-events/:id — supprimer (admin uniquement)
router.delete('/commercial-events/:id', async (req: Request, res: Response) => {
  if (!hasPermission(req.user!, 'admin.access')) {
    res.status(403).json({ error: 'Permission refusée' });
    return;
  }
  const existing = await prisma.commercialEvent.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Événement introuvable' });
    return;
  }
  await prisma.commercialEvent.delete({ where: { id: req.params.id } });
  res.json({ data: { success: true } });
});

export default router;
