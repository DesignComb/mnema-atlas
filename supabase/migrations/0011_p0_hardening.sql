-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — 0011 P0 multi-tenant hardening
-- Make the "all writes go through the SECURITY DEFINER RPC" story an ENFORCED
-- control (not a convention), lock down api_keys, add per-user row quotas and
-- DB-level input caps. The UI + Worker already write exclusively via RPCs, so
-- this is invisible to current users — it only blocks a hand-crafted direct
-- write with the publishable key.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Enforce the shared write path ──────────────────────────────────────
-- Drop the direct INSERT/UPDATE/DELETE RLS policies (keep _select). With RLS on
-- and no permissive write policy, ONLY the SECURITY DEFINER RPCs (which bypass
-- RLS) can write. No app code does direct table writes except revokeApiKey,
-- which is rerouted to an RPC below.
do $$
declare t text;
begin
  foreach t in array array[
    'decks','notes','cards','note_links','review_logs',
    'itineraries','itinerary_days','itinerary_items','share_links','itinerary_members'
  ]
  loop
    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);
  end loop;
end;
$$;

-- ── 2) Lock down api_keys ─────────────────────────────────────────────────
drop policy if exists api_keys_insert on public.api_keys;
drop policy if exists api_keys_update on public.api_keys;
drop policy if exists api_keys_delete on public.api_keys;
-- Hide the hash even from the owner (defense in depth; the owner can't use it).
-- A column REVOKE can't subtract from a table-level SELECT grant, so revoke the
-- table grant and re-grant only the safe columns. listApiKeys selects exactly
-- these, so this breaks nothing.
revoke select on public.api_keys from authenticated;
grant select (id, user_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at)
  on public.api_keys to authenticated;

-- Revoke now goes through an RPC (was a direct UPDATE from the browser).
create or replace function public.revoke_api_key(p_user_id uuid, p_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_n int;
begin
  update public.api_keys set revoked_at = now()
   where id = p_id and user_id = v_uid and revoked_at is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ── 3) Per-user row quotas (enforced by trigger, so any write path is capped) ──
create or replace function app.enforce_row_quota()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_cap   int  := tg_argv[0]::int;
  v_col   text := tg_argv[1];
  v_owner uuid := (to_jsonb(new) ->> v_col)::uuid;
  v_count bigint;
begin
  execute format('select count(*) from public.%I where %I = $1', tg_table_name, v_col)
    into v_count using v_owner;
  if v_count >= v_cap then
    raise exception '% limit reached (max % per user)', tg_table_name, v_cap using errcode = '53400';
  end if;
  return new;
end;
$$;

do $$
declare r record;
begin
  for r in
    select * from (values
      ('notes','user_id','20000'),
      ('cards','user_id','200000'),
      ('decks','user_id','2000'),
      ('itineraries','owner_id','2000'),
      ('api_keys','user_id','50')
    ) as v(tbl, col, cap)
  loop
    execute format('drop trigger if exists %1$s_quota on public.%1$s;', r.tbl);
    execute format(
      'create trigger %1$s_quota before insert on public.%1$s for each row execute function app.enforce_row_quota(%2$L, %3$L);',
      r.tbl, r.cap, r.col);
  end loop;
end;
$$;

-- ── 4) DB-level input caps (mirror the zod limits; NOT VALID = enforce new writes
--       without re-checking existing rows). Stops a direct RPC caller bypassing
--       the worker's zod validation. ──
do $$
declare r record;
begin
  for r in
    select * from (values
      ('notes','notes_body_len','char_length(body) <= 100000'),
      ('notes','notes_title_len','char_length(title) <= 300'),
      ('cards','cards_front_len','char_length(front) <= 8000'),
      ('cards','cards_back_len','char_length(back) <= 8000'),
      ('decks','decks_name_len','char_length(name) <= 120'),
      ('itineraries','itin_title_len','char_length(title) <= 300'),
      ('itineraries','itin_notes_len','notes is null or char_length(notes) <= 20000'),
      ('itinerary_items','item_title_len','char_length(title) <= 300'),
      ('itinerary_items','item_notes_len','notes is null or char_length(notes) <= 5000')
    ) as r(tbl, cname, expr)
  loop
    execute format('alter table public.%I drop constraint if exists %I;', r.tbl, r.cname);
    execute format('alter table public.%I add constraint %I check (%s) not valid;', r.tbl, r.cname, r.expr);
  end loop;
end;
$$;

-- ── 5) Grants + anon re-hardening (new public function added) ──
revoke all on function public.revoke_api_key(uuid, uuid) from public;
grant execute on function public.revoke_api_key(uuid, uuid) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
