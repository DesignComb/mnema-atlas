-- ════════════════════════════════════════════════════════════════════════
-- Mnema Tempo — reminders follow recurrence.
-- When a recurring task advances on completion, shift its reminders forward by
-- the same number of days and re-arm them (status='pending'). This keeps a
-- relative reminder ("1 hour before") firing for every occurrence, not just the
-- first — the relative offset is preserved because due and reminder shift together.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.complete_task(
  p_user_id uuid, p_task_id uuid, p_completed_at timestamptz default now(), p_next_occurrence date default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_t public.tasks; v_next date; v_base date; v_shift int;
begin
  select * into v_t from public.tasks where id = p_task_id and user_id = v_uid;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;

  -- Habit: completing == checking in for the day.
  if v_t.kind = 'habit' then
    insert into public.task_checkins (user_id, task_id, checkin_date)
    values (v_uid, p_task_id, (p_completed_at)::date)
    on conflict (task_id, checkin_date) do nothing;
    perform app.recompute_streak(p_task_id);
    select * into v_t from public.tasks where id = p_task_id;
    return v_t;
  end if;

  -- One-off task.
  if v_t.recurrence_rule is null then
    update public.tasks set status = 'done', completed_at = p_completed_at where id = p_task_id returning * into v_t;
    return v_t;
  end if;

  -- Recurring task: advance the same row.
  if v_t.recurrence_after_completion then
    v_base := (p_completed_at)::date;
  else
    v_base := coalesce(v_t.next_occurrence, v_t.recurrence_anchor, v_t.scheduled_date, v_t.due_date, current_date);
  end if;
  v_next := coalesce(p_next_occurrence, app.rrule_next_simple(v_t.recurrence_rule, v_base));

  if v_next is null then
    update public.tasks set status = 'done', completed_at = p_completed_at, next_occurrence = null
     where id = p_task_id returning * into v_t;
    return v_t;
  end if;

  v_shift := v_next - coalesce(v_t.scheduled_date, v_t.due_date, v_t.next_occurrence, v_base);
  update public.tasks set
    scheduled_date  = case when scheduled_date is not null then scheduled_date + v_shift else null end,
    due_date        = case when due_date is not null then due_date + v_shift else null end,
    next_occurrence = v_next, status = 'todo', completed_at = null
  where id = p_task_id returning * into v_t;

  -- Carry reminders to the next occurrence (preserve the relative offset).
  update public.task_reminders
     set remind_at = remind_at + make_interval(days => v_shift), status = 'pending', sent_at = null
   where task_id = p_task_id;

  return v_t;
end;
$$;

revoke all on function public.complete_task(uuid, uuid, timestamptz, date) from public;
grant execute on function public.complete_task(uuid, uuid, timestamptz, date) to authenticated, service_role;
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
