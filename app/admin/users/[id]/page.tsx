import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { subscriptionState } from '@/lib/subscription';
import { adminAddScore, adminDeleteScore, adminSetSubscription, adminUpdateProfile, adminUpdateScore } from '@/app/actions/admin';
import { SCORE_MAX, SCORE_MIN } from '@/lib/draw';
import { StatusPill } from '@/components/StatusPill';
import { SubmitButton } from '@/components/SubmitButton';
import { Flash } from '@/components/Flash';

export default async function AdminUser({ params, searchParams }: { params: { id: string }; searchParams: { msg?: string; error?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const admin = createAdminClient();
  const [{ data: profile }, { data: sub }, { data: scores }, { data: charities }, { data: au }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', params.id).maybeSingle(),
    admin.from('subscriptions').select('*').eq('user_id', params.id).maybeSingle(),
    admin.from('scores').select('*').eq('user_id', params.id).order('played_on', { ascending: false }),
    admin.from('charities').select('id,name').order('name'),
    admin.auth.admin.getUserById(params.id),
  ]);
  if (!profile) notFound();
  const state = subscriptionState(sub);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-sm font-semibold text-tide underline">All users</Link>
        <h1 className="mt-3 text-4xl">{profile.full_name || 'Unnamed user'}</h1>
        <p className="text-kelp/70">{au?.user?.email}</p>
      </div>
      <Flash msg={searchParams.msg} error={searchParams.error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={adminUpdateProfile} className="panel space-y-4">
          <h2 className="text-2xl">Profile</h2>
          <input type="hidden" name="user_id" value={profile.id} />
          <div><label htmlFor="full_name" className="label">Full name</label><input id="full_name" name="full_name" defaultValue={profile.full_name} className="field" /></div>
          <div>
            <label htmlFor="charity_id" className="label">Charity</label>
            <select id="charity_id" name="charity_id" defaultValue={profile.charity_id || ''} className="field">
              <option value="">None</option>
              {(charities || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label htmlFor="charity_percent" className="label">Charity percentage (10–100)</label><input id="charity_percent" name="charity_percent" type="number" min={10} max={100} defaultValue={profile.charity_percent} className="field" /></div>
          <div>
            <label htmlFor="role" className="label">Role</label>
            <select id="role" name="role" defaultValue={profile.role} className="field"><option value="subscriber">Subscriber</option><option value="admin">Administrator</option></select>
          </div>
          <SubmitButton className="btn btn-dark">Save profile</SubmitButton>
        </form>

        <form action={adminSetSubscription} className="panel space-y-4">
          <div className="flex items-start justify-between"><h2 className="text-2xl">Subscription</h2><StatusPill status={state} /></div>
          <input type="hidden" name="user_id" value={profile.id} />
          <div>
            <label htmlFor="plan" className="label">Plan</label>
            <select id="plan" name="plan" defaultValue={sub?.plan || 'monthly'} className="field"><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
          </div>
          <div>
            <label htmlFor="status" className="label">Status</label>
            <select id="status" name="status" defaultValue={sub?.status || 'inactive'} className="field"><option value="active">Active</option><option value="cancelled">Cancelled</option><option value="inactive">Inactive</option></select>
          </div>
          <div>
            <label htmlFor="period_end" className="label">Paid until</label>
            <input id="period_end" name="period_end" type="date" defaultValue={sub?.current_period_end?.slice(0, 10) || ''} className="field" />
            <p className="hint">Leave empty to grant one full period from today.</p>
          </div>
          <SubmitButton className="btn btn-dark">Save subscription</SubmitButton>
        </form>
      </div>

      <section className="panel">
        <h2 className="text-2xl">Golf scores</h2>
        <p className="mt-1 text-sm text-kelp/65">Only the latest five are kept. Adding a sixth removes the oldest.</p>
        <form action={adminAddScore} className="mt-5 grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <input type="hidden" name="user_id" value={profile.id} />
          <div><label htmlFor="n-score" className="label">Score</label><input id="n-score" name="score" type="number" min={SCORE_MIN} max={SCORE_MAX} required className="field" /></div>
          <div><label htmlFor="n-date" className="label">Date played</label><input id="n-date" name="played_on" type="date" max={today} required className="field" /></div>
          <SubmitButton className="btn btn-primary">Add score</SubmitButton>
        </form>
        <ul className="mt-5 divide-y divide-kelp/10">
          {(scores || []).map((s: any) => (
            <li key={s.id} className="flex flex-wrap items-end gap-3 py-3">
              <form action={adminUpdateScore} className="flex flex-1 flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="user_id" value={profile.id} />
                <input aria-label="Score" name="score" type="number" min={SCORE_MIN} max={SCORE_MAX} defaultValue={s.score} className="field w-24 py-2" />
                <input aria-label="Date" name="played_on" type="date" max={today} defaultValue={s.played_on} className="field w-auto py-2" />
                <SubmitButton className="btn btn-ghost btn-sm">Update</SubmitButton>
              </form>
              <form action={adminDeleteScore}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="user_id" value={profile.id} />
                <SubmitButton className="btn btn-danger btn-sm">Delete</SubmitButton>
              </form>
            </li>
          ))}
          {(scores || []).length === 0 && <li className="py-4 text-kelp/60">This user has not logged any scores.</li>}
        </ul>
      </section>
    </div>
  );
}
