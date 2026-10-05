-- Additive admin extension. Existing titles, URLs and publication flags are untouched.
begin;
alter table public.contents add column if not exists section text check(section in ('default','anime','dorama'));
-- Patch only classification and manual-series publication; fail on schema drift.
do $patch$
declare definition text; needle text; replacement text;
begin
 definition:=pg_get_functiondef('public.telegram_workflow_action(bigint,uuid,text,uuid,integer,jsonb)'::regprocedure);
 needle:=$old$insert into public.telegram_workflows(actor_id,kind) values(p_actor,p_data->>'kind')$old$; replacement:=$new$insert into public.telegram_workflows(actor_id,kind,metadata) values(p_actor,p_data->>'kind',jsonb_build_object('section',coalesce(p_data->>'section','default')))$new$;
 if strpos(definition,needle)=0 then raise exception 'Unexpected workflow definition'; end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$duration_minutes,dubber_id,is_premium,is_published)$old$; replacement:=$new$duration_minutes,dubber_id,is_premium,is_published,section)$new$;
 if strpos(definition,needle)=0 then raise exception 'Unexpected workflow definition'; end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$coalesce((w.metadata->>'is_premium')::boolean,false),false) returning$old$; replacement:=$new$coalesce((w.metadata->>'is_premium')::boolean,false),false,coalesce(w.metadata->>'section','default')) returning$new$;
 if strpos(definition,needle)=0 then raise exception 'Unexpected workflow definition'; end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$if not exists(select 1 from public.telegram_tmdb_titles where content_id=c.id) then$old$; replacement:=$new$if not exists(select 1 from public.telegram_workflows tw where tw.content_id=c.id and c.slug='tg-'||tw.id::text) then$new$;
 if strpos(definition,needle)=0 then raise exception 'Unexpected workflow definition'; end if;
 definition:=replace(definition,needle,replacement);
 execute definition;
end $patch$;

-- Atomic, version-checked patches; no full-row replacement or HLS writes.
create function public.telegram_catalog_action(p_actor bigint,p_request uuid,p_id uuid,p_expected timestamptz,p_action text,p_data jsonb)
returns jsonb language plpgsql set search_path=pg_catalog as $$
declare c public.contents; receipt public.telegram_receipts; fingerprint text; result jsonb; genre text; gid uuid;
begin
 if p_actor is null or p_actor<=0 or p_request is null or p_expected is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid input' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(p_actor);
 fingerprint:=md5(jsonb_build_array('catalog',p_id,p_expected,p_action,p_data)::text);
 select * into receipt from public.telegram_receipts where actor_id=p_actor and request_id=p_request;
 if found then
  if receipt.request_hash<>fingerprint then raise exception 'Request conflict' using errcode='23505'; end if;
  return receipt.response;
 end if;
 select * into c from public.contents where id=p_id for update;
 if not found or c.updated_at is distinct from p_expected then raise exception 'Content changed; refresh' using errcode='P0001'; end if;
 if p_action='edit' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('title','description','year','country','duration_minutes','is_premium','dubber_id','poster_url','banner_url','genres')) then raise exception 'Invalid field' using errcode='22023'; end if;
  if p_data ? 'genres' then
   for genre in select jsonb_array_elements_text(p_data->'genres') loop
    if not exists(select 1 from public.genres where lower(name)=lower(genre)) then raise exception 'Unknown genre' using errcode='22023'; end if;
   end loop;
   delete from public.content_genres where content_id=c.id;
   for genre in select jsonb_array_elements_text(p_data->'genres') loop
    insert into public.content_genres(content_id,genre_id) select c.id,id from public.genres where lower(name)=lower(genre) on conflict do nothing;
   end loop;
  end if;
  update public.contents set
   title=case when p_data ? 'title' then p_data->>'title' else title end,
   description=case when p_data ? 'description' then p_data->>'description' else description end,
   year=case when p_data ? 'year' then (p_data->>'year')::integer else year end,
   country=case when p_data ? 'country' then p_data->>'country' else country end,
   duration_minutes=case when p_data ? 'duration_minutes' then (p_data->>'duration_minutes')::integer else duration_minutes end,
   is_premium=case when p_data ? 'is_premium' then (p_data->>'is_premium')::boolean else is_premium end,
   dubber_id=case when p_data ? 'dubber_id' then (p_data->>'dubber_id')::uuid else dubber_id end,
   poster_url=case when p_data ? 'poster_url' then p_data->>'poster_url' else poster_url end,
   banner_url=case when p_data ? 'banner_url' then p_data->>'banner_url' else banner_url end,
   updated_at=clock_timestamp()
  where id=c.id returning * into c;
 elsif p_action in ('publish','unpublish') then
  if p_data<>'{}'::jsonb then raise exception 'Invalid input' using errcode='22023'; end if;
  if p_action='publish' and not (coalesce(c.hls_url like 'https://%.m3u8',false) or exists(select 1 from public.episodes where content_id=c.id and is_published and hls_url like 'https://%.m3u8')) then raise exception 'Reviewed video required' using errcode='P0001'; end if;
  update public.contents set is_published=(p_action='publish'),updated_at=clock_timestamp() where id=c.id returning * into c;
 else raise exception 'Invalid action' using errcode='22023'; end if;
 result:=jsonb_build_object('id',c.id,'updated_at',c.updated_at);
 insert into public.telegram_receipts(actor_id,request_id,request_hash,response) values(p_actor,p_request,fingerprint,result);
 return result;
end $$;
revoke all on function public.telegram_catalog_action(bigint,uuid,uuid,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.telegram_catalog_action(bigint,uuid,uuid,timestamptz,text,jsonb) to service_role;
commit;
