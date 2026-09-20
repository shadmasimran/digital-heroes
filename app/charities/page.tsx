import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/format';
import { CharityArt } from '@/components/CharityArt';

export const metadata = { title: 'Charities' };

export default async function CharitiesPage({ searchParams }: { searchParams: { q?: string; filter?: string } }) {
  const supabase = createClient();
  let query = supabase.from('charities').select('id,name,description,image_url,featured,charity_events(title,event_date)').eq('active', true).order('featured', { ascending: false }).order('name');
  const q = (searchParams.q || '').trim();
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, '')}%,description.ilike.%${q.replace(/[%,()]/g, '')}%`);
  if (searchParams.filter === 'featured') query = query.eq('featured', true);
  const { data } = await query;
  const today = new Date().toISOString().slice(0, 10);
  let charities = (data || []) as any[];
  if (searchParams.filter === 'events') charities = charities.filter((c) => c.charity_events?.some((e: any) => e.event_date >= today));

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="text-4xl sm:text-5xl">Causes your rounds can back</h1>
      <p className="mt-3 max-w-2xl text-lg text-kelp/70">Every subscriber directs part of their fee to one of these. Read their stories, then choose.</p>

      <form className="mt-8 flex flex-wrap gap-3" role="search">
        <label htmlFor="q" className="sr-only">Search charities</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name or focus" className="field max-w-sm" />
        <label htmlFor="filter" className="sr-only">Filter</label>
        <select id="filter" name="filter" defaultValue={searchParams.filter || ''} className="field w-auto">
          <option value="">All charities</option>
          <option value="featured">Featured</option>
          <option value="events">With upcoming events</option>
        </select>
        <button className="btn btn-dark">Search</button>
      </form>

      {charities.length === 0 ? (
        <p className="mt-12 text-kelp/70">No charities match that search. <Link href="/charities" className="font-semibold text-tide underline">Clear the search</Link>.</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {charities.map((c) => {
            const ev = c.charity_events?.filter((e: any) => e.event_date >= today).sort((a: any, b: any) => a.event_date.localeCompare(b.event_date))[0];
            return (
              <Link key={c.id} href={`/charities/${c.id}`} className="group overflow-hidden rounded-2xl bg-paper shadow-[0_18px_40px_-28px_rgba(16,49,43,.4)] transition hover:-translate-y-1">
                <div className="h-44"><CharityArt name={c.name} imageUrl={c.image_url} /></div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl">{c.name}</h2>
                    {c.featured && <span className="pill shrink-0 bg-marigold/40">Featured</span>}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-kelp/70">{c.description}</p>
                  {ev && <p className="mt-4 text-sm font-medium text-tide">{ev.title}, {fmtDate(ev.event_date)}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
