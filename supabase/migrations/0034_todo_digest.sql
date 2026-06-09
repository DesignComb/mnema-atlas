-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0034 · Daily to-do digest push (每日待辦提醒)                                 ║
-- ║                                                                            ║
-- ║ Once a day, at a per-user local time, push "你今天有 N 件待辦". Mirrors the   ║
-- ║ 0031 daily-review pattern: digest_prefs = opt-in + time + tz; todo_digests  ║
-- ║ = one row/day idempotency ledger. The cron finder self-gates on the user's  ║
-- ║ local clock so it can ride the existing per-minute reminder sweep (no new    ║
-- ║ pg_cron job). Single-owner, RPC-only writes.                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists public.digest_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  is_enabled  boolean not null default false,
  digest_time time not null default '08:00',
  tz          text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.todo_digests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  digest_date date not null,
  created_at  timestamptz not null default now(),
  constraint todo_digests_user_date_unique unique (user_id, digest_date)
);
create index if not exists todo_digests_user_idx on public.todo_digests (user_id, digest_date desc);

drop trigger if exists digest_prefs_updated_at on public.digest_prefs;
create trigger digest_prefs_updated_at before update on public.digest_prefs
  for each row execute function app.set_updated_at();
drop trigger if exists todo_digests_quota on public.todo_digests;
create trigger todo_digests_quota before insert on public.todo_digests
  for each row execute function app.enforce_row_quota('100000', 'user_id');

-- RLS (owner-only SELECT; writes via RPC only)
do $$
declare t text;
begin
  foreach t in array array['digest_prefs', 'todo_digests']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = user_id);', t);
  end loop;
end;
$$;

-- ── Prefs (owner) ─────────────────────────────────────────────────────────────
create or replace function public.set_digest_prefs(
  p_user_id uuid, p_is_enabled boolean, p_digest_time time default null, p_tz text default null
)
returns public.digest_prefs language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.digest_prefs;
begin
  insert into public.digest_prefs (user_id, is_enabled, digest_time, tz)
  values (v_uid, coalesce(p_is_enabled, false), coalesce(p_digest_time, '08:00'), p_tz)
  on conflict (user_id) do update set
    is_enabled  = coalesce(p_is_enabled, public.digest_prefs.is_enabled),
    digest_time = coalesce(p_digest_time, public.digest_prefs.digest_time),
    tz          = coalesce(p_tz, public.digest_prefs.tz)
  returning * into v_row;
  return v_row;
end;
$$;

-- ── Cron-only (service_role): users whose local time has reached digest_time ───
-- today and who haven't been sent a digest today, with today's open task count.
create or replace function public.due_todo_digests_for_cron()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.user_id,
      'count', (
        select count(*) from public.tasks t
        where t.user_id = p.user_id and t.status = 'todo' and t.kind <> 'habit'
          and ((t.due_date is not null and t.due_date <= (now() at time zone coalesce(p.tz, 'UTC'))::date)
               or t.scheduled_date = (now() at time zone coalesce(p.tz, 'UTC'))::date)
      ),
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s where s.user_id = p.user_id), '[]'::jsonb)
    ))
    from public.digest_prefs p
    where p.is_enabled
      and (now() at time zone coalesce(p.tz, 'UTC'))::time >= p.digest_time
      and not exists (
        select 1 from public.todo_digests d
        where d.user_id = p.user_id and d.digest_date = (now() at time zone coalesce(p.tz, 'UTC'))::date
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.mark_todo_digest_sent(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_tz text; v_date date; v_n int;
begin
  select tz into v_tz from public.digest_prefs where user_id = v_uid;
  v_date := (now() at time zone coalesce(v_tz, 'UTC'))::date;
  insert into public.todo_digests (user_id, digest_date) values (v_uid, v_date)
  on conflict (user_id, digest_date) do nothing;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_digest_prefs(uuid,boolean,time,text)',
    'public.mark_todo_digest_sent(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;
-- Cron-only: service_role exclusively.
revoke all on function public.due_todo_digests_for_cron() from public, anon, authenticated;
grant execute on function public.due_todo_digests_for_cron() to service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
