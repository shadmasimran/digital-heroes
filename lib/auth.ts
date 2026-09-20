import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { subscriptionState, type SubState } from '@/lib/subscription';

export type Viewer = {
  user: { id: string; email?: string };
  profile: any;
  subscription: any | null;
  subState: SubState;
  isAdmin: boolean;
};

/** Current user + profile + live subscription status, or null when signed out. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
  ]);
  return {
    user: { id: user.id, email: user.email },
    profile,
    subscription,
    subState: subscriptionState(subscription),
    isAdmin: profile?.role === 'admin',
  };
}

export async function requireUser(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect('/login');
  return v;
}

export async function requireAdmin(): Promise<Viewer> {
  const v = await requireUser();
  if (!v.isAdmin) redirect('/dashboard?error=' + encodeURIComponent('Administrator access required.'));
  return v;
}
