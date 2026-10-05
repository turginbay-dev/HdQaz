-- Historical rollback verification: the named disposable fixtures were cleaned on 2026-10-05.
-- Recreate isolated fixtures before using this script; never substitute real published titles.
-- Run only against the named existing unpublished fixtures; transaction always rolls back.
begin;
do $test$
declare c public.contents; w public.telegram_workflows; j public.processing_jobs; section_name text; rejected boolean; result jsonb;
begin
 -- Root: zero published episodes; sections never change its series semantics.
 select * into c from public.contents where slug='web-admin-dorama-20261005' for update;
 if not found then raise exception 'Isolated series fixture missing'; end if;
 for section_name in select unnest(array['default','dorama','anime']) loop
  update public.contents set section=section_name,is_published=false where id=c.id returning * into c;
  result:=public.telegram_catalog_action(5609928417,gen_random_uuid(),c.id,c.updated_at,'publish','{}');
  if not (select is_published from public.contents where id=c.id) then raise exception 'Root publish failed'; end if;
 end loop;
 update public.contents set title='' where id=c.id returning * into c;
 rejected:=false;
 begin perform public.telegram_catalog_action(5609928417,gen_random_uuid(),c.id,c.updated_at,'publish','{}');
 exception when sqlstate 'P0001' then if sqlerrm<>'Series metadata incomplete' then raise; end if;rejected:=true;end;
 if not rejected then raise exception 'Missing series metadata accepted';end if;
 -- Movie has no dependency on any child episode. Empty own video rejects.
 select * into c from public.contents where id='d81e62e1-4df2-45c5-b2b6-862bb62fdfc1' for update;
 for section_name in select unnest(array['default','dorama','anime']) loop
  update public.contents set section=section_name,is_published=false,hls_url=null where id=c.id returning * into c;
  rejected:=false;
  begin perform public.telegram_catalog_action(5609928417,gen_random_uuid(),c.id,c.updated_at,'publish','{}');
  exception when sqlstate 'P0001' then if sqlerrm<>'Movie video not Ready' then raise;end if;rejected:=true;end;
  if not rejected then raise exception 'Movie with no video accepted';end if;
  update public.contents set hls_url=(select output_manifest_url from public.processing_jobs where content_id=c.id and episode_id is null and status='ready' limit 1) where id=c.id returning * into c;
  perform public.telegram_catalog_action(5609928417,gen_random_uuid(),c.id,c.updated_at,'publish','{}');
  if not (select is_published from public.contents where id=c.id) then raise exception 'Movie publish failed';end if;
 end loop;
 -- Real Ready isolated episode: failed blocked; own Ready output publishes only the episode.
 select * into w from public.telegram_workflows where id='d0e7396c-0ae3-4816-a296-b99a11f999e2' for update;
 select * into j from public.processing_jobs where id=w.job_id for update;
 if w.state<>'submitted' or j.status<>'ready' then raise exception 'Isolated Ready episode fixture changed'; end if;
 update public.contents set is_published=false where id=w.content_id;
 update public.processing_jobs set status='failed',error_code='internal_error' where id=j.id;
 rejected:=false;
 begin perform public.telegram_workflow_action(w.actor_id,gen_random_uuid(),'publish',w.id,w.revision,jsonb_build_object('manifest_url',j.output_manifest_url));
 exception when sqlstate 'P0001' then if sqlerrm<>'Ready review required' then raise;end if;rejected:=true;end;
 if not rejected then raise exception 'Episode not Ready accepted';end if;
 update public.processing_jobs set status='ready',error_code=null where id=j.id;
 perform public.telegram_workflow_action(w.actor_id,gen_random_uuid(),'publish',w.id,w.revision,jsonb_build_object('manifest_url',j.output_manifest_url));
 if not (select is_published from public.episodes where id=w.episode_id) then raise exception 'Ready episode publish failed';end if;
 if (select is_published from public.contents where id=w.content_id) then raise exception 'Episode toggled root';end if;
 if has_function_privilege('anon','public.telegram_catalog_action(bigint,uuid,uuid,timestamptz,text,jsonb)','EXECUTE') then raise exception 'Private ACL lost';end if;
end $test$;
select 'A-G PASS: root metadata, movie own output, episode own Ready; all test changes ROLLED BACK' as result;
rollback;
