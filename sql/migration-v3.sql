-- ════════════════════════════════════════════════════════════════
-- Mini-EmailJS v3 Migration
-- Run this in Supabase SQL Editor if you already have the
-- projects table from a previous version.
-- Safe to run multiple times (IF NOT EXISTS guards).
-- ════════════════════════════════════════════════════════════════

-- 1. Form builder config persistence
alter table projects
  add column if not exists form_builder_config jsonb not null default '{}'::jsonb;

-- 2. Auto-reply settings
alter table projects
  add column if not exists auto_reply_enabled boolean not null default false;

alter table projects
  add column if not exists auto_reply_subject text not null
  default 'Thanks for reaching out — we''ll be in touch soon.';

alter table projects
  add column if not exists auto_reply_body text not null
  default E'Hi {{from_name}},\n\nThanks for getting in touch. We''ve received your message and will get back to you within one business day.\n\nBest,\nThe Team';

-- Verify all columns are present
select
  column_name,
  data_type,
  column_default
from information_schema.columns
where table_name = 'projects'
order by ordinal_position;
