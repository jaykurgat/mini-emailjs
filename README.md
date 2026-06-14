# Mini-EmailJS

A self-hosted, multi-tenant transactional email API for website contact forms.
Think of it as **your own EmailJS** — but you own the infrastructure, the data,
and **each project can use whichever email provider you want**: Resend (built
in, zero setup) or your own Gmail/Outlook/SMTP account — exactly like the
Gmail-via-EmailJS setup you're used to, just self-hosted.

Built to run entirely on free tiers:
- **Vercel** — serverless functions (the API)
- **Supabase** — Postgres database (projects + submission logs)
- **Resend** (default) or **any SMTP server including Gmail** — email sending

---

## How it works

```
Your website's form
        │
        ▼  POST /api/send/:projectId  { apiKey, ...formFields }
┌─────────────────────────────────────┐
│  Vercel Serverless Function          │
│  1. Look up project by projectId     │
│  2. Validate API key + origin        │
│  3. Check honeypot field             │
│  4. Check rate limit (per IP/hour)   │
│  5. Render email from template       │
│  6. Send via project's provider ──┐  │
│  7. Log submission to Supabase    │  │
└────────────────────────────────────┼──┘
                                      │
                ┌─────────────────────┴─────────────────────┐
                ▼                                             ▼
        Resend (default,                          SMTP — Gmail, Outlook,
        platform-wide API key,                     Zoho, or any mail server
        zero setup per project)                    (project's own credentials)
                │                                             │
                └──────────────────┬──────────────────────────┘
                                     ▼
                          Email lands in your inbox
```

Each website/client you support is a **"project"** — its own row in the
database with its own API key, recipient email, subject template, allowed
origins, rate limit, **and email provider**. One deployment can serve
unlimited projects, each sending through whichever provider makes sense for
that client — Resend by default, or their own Gmail/SMTP if they prefer to
"bring their own" email account.

---

## Setup (one-time)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project (free tier)
2. Once created, go to **SQL Editor** → paste the contents of
   [`sql/schema.sql`](sql/schema.sql) → Run
3. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role key** (under "Project API keys") → this is `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ This key bypasses all security rules — never expose it to a browser.

### 2. Create a Resend account

1. Go to [resend.com](https://resend.com) → sign up (free tier)
2. Go to **API Keys** → create a new key → this is `RESEND_API_KEY`
3. (Optional, recommended) Verify your own domain under **Domains** so you
   can send from `notifications@yourdomain.com` instead of the shared
   `onboarding@resend.dev` address. Verifying a domain improves deliverability.

### 3. Push this repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/mini-emailjs.git
git push -u origin main
```

### 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your
   GitHub repo
2. In the project's **Settings → Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `RESEND_API_KEY` | from step 2 |
3. Deploy. You'll get a URL like `https://mini-emailjs.vercel.app`

---

## Email providers

Each project picks its own provider at creation time. Two are built in:

### `resend` (default — no setup needed)
Uses the platform-wide `RESEND_API_KEY` you set in Vercel. Good default for
new projects — generous free tier, great deliverability, zero per-project config.

### `smtp` — bring your own Gmail, Outlook, Zoho, or any mail server
Sends through credentials **you provide per project** — no shared platform
account needed. This is the closest equivalent to what you were doing with
EmailJS + Gmail, just self-hosted.

**Gmail setup:**
1. Enable **2-Step Verification** on the Google account (required for App Passwords):
   https://myaccount.google.com/security
2. Generate an **App Password**: https://myaccount.google.com/apppasswords
   — choose "Mail" as the app, copy the 16-character password
3. When running `npm run create-project`, choose provider `smtp` and enter:
   - **host**: `smtp.gmail.com`
   - **port**: `465`
   - **user**: the full Gmail address (e.g. `jaykurgat@gmail.com`)
   - **pass**: the 16-character App Password (not your normal Gmail password)

**Outlook / Office365:**
- host: `smtp.office365.com`, port: `587`

**Zoho Mail:**
- host: `smtp.zoho.com`, port: `465`

**Any other SMTP server:** just provide its host/port/user/password — the
`smtp` provider works with anything nodemailer supports.

### Adding more providers later
The provider system is pluggable — see `lib/providers/index.js`. To add
SendGrid, Postmark, Mailgun, etc., create `lib/providers/your-provider.js`
exporting `sendEmail()` and `configSchema`, then register it in the
`providers` map. No changes needed to the API handler or CLI — both adapt
automatically based on `configSchema`.

---

## Creating a project (per client/website)

Run the CLI locally (it talks directly to Supabase using your service role key):

```bash
# Copy and fill in your real credentials
cp .env.example .env

# Install dependencies
npm install

# Create a new project — follow the prompts
npm run create-project
```

You'll be asked for:
- **Project name** — e.g. "ApexOps Website"
- **Project ID / slug** — used in the API URL, e.g. `apexops`
- **Recipient email** — where notifications go, e.g. `jaykurgat@gmail.com`
- **Provider** — `resend` (default, zero setup) or `smtp` (your own Gmail/Outlook/
  Zoho/any SMTP server). See [Email providers](#email-providers) above for
  Gmail App Password setup.
- **From address** — `onboarding@resend.dev` for Resend, or your own address
  for SMTP (should match the SMTP account's address)
- **Provider config** (SMTP only) — host, port, username, and password/app
  password for your SMTP server
- **Subject template** — supports `{{field_name}}` placeholders
- **Allowed origins** — comma-separated list of domains allowed to call this
  endpoint (e.g. `https://apexops.com`). Leave blank to allow any origin
  (fine for testing, tighten before going live).
- **Rate limit** — max submissions per IP per hour (default 20)

The script outputs your **Project ID** and **API Key** — save these. The API
key is shown only once (though it's also stored in the database if you need
to look it up later via the Supabase dashboard).

---

## Wiring up a website's form

On the client website, replace the EmailJS call with a plain `fetch()`:

```html
<form id="contact-form">
  <input type="text" name="from_name" required/>
  <input type="email" name="email" required/>
  <textarea name="message" required></textarea>

  <!-- Honeypot — keep this hidden via CSS; bots tend to fill it in -->
  <input type="text" name="_gotcha" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off"/>

  <button type="submit">Send</button>
</form>

<script>
  const ENDPOINT = 'https://mini-emailjs.vercel.app/api/send/apexops';
  const API_KEY  = 'mek_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.apiKey = API_KEY;

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (result.ok) {
      alert('Message sent!');
      e.target.reset();
    } else {
      alert('Error: ' + result.error);
    }
  });
</script>
```

See [`public/demo.html`](public/demo.html) for a complete working example
with styling and status messages.

### Email subject template placeholders

The `subject_template` field supports `{{field_name}}` for any field your
form submits. Example:

```
New Diagnostic Application — {{company}} ({{from_name}})
```

If a form submits `company` and `from_name` fields, these get substituted
automatically. Unmatched placeholders render as empty strings.

### Email body

The email body is generated automatically — every form field (except
`apiKey` and any field starting with `_`) is rendered as a labeled row,
plus metadata (project name, submission time, IP address).

---

## Security notes

- **API keys are per-project**, not global — if one client's key leaks, only
  that project is affected. Rotate by editing the row directly in Supabase
  (Table Editor → `projects` → update `api_key`) — there's currently no CLI
  for rotation, but it's a one-line SQL update:
  ```sql
  update projects set api_key = 'mek_new_key_here' where project_id = 'apexops';
  ```
- **Allowed origins** restrict which websites can successfully call the
  endpoint (CORS). Set this in production — leaving it blank allows any
  origin, which is fine for testing but should be tightened before launch.
- **Honeypot field** (`_gotcha` by default) — a hidden form field that real
  users never fill in. If a bot fills it, the submission is silently dropped
  (the API still returns success so the bot doesn't retry/escalate).
- **Rate limiting** is per-project, per-IP, per-hour — defends against
  accidental loops or basic abuse. Not a substitute for a CAPTCHA if you
  expect targeted spam.
- The **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) must only ever live
  in Vercel's environment variables or your local `.env` — never in
  client-side code or committed to git (`.gitignore` already excludes `.env`).
- **SMTP credentials** (Gmail App Passwords, etc.) are stored in each
  project's `provider_config` column in Supabase. They're only ever read
  server-side by the API function — never sent to the browser. Treat your
  Supabase dashboard access as sensitive, since it can read these values.
  If a Gmail App Password is ever compromised, revoke it at
  https://myaccount.google.com/apppasswords and generate a new one, then
  update `provider_config` for that project.

---

## Viewing submission history

All submissions (sent, blocked, and errored) are logged to the `submissions`
table in Supabase. View them via:

- **Supabase Dashboard → Table Editor → submissions**, or
- SQL query, e.g. recent submissions for a project:
  ```sql
  select created_at, status, payload, error_message
  from submissions
  where project_id = 'apexops'
  order by created_at desc
  limit 50;
  ```

A web dashboard for this is a natural v2 addition — not included in v1 to
keep the initial build lean.

---

## Project structure

```
mini-emailjs/
├── api/
│   └── send/
│       └── [projectId].js   ← the core API endpoint (Vercel serverless function)
├── lib/
│   ├── supabase.js          ← Supabase client (service role)
│   ├── render.js             ← email template rendering + HTML body builder
│   ├── rateLimit.js          ← per-IP rate limiting
│   └── providers/
│       ├── index.js          ← provider registry + dispatcher
│       ├── resend.js          ← Resend provider (platform-wide API key)
│       └── smtp.js             ← SMTP provider (Gmail, Outlook, Zoho, etc.)
├── sql/
│   └── schema.sql            ← Supabase table definitions (run once)
├── scripts/
│   └── create-project.js     ← CLI to register new projects (asks for provider)
├── public/
│   └── demo.html              ← working example form
├── .env.example
├── vercel.json
├── package.json
└── README.md
```

---

## Roadmap / v2 ideas

- Web dashboard (view submissions, create/edit projects without SQL)
- Email template editor with HTML preview
- Multiple recipients per project (CC/BCC)
- File attachment support
- Webhook on submission (e.g. forward to Slack/Discord)
- Per-project custom "from" domains
- API key rotation via CLI

---

## Free tier limits to be aware of

| Service | Free tier limit |
|---|---|
| Resend | 3,000 emails/month, 100/day |
| Supabase | 500MB database, 2GB bandwidth/month |
| Vercel | 100GB bandwidth/month, generous function execution limits |

For "own projects/clients" scale, this comfortably covers many sites. If you
outgrow Resend's free tier, their paid plans start cheap and scale linearly —
no code changes needed, just upgrade the account.
