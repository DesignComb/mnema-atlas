-- ════════════════════════════════════════════════════════════════════════════
-- 0029 · Mnema Galleon — Subscriptions (訂閱).
--
-- A tracked recurring paid service (Netflix, iCloud, gym…) with a renewal date,
-- cost, and an RRULE cadence. Distinct from recurring_transactions (free-form
-- bookkeeping templates): subscriptions carry billing-specific fields (renewal
-- date, cancel-reminder window, active toggle) and a dashboard of upcoming
-- renewals. Per the user's choice they AUTO-POST: post_due_subscriptions posts
-- an expense and advances renewal_date when the ledger is opened (idempotent,
-- mirroring run_due_recurring). Membership-aware like the rest of Galleon.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  ledger_id           uuid not null references public.ledgers(id) on delete cascade,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  account_id          uuid references public.accounts(id) on delete set null,
  category_id         uuid references public.categories(id) on delete set null,
  name                text not null check (char_length(name) between 1 and 200),
  amount              numeric(16, 2) not null,
  currency            text not null default 'TWD',
  recurrence_rule     text not null default 'FREQ=MONTHLY;INTERVAL=1',
  renewal_date        date not null,
  last_billed         date,
  cancel_reminder_days integer not null default 7,
  is_active           boolean not null default true,
  notes               text check (notes is null or char_length(notes) <= 2000),
  created_via         text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists subscriptions_ledger_idx on public.subscriptions (ledger_id);
create index if not exists subscriptions_owner_idx on public.subscriptions (owner_id);
create index if not exists subscriptions_renewal_idx on public.subscriptions (renewal_date) where is_active;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function app.set_updated_at();
drop trigger if exists subscriptions_quota on public.subscriptions;
create trigger subscriptions_quota before insert on public.subscriptions
  for each row execute function app.enforce_row_quota('10000', 'owner_id');

-- RLS (membership-aware select)
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = owner_id or app.can_access_ledger(ledger_id, (select auth.uid()), false));

-- ── RPCs ────────────────────────────────────────────────────────────────────
create or replace function public.set_subscription(
  p_user_id uuid, p_ledger_id uuid, p_name text, p_amount numeric, p_renewal_date date,
  p_recurrence_rule text default null, p_account_id uuid default null, p_category_id uuid default null,
  p_currency text default null, p_cancel_reminder_days integer default null, p_notes text default null,
  p_subscription_id uuid default null, p_is_active boolean default null, p_created_via text default 'ui'
)
returns public.subscriptions language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_cur text; v_row public.subscriptions;
begin
  select owner_id, base_currency into v_owner, v_cur from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_subscription_id is not null then
    update public.subscriptions set
      name = coalesce(nullif(p_name, ''), name),
      amount = abs(coalesce(p_amount, amount)),
      renewal_date = coalesce(p_renewal_date, renewal_date),
      recurrence_rule = coalesce(nullif(p_recurrence_rule, ''), recurrence_rule),
      account_id = coalesce(p_account_id, account_id),
      category_id = coalesce(p_category_id, category_id),
      currency = coalesce(nullif(p_currency, ''), currency),
      cancel_reminder_days = coalesce(p_cancel_reminder_days, cancel_reminder_days),
      notes = coalesce(nullif(p_notes, ''), notes),
      is_active = coalesce(p_is_active, is_active)
    where id = p_subscription_id and ledger_id = p_ledger_id returning * into v_row;
    if v_row.id is null then raise exception 'subscription not found' using errcode = 'P0002'; end if;
  else
    insert into public.subscriptions (ledger_id, owner_id, account_id, category_id, name, amount, currency, recurrence_rule, renewal_date, cancel_reminder_days, notes, is_active, created_via)
    values (p_ledger_id, v_owner, p_account_id, p_category_id, p_name, abs(coalesce(p_amount, 0)), coalesce(nullif(p_currency, ''), v_cur),
            coalesce(nullif(p_recurrence_rule, ''), 'FREQ=MONTHLY;INTERVAL=1'), coalesce(p_renewal_date, current_date),
            coalesce(p_cancel_reminder_days, 7), nullif(p_notes, ''), coalesce(p_is_active, true), coalesce(nullif(p_created_via, ''), 'ui'))
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_subscription(p_user_id uuid, p_subscription_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.subscriptions where id = p_subscription_id;
  if v_ledger is null then return false; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.subscriptions where id = p_subscription_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.list_subscriptions(p_user_id uuid, p_ledger_id uuid)
returns setof public.subscriptions language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  return query
    select * from public.subscriptions where ledger_id = p_ledger_id
    order by is_active desc, renewal_date;
end;
$$;

-- Auto-post: for every active subscription whose renewal has passed, post an
-- expense and advance renewal_date (catching up multiple cycles). Idempotent via
-- the renewal_date guard. Called when a ledger is opened (like run_due_recurring).
create or replace function public.post_due_subscriptions(p_user_id uuid, p_ledger_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_sub public.subscriptions; v_run date; v_next date; v_posted int := 0; v_guard int;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  for v_sub in select * from public.subscriptions
    where ledger_id = p_ledger_id and is_active and renewal_date <= current_date
  loop
    v_run := v_sub.renewal_date; v_guard := 0;
    while v_run <= current_date and v_guard < 120 loop
      insert into public.transactions (ledger_id, owner_id, created_by, account_id, type, amount, currency, category_id, payee, note, txn_date, created_via)
      values (v_sub.ledger_id, v_sub.owner_id, v_uid, v_sub.account_id, 'expense', v_sub.amount, v_sub.currency, v_sub.category_id, v_sub.name, v_sub.notes, v_run, 'ui');
      v_posted := v_posted + 1; v_guard := v_guard + 1;
      v_next := app.rrule_next_simple(v_sub.recurrence_rule, v_run);
      exit when v_next is null;
      v_run := v_next;
    end loop;
    update public.subscriptions set renewal_date = v_run, last_billed = current_date where id = v_sub.id;
  end loop;
  return v_posted;
end;
$$;

create or replace function public.get_upcoming_subscriptions(p_user_id uuid, p_ledger_id uuid, p_days_ahead integer default 14)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'amount', s.amount, 'currency', s.currency,
    'renewal_date', s.renewal_date, 'cancel_reminder_days', s.cancel_reminder_days
  ) order by s.renewal_date), '[]'::jsonb)
  into v_res
  from public.subscriptions s
  where s.ledger_id = p_ledger_id and s.is_active
    and s.renewal_date <= current_date + greatest(0, least(coalesce(p_days_ahead, 14), 365));
  return v_res;
end;
$$;

-- ── Grants + anon re-hardening ──────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_subscription(uuid,uuid,text,numeric,date,text,uuid,uuid,text,integer,text,uuid,boolean,text)',
    'public.delete_subscription(uuid,uuid)',
    'public.list_subscriptions(uuid,uuid)',
    'public.post_due_subscriptions(uuid,uuid)',
    'public.get_upcoming_subscriptions(uuid,uuid,integer)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
