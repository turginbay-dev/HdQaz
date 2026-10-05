-- Fix PL/pgSQL variable/table alias ambiguity; keep ownership fences unchanged.
begin;
create or replace function public.content_cleanup_reference_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
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
  if ref is not null and exists(select 1 from jsonb_array_elements(t.snapshot->'flows') as source_flow(value) where source_flow.value->>'source_ref'=ref::text) then raise exception 'Source cleanup in progress' using errcode='P0001';end if;
 end loop;
 return new;
end $$;
notify pgrst,'reload schema';
commit;
