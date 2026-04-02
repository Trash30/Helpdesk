import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';

import authRouter from './routes/auth';
import ticketsRouter from './routes/tickets';
import commentsRouter from './routes/comments';
import attachmentsRouter from './routes/attachments';
import clientsRouter from './routes/clients';
import clientRolesRouter from './routes/clientRoles';
import categoriesRouter from './routes/categories';
import rolesRouter from './routes/roles';
import usersRouter from './routes/users';
import settingsRouter from './routes/settings';
import dashboardRouter from './routes/dashboard';
import surveysRouter from './routes/surveys';
import clubsRouter from './routes/clubs';
import organisationsRouter from './routes/organisations';
import polesRouter from './routes/poles';
import ticketTypesRouter from './routes/ticketTypes';
import sportsRouter from './routes/sports';

const app = express();

// ─── Security & logging ──────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.APP_URL
        : true,
    credentials: true,
  })
);

app.use(morgan('dev'));
app.use(cookieParser());

// ─── Body parsing ────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static file serving (uploads) ──────────────────────────────────────────

const uploadsPath = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(process.cwd(), 'uploads');

app.use('/uploads', express.static(uploadsPath));

// ─── API routes ──────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api', settingsRouter);
app.use('/api', ticketsRouter);
app.use('/api', commentsRouter);
app.use('/api', attachmentsRouter);
app.use('/api', clientsRouter);
app.use('/api', clientRolesRouter);
app.use('/api', categoriesRouter);
app.use('/api/admin', rolesRouter);
app.use('/api/admin', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api', surveysRouter);
app.use('/api', clubsRouter);
app.use('/api', organisationsRouter);
app.use('/api', polesRouter);
app.use('/api', ticketTypesRouter);
app.use('/api/sports', sportsRouter);

// ─── 404 handler ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ─── Global error handler ────────────────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erreur interne du serveur';
  res.status(status).json({ error: message });
});

export default app;
