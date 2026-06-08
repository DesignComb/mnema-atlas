-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0032 · Calendar check-in / completion history                              ║
-- ║                                                                            ║
-- ║ task_checkins already records BOTH habit check-ins AND task completions    ║
-- ║ (complete_task inserts a row at p_completed_at::date — see 0015). This RPC  ║
-- ║ reads them back over a date range so the calendar can show, at a glance,   ║
-- ║ what was done each day — and the day-detail sheet can backfill a forgotten  ║
-- ║ entry (which, for after-completion recurrence, recomputes the next due from ║
-- ║ that date, all already handled server-side in complete_task).              ║
-- ║ Owner-only, read-only, RLS-equivalent via resolve_uid.                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create or replace function public.list_check_ins(p_user_id uuid, p_from date, p_to date)
returns table (task_id uuid, checkin_date date, title text, kind text)
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select c.task_id, c.checkin_date, t.title, t.kind
    from public.task_checkins c
    join public.tasks t on t.id = c.task_id
    where c.user_id = v_uid
      and c.checkin_date >= p_from
      and c.checkin_date <= p_to
    order by c.checkin_date, t.title;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.list_check_ins(uuid, date, date) from public;
grant execute on function public.list_check_ins(uuid, date, date) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
