# Mini-EmailJS — Setup Notes

## Environment Variables (Vercel)

Add these in Vercel → your project → Settings → Environment Variables.

### Required (core functionality)

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → Secret key |
| `RESEND_API_KEY` | resend.com → API Keys |
| `DASHBOARD_PASSWORD` | Choose a strong password — used to log into the dashboard |
| `DASHBOARD_SESSION_SECRET` | Any long random string (e.g. two UUIDs concatenated) |

### Required for password change feature (Option A)

| Variable | How to get it |
|---|---|
| `VERCEL_API_TOKEN` | vercel.com → Account Settings → Tokens → Create |
| `VERCEL_PROJECT_ID` | See steps below |
| `VERCEL_ENV_VAR_ID` | See steps below |

#### Step-by-step: getting VERCEL_PROJECT_ID and VERCEL_ENV_VAR_ID

**1. Get your VERCEL_API_TOKEN**
- Go to vercel.com → click your avatar (top right) → Settings → Tokens
- Click "Create Token"
- Name it `mini-emailjs-admin`, scope: Full Account
- Copy the token — shown only once

**2. Get VERCEL_PROJECT_ID**
- Go to vercel.com → your `mini-emailjs` project → Settings → General
- Scroll down to "Project ID" — copy it
- It looks like: `prj_xxxxxxxxxxxxxxxxxxxx`

**3. Get VERCEL_ENV_VAR_ID**

Run this curl command (replace YOUR_TOKEN and YOUR_PROJECT_ID):

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.vercel.com/v9/projects/YOUR_PROJECT_ID/env" \
  | python3 -m json.tool | grep -A3 "DASHBOARD_PASSWORD"
```

Look for the `"id"` field in the result for `DASHBOARD_PASSWORD`.
It looks like: `env_xxxxxxxxxxxxxxxxxxxx`

Or use this one-liner to extract it directly:
```bash
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.vercel.com/v9/projects/YOUR_PROJECT_ID/env" \
  | python3 -c "import json,sys; envs=json.load(sys.stdin)['envs']; print(next(e['id'] for e in envs if e['key']=='DASHBOARD_PASSWORD'))"
```

**4. Add all three to Vercel**
- `VERCEL_API_TOKEN` = the token from step 1
- `VERCEL_PROJECT_ID` = the project ID from step 2
- `VERCEL_ENV_VAR_ID` = the env var ID from step 3

After adding, redeploy once for the new variables to take effect.

---

## Database Migration (Supabase)

Run `sql/migration-v3.sql` in Supabase SQL Editor if you already have
the `projects` table from a previous version. This adds:
- `form_builder_config` — saves form builder selections per project
- `auto_reply_enabled` — toggle auto-reply on/off
- `auto_reply_subject` — auto-reply email subject
- `auto_reply_body` — auto-reply email body

```sql
alter table projects add column if not exists form_builder_config jsonb not null default '{}'::jsonb;
alter table projects add column if not exists auto_reply_enabled boolean not null default false;
alter table projects add column if not exists auto_reply_subject text not null default 'Thanks for reaching out — we''ll be in touch soon.';
alter table projects add column if not exists auto_reply_body text not null default E'Hi {{from_name}},\n\nThanks for getting in touch.\n\nBest,\nThe Team';
```

---

## Deployment Flow

1. Push code to GitHub → Vercel auto-redeploys
2. Visit `https://your-deployment.vercel.app` → redirects to `app.html`
3. Log in with `DASHBOARD_PASSWORD`
4. Create projects from the dashboard (no CLI needed)

---

## Migrating Password Storage to Supabase (Option B — future)

Currently passwords are stored as a Vercel environment variable (Option A).
To migrate to Supabase (Option B — faster, no redeploy needed on change):

1. Create a `settings` table in Supabase:
```sql
create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into settings (key, value) values ('dashboard_password', 'your-current-password');
```

2. Update `lib/auth.js`:
   - Replace `process.env.DASHBOARD_PASSWORD` reads with a Supabase query
   - `checkPassword()` fetches the hash from `settings` table
   - `change-password` endpoint updates the DB row instead of calling Vercel API

3. Remove `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ENV_VAR_ID` from Vercel env vars

---

## Gmail App Password Troubleshooting

If SMTP sends fail with `535 BadCredentials`:
1. Go to https://myaccount.google.com/apppasswords
2. Delete the old app password
3. Create a new one (name it anything)
4. Copy the 16 characters **without spaces**
5. Update `provider_config.pass` in Supabase → Table Editor → `projects` row

App passwords are revoked if you:
- Change your Gmail password
- Turn off 2-Step Verification
- Manually revoke them

They do NOT expire on their own if left alone.
