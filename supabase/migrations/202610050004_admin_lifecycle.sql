begin;
-- Delete only after explicit unpublish. Fence the processing lease before removing relationships.
create function public.admin_delete_content(p_slug text) returns boolean
language plpgsql set search_path=pg_catalog as $$
declare c public.contents;
begin
 select * into c from public.contents where slug=p_slug for update;
 if not found then return false;end if;
 if c.is_published then raise exception 'Unpublish first' using errcode='P0001';end if;
 update public.processing_jobs set status='failed',error_code='internal_error',admin_cancelled_at=clock_timestamp(),
 finished_at=clock_timestamp(),worker_id=null,lease_token=null,lease_expires_at=null,heartbeat_at=null,next_attempt_at=null
 where content_id=c.id and status in ('queued','downloading','processing','uploading');
 delete from public.telegram_channel_posts where workflow_id in (select id from public.telegram_workflows where content_id=c.id or metadata->>'existing_content_id'=c.id::text);
 delete from public.telegram_publications where workflow_id in (select id from public.telegram_workflows where content_id=c.id or metadata->>'existing_content_id'=c.id::text);
 delete from public.telegram_workflows where content_id=c.id or metadata->>'existing_content_id'=c.id::text;
 delete from public.telegram_tmdb_titles where content_id=c.id;
 delete from public.processing_jobs where content_id=c.id;
 delete from public.contents where id=c.id;
 return true;
end $$;
revoke all on function public.admin_delete_content(text) from public,anon,authenticated;
grant execute on function public.admin_delete_content(text) to service_role;

-- Metadata-only pages are coming soon. A root or episode manifest removes that status.
create function public.content_video_status() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if nullif(btrim(new.hls_url),'') is not null or exists(select 1 from public.episodes where content_id=new.id and nullif(btrim(hls_url),'') is not null) then
  if new.status='announced' then new.status:='ongoing';end if;
 else new.status:='announced';end if;
 return new;
end $$;
create trigger content_video_status before insert or update of hls_url,type,status on public.contents
for each row execute function public.content_video_status();
create function public.episode_video_status() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op<>'DELETE' then update public.contents set status=status where id=new.content_id;end if;
 if tg_op='DELETE' or (tg_op='UPDATE' and old.content_id is distinct from new.content_id) then
  update public.contents set status=status where id=old.content_id;
 end if;
 return null;
end $$;
create trigger episode_video_status after insert or update of hls_url,content_id or delete on public.episodes
for each row execute function public.episode_video_status();
-- Backfill only incorrect coming-soon flags; completed titles with video stay completed.
update public.contents c set status=case
 when nullif(btrim(c.hls_url),'') is not null or exists(select 1 from public.episodes e where e.content_id=c.id and nullif(btrim(e.hls_url),'') is not null)
 then case when c.status='announced' then 'ongoing' else c.status end else 'announced' end
where (c.status='announced') is distinct from (nullif(btrim(c.hls_url),'') is null and not exists(select 1 from public.episodes e where e.content_id=c.id and nullif(btrim(e.hls_url),'') is not null));
notify pgrst,'reload schema';
commit;
