// api/projects/index.js
//
// GET  /api/projects        — list all projects for the logged-in user
// POST /api/projects        — create a new project
//
// Both require an authenticated session (cookie set by /api/auth/login).

import { requireAuth } from '../../lib/auth.js';
import { listProjects, createProject } from '../../lib/projects.js';
import { getConfigSchema, PROVIDER_NAMES } from '../../lib/providers/index.js';

export default async function handler(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return; // 401 already sent

  if (req.method === 'GET') {
    try {
      const projects = await listProjects(userId);
      return res.status(200).json({ ok: true, projects });
    } catch (err) {
      console.error('List projects error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      if (body.provider && !PROVIDER_NAMES.includes(body.provider)) {
        return res.status(400).json({
          ok: false,
          error: `Invalid provider. Must be one of: ${PROVIDER_NAMES.join(', ')}`,
        });
      }

      // Validate required provider_config fields if SMTP
      if (body.provider === 'smtp') {
        const schema = getConfigSchema('smtp');
        const config = body.providerConfig || {};
        const missing = schema.filter((f) => f.required && !config[f.key]);
        if (missing.length > 0) {
          return res.status(400).json({
            ok: false,
            error: `Missing required SMTP fields: ${missing.map((f) => f.label).join(', ')}`,
          });
        }
      }

      const project = await createProject(userId, {
        name: body.name,
        projectId: body.projectId,
        toEmail: body.toEmail,
        fromEmail: body.fromEmail,
        provider: body.provider,
        providerConfig: body.providerConfig,
        subjectTemplate: body.subjectTemplate,
        allowedOrigins: body.allowedOrigins,
        rateLimitPerHour: body.rateLimitPerHour,
      });

      return res.status(201).json({ ok: true, project });
    } catch (err) {
      console.error('Create project error:', err.message);
      return res.status(400).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET or POST.' });
}
