import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Middleware factory — requires ALL listed permissions to be present on req.user.
 * Must be used after authMiddleware.
 */
export function requirePermission(...perms: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const missing = perms.filter((p) => !req.user!.permissions.includes(p));
    if (missing.length > 0) {
      res.status(403).json({
        error: 'Permission refusée',
        required: perms,
      });
      return;
    }

    next();
  };
}

/**
 * Helper — returns true if a user has a specific permission.
 */
export function hasPermission(user: { permissions: string[] }, perm: string): boolean {
  return user.permissions.includes(perm);
}
