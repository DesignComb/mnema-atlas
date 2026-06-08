-- ════════════════════════════════════════════════════════════════════════════
-- 0030 · Mnema Tempo — a hyperlink on todos.
--
-- Tasks already support reminders (0014) + recurrence; this adds an optional
-- URL so a todo can link out (a ticket, a doc, a product page) — rendered as a
-- clickable link in the task row. Set via a dedicated RPC (passing '' clears it)
-- so we don't have to rewrite the large create_task / update_task signatures.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.tasks add column if not exists url text;
do $$
begin
  alter table public.tasks drop constraint if exists tasks_url_len;
  alter table public.tasks add constraint tasks_url_len check (url is null or char_length(url) <= 2000) not valid;
end;
$$;

create or replace function public.set_task_url(p_user_id uuid, p_task_id uuid, p_url text)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  update public.tasks set url = nullif(p_url, '')
  where id = p_task_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

-- Grants + anon re-hardening.
revoke all on function public.set_task_url(uuid,uuid,text) from public;
grant execute on function public.set_task_url(uuid,uuid,text) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
