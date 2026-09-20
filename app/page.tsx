import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getPublicStats } from '@/lib/stats';
import { money, fmtDate } from '@/lib/format';
import { TIER_SHARES } from '@/lib/draw';
import { Rise } from '@/components/motion';
import { RippleArt } from '@/components/RippleArt';
import { CharityArt } from '@/components/CharityArt';

export default async function Home() {
  const supabase = createClient();
  const [viewer, settings, stats, { data: charities }] = await Promise.all([
    getViewer(),
    getSettings(),
    getPublicStats(),
    supabase.from('charities').select('id,name,description,image_url,featured,charity_events(title,event_date,location)')
      .eq('active', true).order('featured', { ascending: false }).order('created_at'),
  ]);
  const list = charities || [];
  const spotlight = list[0];
  const nextEvent = spotlight?.charity_events?.slice().sort((a: any, b: any) => a.event_date.localeCompare(b.event_date))[0];
  const yearlySaving = Math.round((1 - settings.yearly_price_cents / (settings.monthly_price_cents * 12)) * 100);
  const cta = (plan: string) => (viewer ? `/subscribe?plan=${plan}` : `/signup?plan=${plan}`);

  return (
    <>
      {/* ---------------------------- Hero ---------------------------- */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 lg:grid-cols-[1.1fr_.9fr] lg:pt-20">
        <div>
          <Rise>
            <h1 className="text-[2.6rem] leading-[1.04] sm:text-6xl lg:text-[4.2rem]">
              Your good rounds can make someone else&apos;s year.
            </h1>
          </Rise>
          <Rise delay={0.12}>
            <p className="mt-6 max-w-xl text-lg text-kelp/75">
              Subscribe, log your five latest Stableford scores and enter a monthly prize draw. At least 10% of every
              subscription goes to a charity you choose.
            </p>
          </Rise>
          <Rise delay={0.24} className="mt-9 flex flex-wrap gap-3">
            <Link href={cta('yearly')} className="btn btn-primary px-7 py-3.5 text-base">Subscribe and pick a charity</Link>
            <Link href="/charities" className="btn btn-ghost px-7 py-3.5 text-base">Meet the charities</Link>
          </Rise>
          <Rise delay={0.36}>
            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-2 text-sm font-medium text-kelp/70">
              {['Monthly or yearly plans', 'Three ways to win each month', 'Cancel whenever you like'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#2F7F79" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {t}
                </li>
              ))}
            </ul>
          </Rise>
        </div>
        <div className="pb-6">
          <RippleArt raisedCents={stats.raised} charityCount={stats.charities} causes={list.slice(0, 3).map((c: any) => c.name)} />
        </div>
      </section>

      {/* ------------------------- How it works ------------------------ */}
      <section id="how" className="scroll-mt-20 bg-paper py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="max-w-xl text-3xl sm:text-4xl">Three steps, then once a month it all happens by itself.</h2>
          <ol className="relative mt-14 grid gap-10 md:grid-cols-3">
            <div className="absolute left-[1.15rem] top-2 hidden h-px w-[92%] bg-kelp/15 md:block" aria-hidden />
            {[
              ['Pick your cause', 'Choose a charity when you sign up. You decide how much of your fee it receives, from 10% up to everything, and you can change it any time.'],
              ['Log your five latest scores', 'Enter Stableford scores from 1 to 45. Each new round replaces your oldest, so your entry always reflects how you are playing now.'],
              ['Join the monthly draw', 'Five numbers are drawn each month. Match three, four or five of your scores to win a share of the prize pool.'],
            ].map(([title, body], i) => (
              <li key={title} className="relative">
                <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-marigold font-display text-lg">{i + 1}</span>
                <h3 className="mt-5 text-xl">{title}</h3>
                <p className="mt-2 max-w-sm text-kelp/70">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------ Charity spotlight -------------------- */}
      {spotlight && (
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid overflow-hidden rounded-[2rem] bg-blush md:grid-cols-[.9fr_1.1fr]">
            <div className="min-h-[260px]"><CharityArt name={spotlight.name} imageUrl={spotlight.image_url} /></div>
            <div className="p-8 sm:p-12">
              <p className="text-sm font-semibold text-kelp/70">Featured charity</p>
              <h2 className="mt-2 text-3xl sm:text-4xl">{spotlight.name}</h2>
              <p className="mt-4 max-w-lg text-lg text-kelp/80">{spotlight.description}</p>
              {nextEvent && (
                <p className="mt-5 rounded-xl bg-paper/70 px-4 py-3 text-sm">
                  <span className="font-semibold">{nextEvent.title}</span> on {fmtDate(nextEvent.event_date)}
                  {nextEvent.location ? ` in ${nextEvent.location}` : ''}
                </p>
              )}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={`/charities/${spotlight.id}`} className="btn btn-dark">Read their story</Link>
                <Link href="/charities" className="btn btn-ghost">Browse all charities</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------- The draw ------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl">A fixed share of every subscription builds the prize pool.</h2>
            <p className="mt-4 max-w-lg text-lg text-kelp/75">
              Numbers are drawn once a month. The pool splits across three tiers, and winners in a tier share it equally.
              If nobody matches all five, the jackpot rolls into next month.
            </p>
          </div>
          <div className="panel">
            <div className="flex h-14 overflow-hidden rounded-xl text-sm font-semibold" role="img" aria-label="Prize pool split: 40% five matches, 35% four matches, 25% three matches">
              <div className="flex items-center justify-center bg-marigold" style={{ width: `${TIER_SHARES[5] * 100}%` }}>40%</div>
              <div className="flex items-center justify-center bg-tide text-paper" style={{ width: `${TIER_SHARES[4] * 100}%` }}>35%</div>
              <div className="flex items-center justify-center bg-kelp text-paper" style={{ width: `${TIER_SHARES[3] * 100}%` }}>25%</div>
            </div>
            <dl className="mt-5 space-y-3 text-[15px]">
              <div className="flex justify-between gap-4"><dt className="font-semibold">Match 5 numbers</dt><dd className="text-right text-kelp/70">The jackpot. Carries over if unclaimed.</dd></div>
              <div className="flex justify-between gap-4"><dt className="font-semibold">Match 4 numbers</dt><dd className="text-right text-kelp/70">Shared equally between winners.</dd></div>
              <div className="flex justify-between gap-4"><dt className="font-semibold">Match 3 numbers</dt><dd className="text-right text-kelp/70">Shared equally between winners.</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* ------------------------------ Plans -------------------------- */}
      <section id="plans" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <h2 className="max-w-xl text-3xl sm:text-4xl">Pick a plan. Your charity gets its share from the first payment.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="panel flex flex-col">
            <h3 className="text-2xl">Monthly</h3>
            <p className="mt-3 font-display text-4xl">{money(settings.monthly_price_cents)}<span className="ml-1 font-sans text-base text-kelp/60">a month</span></p>
            <p className="mt-3 flex-1 text-kelp/70">Full access to score tracking and every monthly draw. Stop whenever you want.</p>
            <Link href={cta('monthly')} className="btn btn-dark mt-6">Start monthly</Link>
          </div>
          <div className="flex flex-col rounded-2xl bg-kelp p-6 text-paper shadow-[0_24px_50px_-28px_rgba(16,49,43,.8)]">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl">Yearly</h3>
              {yearlySaving > 0 && <span className="pill bg-marigold text-kelp">Save {yearlySaving}%</span>}
            </div>
            <p className="mt-3 font-display text-4xl">{money(settings.yearly_price_cents)}<span className="ml-1 font-sans text-base text-paper/60">a year</span></p>
            <p className="mt-3 flex-1 text-paper/75">The same access at a discounted rate, and twelve draws without thinking about renewals.</p>
            <Link href={cta('yearly')} className="btn btn-primary mt-6">Start yearly</Link>
          </div>
        </div>
      </section>
    </>
  );
}
