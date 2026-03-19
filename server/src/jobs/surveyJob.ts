import cron from 'node-cron';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { getBrandedEmailTemplate, sendEmail } from '../utils/email';

async function checkAndSendSurveys(): Promise<void> {
  // Read settings
  const settings = await prisma.settings.findMany({
    where: { key: { in: ['survey_delay_hours', 'survey_cooldown_days'] } },
  });

  const settingsMap: Record<string, string> = {};
  for (const s of settings) settingsMap[s.key] = s.value;

  const delayHours = parseInt(settingsMap['survey_delay_hours'] ?? '48', 10);
  const cooldownDays = parseInt(settingsMap['survey_cooldown_days'] ?? '10', 10);

  const delayThreshold = new Date(Date.now() - delayHours * 3600000);
  const cooldownThreshold = new Date(Date.now() - cooldownDays * 86400000);

  // Find eligible tickets:
  //   status = CLOSED
  //   resolvedAt <= now - delayHours
  //   client.email IS NOT NULL
  //   client.isSurveyable = true
  //   no existing SurveySend for this ticket
  const eligibleTickets = await prisma.ticket.findMany({
    where: {
      status: 'CLOSED',
      deletedAt: null,
      resolvedAt: { lte: delayThreshold },
      client: {
        email: { not: null },
        isSurveyable: true,
      },
      surveySends: { none: {} },
    },
    include: {
      client: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  const total = eligibleTickets.length;

  for (const ticket of eligibleTickets) {
    const client = ticket.client;
    if (!client.email) {
      skipped++;
      continue;
    }

    // Check cooldown: no SENT survey to this email in last cooldownDays
    const recentSend = await prisma.surveySend.findFirst({
      where: {
        clientEmail: client.email,
        status: 'SENT',
        createdAt: { gte: cooldownThreshold },
      },
    });

    if (recentSend) {
      skipped++;
      continue;
    }

    const rawToken = crypto.randomUUID();

    // Create SurveySend record (PENDING)
    const surveySend = await prisma.surveySend.create({
      data: {
        ticketId: ticket.id,
        clientEmail: client.email,
        token: rawToken,
        status: 'PENDING',
      },
    });

    try {
      const html = await getBrandedEmailTemplate({
        title: 'Votre avis nous intéresse',
        preheader: `Ticket ${ticket.ticketNumber} — ${ticket.title}`,
        content: `<p>Bonjour ${client.firstName},</p>
          <p>Votre demande <strong>${ticket.ticketNumber} — ${ticket.title}</strong>
          a été résolue.</p>
          <p>Nous aimerions connaître votre avis sur la qualité de notre support.
          Cela ne prendra que 2 minutes.</p>`,
        ctaUrl: `${process.env.APP_URL}/survey/${rawToken}`,
        ctaLabel: 'Donner mon avis',
      });

      await sendEmail({
        to: client.email,
        subject: `Votre avis nous intéresse — ticket ${ticket.ticketNumber}`,
        html,
      });

      await prisma.surveySend.update({
        where: { id: surveySend.id },
        data: { status: 'SENT', sentAt: new Date() },
      });

      sent++;
    } catch (err) {
      await prisma.surveySend.update({
        where: { id: surveySend.id },
        data: { status: 'FAILED' },
      });

      console.error(
        `[SurveyJob] Failed to send survey for ticket ${ticket.ticketNumber}:`,
        err
      );
    }
  }

  console.log(`[SurveyJob] Checked: ${total}, Sent: ${sent}, Skipped: ${skipped}`);
}

export function startSurveyJob(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[SurveyJob] Running...');
    try {
      await checkAndSendSurveys();
    } catch (err) {
      console.error('[SurveyJob] Unexpected error:', err);
    }
  });

  console.log('[SurveyJob] Scheduled (every hour)');
}
