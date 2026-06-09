-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0037 · FCM device tokens (native Android push)                              ║
-- ║                                                                            ║
-- ║ Web Push (push_subscriptions) only reaches browsers/PWAs; the Capacitor    ║
-- ║ native app's WebView can't receive it. Native push rides FCM, so each       ║
-- ║ install registers an FCM token here (mirrors push_subscriptions). The cron  ║
-- ║ finders now also return each user's fcm_tokens so the worker fans a         ║
-- ║ reminder/digest out to BOTH web subscriptions and FCM tokens.              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists public.fcm_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token        text not null,
  platform     text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint fcm_tokens_user_token_unique unique (user_id, token)
);
create index if not exists fcm_tokens_user_idx on public.fcm_tokens (user_id);

drop trigger if exists fcm_tokens_quota on public.fcm_tokens;
create trigger fcm_tokens_quota before insert on public.fcm_tokens
  for each row execute function app.enforce_row_quota('50', 'user_id');

alter table public.fcm_tokens enable row level security;
drop policy if exists fcm_tokens_select on public.fcm_tokens;
create policy fcm_tokens_select on public.fcm_tokens
  for select to authenticated using ((select auth.uid()) = user_id);

-- ── Owner RPCs ────────────────────────────────────────────────────────────────
create or replace function public.save_fcm_token(p_user_id uuid, p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  insert into public.fcm_tokens (user_id, token, platform)
  values (v_uid, p_token, coalesce(p_platform, 'android'))
  on conflict (user_id, token) do update set last_seen_at = now(), platform = excluded.platform;
end;
$$;

create or replace function public.delete_fcm_token(p_user_id uuid, p_token text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  delete from public.fcm_tokens where user_id = v_uid and token = p_token;
end;
$$;

-- Cron-only: drop a token FCM reports as unregistered.
create or replace function public.prune_fcm_token(p_token text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.fcm_tokens where token = p_token;
end;
$$;

-- ── Cron finders: add fcm_tokens alongside the existing web subscriptions ──────
create or replace function public.due_reminders_for_cron()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'reminder_id', r.id, 'task_id', t.id, 'title', t.title,
      'body', coalesce(t.description, ''),
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s where s.user_id = r.user_id), '[]'::jsonb),
      'fcm_tokens', coalesce((
        select jsonb_agg(f.token) from public.fcm_tokens f where f.user_id = r.user_id), '[]'::jsonb)
    ))
    from public.task_reminders r join public.tasks t on t.id = r.task_id
    where r.status = 'pending' and r.remind_at <= now() and t.status = 'todo'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.due_todo_digests_for_cron()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.user_id,
      'count', (
        select count(*) from public.tasks t
        where t.user_id = p.user_id and t.status = 'todo' and t.kind <> 'habit'
          and ((t.due_date is not null and t.due_date <= (now() at time zone coalesce(p.tz, 'UTC'))::date)
               or t.scheduled_date = (now() at time zone coalesce(p.tz, 'UTC'))::date)
      ),
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_subscriptions s where s.user_id = p.user_id), '[]'::jsonb),
      'fcm_tokens', coalesce((
        select jsonb_agg(f.token) from public.fcm_tokens f where f.user_id = p.user_id), '[]'::jsonb)
    ))
    from public.digest_prefs p
    where p.is_enabled
      and (now() at time zone coalesce(p.tz, 'UTC'))::time >= p.digest_time
      and not exists (
        select 1 from public.todo_digests d
        where d.user_id = p.user_id and d.digest_date = (now() at time zone coalesce(p.tz, 'UTC'))::date
      )
  ), '[]'::jsonb);
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.save_fcm_token(uuid,text,text)', 'public.delete_fcm_token(uuid,text)']
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;
revoke all on function public.prune_fcm_token(text) from public, anon, authenticated;
grant execute on function public.prune_fcm_token(text) to service_role;
revoke all on function public.due_reminders_for_cron() from public, anon, authenticated;
grant execute on function public.due_reminders_for_cron() to service_role;
revoke all on function public.due_todo_digests_for_cron() from public, anon, authenticated;
grant execute on function public.due_todo_digests_for_cron() to service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
