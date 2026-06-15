// api/providers.js
//
// GET /api/providers
//
// Returns the list of available email providers and the config fields
// each one needs, so the dashboard's "New Project" form can render the
// right inputs dynamically. No auth required — this is static metadata,
// not sensitive.
//
// Response:
//   { ok: true, providers: { resend: { configSchema: [] }, smtp: { configSchema: [...] } } }

import { PROVIDER_NAMES, getConfigSchema } from '../lib/providers/index.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET.' });
  }

  const providers = {};
  for (const name of PROVIDER_NAMES) {
    providers[name] = { configSchema: getConfigSchema(name) };
  }

  return res.status(200).json({ ok: true, providers });
}
