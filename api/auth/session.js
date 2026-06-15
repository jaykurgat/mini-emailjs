// api/auth/session.js
//
// GET /api/auth/session
// Returns { ok: true, authenticated: boolean }.
// Used by dashboard pages to check if the user is logged in
// before rendering protected content.

import { getSession } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET.' });
  }

  const userId = getSession(req);
  return res.status(200).json({ ok: true, authenticated: !!userId });
}
