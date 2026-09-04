-- Habikit — schéma Supabase proposé (Postgres).
-- À coller dans le SQL editor du projet Supabase. Miroir de src/types.ts.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  icon        text not null default '✅',
  color       text not null default 'violet',
  kind        text not null default 'build' check (kind in ('build', 'quit')),
  unit        text not null default 'fois',
  metric      text not null default 'count' check (metric in ('count', 'duration', 'amount')),
  fields      text[] not null default '{}',          -- sous-ensemble de {duration, amount, note}
  goal        jsonb,                                  -- { type: 'min'|'max', value, metric, period }
  consequence text,
  options     text[],                                 -- choix proposés (Bière, Vin… / Vélo, Escalade…)
  default_option text,                                -- choix du +1 rapide
  allow_custom_option boolean not null default false,
  archived    boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- entries : un log. Plusieurs par jour et par habitude.
-- ---------------------------------------------------------------------------
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  habit_id    uuid not null references public.habits (id) on delete cascade,
  date        date not null,                          -- jour local côté client
  at          timestamptz not null default now(),
  count       numeric not null default 1,
  duration    numeric,                                -- heures décimales
  amount      numeric,                                -- euros
  note        text,
  category    text,                                   -- choix retenu (ou texte libre)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists entries_user_habit_date_idx on public.entries (user_id, habit_id, date desc);
create index if not exists habits_user_idx on public.habits (user_id, position);

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists habits_updated_at on public.habits;
create trigger habits_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

drop trigger if exists entries_updated_at on public.entries;
create trigger entries_updated_at before update on public.entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security : chacun ne voit que ses lignes.
-- ---------------------------------------------------------------------------
alter table public.habits  enable row level security;
alter table public.entries enable row level security;

drop policy if exists "habits: own rows" on public.habits;
create policy "habits: own rows" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "entries: own rows" on public.entries;
create policy "entries: own rows" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Facultatif : abonnements Web Push. Décision du 2026-09-04 : pas de notifications.
-- Laisser cette table de côté ; elle ne gêne pas si elle est créée.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null,                         -- { p256dh, auth }
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push: own rows" on public.push_subscriptions;
create policy "push: own rows" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
