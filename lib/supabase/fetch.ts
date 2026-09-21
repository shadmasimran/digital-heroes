/**
 * Next.js 14 caches server-side fetch() calls by default. supabase-js uses fetch, so reads
 * could return stale rows right after a write (e.g. "no subscription" right after paying).
 * Every Supabase server client therefore uses this no-store fetch.
 */
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });
