// api/send/[projectId].js
//
// POST /api/send/:projectId
//
// Body (JSON or form-encoded):
//   {
//     "apiKey": "...",          // required — project's secret API key
//     "from_name": "Jane Doe",  // any fields the form collects
//     "email": "jane@x.com",
//     "message": "...",
//     "_gotcha": ""             // honeypot field — must stay empty
//   }
//
// Response:
//   200 { ok: true }
//   4xx { ok: false, error: "..." }
//
// This endpoint:
//   1. Looks up the project by projectId
//   2. Validates the API key and request origin
//   3. Checks the honeypot field (basic spam protection)
//   4. Checks rate limits (per IP, per hour)
//   5. Renders the email subject + body from the project's template
//   6. Sends via Resend
//   7. Logs the submission (sent / blocked / error) to Supabase

import { supabase } from '../../lib/supabase.js';
import { sendViaProvider } from '../../lib/providers/index.js';
import { renderTemplate, buildEmailBody } from '../../lib/render.js';
import { checkRateLimit } from '../../lib/rateLimit.js';

export default async function handler(req, res) {
  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, '*');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    setCorsHeaders(res, '*');
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const { projectId } = req.query;
  const body = req.body || {};

  try {
    // ── 1. Look up the project ──
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .single();

    if (projectError || !project) {
      setCorsHeaders(res, '*');
      return res.status(404).json({ ok: false, error: 'Unknown or inactive project.' });
    }

    // ── 2. Validate origin (CORS) ──
    const origin = req.headers.origin || '';
    const allowedOrigins = project.allowed_origins || [];
    const originAllowed =
      allowedOrigins.length === 0 || allowedOrigins.includes(origin);

    setCorsHeaders(res, originAllowed ? origin || '*' : 'null');

    if (!originAllowed) {
      await logSubmission(projectId, body, 'blocked', 'Origin not allowed', req);
      return res.status(403).json({ ok: false, error: 'Origin not allowed for this project.' });
    }

    // ── 3. Validate API key ──
    if (!body.apiKey || body.apiKey !== project.api_key) {
      await logSubmission(projectId, body, 'blocked', 'Invalid API key', req);
      return res.status(401).json({ ok: false, error: 'Invalid API key.' });
    }

    // ── 4. Honeypot check ──
    const honeypotField = project.honeypot_field || '_gotcha';
    if (body[honeypotField]) {
      await logSubmission(projectId, body, 'blocked', 'Honeypot triggered', req);
      // Return success to the bot so it doesn't retry — but don't send the email.
      return res.status(200).json({ ok: true });
    }

    // ── 5. Rate limiting ──
    const ipAddress = getClientIp(req);
    const { allowed } = await checkRateLimit(
      projectId,
      ipAddress,
      project.rate_limit_per_hour || 20
    );
    if (!allowed) {
      await logSubmission(projectId, body, 'blocked', 'Rate limit exceeded', req);
      return res.status(429).json({ ok: false, error: 'Too many submissions. Please try again later.' });
    }

    // ── 6. Render email content ──
    const submissionData = stripInternalFields(body);
    const subject = renderTemplate(project.subject_template, submissionData);
    const html = buildEmailBody(submissionData, {
      project: project.name,
      submitted_at: new Date().toLocaleString('en-GB', {
        dateStyle: 'full',
        timeStyle: 'short',
      }),
      ip_address: ipAddress || 'unknown',
    });

    // ── 7. Send via the project's configured provider ──
    const replyTo = body.email || body.from_email || undefined;
    await sendViaProvider(project, {
      from: project.from_email,
      to: project.to_email,
      subject,
      html,
      replyTo,
    });

    await logSubmission(projectId, body, 'sent', null, req);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Send error:', err);
    await logSubmission(projectId, body, 'error', err.message, req).catch(() => {});
    setCorsHeaders(res, '*');
    return res.status(500).json({ ok: false, error: 'Internal server error.' });
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function setCorsHeaders(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

/** Remove apiKey and honeypot fields before rendering/logging the email body. */
function stripInternalFields(body) {
  const clone = { ...body };
  delete clone.apiKey;
  // Remove any field starting with underscore (honeypot convention)
  Object.keys(clone).forEach((key) => {
    if (key.startsWith('_')) delete clone[key];
  });
  return clone;
}

async function logSubmission(projectId, payload, status, errorMessage, req) {
  try {
    await supabase.from('submissions').insert({
      project_id: projectId,
      payload: stripInternalFields(payload || {}),
      status,
      error_message: errorMessage,
      ip_address: getClientIp(req),
      user_agent: req.headers['user-agent'] || null,
    });
  } catch (err) {
    console.error('Failed to log submission:', err.message);
  }
}
