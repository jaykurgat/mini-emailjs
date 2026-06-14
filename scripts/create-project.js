#!/usr/bin/env node
// scripts/create-project.js
//
// CLI tool to register a new project (website/client) in the platform.
//
// Usage:
//   npm run create-project
//
// You'll be prompted for the project details, including which email
// provider to use (Resend, or SMTP/Gmail with your own credentials).
// It generates a random API key and inserts a new row into the
// `projects` table.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
// (e.g. via a local .env file — run with: npm run create-project,
// which uses `node --env-file=.env`).

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import readline from 'readline';
import { PROVIDER_NAMES, getConfigSchema } from '../lib/providers/index.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('   Run with: npm run create-project (uses .env via --env-file)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

function generateApiKey() {
  return 'mek_' + randomBytes(24).toString('hex'); // "mek" = mini-emailjs key
}

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('\n🚀 Mini-EmailJS — Create New Project\n');

  const name = await ask('Project name (e.g. "ApexOps Website"): ');
  let projectId = await ask(`Project ID / slug [${slugify(name)}]: `);
  if (!projectId.trim()) projectId = slugify(name);
  projectId = slugify(projectId);

  const toEmail = await ask('Notification recipient email (e.g. you@gmail.com): ');

  // ── Provider selection ──
  console.log(`\nAvailable email providers: ${PROVIDER_NAMES.join(', ')}`);
  console.log('  - resend : uses this platform\'s shared Resend account (no setup needed)');
  console.log('  - smtp   : send via Gmail, Outlook, Zoho, or any SMTP server you provide\n');

  let provider = (await ask(`Provider [resend]: `)).trim().toLowerCase() || 'resend';
  if (!PROVIDER_NAMES.includes(provider)) {
    console.log(`⚠️  Unknown provider "${provider}", defaulting to "resend".`);
    provider = 'resend';
  }

  // ── From address ──
  const defaultFrom = provider === 'smtp' ? '' : 'onboarding@resend.dev';
  const fromPrompt =
    provider === 'smtp'
      ? 'Sender "from" address (use the same address as your SMTP user): '
      : `Sender "from" address [${defaultFrom}]: `;
  let fromEmail = (await ask(fromPrompt)).trim();
  if (!fromEmail) fromEmail = defaultFrom;

  // ── Provider-specific config ──
  const schema = getConfigSchema(provider);
  const providerConfig = {};

  if (schema.length > 0) {
    console.log(`\n— ${provider.toUpperCase()} configuration —`);

    if (provider === 'smtp') {
      console.log('Tip for Gmail: host=smtp.gmail.com, port=465, user=your Gmail address,');
      console.log('pass=a 16-character App Password from https://myaccount.google.com/apppasswords');
      console.log('(requires 2-Step Verification enabled on the Google account)\n');
    }

    for (const field of schema) {
      const defaultSuffix = field.default ? ` [${field.default}]` : '';
      const requiredSuffix = field.required ? ' (required)' : '';
      let value = await ask(`${field.label}${defaultSuffix}${requiredSuffix}: `);

      if (!value && field.default) value = field.default;

      if (field.required && !value) {
        console.log(`⚠️  "${field.label}" is required. You can edit provider_config later in Supabase if skipped.`);
      }

      if (field.type === 'number' && value) {
        value = parseInt(value, 10);
      }

      if (value !== '') providerConfig[field.key] = value;
    }
  }

  const subjectTemplate =
    (await ask('\nEmail subject template [New form submission from {{from_name}}]: ')) ||
    'New form submission from {{from_name}}';

  const originsInput = await ask(
    'Allowed origins, comma-separated (e.g. https://example.com) [leave blank to allow all]: '
  );
  const allowedOrigins = originsInput
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const rateLimitInput = await ask('Rate limit per IP per hour [20]: ');
  const rateLimit = parseInt(rateLimitInput, 10) || 20;

  rl.close();

  const apiKey = generateApiKey();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      project_id: projectId,
      api_key: apiKey,
      name,
      to_email: toEmail,
      from_email: fromEmail,
      provider,
      provider_config: providerConfig,
      subject_template: subjectTemplate,
      allowed_origins: allowedOrigins,
      rate_limit_per_hour: rateLimit,
    })
    .select()
    .single();

  if (error) {
    console.error('\n❌ Failed to create project:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Project created!\n');
  console.log('────────────────────────────────────────');
  console.log(`Project ID:  ${data.project_id}`);
  console.log(`Provider:    ${data.provider}`);
  console.log(`API Key:     ${data.api_key}`);
  console.log(`Endpoint:    https://YOUR-DEPLOYMENT.vercel.app/api/send/${data.project_id}`);
  console.log('────────────────────────────────────────\n');

  if (provider === 'smtp' && (!providerConfig.host || !providerConfig.user || !providerConfig.pass)) {
    console.log('⚠️  Note: some SMTP fields were left blank. Sending will fail until you');
    console.log('   fill them in via Supabase → Table Editor → projects → provider_config\n');
  }

  console.log('Add this to your website\'s form JavaScript:\n');
  console.log(`  const ENDPOINT = "https://YOUR-DEPLOYMENT.vercel.app/api/send/${data.project_id}";`);
  console.log(`  const API_KEY  = "${data.api_key}";\n`);
  console.log('See public/demo.html for a full working example.\n');
}

main();
