-- Phase 4: private, additive workflow storage. Does not update existing catalog rows.
begin;
create table public.telegram_workflows (
 id uuid primary key default gen_random_uuid(), actor_id bigint not null check(actor_id>0),
 revision integer not null default 0, kind text not null check(kind in ('movie','series')),
 state text not null default 'draft' check(state in ('draft','staging','submitted','rejected','published')),
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),
 source_ref uuid, content_id uuid references public.contents(id), episode_id uuid references public.episodes(id),
 job_id uuid unique references public.processing_jobs(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index telegram_workflows_actor on public.telegram_workflows(actor_id,created_at desc);
create table public.telegram_tmdb_titles (
 media_type text not null check(media_type in ('movie','tv')), tmdb_id integer not null check(tmdb_id>0),
 content_id uuid not null unique references public.contents(id), primary key(media_type,tmdb_id)
);
create table public.telegram_receipts (
 actor_id bigint not null, request_id uuid not null, request_hash text not null, response jsonb not null,
 created_at timestamptz not null default now(), primary key(actor_id,request_id)
);
create table public.telegram_publications (
 workflow_id uuid primary key references public.telegram_workflows(id), job_id uuid not null unique references public.processing_jobs(id),
 actor_id bigint not null, manifest_url text not null, published_at timestamptz not null default now()
);
create table public.telegram_channel_posts (
 id uuid primary key default gen_random_uuid(), workflow_id uuid not null unique references public.telegram_publications(workflow_id),
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','uncertain','disabled')),
 claim_token uuid, claimed_at timestamptz, channel_id text, message_id bigint, attempts integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.telegram_runtime (
 id text primary key check(id='private-bot'), update_offset bigint not null default 0 check(update_offset>=0),
 lease_owner uuid, lease_until timestamptz
);
insert into public.telegram_runtime(id) values('private-bot');
-- No public policies: only the scoped Next.js boundary holds a service-role client.
do $$ declare t text; begin
 foreach t in array array['telegram_workflows','telegram_tmdb_titles','telegram_receipts','telegram_publications','telegram_channel_posts','telegram_runtime'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function public.telegram_workflow_action(p_actor bigint,p_request uuid,p_action text,p_id uuid,p_revision integer,p_data jsonb)
returns jsonb language plpgsql set search_path=pg_catalog as $$
declare w public.telegram_workflows; j public.processing_jobs; c public.contents; e public.episodes;
 receipt public.telegram_receipts; result jsonb; fingerprint text; cid uuid; sid uuid; eid uuid; genre text;
begin
 if p_actor is null or p_actor<=0 or p_request is null or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid input' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(p_actor);
 fingerprint:=md5(jsonb_build_array(p_action,p_id,p_revision,p_data)::text);
 select * into receipt from public.telegram_receipts where actor_id=p_actor and request_id=p_request;
 if found then
  if receipt.request_hash<>fingerprint then raise exception 'Request conflict' using errcode='23505'; end if;
  return receipt.response;
 end if;
 if p_action='new' then
  insert into public.telegram_workflows(actor_id,kind) values(p_actor,p_data->>'kind') returning * into w;
 else
  select * into w from public.telegram_workflows where id=p_id and actor_id=p_actor for update;
  if not found then raise exception 'Unknown workflow' using errcode='22023'; end if;
  -- Terminal idempotency is target-bound, while all other old buttons are rejected.
  if p_action='publish' and w.state='published' then return to_jsonb(w); end if;
  if w.revision is distinct from p_revision then raise exception 'Stale workflow' using errcode='P0001'; end if;
  if p_action='edit' then
   if w.state<>'draft' then raise exception 'Draft required' using errcode='P0001'; end if;
   update public.telegram_workflows set metadata=p_data,revision=revision+1,updated_at=now() where id=w.id returning * into w;
  elsif p_action='source' then
   if w.state<>'draft' then raise exception 'Draft required' using errcode='P0001'; end if;
   update public.telegram_workflows set source_ref=(p_data->>'source_ref')::uuid,revision=revision+1,updated_at=now() where id=w.id returning * into w;
  elsif p_action='prepare' then
   if w.state<>'draft' or not (w.metadata ? 'title') or not (w.metadata ? 'year') then raise exception 'Draft incomplete' using errcode='P0001'; end if;
   if p_data->>'source_ref' is null then raise exception 'Source required' using errcode='22023'; end if;
   -- Serialize TMDB identity creation without touching any existing title's metadata.
   if w.metadata ? 'tmdb_id' then
    perform pg_advisory_xact_lock(hashtextextended('tmdb:'||w.kind||':'||(w.metadata->>'tmdb_id'),0));
    select content_id into cid from public.telegram_tmdb_titles where media_type=case when w.kind='movie' then 'movie' else 'tv' end and tmdb_id=(w.metadata->>'tmdb_id')::integer;
   end if;
   if w.metadata ? 'existing_content_id' then
    cid:=(w.metadata->>'existing_content_id')::uuid;
    select * into c from public.contents where id=cid for update;
    if not found or w.kind<>'series' or c.type='movie' then raise exception 'Invalid existing title' using errcode='23514'; end if;
   end if;
   if cid is null then
    insert into public.contents(title,slug,type,year,description,country,poster_url,banner_url,duration_minutes,dubber_id,is_premium,is_published)
    values(w.metadata->>'title','tg-'||w.id::text,w.kind,(w.metadata->>'year')::integer,coalesce(w.metadata->>'description',''),coalesce(w.metadata->>'country',''),
     coalesce(w.metadata->>'poster_url',''),coalesce(w.metadata->>'banner_url',''),(w.metadata->>'duration_minutes')::integer,(w.metadata->>'dubber_id')::uuid,
     coalesce((w.metadata->>'is_premium')::boolean,false),false) returning id into cid;
    if w.metadata ? 'tmdb_id' then
     insert into public.telegram_tmdb_titles values(case when w.kind='movie' then 'movie' else 'tv' end,(w.metadata->>'tmdb_id')::integer,cid);
    end if;
    -- Enrichment only maps existing genre labels; never invent or overwrite HD Qaz genres.
    for genre in select jsonb_array_elements_text(coalesce(w.metadata->'genres','[]'::jsonb)) loop
     insert into public.content_genres(content_id,genre_id) select cid,id from public.genres where lower(name)=lower(genre) on conflict do nothing;
    end loop;
   end if;
   select * into c from public.contents where id=cid for update;
   if w.kind='movie' then
    if c.type<>'movie' or c.is_published or c.hls_url is not null then raise exception 'Existing output protected' using errcode='P0001'; end if;
   else
    if not (w.metadata ? 'season_number') or not (w.metadata ? 'episode_number') then raise exception 'Episode required' using errcode='22023'; end if;
    insert into public.seasons(content_id,season_number) values(cid,(w.metadata->>'season_number')::integer) on conflict(content_id,season_number) do nothing;
    select id into sid from public.seasons where content_id=cid and season_number=(w.metadata->>'season_number')::integer;
    select * into e from public.episodes where season_id=sid and episode_number=(w.metadata->>'episode_number')::integer for update;
    if found then
     if e.is_published or e.hls_url is not null then raise exception 'Existing episode protected' using errcode='P0001'; end if;
     eid:=e.id;
    else
     insert into public.episodes(content_id,season_id,episode_number,slug,title,description,is_published)
     values(cid,sid,(w.metadata->>'episode_number')::integer,'s'||(w.metadata->>'season_number')||'-e'||(w.metadata->>'episode_number'),w.metadata->>'episode_title',w.metadata->>'episode_description',false) returning id into eid;
    end if;
   end if;
   select * into j from public.automation_create_job(cid,eid,w.id,3);
   -- Hold inside the same transaction, before any worker can see the queued row.
   update public.processing_jobs set next_attempt_at='infinity' where id=j.id;
   update public.telegram_workflows set content_id=cid,episode_id=eid,job_id=j.id,source_ref=(p_data->>'source_ref')::uuid,state='staging',revision=revision+1,updated_at=now() where id=w.id returning * into w;
  elsif p_action='activate' then
   if w.state<>'staging' then raise exception 'Staging required' using errcode='P0001'; end if;
   update public.processing_jobs set next_attempt_at=now() where id=w.job_id and status='queued' and attempt_count=0;
   if not found then raise exception 'Job changed' using errcode='P0001'; end if;
   update public.telegram_workflows set state='submitted',revision=revision+1,updated_at=now() where id=w.id returning * into w;
  elsif p_action='post_retry' then
   if w.state<>'published' then raise exception 'Publication required' using errcode='P0001'; end if;
   update public.telegram_channel_posts set status='pending',claim_token=null,claimed_at=null,updated_at=now() where workflow_id=w.id and status='failed' and attempts<5;
   if not found then raise exception 'Only definite failures may retry' using errcode='P0001'; end if;
   update public.telegram_workflows set revision=revision+1,updated_at=now() where id=w.id returning * into w;
  elsif p_action in ('publish','reject','retry') then
   select * into j from public.processing_jobs where id=w.job_id for update;
   if not found or j.content_id is distinct from w.content_id or j.episode_id is distinct from w.episode_id then raise exception 'Target mismatch' using errcode='P0001'; end if;
   if p_action='retry' then
    if w.state<>'submitted' or j.status<>'failed' then raise exception 'Failed job required' using errcode='P0001'; end if;
    perform public.automation_retry_job(j.id);
   else
    if w.state<>'submitted' or j.status<>'ready' then raise exception 'Ready review required' using errcode='P0001'; end if;
    if p_action='publish' then
     if j.output_manifest_url is distinct from p_data->>'manifest_url' or j.output_manifest_url !~ '^https://[^/?#]+/candidates/[A-Za-z0-9/_~.\-]+\.m3u8$' then raise exception 'Manifest mismatch' using errcode='22023'; end if;
     select * into c from public.contents where id=w.content_id for update;
     if w.episode_id is null then
      if c.is_published or c.hls_url is not null then raise exception 'Existing output protected' using errcode='P0001'; end if;
      update public.contents set hls_url=j.output_manifest_url,is_published=true where id=c.id;
     else
      select * into e from public.episodes where id=w.episode_id and content_id=w.content_id for update;
      if not found or e.is_published or e.hls_url is not null then raise exception 'Existing output protected' using errcode='P0001'; end if;
      update public.episodes set hls_url=j.output_manifest_url,is_published=true where id=e.id;
      -- Never modify an existing title. New titles created by this workflow may become visible.
      if not c.is_published then
       if not exists(select 1 from public.telegram_tmdb_titles where content_id=c.id) then raise exception 'Existing draft title requires web review' using errcode='P0001'; end if;
       update public.contents set is_published=true where id=c.id;
      end if;
     end if;
     insert into public.telegram_publications(workflow_id,job_id,actor_id,manifest_url) values(w.id,j.id,p_actor,j.output_manifest_url);
     insert into public.telegram_channel_posts(workflow_id) values(w.id);
    end if;
    update public.telegram_workflows set state=case when p_action='publish' then 'published' else 'rejected' end where id=w.id;
   end if;
   update public.telegram_workflows set revision=revision+1,updated_at=now() where id=w.id returning * into w;
  else raise exception 'Unknown action' using errcode='22023'; end if;
 end if;
 result:=to_jsonb(w);
 insert into public.telegram_receipts(actor_id,request_id,request_hash,response) values(p_actor,p_request,fingerprint,result);
 return result;
end $$;
revoke all on function public.telegram_workflow_action(bigint,uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.telegram_workflow_action(bigint,uuid,text,uuid,integer,jsonb) to service_role;

create function public.telegram_runtime_lease(p_owner uuid,p_offset bigint default null) returns jsonb
language plpgsql set search_path=pg_catalog as $$
declare r public.telegram_runtime;
begin
 select * into r from public.telegram_runtime where id='private-bot' for update;
 if p_owner is null or (r.lease_until>clock_timestamp() and r.lease_owner is distinct from p_owner) then raise exception 'Bot already running' using errcode='P0001'; end if;
 if p_offset is not null and (p_offset<r.update_offset or p_offset>9007199254740991) then raise exception 'Invalid offset' using errcode='22023'; end if;
 update public.telegram_runtime set lease_owner=p_owner,lease_until=clock_timestamp()+interval '90 seconds',update_offset=coalesce(p_offset,update_offset) where id=r.id returning * into r;
 return jsonb_build_object('offset',r.update_offset);
end $$;
revoke all on function public.telegram_runtime_lease(uuid,bigint) from public,anon,authenticated;
grant execute on function public.telegram_runtime_lease(uuid,bigint) to service_role;

create function public.telegram_post_action(p_action text,p_id uuid,p_token uuid,p_channel text,p_message bigint default null) returns jsonb
language plpgsql set search_path=pg_catalog as $$
declare r public.telegram_channel_posts;
begin
 if p_action='claim' then
  select * into r from public.telegram_channel_posts where claim_token=p_token and channel_id=p_channel;
  if found then return to_jsonb(r); end if;
  -- An interrupted send may already have reached Telegram. Never automatically resend it.
  update public.telegram_channel_posts set status='uncertain',updated_at=now() where status='sending' and claimed_at<now()-interval '5 minutes';
  select * into r from public.telegram_channel_posts where status='pending' order by created_at,id for update skip locked limit 1;
  if not found then return null; end if;
  if p_channel is null or p_token is null then raise exception 'Channel required' using errcode='22023'; end if;
  update public.telegram_channel_posts set status='sending',claim_token=p_token,claimed_at=now(),channel_id=p_channel,attempts=attempts+1,updated_at=now() where id=r.id returning * into r;
 else
  select * into r from public.telegram_channel_posts where id=p_id for update;
  if not found or r.claim_token is distinct from p_token or r.channel_id is distinct from p_channel then raise exception 'Post ownership conflict' using errcode='P0001'; end if;
  if p_action='sent' and r.status='sent' and r.message_id=p_message then return to_jsonb(r); end if;
  if r.status<>'sending' or p_action not in ('sent','failed','uncertain') or (p_action='sent' and (p_message is null or p_message<=0)) then raise exception 'Post state conflict' using errcode='P0001'; end if;
  update public.telegram_channel_posts set status=p_action,message_id=p_message,updated_at=now() where id=r.id returning * into r;
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.telegram_post_action(text,uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.telegram_post_action(text,uuid,uuid,text,bigint) to service_role;
commit;
