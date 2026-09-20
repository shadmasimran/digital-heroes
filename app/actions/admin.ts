'use server';

/**
 * Every action here starts with requireAdmin() and then uses the service-role
 * client, so authorisation is enforced in one obvious place.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { getSettings } from '@/lib/settings';
import { validateScore } from '@/lib/scores';
import { periodEndFor } from '@/lib/subscription';
import { evaluateDraw, parseManualNumbers, randomNumbers, weightedNumbers, type Bias } from '@/lib/draw';
import { latestRollover, loadDrawInputs } from '@/lib/draw-service';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/* ------------------------------ users ------------------------------ */

export async function adminUpdateProfile(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, 'user_id');
  const back = `/admin/users/${id}`;
  const pct = Math.round(Number(fd.get('charity_percent')));
  if (!Number.isFinite(pct) || pct < 10 || pct > 100) flash(back, 'error', 'Charity percentage must be between 10 and 100.');
  const role = str(fd, 'role') === 'admin' ? 'admin' : 'subscriber';
  if (id === me.user.id && role !== 'admin') flash(back, 'error', 'You cannot remove your own admin role.');
  await createAdminClient().from('profiles').update({
    full_name: str(fd, 'full_name'), charity_id: str(fd, 'charity_id') || null, charity_percent: pct, role,
  }).eq('id', id);
  flash(back, 'msg', 'Profile updated.');
}

export async function adminSetSubscription(fd: FormData) {
  await requireAdmin();
  const id = str(fd, 'user_id');
  const back = `/admin/users/${id}`;
  const plan = str(fd, 'plan') === 'yearly' ? 'yearly' : 'monthly';
  const status = ['active', 'cancelled', 'inactive'].includes(str(fd, 'status')) ? str(fd, 'status') : 'inactive';
  const endRaw = str(fd, 'period_end');
  const settings = await getSettings();
  const periodEnd = endRaw ? new Date(endRaw + 'T23:59:59Z') : periodEndFor(plan as any);
  await createAdminClient().from('subscriptions').upsert({
    user_id: id, plan, status,
    amount_cents: plan === 'yearly' ? settings.yearly_price_cents : settings.monthly_price_cents,
    current_period_end: periodEnd.toISOString(), cancel_at_period_end: status === 'cancelled',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  flash(back, 'msg', 'Subscription updated.');
}

export async function adminAddScore(fd: FormData) {
  await requireAdmin();
  const id = str(fd, 'user_id');
  const back = `/admin/users/${id}`;
  const invalid = validateScore(fd.get('score'), str(fd, 'played_on'));
  if (invalid) flash(back, 'error', invalid);
  const { error } = await createAdminClient().from('scores').insert({ user_id: id, score: Number(fd.get('score')), played_on: str(fd, 'played_on') });
  if (error?.code === '23505') flash(back, 'error', 'That user already has a score for that date.');
  if (error) flash(back, 'error', 'Could not add score.');
  flash(back, 'msg', 'Score added (oldest replaced if the user had five).');
}

export async function adminUpdateScore(fd: FormData) {
  await requireAdmin();
  const back = `/admin/users/${str(fd, 'user_id')}`;
  const invalid = validateScore(fd.get('score'), str(fd, 'played_on'));
  if (invalid) flash(back, 'error', invalid);
  const { error } = await createAdminClient().from('scores')
    .update({ score: Number(fd.get('score')), played_on: str(fd, 'played_on') }).eq('id', str(fd, 'id'));
  if (error?.code === '23505') flash(back, 'error', 'That user already has a score for that date.');
  flash(back, 'msg', 'Score updated.');
}

export async function adminDeleteScore(fd: FormData) {
  await requireAdmin();
  await createAdminClient().from('scores').delete().eq('id', str(fd, 'id'));
  flash(`/admin/users/${str(fd, 'user_id')}`, 'msg', 'Score deleted.');
}

/* ----------------------------- charities ---------------------------- */

export async function saveCharity(fd: FormData) {
  await requireAdmin();
  const id = str(fd, 'id');
  const name = str(fd, 'name');
  if (!name) flash('/admin/charities', 'error', 'A charity needs a name.');
  const row = {
    name, description: str(fd, 'description'), image_url: str(fd, 'image_url') || null,
    featured: fd.get('featured') === 'on', active: fd.get('active') === 'on',
  };
  const admin = createAdminClient();
  if (id) await admin.from('charities').update(row).eq('id', id);
  else await admin.from('charities').insert(row);
  flash('/admin/charities', 'msg', id ? 'Charity updated.' : 'Charity added.');
}

export async function deleteCharity(fd: FormData) {
  await requireAdmin();
  await createAdminClient().from('charities').delete().eq('id', str(fd, 'id'));
  flash('/admin/charities', 'msg', 'Charity deleted. Subscribers who chose it will be asked to pick another.');
}

export async function addCharityEvent(fd: FormData) {
  await requireAdmin();
  if (!str(fd, 'title') || !str(fd, 'event_date')) flash('/admin/charities', 'error', 'An event needs a title and a date.');
  await createAdminClient().from('charity_events').insert({
    charity_id: str(fd, 'charity_id'), title: str(fd, 'title'), event_date: str(fd, 'event_date'),
    location: str(fd, 'location') || null, description: str(fd, 'description') || null,
  });
  flash('/admin/charities', 'msg', 'Event added.');
}

export async function deleteCharityEvent(fd: FormData) {
  await requireAdmin();
  await createAdminClient().from('charity_events').delete().eq('id', str(fd, 'id'));
  flash('/admin/charities', 'msg', 'Event removed.');
}

/* ------------------------------- draws ------------------------------ */

/** Run (or re-run) a simulation. Nothing is visible to subscribers until it is published. */
export async function simulateDraw(fd: FormData) {
  await requireAdmin();
  const back = '/admin/draws';
  const month = str(fd, 'month');
  if (!/^\d{4}-\d{2}$/.test(month)) flash(back, 'error', 'Choose a month.');
  const monthDate = `${month}-01`;
  const mode = str(fd, 'mode') === 'algorithmic' ? 'algorithmic' : 'random';
  const bias: Bias = str(fd, 'bias') === 'rare' ? 'rare' : 'common';

  const admin = createAdminClient();
  const { data: existing } = await admin.from('draws').select('id,status').eq('month', monthDate).maybeSingle();
  if (existing?.status === 'published') flash(back, 'error', 'That month has already been published.');

  const settings = await getSettings();
  const inputs = await loadDrawInputs(settings.prize_pool_percent);
  const rollover = await latestRollover();

  let numbers: number[];
  const manualRaw = str(fd, 'manual');
  if (manualRaw) {
    const parsed = parseManualNumbers(manualRaw);
    if (typeof parsed === 'string') flash(back, 'error', parsed);
    numbers = parsed as number[];
  } else {
    numbers = mode === 'random' ? randomNumbers() : weightedNumbers(inputs.allScores, bias);
  }

  const result = evaluateDraw({ numbers, entries: inputs.entries, totalPoolCents: inputs.totalPoolCents, rolloverInCents: rollover });
  const simulation = {
    manual: Boolean(manualRaw), eligible: inputs.entries.length, pools: result.pools,
    distribution: result.distribution, unclaimed: result.unclaimed,
    winners: result.winners.map((w) => ({ ...w, name: inputs.names[w.userId] || 'Subscriber' })),
  };
  const { error } = await admin.from('draws').upsert({
    month: monthDate, mode, bias, status: 'simulated', numbers,
    pool_total_cents: inputs.totalPoolCents, rollover_in_cents: rollover,
    jackpot_rollover_out_cents: result.jackpotRolloverOut, active_subscribers: inputs.activeSubscribers, simulation,
  }, { onConflict: 'month' });
  if (error) flash(back, 'error', 'Could not save the simulation.');
  flash(back, 'msg', 'Simulation ready. Review it below, then publish when you are happy.');
}

/**
 * Publish: re-evaluates against live data using the simulated numbers, claims the
 * draw atomically (status simulated -> published), then writes entries and winners.
 */
export async function publishDraw(fd: FormData) {
  await requireAdmin();
  const back = '/admin/draws';
  const admin = createAdminClient();
  const { data: draw } = await admin.from('draws').select('*').eq('id', str(fd, 'draw_id')).maybeSingle();
  if (!draw || draw.status !== 'simulated') flash(back, 'error', 'Only a simulated draw can be published.');

  const settings = await getSettings();
  const inputs = await loadDrawInputs(settings.prize_pool_percent);
  const rollover = await latestRollover();
  const result = evaluateDraw({ numbers: draw.numbers, entries: inputs.entries, totalPoolCents: inputs.totalPoolCents, rolloverInCents: rollover });

  // Claim first so a double-click can never publish (and pay out) twice.
  const { data: claimed } = await admin.from('draws').update({
    status: 'published', published_at: new Date().toISOString(),
    pool_total_cents: inputs.totalPoolCents, rollover_in_cents: rollover,
    jackpot_rollover_out_cents: result.jackpotRolloverOut, active_subscribers: inputs.activeSubscribers,
    simulation: {
      eligible: inputs.entries.length, pools: result.pools, distribution: result.distribution, unclaimed: result.unclaimed,
      winners: result.winners.map((w) => ({ ...w, name: inputs.names[w.userId] || 'Subscriber' })),
    },
  }).eq('id', draw.id).eq('status', 'simulated').select('id');
  if (!claimed?.length) flash(back, 'error', 'This draw was already published.');

  if (result.entries.length)
    await admin.from('draw_entries').insert(result.entries.map((e) => ({ draw_id: draw.id, user_id: e.userId, scores: e.scores, match_count: e.matches })));
  if (result.winners.length)
    await admin.from('winners').insert(result.winners.map((w) => ({ draw_id: draw.id, user_id: w.userId, tier: w.tier, prize_cents: w.prizeCents })));

  flash(back, 'msg', `Draw published. ${result.winners.length} winner(s) notified on their dashboards.`);
}

/* ------------------------------ winners ----------------------------- */

export async function reviewWinner(fd: FormData) {
  await requireAdmin();
  const decision = str(fd, 'decision');
  const admin = createAdminClient();
  const { data: w } = await admin.from('winners').select('verification_status').eq('id', str(fd, 'id')).maybeSingle();
  if (!w || w.verification_status !== 'submitted') flash('/admin/winners', 'error', 'There is no submitted proof to review.');
  await admin.from('winners').update({
    verification_status: decision === 'approve' ? 'approved' : 'rejected',
    review_note: decision === 'approve' ? null : str(fd, 'note') || 'Proof was not accepted — please upload a clearer screenshot.',
  }).eq('id', str(fd, 'id'));
  flash('/admin/winners', 'msg', decision === 'approve' ? 'Winner approved.' : 'Submission rejected; the winner can upload again.');
}

export async function markPaid(fd: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: w } = await admin.from('winners').select('verification_status').eq('id', str(fd, 'id')).maybeSingle();
  if (w?.verification_status !== 'approved') flash('/admin/winners', 'error', 'Approve the proof before marking a payout as paid.');
  await admin.from('winners').update({ payment_status: 'paid' }).eq('id', str(fd, 'id'));
  flash('/admin/winners', 'msg', 'Payout marked as paid.');
}
