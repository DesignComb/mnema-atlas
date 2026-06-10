-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0039 · Habit reminders are opt-in (review fix)                              ║
-- ║                                                                            ║
-- ║ Every other push surface (review_prefs 0031, digest_prefs 0034) is opt-in  ║
-- ║ default-OFF. Habit deadline nudges (0038) shipped without a gate, so they   ║
-- ║ would push every user who has habits + push. Add a flag on digest_prefs +  ║
-- ║ gate the finder on it.                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.digest_prefs add column if not exists habit_reminders boolean not null default false;

create or replace function public.set_habit_reminder_pref(p_user_id uuid, p_enabled boolean)
returns public.digest_prefs language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.digest_prefs;
begin
  insert into public.digest_prefs (user_id, habit_reminders) values (v_uid, coalesce(p_enabled, false))
  on conflict (user_id) do update set habit_reminders = coalesce(p_enabled, public.digest_prefs.habit_reminders)
  returning * into v_row;
  return v_row;
end;
$$;

-- Gate the finder on the opt-in flag.
create or replace function public.due_habit_reminders_for_cron()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'task_id', t.id,
      'title', t.title,
      'streak', t.current_streak,
      'user_id', t.user_id,
      'habit_date', app.habit_today(t.reset_time, t.tz),
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s where s.user_id = t.user_id), '[]'::jsonb),
      'fcm_tokens', coalesce((
        select jsonb_agg(f.token) from public.fcm_tokens f where f.user_id = t.user_id), '[]'::jsonb)
    ))
    from public.tasks t
    where t.kind = 'habit' and t.status = 'todo'
      and exists (select 1 from public.digest_prefs dp where dp.user_id = t.user_id and dp.habit_reminders)
      and not exists (
        select 1 from public.task_checkins c
        where c.task_id = t.id and c.checkin_date = app.habit_today(t.reset_time, t.tz))
      and not exists (
        select 1 from public.habit_nudges n
        where n.task_id = t.id and n.nudge_date = app.habit_today(t.reset_time, t.tz))
      and app.next_reset_at(t.reset_time, t.tz) > now()
      and app.next_reset_at(t.reset_time, t.tz) <= now() + interval '3 hours'
  ), '[]'::jsonb);
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.set_habit_reminder_pref(uuid, boolean) from public;
grant execute on function public.set_habit_reminder_pref(uuid, boolean) to authenticated, service_role;
revoke all on function public.due_habit_reminders_for_cron() from public, anon, authenticated;
grant execute on function public.due_habit_reminders_for_cron() to service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
