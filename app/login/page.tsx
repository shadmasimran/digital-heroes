import Link from 'next/link';
import { logIn } from '@/app/actions/auth';
import { Flash } from '@/components/Flash';
import { SubmitButton } from '@/components/SubmitButton';

export const metadata = { title: 'Log in' };

export default function LoginPage({ searchParams }: { searchParams: { msg?: string; error?: string; next?: string } }) {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-4xl">Welcome back</h1>
      <p className="mt-2 text-kelp/70">Log in to enter scores, check the draw and see what your charity has received.</p>
      <div className="mt-8">
        <Flash msg={searchParams.msg} error={searchParams.error} />
        <form action={logIn} className="panel space-y-5">
          <input type="hidden" name="next" value={searchParams.next || '/dashboard'} />
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="field" />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
          </div>
          <SubmitButton className="btn btn-dark w-full" pending="Logging in…">Log in</SubmitButton>
        </form>
        <p className="mt-6 text-center text-sm text-kelp/70">
          New here? <Link href="/signup" className="font-semibold text-tide underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
