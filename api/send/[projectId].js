// api/send/[projectId].js
// Public endpoint called by website contact forms.
// Validates the request, sends notification email, optionally sends
// auto-reply to submitter, and logs the submission to Supabase.

import { supabase } from '../../lib/supabase.js';
import { sendViaProvider } from '../../lib/providers/index.js';
import { renderTemplate, buildEmailBody, buildAutoReplyBody } from '../../lib/render.js';
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
    const origin = (req.headers.origin || '').replace(/\/$/, ''); // strip trailing slash
    const allowedOrigins = (project.allowed_origins || []).map(o => o.replace(/\/$/, ''));
    const originAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin);

    // Always set a valid CORS header — never the string 'null'
    setCorsHeaders(res, originAllowed ? (origin || '*') : '*');

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
      return res.status(200).json({ ok: true }); // silently succeed for bots
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

    // ── 6. Render and send notification email to owner ──
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

    const replyTo = body.email || body.from_email || undefined;

    await sendViaProvider(project, {
      from: project.from_email,
      to: project.to_email,
      subject,
      html,
      replyTo,
    });

    // ── 7. Auto-reply to submitter (optional, non-blocking) ──
    if (project.auto_reply_enabled && replyTo) {
      try {
        const autoSubject = renderTemplate(
          project.auto_reply_subject || "Thanks for reaching out — we'll be in touch soon.",
          submissionData
        );
        const autoHtml = buildAutoReplyBody(
          renderTemplate(project.auto_reply_body || '', submissionData),
          project.name
        );

        await sendViaProvider(project, {
          from: project.from_email,
          to: replyTo,
          subject: autoSubject,
          html: autoHtml,
        });
      } catch (autoErr) {
        // Auto-reply failure should never break the main submission
        console.error('Auto-reply failed (non-fatal):', autoErr.message);
      }
    }

    await logSubmission(projectId, body, 'sent', null, req);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Send error:', err);
    await logSubmission(projectId, body, 'error', err.message, req).catch(() => {});
    setCorsHeaders(res, '*');
    return res.status(500).json({ ok: false, error: 'Internal server error.' });
  }
}

// ── Helpers ──

function setCorsHeaders(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

function stripInternalFields(body) {
  const clone = { ...body };
  delete clone.apiKey;
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
