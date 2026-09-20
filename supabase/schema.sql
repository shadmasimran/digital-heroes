-- =====================================================================
-- Ripple Rounds (Digital Heroes PRD, Level 1) — database schema
-- Run this whole file once in the Supabase SQL editor of a NEW project.
-- Money is stored in minor units (paise). Dates are UTC.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- helpers ---------------------------------------------------
create or replace function public.is_admin() returns boolean
language plpgsql security definer stable set search_path = public as $$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
end;
$$;

-- ---------- charities --------------------------------------------------
create table if not exists public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_url text,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.charity_events (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  title text not null,
  event_date date not null,
  location text,
  description text
);

-- ---------- profiles (1:1 with auth.users) -----------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'subscriber' check (role in ('subscriber','admin')),
  charity_id uuid references public.charities(id) on delete set null,
  -- PRD §08.1: minimum contribution is 10% of the subscription fee.
  charity_percent int not null default 10 check (charity_percent between 10 and 100),
  created_at timestamptz not null default now()
);

-- Create a profile automatically on signup. Role is NEVER read from user metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_charity uuid;
  v_pct int;
begin
  begin v_charity := nullif(new.raw_user_meta_data->>'charity_id','')::uuid;
  exception when others then v_charity := null; end;
  begin v_pct := greatest(10, least(100, coalesce((new.raw_user_meta_data->>'charity_percent')::int, 10)));
  exception when others then v_pct := 10; end;
  if v_charity is not null and not exists (select 1 from public.charities where id = v_charity) then
    v_charity := null;
  end if;
  insert into public.profiles (id, full_name, charity_id, charity_percent)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), v_charity, v_pct);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block privilege escalation: only admins (or the service role) may change a role.
create or replace function public.prevent_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only administrators can change roles';
  end if;
  return new;
end $$;
drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------- subscriptions ---------------------------------------------
-- One row per user. Access = status 'active' AND current_period_end in the future
-- (the app derives "lapsed" when the period has ended without renewal).
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('monthly','yearly')),
  status text not null default 'inactive' check (status in ('active','inactive','cancelled')),
  amount_cents int not null default 0,           -- price of the plan actually paid
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ledger of money directed to charities (subscription share + independent donations).
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  charity_id uuid references public.charities(id) on delete set null,
  amount_cents int not null check (amount_cents >= 0),
  source text not null check (source in ('subscription','donation')),
  external_ref text unique,                       -- Stripe invoice/session id => idempotent webhooks
  created_at timestamptz not null default now()
);

-- ---------- scores -----------------------------------------------------
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score int not null check (score between 1 and 45),   -- Stableford range
  played_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, played_on)                           -- one entry per date
);
create index if not exists scores_user_date_idx on public.scores (user_id, played_on desc);

-- Rolling window: keep only the latest 5 scores (by played date) per user.
create or replace function public.keep_latest_five_scores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.scores where id in (
    select id from public.scores where user_id = new.user_id
    order by played_on desc, created_at desc offset 5
  );
  return null;
end $$;
drop trigger if exists scores_keep_five on public.scores;
create trigger scores_keep_five after insert on public.scores
  for each row execute function public.keep_latest_five_scores();

-- ---------- draws ------------------------------------------------------
create table if not exists public.draws (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,                           -- first day of the draw month
  mode text not null check (mode in ('random','algorithmic')),
  bias text not null default 'common' check (bias in ('common','rare')),
  status text not null default 'simulated' check (status in ('simulated','published')),
  numbers int[] not null,
  pool_total_cents int not null default 0,              -- this month's pool before rollover
  rollover_in_cents int not null default 0,
  jackpot_rollover_out_cents int not null default 0,
  active_subscribers int not null default 0,
  simulation jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scores int[] not null,                                -- snapshot of the 5 scores used
  match_count int not null,
  unique (draw_id, user_id)
);

create table if not exists public.winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier int not null check (tier in (3,4,5)),
  prize_cents int not null,
  proof_path text,
  verification_status text not null default 'pending_proof'
    check (verification_status in ('pending_proof','submitted','approved','rejected')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  review_note text,
  created_at timestamptz not null default now(),
  unique (draw_id, user_id)
);

-- ---------- settings ---------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values
  ('monthly_price_cents', '49900'),
  ('yearly_price_cents', '499900'),
  ('prize_pool_percent', '50')
on conflict (key) do nothing;

-- ---------- row level security ----------------------------------------
alter table public.profiles       enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.contributions  enable row level security;
alter table public.scores         enable row level security;
alter table public.charities      enable row level security;
alter table public.charity_events enable row level security;
alter table public.draws          enable row level security;
alter table public.draw_entries   enable row level security;
alter table public.winners        enable row level security;
alter table public.settings       enable row level security;

create policy "profiles read own/admin"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles update own/admin" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy "subs read own/admin" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy "contrib read own/admin" on public.contributions for select using (user_id = auth.uid() or public.is_admin());

create policy "scores read"   on public.scores for select using (user_id = auth.uid() or public.is_admin());
create policy "scores insert" on public.scores for insert with check (user_id = auth.uid() or public.is_admin());
create policy "scores update" on public.scores for update using (user_id = auth.uid() or public.is_admin());
create policy "scores delete" on public.scores for delete using (user_id = auth.uid() or public.is_admin());

create policy "charities public read" on public.charities for select using (true);
create policy "charities admin write" on public.charities for all using (public.is_admin()) with check (public.is_admin());
create policy "events public read"    on public.charity_events for select using (true);
create policy "events admin write"    on public.charity_events for all using (public.is_admin()) with check (public.is_admin());

create policy "draws read published" on public.draws for select using (status = 'published' or public.is_admin());
create policy "draws admin write"    on public.draws for all using (public.is_admin()) with check (public.is_admin());
create policy "entries read own"     on public.draw_entries for select using (user_id = auth.uid() or public.is_admin());
create policy "winners read own"     on public.winners for select using (user_id = auth.uid() or public.is_admin());

create policy "settings public read" on public.settings for select using (true);
create policy "settings admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- Subscriptions, contributions, draw entries and winners are written only by the
-- server (service role), which bypasses RLS after the app has verified the caller.

-- ---------- storage: private bucket for winner proof screenshots -------
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false)
on conflict (id) do nothing;

-- ---------- seed: charities -------------------------------------------
insert into public.charities (name, description, featured) values
  ('Clean Water Collective', 'Builds and repairs community wells and filtration points in rural villages so that no child walks hours for a safe glass of water.', true),
  ('Bright Futures Foundation', 'Pays school fees, uniforms and books for first-generation learners, and funds after-school mentoring.', false),
  ('Second Innings', 'Coaching, equipment and small stipends for young athletes from families that cannot afford the game.', false),
  ('Greener Streets', 'Plants and maintains native trees in dense neighbourhoods and teaches local volunteers to care for them.', false),
  ('Open Doors Shelter', 'Emergency beds, hot meals and job-readiness support for people rebuilding after losing their home.', false)
on conflict do nothing;

insert into public.charity_events (charity_id, title, event_date, location, description)
select id, 'Charity Golf Day', (current_date + 21), 'Ahmedabad', 'A relaxed four-ball day; every entry fee goes straight to new wells.'
from public.charities where name = 'Clean Water Collective' limit 1;
insert into public.charity_events (charity_id, title, event_date, location, description)
select id, 'Scholarship Fundraiser Dinner', (current_date + 45), 'Gandhinagar', 'An evening with the students your subscriptions are supporting.'
from public.charities where name = 'Bright Futures Foundation' limit 1;
