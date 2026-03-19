import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';

interface BrandedEmailOptions {
  title: string;
  preheader?: string;
  content: string; // HTML string
  ctaUrl?: string;
  ctaLabel?: string;
}

export async function getBrandedEmailTemplate(options: BrandedEmailOptions): Promise<string> {
  const { title, preheader, content, ctaUrl, ctaLabel } = options;

  // Fetch branding from settings
  const settings = await prisma.settings.findMany({
    where: { key: { in: ['company_name', 'logo_url'] } },
  });

  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  const companyName = settingsMap['company_name'] || 'Mon Helpdesk';
  const logoUrl = settingsMap['logo_url'] || '';

  const logoSection = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-width:180px; max-height:60px; display:block; margin:0 auto 12px auto;" />`
    : '';

  const ctaSection =
    ctaUrl && ctaLabel
      ? `
      <div style="text-align:center; margin:32px 0;">
        <a href="${ctaUrl}"
           style="background-color:#185FA5; color:#ffffff; text-decoration:none;
                  padding:14px 32px; border-radius:6px; font-size:15px;
                  font-weight:600; display:inline-block;">
          ${ctaLabel}
        </a>
      </div>`
      : '';

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f9; font-family:Arial, sans-serif;">
  ${preheaderHtml}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="background-color:#ffffff; border-radius:8px;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08); max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td align="center"
                style="padding:32px 40px 24px 40px;
                       border-bottom:1px solid #e5e7eb;">
              ${logoSection}
              <h1 style="margin:0; font-size:20px; font-weight:700;
                         color:#111827; letter-spacing:-0.3px;">
                ${companyName}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 40px; color:#374151;
                       font-size:15px; line-height:1.6;">
              ${content}
              ${ctaSection}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center"
                style="padding:20px 40px 28px 40px;
                       border-top:1px solid #e5e7eb;
                       color:#9ca3af; font-size:12px; line-height:1.5;">
              <p style="margin:0 0 4px 0;">${companyName}</p>
              <p style="margin:0;">Ne pas répondre à cet email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { to, subject, html } = options;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
}
