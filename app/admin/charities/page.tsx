import { createAdminClient } from '@/lib/supabase/admin';
import { addCharityEvent, deleteCharity, deleteCharityEvent, saveCharity } from '@/app/actions/admin';
import { fmtDate } from '@/lib/format';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';

function CharityFields({ c }: { c?: any }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div><label htmlFor={`n-${c?.id || 'new'}`} className="label">Name</label><input id={`n-${c?.id || 'new'}`} name="name" defaultValue={c?.name} required className="field" /></div>
      <div><label htmlFor={`d-${c?.id || 'new'}`} className="label">Description</label><textarea id={`d-${c?.id || 'new'}`} name="description" defaultValue={c?.description} rows={4} className="field" /></div>
      <div><label htmlFor={`i-${c?.id || 'new'}`} className="label">Image URL</label><input id={`i-${c?.id || 'new'}`} name="image_url" type="url" defaultValue={c?.image_url || ''} placeholder="https://…" className="field" /><p className="hint">Optional. Without one, a generated tile is shown.</p></div>
      <div className="flex gap-6 text-sm font-medium">
        <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={c?.featured} className="h-4 w-4 accent-[#2F7F79]" /> Feature on homepage</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={c ? c.active : true} className="h-4 w-4 accent-[#2F7F79]" /> Visible to public</label>
      </div>
    </>
  );
}

export default async function AdminCharities({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  const admin = createAdminClient();
  const { data: charities } = await admin.from('charities').select('*, charity_events(*)').order('created_at');

  return (
    <div className="space-y-8">
      <h1 className="text-4xl">Charities</h1>
      <Flash msg={searchParams.msg} error={searchParams.error} />

      <details className="panel">
        <summary className="cursor-pointer text-xl font-semibold">Add a charity</summary>
        <form action={saveCharity} className="mt-5 max-w-xl space-y-4">
          <CharityFields />
          <SubmitButton className="btn btn-primary">Add charity</SubmitButton>
        </form>
      </details>

      <div className="space-y-4">
        {(charities || []).map((c: any) => (
          <details key={c.id} className="panel">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <span className="text-xl font-semibold">{c.name}</span>
              <span className="flex gap-2">
                {c.featured && <span className="pill bg-marigold/40">Featured</span>}
                {!c.active && <span className="pill bg-kelp/10">Hidden</span>}
              </span>
            </summary>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <form action={saveCharity} className="space-y-4">
                <CharityFields c={c} />
                <div className="flex gap-3"><SubmitButton className="btn btn-dark">Save changes</SubmitButton></div>
              </form>
              <div>
                <h3 className="text-lg">Events</h3>
                <ul className="mt-3 space-y-2">
                  {(c.charity_events || []).map((e: any) => (
                    <li key={e.id} className="flex items-start justify-between gap-3 rounded-xl bg-mist px-4 py-3 text-sm">
                      <span><span className="font-semibold">{e.title}</span><br />{fmtDate(e.event_date)}{e.location ? `, ${e.location}` : ''}</span>
                      <form action={deleteCharityEvent}><input type="hidden" name="id" value={e.id} /><button className="text-red-800 underline">Remove</button></form>
                    </li>
                  ))}
                  {(c.charity_events || []).length === 0 && <li className="text-sm text-kelp/60">No events yet.</li>}
                </ul>
                <form action={addCharityEvent} className="mt-4 space-y-3 rounded-xl border border-kelp/15 p-4">
                  <input type="hidden" name="charity_id" value={c.id} />
                  <input name="title" placeholder="Event title, e.g. Charity golf day" aria-label="Event title" required className="field" />
                  <div className="grid grid-cols-2 gap-3">
                    <input name="event_date" type="date" aria-label="Event date" required className="field" />
                    <input name="location" placeholder="Location" aria-label="Location" className="field" />
                  </div>
                  <SubmitButton className="btn btn-ghost btn-sm">Add event</SubmitButton>
                </form>
                <form action={deleteCharity} className="mt-8">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton className="btn btn-danger btn-sm" pending="Deleting…">Delete this charity</SubmitButton>
                </form>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
