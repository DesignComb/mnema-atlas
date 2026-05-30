-- ════════════════════════════════════════════════════════════════════════
-- Mnema Atlas — API key scopes
-- Distinguishes ADD-ONLY (contributor) keys from FULL keys so an external AI
-- can be handed a key that may only *create* content (+ read), never modify or
-- delete. The Worker gates the one mutating tool (update_note) behind an 'edit'
-- scope. A key is add-only unless its scopes array contains 'edit'.
--
-- Isolation is unchanged and absolute: a key still resolves to exactly one
-- user_id, and every RPC stamps/filters on that id — a key can never touch
-- another user's rows. There is still no delete path anywhere.
-- ════════════════════════════════════════════════════════════════════════

-- verify_api_key must now also hand the Worker the key's scopes. Its return type
-- changes (uuid → table), so it has to be dropped and recreated.
drop function if exists public.verify_api_key(text);

create or replace function public.verify_api_key(p_key_hash text)
returns table (user_id uuid, scopes text[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.api_keys
     set last_used_at = now()
   where key_hash = p_key_hash
     and revoked_at is null
     and (expires_at is null or expires_at > now())
  returning api_keys.user_id, api_keys.scopes;
  -- zero rows when missing / revoked / expired
end;
$$;

revoke all on function public.verify_api_key(text) from public;
grant execute on function public.verify_api_key(text) to service_role;

-- New keys default to add-only. The UI passes scopes explicitly
-- (['create'] or ['create','edit']); this default only matters for keys minted
-- without an explicit scopes argument.
create or replace function public.create_api_key(
  p_user_id uuid,
  p_name text,
  p_scopes text[] default '{create}'
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
  v_key := 'mk_' || translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_prefix := substring(v_key for 11);
  insert into public.api_keys (user_id, name, key_hash, key_prefix, scopes)
  values (v_uid, p_name, encode(extensions.digest(v_key, 'sha256'), 'hex'), v_prefix, p_scopes)
  returning public.api_keys.id into v_id;
  return query select v_id, v_key, v_prefix;
end;
$$;

revoke all on function public.create_api_key(uuid,text,text[]) from public;
grant execute on function public.create_api_key(uuid,text,text[]) to authenticated, service_role;
