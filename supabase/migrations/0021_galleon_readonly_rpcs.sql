-- 0021: Galleon read-only RPCs that close the create/list/get/delete asymmetry
-- (gap-review #2/#3/#4/#10). Without these, an AI that didn't itself create a
-- member / settlement / recurring template can never obtain its id to
-- update/delete it, and can't inspect an existing transaction's splits before
-- overwriting them. All membership-aware via app.can_access_ledger.

create or replace function public.list_ledger_members(p_user_id uuid, p_ledger_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_res jsonb;
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', m.id, 'display_name', m.display_name, 'user_id', m.user_id, 'role', m.role
  ) order by m.created_at), '[]'::jsonb)
  into v_res from public.ledger_members m where m.ledger_id = p_ledger_id;
  return v_res;
end;
$$;

create or replace function public.list_settlements(p_user_id uuid, p_ledger_id uuid)
returns setof public.settlements language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  return query select * from public.settlements where ledger_id = p_ledger_id order by sett_date desc, created_at desc;
end;
$$;

create or replace function public.list_recurring(p_user_id uuid, p_ledger_id uuid)
returns setof public.recurring_transactions language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_ledger(p_ledger_id, v_uid, false) then raise exception 'ledger not found' using errcode = 'P0002'; end if;
  return query select * from public.recurring_transactions where ledger_id = p_ledger_id order by next_run;
end;
$$;

create or replace function public.get_transaction(p_user_id uuid, p_transaction_id uuid)
returns jsonb language plpgsql security definer stable set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_ledger uuid; v_res jsonb;
begin
  select ledger_id into v_ledger from public.transactions where id = p_transaction_id;
  if v_ledger is null then raise exception 'transaction not found' using errcode = 'P0002'; end if;
  if not app.can_access_ledger(v_ledger, v_uid, false) then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'transaction', to_jsonb(t.*),
    'splits', coalesce((select jsonb_agg(jsonb_build_object('member_id', s.member_id, 'paid', s.paid, 'owed', s.owed) order by s.created_at)
                        from public.transaction_splits s where s.transaction_id = t.id), '[]'::jsonb)
  ) into v_res from public.transactions t where t.id = p_transaction_id;
  return v_res;
end;
$$;

-- ── Grants + anon re-hardening (new functions default-grant to anon) ──────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.list_ledger_members(uuid,uuid)',
    'public.list_settlements(uuid,uuid)',
    'public.list_recurring(uuid,uuid)',
    'public.get_transaction(uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
