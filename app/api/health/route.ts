import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { demoPayments, stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/** Reads the (non-secret) "role" claim of a Supabase key: "anon" or "service_role". */
function keyRole(key?: string): string | null {
  try {
    const payload = key?.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Deployment self-check. Reports whether the environment variables are set correctly and
 * whether the database is reachable with each key. Returns no secrets, only booleans,
 * roles and counts. Safe to leave in place; delete it if you prefer.
 */
export async function GET() {
  const out: Record<string, unknown> = {
    supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKeyRole: keyRole(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), // should be "anon"
    serviceKeyRole: keyRole(process.env.SUPABASE_SERVICE_ROLE_KEY),  // should be "service_role"
    testPaymentsEnabled: demoPayments,
    stripeConfigured: Boolean(stripe),
  };

  try {
    const { count, error } = await createAdminClient().from('subscriptions').select('id', { count: 'exact', head: true });
    out.serviceKeyDatabaseAccess = error ? { ok: false, error: error.message } : { ok: true, subscriptions: count };
  } catch (e) {
    out.serviceKeyDatabaseAccess = { ok: false, error: String(e) };
  }
  try {
    const { count, error } = await createClient().from('charities').select('id', { count: 'exact', head: true });
    out.anonKeyDatabaseAccess = error ? { ok: false, error: error.message } : { ok: true, charities: count };
  } catch (e) {
    out.anonKeyDatabaseAccess = { ok: false, error: String(e) };
  }
  return NextResponse.json(out);
}
