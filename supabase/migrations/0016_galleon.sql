-- ════════════════════════════════════════════════════════════════════════
-- Mnema Galleon — money module, P1: ledgers / accounts / categories / transactions.
-- A "ledger" (帳本) unifies personal, household, and split use: it is membership-
-- aware FROM THE START (owner + future members via ledger_members + can_access_ledger),
-- so P3 (sharing + splitting) is purely additive. Same security spine as Voyage:
-- owner_id derived from the parent ledger, created_by = the acting user, writes via
-- SECURITY DEFINER RPCs, membership-aware SELECT, EXECUTE to authenticated+service_role.
-- Money is exact numeric (never float). Transfers carry NO category and are excluded
-- from income/expense reports. P1 is single-currency (TWD default); fx_rate kept for P4.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Tables ─────────────────────────────────────────────────────────────
create table if not exists public.ledgers (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  base_currency text not null default 'TWD',
  icon          text,
  color         text,
  is_archived   boolean not null default false,
  sort_order    integer not null default 0,
  created_via   text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ledgers_owner_idx on public.ledgers (owner_id, sort_order);

create table if not exists public.ledger_members (
  id           uuid primary key default gen_random_uuid(),
  ledger_id    uuid not null references public.ledgers(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,  -- NULL = name-only guest (for splitting)
  display_name text not null,
  role         text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  added_by     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists ledger_members_ledger_idx on public.ledger_members (ledger_id);
create index if not exists ledger_members_user_idx on public.ledger_members (user_id);

create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  ledger_id       uuid not null references public.ledgers(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  type            text not null default 'cash' check (type in ('cash', 'bank', 'credit', 'ewallet', 'investment')),
  currency        text not null default 'TWD',
  opening_balance numeric(16, 2) not null default 0,
  icon            text,
  color           text,
  is_archived     boolean not null default false,
  sort_order      integer not null default 0,
  created_via     text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists accounts_ledger_idx on public.accounts (ledger_id, sort_order);
create index if not exists accounts_owner_idx on public.accounts (owner_id);

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('income', 'expense')),
  parent_id   uuid references public.categories(id) on delete set null,
  icon        text,
  color       text,
  sort_order  integer not null default 0,
  created_via text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists categories_ledger_idx on public.categories (ledger_id, kind, sort_order);
create index if not exists categories_owner_idx on public.categories (owner_id);

create table if not exists public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  ledger_id           uuid not null references public.ledgers(id) on delete cascade,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  created_by          uuid references auth.users(id) on delete set null,
  account_id          uuid references public.accounts(id) on delete set null,
  type                text not null default 'expense' check (type in ('income', 'expense', 'transfer')),
  amount              numeric(16, 2) not null check (amount >= 0),
  currency            text not null default 'TWD',
  fx_rate             numeric(18, 8) not null default 1,
  category_id         uuid references public.categories(id) on delete set null,
  transfer_account_id uuid references public.accounts(id) on delete set null,
  payee               text,
  note                text,
  txn_date            date not null default current_date,
  tags                text[] not null default '{}',
  receipt_url         text,
  created_via         text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists transactions_ledger_date_idx on public.transactions (ledger_id, txn_date desc);
create index if not exists transactions_account_idx on public.transactions (account_id);
create index if not exists transactions_transfer_idx on public.transactions (transfer_account_id);
create index if not exists transactions_category_idx on public.transactions (category_id);
create index if not exists transactions_owner_idx on public.transactions (owner_id);

-- ── 2) updated_at triggers ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ledgers', 'accounts', 'categories', 'transactions']
  loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s;', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s for each row execute function app.set_updated_at();', t);
  end loop;
end;
$$;

-- ── 3) Quotas + input caps ────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select * from (values
    ('ledgers','owner_id','1000'),
    ('ledger_members','ledger_id','100000'),
    ('accounts','owner_id','5000'),
    ('categories','owner_id','5000'),
    ('transactions','owner_id','2000000')
  ) as v(tbl, col, cap)
  loop
    execute format('drop trigger if exists %1$s_quota on public.%1$s;', r.tbl);
    execute format('create trigger %1$s_quota before insert on public.%1$s for each row execute function app.enforce_row_quota(%2$L, %3$L);', r.tbl, r.cap, r.col);
  end loop;
end;
$$;

do $$
declare r record;
begin
  for r in select * from (values
    ('ledgers','ledgers_name_len','char_length(name) <= 120'),
    ('accounts','accounts_name_len','char_length(name) <= 120'),
    ('categories','categories_name_len','char_length(name) <= 80'),
    ('transactions','transactions_payee_len','payee is null or char_length(payee) <= 200'),
    ('transactions','transactions_note_len','note is null or char_length(note) <= 2000')
  ) as r(tbl, cname, expr)
  loop
    execute format('alter table public.%I drop constraint if exists %I;', r.tbl, r.cname);
    execute format('alter table public.%I add constraint %I check (%s) not valid;', r.tbl, r.cname, r.expr);
  end loop;
end;
$$;

-- ── 4) Access helper (owner OR member; editor needed for writes) ──────────
create or replace function app.can_access_ledger(p_ledger_id uuid, p_uid uuid, p_need_edit boolean)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    p_uid is not null
    and (
      exists (select 1 from public.ledgers l where l.id = p_ledger_id and l.owner_id = p_uid)
      or exists (
        select 1 from public.ledger_members m
         where m.ledger_id = p_ledger_id and m.user_id = p_uid
           and (not p_need_edit or m.role in ('owner', 'editor'))
      )
    );
$$;

-- Derived account balance (opening + income − expense − transfers-out + transfers-in).
create or replace function app.account_balance(p_account_id uuid)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce((select opening_balance from public.accounts where id = p_account_id), 0)
       + coalesce((select sum(case when type = 'income' then amount when type in ('expense', 'transfer') then -amount end)
                     from public.transactions where account_id = p_account_id), 0)
       + coalesce((select sum(amount) from public.transactions where transfer_account_id = p_account_id and type = 'transfer'), 0);
$$;

-- Seed a sensible default Taiwan category set on ledger creation.
create or replace function app.seed_ledger_categories(p_ledger_id uuid, p_owner_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.categories (ledger_id, owner_id, name, kind, icon, sort_order)
  select p_ledger_id, p_owner_id, c.name, c.kind, c.icon, c.ord
  from (values
    ('飲食','expense','🍔',1), ('交通','expense','🚗',2), ('購物','expense','🛒',3),
    ('居住','expense','🏠',4), ('娛樂','expense','🎮',5), ('醫療','expense','💊',6),
    ('教育','expense','📚',7), ('生活','expense','🧴',8), ('人情','expense','🎁',9),
    ('帳單','expense','💳',10), ('旅遊','expense','✈️',11), ('其他','expense','📦',12),
    ('薪資','income','💰',1), ('獎金','income','🎉',2), ('投資','income','📈',3), ('其他收入','income','🔄',4)
  ) as c(name, kind, icon, ord);
end;
$$;

-- ── 5) RLS (membership-aware SELECT; writes via RPC only) ──────────────────
do $$
declare t text;
begin
  -- ledgers + ledger_members read for the owner or any member
  execute 'alter table public.ledgers enable row level security';
  execute 'drop policy if exists ledgers_select on public.ledgers';
  execute 'create policy ledgers_select on public.ledgers for select to authenticated using ((select auth.uid()) = owner_id or app.can_access_ledger(id, (select auth.uid()), false))';
  execute 'alter table public.ledger_members enable row level security';
  execute 'drop policy if exists ledger_members_select on public.ledger_members';
  execute 'create policy ledger_members_select on public.ledger_members for select to authenticated using ((user_id = (select auth.uid())) or app.can_access_ledger(ledger_id, (select auth.uid()), false))';
  -- child tables keyed by ledger_id
  foreach t in array array['accounts', 'categories', 'transactions']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = owner_id or app.can_access_ledger(ledger_id, (select auth.uid()), false));', t);
  end loop;
end;
$$;

-- ── 6) Ledger RPCs ─────────────────────────────────────────────────────────
create or replace function public.create_ledger(
  p_user_id uuid, p_name text, p_base_currency text default 'TWD',
  p_icon text default null, p_color text default null, p_created_via text default 'ui'
)
returns public.ledgers language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.ledgers;
begin
  insert into public.ledgers (owner_id, name, base_currency, icon, color, created_via)
  values (v_uid, p_name, coalesce(nullif(p_base_currency, ''), 'TWD'), p_icon, p_color, p_created_via)
  returning * into v_row;
  insert into public.ledger_members (ledger_id, user_id, display_name, role, added_by)
  values (v_row.id, v_uid, coalesce((select display_name from public.profiles where id = v_uid), 'Me'), 'owner', v_uid);
  perform app.seed_ledger_categories(v_row.id, v_uid);
  return v_row;
end;
$$;

create or replace function public.update_ledger(
  p_user_id uuid, p_ledger_id uuid, p_name text default null, p_base_currency text default null,
  p_icon text default null, p_color text default null, p_is_archived boolean default null, p_sort_order integer default null
)
returns public.ledgers language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_row public.ledgers;
begin
  if not exists (select 1 from public.ledgers where id = p_ledger_id) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.ledgers set
    name = coalesce(p_name, name), base_currency = coalesce(nullif(p_base_currency, ''), base_currency),
    icon = coalesce(p_icon, icon), color = coalesce(p_color, color),
    is_archived = coalesce(p_is_archived, is_archived), sort_order = coalesce(p_sort_order, sort_order)
  where id = p_ledger_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_ledger(p_user_id uuid, p_ledger_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_n int;
begin
  -- Only the owner may delete a whole ledger.
  delete from public.ledgers where id = p_ledger_id and owner_id = v_actor;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.get_ledger(p_user_id uuid, p_ledger_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select jsonb_build_object(
    'id', l.id, 'owner_id', l.owner_id, 'name', l.name, 'base_currency', l.base_currency,
    'icon', l.icon, 'color', l.color, 'is_archived', l.is_archived,
    'my_role', case when l.owner_id = v_uid then 'owner'
      else coalesce((select role from public.ledger_members m where m.ledger_id = l.id and m.user_id = v_uid limit 1), 'viewer') end,
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'type', a.type, 'currency', a.currency,
        'opening_balance', a.opening_balance, 'icon', a.icon, 'color', a.color, 'is_archived', a.is_archived,
        'sort_order', a.sort_order, 'balance', app.account_balance(a.id)) order by a.sort_order, a.created_at)
      from public.accounts a where a.ledger_id = l.id), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'parent_id', c.parent_id,
        'icon', c.icon, 'color', c.color, 'sort_order', c.sort_order) order by c.kind, c.sort_order)
      from public.categories c where c.ledger_id = l.id), '[]'::jsonb)
  )
  into v_res from public.ledgers l where l.id = p_ledger_id;
  if v_res is null then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  return v_res;
end;
$$;

-- ── 7) Account RPCs ────────────────────────────────────────────────────────
create or replace function public.create_account(
  p_user_id uuid, p_ledger_id uuid, p_name text, p_type text default 'cash',
  p_currency text default null, p_opening_balance numeric default 0,
  p_icon text default null, p_color text default null, p_sort_order integer default 0, p_created_via text default 'ui'
)
returns public.accounts language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_cur text; v_row public.accounts;
begin
  select owner_id, base_currency into v_owner, v_cur from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.accounts (ledger_id, owner_id, name, type, currency, opening_balance, icon, color, sort_order, created_via)
  values (p_ledger_id, v_owner, p_name, coalesce(nullif(p_type, ''), 'cash'), coalesce(nullif(p_currency, ''), v_cur),
          coalesce(p_opening_balance, 0), p_icon, p_color, coalesce(p_sort_order, 0), p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_account(
  p_user_id uuid, p_account_id uuid, p_name text default null, p_type text default null,
  p_currency text default null, p_opening_balance numeric default null,
  p_icon text default null, p_color text default null, p_is_archived boolean default null, p_sort_order integer default null
)
returns public.accounts language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_row public.accounts;
begin
  select ledger_id into v_ledger from public.accounts where id = p_account_id;
  if v_ledger is null then raise exception 'account not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.accounts set
    name = coalesce(p_name, name), type = coalesce(nullif(p_type, ''), type),
    currency = coalesce(nullif(p_currency, ''), currency), opening_balance = coalesce(p_opening_balance, opening_balance),
    icon = coalesce(p_icon, icon), color = coalesce(p_color, color),
    is_archived = coalesce(p_is_archived, is_archived), sort_order = coalesce(p_sort_order, sort_order)
  where id = p_account_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_account(p_user_id uuid, p_account_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.accounts where id = p_account_id;
  if v_ledger is null then return false; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.accounts where id = p_account_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── 8) Category RPCs ───────────────────────────────────────────────────────
create or replace function public.create_category(
  p_user_id uuid, p_ledger_id uuid, p_name text, p_kind text,
  p_parent_id uuid default null, p_icon text default null, p_color text default null, p_sort_order integer default 0, p_created_via text default 'ui'
)
returns public.categories language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_row public.categories;
begin
  select owner_id into v_owner from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.categories (ledger_id, owner_id, name, kind, parent_id, icon, color, sort_order, created_via)
  values (p_ledger_id, v_owner, p_name, coalesce(nullif(p_kind, ''), 'expense'), p_parent_id, p_icon, p_color, coalesce(p_sort_order, 0), p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_category(
  p_user_id uuid, p_category_id uuid, p_name text default null, p_kind text default null,
  p_parent_id uuid default null, p_icon text default null, p_color text default null, p_sort_order integer default null
)
returns public.categories language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_row public.categories;
begin
  select ledger_id into v_ledger from public.categories where id = p_category_id;
  if v_ledger is null then raise exception 'category not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.categories set
    name = coalesce(p_name, name), kind = coalesce(nullif(p_kind, ''), kind),
    parent_id = coalesce(p_parent_id, parent_id), icon = coalesce(p_icon, icon),
    color = coalesce(p_color, color), sort_order = coalesce(p_sort_order, sort_order)
  where id = p_category_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_category(p_user_id uuid, p_category_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.categories where id = p_category_id;
  if v_ledger is null then return false; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.categories where id = p_category_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── 9) Transaction RPCs ────────────────────────────────────────────────────
create or replace function public.create_transaction(
  p_user_id uuid, p_ledger_id uuid, p_type text, p_amount numeric,
  p_account_id uuid default null, p_category_id uuid default null, p_transfer_account_id uuid default null,
  p_currency text default null, p_fx_rate numeric default 1, p_payee text default null, p_note text default null,
  p_txn_date date default null, p_tags text[] default '{}', p_receipt_url text default null, p_created_via text default 'ui'
)
returns public.transactions language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_cur text; v_type text; v_row public.transactions;
begin
  select owner_id, base_currency into v_owner, v_cur from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_type := coalesce(nullif(p_type, ''), 'expense');
  if p_account_id is not null and not exists (select 1 from public.accounts where id = p_account_id and ledger_id = p_ledger_id) then
    raise exception 'account not found' using errcode = 'P0002'; end if;
  if p_transfer_account_id is not null and not exists (select 1 from public.accounts where id = p_transfer_account_id and ledger_id = p_ledger_id) then
    raise exception 'transfer account not found' using errcode = 'P0002'; end if;
  if p_category_id is not null and not exists (select 1 from public.categories where id = p_category_id and ledger_id = p_ledger_id) then
    raise exception 'category not found' using errcode = 'P0002'; end if;
  insert into public.transactions (
    ledger_id, owner_id, created_by, account_id, type, amount, currency, fx_rate,
    category_id, transfer_account_id, payee, note, txn_date, tags, receipt_url, created_via
  ) values (
    p_ledger_id, v_owner, v_actor, p_account_id, v_type, abs(coalesce(p_amount, 0)), coalesce(nullif(p_currency, ''), v_cur), coalesce(p_fx_rate, 1),
    case when v_type = 'transfer' then null else p_category_id end,
    case when v_type = 'transfer' then p_transfer_account_id else null end,
    p_payee, p_note, coalesce(p_txn_date, current_date), coalesce(p_tags, '{}'), p_receipt_url, p_created_via
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.create_transactions_bulk(p_user_id uuid, p_ledger_id uuid, p_transactions jsonb)
returns setof public.transactions language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_el jsonb;
begin
  for v_el in select * from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb))
  loop
    return query select * from public.create_transaction(
      v_uid, p_ledger_id, coalesce(v_el ->> 'type', 'expense'), coalesce((v_el ->> 'amount')::numeric, 0),
      (v_el ->> 'account_id')::uuid, (v_el ->> 'category_id')::uuid, (v_el ->> 'transfer_account_id')::uuid,
      v_el ->> 'currency', coalesce((v_el ->> 'fx_rate')::numeric, 1), v_el ->> 'payee', v_el ->> 'note',
      (v_el ->> 'txn_date')::date,
      coalesce((select array_agg(x) from jsonb_array_elements_text(v_el -> 'tags') as x), '{}'),
      v_el ->> 'receipt_url', 'mcp');
  end loop;
end;
$$;

create or replace function public.update_transaction(
  p_user_id uuid, p_transaction_id uuid, p_amount numeric default null, p_type text default null,
  p_account_id uuid default null, p_category_id uuid default null, p_transfer_account_id uuid default null,
  p_payee text default null, p_note text default null, p_txn_date date default null,
  p_tags text[] default null, p_receipt_url text default null
)
returns public.transactions language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_row public.transactions;
begin
  select ledger_id into v_ledger from public.transactions where id = p_transaction_id;
  if v_ledger is null then raise exception 'transaction not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.transactions set
    amount = coalesce(abs(p_amount), amount), type = coalesce(nullif(p_type, ''), type),
    account_id = coalesce(p_account_id, account_id), category_id = coalesce(p_category_id, category_id),
    transfer_account_id = coalesce(p_transfer_account_id, transfer_account_id),
    payee = coalesce(p_payee, payee), note = coalesce(p_note, note), txn_date = coalesce(p_txn_date, txn_date),
    tags = coalesce(p_tags, tags), receipt_url = coalesce(p_receipt_url, receipt_url)
  where id = p_transaction_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_transaction(p_user_id uuid, p_transaction_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.transactions where id = p_transaction_id;
  if v_ledger is null then return false; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.transactions where id = p_transaction_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── 10) Read RPCs ──────────────────────────────────────────────────────────
create or replace function public.list_transactions(
  p_user_id uuid, p_ledger_id uuid, p_account_id uuid default null, p_category_id uuid default null,
  p_type text default null, p_from date default null, p_to date default null, p_limit integer default 100
)
returns setof public.transactions language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  return query
    select t.* from public.transactions t
     where t.ledger_id = p_ledger_id
       and (p_account_id is null or t.account_id = p_account_id or t.transfer_account_id = p_account_id)
       and (p_category_id is null or t.category_id = p_category_id)
       and (p_type is null or p_type = '' or t.type = p_type)
       and (p_from is null or t.txn_date >= p_from)
       and (p_to is null or t.txn_date <= p_to)
     order by t.txn_date desc, t.created_at desc
     limit greatest(1, least(p_limit, 1000));
end;
$$;

create or replace function public.search_transactions(p_user_id uuid, p_ledger_id uuid, p_query text, p_limit integer default 50)
returns setof public.transactions language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  return query
    select t.* from public.transactions t
     where t.ledger_id = p_ledger_id
       and (t.payee ilike '%' || p_query || '%' or t.note ilike '%' || p_query || '%')
     order by t.txn_date desc
     limit greatest(1, least(p_limit, 200));
end;
$$;

-- Dashboard summary for a date range: totals + spending by category (expense, base currency).
create or replace function public.get_ledger_summary(p_user_id uuid, p_ledger_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select jsonb_build_object(
    'income', coalesce((select sum(amount * fx_rate) from public.transactions
                where ledger_id = p_ledger_id and type = 'income' and txn_date between p_from and p_to), 0),
    'expense', coalesce((select sum(amount * fx_rate) from public.transactions
                where ledger_id = p_ledger_id and type = 'expense' and txn_date between p_from and p_to), 0),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category_id', cid, 'name', cname, 'icon', cicon, 'total', total) order by total desc)
      from (
        select t.category_id as cid, c.name as cname, c.icon as cicon, sum(t.amount * t.fx_rate) as total
        from public.transactions t left join public.categories c on c.id = t.category_id
        where t.ledger_id = p_ledger_id and t.type = 'expense' and t.txn_date between p_from and p_to
        group by t.category_id, c.name, c.icon
      ) s), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

-- ── 11) Grants + anon re-hardening ─────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_ledger(uuid,text,text,text,text,text)',
    'public.update_ledger(uuid,uuid,text,text,text,text,boolean,integer)',
    'public.delete_ledger(uuid,uuid)',
    'public.get_ledger(uuid,uuid)',
    'public.create_account(uuid,uuid,text,text,text,numeric,text,text,integer,text)',
    'public.update_account(uuid,uuid,text,text,text,numeric,text,text,boolean,integer)',
    'public.delete_account(uuid,uuid)',
    'public.create_category(uuid,uuid,text,text,uuid,text,text,integer,text)',
    'public.update_category(uuid,uuid,text,text,uuid,text,text,integer)',
    'public.delete_category(uuid,uuid)',
    'public.create_transaction(uuid,uuid,text,numeric,uuid,uuid,uuid,text,numeric,text,text,date,text[],text,text)',
    'public.create_transactions_bulk(uuid,uuid,jsonb)',
    'public.update_transaction(uuid,uuid,numeric,text,uuid,uuid,uuid,text,text,date,text[],text)',
    'public.delete_transaction(uuid,uuid)',
    'public.list_transactions(uuid,uuid,uuid,uuid,text,date,date,integer)',
    'public.search_transactions(uuid,uuid,text,integer)',
    'public.get_ledger_summary(uuid,uuid,date,date)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
