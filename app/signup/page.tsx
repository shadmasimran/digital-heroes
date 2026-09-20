import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { signUp } from '@/app/actions/auth';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';
import { PercentSlider } from '@/components/PercentSlider';

export const metadata = { title: 'Create your account' };

export default async function SignupPage({ searchParams }: { searchParams: { error?: string; plan?: string; charity?: string } }) {
  const supabase = createClient();
  const [{ data: charities }, settings] = await Promise.all([
    supabase.from('charities').select('id,name,description').eq('active', true).order('featured', { ascending: false }).order('name'),
    getSettings(),
  ]);
  const preselect = searchParams.charity || charities?.[0]?.id;

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-4xl">Start with the cause</h1>
      <p className="mt-2 text-kelp/70">Choose who benefits first. You will pick a plan on the next step.</p>
      <div className="mt-8">
        <Flash error={searchParams.error} />
        <form action={signUp} className="space-y-8">
          <input type="hidden" name="plan" value={searchParams.plan || ''} />

          <fieldset>
            <legend className="label mb-3 text-base">Your charity</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(charities || []).map((c: any) => (
                <label key={c.id} className="block cursor-pointer">
                  <input type="radio" name="charity_id" value={c.id} defaultChecked={c.id === preselect} required className="peer sr-only" />
                  <span className="block h-full rounded-2xl border-2 border-transparent bg-paper p-4 transition peer-checked:border-tide peer-checked:bg-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-tide hover:border-tide/40">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-kelp/65">{c.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="panel"><PercentSlider monthlyCents={settings.monthly_price_cents} /></div>

          <div className="panel space-y-5">
            <div>
              <label htmlFor="full_name" className="label">Full name</label>
              <input id="full_name" name="full_name" required autoComplete="name" className="field" />
            </div>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="field" />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
              <p className="hint">At least 8 characters.</p>
            </div>
            <SubmitButton className="btn btn-primary w-full py-3.5 text-base" pending="Creating your account…">Create account and choose a plan</SubmitButton>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-kelp/70">
          Already have an account? <Link href="/login" className="font-semibold text-tide underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
