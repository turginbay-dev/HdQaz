-- Run only in a disposable PostgreSQL test database.
begin;
do $$
declare c public.contents; w jsonb; w2 jsonb; key uuid:=gen_random_uuid(); result jsonb; seriesid uuid; before_title text; j public.processing_jobs;
begin
 insert into contents(title,slug,type,year,hls_url,is_published) values('Existing','existing','movie',2026,'https://cdn.hdqaz.online/old/master.m3u8',true) returning * into c;
 result:=telegram_catalog_action(123,key,c.id,c.updated_at,'edit','{"title":"Changed","genres":["Драма"]}');
 if (select hls_url from contents where id=c.id)<>c.hls_url or not (select is_published from contents where id=c.id) then raise exception 'Edit changed video'; end if;
 if telegram_catalog_action(123,key,c.id,c.updated_at,'edit','{"title":"Changed","genres":["Драма"]}')<>result then raise exception 'Receipt failed'; end if;
 begin
  perform telegram_catalog_action(123,gen_random_uuid(),c.id,c.updated_at-interval '1 second','edit','{"title":"Stale"}');raise exception 'Stale accepted';
 exception when sqlstate 'P0001' then if SQLERRM='Stale accepted' then raise; end if;end;
 select * into c from contents where id=c.id;
 begin perform telegram_catalog_action(123,gen_random_uuid(),c.id,c.updated_at,'edit','{"hls_url":"https://evil"}');raise exception 'Video edit allowed';exception when sqlstate '22023' then null;end;
 perform telegram_catalog_action(123,gen_random_uuid(),c.id,c.updated_at,'unpublish','{}');
 select * into c from contents where id=c.id;
 if c.is_published then raise exception 'Unpublish failed'; end if;
 perform telegram_catalog_action(123,gen_random_uuid(),c.id,c.updated_at,'publish','{}');
 w:=telegram_workflow_action(123,gen_random_uuid(),'new',null,null,'{"kind":"series","section":"anime"}');
 w:=telegram_workflow_action(123,gen_random_uuid(),'edit',(w->>'id')::uuid,(w->>'revision')::int,'{"title":"Manual Series","year":2026,"section":"anime","season_number":1,"episode_number":1}');
 w:=telegram_workflow_action(123,gen_random_uuid(),'prepare',(w->>'id')::uuid,(w->>'revision')::int,jsonb_build_object('source_ref',gen_random_uuid()));
 seriesid:=(w->>'content_id')::uuid;
 select * into c from contents where id=seriesid;
 if c.type<>'series' or c.section<>'anime' or c.is_published then raise exception 'Classification/Ready broken';end if;
 begin perform telegram_catalog_action(123,gen_random_uuid(),c.id,c.updated_at,'publish','{}');raise exception 'Empty published';exception when sqlstate 'P0001' then if SQLERRM='Empty published' then raise;end if;end;
 w:=telegram_workflow_action(123,gen_random_uuid(),'activate',(w->>'id')::uuid,(w->>'revision')::int,'{}');
 select * into j from automation_claim_job('admin_test');
 perform automation_update_job(j.id,'admin_test',j.lease_token,'heartbeat','processing',20,null,'{}',null);
 perform automation_update_job(j.id,'admin_test',j.lease_token,'heartbeat','uploading',90,null,'{}',null);
 perform automation_update_job(j.id,'admin_test',j.lease_token,'complete',null,null,'https://cdn.hdqaz.online/candidates/test/master.m3u8','{}',null);
 if (select is_published from contents where id=seriesid) then raise exception 'Auto published';end if;
 w:=telegram_workflow_action(123,gen_random_uuid(),'publish',(w->>'id')::uuid,(w->>'revision')::int,'{"manifest_url":"https://cdn.hdqaz.online/candidates/test/master.m3u8"}');
 if not (select is_published from contents where id=seriesid) then raise exception 'Manual series publication failed';end if;
 w2:=telegram_workflow_action(123,gen_random_uuid(),'new',null,null,'{"kind":"series"}');
 w2:=telegram_workflow_action(123,gen_random_uuid(),'edit',(w2->>'id')::uuid,(w2->>'revision')::int,jsonb_build_object('title','Manual Series','year',2026,'existing_content_id',seriesid,'season_number',1,'episode_number',2));
 w2:=telegram_workflow_action(123,gen_random_uuid(),'prepare',(w2->>'id')::uuid,(w2->>'revision')::int,jsonb_build_object('source_ref',gen_random_uuid()));
 if (w2->>'content_id')::uuid<>seriesid or (select count(*) from seasons where content_id=seriesid)<>1 or (select count(*) from episodes where content_id=seriesid)<>2 then raise exception 'Series not reused';end if;
 if (select title from contents where id=seriesid)<>'Manual Series' then raise exception 'Series overwritten';end if;
 if has_function_privilege('anon','telegram_catalog_action(bigint,uuid,uuid,timestamptz,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','telegram_catalog_action(bigint,uuid,uuid,timestamptz,text,jsonb)','EXECUTE') then raise exception 'RPC exposed';end if;
 raise notice 'PASS: atomic edits, stale writes, idempotency, HLS preservation, publish/unpublish, manual series, episode reuse, independent section, default deny';
end $$;
rollback;
