import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { startDonation, updateCharityChoice } from '@/app/actions/subscription';
import { CharityArt } from '@/components/CharityArt';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';

export default async function CharityPage({ params, searchParams }: { params: { id: string }; searchParams: { msg?: string; error?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const [viewer, { data: charity }] = await Promise.all([
    getViewer(),
    supabase.from('charities').select('*, charity_events(*)').eq('id', params.id).maybeSingle(),
  ]);
  if (!charity) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const events = (charity.charity_events || []).filter((e: any) => e.event_date >= today).sort((a: any, b: any) => a.event_date.localeCompare(b.event_date));
  const isMine = viewer?.profile?.charity_id === charity.id;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/charities" className="text-sm font-semibold text-tide underline">All charities</Link>
      <div className="mt-5 overflow-hidden rounded-[2rem] bg-paper">
        <div className="h-64 sm:h-80"><CharityArt name={charity.name} imageUrl={charity.image_url} /></div>
        <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 className="text-4xl sm:text-5xl">{charity.name}</h1>
            <p className="mt-5 max-w-xl whitespace-pre-line text-lg text-kelp/80">{charity.description}</p>

            <h2 className="mt-10 text-2xl">Upcoming events</h2>
            {events.length === 0 ? (
              <p className="mt-3 text-kelp/60">No events are scheduled right now.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {events.map((e: any) => (
                  <li key={e.id} className="rounded-xl bg-mist px-4 py-3">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-sm text-kelp/70">{fmtDate(e.event_date)}{e.location ? `, ${e.location}` : ''}</p>
                    {e.description && <p className="mt-1 text-sm text-kelp/70">{e.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="space-y-5">
            <Flash msg={searchParams.msg} error={searchParams.error} />
            <div className="rounded-2xl bg-blush p-6">
              <h2 className="text-xl">Support with your subscription</h2>
              {viewer ? (
                isMine ? (
                  <p className="mt-3 text-sm text-kelp/80">This is your charity. {viewer.profile.charity_percent}% of each payment goes to it.</p>
                ) : (
                  <form action={updateCharityChoice} className="mt-4">
                    <input type="hidden" name="charity_id" value={charity.id} />
                    <input type="hidden" name="charity_percent" value={viewer.profile?.charity_percent || 10} />
                    <SubmitButton className="btn btn-dark w-full">Make this my charity</SubmitButton>
                  </form>
                )
              ) : (
                <Link href={`/signup?charity=${charity.id}`} className="btn btn-primary mt-4 w-full">Subscribe and support them</Link>
              )}
            </div>

            <div className="rounded-2xl bg-mist p-6">
              <h2 className="text-xl">Give once</h2>
              <p className="mt-2 text-sm text-kelp/70">A separate donation. It is not linked to the draw.</p>
              {viewer ? (
                <form action={startDonation} className="mt-4 space-y-3">
                  <input type="hidden" name="charity_id" value={charity.id} />
                  <label htmlFor="amount" className="label">Amount in rupees</label>
                  <input id="amount" name="amount" type="number" min={100} step={50} defaultValue={500} required className="field" />
                  <SubmitButton className="btn btn-primary w-full" pending="One moment…">Donate</SubmitButton>
                </form>
              ) : (
                <Link href={`/login?next=/charities/${charity.id}`} className="btn btn-ghost mt-4 w-full">Log in to donate</Link>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
