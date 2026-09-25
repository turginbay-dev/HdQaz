-- Run ONLY in a disposable/staging database after migrations; all fixtures roll back.
begin;
do $$
declare c uuid; other_c uuid; movie uuid; s1 uuid; s2 uuid; e uuid; j uuid;
begin
  insert into public.contents(title,slug,type,year) values ('test','phase1-test-'||gen_random_uuid(),'series',2026) returning id into c;
  insert into public.contents(title,slug,type,year) values ('other','phase1-test-'||gen_random_uuid(),'series',2026) returning id into other_c;
  insert into public.contents(title,slug,type,year) values ('movie','phase1-test-'||gen_random_uuid(),'movie',2026) returning id into movie;
  insert into public.seasons(content_id,season_number) values (c,1) returning id into s1;
  insert into public.seasons(content_id,season_number) values (c,2) returning id into s2;
  insert into public.episodes(content_id,season_id,episode_number,slug) values (c,s1,1,'legacy-url') returning id into e;
  insert into public.episodes(content_id,season_id,episode_number,slug) values (c,s2,1,'s2-e1');
  if (select is_published from public.episodes where id=e) then raise exception 'Draft default failed'; end if;
  begin
    update public.episodes set is_published=true where id=e;
    raise exception 'Missing published HLS was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.episodes(content_id,season_id,episode_number,slug) values (other_c,s1,2,'wrong-parent');
    raise exception 'Cross-content season was accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.episodes(content_id,season_id,episode_number,slug) values (c,s1,1,'duplicate-number');
    raise exception 'Duplicate season episode was accepted';
  exception when unique_violation then null; end;
  update public.episodes set season_id=null where id=e;
  if (select slug from public.episodes where id=e) <> 'legacy-url' then raise exception 'URL changed'; end if;
  insert into public.processing_jobs(content_id,idempotency_key) values(movie,gen_random_uuid()::text);
  insert into public.processing_jobs(content_id,episode_id,idempotency_key) values(c,e,gen_random_uuid()::text) returning id into j;
  begin
    insert into public.processing_jobs(content_id,episode_id,idempotency_key) values(other_c,e,gen_random_uuid()::text);
    raise exception 'Cross-content episode job was accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.processing_jobs(content_id,idempotency_key) values(c,gen_random_uuid()::text);
    raise exception 'Series accepted as movie job';
  exception when check_violation then null; end;
  begin
    update public.contents set type='movie' where id=c;
    raise exception 'Target type mutation was accepted';
  exception when check_violation then null; end;
  begin
    update public.processing_jobs set status='ready' where id=j;
    raise exception 'Ready without output was accepted';
  exception when check_violation then null; end;
  begin
    update public.processing_jobs set progress_percent=101 where id=j;
    raise exception 'Invalid progress was accepted';
  exception when check_violation then null; end;
  update public.processing_jobs set status='failed',error_code='download_failed' where id=j;
  if (select error_message from public.processing_jobs where id=j) <> 'Source download failed.' then raise exception 'Safe error failed'; end if;
  if has_table_privilege('anon','public.processing_jobs','SELECT') or has_table_privilege('authenticated','public.processing_jobs','SELECT') then
    raise exception 'Queue is publicly accessible';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.processing_jobs'::regclass) then raise exception 'Queue RLS disabled'; end if;
end $$;
rollback;
