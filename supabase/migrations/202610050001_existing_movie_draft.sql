-- Private workflow extension only. No catalog/HLS/publication data is rewritten.
begin;
do $patch$
declare definition text; needle text; replacement text;
begin
 definition:=pg_get_functiondef('public.telegram_workflow_action(bigint,uuid,text,uuid,integer,jsonb)'::regprocedure);
 needle:=$old$if not found or w.kind<>'series' or c.type='movie' then raise exception 'Invalid existing title' using errcode='23514'; end if;$old$;
 replacement:=$new$if not found or (w.kind='movie' and (c.type<>'movie' or c.is_published or c.hls_url is not null)) or (w.kind='series' and (c.type='movie' or c.type='cartoon' or c.hls_url is not null)) then raise exception 'Invalid existing title' using errcode='23514'; end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'Unexpected workflow definition'; end if;
 definition:=replace(definition,needle,replacement);
 -- Existing web-created series still require their separate website root-publication review.
 execute definition;
end $patch$;
commit;
