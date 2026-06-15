// lib/auth.js
//
// v1 single-user authentication: one shared password (DASHBOARD_PASSWORD env var),
// session represented as a signed cookie (HMAC-SHA256, no external deps).
//
// FORWARD-COMPATIBILITY NOTE FOR v2 (multi-user):
// Every authenticated request resolves to a `userId` string via `getSession(req)`.
// In v1 this is always the constant OWNER_USER_ID ('owner'), matching the
// `user_id` default in the `projects` table. When v2 adds real per-user
// accounts (e.g. Supabase Auth), only this file needs to change — swap
// `getSession()` to validate a real user session and return that user's ID.
// All dashboard API routes already call `getSession()` and filter by the
// returned `userId`, so they require no changes.

import { createHmac, timingSafeEqual } from 'crypto';

export const OWNER_USER_ID = 'owner';

const COOKIE_NAME = 'mek_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  const secret = process.env.DASHBOARD_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      'Missing DASHBOARD_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY as fallback) environment variable.'
    );
  }
  return secret;
}

function sign(value) {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

/**
 * Create a signed session token for the given user ID + expiry timestamp.
 * Format: "<userId>.<expiresAt>.<signature>"
 */
function createToken(userId) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

/**
 * Verify a session token. Returns the userId if valid, or null if invalid/expired.
 */
function verifyToken(token) {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [userId, expiresAtStr, signature] = parts;
  const payload = `${userId}.${expiresAtStr}`;
  const expected = sign(payload);

  // Constant-time comparison to avoid timing attacks
  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) return null;

  return userId;
}

/**
 * Check the submitted password against DASHBOARD_PASSWORD.
 * Returns true/false. Uses constant-time comparison.
 */
export function checkPassword(submitted) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    throw new Error('Missing DASHBOARD_PASSWORD environment variable.');
  }
  if (typeof submitted !== 'string' || submitted.length === 0) return false;

  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Build the Set-Cookie header value for a new session.
 */
export function createSessionCookie(userId = OWNER_USER_ID) {
  const token = createToken(userId);
  const maxAge = SESSION_MAX_AGE_SECONDS;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Build the Set-Cookie header value to clear the session (logout).
 */
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/**
 * Parse cookies from a request's Cookie header into an object.
 */
function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

/**
 * Get the current session's userId from the request, or null if unauthenticated.
 */
export function getSession(req) {
  const cookies = parseCookies(req);
  return verifyToken(cookies[COOKIE_NAME]);
}

/**
 * Express/Vercel-style middleware helper: throws a 401 response if not authenticated.
 * Returns the userId if authenticated.
 *
 * Usage in an API route:
 *   const userId = requireAuth(req, res);
 *   if (!userId) return; // response already sent
 */
export function requireAuth(req, res) {
  const userId = getSession(req);
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Not authenticated.' });
    return null;
  }
  return userId;
}
