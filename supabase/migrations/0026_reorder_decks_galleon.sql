-- 0026 — drag-to-reorder for decks (Study) + accounts & categories (Galleon).
-- accounts/categories already carry sort_order (0016); decks gains it here.
-- Mirrors the reorder_tasks/reorder_task_lists pattern: bulk-set sort_order from
-- the id array's ordinality. Galleon variants gate on ledger write-access.

-- ── Decks ────────────────────────────────────────────────────────────────
alter table public.decks add column if not exists sort_order integer not null default 0;
create index if not exists decks_user_sort_idx on public.decks (user_id, sort_order);

create or replace function public.reorder_decks(p_user_id uuid, p_deck_ids uuid[])
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  update public.decks d set sort_order = u.ord - 1
  from unnest(p_deck_ids) with ordinality as u(id, ord)
  where d.id = u.id and d.user_id = v_uid;
  return true;
end;
$$;

-- ── Galleon: accounts ──────────────────────────────────────────────────────
create or replace function public.reorder_accounts(p_user_id uuid, p_ledger_id uuid, p_account_ids uuid[])
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.accounts a set sort_order = u.ord - 1
  from unnest(p_account_ids) with ordinality as u(id, ord)
  where a.id = u.id and a.ledger_id = p_ledger_id;
  return true;
end;
$$;

-- ── Galleon: categories (caller passes one kind's ids; list sorts by kind, sort_order) ──
create or replace function public.reorder_categories(p_user_id uuid, p_ledger_id uuid, p_category_ids uuid[])
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_ledger(p_ledger_id, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.categories c set sort_order = u.ord - 1
  from unnest(p_category_ids) with ordinality as u(id, ord)
  where c.id = u.id and c.ledger_id = p_ledger_id;
  return true;
end;
$$;

-- ── Grants (authenticated + service_role; never anon — app-wide lockdown) ────
revoke all on function public.reorder_decks(uuid, uuid[]) from public;
grant execute on function public.reorder_decks(uuid, uuid[]) to authenticated, service_role;
revoke all on function public.reorder_accounts(uuid, uuid, uuid[]) from public;
grant execute on function public.reorder_accounts(uuid, uuid, uuid[]) to authenticated, service_role;
revoke all on function public.reorder_categories(uuid, uuid, uuid[]) from public;
grant execute on function public.reorder_categories(uuid, uuid, uuid[]) to authenticated, service_role;

-- Re-assert the app-wide anon lockdown + the single anon-allowed function
-- (Supabase re-grants EXECUTE to PUBLIC on every new function — see 0024).
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
