import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { getUploadsPath } from '../utils/upload';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function purgeExpiredAttachments(): Promise<void> {
  const threshold = new Date(Date.now() - SIX_HOURS_MS);

  const expired = await prisma.matchAttachment.findMany({
    where: {
      matchDate: { lt: threshold },
    },
  });

  if (expired.length === 0) {
    console.log('[MatchAttachmentPurge] Nothing to purge');
    return;
  }

  for (const attachment of expired) {
    // Delete file from disk (ignore if already absent)
    const filePath = path.isAbsolute(attachment.path)
      ? attachment.path
      : path.join(getUploadsPath(), attachment.path);

    try {
      fs.unlinkSync(filePath);
    } catch {
      // File already deleted or missing — ignore
    }

    // Delete DB record
    await prisma.matchAttachment.delete({ where: { id: attachment.id } });
  }

  console.log(`[MatchAttachmentPurge] Purged: ${expired.length} attachments`);
}

export function startMatchAttachmentPurgeJob(): void {
  cron.schedule('0 * * * *', async () => {
    console.log('[MatchAttachmentPurge] Running...');
    try {
      await purgeExpiredAttachments();
    } catch (err) {
      console.error('[MatchAttachmentPurge] Unexpected error:', err);
    }
  });

  console.log('[MatchAttachmentPurge] Scheduled (every hour)');
}
