-- 0019: fix create_tasks_bulk (runtime 42883) + harden against recurrence.
--
-- The bug: create_tasks_bulk called create_task() with POSITIONAL args, passing
-- priority as `coalesce((v_el->>'priority')::smallint, 0)`. The integer literal 0
-- widened the coalesce result to integer, so the call resolved to a create_task
-- signature with an integer 6th arg — which doesn't exist (p_priority is smallint).
-- Postgres won't implicitly narrow integer->smallint during FUNCTION RESOLUTION,
-- so every create_tasks_bulk call threw 42883, surfaced over MCP/REST as a 500.
-- create_task called by name was unaffected, so single-task creation always worked.
--
-- The fix: call create_task with NAMED parameters (p_x => ...). Named-arg binding
-- uses ASSIGNMENT casts (integer->smallint is allowed there), so it is immune to
-- the literal-type-promotion trap regardless of any future narrowing of a create_task
-- param type. (gap-review #1 + #17). Plain CREATE OR REPLACE preserves grants.

create or replace function public.create_tasks_bulk(p_user_id uuid, p_tasks jsonb)
returns setof public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_el jsonb;
begin
  for v_el in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb))
  loop
    return query select * from public.create_task(
      p_user_id => v_uid,
      p_title => coalesce(v_el ->> 'title', ''),
      p_list_id => (v_el ->> 'list_id')::uuid,
      p_parent_task_id => (v_el ->> 'parent_task_id')::uuid,
      p_description => v_el ->> 'description',
      p_priority => coalesce((v_el ->> 'priority')::smallint, 0::smallint),
      p_labels => coalesce((select array_agg(x) from jsonb_array_elements_text(v_el -> 'labels') as x), '{}'),
      p_scheduled_date => (v_el ->> 'scheduled_date')::date,
      p_scheduled_time => (v_el ->> 'scheduled_time')::time,
      p_due_date => (v_el ->> 'due_date')::date,
      p_due_time => (v_el ->> 'due_time')::time,
      p_duration_min => (v_el ->> 'duration_min')::int,
      p_kind => coalesce(v_el ->> 'kind', 'task'),
      p_recurrence_rule => v_el ->> 'recurrence_rule',
      p_recurrence_after_completion => coalesce((v_el ->> 'recurrence_after_completion')::boolean, false),
      p_recurrence_anchor => (v_el ->> 'recurrence_anchor')::date,
      p_next_occurrence => (v_el ->> 'next_occurrence')::date,
      p_tz => v_el ->> 'tz',
      p_sort_order => coalesce((v_el ->> 'sort_order')::int, 0),
      p_created_via => 'mcp');
  end loop;
end;
$$;
