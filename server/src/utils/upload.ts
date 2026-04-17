import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import crypto from 'crypto';
import fs from 'fs';

function getUploadsRoot(): string {
  return process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH)
    : path.join(process.cwd(), 'uploads');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Attachment upload (up to 5 files, 10 MB each) ───────────────────────────

const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain',
]);

export const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = path.join(getUploadsRoot(), 'attachments');
      ensureDir(dir);
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const uuid = crypto.randomUUID();
      const ext = path.extname(file.originalname);
      cb(null, `${uuid}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) {
    if (ALLOWED_ATTACHMENT_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`));
    }
  },
});

// ─── Logo upload (single file, 2 MB, images only) ────────────────────────────

const ALLOWED_LOGO_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const logoUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = path.join(getUploadsRoot(), 'logo');
      ensureDir(dir);
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `logo${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) {
    if (ALLOWED_LOGO_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Logo: format non autorisé (JPG, PNG, WebP uniquement)'));
    }
  },
});

// ─── KB image upload (single file, 5 MB, images only) ────────────────────────

const ALLOWED_KB_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export const kbImageUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = path.join(getUploadsRoot(), 'kb');
      ensureDir(dir);
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const uuid = crypto.randomUUID();
      const ext = path.extname(file.originalname);
      cb(null, `${uuid}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    if (ALLOWED_KB_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non autorisé (JPG, PNG, GIF, WebP uniquement)'));
    }
  },
});

export function getUploadsPath(...segments: string[]): string {
  return path.join(getUploadsRoot(), ...segments);
}
