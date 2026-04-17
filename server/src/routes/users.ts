import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { hashPassword } from '../utils/password';
import { getBrandedEmailTemplate, sendEmail } from '../utils/email';

const router = Router();

router.use(authMiddleware);

const createUserSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  roleId: z.string().uuid('Rôle invalide'),
  isActive: z.boolean().optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

router.get(
  '/users',
  requirePermission('admin.users'),
  async (req: Request, res: Response) => {
    const where: any = {};
    if (req.query.roleId) where.roleId = req.query.roleId as string;

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        role: true,
        _count: { select: { assignedTickets: { where: { deletedAt: null } } } },
      },
      omit: { password: true, passwordResetToken: true },
    });

    res.json({ data: users });
  }
);

// ─── POST /api/admin/users ────────────────────────────────────────────────────

router.post(
  '/users',
  requirePermission('admin.users'),
  async (req: Request, res: Response) => {
    const parse = createUserSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const { firstName, lastName, email, password, roleId, isActive } = parse.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'Cet email est déjà utilisé' });
      return;
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      res.status(400).json({ error: 'Rôle introuvable' });
      return;
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashed,
        roleId,
        isActive: isActive ?? true,
        mustChangePassword: true,
      },
      include: { role: true },
      omit: { password: true, passwordResetToken: true },
    });

    res.status(201).json({ data: user });
  }
);

// ─── PUT /api/admin/users/:id ─────────────────────────────────────────────────

router.put(
  '/users/:id',
  requirePermission('admin.users'),
  async (req: Request, res: Response) => {
    const parse = updateUserSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Agent introuvable' });
      return;
    }

    if (parse.data.email && parse.data.email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email: parse.data.email } });
      if (emailTaken) {
        res.status(400).json({ error: 'Cet email est déjà utilisé' });
        return;
      }
    }

    if (parse.data.roleId && parse.data.roleId !== existing.roleId) {
      const role = await prisma.role.findUnique({ where: { id: parse.data.roleId } });
      if (!role) {
        res.status(400).json({ error: 'Rôle introuvable' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: parse.data,
      include: { role: true },
      omit: { password: true, passwordResetToken: true },
    });

    res.json({ data: user });
  }
);

// ─── POST /api/admin/users/:id/send-reset-email ───────────────────────────────

router.post(
  '/users/:id/send-reset-email',
  requirePermission('admin.users'),
  async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ error: 'Agent introuvable' });
      return;
    }

    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
    });

    // Fetch company name for email content
    const companySetting = await prisma.settings.findUnique({
      where: { key: 'company_name' },
    });
    const companyName = companySetting?.value ?? 'HelpDesk';

    const html = await getBrandedEmailTemplate({
      title: 'Réinitialisation de votre mot de passe',
      preheader: 'Réinitialisez votre mot de passe',
      content: `<p>Bonjour <strong>${user.firstName}</strong>,</p>
        <p>Une demande de réinitialisation de mot de passe a été effectuée
        pour votre compte <strong>${companyName}</strong> HelpDesk.</p>
        <p>Ce lien est valable <strong>24 heures</strong>.</p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      ctaUrl: `${process.env.APP_URL}/reset-password/${rawToken}`,
      ctaLabel: 'Réinitialiser mon mot de passe',
    });

    await sendEmail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe',
      html,
    });

    res.json({ data: { message: `Email envoyé à ${user.email}` } });
  }
);

// ─── DELETE /api/admin/users/:id ──────────────────────────────────────────────

router.delete(
  '/users/:id',
  requirePermission('admin.users'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Block self-deletion
    if (req.user!.id === id) {
      res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
      return;
    }

    // Check user exists
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Agent introuvable' });
      return;
    }

    // Block if agent has open assigned tickets
    const openTicketsCount = await prisma.ticket.count({
      where: {
        assignedToId: id,
        status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] },
        deletedAt: null,
      },
    });

    if (openTicketsCount > 0) {
      res
        .status(400)
        .json({ error: 'Cet agent a des tickets ouverts assignés. Réassignez-les avant de le supprimer.' });
      return;
    }

    await prisma.user.delete({ where: { id } });

    res.json({ data: { message: 'Agent supprimé avec succès' } });
  }
);

export default router;
