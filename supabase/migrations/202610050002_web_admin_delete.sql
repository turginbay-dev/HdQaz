begin;
alter table public.processing_jobs add column admin_cancelled_at timestamptz;
alter table public.processing_jobs add column admin_hidden_at timestamptz;
create function public.admin_delete_unused_content(p_slug text) returns boolean
language plpgsql set search_path=pg_catalog as $$
declare c public.contents;
begin
 select * into c from public.contents where slug=p_slug for update;
 if not found then return false; end if;
 if c.is_published or c.hls_url is not null
 or exists(select 1 from public.episodes where content_id=c.id)
 or exists(select 1 from public.seasons where content_id=c.id)
 or exists(select 1 from public.processing_jobs where content_id=c.id)
 or exists(select 1 from public.telegram_workflows where content_id=c.id or metadata->>'existing_content_id'=c.id::text)
 then raise exception 'Content is in use; unpublish instead' using errcode='P0001'; end if;
 delete from public.contents where id=c.id;
 return true;
end $$;
revoke all on function public.admin_delete_unused_content(text) from public,anon,authenticated;
grant execute on function public.admin_delete_unused_content(text) to service_role;
notify pgrst,'reload schema';
commit;
