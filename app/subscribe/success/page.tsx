import Link from 'next/link';
import { getViewer, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { recordSubscriptionPayment } from '@/lib/payments';
import { fmtDate, money } from '@/lib/format';

export const metadata = { title: 'Payment successful' };
export const dynamic = 'force-dynamic';

/**
 * Confirmation page shown after payment.
 *  - Test checkout: the payment was already recorded, we just display the account state.
 *  - Stripe Checkout: we verify the session with Stripe here (idempotent), so the subscription
 *    is active the moment the user lands, even if the webhook has not arrived yet.
 * Success is only ever shown when the database says the subscription is active.
 */
export default async function SuccessPage({ searchParams }: { searchParams: { session_id?: string; ref?: string; card?: string } }) {
  const first = await requireUser();
  let problem: string | null = null;
  let reference = /^[A-Z0-9]{8}$/.test(searchParams.ref || '') ? searchParams.ref! : null;

  if (searchParams.session_id && stripe) {
    try {
      const s = await stripe.checkout.sessions.retrieve(searchParams.session_id);
      if (s.metadata?.user_id !== first.user.id) {
        problem = 'That payment belongs to a different account.';
      } else if (s.status !== 'complete' || !s.subscription) {
        problem = 'The payment has not been completed yet.';
      } else {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        await recordSubscriptionPayment({
          userId: first.user.id,
          plan: s.metadata?.plan === 'yearly' ? 'yearly' : 'monthly',
          amountCents: s.amount_total || 0,
          periodEnd: new Date(sub.current_period_end * 1000),
          externalRef: typeof s.invoice === 'string' ? `invoice_${s.invoice}` : `session_${s.id}`,
          stripeCustomerId: s.customer as string,
          stripeSubscriptionId: sub.id,
        });
        reference = s.id.slice(-8).toUpperCase();
      }
    } catch {
      problem = 'We could not verify that payment yet. Please refresh in a moment.';
    }
  }

  const v = (await getViewer())!;
  const sub = v.subscription;
  const active = v.subState === 'active' && sub;

  if (!active) {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="text-4xl">We could not find a completed payment</h1>
        <p className="mt-4 text-kelp/70">{problem || 'Your subscription is not active yet.'}</p>
        <Link href="/subscribe" className="btn btn-primary mt-8">Back to plans</Link>
      </div>
    );
  }

  const supabase = createClient();
  const { data: charity } = v.profile?.charity_id
    ? await supabase.from('charities').select('name').eq('id', v.profile.charity_id).maybeSingle()
    : { data: null };
  const pct = v.profile?.charity_percent || 10;
  const card = /^\d{4}$/.test(searchParams.card || '') ? searchParams.card : null;

  const rows: [string, string][] = [
    ['Plan', sub.plan === 'yearly' ? 'Yearly' : 'Monthly'],
    ['Amount paid', money(sub.amount_cents)],
    [sub.cancel_at_period_end ? 'Access until' : 'Next renewal', fmtDate(sub.current_period_end)],
  ];
  if (card) rows.push(['Paid with', `Card ending ${card}`]);
  if (reference) rows.push(['Reference', reference]);

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <div className="panel text-center" role="status">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tide">
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#FBFCFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 className="mt-6 text-4xl">Payment successful</h1>
        <p className="mt-3 text-lg text-kelp/75">Your {sub.plan} subscription is now active.</p>

        <dl className="mt-8 space-y-3 rounded-xl bg-mist p-5 text-left text-[15px]">
          {rows.map(([k, val]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="text-kelp/65">{k}</dt><dd className="font-semibold">{val}</dd></div>
          ))}
          <div className="flex justify-between gap-4"><dt className="text-kelp/65">Status</dt><dd className="font-semibold text-tide">Active</dd></div>
        </dl>

        {charity && (
          <p className="mt-5 rounded-xl bg-blush p-4 text-sm">
            <strong>{charity.name}</strong> receives {pct}% of this payment, about {money(Math.floor((sub.amount_cents * pct) / 100))}.
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="btn btn-primary">Go to my dashboard</Link>
          <Link href="/charities" className="btn btn-ghost">Meet the charities</Link>
        </div>
      </div>
    </div>
  );
}
