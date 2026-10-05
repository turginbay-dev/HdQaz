-- Entity-specific publication only. No catalog data is changed by this migration.
begin;
do $patch$
declare definition text; needle text; replacement text;
begin
 definition:=pg_get_functiondef('public.telegram_catalog_action(bigint,uuid,uuid,timestamptz,text,jsonb)'::regprocedure);
 needle:=$old$if p_action='publish' and not (coalesce(c.hls_url like 'https://%.m3u8',false) or exists(select 1 from public.episodes where content_id=c.id and is_published and hls_url like 'https://%.m3u8')) then raise exception 'Reviewed video required' using errcode='P0001'; end if;$old$;
 replacement:=$new$if p_action='publish' then
   if c.type='series' or (c.type in ('anime','dorama') and c.hls_url is null) then
    if nullif(btrim(c.title),'') is null or nullif(btrim(c.slug),'') is null or c.year is null or c.year<1888 or c.year>extract(year from current_date)+10 or c.status is null then
     raise exception 'Series metadata incomplete' using errcode='P0001';
    end if;
   elsif not coalesce(c.hls_url ~ '^https://[^[:space:]]+\.m3u8$',false) then
    raise exception 'Movie video not Ready' using errcode='P0001';
   end if;
  end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'Catalog publication guard changed; abort'; end if;
 execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.telegram_workflow_action(bigint,uuid,text,uuid,integer,jsonb)'::regprocedure);
 needle:=$old$      -- Never modify an existing title. New titles created by this workflow may become visible.
      if not c.is_published then
       if not exists(select 1 from public.telegram_workflows tw where tw.content_id=c.id and c.slug='tg-'||tw.id::text) then raise exception 'Existing draft title requires web review' using errcode='P0001'; end if;
       update public.contents set is_published=true where id=c.id;
      end if;$old$;
 replacement:=$new$      -- Episode publication never changes root series visibility.$new$;
 if strpos(definition,needle)=0 then raise exception 'Episode publication guard changed; abort'; end if;
 execute replace(definition,needle,replacement);
end $patch$;
commit;
