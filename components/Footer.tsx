import Link from 'next/link';
import { Logo } from '@/components/Logo';

export function Footer() {
  return (
    <footer className="mt-24 bg-kelp text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm text-paper/70">
            A subscription that turns your rounds into monthly prizes and steady support for the causes you care about.
          </p>
        </div>
        <ul className="space-y-2.5 text-sm text-paper/80">
          <li><Link href="/charities" className="hover:text-marigold">Charities</Link></li>
          <li><Link href="/#how" className="hover:text-marigold">How it works</Link></li>
          <li><Link href="/#plans" className="hover:text-marigold">Plans</Link></li>
        </ul>
        <ul className="space-y-2.5 text-sm text-paper/80">
          <li><Link href="/login" className="hover:text-marigold">Log in</Link></li>
          <li><Link href="/signup" className="hover:text-marigold">Create account</Link></li>
          <li><Link href="/dashboard" className="hover:text-marigold">Dashboard</Link></li>
        </ul>
      </div>
    </footer>
  );
}
