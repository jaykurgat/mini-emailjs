// lib/projects.js
//
// Centralized data-access layer for the `projects` and `submissions` tables.
// All dashboard API routes go through these functions rather than calling
// Supabase directly — this is what makes the v1 → v2 (multi-user) migration
// a small change: every function here already takes a `userId` and filters
// on it. In v1, `userId` is always OWNER_USER_ID ('owner'). In v2, it'll be
// a real per-user ID from the auth session — no call sites need to change.

import { randomBytes } from 'crypto';
import { supabase } from './supabase.js';
import { PROVIDER_NAMES } from './providers/index.js';

/** Generate a new API key for a project. */
export function generateApiKey() {
  return 'mek_' + randomBytes(24).toString('hex');
}

/** Convert a free-text name into a URL-safe project_id slug. */
export function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * List all projects owned by userId, most recent first.
 * Does not include sensitive fields beyond what the dashboard needs to display.
 */
export async function listProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, project_id, name, to_email, provider, from_email, is_active, allowed_origins, rate_limit_per_hour, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list projects: ${error.message}`);
  return data;
}

/**
 * Get a single project by project_id, scoped to userId.
 * Returns null if not found or not owned by this user.
 */
export async function getProject(userId, projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch project: ${error.message}`);
  return data;
}

/**
 * Create a new project owned by userId.
 *
 * @param {string} userId
 * @param {Object} input
 * @param {string} input.name
 * @param {string} [input.projectId] - if omitted, derived from name via slugify
 * @param {string} input.toEmail
 * @param {string} [input.fromEmail]
 * @param {'resend'|'smtp'} [input.provider] - defaults to 'resend'
 * @param {Object} [input.providerConfig]
 * @param {string} [input.subjectTemplate]
 * @param {string[]} [input.allowedOrigins]
 * @param {number} [input.rateLimitPerHour]
 *
 * @returns {Promise<Object>} the created project row (includes generated api_key)
 */
export async function createProject(userId, input) {
  const name = (input.name || '').trim();
  if (!name) throw new Error('Project name is required.');

  const toEmail = (input.toEmail || '').trim();
  if (!toEmail) throw new Error('Recipient email is required.');

  let projectId = slugify(input.projectId || name);
  if (!projectId) throw new Error('Could not derive a valid project ID from the name.');

  const provider = input.provider || 'resend';
  if (!PROVIDER_NAMES.includes(provider)) {
    throw new Error(`Invalid provider "${provider}". Must be one of: ${PROVIDER_NAMES.join(', ')}`);
  }

  const fromEmail =
    (input.fromEmail || '').trim() || (provider === 'resend' ? 'onboarding@resend.dev' : toEmail);

  // Ensure project_id is unique — append a short suffix if needed
  projectId = await ensureUniqueProjectId(projectId);

  const row = {
    project_id: projectId,
    api_key: generateApiKey(),
    user_id: userId,
    name,
    to_email: toEmail,
    from_email: fromEmail,
    provider,
    provider_config: input.providerConfig || {},
    subject_template: input.subjectTemplate || 'New form submission from {{from_name}}',
    allowed_origins: input.allowedOrigins || [],
    rate_limit_per_hour: input.rateLimitPerHour || 20,
  };

  const { data, error } = await supabase.from('projects').insert(row).select().single();
  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data;
}

/** Internal: append -2, -3, etc. if the slug is already taken. */
async function ensureUniqueProjectId(baseSlug) {
  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    const { data, error } = await supabase
      .from('projects')
      .select('project_id')
      .eq('project_id', candidate)
      .maybeSingle();

    if (error) throw new Error(`Failed to check project ID uniqueness: ${error.message}`);
    if (!data) return candidate;

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

/**
 * Update an existing project, scoped to userId.
 * Only fields present in `updates` are changed.
 */
export async function updateProject(userId, projectId, updates) {
  const allowedFields = [
    'name',
    'to_email',
    'from_email',
    'provider',
    'provider_config',
    'subject_template',
    'allowed_origins',
    'rate_limit_per_hour',
    'is_active',
  ];

  const patch = {};
  for (const key of allowedFields) {
    if (key in updates) patch[key] = updates[key];
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No valid fields to update.');
  }

  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to update project: ${error.message}`);
  if (!data) throw new Error('Project not found.');
  return data;
}

/**
 * Delete a project (and its submissions, via cascade), scoped to userId.
 */
export async function deleteProject(userId, projectId) {
  // Verify ownership first so we don't silently no-op on someone else's project
  const existing = await getProject(userId, projectId);
  if (!existing) throw new Error('Project not found.');

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('user_id', userId)
    .eq('project_id', projectId);

  if (error) throw new Error(`Failed to delete project: ${error.message}`);
  return true;
}

/**
 * Regenerate a project's API key, scoped to userId.
 */
export async function regenerateApiKey(userId, projectId) {
  const newKey = generateApiKey();

  const { data, error } = await supabase
    .from('projects')
    .update({ api_key: newKey })
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to regenerate API key: ${error.message}`);
  if (!data) throw new Error('Project not found.');
  return data;
}

/**
 * Get recent submissions for a project, scoped to userId
 * (ownership verified by checking the project belongs to userId first).
 */
export async function listSubmissions(userId, projectId, { limit = 50 } = {}) {
  const project = await getProject(userId, projectId);
  if (!project) throw new Error('Project not found.');

  const { data, error } = await supabase
    .from('submissions')
    .select('id, payload, status, error_message, ip_address, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list submissions: ${error.message}`);
  return data;
}

/**
 * Get summary stats for a project's submissions (counts by status).
 */
export async function getSubmissionStats(userId, projectId) {
  const project = await getProject(userId, projectId);
  if (!project) throw new Error('Project not found.');

  const { data, error } = await supabase
    .from('submissions')
    .select('status')
    .eq('project_id', projectId);

  if (error) throw new Error(`Failed to fetch submission stats: ${error.message}`);

  const stats = { total: data.length, sent: 0, blocked: 0, error: 0 };
  for (const row of data) {
    if (row.status in stats) stats[row.status] += 1;
  }
  return stats;
}
