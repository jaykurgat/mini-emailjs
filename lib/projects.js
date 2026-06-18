// lib/projects.js — centralized data-access layer for projects and submissions.
// All queries are scoped by userId for forward-compatibility with multi-user (v2).

import { randomBytes } from 'crypto';
import { supabase } from './supabase.js';
import { PROVIDER_NAMES } from './providers/index.js';

export function generateApiKey() {
  return 'mek_' + randomBytes(24).toString('hex');
}

export function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function listProjects(userId) {
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, project_id, name, to_email, provider, from_email, is_active, allowed_origins, rate_limit_per_hour, auto_reply_enabled, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list projects: ${error.message}`);
  return data;
}

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
    form_builder_config: {},
    auto_reply_enabled: false,
    auto_reply_subject: "Thanks for reaching out — we'll be in touch soon.",
    auto_reply_body: "Hi {{from_name}},\n\nThanks for getting in touch. We've received your message and will get back to you within one business day.\n\nBest,\nThe Team",
  };

  const { data, error } = await supabase.from('projects').insert(row).select().single();
  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data;
}

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

export async function updateProject(userId, projectId, updates) {
  const allowedFields = [
    'name', 'to_email', 'from_email', 'provider', 'provider_config',
    'subject_template', 'allowed_origins', 'rate_limit_per_hour', 'is_active',
    'form_builder_config',
    'auto_reply_enabled', 'auto_reply_subject', 'auto_reply_body',
  ];

  const patch = {};
  for (const key of allowedFields) {
    if (key in updates) patch[key] = updates[key];
  }

  if (Object.keys(patch).length === 0) throw new Error('No valid fields to update.');

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

export async function deleteProject(userId, projectId) {
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

export async function listSubmissions(userId, projectId, { limit = 50 } = {}) {
  const project = await getProject(userId, projectId);
  if (!project) throw new Error('Project not found.');

  const { data, error } = await supabase
    .from('submissions')
    .select('id, payload, status, error_message, ip_address, user_agent, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list submissions: ${error.message}`);
  return data;
}

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
