-- Disposable database only; every fixture rolls back.
begin;
do $$
declare c public.contents; w jsonb; j public.processing_jobs; w2 jsonb;
begin
 insert into contents(title,slug,type,year,description) values('Web draft','web-draft','movie',2026,'Keep metadata') returning * into c;
 w:=telegram_workflow_action(123,gen_random_uuid(),'new',null,null,'{"kind":"movie"}');
 w:=telegram_workflow_action(123,gen_random_uuid(),'edit',(w->>'id')::uuid,(w->>'revision')::int,jsonb_build_object('existing_content_id',c.id,'title',c.title,'year',c.year));
 w:=telegram_workflow_action(123,gen_random_uuid(),'prepare',(w->>'id')::uuid,(w->>'revision')::int,jsonb_build_object('source_ref',gen_random_uuid()));
 if (w->>'content_id')::uuid<>c.id or (select count(*) from contents where slug='web-draft')<>1 or (select description from contents where id=c.id)<>'Keep metadata' then raise exception 'Existing draft not preserved'; end if;
 w:=telegram_workflow_action(123,gen_random_uuid(),'activate',(w->>'id')::uuid,(w->>'revision')::int,'{}');
 select * into j from automation_claim_job('draft_test');
 perform automation_update_job(j.id,'draft_test',j.lease_token,'heartbeat','processing',20,null,'{}',null);
 perform automation_update_job(j.id,'draft_test',j.lease_token,'heartbeat','uploading',90,null,'{}',null);
 perform automation_update_job(j.id,'draft_test',j.lease_token,'complete',null,null,'https://cdn.hdqaz.online/candidates/draft-test/master.m3u8','{}',null);
 if (select is_published from contents where id=c.id) or (select hls_url from contents where id=c.id) is not null then raise exception 'Ready published'; end if;
 w:=telegram_workflow_action(123,gen_random_uuid(),'publish',(w->>'id')::uuid,(w->>'revision')::int,'{"manifest_url":"https://cdn.hdqaz.online/candidates/draft-test/master.m3u8"}');
 if not (select is_published from contents where id=c.id) then raise exception 'Explicit publish failed'; end if;
 w2:=telegram_workflow_action(123,gen_random_uuid(),'new',null,null,'{"kind":"movie"}');
 w2:=telegram_workflow_action(123,gen_random_uuid(),'edit',(w2->>'id')::uuid,(w2->>'revision')::int,jsonb_build_object('existing_content_id',c.id,'title',c.title,'year',c.year));
 begin
  perform telegram_workflow_action(123,gen_random_uuid(),'prepare',(w2->>'id')::uuid,(w2->>'revision')::int,jsonb_build_object('source_ref',gen_random_uuid()));raise exception 'Published accepted';
 exception when check_violation then null;end;
 if has_function_privilege('anon','telegram_workflow_action(bigint,uuid,text,uuid,integer,jsonb)','execute') then raise exception 'RPC exposed'; end if;
end $$;
rollback;
