import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { verifyToken } from '../utils/jwt';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    id: string;
    name: string;
    roleUpdatedAt: Date;
  };
  permissions: string[];
}

// Extend Express Request with user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookieToken = req.cookies?.helpdesk_token as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  const token = cookieToken || bearerToken;

  if (!token) {
    res.status(401).json({ error: 'Token manquant ou invalide' });
    return;
  }
  const decoded = verifyToken(token);

  if (!decoded || !decoded.id) {
    res.status(401).json({ error: 'Token invalide' });
    return;
  }

  // Fetch user with role from DB to get latest permissions
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: {
      role: true,
    },
  });

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Utilisateur introuvable ou inactif' });
    return;
  }

  // Invalidate token if role permissions were updated after token was issued
  // token.iat is in seconds, roleUpdatedAt is a Date (milliseconds)
  const tokenIssuedAt = decoded.iat * 1000;
  if (tokenIssuedAt < user.role.roleUpdatedAt.getTime()) {
    res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
    return;
  }

  req.user = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: {
      id: user.role.id,
      name: user.role.name,
      roleUpdatedAt: user.role.roleUpdatedAt,
    },
    permissions: user.role.permissions,
  };

  // Enforce password change — block all routes except /me and /change-password
  if (user.mustChangePassword) {
    const exemptPaths = ['/api/auth/me', '/api/auth/change-password'];
    const isExempt = exemptPaths.some(p => req.originalUrl.startsWith(p));
    if (!isExempt) {
      res.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED' });
      return;
    }
  }

  next();
}
