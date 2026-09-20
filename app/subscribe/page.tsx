import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { money, fmtDate } from '@/lib/format';
import { startCheckout } from '@/app/actions/subscription';
import { demoPayments } from '@/lib/stripe';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Choose a plan' };

export default async function SubscribePage({ searchParams }: { searchParams: { msg?: string; error?: string; plan?: string } }) {
  const v = await requireUser();
  const settings = await getSettings();
  const supabase = createClient();
  const { data: charity } = v.profile?.charity_id
    ? await supabase.from('charities').select('name').eq('id', v.profile.charity_id).maybeSingle()
    : { data: null };
  const pct = v.profile?.charity_percent || 10;
  const yearlySaving = Math.round((1 - settings.yearly_price_cents / (settings.monthly_price_cents * 12)) * 100);
  const plans = [
    { id: 'monthly', name: 'Monthly', price: settings.monthly_price_cents, unit: 'a month', blurb: 'Flexible. Stop whenever you like.' },
    { id: 'yearly', name: 'Yearly', price: settings.yearly_price_cents, unit: 'a year', blurb: `Best value${yearlySaving > 0 ? `, ${yearlySaving}% less than paying monthly` : ''}.` },
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <h1 className="text-4xl">Choose your plan</h1>
      <p className="mt-2 max-w-xl text-kelp/70">
        {charity ? <>{pct}% of every payment goes to <strong>{charity.name}</strong>. </> : null}
        You can change your charity and percentage any time from your dashboard.
      </p>
      <div className="mt-8"><Flash msg={searchParams.msg} error={searchParams.error} /></div>

      {v.subState === 'active' ? (
        <div className="panel">
          <p className="text-lg font-semibold">You are already subscribed.</p>
          <p className="mt-1 text-kelp/70">Your plan renews on {fmtDate(v.subscription?.current_period_end)}.</p>
          <Link href="/dashboard" className="btn btn-dark mt-5">Go to dashboard</Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((p) => {
            const featured = (searchParams.plan || 'yearly') === p.id;
            return (
              <form key={p.id} action={startCheckout} className={`flex flex-col rounded-2xl p-6 ${featured ? 'bg-kelp text-paper' : 'panel'}`}>
                <input type="hidden" name="plan" value={p.id} />
                <h2 className="text-2xl">{p.name}</h2>
                <p className="mt-3 font-display text-4xl">{money(p.price)}<span className={`ml-1 font-sans text-base ${featured ? 'text-paper/60' : 'text-kelp/60'}`}>{p.unit}</span></p>
                <p className={`mt-2 flex-1 ${featured ? 'text-paper/75' : 'text-kelp/70'}`}>{p.blurb}</p>
                <p className={`mt-4 text-sm ${featured ? 'text-paper/75' : 'text-kelp/60'}`}>
                  About {money(Math.floor((p.price * pct) / 100))} of this payment goes to your charity.
                </p>
                <SubmitButton className={`btn mt-5 ${featured ? 'btn-primary' : 'btn-dark'}`} pending="One moment…">
                  Subscribe {p.id === 'yearly' ? 'yearly' : 'monthly'}
                </SubmitButton>
              </form>
            );
          })}
        </div>
      )}
      {demoPayments && (
        <p className="mt-6 text-sm text-kelp/60">Demo mode: payments are simulated so you can test the full flow. No card is charged.</p>
      )}
    </div>
  );
}
