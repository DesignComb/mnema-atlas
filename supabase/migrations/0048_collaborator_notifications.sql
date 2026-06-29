-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0048 · Collaborator-added notifications (push + email)                      ║
-- ║                                                                            ║
-- ║ When a trip owner adds a NEW collaborator, enqueue a notification. The      ║
-- ║ worker's per-minute cron fans it out to the recipient's web-push + FCM      ║
-- ║ devices and (once Resend is configured) email. Postgres can't send push/    ║
-- ║ email itself, so add_member only enqueues; the worker delivers + marks.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists public.collaborator_notifications (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  added_by     uuid references auth.users(id) on delete set null,
  role         text not null default 'viewer',
  created_at   timestamptz not null default now(),
  notified_at  timestamptz
);
create index if not exists collab_notif_pending_idx
  on public.collaborator_notifications (created_at) where notified_at is null;

-- Worker-only table: no client reads/writes it directly. RLS on with NO policies
-- = deny all to anon/authenticated; the service role + SECURITY DEFINER writers
-- (add_member / the cron finders) bypass RLS.
alter table public.collaborator_notifications enable row level security;

-- ── add_member: redefined to enqueue a notification on a genuinely NEW add ──────
-- (Unchanged from 0010 except the v_is_new pre-check + the enqueue insert.)
create or replace function public.add_member(p_user_id uuid, p_itinerary_id uuid, p_email text, p_role text)
returns public.itinerary_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor  uuid := app.resolve_uid(p_user_id);
  v_owner  uuid;
  v_target uuid;
  v_row    public.itinerary_members;
  v_is_new boolean;
begin
  select owner_id into v_owner from public.itineraries where id = p_itinerary_id;
  if not found then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  if v_owner <> v_actor then raise exception 'only the owner can manage members' using errcode = '42501'; end if;
  if coalesce(p_role, 'viewer') not in ('viewer', 'editor') then
    raise exception 'role must be viewer or editor' using errcode = '22023';
  end if;
  select id into v_target from auth.users where lower(email) = lower(trim(p_email));
  if v_target is null then raise exception 'no Mnema Atlas user with that email' using errcode = 'P0002'; end if;
  if v_target = v_owner then raise exception 'the owner is already on this trip' using errcode = '22023'; end if;

  -- A genuinely new collaborator (vs a role change on an existing one) — only new
  -- ones get a "you were added" notification.
  v_is_new := not exists (
    select 1 from public.itinerary_members
    where itinerary_id = p_itinerary_id and user_id = v_target
  );

  insert into public.itinerary_members (itinerary_id, user_id, role, added_by)
  values (p_itinerary_id, v_target, coalesce(p_role, 'viewer'), v_actor)
  on conflict (itinerary_id, user_id) do update set role = excluded.role
  returning * into v_row;

  if v_is_new then
    insert into public.collaborator_notifications (itinerary_id, recipient_id, added_by, role)
    values (p_itinerary_id, v_target, v_actor, coalesce(p_role, 'viewer'));
  end if;

  return v_row;
end;
$$;

-- ── Cron finder: pending notifications + the recipient's devices + trip title ───
-- (Mirrors due_reminders_for_cron's subscription/fcm aggregation, 0037.)
create or replace function public.due_collaborator_notifications_for_cron()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', cn.id,
      'itinerary_id', cn.itinerary_id,
      'trip_title', it.title,
      'role', cn.role,
      'recipient_email', u.email,
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s where s.user_id = cn.recipient_id), '[]'::jsonb),
      'fcm_tokens', coalesce((
        select jsonb_agg(f.token) from public.fcm_tokens f where f.user_id = cn.recipient_id), '[]'::jsonb)
    ))
    from public.collaborator_notifications cn
    join public.itineraries it on it.id = cn.itinerary_id
    join auth.users u on u.id = cn.recipient_id
    where cn.notified_at is null
  ), '[]'::jsonb);
end;
$$;

-- Cron-only: mark a queued notification delivered so it won't fire again.
create or replace function public.mark_collaborator_notified(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.collaborator_notifications set notified_at = now() where id = p_id;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
revoke all on function public.add_member(uuid, uuid, text, text) from public;
grant execute on function public.add_member(uuid, uuid, text, text) to authenticated, service_role;
revoke all on function public.due_collaborator_notifications_for_cron() from public, anon, authenticated;
grant execute on function public.due_collaborator_notifications_for_cron() to service_role;
revoke all on function public.mark_collaborator_notified(uuid) from public, anon, authenticated;
grant execute on function public.mark_collaborator_notified(uuid) to service_role;

-- Keep anon locked out of everything but the one public share endpoint (mirrors 0037).
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
