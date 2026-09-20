'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { MAX_SCORES, validateScore } from '@/lib/scores';

const HOME = '/dashboard';

/** Only active subscribers can log scores (PRD §04 access control). */
async function requireActiveSubscriber() {
  const v = await requireUser();
  if (v.subState !== 'active') flash(HOME, 'error', 'Activate your subscription to log scores.');
  return v;
}

export async function addScore(formData: FormData) {
  const v = await requireActiveSubscriber();
  const score = formData.get('score');
  const playedOn = String(formData.get('played_on') ?? '');
  const invalid = validateScore(score, playedOn);
  if (invalid) flash(HOME, 'error', invalid);

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('scores').select('id,played_on').eq('user_id', v.user.id).order('played_on', { ascending: true });
  const rows = existing || [];

  if (rows.some((r: any) => r.played_on === playedOn))
    flash(HOME, 'error', 'You already have a score for that date. Edit or delete it instead.');
  // The rolling window keeps the latest 5 BY DATE, so a date older than all five can't be added.
  if (rows.length >= MAX_SCORES && playedOn < rows[0].played_on)
    flash(HOME, 'error', 'That round is older than your five latest scores, so it would be dropped straight away.');

  const { error } = await supabase.from('scores').insert({ user_id: v.user.id, score: Number(score), played_on: playedOn });
  if (error) flash(HOME, 'error', 'Could not save that score. Please try again.');
  // The database trigger trims to the latest 5 automatically.
  flash(HOME, 'msg', rows.length >= MAX_SCORES ? 'Score saved. Your oldest score was replaced.' : 'Score saved.');
}

export async function updateScore(formData: FormData) {
  const v = await requireActiveSubscriber();
  const id = String(formData.get('id') ?? '');
  const score = formData.get('score');
  const playedOn = String(formData.get('played_on') ?? '');
  const invalid = validateScore(score, playedOn);
  if (invalid) flash(HOME, 'error', invalid);

  const supabase = createClient();
  const { error } = await supabase
    .from('scores').update({ score: Number(score), played_on: playedOn }).eq('id', id).eq('user_id', v.user.id);
  if (error?.code === '23505') flash(HOME, 'error', 'You already have a score for that date.');
  if (error) flash(HOME, 'error', 'Could not update that score.');
  flash(HOME, 'msg', 'Score updated.');
}

export async function deleteScore(formData: FormData) {
  const v = await requireActiveSubscriber();
  const supabase = createClient();
  await supabase.from('scores').delete().eq('id', String(formData.get('id') ?? '')).eq('user_id', v.user.id);
  flash(HOME, 'msg', 'Score deleted.');
}
