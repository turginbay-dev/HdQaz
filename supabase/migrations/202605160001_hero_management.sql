alter table public.contents
add column if not exists is_hero boolean not null default false;

alter table public.contents
add column if not exists hero_order integer;

alter table public.contents
add column if not exists hero_comment text;

alter table public.contents
drop constraint if exists contents_hero_order_check;

alter table public.contents
add constraint contents_hero_order_check
check (hero_order is null or hero_order >= 0);

create index if not exists contents_hero_order_idx
on public.contents (is_hero, hero_order asc, created_at desc)
where is_hero = true;
