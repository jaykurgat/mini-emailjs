// api/auth/change-password.js
//
// POST /api/auth/change-password
// Body: { currentPassword: "...", newPassword: "..." }
//
// Verifies the current password, then calls the Vercel API to update
// the DASHBOARD_PASSWORD environment variable and trigger a redeploy.
//
// Required env vars (set in Vercel project settings):
//   VERCEL_API_TOKEN    — from vercel.com/account/tokens
//   VERCEL_PROJECT_ID   — from your Vercel project settings page
//   VERCEL_ENV_VAR_ID   — the ID of the DASHBOARD_PASSWORD env var
//                         (get it by running: GET /v9/projects/{id}/env via Vercel API)
//
// See SETUP_NOTES.md for the exact steps to get these values.

import { requireAuth, checkPassword, clearSessionCookie } from '../../lib/auth.js';

const VERCEL_API = 'https://api.vercel.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const userId = requireAuth(req, res);
  if (!userId) return;

  const { currentPassword, newPassword } = req.body || {};

  // ── 1. Validate inputs ──
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: 'Both current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters.' });
  }

  // ── 2. Verify current password ──
  let valid;
  try {
    valid = checkPassword(currentPassword);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server configuration error: ' + err.message });
  }
  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Current password is incorrect.' });
  }

  // ── 3. Check Vercel API credentials are configured ──
  const token     = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const envVarId  = process.env.VERCEL_ENV_VAR_ID;

  if (!token || !projectId || !envVarId) {
    return res.status(501).json({
      ok: false,
      error: 'Password change via API is not configured. Add VERCEL_API_TOKEN, VERCEL_PROJECT_ID, and VERCEL_ENV_VAR_ID to your Vercel environment variables. See SETUP_NOTES.md.',
    });
  }

  // ── 4. Update DASHBOARD_PASSWORD via Vercel API ──
  try {
    const patchRes = await fetch(`${VERCEL_API}/v9/projects/${projectId}/env/${envVarId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: newPassword,
        type: 'encrypted',
        target: ['production', 'preview'],
      }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('Vercel API error:', patchRes.status, errText);
      return res.status(502).json({
        ok: false,
        error: `Vercel API returned ${patchRes.status}. Check your VERCEL_API_TOKEN and VERCEL_ENV_VAR_ID are correct.`,
      });
    }

    // ── 5. Trigger a redeployment so the new env var takes effect ──
    // Get the latest deployment ID first
    const deploymentsRes = await fetch(
      `${VERCEL_API}/v6/deployments?projectId=${projectId}&limit=1&state=READY`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (deploymentsRes.ok) {
      const { deployments } = await deploymentsRes.json();
      const latestId = deployments?.[0]?.uid;

      if (latestId) {
        // Redeploy without cache to pick up new env vars
        await fetch(`${VERCEL_API}/v13/deployments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deploymentId: latestId,
            name: 'mini-emailjs',
            target: 'production',
          }),
        });
      }
    }

    // ── 6. Clear the session so the user must log in with new password ──
    res.setHeader('Set-Cookie', clearSessionCookie());

    return res.status(200).json({
      ok: true,
      message: 'Password updated. A redeployment has been triggered (~60 seconds). Please log in with your new password.',
    });

  } catch (err) {
    console.error('change-password error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error: ' + err.message });
  }
}
