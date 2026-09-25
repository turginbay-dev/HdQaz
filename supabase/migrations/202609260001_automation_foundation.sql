-- Phase 1. Apply after all earlier migrations. Never infer legacy season mapping.
begin;

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, season_number),
  unique (id, content_id)
);
create trigger set_seasons_updated_at before update on public.seasons
for each row execute function public.set_updated_at();
alter table public.seasons enable row level security;
revoke all on public.seasons from anon, authenticated;
grant select on public.seasons to anon, authenticated;
grant all on public.seasons to service_role;
create policy seasons_select_published_content on public.seasons for select
using (exists (select 1 from public.contents c where c.id = content_id and c.is_published));

-- NULL means explicitly unmapped. Existing IDs, slugs, publication and URLs stay unchanged.
alter table public.episodes add column season_id uuid;
alter table public.episodes add constraint episodes_season_content_fk
foreign key (season_id, content_id) references public.seasons(id, content_id) on delete restrict;
alter table public.episodes add constraint episodes_id_content_unique unique (id, content_id);
alter table public.episodes drop constraint episodes_content_id_episode_number_key;
create unique index episodes_season_number_unique on public.episodes(season_id, episode_number) where season_id is not null;
create unique index episodes_unmapped_number_unique on public.episodes(content_id, episode_number) where season_id is null;
alter table public.episodes alter column hls_url drop not null;
alter table public.episodes alter column is_published set default false;
-- NOT VALID preserves existing data while enforcing the rule for new/updated rows.
-- Audit old published rows before validating this constraint in production.
alter table public.episodes add constraint episodes_published_hls_required
check (not is_published or (hls_url is not null and btrim(hls_url) <> '')) not valid;

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  episode_id uuid,
  status text not null default 'queued' check (status in ('queued','downloading','processing','uploading','ready','failed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  next_attempt_at timestamptz,
  worker_id text,
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  output_manifest_url text,
  -- Only controlled codes/messages; never persist raw stderr, tokens or source URLs here.
  error_code text check (error_code in ('download_failed','invalid_media','processing_failed','upload_failed','lease_expired','internal_error')),
  error_message text generated always as (case error_code
    when 'download_failed' then 'Source download failed.'
    when 'invalid_media' then 'Source media is invalid.'
    when 'processing_failed' then 'Video processing failed.'
    when 'upload_failed' then 'Output upload failed.'
    when 'lease_expired' then 'Worker lease expired.'
    when 'internal_error' then 'Processing could not be completed.'
    else null end) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  foreign key (episode_id, content_id) references public.episodes(id, content_id) on delete restrict,
  check (attempt_count <= max_attempts),
  check (status <> 'ready' or (output_manifest_url is not null and btrim(output_manifest_url) <> '' and progress_percent = 100)),
  check (status <> 'failed' or error_code is not null),
  check ((worker_id is null and lease_token is null and lease_expires_at is null and heartbeat_at is null)
    or (worker_id is not null and lease_token is not null and lease_expires_at is not null and heartbeat_at is not null)),
  check (status not in ('downloading','processing','uploading') or lease_token is not null)
);
create index processing_jobs_claim_idx on public.processing_jobs(status, next_attempt_at, created_at);
create index processing_jobs_content_idx on public.processing_jobs(content_id);
create index processing_jobs_episode_idx on public.processing_jobs(episode_id);
create index processing_jobs_lease_idx on public.processing_jobs(lease_expires_at) where lease_token is not null;
create unique index processing_jobs_active_movie on public.processing_jobs(content_id)
where episode_id is null and status in ('queued','downloading','processing','uploading');
create unique index processing_jobs_active_episode on public.processing_jobs(episode_id)
where episode_id is not null and status in ('queued','downloading','processing','uploading');
create trigger set_processing_jobs_updated_at before update on public.processing_jobs
for each row execute function public.set_updated_at();
alter table public.processing_jobs enable row level security;
revoke all on public.processing_jobs from public, anon, authenticated;
grant all on public.processing_jobs to service_role;
-- No public or authenticated policies. Access is server-side only.

create function public.validate_processing_job_target() returns trigger
language plpgsql set search_path = public as $$
declare target_type text;
begin
  select type into target_type from public.contents where id = new.content_id for share;
  if not found then raise exception 'Processing content does not exist' using errcode = '23503'; end if;
  if new.episode_id is null and target_type <> 'movie' then
    raise exception 'Movie job requires movie content' using errcode = '23514';
  end if;
  if new.episode_id is not null and target_type = 'movie' then
    raise exception 'Episode job requires episodic content' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_processing_job_target before insert or update of content_id, episode_id
on public.processing_jobs for each row execute function public.validate_processing_job_target();

create function public.guard_content_processing_type() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.type is distinct from old.type and exists (
    select 1 from public.processing_jobs j where j.content_id = old.id
      and ((j.episode_id is null and new.type <> 'movie') or (j.episode_id is not null and new.type = 'movie'))
  ) then raise exception 'Content type conflicts with processing job target' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger guard_content_processing_type before update of type on public.contents
for each row execute function public.guard_content_processing_type();
revoke all on function public.validate_processing_job_target() from public, anon, authenticated;
revoke all on function public.guard_content_processing_type() from public, anon, authenticated;
commit;
