-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0047 · Itinerary item tags ("想去" candidates, classified by tag)           ║
-- ║                                                                            ║
-- ║ Two parts:                                                                  ║
-- ║  (A) Retire the standalone `places` wishlist from 0046 — the feature        ║
-- ║      belongs INSIDE a trip, not as a global Space.                          ║
-- ║  (B) Add free-form `tags` to itinerary_items so the trip's unscheduled      ║
-- ║      "想去" candidates can be classified (台南東區 / 友愛街附近 / 甜點) and   ║
-- ║      later scheduled into a day. Tags use the same text[] model as notes.   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── (A) Drop the standalone places feature (0046) ─────────────────────────────
drop function if exists public.create_place(uuid,text,text[],text,text,text,boolean,text);
drop function if exists public.update_place(uuid,uuid,text,text[],text,text,text,boolean);
drop function if exists public.delete_place(uuid,uuid);
drop function if exists public.list_places(uuid,text,text,boolean,integer);
drop function if exists public.get_place(uuid,uuid);
drop table if exists public.places cascade;

-- ── (B) Tags on itinerary items ───────────────────────────────────────────────
alter table public.itinerary_items add column if not exists tags text[] not null default '{}';
create index if not exists itinerary_items_tags_idx on public.itinerary_items using gin (tags);

-- Re-emit the item JSON so the trip tree (get_itinerary) and the public shared
-- view (get_shared_itinerary → itinerary_item_public_json) both carry tags.
create or replace function public.itinerary_item_json(i public.itinerary_items)
returns jsonb language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id, 'day_id', i.day_id, 'title', i.title, 'place', i.place,
    'lat', i.lat, 'lng', i.lng, 'category', i.category,
    'start_time', i.start_time, 'end_time', i.end_time, 'end_day_offset', i.end_day_offset,
    'transport_mode', i.transport_mode, 'transport_detail', i.transport_detail,
    'cost', i.cost, 'currency', i.currency, 'booking_url', i.booking_url,
    'booking_ref', i.booking_ref, 'notes', i.notes, 'sort_order', i.sort_order,
    'status', i.status, 'assignees', i.assignees, 'tags', i.tags
  );
$$;

-- Set an item's tags (membership-aware, same shape as set_item_assignees).
-- Tags are normalised like set_note_tags: trimmed, de-duped, ≤40 chars, ≤12.
create or replace function public.set_item_tags(p_user_id uuid, p_item_id uuid, p_tags text[])
returns public.itinerary_items language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.resolve_uid(p_user_id);
  v_itin  uuid;
  v_clean text[];
  v_row   public.itinerary_items;
begin
  select itinerary_id into v_itin from public.itinerary_items where id = p_item_id;
  if v_itin is null then raise exception 'item not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select array(
    select distinct left(trim(t), 40)
      from unnest(coalesce(p_tags, '{}')) as t
     where trim(t) <> ''
     limit 12
  ) into v_clean;
  update public.itinerary_items set tags = v_clean where id = p_item_id returning * into v_row;
  return v_row;
end;
$$;

-- ── Grants + anon re-hardening ────────────────────────────────────────────────
revoke all on function public.set_item_tags(uuid,uuid,text[]) from public;
grant execute on function public.set_item_tags(uuid,uuid,text[]) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
