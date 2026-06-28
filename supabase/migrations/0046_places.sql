-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0046 · Places — "想去的店 & 景點" wishlist (Travel space)                    ║
-- ║                                                                            ║
-- ║ A standalone, cross-trip wishlist of shops & sights the user wants to       ║
-- ║ visit, classified by free-form tags (台南東區 / 友愛街附近 / 甜點…). NOT    ║
-- ║ tied to any itinerary — itinerary_items.place is an activity inside one     ║
-- ║ trip; this is the "places I'd like to go someday" list.                     ║
-- ║                                                                            ║
-- ║ Single-owner (personal), same security spine as Kitchen (0028): owner-      ║
-- ║ only RLS SELECT, every write through a SECURITY DEFINER RPC that stamps      ║
-- ║ the resolved user_id. Tags are a text[] (same model as notes/cards).        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 1) Table ────────────────────────────────────────────────────────────────
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  tags        text[] not null default '{}',
  note        text check (note is null or char_length(note) <= 2000),
  url         text check (url is null or char_length(url) <= 2000),     -- maps / IG / 官網
  address     text check (address is null or char_length(address) <= 300),
  visited     boolean not null default false,
  created_via text not null default 'ui' check (created_via in ('ui','rest','mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists places_user_idx on public.places (user_id, created_at desc);
create index if not exists places_tags_idx on public.places using gin (tags);

-- ── 2) RLS: owner-only SELECT; all writes go through the RPCs below ────────────
alter table public.places enable row level security;
drop policy if exists places_select on public.places;
create policy places_select on public.places
  for select to authenticated using ((select auth.uid()) = user_id);

-- ── 3) RPCs (SECURITY DEFINER, fully-qualified, resolve_uid first) ────────────
create or replace function public.create_place(
  p_user_id uuid, p_name text,
  p_tags text[] default null, p_note text default null, p_url text default null,
  p_address text default null, p_visited boolean default false,
  p_created_via text default 'ui'
)
returns public.places language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.places;
begin
  insert into public.places (user_id, name, tags, note, url, address, visited, created_via)
  values (
    v_uid, p_name, coalesce(p_tags, '{}'), nullif(p_note, ''), nullif(p_url, ''),
    nullif(p_address, ''), coalesce(p_visited, false), coalesce(nullif(p_created_via, ''), 'ui')
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_place(
  p_user_id uuid, p_place_id uuid,
  p_name text default null, p_tags text[] default null, p_note text default null,
  p_url text default null, p_address text default null, p_visited boolean default null
)
returns public.places language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.places;
begin
  update public.places set
    name       = coalesce(nullif(p_name, ''), name),
    tags       = coalesce(p_tags, tags),
    note       = coalesce(nullif(p_note, ''), note),
    url        = coalesce(nullif(p_url, ''), url),
    address    = coalesce(nullif(p_address, ''), address),
    visited    = coalesce(p_visited, visited),
    updated_at = now()
  where id = p_place_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'place not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_place(p_user_id uuid, p_place_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.places where id = p_place_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.list_places(
  p_user_id uuid, p_query text default null, p_tag text default null,
  p_visited boolean default null, p_limit integer default 200
)
returns setof public.places language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.places
    where user_id = v_uid
      and (p_query is null or p_query = '' or name ilike '%' || p_query || '%')
      and (p_tag is null or p_tag = '' or tags @> array[p_tag])
      and (p_visited is null or visited = p_visited)
    order by visited, created_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

create or replace function public.get_place(p_user_id uuid, p_place_id uuid)
returns public.places language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.places;
begin
  select * into v_row from public.places where id = p_place_id and user_id = v_uid;
  if v_row.id is null then raise exception 'place not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

-- ── 4) Grants: owner (authenticated) + Worker (service_role) ───────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_place(uuid,text,text[],text,text,text,boolean,text)',
    'public.update_place(uuid,uuid,text,text[],text,text,text,boolean)',
    'public.delete_place(uuid,uuid)',
    'public.list_places(uuid,text,text,boolean,integer)',
    'public.get_place(uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- App-wide anon lockdown (this migration added public functions). Re-revoke and
-- re-grant only the one legitimately anon-callable function.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
