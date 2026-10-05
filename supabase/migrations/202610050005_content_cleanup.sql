begin;
create table public.content_cleanup_tasks (
 id uuid primary key default gen_random_uuid(),content_id uuid not null unique,
 snapshot jsonb not null,status text not null default 'queued' check(status in ('queued','running','partial','done')),
 results jsonb not null default '[]',lease_token uuid,lease_expires_at timestamptz,
 not_before timestamptz not null default clock_timestamp()+interval '90 seconds',
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
alter table public.content_cleanup_tasks enable row level security;
revoke all on public.content_cleanup_tasks from public,anon,authenticated;
grant all on public.content_cleanup_tasks to service_role;
create function public.content_cleanup_begin(p_id uuid,p_expected timestamptz,p_title text) returns jsonb
language plpgsql set search_path=pg_catalog as $$
declare c public.contents;t public.content_cleanup_tasks;s jsonb;
begin
 perform pg_advisory_xact_lock(771050005);
 select * into t from public.content_cleanup_tasks where content_id=p_id for update;
 if found then return to_jsonb(t);end if;
 select * into c from public.contents where id=p_id for update;
 if not found or c.updated_at is distinct from p_expected or c.title is distinct from p_title or c.is_published then raise exception 'Refresh; unpublish and confirm title first' using errcode='P0001';end if;
 s:=jsonb_build_object('content',jsonb_build_object('id',c.id,'slug',c.slug,'title',c.title,'hls_url',c.hls_url,'poster_url',c.poster_url,'banner_url',c.banner_url),
 'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'output_manifest_url',output_manifest_url)) from public.processing_jobs where content_id=c.id),'[]'::jsonb),
 'episodes',coalesce((select jsonb_agg(jsonb_build_object('hls_url',hls_url,'thumbnail_url',thumbnail_url)) from public.episodes where content_id=c.id),'[]'::jsonb),
 'flows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'source_ref',source_ref,'metadata',jsonb_build_object('poster_url',metadata->>'poster_url','banner_url',metadata->>'banner_url'))) from public.telegram_workflows where content_id=c.id or metadata->>'existing_content_id'=c.id::text),'[]'::jsonb),
 'references',coalesce((select jsonb_agg(r) from (
 select id::text owner,hls_url url,null::uuid source_ref from public.contents where id<>c.id
 union all select id::text,poster_url,null from public.contents where id<>c.id
 union all select id::text,banner_url,null from public.contents where id<>c.id
 union all select content_id::text,hls_url,null from public.episodes where content_id<>c.id
 union all select content_id::text,thumbnail_url,null from public.episodes where content_id<>c.id
 union all select content_id::text,output_manifest_url,null from public.processing_jobs where content_id<>c.id
 union all select coalesce(content_id::text,metadata->>'existing_content_id'),metadata->>'poster_url',source_ref from public.telegram_workflows where coalesce(content_id::text,metadata->>'existing_content_id','')<>c.id::text
 union all select coalesce(content_id::text,metadata->>'existing_content_id'),metadata->>'banner_url',source_ref from public.telegram_workflows where coalesce(content_id::text,metadata->>'existing_content_id','')<>c.id::text
 ) r),'[]'::jsonb));
 update public.processing_jobs set status='failed',error_code='internal_error',admin_cancelled_at=clock_timestamp(),admin_hidden_at=clock_timestamp(),finished_at=clock_timestamp(),
 worker_id=null,lease_token=null,lease_expires_at=null,heartbeat_at=null,next_attempt_at=null
 where content_id=c.id and status in ('queued','downloading','processing','uploading');
 insert into public.content_cleanup_tasks(content_id,snapshot) values(c.id,s) returning * into t;
 return to_jsonb(t);
end $$;
create function public.content_cleanup_claim() returns jsonb language plpgsql set search_path=pg_catalog as $$
declare t public.content_cleanup_tasks;
begin
 select * into t from public.content_cleanup_tasks where status in ('queued','running') and not_before<=clock_timestamp() and (lease_expires_at is null or lease_expires_at<clock_timestamp()) order by created_at for update skip locked limit 1;
 if not found then return null;end if;
 update public.content_cleanup_tasks set status='running',lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '10 minutes',updated_at=clock_timestamp() where id=t.id returning * into t;
 return to_jsonb(t);
end $$;
create function public.content_cleanup_report(p_id uuid,p_token uuid,p_results jsonb,p_done boolean) returns jsonb language plpgsql set search_path=pg_catalog as $$
declare t public.content_cleanup_tasks;
begin
 select * into t from public.content_cleanup_tasks where id=p_id for update;
 if not found or t.lease_token is distinct from p_token or t.lease_expires_at<clock_timestamp() then raise exception 'Cleanup lease lost' using errcode='P0001';end if;
 if p_done then
  perform 1 from public.contents where id=t.content_id for update;
  if found then perform public.admin_delete_content((select slug from public.contents where id=t.content_id));end if;
 end if;
 update public.content_cleanup_tasks set status=case when p_done then 'done' else 'partial' end,results=p_results,lease_token=null,lease_expires_at=null,updated_at=clock_timestamp() where id=t.id returning * into t;
 return to_jsonb(t);
end $$;
-- Protect planned namespaces against new references during cleanup and after deletion.
create function public.content_cleanup_reference_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
declare t public.content_cleanup_tasks;owner uuid;values_to_check text[];v text;j jsonb;f jsonb;prefix text;ref uuid;old_values text[];escape text;
begin
 perform pg_advisory_xact_lock(771050005);
 if tg_table_name='contents' then owner:=new.id;values_to_check:=array[new.hls_url,new.poster_url,new.banner_url];
 elsif tg_table_name='episodes' then owner:=new.content_id;values_to_check:=array[new.hls_url,new.thumbnail_url];
 elsif tg_table_name='processing_jobs' then owner:=new.content_id;values_to_check:=array[new.output_manifest_url];
 else owner:=coalesce(new.content_id,(new.metadata->>'existing_content_id')::uuid);values_to_check:=array[new.metadata->>'poster_url',new.metadata->>'banner_url'];ref:=new.source_ref;end if;
 if tg_op='UPDATE' then
  if tg_table_name='contents' then old_values:=array[old.hls_url,old.poster_url,old.banner_url];
  elsif tg_table_name='episodes' then old_values:=array[old.hls_url,old.thumbnail_url];
  elsif tg_table_name='processing_jobs' then old_values:=array[old.output_manifest_url];
  else old_values:=array[old.metadata->>'poster_url',old.metadata->>'banner_url'];if ref is not distinct from old.source_ref then ref:=null;end if;end if;
  values_to_check:=array(select case when value is not distinct from old_values[n] then null else value end from unnest(values_to_check) with ordinality a(value,n));
 end if;
 for t in select * from public.content_cleanup_tasks loop
  if owner=t.content_id then raise exception 'Content cleanup in progress' using errcode='P0001';end if;
  foreach v in array values_to_check loop
   if v is null then continue;end if;
   for escape in select (regexp_matches(v,'%([0-9a-fA-F]{2})','g'))[1] loop
    if lower(escape)='00' then raise exception 'Invalid asset reference' using errcode='P0001';end if;
    v:=replace(v,'%'||escape,chr(('x'||escape)::bit(8)::integer));
   end loop;
   for j in select * from jsonb_array_elements(t.snapshot->'jobs') loop
    if strpos(v,'/candidates/'||(j->>'id')||'-')>0 then raise exception 'Asset cleanup in progress' using errcode='P0001';end if;
   end loop;
   foreach prefix in array array['/movies/','/series/','/contents/','/final/','/final/movies/','/final/series/','/posters/','/banners/'] loop
    if strpos(v,prefix||t.content_id::text||'/')>0 then raise exception 'Asset cleanup in progress' using errcode='P0001';end if;
   end loop;
   for f in select * from jsonb_array_elements(t.snapshot->'flows') loop
    if strpos(v,'/drafts/'||(f->>'id')||'/')>0 then raise exception 'Asset cleanup in progress' using errcode='P0001';end if;
   end loop;
  end loop;
  if ref is not null and exists(select 1 from jsonb_array_elements(t.snapshot->'flows') f where f->>'source_ref'=ref::text) then raise exception 'Source cleanup in progress' using errcode='P0001';end if;
 end loop;
 return new;
end $$;
create trigger cleanup_content_reference before insert or update of hls_url,poster_url,banner_url,is_published on public.contents for each row execute function public.content_cleanup_reference_guard();
create trigger cleanup_episode_reference before insert or update of hls_url,thumbnail_url on public.episodes for each row execute function public.content_cleanup_reference_guard();
create trigger cleanup_job_reference before insert or update of status,output_manifest_url on public.processing_jobs for each row execute function public.content_cleanup_reference_guard();
create trigger cleanup_flow_reference before insert or update of content_id,metadata,source_ref on public.telegram_workflows for each row execute function public.content_cleanup_reference_guard();
do $$ declare f text;begin
 foreach f in array array['content_cleanup_begin(uuid,timestamptz,text)','content_cleanup_claim()','content_cleanup_report(uuid,uuid,jsonb,boolean)'] loop
 execute 'revoke all on function public.'||f||' from public,anon,authenticated';execute 'grant execute on function public.'||f||' to service_role';end loop;
end $$;
notify pgrst,'reload schema';
commit;
