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

create table if not exists public.dubbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  description text,
  telegram_url text,
  vk_url text,
  support_url text,
  chat_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

insert into public.genres (name, slug)
values
  ('Фантастика', 'фантастика'),
  ('Драма', 'драма'),
  ('Шытырман', 'шытырман'),
  ('Биография', 'биография'),
  ('Анимация', 'анимация'),
  ('Отбасы', 'отбасы'),
  ('Экшн', 'экшн'),
  ('Комедия', 'комедия'),
  ('Романтика', 'романтика'),
  ('Қорқынышты', 'қорқынышты')
on conflict (slug) do nothing;

create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  type text not null check (type in ('movie', 'series', 'anime', 'dorama')),
  description text not null default '',
  poster_url text not null default '',
  banner_url text not null default '',
  trailer_url text,
  country text not null default '',
  year integer not null check (year >= 1888),
  status text not null default 'announced' check (status in ('completed', 'ongoing', 'announced')),
  age_rating text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  hls_url text,
  dubber_id uuid references public.dubbers(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text,
  slug text not null,
  description text,
  thumbnail_url text,
  hls_url text not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, episode_number),
  unique (content_id, slug)
);

create table if not exists public.content_genres (
  content_id uuid not null references public.contents(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete cascade,
  primary key (content_id, genre_id)
);

create or replace function public.set_episode_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug = new.episode_number::text;
  else
    new.slug = btrim(new.slug);
  end if;

  return new;
end;
$$;

drop trigger if exists set_contents_updated_at on public.contents;
create trigger set_contents_updated_at
before update on public.contents
for each row execute function public.set_updated_at();

drop trigger if exists set_episodes_updated_at on public.episodes;
create trigger set_episodes_updated_at
before update on public.episodes
for each row execute function public.set_updated_at();

drop trigger if exists set_episodes_slug on public.episodes;
create trigger set_episodes_slug
before insert or update of episode_number, slug on public.episodes
for each row execute function public.set_episode_slug();

create index if not exists contents_published_type_idx on public.contents (is_published, type, created_at desc);
create index if not exists contents_status_idx on public.contents (status, created_at desc);
create index if not exists contents_dubber_idx on public.contents (dubber_id);
create index if not exists episodes_content_order_idx on public.episodes (content_id, episode_number asc);
create index if not exists episodes_published_idx on public.episodes (is_published, content_id, episode_number asc);
create index if not exists content_genres_genre_idx on public.content_genres (genre_id);

alter table public.contents enable row level security;
alter table public.episodes enable row level security;
alter table public.genres enable row level security;
alter table public.content_genres enable row level security;
alter table public.dubbers enable row level security;

drop policy if exists "contents_select_published" on public.contents;
create policy "contents_select_published"
on public.contents for select
using (is_published = true);

drop policy if exists "episodes_select_published_content" on public.episodes;
create policy "episodes_select_published_content"
on public.episodes for select
using (
  is_published = true
  and exists (
    select 1 from public.contents
    where contents.id = episodes.content_id
      and contents.is_published = true
  )
);

drop policy if exists "genres_select_all" on public.genres;
create policy "genres_select_all"
on public.genres for select
using (true);

drop policy if exists "content_genres_select_published_content" on public.content_genres;
create policy "content_genres_select_published_content"
on public.content_genres for select
using (
  exists (
    select 1 from public.contents
    where contents.id = content_genres.content_id
      and contents.is_published = true
  )
);

drop policy if exists "dubbers_select_active" on public.dubbers;
create policy "dubbers_select_active"
on public.dubbers for select
using (is_active = true);

do $$
begin
  if to_regclass('public.movies') is not null then
    insert into public.genres (name, slug)
    select distinct
      genre_name,
      regexp_replace(lower(genre_name), '[^a-z0-9а-яәғқңөұүһі]+', '-', 'gi')
    from public.movies as legacy_movies
    cross join unnest(legacy_movies.genres) as genre_name
    where btrim(genre_name) <> ''
    on conflict (slug) do update
    set name = excluded.name;

    insert into public.contents (
      title,
      slug,
      type,
      description,
      poster_url,
      banner_url,
      trailer_url,
      country,
      year,
      status,
      age_rating,
      duration_minutes,
      hls_url,
      dubber_id,
      is_published,
      created_at,
      updated_at
    )
    select
      movies.title,
      movies.slug,
      'movie',
      movies.description,
      movies.poster_url,
      movies.backdrop_url,
      null,
      '',
      movies.year,
      'completed',
      null,
      null,
      movies.stream_master,
      null,
      movies.published,
      movies.created_at,
      movies.updated_at
    from public.movies
    on conflict (slug) do update
    set
      title = excluded.title,
      description = excluded.description,
      poster_url = excluded.poster_url,
      banner_url = excluded.banner_url,
      hls_url = excluded.hls_url,
      is_published = excluded.is_published,
      updated_at = now();

    insert into public.content_genres (content_id, genre_id)
    select contents.id, genres.id
    from public.movies
    join public.contents on contents.slug = movies.slug
    cross join unnest(movies.genres) as genre_name
    join public.genres on genres.slug = regexp_replace(lower(genre_name), '[^a-z0-9а-яәғқңөұүһі]+', '-', 'gi')
    on conflict do nothing;
  end if;
end $$;
