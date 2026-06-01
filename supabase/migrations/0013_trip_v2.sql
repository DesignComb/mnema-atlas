-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — 0013 Trip model v2 (everything a trip needs)
-- Adds: trip travelers + budget; per-activity status + assignees; first-class
-- Reservations (trip_bookings: flights/lodging/transport/tickets/documents) and
-- Packing/To-dos (trip_checklist). All on the SAME security spine: membership-
-- authorized write RPCs (resolve_uid untouched, owner_id derived from the parent,
-- created_by = actor), membership-aware SELECT policies, P0 enforced write path.
-- Everything is exposed to MCP (see worker/src/tools.ts) so a user's own AI can
-- drive all of it.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Extend existing tables ─────────────────────────────────────────────
alter table public.itineraries
  add column if not exists travelers   text[] not null default '{}',
  add column if not exists budget_total numeric(12, 2);

alter table public.itinerary_items
  add column if not exists status    text not null default 'planned',
  add column if not exists assignees text[] not null default '{}';

alter table public.itinerary_items drop constraint if exists itinerary_items_status_check;
alter table public.itinerary_items
  add constraint itinerary_items_status_check
  check (status in ('idea', 'tentative', 'planned', 'done')) not valid;

-- ── 2) New tables ─────────────────────────────────────────────────────────
create table if not exists public.trip_bookings (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  type         text not null default 'other' check (type in ('flight', 'lodging', 'transport', 'ticket', 'car', 'other')),
  title        text not null,
  start_at     timestamptz,
  end_at       timestamptz,
  from_label   text,
  to_label     text,
  location     text,
  confirmation text,
  cost         numeric(12, 2),
  currency     text,
  url          text,
  notes        text,
  sort_order   integer not null default 0,
  created_via  text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists bookings_itin_idx  on public.trip_bookings (itinerary_id, start_at);
create index if not exists bookings_owner_idx on public.trip_bookings (owner_id);

create table if not exists public.trip_checklist (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  kind         text not null default 'todo' check (kind in ('packing', 'todo')),
  text         text not null,
  category     text,
  assignee     text,
  done         boolean not null default false,
  sort_order   integer not null default 0,
  created_via  text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists checklist_itin_idx  on public.trip_checklist (itinerary_id, kind, sort_order);
create index if not exists checklist_owner_idx on public.trip_checklist (owner_id);

-- updated_at triggers
drop trigger if exists trip_bookings_updated_at on public.trip_bookings;
create trigger trip_bookings_updated_at before update on public.trip_bookings
  for each row execute function app.set_updated_at();
drop trigger if exists trip_checklist_updated_at on public.trip_checklist;
create trigger trip_checklist_updated_at before update on public.trip_checklist
  for each row execute function app.set_updated_at();

-- quotas + input caps
drop trigger if exists trip_bookings_quota on public.trip_bookings;
create trigger trip_bookings_quota before insert on public.trip_bookings for each row execute function app.enforce_row_quota('20000', 'owner_id');
drop trigger if exists trip_checklist_quota on public.trip_checklist;
create trigger trip_checklist_quota before insert on public.trip_checklist for each row execute function app.enforce_row_quota('50000', 'owner_id');
alter table public.trip_bookings  drop constraint if exists booking_title_len;
alter table public.trip_bookings  add constraint booking_title_len  check (char_length(title) <= 300) not valid;
alter table public.trip_checklist drop constraint if exists checklist_text_len;
alter table public.trip_checklist add constraint checklist_text_len check (char_length(text) <= 1000) not valid;

-- ── 3) RLS (membership-aware SELECT; writes via RPC only — P0) ──
alter table public.trip_bookings  enable row level security;
alter table public.trip_checklist enable row level security;
do $$
declare t text;
begin
  foreach t in array array['trip_bookings', 'trip_checklist']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = owner_id or app.can_access_itinerary(itinerary_id, (select auth.uid()), false));',
      t);
  end loop;
end;
$$;

-- ── 4) Re-emit item JSON + add item field setters ──
create or replace function public.itinerary_item_json(i public.itinerary_items)
returns jsonb language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id, 'day_id', i.day_id, 'title', i.title, 'place', i.place,
    'lat', i.lat, 'lng', i.lng, 'category', i.category,
    'start_time', i.start_time, 'end_time', i.end_time, 'end_day_offset', i.end_day_offset,
    'transport_mode', i.transport_mode, 'transport_detail', i.transport_detail,
    'cost', i.cost, 'currency', i.currency, 'booking_url', i.booking_url,
    'booking_ref', i.booking_ref, 'notes', i.notes, 'sort_order', i.sort_order,
    'status', i.status, 'assignees', i.assignees
  );
$$;

create or replace function public.set_item_status(p_user_id uuid, p_item_id uuid, p_status text)
returns public.itinerary_items language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_itin uuid; v_row public.itinerary_items;
begin
  select itinerary_id into v_itin from public.itinerary_items where id = p_item_id;
  if v_itin is null then raise exception 'item not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.itinerary_items set status = coalesce(nullif(p_status, ''), 'planned') where id = p_item_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.set_item_assignees(p_user_id uuid, p_item_id uuid, p_assignees text[])
returns public.itinerary_items language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_itin uuid; v_row public.itinerary_items;
begin
  select itinerary_id into v_itin from public.itinerary_items where id = p_item_id;
  if v_itin is null then raise exception 'item not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.itinerary_items set assignees = coalesce(p_assignees, '{}') where id = p_item_id returning * into v_row;
  return v_row;
end;
$$;

-- ── 5) Re-emit update_itinerary (+ travelers, budget_total) ──
-- Adding params changes the signature → drop the old overload to avoid RPC ambiguity.
drop function if exists public.update_itinerary(uuid, uuid, text, text, date, date, text, text, text, text);
create or replace function public.update_itinerary(
  p_user_id uuid, p_itinerary_id uuid,
  p_title text default null, p_destination text default null,
  p_start_date date default null, p_end_date date default null,
  p_timezone text default null, p_default_currency text default null,
  p_cover_url text default null, p_notes text default null,
  p_travelers text[] default null, p_budget_total numeric default null
)
returns public.itineraries language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_row public.itineraries;
begin
  if not exists (select 1 from public.itineraries where id = p_itinerary_id) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  if not app.can_access_itinerary(p_itinerary_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.itineraries set
    title = coalesce(p_title, title), destination = coalesce(p_destination, destination),
    start_date = coalesce(p_start_date, start_date), end_date = coalesce(p_end_date, end_date),
    timezone = coalesce(p_timezone, timezone), default_currency = coalesce(p_default_currency, default_currency),
    cover_url = coalesce(p_cover_url, cover_url), notes = coalesce(p_notes, notes),
    travelers = coalesce(p_travelers, travelers), budget_total = coalesce(p_budget_total, budget_total)
  where id = p_itinerary_id returning * into v_row;
  return v_row;
end;
$$;

-- ── 6) Booking RPCs ──
create or replace function public.create_booking(
  p_user_id uuid, p_itinerary_id uuid, p_type text, p_title text,
  p_start_at timestamptz default null, p_end_at timestamptz default null,
  p_from_label text default null, p_to_label text default null, p_location text default null,
  p_confirmation text default null, p_cost numeric default null, p_currency text default null,
  p_url text default null, p_notes text default null, p_sort_order integer default 0, p_created_via text default 'ui'
)
returns public.trip_bookings language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_row public.trip_bookings;
begin
  select owner_id into v_owner from public.itineraries where id = p_itinerary_id;
  if not found then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(p_itinerary_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.trip_bookings (itinerary_id, owner_id, created_by, type, title, start_at, end_at, from_label, to_label, location, confirmation, cost, currency, url, notes, sort_order, created_via)
  values (p_itinerary_id, v_owner, v_actor, coalesce(nullif(p_type, ''), 'other'), p_title, p_start_at, p_end_at, p_from_label, p_to_label, p_location, p_confirmation, p_cost, p_currency, p_url, p_notes, coalesce(p_sort_order, 0), p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_booking(
  p_user_id uuid, p_booking_id uuid, p_type text default null, p_title text default null,
  p_start_at timestamptz default null, p_end_at timestamptz default null,
  p_from_label text default null, p_to_label text default null, p_location text default null,
  p_confirmation text default null, p_cost numeric default null, p_currency text default null,
  p_url text default null, p_notes text default null, p_sort_order integer default null
)
returns public.trip_bookings language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_itin uuid; v_row public.trip_bookings;
begin
  select itinerary_id into v_itin from public.trip_bookings where id = p_booking_id;
  if v_itin is null then raise exception 'booking not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.trip_bookings set
    type = coalesce(nullif(p_type, ''), type), title = coalesce(p_title, title),
    start_at = coalesce(p_start_at, start_at), end_at = coalesce(p_end_at, end_at),
    from_label = coalesce(p_from_label, from_label), to_label = coalesce(p_to_label, to_label),
    location = coalesce(p_location, location), confirmation = coalesce(p_confirmation, confirmation),
    cost = coalesce(p_cost, cost), currency = coalesce(p_currency, currency),
    url = coalesce(p_url, url), notes = coalesce(p_notes, notes), sort_order = coalesce(p_sort_order, sort_order)
  where id = p_booking_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_booking(p_user_id uuid, p_booking_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_itin uuid; v_n int;
begin
  select itinerary_id into v_itin from public.trip_bookings where id = p_booking_id;
  if v_itin is null then return false; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.trip_bookings where id = p_booking_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.create_bookings_bulk(p_user_id uuid, p_itinerary_id uuid, p_bookings jsonb)
returns setof public.trip_bookings language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_el jsonb;
begin
  for v_el in select * from jsonb_array_elements(coalesce(p_bookings, '[]'::jsonb))
  loop
    return query select * from public.create_booking(
      v_uid, p_itinerary_id, coalesce(v_el ->> 'type', 'other'), coalesce(v_el ->> 'title', ''),
      (v_el ->> 'start_at')::timestamptz, (v_el ->> 'end_at')::timestamptz,
      v_el ->> 'from_label', v_el ->> 'to_label', v_el ->> 'location', v_el ->> 'confirmation',
      (v_el ->> 'cost')::numeric, v_el ->> 'currency', v_el ->> 'url', v_el ->> 'notes',
      coalesce((v_el ->> 'sort_order')::int, 0), 'mcp');
  end loop;
end;
$$;

-- ── 7) Checklist RPCs ──
create or replace function public.create_checklist_item(
  p_user_id uuid, p_itinerary_id uuid, p_kind text, p_text text,
  p_category text default null, p_assignee text default null, p_sort_order integer default 0, p_created_via text default 'ui'
)
returns public.trip_checklist language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_row public.trip_checklist;
begin
  select owner_id into v_owner from public.itineraries where id = p_itinerary_id;
  if not found then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(p_itinerary_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.trip_checklist (itinerary_id, owner_id, created_by, kind, text, category, assignee, sort_order, created_via)
  values (p_itinerary_id, v_owner, v_actor, coalesce(nullif(p_kind, ''), 'todo'), p_text, p_category, p_assignee, coalesce(p_sort_order, 0), p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_checklist_item(
  p_user_id uuid, p_item_id uuid, p_text text default null, p_category text default null,
  p_done boolean default null, p_assignee text default null, p_kind text default null, p_sort_order integer default null
)
returns public.trip_checklist language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_itin uuid; v_row public.trip_checklist;
begin
  select itinerary_id into v_itin from public.trip_checklist where id = p_item_id;
  if v_itin is null then raise exception 'checklist item not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.trip_checklist set
    text = coalesce(p_text, text), category = coalesce(p_category, category),
    done = coalesce(p_done, done), assignee = coalesce(p_assignee, assignee),
    kind = coalesce(nullif(p_kind, ''), kind), sort_order = coalesce(p_sort_order, sort_order)
  where id = p_item_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_checklist_item(p_user_id uuid, p_item_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_itin uuid; v_n int;
begin
  select itinerary_id into v_itin from public.trip_checklist where id = p_item_id;
  if v_itin is null then return false; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.trip_checklist where id = p_item_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.create_checklist_bulk(p_user_id uuid, p_itinerary_id uuid, p_items jsonb)
returns setof public.trip_checklist language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_el jsonb;
begin
  for v_el in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    return query select * from public.create_checklist_item(
      v_uid, p_itinerary_id, coalesce(v_el ->> 'kind', 'todo'), coalesce(v_el ->> 'text', ''),
      v_el ->> 'category', v_el ->> 'assignee', coalesce((v_el ->> 'sort_order')::int, 0), 'mcp');
  end loop;
end;
$$;

-- ── 8) Re-emit get_itinerary (+ travelers, budget_total, bookings, checklist, budget rollup) ──
create or replace function public.get_itinerary(p_user_id uuid, p_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_result jsonb;
begin
  if not app.can_access_itinerary(p_id, v_uid, false) then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  select jsonb_build_object(
    'id', it.id, 'owner_id', it.owner_id,
    'my_role', case when it.owner_id = v_uid then 'owner'
      when exists (select 1 from public.itinerary_members m where m.itinerary_id = it.id and m.user_id = v_uid and m.role = 'editor') then 'editor'
      else 'viewer' end,
    'title', it.title, 'destination', it.destination, 'start_date', it.start_date, 'end_date', it.end_date,
    'timezone', it.timezone, 'default_currency', it.default_currency, 'cover_url', it.cover_url, 'notes', it.notes,
    'travelers', it.travelers, 'budget_total', it.budget_total,
    'created_at', it.created_at, 'updated_at', it.updated_at,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'day_date', d.day_date, 'label', d.label, 'sort_order', d.sort_order,
          'items', coalesce((select jsonb_agg(public.itinerary_item_json(i) order by i.sort_order, i.start_time nulls last)
            from public.itinerary_items i where i.day_id = d.id), '[]'::jsonb))
        order by d.sort_order, d.day_date nulls last)
      from public.itinerary_days d where d.itinerary_id = it.id), '[]'::jsonb),
    'unscheduled', coalesce((select jsonb_agg(public.itinerary_item_json(i) order by i.sort_order)
      from public.itinerary_items i where i.itinerary_id = it.id and i.day_id is null), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'type', b.type, 'title', b.title, 'start_at', b.start_at, 'end_at', b.end_at,
          'from_label', b.from_label, 'to_label', b.to_label, 'location', b.location, 'confirmation', b.confirmation,
          'cost', b.cost, 'currency', b.currency, 'url', b.url, 'notes', b.notes, 'sort_order', b.sort_order)
        order by b.start_at nulls last, b.sort_order)
      from public.trip_bookings b where b.itinerary_id = it.id), '[]'::jsonb),
    'checklist', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'text', c.text, 'category', c.category,
          'assignee', c.assignee, 'done', c.done, 'sort_order', c.sort_order)
        order by c.kind, c.sort_order)
      from public.trip_checklist c where c.itinerary_id = it.id), '[]'::jsonb),
    'cost_by_currency', coalesce((
      select jsonb_object_agg(c, total) from (
        select coalesce(nullif(currency, ''), '?') as c, sum(cost) as total from (
          select i.currency, i.cost from public.itinerary_items i where i.itinerary_id = it.id and i.cost is not null
          union all
          select b.currency, b.cost from public.trip_bookings b where b.itinerary_id = it.id and b.cost is not null
        ) all_costs group by coalesce(nullif(currency, ''), '?')
      ) s), '{}'::jsonb)
  )
  into v_result from public.itineraries it where it.id = p_id;
  if v_result is null then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  return v_result;
end;
$$;

-- ── 9) Grants + anon re-hardening ──
do $$
declare f text;
begin
  foreach f in array array[
    'public.update_itinerary(uuid,uuid,text,text,date,date,text,text,text,text,text[],numeric)',
    'public.set_item_status(uuid,uuid,text)',
    'public.set_item_assignees(uuid,uuid,text[])',
    'public.create_booking(uuid,uuid,text,text,timestamptz,timestamptz,text,text,text,text,numeric,text,text,text,integer,text)',
    'public.update_booking(uuid,uuid,text,text,timestamptz,timestamptz,text,text,text,text,numeric,text,text,text,integer)',
    'public.delete_booking(uuid,uuid)',
    'public.create_bookings_bulk(uuid,uuid,jsonb)',
    'public.create_checklist_item(uuid,uuid,text,text,text,text,integer,text)',
    'public.update_checklist_item(uuid,uuid,text,text,boolean,text,text,integer)',
    'public.delete_checklist_item(uuid,uuid)',
    'public.create_checklist_bulk(uuid,uuid,jsonb)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
