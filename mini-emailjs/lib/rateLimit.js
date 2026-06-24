// lib/rateLimit.js
// Simple per-project, per-IP rate limiting based on the submissions log.
// Counts how many submissions (any status) came from this IP in the
// last hour, and compares against the project's configured limit.

import { supabase } from './supabase.js';

/**
 * @param {string} projectId
 * @param {string} ipAddress
 * @param {number} limitPerHour
 * @returns {Promise<{ allowed: boolean, count: number }>}
 */
export async function checkRateLimit(projectId, ipAddress, limitPerHour) {
  if (!ipAddress) {
    // If we can't determine the IP, don't block — but this should rarely happen.
    return { allowed: true, count: 0 };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('ip_address', ipAddress)
    .gte('created_at', oneHourAgo);

  if (error) {
    // Fail open: if the rate-limit check itself errors, don't block legitimate users.
    console.error('Rate limit check failed:', error.message);
    return { allowed: true, count: 0 };
  }

  return {
    allowed: (count ?? 0) < limitPerHour,
    count: count ?? 0,
  };
}
