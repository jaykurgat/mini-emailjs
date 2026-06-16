// lib/supabase.js
// Creates a Supabase client using the service-role key.
// IMPORTANT: the service-role key bypasses Row Level Security —
// it must ONLY ever be used server-side (in /api functions),
// never exposed to the browser.

import { createClient } from '@supabase/supabase-js';

// .trim() defensively strips accidental leading/trailing whitespace or
// newlines that can sneak in when copy-pasting keys into Vercel's
// environment variable fields — a surprisingly common cause of
// "Invalid API key" errors that are otherwise hard to spot, since the
// extra whitespace is invisible in most UIs.
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
