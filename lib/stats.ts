import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Public, aggregate-only numbers for the homepage (no personal data). */
export async function getPublicStats() {
  try {
    const admin = createAdminClient();
    const supabase = createClient(); // charities are publicly readable, so no service key is needed for the count
    const [contributions, charities] = await Promise.all([
      admin.from('contributions').select('amount_cents'),
      supabase.from('charities').select('id', { count: 'exact', head: true }).eq('active', true),
    ]);
    if (contributions.error) console.error('stats: contributions query failed', contributions.error.message);
    if (charities.error) console.error('stats: charities query failed', charities.error.message);
    const raised = (contributions.data || []).reduce((s: number, c: any) => s + c.amount_cents, 0);
    return { raised, charities: charities.count || 0 };
  } catch (e) {
    console.error('stats failed', e);
    return { raised: 0, charities: 0 };
  }
}
