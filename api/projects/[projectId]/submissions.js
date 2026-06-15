// api/projects/[projectId]/submissions.js
//
// GET /api/projects/:projectId/submissions?limit=50
//   — list recent submissions for a project (most recent first)
//
// Requires an authenticated session and project ownership.

import { requireAuth } from '../../../lib/auth.js';
import { listSubmissions } from '../../../lib/projects.js';

export default async function handler(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET.' });
  }

  const { projectId, limit } = req.query;

  try {
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const submissions = await listSubmissions(userId, projectId, { limit: parsedLimit });
    return res.status(200).json({ ok: true, submissions });
  } catch (err) {
    console.error('List submissions error:', err.message);
    const status = err.message === 'Project not found.' ? 404 : 500;
    return res.status(status).json({ ok: false, error: err.message });
  }
}
