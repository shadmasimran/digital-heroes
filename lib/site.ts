import { headers } from 'next/headers';

/**
 * The public address of the site, taken from the incoming request so redirects
 * (e.g. Stripe success/cancel URLs) are always right, even if NEXT_PUBLIC_SITE_URL
 * was mis-set. Falls back to the env var, then localhost.
 */
export function getSiteUrl(): string {
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (host) {
    const proto = (h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')).split(',')[0];
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}
