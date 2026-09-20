import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordDonation, recordSubscriptionPayment } from '@/lib/payments';

export const runtime = 'nodejs';

/**
 * Stripe webhook — the source of truth for subscription lifecycle:
 *  checkout.session.completed  -> activate subscription / record donation
 *  invoice.paid (renewals)     -> extend the period and record the charity share
 *  customer.subscription.updated / deleted -> sync cancel flag / cancelled state
 * Payment records are idempotent (external_ref), so Stripe retries are safe.
 */
export async function POST(req: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 });

  const body = await req.text(); // raw body is required for signature verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get('stripe-signature') || '', process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.kind === 'donation') {
          await recordDonation({ userId: s.metadata.user_id, charityId: s.metadata.charity_id, amountCents: s.amount_total || 0, externalRef: `session_${s.id}` });
        } else if (s.mode === 'subscription' && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          await recordSubscriptionPayment({
            userId: s.metadata!.user_id, plan: s.metadata!.plan as 'monthly' | 'yearly', amountCents: s.amount_total || 0,
            periodEnd: new Date(sub.current_period_end * 1000),
            externalRef: typeof s.invoice === 'string' ? `invoice_${s.invoice}` : `session_${s.id}`,
            stripeCustomerId: s.customer as string, stripeSubscriptionId: sub.id,
          });
        }
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.billing_reason !== 'subscription_cycle' || !inv.subscription) break;
        const { data: row } = await admin.from('subscriptions').select('user_id,plan').eq('stripe_subscription_id', inv.subscription as string).maybeSingle();
        if (!row) break;
        await recordSubscriptionPayment({
          userId: row.user_id, plan: row.plan, amountCents: inv.amount_paid,
          periodEnd: new Date((inv.lines.data[0]?.period.end || 0) * 1000), externalRef: `invoice_${inv.id}`,
          stripeCustomerId: inv.customer as string, stripeSubscriptionId: inv.subscription as string,
        });
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await admin.from('subscriptions').update({
          cancel_at_period_end: sub.cancel_at_period_end, current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await admin.from('subscriptions').update({ status: 'cancelled', cancel_at_period_end: false }).eq('stripe_subscription_id', sub.id);
        break;
      }
    }
  } catch (e) {
    console.error('Stripe webhook handler failed', e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 }); // Stripe will retry
  }
  return NextResponse.json({ received: true });
}
