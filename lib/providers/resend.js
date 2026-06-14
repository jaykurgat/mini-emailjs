// lib/providers/resend.js
//
// Resend provider — uses the platform's shared RESEND_API_KEY
// (set as a Vercel environment variable). This is the default
// provider and requires no per-project credentials.

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * @param {Object} params
 * @param {string} params.from     - Verified sender, e.g. "ApexOps <onboarding@resend.dev>"
 * @param {string} params.to       - Recipient email address
 * @param {string} params.subject  - Email subject line
 * @param {string} params.html     - HTML body
 * @param {string} [params.replyTo] - Optional Reply-To address
 * @param {Object} [params.config] - Per-project provider config (unused for Resend;
 *                                    the platform's shared RESEND_API_KEY is used instead)
 */
export async function sendEmail({ from, to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable.');
  }

  const body = {
    from,
    to: [to],
    subject,
    html,
  };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error (${res.status}): ${errText}`);
  }

  return res.json();
}

/**
 * Describes what this provider needs from a project's `provider_config`.
 * Used by the CLI to know what to ask for. Resend needs nothing extra —
 * it uses the platform-wide RESEND_API_KEY.
 */
export const configSchema = [];
