-- ════════════════════════════════════════════
-- Mini-EmailJS — Supabase Schema
-- Run this in the Supabase SQL Editor once,
-- when setting up a new Supabase project.
-- ════════════════════════════════════════════

-- Projects table: one row per website/client using the platform
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  project_id text unique not null,
  api_key text unique not null,
  user_id text not null default 'owner',
  name text not null,
  to_email text not null,
  from_email text not null default 'onboarding@resend.dev',
  provider text not null default 'resend' check (provider in ('resend', 'smtp')),
  provider_config jsonb not null default '{}'::jsonb,
  subject_template text not null default 'New form submission from {{from_name}}',
  allowed_origins text[] not null default '{}',
  rate_limit_per_hour int not null default 20,
  honeypot_field text default '_gotcha',
  is_active boolean not null default true,
  -- Form builder: saves last field/theme config so it persists across page loads
  form_builder_config jsonb not null default '{}'::jsonb,
  -- Auto-reply: optional confirmation email sent to the form submitter
  auto_reply_enabled boolean not null default false,
  auto_reply_subject text not null default 'Thanks for reaching out — we''ll be in touch soon.',
  auto_reply_body text not null default 'Hi {{from_name}},\n\nThanks for getting in touch. We''ve received your message and will get back to you within one business day.\n\nBest,\nThe Team',
  created_at timestamptz not null default now()
);

-- Index for dashboard "list my projects" queries
create index if not exists idx_projects_user_id
  on projects (user_id, created_at desc);

-- Submissions table: log of every send attempt (success or failure)
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(project_id) on delete cascade,
  payload jsonb not null,                 -- the raw form fields submitted
  status text not null,                   -- 'sent' | 'blocked' | 'error'
  error_message text,                     -- populated if status = 'error'
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Index for fast rate-limit lookups (per project + IP + time window)
create index if not exists idx_submissions_rate_limit
  on submissions (project_id, ip_address, created_at);

-- Index for dashboard queries (most recent submissions per project)
create index if not exists idx_submissions_project_created
  on submissions (project_id, created_at desc);

-- ════════════════════════════════════════════
-- MIGRATION (only needed if you already created
-- the `projects` table before the provider
-- abstraction was added — running schema.sql
-- fresh on a new project does not need this)
-- ════════════════════════════════════════════
-- alter table projects add column if not exists provider text not null default 'resend';
-- alter table projects add column if not exists provider_config jsonb not null default '{}'::jsonb;
-- alter table projects add constraint projects_provider_check check (provider in ('resend', 'smtp'));

-- ════════════════════════════════════════════
-- MIGRATION (only needed if you already created
-- the `projects` table before the dashboard/
-- user_id column was added)
-- ════════════════════════════════════════════
-- alter table projects add column if not exists user_id text not null default 'owner';
-- create index if not exists idx_projects_user_id on projects (user_id, created_at desc);

-- ════════════════════════════════════════════
-- MIGRATION: form builder persistence + auto-reply
-- Run these if you already have the projects table
-- ════════════════════════════════════════════
-- alter table projects add column if not exists form_builder_config jsonb not null default '{}'::jsonb;
-- alter table projects add column if not exists auto_reply_enabled boolean not null default false;
-- alter table projects add column if not exists auto_reply_subject text not null default 'Thanks for reaching out — we''ll be in touch soon.';
-- alter table projects add column if not exists auto_reply_body text not null default 'Hi {{from_name}},\n\nThanks for getting in touch. We''ll get back to you within one business day.\n\nBest,\nThe Team';
