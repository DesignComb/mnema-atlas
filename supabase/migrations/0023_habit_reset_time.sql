-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0023 · Habit reset time                                                    ║
-- ║                                                                            ║
-- ║ A habit's "day" does not always roll over at local midnight. Genshin's     ║
-- ║ dailies reset at 04:00, gacha check-ins at 00:00, some mobile games at     ║
-- ║ 14:00. `tasks.reset_time` records that wall-clock cutoff (in the task's    ║
-- ║ `tz`); null keeps the legacy midnight behaviour.                           ║
-- ║                                                                            ║
-- ║ The "habit day" used for check-ins is computed where the clock lives —     ║
-- ║ the browser and the Worker — as  date( now-in-tz − reset_time ).  The DB   ║
-- ║ only stores the value; it does not change streak math (streaks already     ║
-- ║ operate on whatever checkin_date it is handed).                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.tasks add column if not exists reset_time time;
comment on column public.tasks.reset_time is
  'Habit day-boundary: local wall-clock time (in tasks.tz) at which the day rolls over. Null = midnight. Habit-day = date(now-in-tz − reset_time), computed client/worker-side.';

-- ── create_task: add p_reset_time (signature changes → drop the old overload) ─
drop function if exists public.create_task(
  uuid, text, uuid, uuid, text, smallint, text[], date, time, date, time, integer,
  text, text, boolean, date, date, text, integer, text
);

create or replace function public.create_task(
  p_user_id uuid, p_title text,
  p_list_id uuid default null, p_parent_task_id uuid default null,
  p_description text default null, p_priority smallint default 0, p_labels text[] default '{}',
  p_scheduled_date date default null, p_scheduled_time time default null,
  p_due_date date default null, p_due_time time default null, p_duration_min integer default null,
  p_kind text default 'task', p_recurrence_rule text default null,
  p_recurrence_after_completion boolean default false, p_recurrence_anchor date default null,
  p_next_occurrence date default null, p_tz text default null,
  p_sort_order integer default 0, p_created_via text default 'ui',
  p_reset_time time default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks; v_next date;
begin
  if p_list_id is not null and not exists (select 1 from public.task_lists where id = p_list_id and user_id = v_uid) then
    raise exception 'list not found' using errcode = 'P0002';
  end if;
  if p_parent_task_id is not null and not exists (select 1 from public.tasks where id = p_parent_task_id and user_id = v_uid) then
    raise exception 'parent task not found' using errcode = 'P0002';
  end if;
  v_next := coalesce(p_next_occurrence, p_scheduled_date, p_due_date);
  insert into public.tasks (
    user_id, list_id, parent_task_id, title, description, priority, labels,
    scheduled_date, scheduled_time, due_date, due_time, duration_min, tz, kind,
    recurrence_rule, recurrence_after_completion, recurrence_anchor, next_occurrence,
    sort_order, created_via, reset_time
  ) values (
    v_uid, p_list_id, p_parent_task_id, p_title, p_description, coalesce(p_priority, 0), coalesce(p_labels, '{}'),
    p_scheduled_date, p_scheduled_time, p_due_date, p_due_time, p_duration_min, p_tz, coalesce(nullif(p_kind, ''), 'task'),
    p_recurrence_rule, coalesce(p_recurrence_after_completion, false),
    coalesce(p_recurrence_anchor, p_scheduled_date, p_due_date), v_next,
    coalesce(p_sort_order, 0), p_created_via, p_reset_time
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- create_tasks_bulk: forward reset_time from each element to create_task.
create or replace function public.create_tasks_bulk(p_user_id uuid, p_tasks jsonb)
returns setof public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_el jsonb;
begin
  for v_el in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb))
  loop
    return query select * from public.create_task(
      v_uid, coalesce(v_el ->> 'title', ''),
      (v_el ->> 'list_id')::uuid, (v_el ->> 'parent_task_id')::uuid,
      v_el ->> 'description', coalesce((v_el ->> 'priority')::smallint, 0),
      coalesce((select array_agg(x) from jsonb_array_elements_text(v_el -> 'labels') as x), '{}'),
      (v_el ->> 'scheduled_date')::date, (v_el ->> 'scheduled_time')::time,
      (v_el ->> 'due_date')::date, (v_el ->> 'due_time')::time, (v_el ->> 'duration_min')::int,
      coalesce(v_el ->> 'kind', 'task'), v_el ->> 'recurrence_rule',
      coalesce((v_el ->> 'recurrence_after_completion')::boolean, false),
      (v_el ->> 'recurrence_anchor')::date, (v_el ->> 'next_occurrence')::date,
      v_el ->> 'tz', coalesce((v_el ->> 'sort_order')::int, 0), 'mcp',
      (v_el ->> 'reset_time')::time);
  end loop;
end;
$$;

-- ── update_task: add p_reset_time (signature changes → drop the old overload) ─
drop function if exists public.update_task(
  uuid, uuid, text, text, uuid, smallint, text[], date, time, text, integer
);

create or replace function public.update_task(
  p_user_id uuid, p_task_id uuid, p_title text default null, p_description text default null,
  p_list_id uuid default null, p_priority smallint default null, p_labels text[] default null,
  p_due_date date default null, p_due_time time default null,
  p_status text default null, p_sort_order integer default null,
  p_reset_time time default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  if p_list_id is not null and not exists (select 1 from public.task_lists where id = p_list_id and user_id = v_uid) then
    raise exception 'list not found' using errcode = 'P0002';
  end if;
  update public.tasks set
    title = coalesce(p_title, title), description = coalesce(p_description, description),
    list_id = coalesce(p_list_id, list_id), priority = coalesce(p_priority, priority),
    labels = coalesce(p_labels, labels), due_date = coalesce(p_due_date, due_date),
    due_time = coalesce(p_due_time, due_time), status = coalesce(nullif(p_status, ''), status),
    sort_order = coalesce(p_sort_order, sort_order), reset_time = coalesce(p_reset_time, reset_time)
  where id = p_task_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

-- ── Re-lock the re-created functions (new overloads default to PUBLIC EXECUTE) ─
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_task(uuid,text,uuid,uuid,text,smallint,text[],date,time,date,time,integer,text,text,boolean,date,date,text,integer,text,time)',
    'public.create_tasks_bulk(uuid,jsonb)',
    'public.update_task(uuid,uuid,text,text,uuid,smallint,text[],date,time,text,integer,time)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- App-wide anon lockdown (this migration re-created public functions). Re-grant
-- only the one legitimately anon-callable function.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
