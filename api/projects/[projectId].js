// api/projects/[projectId].js
//
// GET    /api/projects/:projectId  — get a single project's details + submission stats
// PATCH  /api/projects/:projectId  — update a project
// DELETE /api/projects/:projectId  — delete a project
//
// All require an authenticated session.

import { requireAuth } from '../../lib/auth.js';
import {
  getProject,
  updateProject,
  deleteProject,
  getSubmissionStats,
} from '../../lib/projects.js';
import { getConfigSchema, PROVIDER_NAMES } from '../../lib/providers/index.js';

export default async function handler(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { projectId } = req.query;

  if (req.method === 'GET') {
    try {
      const project = await getProject(userId, projectId);
      if (!project) return res.status(404).json({ ok: false, error: 'Project not found.' });

      const stats = await getSubmissionStats(userId, projectId);
      return res.status(200).json({ ok: true, project, stats });
    } catch (err) {
      console.error('Get project error:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = req.body || {};

      if (body.provider && !PROVIDER_NAMES.includes(body.provider)) {
        return res.status(400).json({
          ok: false,
          error: `Invalid provider. Must be one of: ${PROVIDER_NAMES.join(', ')}`,
        });
      }

      if (body.provider === 'smtp' && body.providerConfig) {
        const schema = getConfigSchema('smtp');
        const missing = schema.filter((f) => f.required && !body.providerConfig[f.key]);
        if (missing.length > 0) {
          return res.status(400).json({
            ok: false,
            error: `Missing required SMTP fields: ${missing.map((f) => f.label).join(', ')}`,
          });
        }
      }

      // Translate camelCase API body to snake_case DB columns
      const updates = {};
      if ('name' in body) updates.name = body.name;
      if ('toEmail' in body) updates.to_email = body.toEmail;
      if ('fromEmail' in body) updates.from_email = body.fromEmail;
      if ('provider' in body) updates.provider = body.provider;
      if ('providerConfig' in body) updates.provider_config = body.providerConfig;
      if ('subjectTemplate' in body) updates.subject_template = body.subjectTemplate;
      if ('allowedOrigins' in body) updates.allowed_origins = body.allowedOrigins;
      if ('rateLimitPerHour' in body) updates.rate_limit_per_hour = body.rateLimitPerHour;
      if ('isActive' in body) updates.is_active = body.isActive;

      const project = await updateProject(userId, projectId, updates);
      return res.status(200).json({ ok: true, project });
    } catch (err) {
      console.error('Update project error:', err.message);
      const status = err.message === 'Project not found.' ? 404 : 400;
      return res.status(status).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteProject(userId, projectId);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Delete project error:', err.message);
      const status = err.message === 'Project not found.' ? 404 : 500;
      return res.status(status).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET, PATCH, or DELETE.' });
}
