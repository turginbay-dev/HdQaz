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

alter table public.contents
add column if not exists is_premium boolean not null default false;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  default_avatar_key text not null default 'hdqaz',
  role text not null default 'user' check (role in ('user', 'admin')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_display_name_length_check check (
    display_name is null or (char_length(btrim(display_name)) between 2 and 40)
  )
);

insert into public.user_profiles (id, display_name, avatar_url, role, is_admin, created_at, updated_at)
select
  profiles.id,
  nullif(btrim(profiles.display_name), ''),
  nullif(btrim(profiles.avatar_url), ''),
  case when profiles.role = 'admin' then 'admin' else 'user' end,
  profiles.role = 'admin',
  profiles.created_at,
  profiles.updated_at
from public.profiles
where to_regclass('public.profiles') is not null
on conflict (id) do nothing;

create table if not exists public.movie_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, movie_id)
);

create table if not exists public.movie_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, movie_id)
);

insert into public.movie_watchlist (user_id, movie_id, created_at)
select watchlist_items.user_id, contents.id, watchlist_items.created_at
from public.watchlist_items
join public.contents on contents.slug = watchlist_items.movie_slug
where to_regclass('public.watchlist_items') is not null
on conflict (user_id, movie_id) do nothing;

create table if not exists public.movie_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.contents(id) on delete cascade,
  parent_id uuid references public.movie_comments(id) on delete cascade,
  body text not null,
  is_spoiler boolean not null default false,
  is_hidden boolean not null default false,
  hidden_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movie_comments_body_length_check check (char_length(btrim(body)) between 1 and 500)
);

create table if not exists public.movie_views (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.contents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint movie_views_identity_check check (user_id is not null or session_id is not null)
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists movie_comments_movie_created_idx on public.movie_comments (movie_id, created_at desc);
create index if not exists movie_comments_user_created_idx on public.movie_comments (user_id, created_at desc);
create index if not exists movie_likes_movie_idx on public.movie_likes (movie_id);
create index if not exists movie_likes_user_created_idx on public.movie_likes (user_id, created_at desc);
create index if not exists movie_watchlist_movie_idx on public.movie_watchlist (movie_id);
create index if not exists movie_watchlist_user_created_idx on public.movie_watchlist (user_id, created_at desc);
create index if not exists movie_views_movie_created_idx on public.movie_views (movie_id, created_at desc);
create index if not exists movie_views_user_movie_created_idx on public.movie_views (user_id, movie_id, created_at desc);
create index if not exists movie_views_session_movie_created_idx on public.movie_views (session_id, movie_id, created_at desc);
create index if not exists user_subscriptions_user_idx on public.user_subscriptions (user_id);
create index if not exists user_subscriptions_user_status_idx on public.user_subscriptions (user_id, status, ends_at);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_movie_comments_updated_at on public.movie_comments;
create trigger set_movie_comments_updated_at
before update on public.movie_comments
for each row execute function public.set_updated_at();

drop trigger if exists set_user_subscriptions_updated_at on public.user_subscriptions;
create trigger set_user_subscriptions_updated_at
before update on public.user_subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name, avatar_url, default_avatar_key)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), ''),
    'hdqaz'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_user_profile on auth.users;
create trigger on_auth_user_created_user_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and (is_admin = true or role = 'admin')
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.user_profiles enable row level security;
alter table public.movie_likes enable row level security;
alter table public.movie_watchlist enable row level security;
alter table public.movie_comments enable row level security;
alter table public.movie_views enable row level security;
alter table public.user_subscriptions enable row level security;

drop policy if exists "user_profiles_select_own_or_admin" on public.user_profiles;
create policy "user_profiles_select_own_or_admin"
on public.user_profiles for select
using (auth.uid() = id or public.is_admin());

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles for insert
with check (
  auth.uid() = id
  and role = 'user'
  and is_admin = false
);

drop policy if exists "user_profiles_update_own_name_avatar" on public.user_profiles;
create policy "user_profiles_update_own_name_avatar"
on public.user_profiles for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = 'user'
  and is_admin = false
);

drop policy if exists "user_profiles_admin_all" on public.user_profiles;
create policy "user_profiles_admin_all"
on public.user_profiles for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "movie_likes_select_own_or_admin" on public.movie_likes;
create policy "movie_likes_select_own_or_admin"
on public.movie_likes for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "movie_likes_insert_own" on public.movie_likes;
create policy "movie_likes_insert_own"
on public.movie_likes for insert
with check (auth.uid() = user_id);

drop policy if exists "movie_likes_delete_own" on public.movie_likes;
create policy "movie_likes_delete_own"
on public.movie_likes for delete
using (auth.uid() = user_id);

drop policy if exists "movie_watchlist_select_own_or_admin" on public.movie_watchlist;
create policy "movie_watchlist_select_own_or_admin"
on public.movie_watchlist for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "movie_watchlist_insert_own" on public.movie_watchlist;
create policy "movie_watchlist_insert_own"
on public.movie_watchlist for insert
with check (auth.uid() = user_id);

drop policy if exists "movie_watchlist_delete_own" on public.movie_watchlist;
create policy "movie_watchlist_delete_own"
on public.movie_watchlist for delete
using (auth.uid() = user_id);

drop policy if exists "movie_comments_select_public_or_admin" on public.movie_comments;
create policy "movie_comments_select_public_or_admin"
on public.movie_comments for select
using (
  deleted_at is null
  and (
    is_hidden = false
    or public.is_admin()
  )
);

drop policy if exists "movie_comments_insert_own" on public.movie_comments;
create policy "movie_comments_insert_own"
on public.movie_comments for insert
with check (
  auth.uid() = user_id
  and deleted_at is null
  and is_hidden = false
);

drop policy if exists "movie_comments_update_admin" on public.movie_comments;
create policy "movie_comments_update_admin"
on public.movie_comments for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "movie_views_select_admin" on public.movie_views;
create policy "movie_views_select_admin"
on public.movie_views for select
using (public.is_admin());

drop policy if exists "movie_views_insert_auth_or_anon" on public.movie_views;
create policy "movie_views_insert_auth_or_anon"
on public.movie_views for insert
with check (
  auth.uid() = user_id
  or (auth.uid() is null and user_id is null and session_id is not null)
);

drop policy if exists "user_subscriptions_select_own_or_admin" on public.user_subscriptions;
create policy "user_subscriptions_select_own_or_admin"
on public.user_subscriptions for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "user_subscriptions_admin_all" on public.user_subscriptions;
create policy "user_subscriptions_admin_all"
on public.user_subscriptions for all
using (public.is_admin())
with check (public.is_admin());
