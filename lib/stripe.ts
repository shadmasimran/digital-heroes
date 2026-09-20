import 'server-only';
import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/**
 * Demo payments: lets reviewers test the full flow without a Stripe account.
 * Only active when explicitly enabled AND Stripe is not configured.
 */
export const demoPayments = !stripe && process.env.DEMO_PAYMENTS === 'true';
export const paymentsConfigured = Boolean(stripe) || demoPayments;
