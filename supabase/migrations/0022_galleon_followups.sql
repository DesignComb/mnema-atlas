-- 0022: Galleon gap-review follow-ups (#7 #10 #11 #24).

-- ── #7: personal-share reporting ─────────────────────────────────────────────
-- In a shared ledger a split expense's full amount was counted as MY spending in
-- summary/budget/trend, over-stating it. Helper returns the current user's share
-- of a transaction: their `owed` if the txn is split, else the full converted amount.
create or replace function app.txn_expense_share(p_txn_id uuid, p_amount numeric, p_fx numeric, p_member uuid)
returns numeric language sql stable set search_path = '' as $$
  select case
    when exists (select 1 from public.transaction_splits s where s.transaction_id = p_txn_id)
      then coalesce((select s.owed from public.transaction_splits s where s.transaction_id = p_txn_id and s.member_id = p_member), 0)
    else coalesce(p_amount, 0) * coalesce(p_fx, 1)
  end;
$$;

create or replace function public.get_ledger_summary(p_user_id uuid, p_ledger_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb; v_my_member uuid;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select id into v_my_member from public.ledger_members where ledger_id = p_ledger_id and user_id = v_uid limit 1;
  select jsonb_build_object(
    'income', coalesce((select sum(amount * fx_rate) from public.transactions
                where ledger_id = p_ledger_id and type = 'income' and txn_date between p_from and p_to), 0),
    'expense', coalesce((select sum(app.txn_expense_share(t.id, t.amount, t.fx_rate, v_my_member)) from public.transactions t
                where t.ledger_id = p_ledger_id and t.type = 'expense' and t.txn_date between p_from and p_to), 0),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category_id', cid, 'name', cname, 'icon', cicon, 'total', total) order by total desc)
      from (
        select t.category_id as cid, c.name as cname, c.icon as cicon,
               sum(app.txn_expense_share(t.id, t.amount, t.fx_rate, v_my_member)) as total
        from public.transactions t left join public.categories c on c.id = t.category_id
        where t.ledger_id = p_ledger_id and t.type = 'expense' and t.txn_date between p_from and p_to
        group by t.category_id, c.name, c.icon
      ) s), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

create or replace function public.get_budget_status(p_user_id uuid, p_ledger_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb; v_my_member uuid;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select id into v_my_member from public.ledger_members where ledger_id = p_ledger_id and user_id = v_uid limit 1;
  select coalesce(jsonb_agg(jsonb_build_object(
    'budget_id', b.id, 'category_id', b.category_id, 'name', coalesce(c.name, '總額 Overall'), 'icon', c.icon,
    'amount', b.amount, 'rollover', b.rollover,
    'spent', coalesce((select sum(app.txn_expense_share(t.id, t.amount, t.fx_rate, v_my_member)) from public.transactions t
        where t.ledger_id = p_ledger_id and t.type = 'expense' and t.txn_date between p_from and p_to
          and (b.category_id is null or t.category_id = b.category_id)), 0)
  ) order by b.category_id nulls first), '[]'::jsonb)
  into v_res
  from public.budgets b left join public.categories c on c.id = b.category_id
  where b.ledger_id = p_ledger_id and b.period = 'monthly';
  return v_res;
end;
$$;

create or replace function public.get_monthly_trend(p_user_id uuid, p_ledger_id uuid, p_months integer default 6)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb; v_my_member uuid;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select id into v_my_member from public.ledger_members where ledger_id = p_ledger_id and user_id = v_uid limit 1;
  select jsonb_agg(jsonb_build_object('month', ym,
    'income', coalesce((select sum(amount) from public.transactions where ledger_id = p_ledger_id and type = 'income' and txn_date between m_start and m_end), 0),
    'expense', coalesce((select sum(app.txn_expense_share(t.id, t.amount, t.fx_rate, v_my_member)) from public.transactions t where t.ledger_id = p_ledger_id and t.type = 'expense' and t.txn_date between m_start and m_end), 0)
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

-- ── #10: which transactions are split (so the UI can flag them) ───────────────
create or replace function public.list_split_txn_ids(p_user_id uuid, p_ledger_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(distinct s.transaction_id), '[]'::jsonb) into v_res
  from public.transaction_splits s where s.ledger_id = p_ledger_id;
  return v_res;
end;
$$;

-- ── #11: account txn_count in get_ledger + optional reassign on delete ────────
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
        'sort_order', a.sort_order, 'balance', app.account_balance(a.id),
        'txn_count', (select count(*) from public.transactions t where t.account_id = a.id or t.transfer_account_id = a.id)) order by a.sort_order, a.created_at)
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

drop function if exists public.delete_account(uuid, uuid);
create or replace function public.delete_account(p_user_id uuid, p_account_id uuid, p_reassign_to_account_id uuid default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_n int;
begin
  select ledger_id into v_ledger from public.accounts where id = p_account_id;
  if v_ledger is null then return false; end if;
  if not app.can_access_ledger(v_ledger, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reassign_to_account_id is not null then
    if not exists (select 1 from public.accounts where id = p_reassign_to_account_id and ledger_id = v_ledger) then
      raise exception 'reassign target not in this ledger' using errcode = 'P0002';
    end if;
    update public.transactions set account_id = p_reassign_to_account_id where account_id = p_account_id;
    update public.transactions set transfer_account_id = p_reassign_to_account_id where transfer_account_id = p_account_id;
  end if;
  delete from public.accounts where id = p_account_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── #24: add_ledger_member email that doesn't match → name-only guest ─────────
-- (was: raise 'no Mnema user with that email', which leaked whether an email is
-- a registered account). Now an unmatched email silently adds a guest, so the
-- success/failure response no longer distinguishes registered emails.
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
    if v_member_uid is not null and exists (select 1 from public.ledger_members where ledger_id = p_ledger_id and user_id = v_member_uid) then
      raise exception 'already a member' using errcode = '23505';
    end if;
    -- v_member_uid stays null when the email isn't a registered user → joins as guest
  end if;
  insert into public.ledger_members (ledger_id, user_id, display_name, role, added_by)
  values (p_ledger_id, v_member_uid, p_display_name, case when p_role in ('editor', 'viewer') then p_role else 'editor' end, v_actor)
  returning * into v_row;
  return v_row;
end;
$$;

-- ── Grants + anon re-hardening (new / re-signed functions) ────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.list_split_txn_ids(uuid,uuid)',
    'public.delete_account(uuid,uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
