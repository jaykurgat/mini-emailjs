// api/auth/login.js
//
// POST /api/auth/login
// Body: { password: "..." }
//
// On success: sets a session cookie and returns { ok: true }.
// On failure: returns 401 { ok: false, error: "..." }.

import { checkPassword, createSessionCookie, OWNER_USER_ID } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const { password } = req.body || {};

  let valid;
  try {
    valid = checkPassword(password);
  } catch (err) {
    console.error('Login config error:', err.message);
    return res.status(500).json({ ok: false, error: 'Server is not configured for login.' });
  }

  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Incorrect password.' });
  }

  res.setHeader('Set-Cookie', createSessionCookie(OWNER_USER_ID));
  return res.status(200).json({ ok: true });
}
