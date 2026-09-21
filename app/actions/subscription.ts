'use server';

import { redirect } from 'next/navigation';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { getSettings } from '@/lib/settings';
import { stripe, demoPayments, paymentsConfigured } from '@/lib/stripe';
import { recordDonation, recordSubscriptionPayment } from '@/lib/payments';
import { getSiteUrl } from '@/lib/site';
import { validateTestCard } from '@/lib/testcards';

const planOf = (v: FormDataEntryValue | null): 'monthly' | 'yearly' | null =>
  v === 'monthly' || v === 'yearly' ? v : null;

/**
 * Step 1 of the payment flow: the user picked a plan.
 *  - Stripe configured  -> hosted Stripe Checkout (test or live keys)
 *  - Demo/test payments -> the built-in test checkout page (/checkout)
 * Prices are sent inline (price_data), so no Stripe Price IDs are needed.
 */
export async function startCheckout(formData: FormData) {
  const v = await requireUser();
  const plan = planOf(formData.get('plan'));
  if (!plan) flash('/subscribe', 'error', 'Choose a plan.');
  if (!paymentsConfigured) flash('/subscribe', 'error', 'Payments are not configured on this deployment.');
  if (!v.profile?.charity_id) flash('/subscribe', 'error', 'Pick a charity on your dashboard first.');

  if (demoPayments) redirect(`/checkout?plan=${plan}`);

  const settings = await getSettings();
  const amountCents = plan === 'yearly' ? settings.yearly_price_cents : settings.monthly_price_cents;
  const site = getSiteUrl();
  const session = await stripe!.checkout.sessions.create({
    mode: 'subscription',
    customer_email: v.user.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'inr',
        unit_amount: amountCents,
        recurring: { interval: plan === 'yearly' ? 'year' : 'month' },
        product_data: { name: `Ripple Rounds ${plan} plan` },
      },
    }],
    metadata: { user_id: v.user.id, plan: plan!, kind: 'subscription' },
    subscription_data: { metadata: { user_id: v.user.id, plan: plan! } },
    // The success page verifies the session itself, so activation never depends on webhook timing.
    success_url: `${site}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/subscribe?error=${encodeURIComponent('Checkout was cancelled.')}`,
  });
  redirect(session.url!);
}

/**
 * Step 2 (test checkout): the user "pays" with a test card.
 * Card details are validated and immediately discarded — nothing is stored or logged.
 * The price is always read from the server-side settings, never from the form.
 */
export async function completeDemoPayment(formData: FormData) {
  const v = await requireUser();
  const plan = planOf(formData.get('plan'));
  if (!plan) flash('/subscribe', 'error', 'Choose a plan.');
  if (!demoPayments) flash('/subscribe', 'error', 'Test payments are not enabled on this deployment.');
  const back = `/checkout?plan=${plan}`;

  const card = validateTestCard({
    name: String(formData.get('name') ?? ''),
    number: String(formData.get('number') ?? ''),
    expiry: String(formData.get('expiry') ?? ''),
    cvc: String(formData.get('cvc') ?? ''),
  });
  if (!card.ok) flash(back, 'error', card.error);

  const settings = await getSettings();
  const amountCents = plan === 'yearly' ? settings.yearly_price_cents : settings.monthly_price_cents;
  const ref = `demo_${randomUUID()}`;
  await recordSubscriptionPayment({ userId: v.user.id, plan: plan!, amountCents, externalRef: ref });

  const okCard = card as { ok: true; last4: string };
  redirect(`/subscribe/success?ref=${ref.slice(-8).toUpperCase()}&card=${okCard.last4}`);
}

export async function cancelSubscription() {
  const v = await requireUser();
  if (!v.subscription) flash('/dashboard', 'error', 'You have no subscription to cancel.');
  if (stripe && v.subscription.stripe_subscription_id) {
    await stripe.subscriptions.update(v.subscription.stripe_subscription_id, { cancel_at_period_end: true });
  }
  await createAdminClient().from('subscriptions').update({ cancel_at_period_end: true }).eq('user_id', v.user.id);
  flash('/dashboard', 'msg', 'Subscription will end at the close of your current period.');
}

export async function resumeSubscription() {
  const v = await requireUser();
  if (!v.subscription) flash('/dashboard', 'error', 'No subscription found.');
  if (stripe && v.subscription.stripe_subscription_id) {
    await stripe.subscriptions.update(v.subscription.stripe_subscription_id, { cancel_at_period_end: false });
  }
  await createAdminClient().from('subscriptions').update({ cancel_at_period_end: false }).eq('user_id', v.user.id);
  flash('/dashboard', 'msg', 'Great — your subscription will keep renewing.');
}

/** Change which charity receives the subscription share, and how much. */
export async function updateCharityChoice(formData: FormData) {
  const v = await requireUser();
  const charityId = String(formData.get('charity_id') ?? '');
  const pct = Math.round(Number(formData.get('charity_percent')));
  if (!charityId) flash('/dashboard', 'error', 'Choose a charity.');
  if (!Number.isFinite(pct) || pct < 10 || pct > 100) flash('/dashboard', 'error', 'Contribution must be between 10% and 100%.');
  const supabase = createClient();
  const { error } = await supabase.from('profiles').update({ charity_id: charityId, charity_percent: pct }).eq('id', v.user.id);
  if (error) flash('/dashboard', 'error', 'Could not save your charity choice.');
  flash('/dashboard', 'msg', 'Charity preference saved.');
}

/** One-off donation, independent of the subscription and the draw. */
export async function startDonation(formData: FormData) {
  const v = await requireUser();
  const charityId = String(formData.get('charity_id') ?? '');
  const rupees = Math.round(Number(formData.get('amount')));
  const back = `/charities/${charityId}`;
  if (!Number.isFinite(rupees) || rupees < 100) flash(back, 'error', 'The minimum donation is ₹100.');
  if (!paymentsConfigured) flash(back, 'error', 'Payments are not configured on this deployment.');
  const amountCents = rupees * 100;

  if (demoPayments) {
    await recordDonation({ userId: v.user.id, charityId, amountCents, externalRef: `demo_${randomUUID()}` });
    flash(back, 'msg', 'Thank you — your donation has been recorded (test payment).');
  }
  const site = getSiteUrl();
  const session = await stripe!.checkout.sessions.create({
    mode: 'payment',
    customer_email: v.user.email,
    line_items: [{ quantity: 1, price_data: { currency: 'inr', unit_amount: amountCents, product_data: { name: 'Charity donation' } } }],
    metadata: { kind: 'donation', user_id: v.user.id, charity_id: charityId },
    success_url: `${site}${back}?msg=${encodeURIComponent('Thank you for your donation.')}`,
    cancel_url: `${site}${back}`,
  });
  redirect(session.url!);
}
