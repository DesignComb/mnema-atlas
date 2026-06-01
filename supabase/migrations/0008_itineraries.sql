-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — 0008 Travel itineraries (P1: solo CRUD)
-- First-class trip tables (itineraries → itinerary_days → itinerary_items).
-- Child rows derive ownership from the parent via itinerary_id but ALSO carry a
-- denormalised owner_id for fast RLS/index — so one access check (P4) can later
-- govern the whole tree while collaborators write children without impersonation.
-- Follows the shared-write spine: every write is a SECURITY DEFINER RPC,
-- search_path='', schema-qualified, owner-scoped via app.resolve_uid, EXECUTE
-- granted only to authenticated + service_role.
-- ════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════ TABLES ═══════════════════════════
create table if not exists public.itineraries (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  destination      text,
  start_date       date,
  end_date         date,
  timezone         text,                                   -- IANA, e.g. Asia/Tokyo
  default_currency text not null default 'TWD',
  cover_url        text,
  notes            text,
  created_via      text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint itineraries_dates_chk check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.itinerary_days (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  day_date     date,
  label        text,
  sort_order   integer not null default 0,
  created_via  text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.itinerary_items (
  id               uuid primary key default gen_random_uuid(),
  -- nullable: a null day_id is an unscheduled "ideas" bucket entry. Deleting a
  -- day keeps its activities (they fall back to unscheduled), so set null.
  day_id           uuid references public.itinerary_days(id) on delete set null,
  -- server-derived from the day (never client-trusted); the ownership/access root.
  itinerary_id     uuid not null references public.itineraries(id) on delete cascade,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  created_by       uuid references auth.users(id) on delete set null,
  title            text not null,
  place            text,
  lat              double precision,
  lng              double precision,
  category         text not null default 'other' check (category in ('food', 'transport', 'sight', 'lodging', 'other')),
  start_time       time,
  end_time         time,
  end_day_offset   integer not null default 0,             -- end crosses midnight by N days
  transport_mode   text,
  transport_detail text,
  cost             numeric(12, 2),
  currency         text,
  booking_url      text,
  booking_ref      text,
  notes            text,
  sort_order       integer not null default 0,
  created_via      text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ═══════════════════════════ INDEXES ═══════════════════════════
create index if not exists itineraries_owner_idx on public.itineraries (owner_id);
create index if not exists days_itin_idx          on public.itinerary_days (itinerary_id, sort_order);
create index if not exists days_owner_idx         on public.itinerary_days (owner_id);
create index if not exists items_day_idx          on public.itinerary_items (day_id, sort_order);
create index if not exists items_itin_idx         on public.itinerary_items (itinerary_id);
create index if not exists items_owner_idx        on public.itinerary_items (owner_id);

-- ═══════════════════════════ TRIGGERS ═══════════════════════════
drop trigger if exists itineraries_updated_at on public.itineraries;
create trigger itineraries_updated_at before update on public.itineraries
  for each row execute function app.set_updated_at();
drop trigger if exists itinerary_days_updated_at on public.itinerary_days;
create trigger itinerary_days_updated_at before update on public.itinerary_days
  for each row execute function app.set_updated_at();
drop trigger if exists itinerary_items_updated_at on public.itinerary_items;
create trigger itinerary_items_updated_at before update on public.itinerary_items
  for each row execute function app.set_updated_at();

-- ═══════════════════════════ RLS ═══════════════════════════
-- Owner-scoped on owner_id (NOT user_id) — TO authenticated only. Reads go
-- straight through RLS; every write goes through the SECURITY DEFINER RPCs below.
alter table public.itineraries    enable row level security;
alter table public.itinerary_days  enable row level security;
alter table public.itinerary_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['itineraries', 'itinerary_days', 'itinerary_items']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = owner_id);', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select auth.uid()) = owner_id);', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated using ((select auth.uid()) = owner_id);', t);
  end loop;
end;
$$;

-- ═══════════════════════ WRITE RPCs ═══════════════════════

-- ── itinerary ────────────────────────────────────────────────
create or replace function public.create_itinerary(
  p_user_id uuid,
  p_title text,
  p_destination text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_timezone text default null,
  p_default_currency text default 'TWD',
  p_cover_url text default null,
  p_notes text default null,
  p_created_via text default 'ui'
)
returns public.itineraries
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.itineraries;
begin
  insert into public.itineraries (
    owner_id, title, destination, start_date, end_date, timezone, default_currency, cover_url, notes, created_via
  )
  values (
    v_uid, p_title, p_destination, p_start_date, p_end_date, p_timezone,
    coalesce(nullif(p_default_currency, ''), 'TWD'), p_cover_url, p_notes, p_created_via
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_itinerary(
  p_user_id uuid,
  p_itinerary_id uuid,
  p_title text default null,
  p_destination text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_timezone text default null,
  p_default_currency text default null,
  p_cover_url text default null,
  p_notes text default null
)
returns public.itineraries
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.itineraries;
begin
  update public.itineraries set
    title            = coalesce(p_title, title),
    destination      = coalesce(p_destination, destination),
    start_date       = coalesce(p_start_date, start_date),
    end_date         = coalesce(p_end_date, end_date),
    timezone         = coalesce(p_timezone, timezone),
    default_currency = coalesce(p_default_currency, default_currency),
    cover_url        = coalesce(p_cover_url, cover_url),
    notes            = coalesce(p_notes, notes)
  where id = p_itinerary_id and owner_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_itinerary(p_user_id uuid, p_itinerary_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_n int;
begin
  delete from public.itineraries where id = p_itinerary_id and owner_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ── day ──────────────────────────────────────────────────────
create or replace function public.create_day(
  p_user_id uuid,
  p_itinerary_id uuid,
  p_day_date date default null,
  p_label text default null,
  p_sort_order integer default 0,
  p_created_via text default 'ui'
)
returns public.itinerary_days
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.itinerary_days;
begin
  if not exists (select 1 from public.itineraries where id = p_itinerary_id and owner_id = v_uid) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  insert into public.itinerary_days (itinerary_id, owner_id, day_date, label, sort_order, created_via)
  values (p_itinerary_id, v_uid, p_day_date, p_label, coalesce(p_sort_order, 0), p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_day(
  p_user_id uuid,
  p_day_id uuid,
  p_day_date date default null,
  p_label text default null,
  p_sort_order integer default null
)
returns public.itinerary_days
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.itinerary_days;
begin
  update public.itinerary_days set
    day_date   = coalesce(p_day_date, day_date),
    label      = coalesce(p_label, label),
    sort_order = coalesce(p_sort_order, sort_order)
  where id = p_day_id and owner_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'day not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_day(p_user_id uuid, p_day_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_n int;
begin
  delete from public.itinerary_days where id = p_day_id and owner_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Set sort_order of days from a client-supplied ordered id array. Rejects ids
-- not belonging to this itinerary/owner by simply not matching them.
create or replace function public.reorder_days(p_user_id uuid, p_itinerary_id uuid, p_day_ids jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_id  text;
  v_i   int := 0;
begin
  if not exists (select 1 from public.itineraries where id = p_itinerary_id and owner_id = v_uid) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  for v_id in select * from jsonb_array_elements_text(coalesce(p_day_ids, '[]'::jsonb))
  loop
    update public.itinerary_days set sort_order = v_i
     where id = v_id::uuid and itinerary_id = p_itinerary_id and owner_id = v_uid;
    v_i := v_i + 1;
  end loop;
  return true;
end;
$$;

-- ── item ─────────────────────────────────────────────────────
create or replace function public.create_item(
  p_user_id uuid,
  p_title text,
  p_day_id uuid default null,
  p_itinerary_id uuid default null,
  p_place text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_category text default 'other',
  p_start_time time default null,
  p_end_time time default null,
  p_end_day_offset integer default 0,
  p_transport_mode text default null,
  p_transport_detail text default null,
  p_cost numeric default null,
  p_currency text default null,
  p_booking_url text default null,
  p_booking_ref text default null,
  p_notes text default null,
  p_sort_order integer default 0,
  p_created_via text default 'ui'
)
returns public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := app.resolve_uid(p_user_id);
  v_itin     uuid;
  v_currency text;
  v_row      public.itinerary_items;
begin
  -- Derive (and validate) the itinerary from the day, or accept an explicit
  -- itinerary_id for an unscheduled item.
  if p_day_id is not null then
    select itinerary_id into v_itin from public.itinerary_days where id = p_day_id and owner_id = v_uid;
    if v_itin is null then
      raise exception 'day not found' using errcode = 'P0002';
    end if;
  elsif p_itinerary_id is not null then
    if not exists (select 1 from public.itineraries where id = p_itinerary_id and owner_id = v_uid) then
      raise exception 'itinerary not found' using errcode = 'P0002';
    end if;
    v_itin := p_itinerary_id;
  else
    raise exception 'day_id or itinerary_id is required' using errcode = '22023';
  end if;

  if p_currency is null or p_currency = '' then
    select default_currency into v_currency from public.itineraries where id = v_itin;
  else
    v_currency := p_currency;
  end if;

  insert into public.itinerary_items (
    day_id, itinerary_id, owner_id, created_by, title, place, lat, lng, category,
    start_time, end_time, end_day_offset, transport_mode, transport_detail,
    cost, currency, booking_url, booking_ref, notes, sort_order, created_via
  )
  values (
    p_day_id, v_itin, v_uid, v_uid, p_title, p_place, p_lat, p_lng, coalesce(nullif(p_category, ''), 'other'),
    p_start_time, p_end_time, coalesce(p_end_day_offset, 0), p_transport_mode, p_transport_detail,
    p_cost, v_currency, p_booking_url, p_booking_ref, p_notes, coalesce(p_sort_order, 0), p_created_via
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_item(
  p_user_id uuid,
  p_item_id uuid,
  p_title text default null,
  p_place text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_category text default null,
  p_start_time time default null,
  p_end_time time default null,
  p_end_day_offset integer default null,
  p_transport_mode text default null,
  p_transport_detail text default null,
  p_cost numeric default null,
  p_currency text default null,
  p_booking_url text default null,
  p_booking_ref text default null,
  p_notes text default null,
  p_sort_order integer default null,
  p_expected_updated_at timestamptz default null
)
returns public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_cur timestamptz;
  v_row public.itinerary_items;
begin
  -- Optimistic concurrency: if the caller passes the row version it last saw and
  -- it no longer matches, refuse rather than silently clobber a co-editor.
  if p_expected_updated_at is not null then
    select updated_at into v_cur from public.itinerary_items where id = p_item_id and owner_id = v_uid;
    if not found then
      raise exception 'item not found' using errcode = 'P0002';
    end if;
    if v_cur <> p_expected_updated_at then
      raise exception 'item was modified by someone else' using errcode = '40001';
    end if;
  end if;

  update public.itinerary_items set
    title            = coalesce(p_title, title),
    place            = coalesce(p_place, place),
    lat              = coalesce(p_lat, lat),
    lng              = coalesce(p_lng, lng),
    category         = coalesce(nullif(p_category, ''), category),
    start_time       = coalesce(p_start_time, start_time),
    end_time         = coalesce(p_end_time, end_time),
    end_day_offset   = coalesce(p_end_day_offset, end_day_offset),
    transport_mode   = coalesce(p_transport_mode, transport_mode),
    transport_detail = coalesce(p_transport_detail, transport_detail),
    cost             = coalesce(p_cost, cost),
    currency         = coalesce(p_currency, currency),
    booking_url      = coalesce(p_booking_url, booking_url),
    booking_ref      = coalesce(p_booking_ref, booking_ref),
    notes            = coalesce(p_notes, notes),
    sort_order       = coalesce(p_sort_order, sort_order)
  where id = p_item_id and owner_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_item(p_user_id uuid, p_item_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_n int;
begin
  delete from public.itinerary_items where id = p_item_id and owner_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Dedicated null-capable setter for coordinates (update_item's coalesce can't clear).
create or replace function public.set_item_location(
  p_user_id uuid, p_item_id uuid, p_lat double precision, p_lng double precision
)
returns public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.itinerary_items;
begin
  update public.itinerary_items set lat = p_lat, lng = p_lng
   where id = p_item_id and owner_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Move an item to another day, or to the unscheduled bucket (p_day_id = null).
-- A non-null target day must belong to the SAME itinerary as the item.
create or replace function public.set_item_day(p_user_id uuid, p_item_id uuid, p_day_id uuid)
returns public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := app.resolve_uid(p_user_id);
  v_itin uuid;
  v_row  public.itinerary_items;
begin
  select itinerary_id into v_itin from public.itinerary_items where id = p_item_id and owner_id = v_uid;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  if p_day_id is not null
     and not exists (
       select 1 from public.itinerary_days
        where id = p_day_id and owner_id = v_uid and itinerary_id = v_itin
     ) then
    raise exception 'target day not found in this itinerary' using errcode = 'P0002';
  end if;
  update public.itinerary_items set day_id = p_day_id
   where id = p_item_id and owner_id = v_uid
  returning * into v_row;
  return v_row;
end;
$$;

-- Reorder items within a day (or within the unscheduled bucket when p_day_id is null).
create or replace function public.reorder_items(p_user_id uuid, p_day_id uuid, p_item_ids jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_id  text;
  v_i   int := 0;
begin
  if p_day_id is not null
     and not exists (select 1 from public.itinerary_days where id = p_day_id and owner_id = v_uid) then
    raise exception 'day not found' using errcode = 'P0002';
  end if;
  for v_id in select * from jsonb_array_elements_text(coalesce(p_item_ids, '[]'::jsonb))
  loop
    update public.itinerary_items set sort_order = v_i
     where id = v_id::uuid and owner_id = v_uid and day_id is not distinct from p_day_id;
    v_i := v_i + 1;
  end loop;
  return true;
end;
$$;

-- Append many items to one day in a single transaction (AI-ergonomic bulk).
create or replace function public.create_items_bulk(p_user_id uuid, p_day_id uuid, p_items jsonb)
returns setof public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_el  jsonb;
begin
  for v_el in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    return query select * from public.create_item(
      p_user_id          => v_uid,
      p_title            => coalesce(v_el ->> 'title', ''),
      p_day_id           => p_day_id,
      p_place            => v_el ->> 'place',
      p_lat              => (v_el ->> 'lat')::double precision,
      p_lng              => (v_el ->> 'lng')::double precision,
      p_category         => coalesce(v_el ->> 'category', 'other'),
      p_start_time       => (v_el ->> 'start_time')::time,
      p_end_time         => (v_el ->> 'end_time')::time,
      p_end_day_offset   => coalesce((v_el ->> 'end_day_offset')::int, 0),
      p_transport_mode   => v_el ->> 'transport_mode',
      p_transport_detail => v_el ->> 'transport_detail',
      p_cost             => (v_el ->> 'cost')::numeric,
      p_currency         => v_el ->> 'currency',
      p_booking_url      => v_el ->> 'booking_url',
      p_booking_ref      => v_el ->> 'booking_ref',
      p_notes            => v_el ->> 'notes',
      p_sort_order       => coalesce((v_el ->> 'sort_order')::int, 0),
      p_created_via      => 'ui'
    );
  end loop;
end;
$$;

-- Author a WHOLE trip (itinerary + days + nested items) in one call; returns the
-- full tree WITH generated ids (via get_itinerary) so an AI can chain edits.
create or replace function public.create_trip_bulk(p_user_id uuid, p_trip jsonb, p_created_via text default 'mcp')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := app.resolve_uid(p_user_id);
  v_itin public.itineraries;
  v_day  public.itinerary_days;
  v_d    jsonb;
  v_it   jsonb;
begin
  v_itin := public.create_itinerary(
    v_uid,
    coalesce(p_trip ->> 'title', 'Untitled trip'),
    p_trip ->> 'destination',
    (p_trip ->> 'start_date')::date,
    (p_trip ->> 'end_date')::date,
    p_trip ->> 'timezone',
    coalesce(p_trip ->> 'default_currency', 'TWD'),
    p_trip ->> 'cover_url',
    p_trip ->> 'notes',
    p_created_via
  );
  for v_d in select * from jsonb_array_elements(coalesce(p_trip -> 'days', '[]'::jsonb))
  loop
    v_day := public.create_day(
      v_uid, v_itin.id,
      (v_d ->> 'day_date')::date,
      v_d ->> 'label',
      coalesce((v_d ->> 'sort_order')::int, 0),
      p_created_via
    );
    for v_it in select * from jsonb_array_elements(coalesce(v_d -> 'items', '[]'::jsonb))
    loop
      perform public.create_item(
        p_user_id          => v_uid,
        p_title            => coalesce(v_it ->> 'title', ''),
        p_day_id           => v_day.id,
        p_place            => v_it ->> 'place',
        p_lat              => (v_it ->> 'lat')::double precision,
        p_lng              => (v_it ->> 'lng')::double precision,
        p_category         => coalesce(v_it ->> 'category', 'other'),
        p_start_time       => (v_it ->> 'start_time')::time,
        p_end_time         => (v_it ->> 'end_time')::time,
        p_end_day_offset   => coalesce((v_it ->> 'end_day_offset')::int, 0),
        p_transport_mode   => v_it ->> 'transport_mode',
        p_transport_detail => v_it ->> 'transport_detail',
        p_cost             => (v_it ->> 'cost')::numeric,
        p_currency         => v_it ->> 'currency',
        p_booking_url      => v_it ->> 'booking_url',
        p_booking_ref      => v_it ->> 'booking_ref',
        p_notes            => v_it ->> 'notes',
        p_sort_order       => coalesce((v_it ->> 'sort_order')::int, 0),
        p_created_via      => p_created_via
      );
    end loop;
  end loop;
  return public.get_itinerary(v_uid, v_itin.id);
end;
$$;

-- ═══════════════════════ AGGREGATE READ ═══════════════════════
-- Shared item→json shape, reused by get_itinerary (and the P3 public share read).
create or replace function public.itinerary_item_json(i public.itinerary_items)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id,
    'day_id', i.day_id,
    'title', i.title,
    'place', i.place,
    'lat', i.lat,
    'lng', i.lng,
    'category', i.category,
    'start_time', i.start_time,
    'end_time', i.end_time,
    'end_day_offset', i.end_day_offset,
    'transport_mode', i.transport_mode,
    'transport_detail', i.transport_detail,
    'cost', i.cost,
    'currency', i.currency,
    'booking_url', i.booking_url,
    'booking_ref', i.booking_ref,
    'notes', i.notes,
    'sort_order', i.sort_order
  );
$$;

-- Whole trip tree in one round-trip (mirrors get_graph): owner-scoped, every
-- sub-aggregate coalesced to '[]'::jsonb, plus per-currency cost rollups.
create or replace function public.get_itinerary(p_user_id uuid, p_id uuid)
returns jsonb
language plpgsql security definer stable set search_path = ''
as $$
declare
  v_uid    uuid := app.resolve_uid(p_user_id);
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', it.id,
    'title', it.title,
    'destination', it.destination,
    'start_date', it.start_date,
    'end_date', it.end_date,
    'timezone', it.timezone,
    'default_currency', it.default_currency,
    'cover_url', it.cover_url,
    'notes', it.notes,
    'created_at', it.created_at,
    'updated_at', it.updated_at,
    'days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'day_date', d.day_date,
          'label', d.label,
          'sort_order', d.sort_order,
          'items', coalesce((
            select jsonb_agg(public.itinerary_item_json(i) order by i.sort_order, i.start_time nulls last)
              from public.itinerary_items i
             where i.day_id = d.id and i.owner_id = v_uid
          ), '[]'::jsonb)
        )
        order by d.sort_order, d.day_date nulls last
      )
        from public.itinerary_days d
       where d.itinerary_id = it.id and d.owner_id = v_uid
    ), '[]'::jsonb),
    'unscheduled', coalesce((
      select jsonb_agg(public.itinerary_item_json(i) order by i.sort_order)
        from public.itinerary_items i
       where i.itinerary_id = it.id and i.day_id is null and i.owner_id = v_uid
    ), '[]'::jsonb),
    'cost_by_currency', coalesce((
      select jsonb_object_agg(c, total)
        from (
          select coalesce(nullif(i.currency, ''), '?') as c, sum(i.cost) as total
            from public.itinerary_items i
           where i.itinerary_id = it.id and i.owner_id = v_uid and i.cost is not null
           group by coalesce(nullif(i.currency, ''), '?')
        ) s
    ), '{}'::jsonb)
  )
  into v_result
  from public.itineraries it
  where it.id = p_id and it.owner_id = v_uid;

  if v_result is null then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

-- ═══════════════════════ GRANTS ═══════════════════════
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_itinerary(uuid,text,text,date,date,text,text,text,text,text)',
    'public.update_itinerary(uuid,uuid,text,text,date,date,text,text,text,text)',
    'public.delete_itinerary(uuid,uuid)',
    'public.create_day(uuid,uuid,date,text,integer,text)',
    'public.update_day(uuid,uuid,date,text,integer)',
    'public.delete_day(uuid,uuid)',
    'public.reorder_days(uuid,uuid,jsonb)',
    'public.create_item(uuid,text,uuid,uuid,text,double precision,double precision,text,time,time,integer,text,text,numeric,text,text,text,text,integer,text)',
    'public.update_item(uuid,uuid,text,text,double precision,double precision,text,time,time,integer,text,text,numeric,text,text,text,text,integer,timestamptz)',
    'public.delete_item(uuid,uuid)',
    'public.set_item_location(uuid,uuid,double precision,double precision)',
    'public.set_item_day(uuid,uuid,uuid)',
    'public.reorder_items(uuid,uuid,jsonb)',
    'public.create_items_bulk(uuid,uuid,jsonb)',
    'public.create_trip_bulk(uuid,jsonb,text)',
    'public.get_itinerary(uuid,uuid)',
    'public.itinerary_item_json(public.itinerary_items)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;
