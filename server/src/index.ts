import 'dotenv/config';
import { prisma } from './lib/prisma';
import { startSurveyJob } from './jobs/surveyJob';
import { startMatchAttachmentPurgeJob } from './jobs/matchAttachmentPurgeJob';
import app from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  // Verify DB connection
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL via Prisma');

  app.listen(PORT, () => {
    console.log(`[SERVER] Running on http://localhost:${PORT}`);
    console.log(`[ENV] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  });

  // Start background jobs
  startSurveyJob();
  startMatchAttachmentPurgeJob();
}

main().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
