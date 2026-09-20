import Link from 'next/link';
import { SITE_NAME } from '@/lib/brand';

/** Wordmark: a drop with two ripples. */
export function Logo({ light = false }: { light?: boolean }) {
  const ink = light ? '#FBFCFA' : '#10312B';
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label={`${SITE_NAME} home`}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
        <circle cx="16" cy="16" r="14.5" stroke={ink} strokeOpacity=".28" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="9.5" stroke={ink} strokeOpacity=".55" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="4.5" fill="#F5B83D" />
      </svg>
      <span className="font-display text-xl" style={{ color: ink }}>{SITE_NAME}</span>
    </Link>
  );
}
