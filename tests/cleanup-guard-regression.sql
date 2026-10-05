-- Rollback-only: a completed cleanup must never block another title's queue updates.
begin;
do $$
declare c public.contents; j public.processing_jobs;
begin
 insert into public.contents(title,slug,type,year,status,description,poster_url,banner_url,country,is_published)
 values('Cleanup guard regression','cleanup-guard-rollback-'||gen_random_uuid()::text,'movie',2026,'announced','','','','',false) returning * into c;
 insert into public.processing_jobs(content_id,status,idempotency_key,error_code)
 values(c.id,'failed',gen_random_uuid()::text,'internal_error') returning * into j;
 update public.processing_jobs set status='queued',error_code=null where id=j.id;
 if not exists(select 1 from public.processing_jobs where id=j.id and status='queued') then raise exception 'Unrelated queue update blocked';end if;
 update public.contents set poster_url='https://image.tmdb.org/t/p/w500/regression.jpg' where id=c.id;
end $$;
select status,progress_percent,attempt_count from public.automation_claim_job('worker-1');
rollback;
