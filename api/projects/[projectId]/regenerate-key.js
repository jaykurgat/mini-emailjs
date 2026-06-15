// api/projects/[projectId]/regenerate-key.js
//
// POST /api/projects/:projectId/regenerate-key
//   — generate a new API key for the project, invalidating the old one.
//
// Requires an authenticated session and project ownership.

import { requireAuth } from '../../../lib/auth.js';
import { regenerateApiKey } from '../../../lib/projects.js';

export default async function handler(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const { projectId } = req.query;

  try {
    const project = await regenerateApiKey(userId, projectId);
    return res.status(200).json({ ok: true, project });
  } catch (err) {
    console.error('Regenerate API key error:', err.message);
    const status = err.message === 'Project not found.' ? 404 : 500;
    return res.status(status).json({ ok: false, error: err.message });
  }
}
