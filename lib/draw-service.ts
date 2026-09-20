import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { subscriptionState } from '@/lib/subscription';
import { computePoolTotal, type Entry } from '@/lib/draw';
import { MAX_SCORES } from '@/lib/scores';

/**
 * Snapshot of who can enter a draw right now.
 *  - Pool is based on ALL active subscribers (PRD §07).
 *  - Entries are active subscribers who have all 5 scores logged (PRD §05).
 */
export async function loadDrawInputs(poolPercent: number) {
  const admin = createAdminClient();
  const { data: subs } = await admin.from('subscriptions').select('user_id,plan,amount_cents,status,current_period_end');
  const active = (subs || []).filter((s: any) => subscriptionState(s) === 'active');
  const ids = active.map((s: any) => s.user_id);

  let scoreRows: any[] = [];
  let names: Record<string, string> = {};
  if (ids.length) {
    const [{ data: sc }, { data: pr }] = await Promise.all([
      admin.from('scores').select('user_id,score').in('user_id', ids),
      admin.from('profiles').select('id,full_name').in('id', ids),
    ]);
    scoreRows = sc || [];
    (pr || []).forEach((p: any) => { names[p.id] = p.full_name || 'Subscriber'; });
  }

  const byUser = new Map<string, number[]>();
  scoreRows.forEach((r) => byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r.score]));
  const entries: Entry[] = [...byUser.entries()]
    .filter(([, s]) => s.length === MAX_SCORES)
    .map(([userId, scores]) => ({ userId, scores }));

  return {
    activeSubscribers: active.length,
    totalPoolCents: computePoolTotal(active, poolPercent),
    entries,
    allScores: scoreRows.map((r) => r.score as number),
    names,
  };
}

/** Jackpot carried forward from the most recent published draw. */
export async function latestRollover(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('draws').select('jackpot_rollover_out_cents')
    .eq('status', 'published').order('month', { ascending: false }).limit(1).maybeSingle();
  return data?.jackpot_rollover_out_cents || 0;
}
