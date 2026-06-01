-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — 0009 Public share links (P3: read-only sharing)
-- A trip owner mints an unguessable token; anyone with the link can VIEW the
-- trip read-only. This is the ONLY anon-callable path in the whole app:
-- get_shared_itinerary is SECURITY DEFINER and granted to anon, returns exactly
-- one itinerary by token, and NEVER echoes owner_id / created_by / email / other
-- trips. All other functions stay authenticated/service_role only.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.share_links (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  can_edit     boolean not null default false,   -- reserved; P3 links are read-only
  hide_costs   boolean not null default false,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists share_links_itinerary_idx on public.share_links (itinerary_id);
create index if not exists share_links_owner_idx     on public.share_links (owner_id);

-- Owner-only RLS (never anon). The public read path is the definer RPC below,
-- NOT a table policy.
alter table public.share_links enable row level security;
do $$
begin
  execute 'drop policy if exists share_links_select on public.share_links';
  execute 'drop policy if exists share_links_insert on public.share_links';
  execute 'drop policy if exists share_links_update on public.share_links';
  execute 'drop policy if exists share_links_delete on public.share_links';
  execute 'create policy share_links_select on public.share_links for select to authenticated using ((select auth.uid()) = owner_id)';
  execute 'create policy share_links_insert on public.share_links for insert to authenticated with check ((select auth.uid()) = owner_id)';
  execute 'create policy share_links_update on public.share_links for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)';
  execute 'create policy share_links_delete on public.share_links for delete to authenticated using ((select auth.uid()) = owner_id)';
end;
$$;

-- ── Owner management RPCs (authenticated/service_role only) ──
create or replace function public.create_share_link(
  p_user_id uuid,
  p_itinerary_id uuid,
  p_hide_costs boolean default false,
  p_expires_at timestamptz default null
)
returns public.share_links
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := app.resolve_uid(p_user_id);
  v_token text;
  v_row   public.share_links;
begin
  if not exists (select 1 from public.itineraries where id = p_itinerary_id and owner_id = v_uid) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  v_token := 'shr_' || translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.share_links (token, itinerary_id, owner_id, hide_costs, expires_at)
  values (v_token, p_itinerary_id, v_uid, coalesce(p_hide_costs, false), p_expires_at)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.revoke_share_link(p_user_id uuid, p_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_n int;
begin
  update public.share_links set revoked_at = now()
   where id = p_id and owner_id = v_uid and revoked_at is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.list_share_links(p_user_id uuid, p_itinerary_id uuid)
returns setof public.share_links
language plpgsql security definer stable set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.share_links
     where itinerary_id = p_itinerary_id and owner_id = v_uid
     order by created_at desc;
end;
$$;

-- ── Public item shape: strips nothing PII (itinerary_item_json already omits
-- owner_id/created_by) but optionally drops cost/currency/booking_ref. ──
create or replace function public.itinerary_item_public_json(i public.itinerary_items, p_hide_costs boolean)
returns jsonb
language sql immutable set search_path = ''
as $$
  select case
    when p_hide_costs then public.itinerary_item_json(i) - 'cost' - 'currency' - 'booking_ref'
    else public.itinerary_item_json(i)
  end;
$$;

-- ── The ONLY anon-callable function. Resolves a token → one trip's tree,
-- scoped strictly by itinerary_id (never auth.uid()/owner_id). Returns null for
-- a missing/revoked/expired token (no oracle). Never returns owner_id/email. ──
create or replace function public.get_shared_itinerary(p_token text)
returns jsonb
language plpgsql security definer stable set search_path = ''
as $$
declare
  v_link   public.share_links;
  v_result jsonb;
begin
  select * into v_link
    from public.share_links
   where token = p_token
     and revoked_at is null
     and (expires_at is null or expires_at > now());
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'id', it.id,
    'title', it.title,
    'destination', it.destination,
    'start_date', it.start_date,
    'end_date', it.end_date,
    'timezone', it.timezone,
    'default_currency', it.default_currency,
    'notes', it.notes,
    'hide_costs', v_link.hide_costs,
    'days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'day_date', d.day_date,
          'label', d.label,
          'sort_order', d.sort_order,
          'items', coalesce((
            select jsonb_agg(public.itinerary_item_public_json(i, v_link.hide_costs)
                             order by i.sort_order, i.start_time nulls last)
              from public.itinerary_items i
             where i.day_id = d.id
          ), '[]'::jsonb)
        )
        order by d.sort_order, d.day_date nulls last
      )
        from public.itinerary_days d
       where d.itinerary_id = it.id
    ), '[]'::jsonb),
    'unscheduled', coalesce((
      select jsonb_agg(public.itinerary_item_public_json(i, v_link.hide_costs) order by i.sort_order)
        from public.itinerary_items i
       where i.itinerary_id = it.id and i.day_id is null
    ), '[]'::jsonb),
    'cost_by_currency', case
      when v_link.hide_costs then '{}'::jsonb
      else coalesce((
        select jsonb_object_agg(c, total)
          from (
            select coalesce(nullif(i.currency, ''), '?') as c, sum(i.cost) as total
              from public.itinerary_items i
             where i.itinerary_id = it.id and i.cost is not null
             group by coalesce(nullif(i.currency, ''), '?')
          ) s
      ), '{}'::jsonb)
    end
  )
  into v_result
  from public.itineraries it
  where it.id = v_link.itinerary_id;

  return v_result;
end;
$$;

-- ═══════════════════════ GRANTS ═══════════════════════
do $$
declare f text;
begin
  -- Owner-only management + the internal public-json helper.
  foreach f in array array[
    'public.create_share_link(uuid,uuid,boolean,timestamptz)',
    'public.revoke_share_link(uuid,uuid)',
    'public.list_share_links(uuid,uuid)',
    'public.itinerary_item_public_json(public.itinerary_items,boolean)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- The single deliberate anon grant — token-scoped, PII-free.
revoke all on function public.get_shared_itinerary(text) from public;
grant execute on function public.get_shared_itinerary(text) to anon, authenticated, service_role;

-- ── Harden the anon surface (app-wide) ────────────────────────────────────
-- Supabase's DEFAULT PRIVILEGES auto-grant EXECUTE on every public function to
-- the named `anon` role. The existing migrations only `revoke ... from public`,
-- which does NOT remove that named-role grant — so anon could reach the
-- resolve_uid RPCs, which trust p_user_id whenever auth.uid() is null (true for
-- anon, not just service_role). Strip anon from ALL public functions, stop
-- future functions from auto-granting it, then re-grant ONLY the public share
-- read. Authenticated + service_role keep their grants. (Re-run this revoke at
-- the end of any later migration that adds functions.)
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
