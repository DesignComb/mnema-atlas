-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — 0014 Mnema Tempo (todos / habits / calendar / reminders)
-- A third top-level space. Single-owner (user_id), same security spine as the
-- study tables (notes/decks/cards): owner-only RLS, writes via SECURITY DEFINER
-- RPCs that stamp app.resolve_uid(p_user_id). Everything is exposed to the
-- user's own AI through worker/src/tools.ts (MCP + REST + OpenAPI).
--
-- Recurrence: full iCal RRULE strings are computed/expanded in JS (rrule.js) in
-- the Worker and passed in as p_next_occurrence; app.rrule_next_simple() is a
-- daily/weekly/monthly/yearly fallback when the caller doesn't supply one.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Tables ─────────────────────────────────────────────────────────────
create table if not exists public.task_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text,
  icon        text,
  kind        text not null default 'list' check (kind in ('list', 'project')),
  sort_order  integer not null default 0,
  is_archived boolean not null default false,
  created_via text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists task_lists_user_idx on public.task_lists (user_id, sort_order);

create table if not exists public.tasks (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  list_id                     uuid references public.task_lists(id) on delete set null,
  parent_task_id              uuid references public.tasks(id) on delete cascade,
  title                       text not null,
  description                 text,
  status                      text not null default 'todo' check (status in ('todo', 'done', 'cancelled')),
  priority                    smallint not null default 0 check (priority between 0 and 4),
  labels                      text[] not null default '{}',
  scheduled_date              date,
  scheduled_time              time,
  due_date                    date,
  due_time                    time,
  duration_min                integer check (duration_min is null or duration_min between 0 and 1440),
  tz                          text,
  completed_at                timestamptz,
  sort_order                  integer not null default 0,
  kind                        text not null default 'task' check (kind in ('task', 'habit')),
  recurrence_rule             text,
  recurrence_after_completion boolean not null default false,
  recurrence_anchor           date,
  next_occurrence             date,
  current_streak              integer not null default 0,
  longest_streak              integer not null default 0,
  created_via                 text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists tasks_user_idx        on public.tasks (user_id);
create index if not exists tasks_list_idx        on public.tasks (user_id, list_id);
create index if not exists tasks_parent_idx      on public.tasks (parent_task_id);
create index if not exists tasks_due_idx         on public.tasks (user_id, due_date);
create index if not exists tasks_scheduled_idx   on public.tasks (user_id, scheduled_date);
create index if not exists tasks_next_occ_idx    on public.tasks (user_id, next_occurrence);
create index if not exists tasks_kind_status_idx on public.tasks (user_id, kind, status);
create index if not exists tasks_labels_idx      on public.tasks using gin (labels);

create table if not exists public.task_checkins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  checkin_date date not null,
  note         text,
  created_at   timestamptz not null default now(),
  constraint task_checkins_unique unique (task_id, checkin_date)
);
create index if not exists task_checkins_task_idx on public.task_checkins (task_id, checkin_date desc);
create index if not exists task_checkins_user_idx on public.task_checkins (user_id, checkin_date);

create table if not exists public.task_reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  remind_at   timestamptz not null,
  offset_min  integer,
  method      text not null default 'push' check (method in ('push')),
  status      text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  sent_at     timestamptz,
  created_via text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists task_reminders_due_idx  on public.task_reminders (remind_at) where status = 'pending';
create index if not exists task_reminders_task_idx on public.task_reminders (task_id);
create index if not exists task_reminders_user_idx on public.task_reminders (user_id);

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ── 2) updated_at triggers ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['task_lists', 'tasks', 'task_reminders', 'push_subscriptions']
  loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s;', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s for each row execute function app.set_updated_at();', t);
  end loop;
end;
$$;

-- ── 3) Per-user quotas + input caps ───────────────────────────────────────
do $$
declare r record;
begin
  for r in select * from (values
    ('task_lists','user_id','2000'),
    ('tasks','user_id','100000'),
    ('task_checkins','user_id','500000'),
    ('task_reminders','user_id','50000'),
    ('push_subscriptions','user_id','50')
  ) as v(tbl, col, cap)
  loop
    execute format('drop trigger if exists %1$s_quota on public.%1$s;', r.tbl);
    execute format('create trigger %1$s_quota before insert on public.%1$s for each row execute function app.enforce_row_quota(%2$L, %3$L);', r.tbl, r.cap, r.col);
  end loop;
end;
$$;

do $$
declare r record;
begin
  for r in select * from (values
    ('tasks','tasks_title_len','char_length(title) <= 500'),
    ('tasks','tasks_desc_len','description is null or char_length(description) <= 20000'),
    ('task_lists','task_lists_name_len','char_length(name) <= 120')
  ) as r(tbl, cname, expr)
  loop
    execute format('alter table public.%I drop constraint if exists %I;', r.tbl, r.cname);
    execute format('alter table public.%I add constraint %I check (%s) not valid;', r.tbl, r.cname, r.expr);
  end loop;
end;
$$;

-- ── 4) RLS (owner-only SELECT; writes via RPC only — P0 from birth) ────────
do $$
declare t text;
begin
  foreach t in array array['task_lists', 'tasks', 'task_checkins', 'task_reminders', 'push_subscriptions']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = user_id);', t);
  end loop;
end;
$$;

-- ── 5) Helpers (app schema; not exposed via PostgREST) ────────────────────
-- Minimal RRULE advance: FREQ + INTERVAL only. Full RRULE (BYDAY, …) is
-- computed in JS by the Worker and passed in as p_next_occurrence.
create or replace function app.rrule_next_simple(p_rule text, p_from date)
returns date language plpgsql immutable set search_path = ''
as $$
declare
  v_rule     text;
  v_freq     text;
  v_interval int := 1;
  v_part     text;
  v_kv       text[];
begin
  if p_rule is null or p_from is null then return null; end if;
  v_rule := upper(replace(p_rule, 'RRULE:', ''));
  foreach v_part in array string_to_array(v_rule, ';')
  loop
    v_kv := string_to_array(v_part, '=');
    if v_kv[1] = 'FREQ' then v_freq := v_kv[2];
    elsif v_kv[1] = 'INTERVAL' then v_interval := greatest(1, coalesce(v_kv[2]::int, 1));
    end if;
  end loop;
  if v_freq = 'WEEKLY'  then return p_from + (v_interval * 7);
  elsif v_freq = 'MONTHLY' then return (p_from + (v_interval || ' months')::interval)::date;
  elsif v_freq = 'YEARLY'  then return (p_from + (v_interval || ' years')::interval)::date;
  else return p_from + v_interval;  -- DAILY / default
  end if;
end;
$$;

-- Recompute a habit's current/longest streak + next_occurrence from its
-- check-in history (gaps-and-islands over consecutive days).
create or replace function app.recompute_streak(p_task_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_longest int := 0;
  v_current int := 0;
  v_last    date;
  v_rule    text;
  v_next    date;
begin
  with d as (
    select checkin_date,
           (checkin_date - (row_number() over (order by checkin_date))::int * interval '1 day')::date as grp
    from public.task_checkins where task_id = p_task_id
  ), islands as (
    select grp, count(*)::int as len, max(checkin_date) as last_date from d group by grp
  )
  select coalesce(max(len), 0),
         coalesce((select len from islands order by last_date desc limit 1), 0),
         (select max(last_date) from islands)
    into v_longest, v_current, v_last
    from islands;

  select recurrence_rule into v_rule from public.tasks where id = p_task_id;
  if v_last is not null then
    v_next := coalesce(app.rrule_next_simple(v_rule, v_last), v_last + 1);
  end if;

  update public.tasks
     set current_streak  = v_current,
         longest_streak  = greatest(longest_streak, v_longest),
         next_occurrence = coalesce(v_next, next_occurrence)
   where id = p_task_id;
end;
$$;

-- ── 6) List RPCs ──────────────────────────────────────────────────────────
create or replace function public.create_task_list(
  p_user_id uuid, p_name text, p_kind text default 'list',
  p_color text default null, p_icon text default null,
  p_sort_order integer default 0, p_created_via text default 'ui'
)
returns public.task_lists language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.task_lists;
begin
  insert into public.task_lists (user_id, name, kind, color, icon, sort_order, created_via)
  values (v_uid, p_name, coalesce(nullif(p_kind, ''), 'list'), p_color, p_icon, coalesce(p_sort_order, 0), p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_task_list(
  p_user_id uuid, p_list_id uuid, p_name text default null, p_kind text default null,
  p_color text default null, p_icon text default null,
  p_is_archived boolean default null, p_sort_order integer default null
)
returns public.task_lists language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.task_lists;
begin
  update public.task_lists set
    name = coalesce(p_name, name), kind = coalesce(nullif(p_kind, ''), kind),
    color = coalesce(p_color, color), icon = coalesce(p_icon, icon),
    is_archived = coalesce(p_is_archived, is_archived), sort_order = coalesce(p_sort_order, sort_order)
  where id = p_list_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'list not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_task_list(p_user_id uuid, p_list_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.task_lists where id = p_list_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.reorder_task_lists(p_user_id uuid, p_list_ids uuid[])
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  update public.task_lists t set sort_order = u.ord - 1
  from unnest(p_list_ids) with ordinality as u(id, ord)
  where t.id = u.id and t.user_id = v_uid;
  return true;
end;
$$;

-- ── 7) Task RPCs ──────────────────────────────────────────────────────────
create or replace function public.create_task(
  p_user_id uuid, p_title text,
  p_list_id uuid default null, p_parent_task_id uuid default null,
  p_description text default null, p_priority smallint default 0, p_labels text[] default '{}',
  p_scheduled_date date default null, p_scheduled_time time default null,
  p_due_date date default null, p_due_time time default null, p_duration_min integer default null,
  p_kind text default 'task', p_recurrence_rule text default null,
  p_recurrence_after_completion boolean default false, p_recurrence_anchor date default null,
  p_next_occurrence date default null, p_tz text default null,
  p_sort_order integer default 0, p_created_via text default 'ui'
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
    sort_order, created_via
  ) values (
    v_uid, p_list_id, p_parent_task_id, p_title, p_description, coalesce(p_priority, 0), coalesce(p_labels, '{}'),
    p_scheduled_date, p_scheduled_time, p_due_date, p_due_time, p_duration_min, p_tz, coalesce(nullif(p_kind, ''), 'task'),
    p_recurrence_rule, coalesce(p_recurrence_after_completion, false),
    coalesce(p_recurrence_anchor, p_scheduled_date, p_due_date), v_next,
    coalesce(p_sort_order, 0), p_created_via
  )
  returning * into v_row;
  return v_row;
end;
$$;

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
      v_el ->> 'tz', coalesce((v_el ->> 'sort_order')::int, 0), 'mcp');
  end loop;
end;
$$;

create or replace function public.update_task(
  p_user_id uuid, p_task_id uuid, p_title text default null, p_description text default null,
  p_list_id uuid default null, p_priority smallint default null, p_labels text[] default null,
  p_due_date date default null, p_due_time time default null,
  p_status text default null, p_sort_order integer default null
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
    sort_order = coalesce(p_sort_order, sort_order)
  where id = p_task_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

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
  return v_t;
end;
$$;

create or replace function public.uncomplete_task(p_user_id uuid, p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  update public.tasks set status = 'todo', completed_at = null where id = p_task_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_task(p_user_id uuid, p_task_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.tasks where id = p_task_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.move_task(
  p_user_id uuid, p_task_id uuid, p_list_id uuid default null, p_parent_task_id uuid default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  if not exists (select 1 from public.tasks where id = p_task_id and user_id = v_uid) then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if p_list_id is not null and not exists (select 1 from public.task_lists where id = p_list_id and user_id = v_uid) then
    raise exception 'list not found' using errcode = 'P0002';
  end if;
  if p_parent_task_id is not null then
    if p_parent_task_id = p_task_id then raise exception 'a task cannot be its own parent' using errcode = '22023'; end if;
    if not exists (select 1 from public.tasks where id = p_parent_task_id and user_id = v_uid) then
      raise exception 'parent task not found' using errcode = 'P0002';
    end if;
    if exists (
      with recursive descendants as (
        select id from public.tasks where id = p_task_id
        union all
        select t.id from public.tasks t join descendants d on t.parent_task_id = d.id
      ) select 1 from descendants where id = p_parent_task_id
    ) then raise exception 'cannot move a task under its own descendant' using errcode = '22023'; end if;
  end if;
  update public.tasks set list_id = p_list_id, parent_task_id = p_parent_task_id
   where id = p_task_id and user_id = v_uid returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.reorder_tasks(p_user_id uuid, p_list_id uuid, p_task_ids uuid[])
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  update public.tasks t set sort_order = u.ord - 1
  from unnest(p_task_ids) with ordinality as u(id, ord)
  where t.id = u.id and t.user_id = v_uid and t.list_id is not distinct from p_list_id;
  return true;
end;
$$;

-- ── 8) Recurrence / scheduling RPCs ───────────────────────────────────────
create or replace function public.set_recurrence(
  p_user_id uuid, p_task_id uuid, p_recurrence_rule text,
  p_recurrence_after_completion boolean default false,
  p_recurrence_anchor date default null, p_next_occurrence date default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  update public.tasks set
    recurrence_rule = nullif(p_recurrence_rule, ''),
    recurrence_after_completion = coalesce(p_recurrence_after_completion, false),
    recurrence_anchor = coalesce(p_recurrence_anchor, recurrence_anchor, scheduled_date, due_date, current_date),
    next_occurrence = coalesce(p_next_occurrence, next_occurrence, scheduled_date, due_date)
  where id = p_task_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.schedule_task(
  p_user_id uuid, p_task_id uuid,
  p_scheduled_date date default null, p_scheduled_time time default null,
  p_due_date date default null, p_due_time time default null, p_duration_min integer default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  -- Overwrite semantics: this is the time-block setter, null clears a field.
  update public.tasks set
    scheduled_date = p_scheduled_date, scheduled_time = p_scheduled_time,
    due_date = p_due_date, due_time = p_due_time, duration_min = p_duration_min,
    next_occurrence = case when recurrence_rule is null then coalesce(p_scheduled_date, p_due_date) else next_occurrence end
  where id = p_task_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.snooze_task(
  p_user_id uuid, p_task_id uuid, p_until date, p_until_time time default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  update public.tasks set
    scheduled_date = p_until,
    scheduled_time = coalesce(p_until_time, scheduled_time),
    next_occurrence = p_until
  where id = p_task_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

-- ── 9) Habit check-in RPCs ────────────────────────────────────────────────
create or replace function public.check_in(
  p_user_id uuid, p_task_id uuid, p_checkin_date date default current_date, p_note text default null
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  if not exists (select 1 from public.tasks where id = p_task_id and user_id = v_uid) then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  insert into public.task_checkins (user_id, task_id, checkin_date, note)
  values (v_uid, p_task_id, coalesce(p_checkin_date, current_date), p_note)
  on conflict (task_id, checkin_date) do nothing;
  perform app.recompute_streak(p_task_id);
  select * into v_row from public.tasks where id = p_task_id;
  return v_row;
end;
$$;

create or replace function public.uncheck_in(
  p_user_id uuid, p_task_id uuid, p_checkin_date date default current_date
)
returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.tasks;
begin
  delete from public.task_checkins
   where task_id = p_task_id and checkin_date = coalesce(p_checkin_date, current_date)
     and user_id = v_uid;
  perform app.recompute_streak(p_task_id);
  select * into v_row from public.tasks where id = p_task_id and user_id = v_uid;
  if v_row.id is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

-- ── 10) Reminder + push-subscription RPCs ─────────────────────────────────
create or replace function public.add_reminder(
  p_user_id uuid, p_task_id uuid, p_remind_at timestamptz,
  p_offset_min integer default null, p_created_via text default 'ui'
)
returns public.task_reminders language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.task_reminders;
begin
  if not exists (select 1 from public.tasks where id = p_task_id and user_id = v_uid) then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  insert into public.task_reminders (user_id, task_id, remind_at, offset_min, created_via)
  values (v_uid, p_task_id, p_remind_at, p_offset_min, p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.remove_reminder(p_user_id uuid, p_reminder_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.task_reminders where id = p_reminder_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.save_push_subscription(
  p_user_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns public.push_subscriptions language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.push_subscriptions;
begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_push_subscription(p_user_id uuid, p_endpoint text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.push_subscriptions where user_id = v_uid and endpoint = p_endpoint;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- Cron-only (service_role): cross-owner reads/writes for the reminder sweep.
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
    where r.status = 'pending' and r.remind_at <= now()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.mark_reminder_delivered(p_reminder_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  update public.task_reminders set status = 'sent', sent_at = now()
   where id = p_reminder_id and status = 'pending';
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.prune_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  delete from public.push_subscriptions where endpoint = p_endpoint;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── 11) Read RPCs ─────────────────────────────────────────────────────────
create or replace function public.get_task(p_user_id uuid, p_task_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  select to_jsonb(t) || jsonb_build_object(
    'subtasks', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order, s.created_at)
                          from public.tasks s where s.parent_task_id = t.id), '[]'::jsonb),
    'reminders', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'remind_at', r.remind_at, 'offset_min', r.offset_min, 'status', r.status) order by r.remind_at)
                           from public.task_reminders r where r.task_id = t.id), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(c.checkin_date order by c.checkin_date desc)
                          from public.task_checkins c where c.task_id = t.id), '[]'::jsonb)
  )
  into v_res from public.tasks t where t.id = p_task_id and t.user_id = v_uid;
  if v_res is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_res;
end;
$$;

create or replace function public.list_tasks(
  p_user_id uuid, p_list_id uuid default null, p_status text default 'todo',
  p_kind text default null, p_label text default null,
  p_due_before date default null, p_scheduled_on date default null,
  p_include_subtasks boolean default false, p_limit integer default 100
)
returns setof public.tasks language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select t.* from public.tasks t
     where t.user_id = v_uid
       and (p_list_id is null or t.list_id = p_list_id)
       and (p_status is null or p_status = '' or t.status = p_status)
       and (p_kind is null or t.kind = p_kind)
       and (p_label is null or t.labels @> array[p_label])
       and (p_due_before is null or t.due_date <= p_due_before)
       and (p_scheduled_on is null or t.scheduled_date = p_scheduled_on)
       and (coalesce(p_include_subtasks, false) or t.parent_task_id is null)
     order by t.sort_order, t.due_date nulls last, t.created_at
     limit greatest(1, least(p_limit, 500));
end;
$$;

create or replace function public.search_tasks(p_user_id uuid, p_query text, p_limit integer default 50)
returns setof public.tasks language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select t.* from public.tasks t
     where t.user_id = v_uid
       and (t.title ilike '%' || p_query || '%' or t.description ilike '%' || p_query || '%')
     order by t.updated_at desc
     limit greatest(1, least(p_limit, 200));
end;
$$;

create or replace function public.get_habit(p_user_id uuid, p_task_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  select to_jsonb(t) || jsonb_build_object(
    'checkins', coalesce((select jsonb_agg(c.checkin_date order by c.checkin_date desc)
                          from public.task_checkins c where c.task_id = t.id), '[]'::jsonb)
  )
  into v_res from public.tasks t where t.id = p_task_id and t.user_id = v_uid;
  if v_res is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_res;
end;
$$;

create or replace function public.get_streak(p_user_id uuid, p_task_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  select jsonb_build_object(
    'current_streak', t.current_streak, 'longest_streak', t.longest_streak,
    'last_checkin_date', (select max(checkin_date) from public.task_checkins where task_id = t.id),
    'calendar', coalesce((select jsonb_agg(checkin_date order by checkin_date)
                          from public.task_checkins where task_id = t.id), '[]'::jsonb)
  )
  into v_res from public.tasks t where t.id = p_task_id and t.user_id = v_uid;
  if v_res is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return v_res;
end;
$$;

-- AI smart-suggestion surface: clusters of repeatedly-added non-recurring tasks.
create or replace function public.suggest_recurring_tasks(
  p_user_id uuid, p_lookback_days integer default 90, p_min_count integer default 3
)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  with recent as (
    select id, lower(btrim(title)) as norm, created_at
    from public.tasks
    where user_id = v_uid and recurrence_rule is null and parent_task_id is null
      and created_at > now() - (greatest(1, p_lookback_days) || ' days')::interval
  ), grp as (
    select norm, count(*) as cnt, array_agg(id) as ids,
           (max(created_at)::date - min(created_at)::date) as span_days
    from recent group by norm having count(*) >= greatest(2, p_min_count)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'title', norm, 'count', cnt, 'task_ids', to_jsonb(ids),
    'avg_gap_days', case when cnt > 1 then round(span_days::numeric / (cnt - 1), 1) else null end,
    'suggested_rule', case
      when cnt > 1 and span_days::numeric / (cnt - 1) <= 2 then 'FREQ=DAILY'
      when cnt > 1 and span_days::numeric / (cnt - 1) <= 10 then 'FREQ=WEEKLY'
      else 'FREQ=MONTHLY' end
  ) order by cnt desc), '[]'::jsonb)
  into v_res from grp;
  return v_res;
end;
$$;

-- ── 12) Grants + anon re-hardening ────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_task_list(uuid,text,text,text,text,integer,text)',
    'public.update_task_list(uuid,uuid,text,text,text,text,boolean,integer)',
    'public.delete_task_list(uuid,uuid)',
    'public.reorder_task_lists(uuid,uuid[])',
    'public.create_task(uuid,text,uuid,uuid,text,smallint,text[],date,time,date,time,integer,text,text,boolean,date,date,text,integer,text)',
    'public.create_tasks_bulk(uuid,jsonb)',
    'public.update_task(uuid,uuid,text,text,uuid,smallint,text[],date,time,text,integer)',
    'public.complete_task(uuid,uuid,timestamptz,date)',
    'public.uncomplete_task(uuid,uuid)',
    'public.delete_task(uuid,uuid)',
    'public.move_task(uuid,uuid,uuid,uuid)',
    'public.reorder_tasks(uuid,uuid,uuid[])',
    'public.set_recurrence(uuid,uuid,text,boolean,date,date)',
    'public.schedule_task(uuid,uuid,date,time,date,time,integer)',
    'public.snooze_task(uuid,uuid,date,time)',
    'public.check_in(uuid,uuid,date,text)',
    'public.uncheck_in(uuid,uuid,date)',
    'public.add_reminder(uuid,uuid,timestamptz,integer,text)',
    'public.remove_reminder(uuid,uuid)',
    'public.save_push_subscription(uuid,text,text,text,text)',
    'public.delete_push_subscription(uuid,text)',
    'public.get_task(uuid,uuid)',
    'public.list_tasks(uuid,uuid,text,text,text,date,date,boolean,integer)',
    'public.search_tasks(uuid,text,integer)',
    'public.get_habit(uuid,uuid)',
    'public.get_streak(uuid,uuid)',
    'public.suggest_recurring_tasks(uuid,integer,integer)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- Cron-only functions: service_role exclusively (they cross owner boundaries).
do $$
declare f text;
begin
  foreach f in array array[
    'public.due_reminders_for_cron()',
    'public.mark_reminder_delivered(uuid)',
    'public.prune_push_subscription(text)'
  ]
  loop
    -- Revoke the named-role grants Supabase default privileges auto-add (revoking
    -- from PUBLIC alone does NOT strip anon/authenticated) so these stay service-only.
    execute format('revoke all on function %s from public, anon, authenticated;', f);
    execute format('grant execute on function %s to service_role;', f);
  end loop;
end;
$$;

-- App-wide anon lockdown (this migration added public functions). Re-grant only
-- the one legitimately anon-callable function.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
