alter table public.contents
add column if not exists intro_start_seconds integer,
add column if not exists intro_end_seconds integer;

alter table public.contents
drop constraint if exists contents_intro_window_check;

alter table public.contents
add constraint contents_intro_window_check check (
  (intro_start_seconds is null and intro_end_seconds is null)
  or (
    intro_start_seconds is not null
    and intro_end_seconds is not null
    and intro_start_seconds >= 0
    and intro_end_seconds > intro_start_seconds
  )
);

alter table public.episodes
add column if not exists intro_start_seconds integer,
add column if not exists intro_end_seconds integer;

alter table public.episodes
drop constraint if exists episodes_intro_window_check;

alter table public.episodes
add constraint episodes_intro_window_check check (
  (intro_start_seconds is null and intro_end_seconds is null)
  or (
    intro_start_seconds is not null
    and intro_end_seconds is not null
    and intro_start_seconds >= 0
    and intro_end_seconds > intro_start_seconds
  )
);
