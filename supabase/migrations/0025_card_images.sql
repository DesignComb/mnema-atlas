-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0025 · Image flashcards — Supabase Storage + cards.image_url                ║
-- ║                                                                            ║
-- ║ Storage lives in Supabase (not Cloudflare R2) so it travels with every     ║
-- ║ self-hoster's project — no extra service to provision. A single public     ║
-- ║ `uploads` bucket, write-scoped per user via the {uid}/… folder convention; ║
-- ║ objects are readable by URL (unguessable path) for <img> display.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.cards add column if not exists image_url text;

-- ── Storage bucket (public read; 5MB; images only) ──────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Writes are scoped to the user's own top-level folder ({uid}/...); reads are public.
drop policy if exists uploads_read_public on storage.objects;
create policy uploads_read_public on storage.objects
  for select to public using (bucket_id = 'uploads');

drop policy if exists uploads_insert_own on storage.objects;
create policy uploads_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists uploads_update_own on storage.objects;
create policy uploads_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists uploads_delete_own on storage.objects;
create policy uploads_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── create_card: add p_image_url (drop the old overload first) ───────────────
drop function if exists public.create_card(uuid, text, text, uuid, uuid, text);
create or replace function public.create_card(
  p_user_id uuid,
  p_front text,
  p_back text,
  p_note_id uuid default null,
  p_deck_id uuid default null,
  p_created_via text default 'ui',
  p_image_url text default null
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.cards;
begin
  if p_note_id is not null
     and not exists (select 1 from public.notes where id = p_note_id and user_id = v_uid) then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  if p_deck_id is not null
     and not exists (select 1 from public.decks where id = p_deck_id and user_id = v_uid) then
    raise exception 'deck not found' using errcode = 'P0002';
  end if;
  insert into public.cards (
    user_id, note_id, deck_id, front, back, image_url,
    state, due, elapsed_days, scheduled_days, learning_steps, reps, lapses, created_via
  )
  values (v_uid, p_note_id, p_deck_id, p_front, p_back, p_image_url,
          0, now(), 0, 0, 0, 0, 0, p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

-- ── update_card: add p_image_url (drop the old overload first) ───────────────
drop function if exists public.update_card(uuid, uuid, text, text, uuid, uuid);
create or replace function public.update_card(
  p_user_id uuid,
  p_card_id uuid,
  p_front text default null,
  p_back text default null,
  p_deck_id uuid default null,
  p_note_id uuid default null,
  p_image_url text default null
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.cards;
begin
  if p_deck_id is not null
     and not exists (select 1 from public.decks where id = p_deck_id and user_id = v_uid) then
    raise exception 'deck not found' using errcode = 'P0002';
  end if;
  if p_note_id is not null
     and not exists (select 1 from public.notes where id = p_note_id and user_id = v_uid) then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  update public.cards
     set front     = coalesce(p_front, front),
         back      = coalesce(p_back, back),
         deck_id   = coalesce(p_deck_id, deck_id),
         note_id   = coalesce(p_note_id, note_id),
         -- pass an empty string to CLEAR the image; null leaves it unchanged
         image_url = case when p_image_url is null then image_url
                          when p_image_url = '' then null
                          else p_image_url end
   where id = p_card_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- ── Re-lock the re-created functions + the app-wide anon lockdown ────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_card(uuid,text,text,uuid,uuid,text,text)',
    'public.update_card(uuid,uuid,text,text,uuid,uuid,text)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
