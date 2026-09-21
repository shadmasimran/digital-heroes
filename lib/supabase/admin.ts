import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { noStoreFetch } from '@/lib/supabase/fetch';
import { cleanEnv } from '@/lib/supabase/env';

/**
 * Service-role client. BYPASSES RLS — only use in server code AFTER the caller
 * has been authorised (requireAdmin / requireUser). Never import in client code.
 */
export function createAdminClient() {
  return createClient(cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL), cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}
