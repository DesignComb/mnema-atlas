-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0031 · AI end-of-day review (每日回顧)                                       ║
-- ║                                                                            ║
-- ║ At day's end, nudge the user to reflect — "今天如何?". Three layers, with   ║
-- ║ graceful degradation:                                                      ║
-- ║  • In-app: a review card on /today (always works, no infra) opens the      ║
-- ║    journal; it also surfaces the last day or two with no entry (catch-up).  ║
-- ║  • Push: an opt-in daily cron web-pushes enabled users who haven't         ║
-- ║    journaled today (mirrors the reminder sweep; needs pg_cron + VAPID).     ║
-- ║  • BYO-AI: the same cron drops a capture (暫存區) so the user's own AI can   ║
-- ║    ask about today — and, if ignored, again the next day (the catch-up).   ║
-- ║                                                                            ║
-- ║ review_prefs = per-user opt-in. daily_reviews = one row/day for idempotency ║
-- ║ (the cron never double-prompts). Single-owner, RPC-only writes.            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists public.review_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  review_date date not null,
  status      text not null default 'prompted' check (status in ('prompted', 'logged', 'skipped')),
  created_at  timestamptz not null default now(),
  constraint daily_reviews_user_date_unique unique (user_id, review_date)
);
create index if not exists daily_reviews_user_idx on public.daily_reviews (user_id, review_date desc);

drop trigger if exists review_prefs_updated_at on public.review_prefs;
create trigger review_prefs_updated_at before update on public.review_prefs
  for each row execute function app.set_updated_at();
drop trigger if exists daily_reviews_quota on public.daily_reviews;
create trigger daily_reviews_quota before insert on public.daily_reviews
  for each row execute function app.enforce_row_quota('100000', 'user_id');

-- RLS (owner-only SELECT; writes via RPC only)
do $$
declare t text;
begin
  foreach t in array array['review_prefs', 'daily_reviews']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = user_id);', t);
  end loop;
end;
$$;

-- ── Prefs (owner) ─────────────────────────────────────────────────────────────
create or replace function public.set_review_prefs(p_user_id uuid, p_is_enabled boolean)
returns public.review_prefs language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.review_prefs;
begin
  insert into public.review_prefs (user_id, is_enabled)
  values (v_uid, coalesce(p_is_enabled, false))
  on conflict (user_id) do update set is_enabled = coalesce(p_is_enabled, public.review_prefs.is_enabled)
  returning * into v_row;
  return v_row;
end;
$$;

-- ── Cron-only (service_role): cross-owner reads/writes for the daily sweep ─────
-- Enabled users who have not journaled today and have not been prompted today,
-- with their push subscriptions aggregated (like due_reminders_for_cron).
create or replace function public.due_daily_reviews_for_cron()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.user_id,
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s where s.user_id = p.user_id), '[]'::jsonb)
    ))
    from public.review_prefs p
    where p.is_enabled
      and not exists (select 1 from public.journal_entries j where j.user_id = p.user_id and j.entry_date = current_date)
      and not exists (select 1 from public.daily_reviews d where d.user_id = p.user_id and d.review_date = current_date)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.mark_daily_review_prompted(p_user_id uuid, p_review_date date default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  insert into public.daily_reviews (user_id, review_date, status)
  values (v_uid, coalesce(p_review_date, current_date), 'prompted')
  on conflict (user_id, review_date) do nothing;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_review_prefs(uuid,boolean)',
    'public.mark_daily_review_prompted(uuid,date)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;
-- Cron-only: service_role exclusively (never owner-callable, never anon).
revoke all on function public.due_daily_reviews_for_cron() from public, anon, authenticated;
grant execute on function public.due_daily_reviews_for_cron() to service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
