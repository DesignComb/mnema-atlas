-- 0020: Galleon split/settlement integrity hardening (gap-review #8/#9/#15/#25).
-- The UI validates these, but the same RPCs are reachable over MCP/REST by an
-- external AI with no client-side guard. All CREATE OR REPLACE of existing
-- functions → grants/ACLs are preserved, so no grant/anon re-hardening tail.

-- (a) create_split_expense: reject splits that don't balance to the amount, and
--     reject account/category that don't belong to this ledger. Same signature.
create or replace function public.create_split_expense(
  p_user_id uuid, p_ledger_id uuid, p_amount numeric, p_splits jsonb,
  p_account_id uuid default null, p_category_id uuid default null, p_payee text default null,
  p_note text default null, p_txn_date date default null, p_currency text default null
)
returns public.transactions language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_cur text; v_row public.transactions; v_el jsonb;
  v_amt numeric := abs(coalesce(p_amount, 0)); v_paid numeric := 0; v_owed numeric := 0;
begin
  select owner_id, base_currency into v_owner, v_cur from public.ledgers where id = p_ledger_id;
  if not found then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_account_id is not null and not exists (select 1 from public.accounts where id = p_account_id and ledger_id = p_ledger_id) then
    raise exception 'account does not belong to this ledger' using errcode = 'P0002';
  end if;
  if p_category_id is not null and not exists (select 1 from public.categories where id = p_category_id and ledger_id = p_ledger_id) then
    raise exception 'category does not belong to this ledger' using errcode = 'P0002';
  end if;
  for v_el in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) loop
    if not exists (select 1 from public.ledger_members where id = (v_el ->> 'member_id')::uuid and ledger_id = p_ledger_id) then
      raise exception 'split member does not belong to this ledger' using errcode = 'P0002';
    end if;
    v_paid := v_paid + coalesce((v_el ->> 'paid')::numeric, 0);
    v_owed := v_owed + coalesce((v_el ->> 'owed')::numeric, 0);
  end loop;
  if round(v_paid, 2) <> round(v_amt, 2) or round(v_owed, 2) <> round(v_amt, 2) then
    raise exception 'splits must sum to the amount (paid=%, owed=%, amount=%)', v_paid, v_owed, v_amt using errcode = '22023';
  end if;
  insert into public.transactions (ledger_id, owner_id, created_by, account_id, type, amount, currency, category_id, payee, note, txn_date, created_via)
  values (p_ledger_id, v_owner, v_actor, p_account_id, 'expense', v_amt, coalesce(nullif(p_currency, ''), v_cur), p_category_id, p_payee, p_note, coalesce(p_txn_date, current_date), 'ui')
  returning * into v_row;
  for v_el in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) loop
    insert into public.transaction_splits (transaction_id, ledger_id, member_id, paid, owed)
    values (v_row.id, p_ledger_id, (v_el ->> 'member_id')::uuid, coalesce((v_el ->> 'paid')::numeric, 0), coalesce((v_el ->> 'owed')::numeric, 0));
  end loop;
  return v_row;
end;
$$;

-- (b) record_settlement: both members must belong to this ledger and differ. Same signature.
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
  if p_from_member = p_to_member then raise exception 'from and to members must differ' using errcode = '22023'; end if;
  if not exists (select 1 from public.ledger_members where id = p_from_member and ledger_id = p_ledger_id)
     or not exists (select 1 from public.ledger_members where id = p_to_member and ledger_id = p_ledger_id) then
    raise exception 'settlement member does not belong to this ledger' using errcode = 'P0002';
  end if;
  insert into public.settlements (ledger_id, owner_id, from_member, to_member, amount, currency, sett_date, note)
  values (p_ledger_id, v_owner, p_from_member, p_to_member, abs(coalesce(p_amount, 0)), coalesce(nullif(p_currency, ''), v_cur), coalesce(p_sett_date, current_date), p_note)
  returning * into v_row;
  return v_row;
end;
$$;

-- (c) remove_ledger_member: refuse to remove a member who still has splits or
--     settlements (FK cascade would silently rewrite everyone else's balances).
create or replace function public.remove_ledger_member(p_user_id uuid, p_member_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.ledger_members where id = p_member_id;
  if v_ledger is null then return false; end if;
  if not exists (select 1 from public.ledgers where id = v_ledger and owner_id = v_actor) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.transaction_splits where member_id = p_member_id)
     or exists (select 1 from public.settlements where from_member = p_member_id or to_member = p_member_id) then
    raise exception 'member has split/settlement history — settle and clear it before removing' using errcode = '22023';
  end if;
  delete from public.ledger_members where id = p_member_id and role <> 'owner';
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;
