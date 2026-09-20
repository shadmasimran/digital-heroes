import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { addScore, deleteScore, updateScore } from '@/app/actions/scores';
import { cancelSubscription, resumeSubscription, updateCharityChoice } from '@/app/actions/subscription';
import { uploadProof } from '@/app/actions/winners';
import { fmtDate, money, monthLabel, nextMonthStart } from '@/lib/format';
import { monthlyEquivalent } from '@/lib/subscription';
import { MAX_SCORES } from '@/lib/scores';
import { SCORE_MAX, SCORE_MIN } from '@/lib/draw';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';
import { StatusPill } from '@/components/StatusPill';
import { NumberBalls } from '@/components/NumberBalls';
import { PercentSlider } from '@/components/PercentSlider';

export const metadata = { title: 'Your dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  const v = await requireUser();
  const supabase = createClient();
  const [{ data: scores }, { data: charities }, { count: entered }, { data: latestDraw }, { data: winnings }, { data: contribs }] = await Promise.all([
    supabase.from('scores').select('*').eq('user_id', v.user.id).order('played_on', { ascending: false }),
    supabase.from('charities').select('id,name').eq('active', true).order('name'),
    supabase.from('draw_entries').select('id', { count: 'exact', head: true }).eq('user_id', v.user.id),
    supabase.from('draws').select('*').eq('status', 'published').order('month', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('winners').select('*, draws(month)').eq('user_id', v.user.id).order('created_at', { ascending: false }),
    supabase.from('contributions').select('amount_cents').eq('user_id', v.user.id),
  ]);

  const list = scores || [];
  const active = v.subState === 'active';
  const sub = v.subscription;
  const myCharity = (charities || []).find((c: any) => c.id === v.profile?.charity_id);
  const pct = v.profile?.charity_percent || 10;
  const perMonth = sub ? Math.floor((monthlyEquivalent(sub.plan, sub.amount_cents) * pct) / 100) : 0;
  const given = (contribs || []).reduce((s: number, c: any) => s + c.amount_cents, 0);
  const won = (winnings || []).reduce((s: number, w: any) => s + w.prize_cents, 0);
  const paid = (winnings || []).filter((w: any) => w.payment_status === 'paid').reduce((s: number, w: any) => s + w.prize_cents, 0);
  const eligible = active && list.length === MAX_SCORES;
  const today = new Date().toISOString().slice(0, 10);

  let myMatches: number | null = null;
  if (latestDraw) {
    const { data: e } = await supabase.from('draw_entries').select('match_count').eq('draw_id', latestDraw.id).eq('user_id', v.user.id).maybeSingle();
    myMatches = e ? e.match_count : null;
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-4xl">Hello, {(v.profile?.full_name || 'there').split(' ')[0]}</h1>
      <p className="mt-2 text-kelp/70">Here is where your rounds, your draws and your giving stand.</p>
      <div className="mt-6"><Flash msg={searchParams.msg} error={searchParams.error} /></div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ------------------------ Subscription ------------------------ */}
        <section className="panel" aria-labelledby="sub-h">
          <div className="flex items-start justify-between gap-4">
            <h2 id="sub-h" className="text-2xl">Subscription</h2>
            <StatusPill status={v.subState} />
          </div>
          {sub && v.subState !== 'inactive' ? (
            <>
              <p className="mt-4 text-kelp/80">
                {sub.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan, {money(sub.amount_cents)}.{' '}
                {active
                  ? sub.cancel_at_period_end ? <>Ends on <strong>{fmtDate(sub.current_period_end)}</strong>.</> : <>Renews on <strong>{fmtDate(sub.current_period_end)}</strong>.</>
                  : <>Ended on <strong>{fmtDate(sub.current_period_end)}</strong>.</>}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {!active && <Link href="/subscribe" className="btn btn-primary">Renew subscription</Link>}
                {active && !sub.cancel_at_period_end && (
                  <form action={cancelSubscription}><SubmitButton className="btn btn-ghost btn-sm" pending="Cancelling…">Cancel at period end</SubmitButton></form>
                )}
                {active && sub.cancel_at_period_end && (
                  <form action={resumeSubscription}><SubmitButton className="btn btn-dark btn-sm">Keep my subscription</SubmitButton></form>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-kelp/80">You are not subscribed yet. Subscribe to log scores and join the monthly draw.</p>
              <Link href="/subscribe" className="btn btn-primary mt-5">Choose a plan</Link>
            </>
          )}
        </section>

        {/* --------------------------- Charity -------------------------- */}
        <section className="rounded-2xl bg-blush p-6" aria-labelledby="ch-h">
          <h2 id="ch-h" className="text-2xl">Your charity</h2>
          <p className="mt-3 text-kelp/80">
            {myCharity ? <><strong>{myCharity.name}</strong> receives {pct}%{perMonth > 0 ? <> (about {money(perMonth)} a month)</> : null}.</> : 'Choose a charity to support.'}
          </p>
          <p className="mt-1 text-sm text-kelp/70">Given so far through your subscription and donations: <strong>{money(given)}</strong>.</p>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-tide underline">Change charity or percentage</summary>
            <form action={updateCharityChoice} className="mt-4 space-y-4">
              <div>
                <label htmlFor="charity_id" className="label">Charity</label>
                <select id="charity_id" name="charity_id" defaultValue={v.profile?.charity_id || ''} className="field" required>
                  <option value="" disabled>Choose a charity</option>
                  {(charities || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <PercentSlider defaultValue={pct} monthlyCents={sub ? monthlyEquivalent(sub.plan, sub.amount_cents) : 49900} />
              <SubmitButton className="btn btn-dark btn-sm">Save preference</SubmitButton>
            </form>
          </details>
        </section>

        {/* ---------------------------- Scores -------------------------- */}
        <section className="panel" aria-labelledby="sc-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="sc-h" className="text-2xl">Your latest scores</h2>
            <p className="text-sm font-semibold text-kelp/60">{list.length} of {MAX_SCORES} logged</p>
          </div>
          <p className="mt-1 text-sm text-kelp/65">Stableford, {SCORE_MIN} to {SCORE_MAX}. One score per date. A new score replaces your oldest.</p>

          <form action={addScore} className="mt-5 grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <div>
              <label htmlFor="score" className="label">Score</label>
              <input id="score" name="score" type="number" min={SCORE_MIN} max={SCORE_MAX} required disabled={!active} className="field" />
            </div>
            <div>
              <label htmlFor="played_on" className="label">Date played</label>
              <input id="played_on" name="played_on" type="date" max={today} required disabled={!active} className="field" />
            </div>
            <SubmitButton className="btn btn-primary" pending="Saving…">Save score</SubmitButton>
          </form>
          {!active && <p className="mt-3 text-sm font-medium text-kelp/70">Subscribe to start logging scores.</p>}

          {list.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-kelp/25 p-6 text-center text-kelp/65">
              No scores yet. Add the score from your most recent round to begin.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-kelp/10">
              {list.map((s: any) => (
                <li key={s.id} className="flex flex-wrap items-end gap-3 py-3">
                  <form action={updateScore} className="flex flex-1 flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={s.id} />
                    <div className="w-24">
                      <label htmlFor={`s-${s.id}`} className="sr-only">Score</label>
                      <input id={`s-${s.id}`} name="score" type="number" min={SCORE_MIN} max={SCORE_MAX} defaultValue={s.score} required disabled={!active} className="field py-2 font-display text-lg" />
                    </div>
                    <div>
                      <label htmlFor={`d-${s.id}`} className="sr-only">Date</label>
                      <input id={`d-${s.id}`} name="played_on" type="date" max={today} defaultValue={s.played_on} required disabled={!active} className="field py-2" />
                    </div>
                    {active && <SubmitButton className="btn btn-ghost btn-sm" pending="…">Update</SubmitButton>}
                  </form>
                  {active && (
                    <form action={deleteScore}>
                      <input type="hidden" name="id" value={s.id} />
                      <SubmitButton className="btn btn-danger btn-sm" pending="…">Delete</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------------------- Participation ---------------------- */}
        <section className="panel" aria-labelledby="pa-h">
          <h2 id="pa-h" className="text-2xl">Draws</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div><dt className="text-sm text-kelp/60">Draws entered</dt><dd className="font-display text-3xl">{entered || 0}</dd></div>
            <div><dt className="text-sm text-kelp/60">Next draw</dt><dd className="font-display text-xl leading-9">{monthLabel(nextMonthStart())}</dd></div>
          </dl>
          <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${eligible ? 'bg-tide/15' : 'bg-marigold/25'}`}>
            {eligible
              ? 'You are in the next draw.'
              : !active ? 'Subscribe to enter the next draw.' : `Log ${MAX_SCORES - list.length} more score${MAX_SCORES - list.length === 1 ? '' : 's'} to enter the next draw.`}
          </p>
          {latestDraw && (
            <div className="mt-6">
              <p className="text-sm font-semibold">{monthLabel(latestDraw.month)} draw</p>
              <div className="mt-2"><NumberBalls numbers={latestDraw.numbers} mine={list.map((s: any) => s.score)} /></div>
              <p className="mt-3 text-sm text-kelp/70">
                {myMatches === null ? 'You were not entered in this draw.' : myMatches >= 3 ? `You matched ${myMatches}. See your winnings below.` : `You matched ${myMatches}. Not this time.`}
              </p>
            </div>
          )}
        </section>

        {/* ---------------------------- Winnings ------------------------ */}
        <section className="panel lg:col-span-2" aria-labelledby="wi-h">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="wi-h" className="text-2xl">Winnings</h2>
            <p className="text-sm text-kelp/70">Total won <strong className="font-display text-xl text-kelp">{money(won)}</strong> &nbsp; Paid out <strong>{money(paid)}</strong></p>
          </div>
          {(winnings || []).length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-kelp/25 p-6 text-center text-kelp/65">No wins yet. Every draw is a new chance.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {winnings!.map((w: any) => (
                <li key={w.id} className="rounded-xl bg-mist p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{monthLabel(w.draws.month)}: matched {w.tier} numbers</p>
                      <p className="font-display text-2xl">{money(w.prize_cents)}</p>
                    </div>
                    <div className="flex gap-2"><StatusPill status={w.verification_status} /><StatusPill status={w.payment_status} /></div>
                  </div>
                  {w.review_note && <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-900">{w.review_note}</p>}
                  {(w.verification_status === 'pending_proof' || w.verification_status === 'rejected') && (
                    <form action={uploadProof} className="mt-4 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="winner_id" value={w.id} />
                      <div>
                        <label htmlFor={`p-${w.id}`} className="label">Upload a screenshot of your scores</label>
                        <input id={`p-${w.id}`} name="proof" type="file" accept="image/*" required className="field bg-paper py-2 text-sm" />
                      </div>
                      <SubmitButton className="btn btn-dark btn-sm" pending="Uploading…">Submit proof</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
