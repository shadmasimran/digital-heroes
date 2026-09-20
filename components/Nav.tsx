import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import { logOut } from '@/app/actions/auth';
import { Logo } from '@/components/Logo';

export async function Nav() {
  const v = await getViewer();
  const links = (
    <>
      <Link href="/charities" className="hover:text-tide">Charities</Link>
      <Link href="/#how" className="hover:text-tide">How it works</Link>
      <Link href="/#plans" className="hover:text-tide">Plans</Link>
    </>
  );
  const account = v ? (
    <>
      <Link href="/dashboard" className="hover:text-tide">Dashboard</Link>
      {v.isAdmin && <Link href="/admin" className="hover:text-tide">Admin</Link>}
      <form action={logOut}><button className="hover:text-tide">Log out</button></form>
    </>
  ) : (
    <>
      <Link href="/login" className="hover:text-tide">Log in</Link>
      <Link href="/signup" className="btn btn-primary btn-sm">Subscribe</Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-kelp/10 bg-mist/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Logo />
        <nav className="hidden items-center gap-7 text-[15px] font-medium md:flex">{links}</nav>
        <div className="hidden items-center gap-6 text-[15px] font-medium md:flex">{account}</div>
        {/* Mobile menu: native <details>, no JS needed */}
        <details className="group relative md:hidden">
          <summary className="btn btn-ghost btn-sm cursor-pointer list-none">Menu</summary>
          <div className="absolute right-0 mt-2 flex w-56 flex-col gap-4 rounded-2xl bg-paper p-5 text-[15px] font-medium shadow-xl">
            {links}
            <hr className="border-kelp/10" />
            {account}
          </div>
        </details>
      </div>
    </header>
  );
}
