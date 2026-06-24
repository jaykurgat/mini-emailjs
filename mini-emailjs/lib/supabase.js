// lib/supabase.js
// Creates a Supabase client using the service-role key.
// IMPORTANT: the service-role key bypasses Row Level Security —
// it must ONLY ever be used server-side (in /api functions),
// never exposed to the browser.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
