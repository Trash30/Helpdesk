/**
 * Serveur unique de la version portable Windows.
 * Sert l'API (app Express du projet) ET le front compilé, sur un seul port :
 * pas de Nginx, pas d'installation.
 *
 * Variables lues (posées par Start-HelpDesk.bat) : PORT, HOST, DATABASE_URL, JWT_SECRET, UPLOADS_PATH...
 */
const path = require('path');
const fs = require('fs');
const express = require('express');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

const apiApp = require('./dist/src/app').default;
const { prisma } = require('./dist/src/lib/prisma');
const { startMatchAttachmentPurgeJob } = require('./dist/src/jobs/matchAttachmentPurgeJob');

const outer = express();

// /api et /uploads → application du projet (qui gère aussi ses propres 404 JSON)
outer.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return apiApp(req, res, next);
  next();
});

// Front compilé + repli SPA
outer.use(express.static(CLIENT_DIST));
outer.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));

async function main() {
  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    throw new Error('Front introuvable : ' + CLIENT_DIST);
  }
  await prisma.$connect();
  outer.listen(PORT, HOST, () => {
    console.log(`[HelpDesk portable] http://localhost:${PORT}`);
  });
  startMatchAttachmentPurgeJob();
}

main().catch((err) => {
  console.error('[HelpDesk portable] Echec du demarrage :', err.message);
  process.exit(1);
});
