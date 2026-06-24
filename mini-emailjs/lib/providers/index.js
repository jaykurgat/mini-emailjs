// lib/providers/index.js
//
// Provider registry. Each provider module exports:
//   - sendEmail({ from, to, subject, html, replyTo, config }) => Promise
//   - configSchema: [] describing what per-project config it needs
//
// To add a new provider:
//   1. Create lib/providers/your-provider.js exporting sendEmail + configSchema
//   2. Register it in the `providers` map below
//   3. Add the key to the `provider` check constraint in sql/schema.sql
//      (or remove the constraint if you prefer to skip that validation)

import * as resend from './resend.js';
import * as smtp from './smtp.js';

export const providers = {
  resend,
  smtp,
  // Add future providers here, e.g.:
  // sendgrid: await import('./sendgrid.js'),
  // postmark: await import('./postmark.js'),
};

export const PROVIDER_NAMES = Object.keys(providers);

/**
 * Send an email using the given project's configured provider.
 *
 * @param {Object} project - the project row from Supabase
 *   (must include `provider` and `provider_config`)
 * @param {Object} message - { from, to, subject, html, replyTo }
 */
export async function sendViaProvider(project, message) {
  const providerName = project.provider || 'resend';
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(
      `Unknown provider "${providerName}". Available: ${PROVIDER_NAMES.join(', ')}`
    );
  }

  return provider.sendEmail({
    ...message,
    config: project.provider_config || {},
  });
}

/**
 * Get the config schema for a provider — used by the CLI to know
 * which fields to prompt for when setting up a project.
 */
export function getConfigSchema(providerName) {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(
      `Unknown provider "${providerName}". Available: ${PROVIDER_NAMES.join(', ')}`
    );
  }
  return provider.configSchema || [];
}
