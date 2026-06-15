-- ════════════════════════════════════════════
-- Mini-EmailJS — Supabase Schema
-- Run this in the Supabase SQL Editor once,
-- when setting up a new Supabase project.
-- ════════════════════════════════════════════

-- Projects table: one row per website/client using the platform
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  project_id text unique not null,        -- short slug used in the API URL, e.g. "apexops"
  api_key text unique not null,           -- secret key the frontend sends to authenticate
  user_id text not null default 'owner',  -- owner of this project. v1: always 'owner'
                                           -- (single-user mode). v2: a real user ID once
                                           -- multi-user auth is added — every dashboard
                                           -- query will filter by this column.
  name text not null,                     -- human-readable name, e.g. "ApexOps Website"
  to_email text not null,                 -- where notification emails are delivered
  from_email text not null default 'onboarding@resend.dev', -- sender address shown to recipients
  provider text not null default 'resend' check (provider in ('resend', 'smtp')),
                                           -- which email provider this project uses
  provider_config jsonb not null default '{}'::jsonb,
                                           -- provider-specific credentials, e.g.
                                           -- { "host": "smtp.gmail.com", "port": 465,
                                           --   "user": "you@gmail.com", "pass": "app-password" }
                                           -- empty for 'resend' (uses platform RESEND_API_KEY)
  subject_template text not null default 'New form submission from {{from_name}}',
  allowed_origins text[] not null default '{}', -- e.g. ARRAY['https://apexops.com']
  rate_limit_per_hour int not null default 20,   -- max submissions per IP per hour
  honeypot_field text default '_gotcha',  -- field name that must stay empty (spam trap)
  is_active boolean not null default true,
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
