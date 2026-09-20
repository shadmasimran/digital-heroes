import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Admin' };

const TABS = [
  ['/admin', 'Overview'],
  ['/admin/users', 'Users'],
  ['/admin/draws', 'Draws'],
  ['/admin/charities', 'Charities'],
  ['/admin/winners', 'Winners'],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // every /admin route is gated here AND re-checked in each action
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <nav aria-label="Admin sections" className="mb-8 flex flex-wrap gap-2">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className="btn btn-ghost btn-sm">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
