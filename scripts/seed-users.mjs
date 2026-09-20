/**
 * Creates the reviewer accounts + demo data.  Run once after applying supabase/schema.sql:
 *     npm run seed
 * Safe to re-run: existing users are reused and their demo data is refreshed.
 *
 *   Admin       admin@ripplerounds.test   /  Admin@12345
 *   Subscriber  demo@ripplerounds.test    /  Demo@12345   (active yearly plan, 5 scores)
 *   + 8 extra active subscribers (player1..8@ripplerounds.test / Demo@12345) so draws have entrants
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: charities } = await db.from('charities').select('id').order('created_at');
if (!charities?.length) { console.error('No charities found — did you run supabase/schema.sql?'); process.exit(1); }

const { data: settings } = await db.from('settings').select('key,value');
const price = Object.fromEntries((settings || []).map((s) => [s.key, Number(s.value)]));

async function upsertUser(email, password, fullName, charityId, pct = 10) {
  let id;
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName, charity_id: charityId, charity_percent: pct },
  });
  if (error) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    id = list.users.find((u) => u.email === email)?.id;
    if (!id) throw error;
  } else id = data.user.id;
  await db.from('profiles').update({ full_name: fullName, charity_id: charityId, charity_percent: pct }).eq('id', id);
  return id;
}

async function subscribe(userId, plan, charityId, pct) {
  const amount = plan === 'yearly' ? price.yearly_price_cents : price.monthly_price_cents;
  const end = new Date(); end.setUTCDate(end.getUTCDate() + (plan === 'yearly' ? 300 : 20));
  await db.from('subscriptions').upsert({ user_id: userId, plan, status: 'active', amount_cents: amount, current_period_end: end.toISOString() }, { onConflict: 'user_id' });
  await db.from('contributions').upsert({ user_id: userId, charity_id: charityId, amount_cents: Math.floor(amount * pct / 100), source: 'subscription', external_ref: `seed_${userId}` }, { onConflict: 'external_ref' });
}

async function setScores(userId, values) {
  await db.from('scores').delete().eq('user_id', userId);
  const rows = values.map((score, i) => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - (i * 6 + 1));
    return { user_id: userId, score, played_on: d.toISOString().slice(0, 10) };
  });
  await db.from('scores').insert(rows);
}

// Admin
const adminId = await upsertUser('admin@ripplerounds.test', 'Admin@12345', 'Site Admin', charities[0].id);
await db.from('profiles').update({ role: 'admin' }).eq('id', adminId);

// Reviewer's demo subscriber
const demoId = await upsertUser('demo@ripplerounds.test', 'Demo@12345', 'Demo Subscriber', charities[0].id, 15);
await subscribe(demoId, 'yearly', charities[0].id, 15);
await setScores(demoId, [32, 28, 35, 30, 38]);

// Extra entrants. Scores overlap on purpose so algorithmic draws produce winners.
const pool = [28, 30, 31, 32, 33, 35, 36, 38];
for (let i = 1; i <= 8; i++) {
  const charity = charities[i % charities.length].id;
  const id = await upsertUser(`player${i}@ripplerounds.test`, 'Demo@12345', `Player ${i}`, charity, 10 + i);
  await subscribe(id, i % 3 === 0 ? 'yearly' : 'monthly', charity, 10 + i);
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  await setScores(id, picks);
}
console.log('Seeded. Admin: admin@ripplerounds.test / Admin@12345   Subscriber: demo@ripplerounds.test / Demo@12345');
