import { createAdminClient } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/settings';
import { loadDrawInputs, latestRollover } from '@/lib/draw-service';
import { subscriptionState } from '@/lib/subscription';
import { money } from '@/lib/format';
import { Flash } from '@/components/Flash';

export default async function AdminOverview({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  const admin = createAdminClient();
  const settings = await getSettings();
  const [{ count: users }, { data: subs }, { data: contribs }, { data: draws }, { data: winners }, { data: charities }, inputs, rollover] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('subscriptions').select('plan,status,current_period_end'),
    admin.from('contributions').select('charity_id,amount_cents,source'),
    admin.from('draws').select('status,pool_total_cents,rollover_in_cents'),
    admin.from('winners').select('tier,prize_cents,payment_status'),
    admin.from('charities').select('id,name'),
    loadDrawInputs(settings.prize_pool_percent),
    latestRollover(),
  ]);

  const active = (subs || []).filter((s: any) => subscriptionState(s) === 'active');
  const published = (draws || []).filter((d: any) => d.status === 'published');
  const awarded = (winners || []).reduce((s: number, w: any) => s + w.prize_cents, 0);
  const paid = (winners || []).filter((w: any) => w.payment_status === 'paid').reduce((s: number, w: any) => s + w.prize_cents, 0);
  const totalGiven = (contribs || []).reduce((s: number, c: any) => s + c.amount_cents, 0);
  const byCharity = (charities || []).map((c: any) => ({
    name: c.name,
    total: (contribs || []).filter((x: any) => x.charity_id === c.id).reduce((s: number, x: any) => s + x.amount_cents, 0),
  })).sort((a: any, b: any) => b.total - a.total);
  const maxCharity = Math.max(1, ...byCharity.map((c: any) => c.total));
  const tiers = [5, 4, 3].map((t) => ({ t, n: (winners || []).filter((w: any) => w.tier === t).length }));

  const stat = (label: string, value: string, note?: string) => (
    <div className="panel">
      <p className="text-sm text-kelp/60">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {note && <p className="mt-1 text-sm text-kelp/60">{note}</p>}
    </div>
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl">Overview</h1>
        <div className="mt-5"><Flash msg={searchParams.msg} error={searchParams.error} /></div>
      </div>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key numbers">
        {stat('Total users', String(users || 0))}
        {stat('Active subscribers', String(active.length), `${active.filter((s: any) => s.plan === 'yearly').length} yearly, ${active.filter((s: any) => s.plan === 'monthly').length} monthly`)}
        {stat('Prize pool this month', money(inputs.totalPoolCents + rollover), rollover > 0 ? `includes ${money(rollover)} rolled-over jackpot` : `${settings.prize_pool_percent}% of active subscriptions`)}
        {stat('Given to charities', money(totalGiven), 'subscription shares and donations')}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <h2 className="text-2xl">Charity contributions</h2>
          {byCharity.length === 0 ? <p className="mt-4 text-kelp/60">No charities yet.</p> : (
            <ul className="mt-5 space-y-4">
              {byCharity.map((c: any) => (
                <li key={c.name}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{c.name}</span><span>{money(c.total)}</span></div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-tide" style={{ width: `${(c.total / maxCharity) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h2 className="text-2xl">Draw statistics</h2>
          <dl className="mt-5 grid grid-cols-2 gap-5">
            <div><dt className="text-sm text-kelp/60">Draws published</dt><dd className="font-display text-3xl">{published.length}</dd></div>
            <div><dt className="text-sm text-kelp/60">Total awarded</dt><dd className="font-display text-3xl">{money(awarded)}</dd></div>
            <div><dt className="text-sm text-kelp/60">Paid out</dt><dd className="font-display text-3xl">{money(paid)}</dd></div>
            <div><dt className="text-sm text-kelp/60">Awaiting payout</dt><dd className="font-display text-3xl">{money(awarded - paid)}</dd></div>
          </dl>
          <p className="mt-6 text-sm font-semibold">Winners by tier</p>
          <div className="mt-2 flex gap-3">
            {tiers.map((x) => <span key={x.t} className="pill bg-mist px-4 py-2 text-sm">{x.t} matches: {x.n}</span>)}
          </div>
        </div>
      </section>
    </div>
  );
}
