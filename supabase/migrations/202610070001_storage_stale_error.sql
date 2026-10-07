-- PostgreSQL 17+: extend controlled diagnostics, preserving the generated column.
-- No records, media, permissions, triggers or publication state are deleted.
begin;
set local lock_timeout='5s';
do $$ begin
 if current_setting('server_version_num')::integer < 170000 then
  raise exception 'PostgreSQL 17 required; migration made no changes';
 end if;
end $$;
alter table public.processing_jobs drop constraint processing_jobs_error_code_check;
alter table public.processing_jobs add constraint processing_jobs_error_code_check
 check(error_code in ('download_failed','invalid_media','processing_failed','upload_failed','lease_expired','internal_error','STALE_JOB_CLEANUP'));
alter table public.processing_jobs alter column error_message set expression as (case error_code
 when 'download_failed' then 'Source download failed.'
 when 'invalid_media' then 'Source media is invalid.'
 when 'processing_failed' then 'Video processing failed.'
 when 'upload_failed' then 'Output upload failed.'
 when 'lease_expired' then 'Worker lease expired.'
 when 'internal_error' then 'Processing could not be completed.'
 when 'STALE_JOB_CLEANUP' then 'Worker job made no progress and was automatically cleaned'
 else null end);
notify pgrst,'reload schema';
commit;
