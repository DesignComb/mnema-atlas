-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0024 · Captures (暫存區 / quick-capture inbox)                              ║
-- ║                                                                            ║
-- ║ A space-agnostic staging pool. You jot a raw line on the go ("原神 深淵    ║
-- ║ 6/16"); later your own AI reads the pending pile, interprets each one,     ║
-- ║ asks the few questions it genuinely needs, files it into the right space   ║
-- ║ (task / note / trip / transaction…) and marks the capture resolved.        ║
-- ║                                                                            ║
-- ║ On-thesis: the app stores the raw thought + the link to what it became;    ║
-- ║ the conversation & judgement live in the user's BYO-AI, not in-app.        ║
-- ║                                                                            ║
-- ║ Same security spine as the rest of the app: owner-only RLS SELECT, every   ║
-- ║ write through a SECURITY DEFINER RPC that stamps the resolved user_id.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists public.captures (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  raw_text      text not null check (char_length(raw_text) between 1 and 5000),
  status        text not null default 'pending' check (status in ('pending', 'processed', 'dismissed')),
  source        text not null default 'ui' check (source in ('ui', 'share', 'rest', 'mcp')),
  resolved_kind text,                          -- what it became: 'task' | 'note' | 'transaction' | 'itinerary' | …
  resolved_ref  jsonb,                         -- { id, title, space } of the created item, for back-linking
  note          text check (note is null or char_length(note) <= 2000),  -- optional AI/user annotation
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  processed_at  timestamptz
);
create index if not exists captures_user_status_idx on public.captures (user_id, status, created_at desc);

drop trigger if exists captures_updated_at on public.captures;
create trigger captures_updated_at before update on public.captures
  for each row execute function app.set_updated_at();

-- ── RLS: owner-only SELECT; writes via RPC only ───────────────────────────────
alter table public.captures enable row level security;
drop policy if exists captures_select on public.captures;
create policy captures_select on public.captures
  for select to authenticated using ((select auth.uid()) = user_id);

-- ── Per-user cap: keep a runaway capture loop from filling the table ──────────
create or replace function app.assert_capture_quota(p_uid uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_pending int;
begin
  select count(*) into v_pending from public.captures where user_id = p_uid and status = 'pending';
  if v_pending >= 500 then
    raise exception 'too many pending captures (process or clear some first)' using errcode = 'P0001';
  end if;
end;
$$;

-- ── Writes (SECURITY DEFINER; stamp the resolved uid) ─────────────────────────
create or replace function public.create_capture(
  p_user_id uuid, p_raw_text text, p_source text default 'ui'
)
returns public.captures language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.captures;
begin
  perform app.assert_capture_quota(v_uid);
  insert into public.captures (user_id, raw_text, source)
  values (v_uid, p_raw_text, coalesce(nullif(p_source, ''), 'ui'))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.list_captures(
  p_user_id uuid, p_status text default 'pending', p_limit integer default 100
)
returns setof public.captures language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.captures
    where user_id = v_uid
      and (p_status is null or p_status = 'all' or status = p_status)
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

create or replace function public.resolve_capture(
  p_user_id uuid, p_capture_id uuid,
  p_resolved_kind text default null, p_resolved_ref jsonb default null, p_note text default null
)
returns public.captures language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.captures;
begin
  update public.captures set
    status        = 'processed',
    resolved_kind = coalesce(p_resolved_kind, resolved_kind),
    resolved_ref  = coalesce(p_resolved_ref, resolved_ref),
    note          = coalesce(p_note, note),
    processed_at  = now()
  where id = p_capture_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'capture not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.dismiss_capture(p_user_id uuid, p_capture_id uuid)
returns public.captures language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.captures;
begin
  update public.captures set status = 'dismissed', processed_at = now()
  where id = p_capture_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'capture not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.reopen_capture(p_user_id uuid, p_capture_id uuid)
returns public.captures language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.captures;
begin
  update public.captures set status = 'pending', processed_at = null
  where id = p_capture_id and user_id = v_uid returning * into v_row;
  if v_row.id is null then raise exception 'capture not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_capture(p_user_id uuid, p_capture_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.captures where id = p_capture_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── Grants: callable by the owner (authenticated) and the Worker (service) ────
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_capture(uuid,text,text)',
    'public.list_captures(uuid,text,integer)',
    'public.resolve_capture(uuid,uuid,text,jsonb,text)',
    'public.dismiss_capture(uuid,uuid)',
    'public.reopen_capture(uuid,uuid)',
    'public.delete_capture(uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- app.assert_capture_quota is an internal helper — service-side only, never anon.
revoke all on function app.assert_capture_quota(uuid) from public, anon, authenticated;
grant execute on function app.assert_capture_quota(uuid) to service_role;

-- App-wide anon lockdown (this migration added public functions). Re-grant only
-- the one legitimately anon-callable function.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
