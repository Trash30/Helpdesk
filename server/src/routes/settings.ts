import { Router, Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { logoUpload, getUploadsPath } from '../utils/upload';

const router = Router();

const ALLOWED_SETTINGS_KEYS = [
  'company_name',
  'logo_url',
  'default_priority',
  'default_assigned_to',
  'auto_close_days',
  'survey_delay_hours',
  'survey_cooldown_days',
  'survey_enabled',
];

// ─── GET /api/settings/public (no auth) ──────────────────────────────────────

router.get('/settings/public', async (_req: Request, res: Response) => {
  const settings = await prisma.settings.findMany({
    where: { key: { in: ['logo_url', 'company_name'] } },
  });

  const map: Record<string, string | null> = {
    logo_url: null,
    company_name: 'HelpDesk',
  };

  for (const s of settings) {
    map[s.key] = s.value;
  }

  res.json({ data: map });
});

// ─── GET /api/admin/settings (auth) ──────────────────────────────────────────

router.get(
  '/admin/settings',
  authMiddleware,
  requirePermission('admin.settings'),
  async (_req: Request, res: Response) => {
    const settings = await prisma.settings.findMany();
    const map: Record<string, string | null> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    res.json({ data: map });
  }
);

// ─── POST /api/admin/settings/logo ───────────────────────────────────────────

router.post(
  '/admin/settings/logo',
  authMiddleware,
  requirePermission('admin.settings'),
  logoUpload.single('logo'),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Aucun fichier fourni' });
      return;
    }

    // Delete old logo file if it exists and is different
    const oldSetting = await prisma.settings.findUnique({ where: { key: 'logo_url' } });
    if (oldSetting?.value) {
      // Extract filename from URL path like /uploads/logo/logo.png
      const oldFilename = oldSetting.value.split('/').pop();
      if (oldFilename) {
        const oldPath = path.join(getUploadsPath('logo'), oldFilename);
        if (fs.existsSync(oldPath) && oldPath !== file.path) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    const logoUrl = `/uploads/logo/${file.filename}`;

    await prisma.settings.upsert({
      where: { key: 'logo_url' },
      update: { value: logoUrl },
      create: { key: 'logo_url', value: logoUrl },
    });

    res.json({ data: { logo_url: logoUrl } });
  }
);

// ─── PUT /api/admin/settings ──────────────────────────────────────────────────

router.put(
  '/admin/settings',
  authMiddleware,
  requirePermission('admin.settings'),
  async (req: Request, res: Response) => {
    const schema = z.record(z.string(), z.string()).refine(
      (obj) => Object.keys(obj).every((k) => ALLOWED_SETTINGS_KEYS.includes(k)),
      { message: 'Clé de paramètre non autorisée' }
    );

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.errors[0].message });
      return;
    }

    const entries = Object.entries(parse.data);

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.settings.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    res.json({ data: { message: 'Paramètres mis à jour' } });
  }
);

export default router;
