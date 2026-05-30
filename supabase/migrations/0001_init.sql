-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — initial schema
-- Personal-now, multi-user-ready. Every user-owned row carries user_id and is
-- guarded by RLS. ALL writes funnel through SECURITY DEFINER RPCs (the shared
-- write path) so UI / MCP / REST produce byte-identical content and a server
-- caller can never spoof another user's id.
--
-- pgvector / embeddings are intentionally deferred to a later (Phase 5)
-- migration to keep this first migration runnable on any Postgres.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- Internal helper schema. NOT exposed through the PostgREST API.
create schema if not exists app;

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: resolve the effective owner for a write.
--   • authenticated end-user  → may only ever act as themselves (auth.uid())
--   • service role (the Worker) → must pass p_user_id explicitly, trusted
-- This is the security spine: the server bypasses RLS, so correctness rests
-- on this function stamping the *resolved* user_id, never a client-supplied one.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function app.resolve_uid(p_user_id uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is not null then
    if p_user_id is not null and p_user_id <> v_caller then
      raise exception 'forbidden: cannot act on behalf of another user'
        using errcode = '42501';
    end if;
    return v_caller;
  end if;
  -- No JWT subject → service-role call (the Worker). It must name the owner.
  if p_user_id is null then
    raise exception 'p_user_id is required for service-role calls'
      using errcode = '22023';
  end if;
  return p_user_id;
end;
$$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════ TABLES ═══════════════════════════

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.decks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  parent_deck_id uuid references public.decks(id) on delete set null,
  name           text not null,
  description    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  deck_id    uuid references public.decks(id) on delete set null,
  title      text not null,
  body       text not null default '',
  -- 'simple' config = language-agnostic tokenisation (works acceptably for CJK
  -- alongside the ilike fallback in search_notes).
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FSRS card. Field set matches ts-fsrs v5 Card exactly (incl. learning_steps).
create table public.cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  note_id        uuid references public.notes(id) on delete cascade,  -- null = standalone
  deck_id        uuid references public.decks(id) on delete set null,
  front          text not null,
  back           text not null,
  -- FSRS scheduling state (all timestamps timestamptz/UTC) ----------------
  state          smallint not null default 0,           -- 0 New 1 Learning 2 Review 3 Relearning
  due            timestamptz not null default now(),
  stability      double precision,
  difficulty     double precision,
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  last_review    timestamptz,
  -- provenance: distinguishes AI-added cards without an extra table -------
  created_via    text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.note_links (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  source_note_id uuid not null references public.notes(id) on delete cascade,
  target_note_id uuid not null references public.notes(id) on delete cascade,
  link_type      text not null default 'reference'
                 check (link_type in ('reference', 'related', 'parent', 'child', 'elaborates')),
  weight         real not null default 1,
  created_at     timestamptz not null default now(),
  constraint note_links_no_self check (source_note_id <> target_note_id),
  constraint note_links_unique unique (source_note_id, target_note_id, link_type)
);

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text,
  created_at timestamptz not null default now(),
  constraint tags_unique_name unique (user_id, name)
);

create table public.note_tags (
  note_id uuid not null references public.notes(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (note_id, tag_id)
);

-- Append-only FSRS review history (powers future optimisation).
create table public.review_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  card_id           uuid not null references public.cards(id) on delete cascade,
  rating            smallint not null,        -- 1 Again 2 Hard 3 Good 4 Easy
  state             smallint not null,
  due               timestamptz,
  stability         double precision,
  difficulty        double precision,
  elapsed_days      integer,
  last_elapsed_days integer,
  scheduled_days    integer,
  learning_steps    integer,
  review            timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  key_hash     text not null unique,           -- sha256 hex, never the plaintext
  key_prefix   text not null,                  -- first chars, shown in the UI for recognition
  scopes       text[] not null default '{write}',
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ═══════════════════════════ INDEXES ═══════════════════════════
create index decks_user_idx        on public.decks (user_id);
create index decks_parent_idx      on public.decks (user_id, parent_deck_id);
create index notes_user_idx        on public.notes (user_id);
create index notes_deck_idx        on public.notes (user_id, deck_id);
create index notes_tsv_idx         on public.notes using gin (search_tsv);
create index cards_due_idx         on public.cards (user_id, due);     -- the "due now" queue
create index cards_deck_idx        on public.cards (user_id, deck_id);
create index cards_note_idx        on public.cards (note_id);
create index note_links_user_idx   on public.note_links (user_id);
create index note_links_source_idx on public.note_links (source_note_id);
create index note_links_target_idx on public.note_links (target_note_id);
create index note_tags_tag_idx     on public.note_tags (tag_id);
create index note_tags_user_idx    on public.note_tags (user_id);
create index review_logs_card_idx  on public.review_logs (card_id, review);
create index review_logs_user_idx  on public.review_logs (user_id);
create index api_keys_user_idx     on public.api_keys (user_id);

-- ═══════════════════════════ TRIGGERS ═══════════════════════════
create trigger decks_updated_at before update on public.decks
  for each row execute function app.set_updated_at();
create trigger notes_updated_at before update on public.notes
  for each row execute function app.set_updated_at();
create trigger cards_updated_at before update on public.cards
  for each row execute function app.set_updated_at();

-- Auto-create a profile row when a user signs up.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ═══════════════════════════ RLS ═══════════════════════════
-- Every public table gets RLS + four owner-scoped policies, restricted to the
-- `authenticated` role (never anon/public). auth.uid() is wrapped in (select …)
-- so the planner caches it once per statement.
alter table public.profiles    enable row level security;
alter table public.decks       enable row level security;
alter table public.notes       enable row level security;
alter table public.cards       enable row level security;
alter table public.note_links  enable row level security;
alter table public.tags        enable row level security;
alter table public.note_tags   enable row level security;
alter table public.review_logs enable row level security;
alter table public.api_keys    enable row level security;

-- profiles: owner is the row id itself
create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Generic owner policies for the user_id tables.
-- (Writes happen via SECURITY DEFINER RPCs, but SELECT goes straight through RLS.)
do $$
declare t text;
begin
  foreach t in array array[
    'decks','notes','cards','note_links','tags','note_tags','review_logs','api_keys'
  ]
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = user_id);',
      t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select auth.uid()) = user_id);',
      t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);',
      t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated using ((select auth.uid()) = user_id);',
      t);
  end loop;
end;
$$;

-- ═══════════════════════ SHARED WRITE RPCs ═══════════════════════
-- All SECURITY DEFINER + search_path='' + fully-qualified names. Called
-- identically by the React UI (auth.uid()) and the Worker (service role,
-- explicit p_user_id). Execute is granted ONLY to authenticated + service_role.

create or replace function public.create_deck(
  p_user_id uuid,
  p_name text,
  p_parent_deck_id uuid default null,
  p_description text default null
)
returns public.decks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.decks;
begin
  if p_parent_deck_id is not null
     and not exists (select 1 from public.decks where id = p_parent_deck_id and user_id = v_uid) then
    raise exception 'parent deck not found' using errcode = 'P0002';
  end if;
  insert into public.decks (user_id, name, parent_deck_id, description)
  values (v_uid, p_name, p_parent_deck_id, p_description)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.create_note(
  p_user_id uuid,
  p_title text,
  p_body text default '',
  p_deck_id uuid default null,
  p_created_via text default 'ui'
)
returns public.notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.notes;
begin
  if p_deck_id is not null
     and not exists (select 1 from public.decks where id = p_deck_id and user_id = v_uid) then
    raise exception 'deck not found' using errcode = 'P0002';
  end if;
  insert into public.notes (user_id, title, body, deck_id)
  values (v_uid, p_title, coalesce(p_body, ''), p_deck_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_note(
  p_user_id uuid,
  p_note_id uuid,
  p_title text default null,
  p_body text default null,
  p_deck_id uuid default null
)
returns public.notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.notes;
begin
  update public.notes
     set title = coalesce(p_title, title),
         body  = coalesce(p_body, body),
         deck_id = coalesce(p_deck_id, deck_id)
   where id = p_note_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Initialises a brand-new FSRS card (state=New, due=now) so it is schedulable
-- the instant it is created — including when an AI tool inserts it.
create or replace function public.create_card(
  p_user_id uuid,
  p_front text,
  p_back text,
  p_note_id uuid default null,
  p_deck_id uuid default null,
  p_created_via text default 'ui'
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
    user_id, note_id, deck_id, front, back,
    state, due, elapsed_days, scheduled_days, learning_steps, reps, lapses, created_via
  )
  values (v_uid, p_note_id, p_deck_id, p_front, p_back,
          0, now(), 0, 0, 0, 0, 0, p_created_via)
  returning * into v_row;
  return v_row;
end;
$$;

-- Bulk insert (one transaction) for AI tools adding many cards at once.
create or replace function public.create_flashcards_bulk(
  p_user_id uuid,
  p_cards jsonb,
  p_deck_id uuid default null,
  p_created_via text default 'mcp'
)
returns setof public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_el  jsonb;
begin
  for v_el in select * from jsonb_array_elements(p_cards)
  loop
    return query
      select * from public.create_card(
        v_uid,
        v_el ->> 'front',
        v_el ->> 'back',
        coalesce((v_el ->> 'note_id')::uuid, null),
        coalesce((v_el ->> 'deck_id')::uuid, p_deck_id),
        p_created_via
      );
  end loop;
end;
$$;

create or replace function public.link_notes(
  p_user_id uuid,
  p_source_note_id uuid,
  p_target_note_id uuid,
  p_link_type text default 'reference',
  p_weight real default 1
)
returns public.note_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.note_links;
begin
  if not exists (select 1 from public.notes where id = p_source_note_id and user_id = v_uid)
     or not exists (select 1 from public.notes where id = p_target_note_id and user_id = v_uid) then
    raise exception 'source or target note not found' using errcode = 'P0002';
  end if;
  insert into public.note_links (user_id, source_note_id, target_note_id, link_type, weight)
  values (v_uid, p_source_note_id, p_target_note_id, p_link_type, p_weight)
  on conflict (source_note_id, target_note_id, link_type)
    do update set weight = excluded.weight
  returning * into v_row;
  return v_row;
end;
$$;

-- Persists an FSRS grade atomically: update the card + append a review log.
-- The authoritative ts-fsrs next() runs in JS (Worker/Edge); this only stores
-- the resulting Card and ReviewLog (passed as jsonb).
create or replace function public.record_review(
  p_user_id uuid,
  p_card_id uuid,
  p_card jsonb,
  p_log jsonb
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
  update public.cards set
    state          = (p_card ->> 'state')::smallint,
    due            = (p_card ->> 'due')::timestamptz,
    stability      = (p_card ->> 'stability')::double precision,
    difficulty     = (p_card ->> 'difficulty')::double precision,
    elapsed_days   = coalesce((p_card ->> 'elapsed_days')::int, 0),
    scheduled_days = coalesce((p_card ->> 'scheduled_days')::int, 0),
    learning_steps = coalesce((p_card ->> 'learning_steps')::int, 0),
    reps           = coalesce((p_card ->> 'reps')::int, 0),
    lapses         = coalesce((p_card ->> 'lapses')::int, 0),
    last_review    = (p_card ->> 'last_review')::timestamptz
  where id = p_card_id and user_id = v_uid
  returning * into v_row;

  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;

  insert into public.review_logs (
    user_id, card_id, rating, state, due, stability, difficulty,
    elapsed_days, last_elapsed_days, scheduled_days, learning_steps, review
  )
  values (
    v_uid, p_card_id,
    (p_log ->> 'rating')::smallint,
    (p_log ->> 'state')::smallint,
    (p_log ->> 'due')::timestamptz,
    (p_log ->> 'stability')::double precision,
    (p_log ->> 'difficulty')::double precision,
    (p_log ->> 'elapsed_days')::int,
    (p_log ->> 'last_elapsed_days')::int,
    (p_log ->> 'scheduled_days')::int,
    (p_log ->> 'learning_steps')::int,
    coalesce((p_log ->> 'review')::timestamptz, now())
  );
  return v_row;
end;
$$;

create or replace function public.search_notes(
  p_user_id uuid,
  p_query text,
  p_limit int default 20
)
returns setof public.notes
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select n.*
      from public.notes n
     where n.user_id = v_uid
       and (
         n.search_tsv @@ websearch_to_tsquery('simple', p_query)
         or n.title ilike '%' || p_query || '%'
         or n.body  ilike '%' || p_query || '%'
       )
     order by n.updated_at desc
     limit greatest(1, least(p_limit, 100));
end;
$$;

-- One round-trip for the whole graph: {nodes:[…], edges:[…]}.
create or replace function public.get_graph(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
begin
  return jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'deck_id', n.deck_id))
        from public.notes n where n.user_id = v_uid), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object(
               'source', l.source_note_id, 'target', l.target_note_id,
               'type', l.link_type, 'weight', l.weight))
        from public.note_links l where l.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;

-- ═══════════════════════ API-KEY RPCs (REST/MCP auth) ═══════════════════════

-- Owner mints a key. Plaintext is returned exactly ONCE; only the hash is stored.
create or replace function public.create_api_key(
  p_user_id uuid,
  p_name text,
  p_scopes text[] default '{write}'
)
returns table (id uuid, api_key text, key_prefix text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := app.resolve_uid(p_user_id);
  v_key    text;
  v_prefix text;
  v_id     uuid;
begin
  -- url-safe random token
  v_key := 'mk_' || translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_prefix := substring(v_key for 11);
  insert into public.api_keys (user_id, name, key_hash, key_prefix, scopes)
  values (v_uid, p_name, encode(extensions.digest(v_key, 'sha256'), 'hex'), v_prefix, p_scopes)
  returning public.api_keys.id into v_id;
  return query select v_id, v_key, v_prefix;
end;
$$;

-- Worker-only: exchange a key hash for its owner, stamping last_used_at.
create or replace function public.verify_api_key(p_key_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  update public.api_keys
     set last_used_at = now()
   where key_hash = p_key_hash
     and revoked_at is null
     and (expires_at is null or expires_at > now())
  returning user_id into v_uid;
  return v_uid;   -- null when not found / revoked / expired
end;
$$;

-- ═══════════════════════ GRANTS (lock down execution) ═══════════════════════
-- New functions default to EXECUTE for PUBLIC — revoke, then grant narrowly.
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_deck(uuid,text,uuid,text)',
    'public.create_note(uuid,text,text,uuid,text)',
    'public.update_note(uuid,uuid,text,text,uuid)',
    'public.create_card(uuid,text,text,uuid,uuid,text)',
    'public.create_flashcards_bulk(uuid,jsonb,uuid,text)',
    'public.link_notes(uuid,uuid,uuid,text,real)',
    'public.record_review(uuid,uuid,jsonb,jsonb)',
    'public.search_notes(uuid,text,int)',
    'public.get_graph(uuid)',
    'public.create_api_key(uuid,text,text[])'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- verify_api_key is server-only: never callable by anon or authenticated users.
revoke all on function public.verify_api_key(text) from public;
grant execute on function public.verify_api_key(text) to service_role;
