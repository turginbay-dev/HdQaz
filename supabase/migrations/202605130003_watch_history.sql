create extension if not exists pgcrypto;

create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  progress_seconds integer not null default 0 check (progress_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  completed boolean not null default false,
  last_watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_id)
);

create unique index if not exists watch_history_user_content_unique_idx
on public.watch_history (user_id, content_id);

create index if not exists watch_history_user_idx
on public.watch_history (user_id);

create index if not exists watch_history_content_idx
on public.watch_history (content_id);

create index if not exists watch_history_last_watched_idx
on public.watch_history (last_watched_at desc);

create index if not exists watch_history_user_last_watched_idx
on public.watch_history (user_id, last_watched_at desc);

drop trigger if exists set_watch_history_updated_at on public.watch_history;
create trigger set_watch_history_updated_at
before update on public.watch_history
for each row execute function public.set_updated_at();

alter table public.watch_history enable row level security;

drop policy if exists "watch_history_select_own" on public.watch_history;
create policy "watch_history_select_own"
on public.watch_history for select
using (auth.uid() = user_id);

drop policy if exists "watch_history_select_admin" on public.watch_history;
create policy "watch_history_select_admin"
on public.watch_history for select
using (public.is_admin());

drop policy if exists "watch_history_insert_own" on public.watch_history;
create policy "watch_history_insert_own"
on public.watch_history for insert
with check (
  auth.role() = 'authenticated'
  and auth.uid() = user_id
);

drop policy if exists "watch_history_update_own" on public.watch_history;
create policy "watch_history_update_own"
on public.watch_history for update
using (auth.uid() = user_id)
with check (
  auth.role() = 'authenticated'
  and auth.uid() = user_id
);
