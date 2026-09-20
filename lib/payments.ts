import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { periodEndFor } from '@/lib/subscription';

type Plan = 'monthly' | 'yearly';

/**
 * Record a successful subscription payment:
 *  1. upsert the user's subscription (active until the period end)
 *  2. write the charity's share to the contributions ledger (idempotent via external_ref)
 * Called by the Stripe webhook and by demo checkout.
 */
export async function recordSubscriptionPayment(opts: {
  userId: string;
  plan: Plan;
  amountCents: number;
  periodEnd?: Date;
  externalRef?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const admin = createAdminClient();
  const periodEnd = opts.periodEnd ?? periodEndFor(opts.plan);

  // Idempotency: if this payment was already recorded, do nothing.
  if (opts.externalRef) {
    const { data: seen } = await admin.from('contributions').select('id').eq('external_ref', opts.externalRef).maybeSingle();
    if (seen) return;
  }

  await admin.from('subscriptions').upsert(
    {
      user_id: opts.userId,
      plan: opts.plan,
      status: 'active',
      amount_cents: opts.amountCents,
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      stripe_customer_id: opts.stripeCustomerId ?? null,
      stripe_subscription_id: opts.stripeSubscriptionId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  const { data: profile } = await admin.from('profiles').select('charity_id,charity_percent').eq('id', opts.userId).maybeSingle();
  if (profile?.charity_id) {
    await admin.from('contributions').insert({
      user_id: opts.userId,
      charity_id: profile.charity_id,
      amount_cents: Math.floor((opts.amountCents * (profile.charity_percent || 10)) / 100),
      source: 'subscription',
      external_ref: opts.externalRef ?? null,
    });
  }
}

/** Record an independent donation (not tied to gameplay). */
export async function recordDonation(opts: { userId: string; charityId: string; amountCents: number; externalRef?: string }) {
  const admin = createAdminClient();
  if (opts.externalRef) {
    const { data: seen } = await admin.from('contributions').select('id').eq('external_ref', opts.externalRef).maybeSingle();
    if (seen) return;
  }
  await admin.from('contributions').insert({
    user_id: opts.userId,
    charity_id: opts.charityId,
    amount_cents: opts.amountCents,
    source: 'donation',
    external_ref: opts.externalRef ?? null,
  });
}
