-- ════════════════════════════════════════════════════════════════════════
-- Mnema Galleon — P3: shared ledgers + Splitwise-level bill splitting.
-- Members can be real collaborators (user_id set, can access) or name-only
-- guests (user_id NULL, just for splitting). A split expense stores resolved
-- paid/owed per member (the Splitwise model — every split type collapses to two
-- numbers). Member balance = Σpaid − Σowed ± settlements. The greedy settle-up
-- is computed in JS (client + worker) from get_balances.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.transaction_splits (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  ledger_id      uuid not null references public.ledgers(id) on delete cascade,
  member_id      uuid not null references public.ledger_members(id) on delete cascade,
  paid           numeric(16, 2) not null default 0,
  owed           numeric(16, 2) not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists splits_txn_idx on public.transaction_splits (transaction_id);
create index if not exists splits_ledger_idx on public.transaction_splits (ledger_id);
create index if not exists splits_member_idx on public.transaction_splits (member_id);

create table if not exists public.settlements (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  from_member uuid not null references public.ledger_members(id) on delete cascade,
  to_member   uuid not null references public.ledger_members(id) on delete cascade,
  amount      numeric(16, 2) not null,
  currency    text not null default 'TWD',
  sett_date   date not null default current_date,
  note        text,
  created_via text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists settlements_ledger_idx on public.settlements (ledger_id);
create index if not exists settlements_owner_idx on public.settlements (owner_id);

drop trigger if exists settlements_updated_at on public.settlements;
create trigger settlements_updated_at before update on public.settlements for each row execute function app.set_updated_at();

do $$
begin
  execute 'drop trigger if exists transaction_splits_quota on public.transaction_splits';
  execute 'create trigger transaction_splits_quota before insert on public.transaction_splits for each row execute function app.enforce_row_quota(''10000000'', ''ledger_id'')';
  execute 'drop trigger if exists settlements_quota on public.settlements';
  execute 'create trigger settlements_quota before insert on public.settlements for each row execute function app.enforce_row_quota(''200000'', ''owner_id'')';
end;
$$;

-- RLS (membership-aware select)
do $$
begin
  execute 'alter table public.transaction_splits enable row level security';
  execute 'drop policy if exists transaction_splits_select on public.transaction_splits';
  execute 'create policy transaction_splits_select on public.transaction_splits for select to authenticated using (app.can_access_ledger(ledger_id, (select auth.uid()), false))';
  execute 'alter table public.settlements enable row level security';
  execute 'drop policy if exists settlements_select on public.settlements';
  execute 'create policy settlements_select on public.settlements for select to authenticated using ((select auth.uid()) = owner_id or app.can_access_ledger(ledger_id, (select auth.uid()), false))';
end;
$$;

-- ── Member management (owner only) ─────────────────────────────────────────
create or replace function public.add_ledger_member(
  p_user_id uuid, p_ledger_id uuid, p_display_name text, p_email text default null, p_role text default 'editor'
)
returns public.ledger_members language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_member_uid uuid; v_row public.ledger_members;
begin
  if not exists (select 1 from public.ledgers where id = p_ledger_id and owner_id = v_actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_email is not null and p_email <> '' then
    select id into v_member_uid from auth.users where lower(email) = lower(p_email);
    if v_member_uid is null then raise exception 'no Mnema user with that email' using errcode = 'P0002'; end if;
    if exists (select 1 from public.ledger_members where ledger_id = p_ledger_id and user_id = v_member_uid) then
      raise exception 'already a member' using errcode = '23505';
    end if;
  end if;
  insert into public.ledger_members (ledger_id, user_id, display_name, role, added_by)
  values (p_ledger_id, v_member_uid, p_display_name, case when p_role in ('editor', 'viewer') then p_role else 'editor' end, v_actor)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_ledger_member(
  p_user_id uuid, p_member_id uuid, p_display_name text default null, p_role text default null
)
returns public.ledger_members language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_row public.ledger_members;
begin
  select ledger_id into v_ledger from public.ledger_members where id = p_member_id;
  if v_ledger is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.ledgers where id = v_ledger and owner_id = v_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.ledger_members set
    display_name = coalesce(p_display_name, display_name),
    role = case when p_role in ('editor', 'viewer') then p_role else role end
  where id = p_member_id and role <> 'owner' returning * into v_row;
  if v_row.id is null then raise exception 'cannot update owner' using errcode = '42501'; end if;
  return v_row;
end;
$$;

create or replace function public.remove_ledger_member(p_user_id uuid, p_member_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.ledger_members where id = p_member_id;
  if v_ledger is null then return false; end if;
  if not exists (select 1 from public.ledgers where id = v_ledger and owner_id = v_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.ledger_members where id = p_member_id and role <> 'owner';
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── Split expense + balances + settlements ─────────────────────────────────
-- p_splits = [{member_id, paid, owed}] — resolved amounts (Splitwise model).
create or replace function public.create_split_expense(
  p_user_id uuid, p_ledger_id uuid, p_amount numeric, p_splits jsonb,
  p_account_id uuid default null, p_category_id uuid default null, p_payee text default null,
  p_note text default null, p_txn_date date default null, p_currency text default null
)
returns public.transactions language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_cur text; v_row public.transactions; v_el jsonb;
begin
  select owner_id, base_currency into v_owner, v_cur from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.transactions (ledger_id, owner_id, created_by, account_id, type, amount, currency, category_id, payee, note, txn_date, created_via)
  values (p_ledger_id, v_owner, v_actor, p_account_id, 'expense', abs(coalesce(p_amount, 0)), coalesce(nullif(p_currency, ''), v_cur), p_category_id, p_payee, p_note, coalesce(p_txn_date, current_date), 'ui')
  returning * into v_row;
  for v_el in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    if exists (select 1 from public.ledger_members where id = (v_el ->> 'member_id')::uuid and ledger_id = p_ledger_id) then
      insert into public.transaction_splits (transaction_id, ledger_id, member_id, paid, owed)
      values (v_row.id, p_ledger_id, (v_el ->> 'member_id')::uuid, coalesce((v_el ->> 'paid')::numeric, 0), coalesce((v_el ->> 'owed')::numeric, 0));
    end if;
  end loop;
  return v_row;
end;
$$;

create or replace function public.set_transaction_splits(p_user_id uuid, p_transaction_id uuid, p_splits jsonb)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_el jsonb;
begin
  select ledger_id into v_ledger from public.transactions where id = p_transaction_id;
  if v_ledger is null then raise exception 'transaction not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.transaction_splits where transaction_id = p_transaction_id;
  for v_el in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb))
  loop
    if exists (select 1 from public.ledger_members where id = (v_el ->> 'member_id')::uuid and ledger_id = v_ledger) then
      insert into public.transaction_splits (transaction_id, ledger_id, member_id, paid, owed)
      values (p_transaction_id, v_ledger, (v_el ->> 'member_id')::uuid, coalesce((v_el ->> 'paid')::numeric, 0), coalesce((v_el ->> 'owed')::numeric, 0));
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.get_balances(p_user_id uuid, p_ledger_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', m.id, 'display_name', m.display_name, 'user_id', m.user_id, 'role', m.role,
    'balance',
      coalesce((select sum(s.paid - s.owed) from public.transaction_splits s where s.member_id = m.id), 0)
      + coalesce((select sum(amount) from public.settlements where ledger_id = p_ledger_id and from_member = m.id), 0)
      - coalesce((select sum(amount) from public.settlements where ledger_id = p_ledger_id and to_member = m.id), 0)
  ) order by m.created_at), '[]'::jsonb)
  into v_res from public.ledger_members m where m.ledger_id = p_ledger_id;
  return v_res;
end;
$$;

create or replace function public.record_settlement(
  p_user_id uuid, p_ledger_id uuid, p_from_member uuid, p_to_member uuid, p_amount numeric,
  p_note text default null, p_sett_date date default null, p_currency text default null
)
returns public.settlements language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_cur text; v_row public.settlements;
begin
  select owner_id, base_currency into v_owner, v_cur from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.settlements (ledger_id, owner_id, from_member, to_member, amount, currency, sett_date, note)
  values (p_ledger_id, v_owner, p_from_member, p_to_member, abs(coalesce(p_amount, 0)), coalesce(nullif(p_currency, ''), v_cur), coalesce(p_sett_date, current_date), p_note)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_settlement(p_user_id uuid, p_settlement_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.settlements where id = p_settlement_id;
  if v_ledger is null then return false; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.settlements where id = p_settlement_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── Grants + anon re-hardening ─────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.add_ledger_member(uuid,uuid,text,text,text)',
    'public.update_ledger_member(uuid,uuid,text,text)',
    'public.remove_ledger_member(uuid,uuid)',
    'public.create_split_expense(uuid,uuid,numeric,jsonb,uuid,uuid,text,text,date,text)',
    'public.set_transaction_splits(uuid,uuid,jsonb)',
    'public.get_balances(uuid,uuid)',
    'public.record_settlement(uuid,uuid,uuid,uuid,numeric,text,date,text)',
    'public.delete_settlement(uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
