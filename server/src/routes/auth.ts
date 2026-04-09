import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signToken } from '../utils/jwt';
import { hashPassword, comparePassword } from '../utils/password';
import { authMiddleware } from '../middleware/auth';
import { hasPermission } from '../middleware/permissions';
import rateLimit from 'express-rate-limit';

const router = Router();

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans une minute' },
});

const passwordRules = z
  .string()
  .min(8, 'Minimum 8 caractères')
  .regex(/[A-Z]/, 'Au moins une majuscule requise')
  .regex(/[0-9]/, 'Au moins un chiffre requis');

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', authRateLimit, async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Email ou mot de passe invalide' });
    return;
  }

  const { email, password } = parse.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Identifiants incorrects' });
    return;
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Identifiants incorrects' });
    return;
  }

  const token = signToken({ id: user.id, email: user.email });

  res.cookie('helpdesk_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8h
  });

  res.json({
    data: {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        role: {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions,
        },
      },
    },
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ data: req.user });
});

// ─── PATCH /api/auth/change-password ─────────────────────────────────────────

router.patch('/change-password', authMiddleware, async (req: Request, res: Response) => {
  const user = req.user!;

  const schema = z.object({
    currentPassword: z.string().optional(),
    newPassword: passwordRules,
    confirmPassword: z.string(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const { currentPassword, newPassword, confirmPassword } = parse.data;

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    return;
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  // Skip current password check when user is forced to change on first login
  if (!dbUser.mustChangePassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Mot de passe actuel requis' });
      return;
    }
    const valid = await comparePassword(currentPassword, dbUser.password);
    if (!valid) {
      res.status(400).json({ error: 'Mot de passe actuel incorrect' });
      return;
    }
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, mustChangePassword: false },
  });

  res.json({ data: { message: 'Mot de passe mis à jour' } });
});

// ─── GET /api/auth/validate-reset-token/:token ───────────────────────────────

router.get('/validate-reset-token/:token', authRateLimit, async (req: Request, res: Response) => {
  const { token } = req.params;

  const users = await prisma.user.findMany({
    where: { passwordResetToken: { not: null } },
    select: {
      id: true,
      email: true,
      firstName: true,
      passwordResetToken: true,
      passwordResetExpiry: true,
    },
  });

  for (const u of users) {
    if (!u.passwordResetToken) continue;
    const match = await comparePassword(token, u.passwordResetToken);
    if (match) {
      if (!u.passwordResetExpiry || u.passwordResetExpiry < new Date()) {
        res.json({ data: { valid: false, reason: 'expired' } });
        return;
      }
      res.json({ data: { valid: true, userEmail: u.email, firstName: u.firstName } });
      return;
    }
  }

  res.json({ data: { valid: false, reason: 'invalid' } });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post('/reset-password', authRateLimit, async (req: Request, res: Response) => {
  const schema = z.object({
    token: z.string().min(1),
    newPassword: passwordRules,
    confirmPassword: z.string(),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const { token, newPassword, confirmPassword } = parse.data;

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    return;
  }

  const users = await prisma.user.findMany({
    where: { passwordResetToken: { not: null } },
  });

  let matched = null;
  for (const u of users) {
    if (!u.passwordResetToken) continue;
    const match = await comparePassword(token, u.passwordResetToken);
    if (match) {
      matched = u;
      break;
    }
  }

  if (!matched) {
    res.status(400).json({ error: 'Lien invalide' });
    return;
  }

  if (!matched.passwordResetExpiry || matched.passwordResetExpiry < new Date()) {
    res.status(400).json({ error: 'Lien expiré' });
    return;
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: matched.id },
    data: {
      password: hashed,
      passwordResetToken: null,
      passwordResetExpiry: null,
      mustChangePassword: false,
    },
  });

  res.json({ data: { message: 'Mot de passe mis à jour' } });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('helpdesk_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ data: { message: 'Déconnecté' } });
});

export default router;
