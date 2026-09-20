import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** Public, aggregate-only numbers for the homepage (no personal data). */
export async function getPublicStats() {
  try {
    const admin = createAdminClient();
    const [{ data: contribs }, { count: charities }] = await Promise.all([
      admin.from('contributions').select('amount_cents'),
      admin.from('charities').select('id', { count: 'exact', head: true }).eq('active', true),
    ]);
    const raised = (contribs || []).reduce((s: number, c: any) => s + c.amount_cents, 0);
    return { raised, charities: charities || 0 };
  } catch {
    return { raised: 0, charities: 0 };
  }
}
