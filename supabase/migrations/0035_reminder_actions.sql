-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0035 · Actionable reminders — snooze/done buttons + overdue re-nudge        ║
-- ║                                                                            ║
-- ║ Web Push notifications get 延後 (snooze) / 已完成 (done) buttons. The service ║
-- ║ worker has no API key, so it identifies the user by its OWN push           ║
-- ║ subscription endpoint (already a per-user secret in push_subscriptions);   ║
-- ║ the worker resolves it server-side via user_id_for_push_endpoint and then   ║
-- ║ runs complete_task (done) or snooze_reminder (re-arm +N min). A daily       ║
-- ║ rearm_overdue_reminders re-fires reminders for still-incomplete tasks so an  ║
-- ║ overdue item keeps nudging until done or snoozed.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Re-arm one reminder N minutes out (owner-callable; the 延後 button path).
create or replace function public.snooze_reminder(p_user_id uuid, p_reminder_id uuid, p_minutes integer default 60)
returns public.task_reminders language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.task_reminders;
begin
  update public.task_reminders
     set remind_at = now() + make_interval(mins => greatest(1, coalesce(p_minutes, 60))),
         status = 'pending', sent_at = null
   where id = p_reminder_id and user_id = v_uid
   returning * into v_row;
  if not found then raise exception 'reminder not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

-- Resolve the owner of a push subscription endpoint (cron/action only).
create or replace function public.user_id_for_push_endpoint(p_endpoint text)
returns uuid language sql security definer set search_path = '' stable
as $$
  select user_id from public.push_subscriptions where endpoint = p_endpoint limit 1;
$$;

-- Re-fire reminders for tasks still open ~24h after they last fired, so an
-- overdue task keeps nudging until completed or snoozed (cron only).
create or replace function public.rearm_overdue_reminders()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_n integer;
begin
  update public.task_reminders r
     set remind_at = now(), status = 'pending', sent_at = null
    from public.tasks t
   where r.task_id = t.id
     and r.status = 'sent'
     and t.status = 'todo'
     and t.kind <> 'habit'
     and r.sent_at < now() - interval '24 hours';
  get diagnostics v_n = row_count; return v_n;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.snooze_reminder(uuid, uuid, integer) from public;
grant execute on function public.snooze_reminder(uuid, uuid, integer) to authenticated, service_role;
-- Cron/action only:
revoke all on function public.user_id_for_push_endpoint(text) from public, anon, authenticated;
grant execute on function public.user_id_for_push_endpoint(text) to service_role;
revoke all on function public.rearm_overdue_reminders() from public, anon, authenticated;
grant execute on function public.rearm_overdue_reminders() to service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
