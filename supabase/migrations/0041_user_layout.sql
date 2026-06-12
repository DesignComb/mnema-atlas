-- ════════════════════════════════════════════════════════════════════════════
-- 0041 · User layout preferences — customizable screen layouts, starting with
-- the Today screen's sections (order + visibility).
--
-- One row per user; `layout` is a jsonb object keyed by surface so later
-- surfaces (per-space dashboards…) can join without new migrations:
--   { "today": [ { "key": "journal", "hidden": false }, … ] }
-- Synced (not localStorage) so a second device sees the same layout.
-- Same conventions as health_settings (0027): select-only RLS, writes via a
-- SECURITY DEFINER upsert RPC that patches one surface at a time.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.user_layout (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  layout     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_layout enable row level security;
drop policy if exists user_layout_select on public.user_layout;
create policy user_layout_select on public.user_layout
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_user_layout(
  p_user_id uuid,
  p_surface text,
  p_sections jsonb
)
returns public.user_layout
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.user_layout;
begin
  if p_surface is null or p_surface !~ '^[a-z][a-z0-9_-]{0,31}$' then
    raise exception 'invalid surface key' using errcode = '23514';
  end if;
  if p_sections is null or jsonb_typeof(p_sections) <> 'array' then
    raise exception 'sections must be a json array' using errcode = '23514';
  end if;
  if pg_column_size(p_sections) > 8192 then
    raise exception 'layout too large' using errcode = '23514';
  end if;
  insert into public.user_layout (user_id, layout, updated_at)
  values (v_uid, jsonb_build_object(p_surface, p_sections), now())
  on conflict (user_id) do update set
    layout     = public.user_layout.layout || jsonb_build_object(p_surface, p_sections),
    updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.set_user_layout(uuid,text,jsonb) from public;
grant execute on function public.set_user_layout(uuid,text,jsonb) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
