-- ════════════════════════════════════════════════════════════════════════
-- Mnema Galleon — P2: budgets, recurring transactions, reports.
-- Budgets = monthly category limits. Recurring = a template + RRULE; posted
-- lazily by run_due_recurring (called when a ledger loads) using the existing
-- app.rrule_next_simple advance. Reports = monthly trend + budget status.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,  -- NULL = overall budget
  period      text not null default 'monthly' check (period in ('monthly', 'weekly')),
  amount      numeric(16, 2) not null,
  rollover    boolean not null default false,
  created_via text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists budgets_ledger_idx on public.budgets (ledger_id);
create index if not exists budgets_owner_idx on public.budgets (owner_id);

create table if not exists public.recurring_transactions (
  id                  uuid primary key default gen_random_uuid(),
  ledger_id           uuid not null references public.ledgers(id) on delete cascade,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  account_id          uuid references public.accounts(id) on delete set null,
  type                text not null default 'expense' check (type in ('income', 'expense', 'transfer')),
  amount              numeric(16, 2) not null,
  currency            text not null default 'TWD',
  category_id         uuid references public.categories(id) on delete set null,
  transfer_account_id uuid references public.accounts(id) on delete set null,
  payee               text,
  note                text,
  recurrence_rule     text not null,
  next_run            date not null,
  last_posted         date,
  is_active           boolean not null default true,
  created_via         text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists recurring_ledger_idx on public.recurring_transactions (ledger_id);
create index if not exists recurring_due_idx on public.recurring_transactions (next_run) where is_active;
create index if not exists recurring_owner_idx on public.recurring_transactions (owner_id);

-- updated_at triggers + quotas
do $$
declare t text;
begin
  foreach t in array array['budgets', 'recurring_transactions']
  loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s;', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s for each row execute function app.set_updated_at();', t);
    execute format('drop trigger if exists %1$s_quota on public.%1$s;', t);
  end loop;
  execute 'create trigger budgets_quota before insert on public.budgets for each row execute function app.enforce_row_quota(''10000'', ''owner_id'')';
  execute 'create trigger recurring_transactions_quota before insert on public.recurring_transactions for each row execute function app.enforce_row_quota(''10000'', ''owner_id'')';
end;
$$;

-- RLS (membership-aware select)
do $$
declare t text;
begin
  foreach t in array array['budgets', 'recurring_transactions']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = owner_id or app.can_access_ledger(ledger_id, (select auth.uid()), false));', t);
  end loop;
end;
$$;

-- ── Budget RPCs ────────────────────────────────────────────────────────────
create or replace function public.set_budget(
  p_user_id uuid, p_ledger_id uuid, p_category_id uuid, p_amount numeric,
  p_period text default 'monthly', p_rollover boolean default false
)
returns public.budgets language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_row public.budgets;
begin
  select owner_id into v_owner from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  -- Upsert: one budget per (ledger, category, period).
  update public.budgets set amount = p_amount, rollover = coalesce(p_rollover, rollover)
   where ledger_id = p_ledger_id and period = coalesce(nullif(p_period, ''), 'monthly')
     and category_id is not distinct from p_category_id
  returning * into v_row;
  if v_row.id is null then
    insert into public.budgets (ledger_id, owner_id, category_id, period, amount, rollover)
    values (p_ledger_id, v_owner, p_category_id, coalesce(nullif(p_period, ''), 'monthly'), p_amount, coalesce(p_rollover, false))
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_budget(p_user_id uuid, p_budget_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.budgets where id = p_budget_id;
  if v_ledger is null then return false; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.budgets where id = p_budget_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.get_budget_status(p_user_id uuid, p_ledger_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'budget_id', b.id, 'category_id', b.category_id, 'name', coalesce(c.name, '總額 Overall'), 'icon', c.icon,
    'amount', b.amount, 'rollover', b.rollover,
    'spent', coalesce((select sum(t.amount) from public.transactions t
        where t.ledger_id = p_ledger_id and t.type = 'expense' and t.txn_date between p_from and p_to
          and (b.category_id is null or t.category_id = b.category_id)), 0)
  ) order by b.category_id nulls first), '[]'::jsonb)
  into v_res
  from public.budgets b left join public.categories c on c.id = b.category_id
  where b.ledger_id = p_ledger_id and b.period = 'monthly';
  return v_res;
end;
$$;

-- ── Recurring-transaction RPCs ─────────────────────────────────────────────
create or replace function public.set_recurring_transaction(
  p_user_id uuid, p_ledger_id uuid, p_type text, p_amount numeric, p_recurrence_rule text, p_next_run date,
  p_account_id uuid default null, p_category_id uuid default null, p_transfer_account_id uuid default null,
  p_currency text default null, p_payee text default null, p_note text default null, p_recurring_id uuid default null,
  p_is_active boolean default null
)
returns public.recurring_transactions language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_cur text; v_row public.recurring_transactions;
begin
  select owner_id, base_currency into v_owner, v_cur from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_recurring_id is not null then
    update public.recurring_transactions set
      type = coalesce(nullif(p_type, ''), type), amount = coalesce(p_amount, amount),
      recurrence_rule = coalesce(nullif(p_recurrence_rule, ''), recurrence_rule), next_run = coalesce(p_next_run, next_run),
      account_id = coalesce(p_account_id, account_id), category_id = coalesce(p_category_id, category_id),
      transfer_account_id = coalesce(p_transfer_account_id, transfer_account_id), currency = coalesce(nullif(p_currency, ''), currency),
      payee = coalesce(p_payee, payee), note = coalesce(p_note, note), is_active = coalesce(p_is_active, is_active)
    where id = p_recurring_id and ledger_id = p_ledger_id returning * into v_row;
    if v_row.id is null then raise exception 'recurring not found' using errcode = 'P0002'; end if;
  else
    insert into public.recurring_transactions (ledger_id, owner_id, account_id, type, amount, currency, category_id, transfer_account_id, payee, note, recurrence_rule, next_run, is_active)
    values (p_ledger_id, v_owner, p_account_id, coalesce(nullif(p_type, ''), 'expense'), abs(coalesce(p_amount, 0)), coalesce(nullif(p_currency, ''), v_cur),
            p_category_id, p_transfer_account_id, p_payee, p_note, p_recurrence_rule, coalesce(p_next_run, current_date), coalesce(p_is_active, true))
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_recurring_transaction(p_user_id uuid, p_recurring_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.recurring_transactions where id = p_recurring_id;
  if v_ledger is null then return false; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.recurring_transactions where id = p_recurring_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- Post every recurring template whose next_run has passed, catching up multiple
-- occurrences, and advance next_run. Idempotent (the next_run guard).
create or replace function public.run_due_recurring(p_user_id uuid, p_ledger_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_rec public.recurring_transactions; v_run date; v_next date; v_posted int := 0; v_guard int;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  for v_rec in select * from public.recurring_transactions
    where ledger_id = p_ledger_id and is_active and next_run <= current_date
  loop
    v_run := v_rec.next_run; v_guard := 0;
    while v_run <= current_date and v_guard < 120 loop
      insert into public.transactions (ledger_id, owner_id, created_by, account_id, type, amount, currency, category_id, transfer_account_id, payee, note, txn_date, created_via)
      values (v_rec.ledger_id, v_rec.owner_id, v_uid, v_rec.account_id, v_rec.type, v_rec.amount, v_rec.currency,
              case when v_rec.type = 'transfer' then null else v_rec.category_id end,
              case when v_rec.type = 'transfer' then v_rec.transfer_account_id else null end,
              v_rec.payee, v_rec.note, v_run, 'ui');
      v_posted := v_posted + 1; v_guard := v_guard + 1;
      v_next := app.rrule_next_simple(v_rec.recurrence_rule, v_run);
      exit when v_next is null;
      v_run := v_next;
    end loop;
    update public.recurring_transactions set next_run = v_run, last_posted = current_date where id = v_rec.id;
  end loop;
  return v_posted;
end;
$$;

-- ── Reports ────────────────────────────────────────────────────────────────
create or replace function public.get_monthly_trend(p_user_id uuid, p_ledger_id uuid, p_months integer default 6)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select jsonb_agg(jsonb_build_object('month', ym,
    'income', coalesce((select sum(amount) from public.transactions where ledger_id = p_ledger_id and type = 'income' and txn_date between m_start and m_end), 0),
    'expense', coalesce((select sum(amount) from public.transactions where ledger_id = p_ledger_id and type = 'expense' and txn_date between m_start and m_end), 0)
  ) order by ym)
  into v_res
  from (
    select to_char(date_trunc('month', current_date) - (g || ' months')::interval, 'YYYY-MM') as ym,
           (date_trunc('month', current_date) - (g || ' months')::interval)::date as m_start,
           (date_trunc('month', current_date) - (g || ' months')::interval + interval '1 month - 1 day')::date as m_end
    from generate_series(0, greatest(1, least(p_months, 36)) - 1) g
  ) months;
  return coalesce(v_res, '[]'::jsonb);
end;
$$;

-- ── Grants + anon re-hardening ─────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_budget(uuid,uuid,uuid,numeric,text,boolean)',
    'public.delete_budget(uuid,uuid)',
    'public.get_budget_status(uuid,uuid,date,date)',
    'public.set_recurring_transaction(uuid,uuid,text,numeric,text,date,uuid,uuid,uuid,text,text,text,uuid,boolean)',
    'public.delete_recurring_transaction(uuid,uuid)',
    'public.run_due_recurring(uuid,uuid)',
    'public.get_monthly_trend(uuid,uuid,integer)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
