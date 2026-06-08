-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0033 · Make check_in / uncheck_in reset-aware on the server                 ║
-- ║                                                                            ║
-- ║ BUG: check_in's p_checkin_date defaulted to `current_date` (server UTC).    ║
-- ║ The browser always passes a reset-aware habit-day (habitTodayISO), but the  ║
-- ║ MCP/AI check_in tool calls without a date — so a 14:00-reset Taipei habit    ║
-- ║ checked in at 09:27 local (01:27 UTC) was recorded under the UTC date        ║
-- ║ (next day), so after 14:00 the "new" day already looked done — it never      ║
-- ║ refreshed. Fix once, server-side: when no date is given, compute the         ║
-- ║ habit-day from the task's reset_time + tz (= date(now-in-tz − reset_time)),  ║
-- ║ matching the client. Callers that DO pass a date are unchanged.             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Habit-day for "now": the calendar date in the task's tz, stepped back one day
-- when the local wall-clock is still before the reset cutoff. tz null → UTC;
-- reset null/00:00 → ordinary calendar day.
create or replace function app.habit_today(p_reset time, p_tz text)
returns date language sql stable set search_path = '' as $$
  select case
    when p_reset is null then (now() at time zone coalesce(p_tz, 'UTC'))::date
    when (now() at time zone coalesce(p_tz, 'UTC'))::time < p_reset
      then ((now() at time zone coalesce(p_tz, 'UTC'))::date - 1)
    else (now() at time zone coalesce(p_tz, 'UTC'))::date
  end
$$;

create or replace function public.check_in(
  p_user_id uuid, p_task_id uuid, p_checkin_date date default null, p_note text default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks; v_date date;
begin
  select * into v_row from public.tasks where id = p_task_id and user_id = v_uid;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  v_date := coalesce(p_checkin_date, app.habit_today(v_row.reset_time, v_row.tz));
  insert into public.task_checkins (user_id, task_id, checkin_date, note)
  values (v_uid, p_task_id, v_date, p_note)
  on conflict (task_id, checkin_date) do nothing;
  perform app.recompute_streak(p_task_id);
  select * into v_row from public.tasks where id = p_task_id;
  return v_row;
end;
$$;

create or replace function public.uncheck_in(
  p_user_id uuid, p_task_id uuid, p_checkin_date date default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks; v_date date;
begin
  select * into v_row from public.tasks where id = p_task_id and user_id = v_uid;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  v_date := coalesce(p_checkin_date, app.habit_today(v_row.reset_time, v_row.tz));
  delete from public.task_checkins
   where task_id = p_task_id and checkin_date = v_date and user_id = v_uid;
  perform app.recompute_streak(p_task_id);
  select * into v_row from public.tasks where id = p_task_id;
  return v_row;
end;
$$;

-- ── Grants (signatures unchanged; re-assert anyway) ───────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.check_in(uuid,uuid,date,text)', 'public.uncheck_in(uuid,uuid,date)']
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
