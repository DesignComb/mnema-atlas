-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0036 · Widget/reminder review fixes                                         ║
-- ║                                                                            ║
-- ║ 1. toggle_check_in — the habit widget must NOT decide check vs uncheck from ║
-- ║    a stale client snapshot (after a day/reset rollover the snapshot's       ║
-- ║    "checked" disagrees with the server's reset-aware today, so a tap acted  ║
-- ║    on the wrong day). This flips based purely on whether a row exists for   ║
-- ║    app.habit_today(now) and returns the NEW state, so the widget never has  ║
-- ║    to know the prior state.                                                ║
-- ║ 2. due_reminders_for_cron — only fire reminders for tasks still 'todo' (a   ║
-- ║    completed/cancelled task's pending reminder no longer pushes).          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Reset-aware toggle: returns true if now checked-in, false if now cleared.
create or replace function public.toggle_check_in(p_user_id uuid, p_task_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks; v_date date; v_exists boolean;
begin
  select * into v_row from public.tasks where id = p_task_id and user_id = v_uid;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  v_date := app.habit_today(v_row.reset_time, v_row.tz);
  select exists(
    select 1 from public.task_checkins where task_id = p_task_id and checkin_date = v_date
  ) into v_exists;
  if v_exists then
    delete from public.task_checkins where task_id = p_task_id and checkin_date = v_date and user_id = v_uid;
    perform app.recompute_streak(p_task_id);
    return false;
  else
    insert into public.task_checkins (user_id, task_id, checkin_date) values (v_uid, p_task_id, v_date)
    on conflict (task_id, checkin_date) do nothing;
    perform app.recompute_streak(p_task_id);
    return true;
  end if;
end;
$$;

-- Don't push reminders for tasks that are already done/cancelled.
create or replace function public.due_reminders_for_cron()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'reminder_id', r.id, 'task_id', t.id, 'title', t.title,
      'body', coalesce(t.description, ''),
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s where s.user_id = r.user_id), '[]'::jsonb)
    ))
    from public.task_reminders r join public.tasks t on t.id = r.task_id
    where r.status = 'pending' and r.remind_at <= now() and t.status = 'todo'
  ), '[]'::jsonb);
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.toggle_check_in(uuid, uuid) from public;
grant execute on function public.toggle_check_in(uuid, uuid) to authenticated, service_role;
revoke all on function public.due_reminders_for_cron() from public, anon, authenticated;
grant execute on function public.due_reminders_for_cron() to service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
