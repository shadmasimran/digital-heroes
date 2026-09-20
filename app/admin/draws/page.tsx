import { createAdminClient } from '@/lib/supabase/admin';
import { simulateDraw, publishDraw } from '@/app/actions/admin';
import { getSettings } from '@/lib/settings';
import { loadDrawInputs, latestRollover } from '@/lib/draw-service';
import { money, monthLabel, monthStart } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';
import { StatusPill } from '@/components/StatusPill';
import { NumberBalls } from '@/components/NumberBalls';

export default async function AdminDraws({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  const admin = createAdminClient();
  const settings = await getSettings();
  const [{ data: draws }, inputs, rollover] = await Promise.all([
    admin.from('draws').select('*').order('month', { ascending: false }),
    loadDrawInputs(settings.prize_pool_percent),
    latestRollover(),
  ]);
  const pending = (draws || []).filter((d: any) => d.status === 'simulated');
  const published = (draws || []).filter((d: any) => d.status === 'published');

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl">Draws</h1>
        <p className="mt-2 max-w-2xl text-kelp/70">
          Simulate as many times as you like. Subscribers see nothing until you publish, and a published draw cannot be changed.
        </p>
      </div>
      <Flash msg={searchParams.msg} error={searchParams.error} />

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="panel">
          <h2 className="text-2xl">Right now</h2>
          <dl className="mt-4 space-y-2 text-[15px]">
            <div className="flex justify-between"><dt className="text-kelp/70">Active subscribers</dt><dd className="font-semibold">{inputs.activeSubscribers}</dd></div>
            <div className="flex justify-between"><dt className="text-kelp/70">Eligible entries (5 scores)</dt><dd className="font-semibold">{inputs.entries.length}</dd></div>
            <div className="flex justify-between"><dt className="text-kelp/70">Pool before rollover</dt><dd className="font-semibold">{money(inputs.totalPoolCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-kelp/70">Jackpot carried in</dt><dd className="font-semibold">{money(rollover)}</dd></div>
          </dl>
        </div>

        <form action={simulateDraw} className="panel space-y-4">
          <h2 className="text-2xl">Run a simulation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="month" className="label">Draw month</label><input id="month" name="month" type="month" defaultValue={monthStart().slice(0, 7)} required className="field" /></div>
            <div>
              <label htmlFor="mode" className="label">Draw logic</label>
              <select id="mode" name="mode" className="field"><option value="random">Random (lottery style)</option><option value="algorithmic">Algorithmic (weighted by score frequency)</option></select>
            </div>
          </div>
          <div>
            <label htmlFor="bias" className="label">If algorithmic, favour</label>
            <select id="bias" name="bias" className="field"><option value="common">Scores logged most often</option><option value="rare">Scores logged least often</option></select>
          </div>
          <div>
            <label htmlFor="manual" className="label">Or set the five numbers yourself (optional)</label>
            <input id="manual" name="manual" placeholder="e.g. 7, 14, 22, 31, 40" className="field" />
            <p className="hint">Useful for testing the prize tiers. Overrides the draw logic.</p>
          </div>
          <SubmitButton className="btn btn-dark" pending="Simulating…">Run simulation</SubmitButton>
        </form>
      </section>

      {pending.map((d: any) => {
        const sim = d.simulation || {};
        return (
          <section key={d.id} className="rounded-2xl border-2 border-marigold bg-paper p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl">{monthLabel(d.month)} <span className="text-kelp/50">simulation</span></h2>
              <StatusPill status="simulated" />
            </div>
            <p className="mt-1 text-sm text-kelp/65">{d.mode === 'random' ? 'Random draw' : `Algorithmic draw, favouring ${d.bias === 'rare' ? 'rare' : 'common'} scores`}{sim.manual ? ' (numbers set manually)' : ''}. Numbers are locked in when you publish; winners are recalculated against live data.</p>
            <div className="mt-5"><NumberBalls numbers={d.numbers} /></div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {([5, 4, 3] as const).map((t) => (
                <div key={t} className="rounded-xl bg-mist p-4">
                  <p className="text-sm text-kelp/65">{t} matches{t === 5 ? ' (jackpot)' : ''}</p>
                  <p className="font-display text-2xl">{money(sim.pools?.[t] || 0)}</p>
                  <p className="text-sm text-kelp/65">{(sim.winners || []).filter((w: any) => w.tier === t).length} winner(s)</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-kelp/70">
              {sim.eligible} eligible entries. Matches: {[0, 1, 2, 3, 4, 5].map((k) => `${k}: ${sim.distribution?.[k] ?? 0}`).join(', ')}.
              {d.jackpot_rollover_out_cents > 0 ? ` No jackpot winner, so ${money(d.jackpot_rollover_out_cents)} would roll over.` : ''}
            </p>
            {(sim.winners || []).length > 0 && (
              <ul className="mt-4 divide-y divide-kelp/10 rounded-xl bg-mist px-4">
                {sim.winners.map((w: any) => (
                  <li key={w.userId} className="flex justify-between py-2.5 text-sm"><span>{w.name}, {w.tier} matches</span><span className="font-semibold">{money(w.prizeCents)}</span></li>
                ))}
              </ul>
            )}
            <form action={publishDraw} className="mt-6">
              <input type="hidden" name="draw_id" value={d.id} />
              <SubmitButton className="btn btn-primary" pending="Publishing…">Publish results</SubmitButton>
            </form>
          </section>
        );
      })}

      <section>
        <h2 className="text-2xl">Published draws</h2>
        {published.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-kelp/25 p-6 text-center text-kelp/60">Nothing published yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl bg-paper">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-kelp/10"><tr><th className="th">Month</th><th className="th">Numbers</th><th className="th">Pool</th><th className="th">Entries</th><th className="th">Winners</th><th className="th">Rolled over</th></tr></thead>
              <tbody className="divide-y divide-kelp/10">
                {published.map((d: any) => (
                  <tr key={d.id}>
                    <td className="td font-semibold">{monthLabel(d.month)}</td>
                    <td className="td font-display">{d.numbers.join(' · ')}</td>
                    <td className="td">{money(d.pool_total_cents + d.rollover_in_cents)}</td>
                    <td className="td">{d.simulation?.eligible ?? 0}</td>
                    <td className="td">{d.simulation?.winners?.length ?? 0}</td>
                    <td className="td">{money(d.jackpot_rollover_out_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
