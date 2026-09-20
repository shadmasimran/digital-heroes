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
import { SITE_URL } from '@/lib/brand';

export async function startCheckout(formData: FormData) {
  const v = await requireUser();
  const plan = String(formData.get('plan') ?? '') as 'monthly' | 'yearly';
  if (plan !== 'monthly' && plan !== 'yearly') flash('/subscribe', 'error', 'Choose a plan.');
  if (!paymentsConfigured) flash('/subscribe', 'error', 'Payments are not configured on this deployment.');
  if (!v.profile?.charity_id) flash('/subscribe', 'error', 'Pick a charity on your dashboard first.');

  const settings = await getSettings();
  const amountCents = plan === 'yearly' ? settings.yearly_price_cents : settings.monthly_price_cents;

  if (demoPayments) {
    await recordSubscriptionPayment({ userId: v.user.id, plan, amountCents, externalRef: `demo_${randomUUID()}` });
    flash('/dashboard', 'msg', `Your ${plan} subscription is active (demo payment).`);
  }

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
    metadata: { user_id: v.user.id, plan, kind: 'subscription' },
    subscription_data: { metadata: { user_id: v.user.id, plan } },
    success_url: `${SITE_URL}/dashboard?msg=${encodeURIComponent('Payment received. Your subscription is being activated.')}`,
    cancel_url: `${SITE_URL}/subscribe?error=${encodeURIComponent('Checkout was cancelled.')}`,
  });
  redirect(session.url!);
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
    flash(back, 'msg', 'Thank you — your donation has been recorded (demo payment).');
  }
  const session = await stripe!.checkout.sessions.create({
    mode: 'payment',
    customer_email: v.user.email,
    line_items: [{ quantity: 1, price_data: { currency: 'inr', unit_amount: amountCents, product_data: { name: 'Charity donation' } } }],
    metadata: { kind: 'donation', user_id: v.user.id, charity_id: charityId },
    success_url: `${SITE_URL}${back}?msg=${encodeURIComponent('Thank you for your donation.')}`,
    cancel_url: `${SITE_URL}${back}`,
  });
  redirect(session.url!);
}
