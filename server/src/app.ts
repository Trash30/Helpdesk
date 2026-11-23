import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';

import authRouter from './routes/auth';
import categoriesRouter from './routes/categories';
import rolesRouter from './routes/roles';
import usersRouter from './routes/users';
import settingsRouter from './routes/settings';
import sportsRouter from './routes/sports';
import whatsappRouter from './routes/whatsapp';
import matchAttachmentsRouter from './routes/matchAttachments';
import matchNotesRouter from './routes/matchNotes';
import matchReportsRouter from './routes/matchReports';
import kbRouter from './routes/kb';
import commercialEventsRouter from './routes/commercialEvents';
import bmcCardsRouter from './routes/bmcCards';

const app = express();

// Trust first proxy (Nginx) for correct client IP in rate-limiters and logs
app.set('trust proxy', 1);

// ─── Security & logging ──────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'upgrade-insecure-requests': null,
      },
    },
  })
);

const PRIVATE_IP_RE = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const extraOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? (origin, callback) => {
          if (!origin || PRIVATE_IP_RE.test(origin) || extraOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        }
      : true,
    credentials: true,
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());

// ─── Body parsing ────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static file serving (uploads) ──────────────────────────────────────────

const uploadsPath = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(process.cwd(), 'uploads');

// Block direct static access to match-attachments (served via authenticated API route)
app.use('/uploads/match-attachments', (_req, res) => {
  res.status(403).json({ error: 'Accès refusé' });
});
// Block direct static access to match-note-images (served via authenticated API route)
app.use('/uploads/match-note-images', (_req, res) => {
  res.status(403).json({ error: 'Accès refusé' });
});
app.use('/uploads', express.static(uploadsPath));

// ─── API routes ──────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api', settingsRouter);
app.use('/api', categoriesRouter);
app.use('/api/admin', rolesRouter);
app.use('/api/admin', usersRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/sports', sportsRouter);
app.use('/api/sports', matchAttachmentsRouter);
app.use('/api/sports/match-notes', matchNotesRouter);
app.use('/api/sports/reports', matchReportsRouter);
app.use('/api', kbRouter);
app.use('/api', commercialEventsRouter);
app.use('/api', bmcCardsRouter);

// ─── 404 handler ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ─── Global error handler ────────────────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  const status = err.status || err.statusCode || 500;

  // En production ou pour les erreurs 5xx, ne pas exposer les détails internes
  const isPrismaError = err?.constructor?.name?.startsWith('PrismaClient');
  const isServerError = status >= 500;
  const isProduction = process.env.NODE_ENV === 'production';

  let message: string;
  if (isPrismaError || (isServerError && isProduction)) {
    message = 'Erreur interne du serveur';
  } else {
    message = err.message || 'Erreur interne du serveur';
  }

  res.status(status).json({ error: message });
});

export default app;
