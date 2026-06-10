-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0038 · Habit deadline reminders (打卡快截止)                                  ║
-- ║                                                                            ║
-- ║ Duolingo-style: if a habit isn't checked in and its current habit-day is    ║
-- ║ about to roll over (within 3h of the next reset boundary), push a nudge      ║
-- ║ ("別讓 N 天斷掉!"). app.next_reset_at computes that boundary reset-aware (per  ║
-- ║ habit reset_time + tz, matching minutesUntilReset on the client). One nudge  ║
-- ║ per habit per habit-day via the habit_nudges ledger. Rides the per-minute    ║
-- ║ reminder cron.                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- The absolute moment the current habit-day ends (next reset). null/00:00 reset
-- → next local midnight; else today's reset if still ahead, otherwise tomorrow's.
create or replace function app.next_reset_at(p_reset time, p_tz text)
returns timestamptz language sql stable set search_path = '' as $$
  select case
    when coalesce(p_reset, '00:00'::time) = '00:00'::time then
      (((now() at time zone coalesce(p_tz, 'UTC'))::date + 1) + '00:00'::time) at time zone coalesce(p_tz, 'UTC')
    when (now() at time zone coalesce(p_tz, 'UTC'))::time < p_reset then
      (((now() at time zone coalesce(p_tz, 'UTC'))::date) + p_reset) at time zone coalesce(p_tz, 'UTC')
    else
      (((now() at time zone coalesce(p_tz, 'UTC'))::date + 1) + p_reset) at time zone coalesce(p_tz, 'UTC')
  end
$$;

create table if not exists public.habit_nudges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  nudge_date date not null,
  created_at timestamptz not null default now(),
  constraint habit_nudges_task_date_unique unique (task_id, nudge_date)
);
create index if not exists habit_nudges_idx on public.habit_nudges (user_id, nudge_date desc);

drop trigger if exists habit_nudges_quota on public.habit_nudges;
create trigger habit_nudges_quota before insert on public.habit_nudges
  for each row execute function app.enforce_row_quota('100000', 'user_id');

alter table public.habit_nudges enable row level security;
drop policy if exists habit_nudges_select on public.habit_nudges;
create policy habit_nudges_select on public.habit_nudges
  for select to authenticated using ((select auth.uid()) = user_id);

-- Cron finder (service_role): habits not checked in, within 3h of their reset,
-- not yet nudged for this habit-day, with the user's push targets.
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

create or replace function public.mark_habit_nudged(p_user_id uuid, p_task_id uuid, p_habit_date date)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  insert into public.habit_nudges (user_id, task_id, nudge_date) values (v_uid, p_task_id, p_habit_date)
  on conflict (task_id, nudge_date) do nothing;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.due_habit_reminders_for_cron() from public, anon, authenticated;
grant execute on function public.due_habit_reminders_for_cron() to service_role;
revoke all on function public.mark_habit_nudged(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.mark_habit_nudged(uuid, uuid, date) to service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
