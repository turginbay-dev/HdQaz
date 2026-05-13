create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  original_title text not null,
  year integer not null check (year >= 1888),
  runtime text not null,
  rating text not null,
  description text not null,
  poster_url text not null,
  backdrop_url text not null,
  badges text[] not null default '{}',
  languages text[] not null default array['kk']::text[],
  genres text[] not null default '{}',
  catalogs text[] not null default '{}',
  is_premium boolean not null default false,
  is_new_release boolean not null default false,
  stream_master text not null,
  tmdb_id integer,
  quality text not null default '1080p',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.movies
add column if not exists languages text[] not null default array['kk']::text[];

alter table public.movies
drop constraint if exists movies_languages_allowed_check;

alter table public.movies
add constraint movies_languages_allowed_check
check (languages <@ array['kk', 'en', 'ru']::text[] and cardinality(languages) > 0);

create table if not exists public.content_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  original_title text,
  note text,
  status text not null default 'requested' check (status in ('requested', 'in_progress', 'ready', 'rejected')),
  votes integer not null default 0 check (votes >= 0),
  target_votes integer not null default 40 check (target_votes > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_votes (
  request_id uuid not null references public.content_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table if not exists public.watchlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_slug text not null references public.movies(slug) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_slug)
);

create table if not exists public.watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_slug text not null references public.movies(slug) on update cascade on delete cascade,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  duration_seconds integer not null check (duration_seconds > 0),
  percent integer not null default 0 check (percent between 0 and 100),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_slug)
);

create index if not exists movies_published_idx on public.movies (published, created_at desc);
create index if not exists movies_catalogs_idx on public.movies using gin (catalogs);
create index if not exists movies_genres_idx on public.movies using gin (genres);
create index if not exists content_requests_status_idx on public.content_requests (status, votes desc);
create index if not exists watch_progress_user_updated_idx on public.watch_progress (user_id, updated_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_movies_updated_at on public.movies;
create trigger set_movies_updated_at
before update on public.movies
for each row execute function public.set_updated_at();

drop trigger if exists set_content_requests_updated_at on public.content_requests;
create trigger set_content_requests_updated_at
before update on public.content_requests
for each row execute function public.set_updated_at();

create or replace function public.sync_request_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.content_requests
    set votes = votes + 1, updated_at = now()
    where id = new.request_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.content_requests
    set votes = greatest(votes - 1, 0), updated_at = now()
    where id = old.request_id;
    return old;
  end if;

  return null;
end;
$$;


drop trigger if exists sync_request_vote_count_insert on public.request_votes;
create trigger sync_request_vote_count_insert
after insert on public.request_votes
for each row execute function public.sync_request_vote_count();

drop trigger if exists sync_request_vote_count_delete on public.request_votes;
create trigger sync_request_vote_count_delete
after delete on public.request_votes
for each row execute function public.sync_request_vote_count();

alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.content_requests enable row level security;
alter table public.request_votes enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.watch_progress enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "movies_select_published" on public.movies;
create policy "movies_select_published"
on public.movies for select
using (published = true);

drop policy if exists "content_requests_select_all" on public.content_requests;
create policy "content_requests_select_all"
on public.content_requests for select
using (true);

drop policy if exists "content_requests_insert_auth" on public.content_requests;
create policy "content_requests_insert_auth"
on public.content_requests for insert
with check (auth.uid() = created_by);

drop policy if exists "request_votes_select_own" on public.request_votes;
create policy "request_votes_select_own"
on public.request_votes for select
using (auth.uid() = user_id);

drop policy if exists "request_votes_insert_own" on public.request_votes;
create policy "request_votes_insert_own"
on public.request_votes for insert
with check (auth.uid() = user_id);

drop policy if exists "request_votes_delete_own" on public.request_votes;
create policy "request_votes_delete_own"
on public.request_votes for delete
using (auth.uid() = user_id);

drop policy if exists "watchlist_select_own" on public.watchlist_items;
create policy "watchlist_select_own"
on public.watchlist_items for select
using (auth.uid() = user_id);

drop policy if exists "watchlist_insert_own" on public.watchlist_items;
create policy "watchlist_insert_own"
on public.watchlist_items for insert
with check (auth.uid() = user_id);

drop policy if exists "watchlist_delete_own" on public.watchlist_items;
create policy "watchlist_delete_own"
on public.watchlist_items for delete
using (auth.uid() = user_id);

drop policy if exists "watch_progress_select_own" on public.watch_progress;
create policy "watch_progress_select_own"
on public.watch_progress for select
using (auth.uid() = user_id);

drop policy if exists "watch_progress_insert_own" on public.watch_progress;
create policy "watch_progress_insert_own"
on public.watch_progress for insert
with check (auth.uid() = user_id);

drop policy if exists "watch_progress_update_own" on public.watch_progress;
create policy "watch_progress_update_own"
on public.watch_progress for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
