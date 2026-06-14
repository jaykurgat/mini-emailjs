// lib/providers/smtp.js
//
// SMTP provider — sends via any SMTP server, including Gmail, Outlook,
// Zoho Mail, or a custom mail server. Credentials are stored per-project
// in `provider_config` (in the `projects` table).
//
// For Gmail specifically:
//   - host: smtp.gmail.com
//   - port: 465 (SSL) or 587 (STARTTLS)
//   - user: the Gmail address
//   - pass: a 16-character "App Password" — NOT the normal account password.
//     Generate one at: https://myaccount.google.com/apppasswords
//     (requires 2-Step Verification to be enabled on the Google account)
//
// For Outlook/Office365:
//   - host: smtp.office365.com
//   - port: 587
//
// For Zoho Mail:
//   - host: smtp.zoho.com
//   - port: 465

import nodemailer from 'nodemailer';

/**
 * @param {Object} params
 * @param {string} params.from     - Sender address (should match the SMTP account's address)
 * @param {string} params.to       - Recipient email address
 * @param {string} params.subject  - Email subject line
 * @param {string} params.html     - HTML body
 * @param {string} [params.replyTo] - Optional Reply-To address
 * @param {Object} params.config   - Per-project SMTP credentials:
 *                                    { host, port, secure, user, pass }
 */
export async function sendEmail({ from, to, subject, html, replyTo, config }) {
  if (!config || !config.host || !config.user || !config.pass) {
    throw new Error(
      'SMTP provider is missing required config (host, user, pass). ' +
      'Check this project\'s provider_config in the database.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port || 587,
    secure: config.secure ?? (config.port === 465), // true for 465, false for 587/others
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const mailOptions = {
    from,
    to,
    subject,
    html,
  };
  if (replyTo) mailOptions.replyTo = replyTo;

  return transporter.sendMail(mailOptions);
}

/**
 * Describes what this provider needs from a project's `provider_config`.
 * Used by the CLI to prompt for the right fields.
 */
export const configSchema = [
  {
    key: 'host',
    label: 'SMTP host (e.g. smtp.gmail.com)',
    required: true,
  },
  {
    key: 'port',
    label: 'SMTP port (465 for SSL, 587 for STARTTLS)',
    required: true,
    default: '587',
    type: 'number',
  },
  {
    key: 'user',
    label: 'SMTP username (usually the full email address)',
    required: true,
  },
  {
    key: 'pass',
    label: 'SMTP password / app password',
    required: true,
    sensitive: true,
  },
];
