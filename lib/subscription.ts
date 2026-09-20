/**
 * Subscription state rules (PRD §04).
 *  active    – paid, and the current period has not ended
 *  lapsed    – marked active but the period ended without renewal
 *  cancelled – cancelled and the period ended (or provider deleted it)
 *  inactive  – never subscribed
 * Evaluated on every authenticated request via getViewer(), so status is always live.
 */
export type SubState = 'active' | 'lapsed' | 'cancelled' | 'inactive';

export function subscriptionState(sub: any | null | undefined, now = new Date()): SubState {
  if (!sub) return 'inactive';
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
  if (sub.status === 'active') return end && end > now ? 'active' : 'lapsed';
  if (sub.status === 'cancelled') return end && end > now ? 'active' : 'cancelled';
  return 'inactive';
}

export const isActive = (sub: any) => subscriptionState(sub) === 'active';

/** Monthly-equivalent value of a payment: yearly plans count 1/12 per month. */
export const monthlyEquivalent = (plan: string, amountCents: number) =>
  plan === 'yearly' ? Math.floor(amountCents / 12) : amountCents;

export const periodEndFor = (plan: 'monthly' | 'yearly', from = new Date()) => {
  const d = new Date(from);
  if (plan === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
};
