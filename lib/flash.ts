import { redirect } from 'next/navigation';

/** Redirect back to a page with a one-line success or error message in the URL. */
export function flash(path: string, kind: 'msg' | 'error', text: string): never {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}${kind}=${encodeURIComponent(text)}`);
}

/** Only allow same-site relative redirects (prevents open-redirect abuse). */
export function safeNext(next: unknown, fallback = '/dashboard') {
  const s = typeof next === 'string' ? next : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : fallback;
}
