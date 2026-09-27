-- Phase 2. Apply AFTER Phase 1 on staging first. Do not reapply Phase 1.
-- No catalog data updates, no publication, no legacy movies changes.
begin;

alter table public.processing_jobs add column output_metadata jsonb not null default '{}'::jsonb;

create function public.automation_valid_metadata(value jsonb) returns boolean
language plpgsql immutable set search_path = pg_catalog as $$
declare item record;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  for item in select * from jsonb_each(value) loop
    if item.key not in ('duration_seconds','width','height','size_bytes')
       or jsonb_typeof(item.value) <> 'number' then return false; end if;
    if item.value::text::numeric <= 0 or item.value::text::numeric > 9007199254740991 then return false; end if;
    if item.key = 'duration_seconds' and item.value::text::numeric > 604800 then return false; end if;
    if item.key <> 'duration_seconds' and trunc(item.value::text::numeric) <> item.value::text::numeric then return false; end if;
    if item.key in ('width','height') and item.value::text::numeric > 16384 then return false; end if;
  end loop;
  return true;
end $$;
alter table public.processing_jobs add constraint processing_jobs_metadata_safe
check (public.automation_valid_metadata(output_metadata));

create function public.automation_create_job(p_content_id uuid, p_episode_id uuid,
  p_idempotency_key uuid, p_max_attempts integer default 3)
returns setof public.processing_jobs language plpgsql set search_path = pg_catalog as $$
declare job public.processing_jobs;
begin
  if p_content_id is null or p_idempotency_key is null or p_max_attempts is null or p_max_attempts not between 1 and 10 then
    raise exception 'Invalid job input' using errcode='22023';
  end if;
  -- Phase 1 target trigger + composite FK validate movie/episode ownership.
  -- Phase 1 partial unique indexes protect active targets, including concurrent creates.
  insert into public.processing_jobs(content_id,episode_id,idempotency_key,max_attempts)
  values(p_content_id,p_episode_id,p_idempotency_key::text,p_max_attempts)
  on conflict(idempotency_key) do nothing returning * into job;
  if not found then
    select * into job from public.processing_jobs where idempotency_key=p_idempotency_key::text for share;
    if job.content_id is distinct from p_content_id or job.episode_id is distinct from p_episode_id
       or job.max_attempts is distinct from p_max_attempts then
      raise exception 'Idempotency key target conflict' using errcode='23505';
    end if;
  end if;
  return next job;
end $$;

create function public.automation_claim_job(p_worker_id text)
returns setof public.processing_jobs language plpgsql set search_path = pg_catalog as $$
declare job public.processing_jobs; claimed_at timestamptz;
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$' then
    raise exception 'Invalid worker' using errcode='22023';
  end if;
  -- Bounded cleanup; never wait behind another worker's locked job.
  with exhausted as (
    select id from public.processing_jobs
    where status in ('downloading','processing','uploading')
      and lease_expires_at <= clock_timestamp() and attempt_count >= max_attempts
    order by lease_expires_at,id for update skip locked limit 100
  )
  update public.processing_jobs j set status='failed',error_code='lease_expired',
    finished_at=clock_timestamp(),worker_id=null,lease_token=null,lease_expires_at=null,heartbeat_at=null
  from exhausted e where j.id=e.id;

  select * into job from public.processing_jobs
  where attempt_count < max_attempts and (
    (status='queued' and (next_attempt_at is null or next_attempt_at <= clock_timestamp()))
    or (status in ('downloading','processing','uploading') and lease_expires_at <= clock_timestamp())
  ) order by created_at,id for update skip locked limit 1;
  if not found then return; end if;
  claimed_at := clock_timestamp();
  update public.processing_jobs set status='downloading',progress_percent=0,
    attempt_count=attempt_count+1,worker_id=p_worker_id,lease_token=gen_random_uuid(),
    heartbeat_at=claimed_at,lease_expires_at=claimed_at+interval '120 seconds',
    next_attempt_at=null,started_at=claimed_at,finished_at=null,error_code=null,
    output_manifest_url=null,output_metadata='{}'::jsonb
  where id=job.id returning * into job;
  return next job;
end $$;

-- Row lock, DB time, authenticated worker identity AND per-claim token fence stale workers.
create function public.automation_update_job(p_job_id uuid,p_worker_id text,p_lease_token uuid,
  p_action text,p_stage text default null,p_progress integer default null,
  p_manifest text default null,p_metadata jsonb default '{}'::jsonb,p_error_code text default null)
returns setof public.processing_jobs language plpgsql set search_path = pg_catalog as $$
declare job public.processing_jobs; moment timestamptz; old_stage integer; new_stage integer;
begin
  select * into job from public.processing_jobs where id=p_job_id for update;
  if not found or p_worker_id is null or p_lease_token is null
    or job.worker_id is distinct from p_worker_id or job.lease_token is distinct from p_lease_token then
    raise exception 'Lease conflict' using errcode='P0001';
  end if;
  -- Safe replay after a lost response; terminal rows retain claim identity until retry.
  if p_action='complete' and job.status='ready' and job.output_manifest_url=p_manifest
     and job.output_metadata=p_metadata then return next job; return; end if;
  if p_action='fail' and job.status='failed' and job.error_code=p_error_code then return next job; return; end if;
  moment := clock_timestamp();
  if job.status not in ('downloading','processing','uploading') or job.lease_expires_at <= moment then
    raise exception 'Lease conflict' using errcode='P0001';
  end if;
  if p_action='heartbeat' then
    old_stage := array_position(array['downloading','processing','uploading'],job.status);
    new_stage := array_position(array['downloading','processing','uploading'],p_stage);
    if new_stage is null or new_stage < old_stage or new_stage > old_stage+1
      or p_progress is null or p_progress not between 0 and 100 or p_progress < job.progress_percent then
      raise exception 'Invalid progress or stage transition' using errcode='22023';
    end if;
    update public.processing_jobs set status=p_stage,progress_percent=p_progress,
      heartbeat_at=moment,lease_expires_at=moment+interval '120 seconds'
    where id=job.id returning * into job;
  elsif p_action='complete' then
    if job.status <> 'uploading' or p_manifest is null or length(p_manifest)>2048
      or p_manifest !~ '^https://[a-z0-9.-]+(/[A-Za-z0-9._~-]+)+\.m3u8$'
      or not public.automation_valid_metadata(p_metadata) then
      raise exception 'Invalid completion' using errcode='22023';
    end if;
    update public.processing_jobs set status='ready',progress_percent=100,
      output_manifest_url=p_manifest,output_metadata=p_metadata,error_code=null,finished_at=moment
    where id=job.id returning * into job;
  elsif p_action='fail' then
    if p_error_code is null or p_error_code not in
      ('download_failed','invalid_media','processing_failed','upload_failed','internal_error') then
      raise exception 'Invalid error code' using errcode='22023';
    end if;
    -- Phase 1 generated error_message stores only fixed safe text.
    update public.processing_jobs set status='failed',error_code=p_error_code,finished_at=moment
    where id=job.id returning * into job;
  else
    raise exception 'Invalid action' using errcode='22023';
  end if;
  return next job;
end $$;

create function public.automation_retry_job(p_job_id uuid)
returns setof public.processing_jobs language plpgsql set search_path = pg_catalog as $$
declare job public.processing_jobs;
begin
  select * into job from public.processing_jobs where id=p_job_id for update;
  if not found or job.status <> 'failed' or job.attempt_count >= job.max_attempts then
    raise exception 'Job is not retryable' using errcode='P0001';
  end if;
  update public.processing_jobs set status='queued',progress_percent=0,error_code=null,
    worker_id=null,lease_token=null,lease_expires_at=null,heartbeat_at=null,
    output_manifest_url=null,output_metadata='{}'::jsonb,started_at=null,finished_at=null,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(300,5*power(2,least(6,greatest(0,job.attempt_count-1))))::integer)
  where id=job.id returning * into job;
  return next job;
end $$;

-- RPCs are not available through an anon key or authenticated browser session.
revoke all on function public.automation_valid_metadata(jsonb) from public,anon,authenticated;
revoke all on function public.automation_create_job(uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.automation_claim_job(text) from public,anon,authenticated;
revoke all on function public.automation_update_job(uuid,text,uuid,text,text,integer,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.automation_retry_job(uuid) from public,anon,authenticated;
grant execute on function public.automation_valid_metadata(jsonb) to service_role;
grant execute on function public.automation_create_job(uuid,uuid,uuid,integer) to service_role;
grant execute on function public.automation_claim_job(text) to service_role;
grant execute on function public.automation_update_job(uuid,text,uuid,text,text,integer,text,jsonb,text) to service_role;
grant execute on function public.automation_retry_job(uuid) to service_role;
notify pgrst,'reload schema';
commit;
