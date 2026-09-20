import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { subscriptionState } from '@/lib/subscription';
import { fmtDate } from '@/lib/format';
import { StatusPill } from '@/components/StatusPill';
import { Flash } from '@/components/Flash';

export default async function AdminUsers({ searchParams }: { searchParams: { q?: string; msg?: string; error?: string } }) {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: subs }, { data: authList }, { data: charities }] = await Promise.all([
    admin.from('profiles').select('*').order('created_at', { ascending: false }),
    admin.from('subscriptions').select('*'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('charities').select('id,name'),
  ]);
  const emails: Record<string, string> = {};
  (authList?.users || []).forEach((u: any) => { emails[u.id] = u.email; });
  const q = (searchParams.q || '').toLowerCase();
  const rows = (profiles || []).filter((p: any) => !q || p.full_name.toLowerCase().includes(q) || (emails[p.id] || '').toLowerCase().includes(q));

  return (
    <div>
      <h1 className="text-4xl">Users</h1>
      <div className="mt-5"><Flash msg={searchParams.msg} error={searchParams.error} /></div>
      <form className="mb-6 flex gap-3" role="search">
        <label htmlFor="q" className="sr-only">Search users</label>
        <input id="q" name="q" defaultValue={searchParams.q || ''} placeholder="Search name or email" className="field max-w-sm" />
        <button className="btn btn-dark">Search</button>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-paper">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-kelp/10"><tr>
            <th className="th">Name</th><th className="th">Email</th><th className="th">Subscription</th><th className="th">Charity</th><th className="th">Joined</th><th className="th"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody className="divide-y divide-kelp/10">
            {rows.map((p: any) => {
              const sub = (subs || []).find((s: any) => s.user_id === p.id);
              const ch = (charities || []).find((c: any) => c.id === p.charity_id);
              return (
                <tr key={p.id}>
                  <td className="td font-semibold">{p.full_name || '—'} {p.role === 'admin' && <span className="pill ml-1 bg-kelp text-paper">Admin</span>}</td>
                  <td className="td text-kelp/70">{emails[p.id]}</td>
                  <td className="td"><StatusPill status={subscriptionState(sub)} /> {sub && <span className="ml-1 text-xs text-kelp/60">{sub.plan}</span>}</td>
                  <td className="td text-kelp/70">{ch ? `${ch.name} (${p.charity_percent}%)` : '—'}</td>
                  <td className="td text-kelp/70">{fmtDate(p.created_at)}</td>
                  <td className="td text-right"><Link href={`/admin/users/${p.id}`} className="btn btn-ghost btn-sm">Manage</Link></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-kelp/60" colSpan={6}>No users match that search.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
