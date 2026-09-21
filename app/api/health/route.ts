import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cleanEnv, isCleanEnv } from '@/lib/supabase/env';
import { demoPayments, stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/** Reads the (non-secret) "role" claim of a Supabase key: "anon" or "service_role". */
function keyRole(key?: string): string | null {
  try {
    const payload = cleanEnv(key).split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Error text is shown on a PUBLIC page, so it must never contain a secret.
 * Anything that looks like a key or token is replaced, and the text is shortened.
 */
function safe(message: string): string {
  return message
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]')
    .replace(/sb_(secret|publishable)_[\w-]+/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 160);
}

/**
 * Deployment self-check. Reports whether the environment variables look right and whether
 * the database is reachable with each key. Returns only booleans, roles and counts,
 * never a secret. Delete app/api/health if you do not want it public.
 */
export async function GET() {
  const out: Record<string, unknown> = {
    supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKeyRole: keyRole(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),      // should be "anon"
    serviceKeyRole: keyRole(process.env.SUPABASE_SERVICE_ROLE_KEY),       // should be "service_role"
    anonKeyFormatOk: isCleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceKeyFormatOk: isCleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY), // false = stray spaces/lines in the variable
    testPaymentsEnabled: demoPayments,
    stripeConfigured: Boolean(stripe),
  };

  try {
    const { count, error } = await createAdminClient().from('subscriptions').select('id', { count: 'exact', head: true });
    out.serviceKeyDatabaseAccess = error ? { ok: false, error: safe(error.message) } : { ok: true, subscriptions: count };
  } catch (e) {
    out.serviceKeyDatabaseAccess = { ok: false, error: safe(String(e)) };
  }
  try {
    const { count, error } = await createClient().from('charities').select('id', { count: 'exact', head: true });
    out.anonKeyDatabaseAccess = error ? { ok: false, error: safe(error.message) } : { ok: true, charities: count };
  } catch (e) {
    out.anonKeyDatabaseAccess = { ok: false, error: safe(String(e)) };
  }
  return NextResponse.json(out);
}
