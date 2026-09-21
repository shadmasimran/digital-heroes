import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/format';
import { demoPayments } from '@/lib/stripe';
import { completeDemoPayment } from '@/app/actions/subscription';
import { CheckoutForm } from '@/components/CheckoutForm';
import { Flash } from '@/components/Flash';

export const metadata = { title: 'Payment' };

/** Built-in TEST checkout (used when Stripe keys are not configured). Real Stripe uses its hosted page instead. */
export default async function CheckoutPage({ searchParams }: { searchParams: { plan?: string; error?: string } }) {
  const v = await requireUser();
  if (!demoPayments) redirect('/subscribe');

  const plan = searchParams.plan === 'yearly' ? 'yearly' : 'monthly';
  const settings = await getSettings();
  const price = plan === 'yearly' ? settings.yearly_price_cents : settings.monthly_price_cents;
  const pct = v.profile?.charity_percent || 10;

  const supabase = createClient();
  const { data: charity } = v.profile?.charity_id
    ? await supabase.from('charities').select('name').eq('id', v.profile.charity_id).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/subscribe" className="text-sm font-semibold text-tide underline">Back to plans</Link>
      <h1 className="mt-4 text-4xl">Payment</h1>
      <p className="mt-2 text-kelp/70">Enter a test card to complete your subscription. No real money is charged.</p>
      <div className="mt-6"><Flash error={searchParams.error} /></div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        <section className="panel h-fit" aria-labelledby="sum-h">
          <h2 id="sum-h" className="text-2xl">Order summary</h2>
          <dl className="mt-5 space-y-3 text-[15px]">
            <div className="flex justify-between"><dt className="text-kelp/70">Plan</dt><dd className="font-semibold">{plan === 'yearly' ? 'Yearly' : 'Monthly'}</dd></div>
            <div className="flex justify-between"><dt className="text-kelp/70">Billed</dt><dd>{plan === 'yearly' ? 'every year' : 'every month'}</dd></div>
            {charity && (
              <div className="flex justify-between gap-4"><dt className="text-kelp/70">Your charity</dt><dd className="text-right">{charity.name} ({pct}%)</dd></div>
            )}
          </dl>
          <div className="mt-5 flex items-baseline justify-between border-t border-kelp/10 pt-5">
            <span className="font-semibold">Total today</span>
            <span className="font-display text-3xl">{money(price)}</span>
          </div>
          {charity && <p className="mt-3 text-sm text-kelp/60">About {money(Math.floor((price * pct) / 100))} of this payment goes to {charity.name}.</p>}
        </section>

        <section className="panel" aria-labelledby="pay-h">
          <div className="flex items-center justify-between gap-3">
            <h2 id="pay-h" className="text-2xl">Card details</h2>
            <span className="pill bg-marigold/40">Test mode</span>
          </div>
          <div className="mt-4 rounded-xl bg-mist p-4 text-sm">
            <p className="font-semibold">Use a test card. Please do not enter a real card.</p>
            <ul className="mt-2 space-y-1 text-kelp/75">
              <li><span className="font-semibold text-kelp">4242 4242 4242 4242</span> payment succeeds</li>
              <li><span className="font-semibold text-kelp">4000 0000 0000 0002</span> card declined</li>
              <li><span className="font-semibold text-kelp">4000 0000 0000 9995</span> insufficient funds</li>
            </ul>
            <p className="mt-2 text-kelp/65">Any future expiry date and any 3-digit CVC. Nothing you enter is stored.</p>
          </div>
          <div className="mt-6">
            <CheckoutForm action={completeDemoPayment} plan={plan} payLabel={`Pay ${money(price)}`} />
          </div>
        </section>
      </div>
    </div>
  );
}
