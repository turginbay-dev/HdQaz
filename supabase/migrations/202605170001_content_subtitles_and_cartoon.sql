alter table public.contents
add column if not exists has_kazakh_subtitles boolean not null default false;

update public.contents
set has_kazakh_subtitles = true
where has_kazakh_subtitles = false
  and dubber_id is null;

alter table public.contents
drop constraint if exists contents_type_check;

alter table public.contents
add constraint contents_type_check
check (type in ('movie', 'series', 'anime', 'dorama', 'cartoon'));

insert into public.genres (name, slug)
values ('Мультфильм', 'мультфильм')
on conflict (slug) do update
set name = excluded.name;
