-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0027 · Mnema Vitals (health / 健康)                                         ║
-- ║                                                                            ║
-- ║ A personal health space: log body & vital metrics, sleep / workouts /      ║
-- ║ water, meals, symptoms; keep a daily journal with a mood + energy rating;  ║
-- ║ track medications. Built for BYO-AI: you tell your own AI "午餐吃了一個     ║
-- ║ 雞腿便當" or "今天睡 23:30 到 07:00" and it logs the structured row.        ║
-- ║                                                                            ║
-- ║ Not everyone needs every module, so health_settings.enabled_modules lets   ║
-- ║ each user switch whole categories on/off (the UI + the AI honour it).      ║
-- ║                                                                            ║
-- ║ Single-owner, same security spine as Captures (0024): owner-only RLS       ║
-- ║ SELECT, every write through a SECURITY DEFINER RPC that stamps the         ║
-- ║ resolved user_id. No `space` column — spaces are a UI concept.             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 1) Tables ─────────────────────────────────────────────────────────────────

-- Per-user preferences: which modules are visible + display units. One row/user.
create table if not exists public.health_settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  -- module keys: vitals | activity | nutrition | meds | journal
  enabled_modules text[] not null default array['vitals','activity','nutrition','meds','journal'],
  weight_unit     text not null default 'kg' check (weight_unit in ('kg','lb')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Flexible typed metric log. One table, a `kind` discriminator (the Captures
-- pattern): value/value2 are numeric (e.g. BP 120/80), text_value names a free
-- thing (meal, symptom), meta carries the structured rest (macros, sleep window).
create table if not exists public.health_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in (
    'weight','body_fat','waist','blood_pressure','heart_rate','blood_glucose','temperature',
    'sleep','workout','water','meal','meds','symptom','other'
  )),
  value       numeric,                    -- primary number (kg, bpm, mg/dL, °C, hours, ml, kcal, minutes)
  value2      numeric,                    -- secondary (e.g. diastolic for blood_pressure)
  unit        text check (unit is null or char_length(unit) <= 16),
  text_value  text check (text_value is null or char_length(text_value) <= 300),  -- meal/workout/symptom/med name
  meta        jsonb,                      -- { protein, carbs, fat } | { bedtime, wake } | { distance_km } …
  logged_at   timestamptz not null default now(),
  logged_date date not null default current_date,  -- the day it belongs to (client passes its local date)
  note        text check (note is null or char_length(note) <= 2000),
  created_via text not null default 'ui' check (created_via in ('ui','rest','mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists health_logs_user_kind_idx on public.health_logs (user_id, kind, logged_date desc);
create index if not exists health_logs_user_date_idx on public.health_logs (user_id, logged_date desc);

-- Daily journal + mood/energy. One row per day (upsert), the merged 日記/心情.
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null,
  mood        smallint check (mood is null or mood between 1 and 5),
  energy      smallint check (energy is null or energy between 1 and 5),
  body        text check (body is null or char_length(body) <= 20000),
  tags        text[] not null default '{}',
  created_via text not null default 'ui' check (created_via in ('ui','rest','mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint journal_entries_user_date_unique unique (user_id, entry_date)
);
create index if not exists journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);

-- Medications / supplements the user is on. Logging an actual dose is a
-- health_logs row (kind='meds'); this table is the "what I take" list + schedule.
create table if not exists public.medications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 200),
  dosage        text check (dosage is null or char_length(dosage) <= 120),
  times         text[] not null default '{}',  -- wall-clock HH:MM strings, e.g. {'08:00','20:00'}
  schedule_rule text check (schedule_rule is null or char_length(schedule_rule) <= 1000),  -- optional RRULE
  is_active     boolean not null default true,
  notes         text check (notes is null or char_length(notes) <= 2000),
  sort_order    integer not null default 0,
  created_via   text not null default 'ui' check (created_via in ('ui','rest','mcp')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists medications_user_idx on public.medications (user_id, is_active, sort_order);

-- ── 2) updated_at triggers ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['health_settings','health_logs','journal_entries','medications']
  loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s;', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s for each row execute function app.set_updated_at();', t);
  end loop;
end;
$$;

-- ── 3) Per-user quotas (keep a runaway AI loop from filling a table) ───────────
do $$
declare r record;
begin
  for r in select * from (values
    ('health_logs','user_id','500000'),
    ('journal_entries','user_id','50000'),
    ('medications','user_id','2000')
  ) as v(tbl, col, cap)
  loop
    execute format('drop trigger if exists %1$s_quota on public.%1$s;', r.tbl);
    execute format('create trigger %1$s_quota before insert on public.%1$s for each row execute function app.enforce_row_quota(%2$L, %3$L);', r.tbl, r.cap, r.col);
  end loop;
end;
$$;

-- ── 4) RLS (owner-only SELECT; writes via RPC only) ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['health_settings','health_logs','journal_entries','medications']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = user_id);', t);
  end loop;
end;
$$;

-- ── 5) Settings ───────────────────────────────────────────────────────────────
create or replace function public.set_health_settings(
  p_user_id uuid, p_enabled_modules text[] default null, p_weight_unit text default null
)
returns public.health_settings language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.health_settings;
begin
  insert into public.health_settings (user_id, enabled_modules, weight_unit)
  values (
    v_uid,
    coalesce(p_enabled_modules, array['vitals','activity','nutrition','meds','journal']),
    coalesce(nullif(p_weight_unit, ''), 'kg')
  )
  on conflict (user_id) do update set
    enabled_modules = coalesce(p_enabled_modules, public.health_settings.enabled_modules),
    weight_unit     = coalesce(nullif(p_weight_unit, ''), public.health_settings.weight_unit)
  returning * into v_row;
  return v_row;
end;
$$;

-- ── 6) Health logs ────────────────────────────────────────────────────────────
create or replace function public.log_health(
  p_user_id uuid, p_kind text,
  p_value numeric default null, p_value2 numeric default null,
  p_unit text default null, p_text_value text default null,
  p_meta jsonb default null, p_logged_at timestamptz default null,
  p_logged_date date default null, p_note text default null,
  p_created_via text default 'ui'
)
returns public.health_logs language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.health_logs;
begin
  insert into public.health_logs (user_id, kind, value, value2, unit, text_value, meta, logged_at, logged_date, note, created_via)
  values (
    v_uid, p_kind, p_value, p_value2, nullif(p_unit, ''), nullif(p_text_value, ''), p_meta,
    coalesce(p_logged_at, now()), coalesce(p_logged_date, current_date), nullif(p_note, ''),
    coalesce(nullif(p_created_via, ''), 'ui')
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_health_log(
  p_user_id uuid, p_log_id uuid,
  p_value numeric default null, p_value2 numeric default null,
  p_unit text default null, p_text_value text default null,
  p_meta jsonb default null, p_logged_at timestamptz default null,
  p_logged_date date default null, p_note text default null
)
returns public.health_logs language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.health_logs;
begin
  update public.health_logs set
    value       = coalesce(p_value, value),
    value2      = coalesce(p_value2, value2),
    unit        = coalesce(nullif(p_unit, ''), unit),
    text_value  = coalesce(nullif(p_text_value, ''), text_value),
    meta        = coalesce(p_meta, meta),
    logged_at   = coalesce(p_logged_at, logged_at),
    logged_date = coalesce(p_logged_date, logged_date),
    note        = coalesce(nullif(p_note, ''), note)
  where id = p_log_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'health log not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_health_log(p_user_id uuid, p_log_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.health_logs where id = p_log_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.list_health_logs(
  p_user_id uuid, p_kind text default null,
  p_from date default null, p_to date default null, p_limit integer default 200
)
returns setof public.health_logs language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.health_logs
    where user_id = v_uid
      and (p_kind is null or kind = p_kind)
      and (p_from is null or logged_date >= p_from)
      and (p_to   is null or logged_date <= p_to)
    order by logged_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

-- ── 7) Journal (one row per day; upsert) ──────────────────────────────────────
create or replace function public.set_journal_entry(
  p_user_id uuid, p_entry_date date default null,
  p_mood smallint default null, p_energy smallint default null,
  p_body text default null, p_tags text[] default null,
  p_created_via text default 'ui'
)
returns public.journal_entries language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_date date := coalesce(p_entry_date, current_date); v_row public.journal_entries;
begin
  insert into public.journal_entries (user_id, entry_date, mood, energy, body, tags, created_via)
  values (v_uid, v_date, p_mood, p_energy, nullif(p_body, ''), coalesce(p_tags, '{}'), coalesce(nullif(p_created_via, ''), 'ui'))
  on conflict (user_id, entry_date) do update set
    mood   = coalesce(p_mood, public.journal_entries.mood),
    energy = coalesce(p_energy, public.journal_entries.energy),
    body   = coalesce(nullif(p_body, ''), public.journal_entries.body),
    tags   = coalesce(p_tags, public.journal_entries.tags)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_journal_entry(p_user_id uuid, p_entry_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.journal_entries where id = p_entry_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.list_journal_entries(
  p_user_id uuid, p_from date default null, p_to date default null, p_limit integer default 100
)
returns setof public.journal_entries language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.journal_entries
    where user_id = v_uid
      and (p_from is null or entry_date >= p_from)
      and (p_to   is null or entry_date <= p_to)
    order by entry_date desc
    limit greatest(1, least(coalesce(p_limit, 100), 1000));
end;
$$;

-- ── 8) Medications ────────────────────────────────────────────────────────────
create or replace function public.create_medication(
  p_user_id uuid, p_name text,
  p_dosage text default null, p_times text[] default null, p_schedule_rule text default null,
  p_is_active boolean default true, p_notes text default null, p_created_via text default 'ui'
)
returns public.medications language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.medications;
begin
  insert into public.medications (user_id, name, dosage, times, schedule_rule, is_active, notes, created_via)
  values (
    v_uid, p_name, nullif(p_dosage, ''), coalesce(p_times, '{}'), nullif(p_schedule_rule, ''),
    coalesce(p_is_active, true), nullif(p_notes, ''), coalesce(nullif(p_created_via, ''), 'ui')
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_medication(
  p_user_id uuid, p_medication_id uuid,
  p_name text default null, p_dosage text default null, p_times text[] default null,
  p_schedule_rule text default null, p_is_active boolean default null,
  p_notes text default null, p_sort_order integer default null
)
returns public.medications language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.medications;
begin
  update public.medications set
    name          = coalesce(nullif(p_name, ''), name),
    dosage        = coalesce(nullif(p_dosage, ''), dosage),
    times         = coalesce(p_times, times),
    schedule_rule = coalesce(nullif(p_schedule_rule, ''), schedule_rule),
    is_active     = coalesce(p_is_active, is_active),
    notes         = coalesce(nullif(p_notes, ''), notes),
    sort_order    = coalesce(p_sort_order, sort_order)
  where id = p_medication_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'medication not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_medication(p_user_id uuid, p_medication_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.medications where id = p_medication_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.list_medications(
  p_user_id uuid, p_active_only boolean default false, p_limit integer default 200
)
returns setof public.medications language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.medications
    where user_id = v_uid
      and (not coalesce(p_active_only, false) or is_active)
    order by sort_order, created_at
    limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

-- ── 9) Grants: owner (authenticated) + Worker (service_role) ───────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_health_settings(uuid,text[],text)',
    'public.log_health(uuid,text,numeric,numeric,text,text,jsonb,timestamptz,date,text,text)',
    'public.update_health_log(uuid,uuid,numeric,numeric,text,text,jsonb,timestamptz,date,text)',
    'public.delete_health_log(uuid,uuid)',
    'public.list_health_logs(uuid,text,date,date,integer)',
    'public.set_journal_entry(uuid,date,smallint,smallint,text,text[],text)',
    'public.delete_journal_entry(uuid,uuid)',
    'public.list_journal_entries(uuid,date,date,integer)',
    'public.create_medication(uuid,text,text,text[],text,boolean,text,text)',
    'public.update_medication(uuid,uuid,text,text,text[],text,boolean,text,integer)',
    'public.delete_medication(uuid,uuid)',
    'public.list_medications(uuid,boolean,integer)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- App-wide anon lockdown (this migration added public functions). Supabase
-- default privileges re-grant EXECUTE to PUBLIC/anon on every new function, so
-- re-revoke and re-grant only the one legitimately anon-callable function.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
