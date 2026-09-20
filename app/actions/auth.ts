'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { flash, safeNext } from '@/lib/flash';

const clean = (v: FormDataEntryValue | null) => String(v ?? '').trim();

export async function signUp(formData: FormData) {
  const email = clean(formData.get('email')).toLowerCase();
  const password = String(formData.get('password') ?? '');
  const fullName = clean(formData.get('full_name'));
  const charityId = clean(formData.get('charity_id'));
  const plan = clean(formData.get('plan'));
  const pct = Math.max(10, Math.min(100, Math.round(Number(formData.get('charity_percent')) || 10)));
  const back = plan ? `/signup?plan=${encodeURIComponent(plan)}` : '/signup';

  if (!fullName) flash(back, 'error', 'Enter your full name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) flash(back, 'error', 'Enter a valid email address.');
  if (password.length < 8) flash(back, 'error', 'Password must be at least 8 characters.');
  if (!charityId) flash(back, 'error', 'Choose a charity to support.');

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, charity_id: charityId, charity_percent: pct } },
  });
  if (error) flash(back, 'error', error.message);

  // If email confirmation is disabled we already have a session: go straight to plans.
  if (data.session) redirect(plan ? `/subscribe?plan=${encodeURIComponent(plan)}` : '/subscribe');
  flash('/login', 'msg', 'Account created. Confirm your email, then log in.');
}

export async function logIn(formData: FormData) {
  const email = clean(formData.get('email')).toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) flash(`/login?next=${encodeURIComponent(next)}`, 'error', 'Incorrect email or password.');
  redirect(next);
}

export async function logOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/');
}
