-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — 0010 Collaborator co-editing (P4)
-- Invite other users to view/edit a trip. The hard constraint: do NOT loosen
-- app.resolve_uid (that would let anyone act as anyone, app-wide). Instead we
-- AUTHORIZE via membership: write RPCs resolve the caller's TRUE id (v_actor),
-- check app.can_access_itinerary(itinerary_id, v_actor, need_edit), and write
-- child rows tagged with the TRIP OWNER's owner_id (derived from the parent),
-- recording v_actor only as created_by. Reads open up via membership-aware
-- SELECT policies + an access-gated get_itinerary.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.itinerary_members (
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'viewer' check (role in ('viewer', 'editor')),
  added_by     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (itinerary_id, user_id)
);
create index if not exists itinerary_members_user_idx on public.itinerary_members (user_id, itinerary_id);

-- ── Access helper (SECURITY DEFINER so it bypasses RLS → no policy recursion) ──
create or replace function app.can_access_itinerary(p_itinerary_id uuid, p_uid uuid, p_need_edit boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    p_uid is not null
    and (
      exists (select 1 from public.itineraries i where i.id = p_itinerary_id and i.owner_id = p_uid)
      or exists (
        select 1 from public.itinerary_members m
         where m.itinerary_id = p_itinerary_id
           and m.user_id = p_uid
           and (not p_need_edit or m.role = 'editor')
      )
    );
$$;

grant usage on schema app to authenticated, service_role;
grant execute on function app.can_access_itinerary(uuid, uuid, boolean) to authenticated, service_role;

-- ── RLS on the membership table ──
alter table public.itinerary_members enable row level security;
do $$
begin
  execute 'drop policy if exists itinerary_members_select on public.itinerary_members';
  -- You can see membership rows for trips you belong to or own. Writes are RPC-only.
  execute 'create policy itinerary_members_select on public.itinerary_members for select to authenticated using (user_id = (select auth.uid()) or app.can_access_itinerary(itinerary_id, (select auth.uid()), false))';
end;
$$;

-- ── Open up SELECT on the trip tree to collaborators (reads only; writes stay RPC) ──
do $$
begin
  execute 'drop policy if exists itineraries_select on public.itineraries';
  execute 'create policy itineraries_select on public.itineraries for select to authenticated using ((select auth.uid()) = owner_id or app.can_access_itinerary(id, (select auth.uid()), false))';

  execute 'drop policy if exists itinerary_days_select on public.itinerary_days';
  execute 'create policy itinerary_days_select on public.itinerary_days for select to authenticated using ((select auth.uid()) = owner_id or app.can_access_itinerary(itinerary_id, (select auth.uid()), false))';

  execute 'drop policy if exists itinerary_items_select on public.itinerary_items';
  execute 'create policy itinerary_items_select on public.itinerary_items for select to authenticated using ((select auth.uid()) = owner_id or app.can_access_itinerary(itinerary_id, (select auth.uid()), false))';
end;
$$;

-- ═══════════════════ RE-EMITTED WRITE RPCs (authorize via membership) ═══════════════════
-- All keep the SAME signatures as 0008 (CREATE OR REPLACE preserves grants), but
-- authorize via can_access_itinerary on the caller's TRUE id and derive owner_id
-- from the parent trip. delete_itinerary / create_itinerary / create_trip_bulk
-- stay owner-only (the latter two create the caller's OWN trip).

create or replace function public.update_itinerary(
  p_user_id uuid, p_itinerary_id uuid,
  p_title text default null, p_destination text default null,
  p_start_date date default null, p_end_date date default null,
  p_timezone text default null, p_default_currency text default null,
  p_cover_url text default null, p_notes text default null
)
returns public.itineraries
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_row public.itineraries;
begin
  if not exists (select 1 from public.itineraries where id = p_itinerary_id) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  if not app.can_access_itinerary(p_itinerary_id, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.itineraries set
    title            = coalesce(p_title, title),
    destination      = coalesce(p_destination, destination),
    start_date       = coalesce(p_start_date, start_date),
    end_date         = coalesce(p_end_date, end_date),
    timezone         = coalesce(p_timezone, timezone),
    default_currency = coalesce(p_default_currency, default_currency),
    cover_url        = coalesce(p_cover_url, cover_url),
    notes            = coalesce(p_notes, notes)
  where id = p_itinerary_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.create_day(
  p_user_id uuid, p_itinerary_id uuid,
  p_day_date date default null, p_label text default null,
  p_sort_order integer default 0, p_created_via text default 'ui'
)
returns public.itinerary_days
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_owner uuid;
  v_row public.itinerary_days;
begin
  select owner_id into v_owner from public.itineraries where id = p_itinerary_id;
  if not found then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(p_itinerary_id, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.itinerary_days (itinerary_id, owner_id, day_date, label, sort_order, created_via)
  values (p_itinerary_id, v_owner, p_day_date, p_label, coalesce(p_sort_order, 0), p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_day(
  p_user_id uuid, p_day_id uuid,
  p_day_date date default null, p_label text default null, p_sort_order integer default null
)
returns public.itinerary_days
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_itin uuid;
  v_row public.itinerary_days;
begin
  select itinerary_id into v_itin from public.itinerary_days where id = p_day_id;
  if not found then raise exception 'day not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.itinerary_days set
    day_date   = coalesce(p_day_date, day_date),
    label      = coalesce(p_label, label),
    sort_order = coalesce(p_sort_order, sort_order)
  where id = p_day_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_day(p_user_id uuid, p_day_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_itin uuid;
  v_n int;
begin
  select itinerary_id into v_itin from public.itinerary_days where id = p_day_id;
  if v_itin is null then return false; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.itinerary_days where id = p_day_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.reorder_days(p_user_id uuid, p_itinerary_id uuid, p_day_ids jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_id text;
  v_i int := 0;
begin
  if not exists (select 1 from public.itineraries where id = p_itinerary_id) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  if not app.can_access_itinerary(p_itinerary_id, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for v_id in select * from jsonb_array_elements_text(coalesce(p_day_ids, '[]'::jsonb))
  loop
    update public.itinerary_days set sort_order = v_i
     where id = v_id::uuid and itinerary_id = p_itinerary_id;
    v_i := v_i + 1;
  end loop;
  return true;
end;
$$;

create or replace function public.create_item(
  p_user_id uuid, p_title text,
  p_day_id uuid default null, p_itinerary_id uuid default null,
  p_place text default null, p_lat double precision default null, p_lng double precision default null,
  p_category text default 'other', p_start_time time default null, p_end_time time default null,
  p_end_day_offset integer default 0, p_transport_mode text default null, p_transport_detail text default null,
  p_cost numeric default null, p_currency text default null, p_booking_url text default null,
  p_booking_ref text default null, p_notes text default null, p_sort_order integer default 0,
  p_created_via text default 'ui'
)
returns public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_itin uuid;
  v_owner uuid;
  v_currency text;
  v_row public.itinerary_items;
begin
  if p_day_id is not null then
    select itinerary_id into v_itin from public.itinerary_days where id = p_day_id;
    if v_itin is null then raise exception 'day not found' using errcode = 'P0002'; end if;
  elsif p_itinerary_id is not null then
    if not exists (select 1 from public.itineraries where id = p_itinerary_id) then
      raise exception 'itinerary not found' using errcode = 'P0002';
    end if;
    v_itin := p_itinerary_id;
  else
    raise exception 'day_id or itinerary_id is required' using errcode = '22023';
  end if;

  if not app.can_access_itinerary(v_itin, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select owner_id into v_owner from public.itineraries where id = v_itin;
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
    p_day_id, v_itin, v_owner, v_actor, p_title, p_place, p_lat, p_lng, coalesce(nullif(p_category, ''), 'other'),
    p_start_time, p_end_time, coalesce(p_end_day_offset, 0), p_transport_mode, p_transport_detail,
    p_cost, v_currency, p_booking_url, p_booking_ref, p_notes, coalesce(p_sort_order, 0), p_created_via
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_item(
  p_user_id uuid, p_item_id uuid,
  p_title text default null, p_place text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_category text default null, p_start_time time default null, p_end_time time default null,
  p_end_day_offset integer default null, p_transport_mode text default null, p_transport_detail text default null,
  p_cost numeric default null, p_currency text default null, p_booking_url text default null,
  p_booking_ref text default null, p_notes text default null, p_sort_order integer default null,
  p_expected_updated_at timestamptz default null
)
returns public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_itin uuid;
  v_cur timestamptz;
  v_row public.itinerary_items;
begin
  select itinerary_id, updated_at into v_itin, v_cur from public.itinerary_items where id = p_item_id;
  if v_itin is null then raise exception 'item not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_expected_updated_at is not null and v_cur <> p_expected_updated_at then
    raise exception 'item was modified by someone else' using errcode = '40001';
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
  where id = p_item_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_item(p_user_id uuid, p_item_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_itin uuid;
  v_n int;
begin
  select itinerary_id into v_itin from public.itinerary_items where id = p_item_id;
  if v_itin is null then return false; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.itinerary_items where id = p_item_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.set_item_location(
  p_user_id uuid, p_item_id uuid, p_lat double precision, p_lng double precision
)
returns public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_itin uuid;
  v_row public.itinerary_items;
begin
  select itinerary_id into v_itin from public.itinerary_items where id = p_item_id;
  if v_itin is null then raise exception 'item not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.itinerary_items set lat = p_lat, lng = p_lng where id = p_item_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.set_item_day(p_user_id uuid, p_item_id uuid, p_day_id uuid)
returns public.itinerary_items
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_itin uuid;
  v_row public.itinerary_items;
begin
  select itinerary_id into v_itin from public.itinerary_items where id = p_item_id;
  if v_itin is null then raise exception 'item not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_day_id is not null
     and not exists (select 1 from public.itinerary_days where id = p_day_id and itinerary_id = v_itin) then
    raise exception 'target day not found in this itinerary' using errcode = 'P0002';
  end if;
  update public.itinerary_items set day_id = p_day_id where id = p_item_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.reorder_items(p_user_id uuid, p_day_id uuid, p_item_ids jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_id text;
  v_i int := 0;
begin
  for v_id in select * from jsonb_array_elements_text(coalesce(p_item_ids, '[]'::jsonb))
  loop
    -- Per-row authorization so this works for a day OR the unscheduled bucket.
    update public.itinerary_items set sort_order = v_i
     where id = v_id::uuid
       and day_id is not distinct from p_day_id
       and app.can_access_itinerary(itinerary_id, v_actor, true);
    v_i := v_i + 1;
  end loop;
  return true;
end;
$$;

-- Access-gated whole-tree read (collaborators included). Adds owner_id so the UI
-- can gate owner-only actions. Sub-selects scope by itinerary_id (NOT owner_id).
create or replace function public.get_itinerary(p_user_id uuid, p_id uuid)
returns jsonb
language plpgsql security definer stable set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_result jsonb;
begin
  if not app.can_access_itinerary(p_id, v_uid, false) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  select jsonb_build_object(
    'id', it.id,
    'owner_id', it.owner_id,
    'my_role', case
      when it.owner_id = v_uid then 'owner'
      when exists (
        select 1 from public.itinerary_members m
         where m.itinerary_id = it.id and m.user_id = v_uid and m.role = 'editor'
      ) then 'editor'
      else 'viewer'
    end,
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
          'id', d.id, 'day_date', d.day_date, 'label', d.label, 'sort_order', d.sort_order,
          'items', coalesce((
            select jsonb_agg(public.itinerary_item_json(i) order by i.sort_order, i.start_time nulls last)
              from public.itinerary_items i where i.day_id = d.id
          ), '[]'::jsonb)
        )
        order by d.sort_order, d.day_date nulls last
      )
        from public.itinerary_days d where d.itinerary_id = it.id
    ), '[]'::jsonb),
    'unscheduled', coalesce((
      select jsonb_agg(public.itinerary_item_json(i) order by i.sort_order)
        from public.itinerary_items i where i.itinerary_id = it.id and i.day_id is null
    ), '[]'::jsonb),
    'cost_by_currency', coalesce((
      select jsonb_object_agg(c, total)
        from (
          select coalesce(nullif(i.currency, ''), '?') as c, sum(i.cost) as total
            from public.itinerary_items i
           where i.itinerary_id = it.id and i.cost is not null
           group by coalesce(nullif(i.currency, ''), '?')
        ) s
    ), '{}'::jsonb)
  )
  into v_result
  from public.itineraries it
  where it.id = p_id;
  if v_result is null then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  return v_result;
end;
$$;

-- ═══════════════════ MEMBER MANAGEMENT (owner-only writes) ═══════════════════
-- Invite by email — resolves email→uuid internally so the uuid never leaves the
-- DB and there's no standalone enumeration oracle (owner-only, must own the trip).
create or replace function public.add_member(p_user_id uuid, p_itinerary_id uuid, p_email text, p_role text)
returns public.itinerary_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor  uuid := app.resolve_uid(p_user_id);
  v_owner  uuid;
  v_target uuid;
  v_row    public.itinerary_members;
begin
  select owner_id into v_owner from public.itineraries where id = p_itinerary_id;
  if not found then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  if v_owner <> v_actor then raise exception 'only the owner can manage members' using errcode = '42501'; end if;
  if coalesce(p_role, 'viewer') not in ('viewer', 'editor') then
    raise exception 'role must be viewer or editor' using errcode = '22023';
  end if;
  select id into v_target from auth.users where lower(email) = lower(trim(p_email));
  if v_target is null then raise exception 'no Mnema Atlas user with that email' using errcode = 'P0002'; end if;
  if v_target = v_owner then raise exception 'the owner is already on this trip' using errcode = '22023'; end if;
  insert into public.itinerary_members (itinerary_id, user_id, role, added_by)
  values (p_itinerary_id, v_target, coalesce(p_role, 'viewer'), v_actor)
  on conflict (itinerary_id, user_id) do update set role = excluded.role
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.remove_member(p_user_id uuid, p_itinerary_id uuid, p_member_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_owner uuid;
  v_n int;
begin
  select owner_id into v_owner from public.itineraries where id = p_itinerary_id;
  if not found then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  if v_owner <> v_actor then raise exception 'only the owner can manage members' using errcode = '42501'; end if;
  delete from public.itinerary_members where itinerary_id = p_itinerary_id and user_id = p_member_user_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Any accessor (owner or member) can see the member list with display names.
create or replace function public.list_members(p_user_id uuid, p_itinerary_id uuid)
returns table (user_id uuid, display_name text, role text)
language plpgsql security definer stable set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_itinerary(p_itinerary_id, v_actor, false) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  return query
    select m.user_id, p.display_name, m.role
      from public.itinerary_members m
      left join public.profiles p on p.id = m.user_id
     where m.itinerary_id = p_itinerary_id
     order by m.created_at;
end;
$$;

-- ═══════════════════ GRANTS (new functions) + anon re-hardening ═══════════════════
do $$
declare f text;
begin
  foreach f in array array[
    'public.add_member(uuid,uuid,text,text)',
    'public.remove_member(uuid,uuid,uuid)',
    'public.list_members(uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- New functions inherit default privileges; re-run the anon hardening (0009) so
-- the anon surface stays exactly get_shared_itinerary.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;

-- ── Realtime: let collaborators see live edits (best-effort) ──
do $$
begin
  alter publication supabase_realtime add table public.itinerary_items;
exception when others then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.itinerary_days;
exception when others then null;
end;
$$;
