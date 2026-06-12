-- ════════════════════════════════════════════════════════════════════════════
-- 0042 · Allow clearing a recipe's photo.
--
-- update_recipe coalesced nullif(p_image_url,'') into the old value, so passing
-- '' (the "clear" convention used by set_task_url) silently kept the previous
-- image — add/replace worked but removal was impossible. Now: null = unchanged,
-- '' = clear, value = set. Same signature, so create-or-replace suffices.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.update_recipe(
  p_user_id uuid, p_recipe_id uuid,
  p_title text default null, p_description text default null, p_instructions text default null,
  p_ingredients jsonb default null, p_servings integer default null, p_total_minutes integer default null,
  p_tags text[] default null, p_source_url text default null, p_image_url text default null,
  p_is_favorite boolean default null
)
returns public.recipes language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.recipes;
begin
  update public.recipes set
    title         = coalesce(nullif(p_title, ''), title),
    description   = coalesce(nullif(p_description, ''), description),
    instructions  = coalesce(nullif(p_instructions, ''), instructions),
    ingredients   = coalesce(p_ingredients, ingredients),
    servings      = coalesce(p_servings, servings),
    total_minutes = coalesce(p_total_minutes, total_minutes),
    tags          = coalesce(p_tags, tags),
    source_url    = coalesce(nullif(p_source_url, ''), source_url),
    image_url     = case when p_image_url is null then image_url else nullif(p_image_url, '') end,
    is_favorite   = coalesce(p_is_favorite, is_favorite)
  where id = p_recipe_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'recipe not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.update_recipe(uuid,uuid,text,text,text,jsonb,integer,integer,text[],text,text,boolean) from public;
grant execute on function public.update_recipe(uuid,uuid,text,text,text,jsonb,integer,integer,text[],text,text,boolean) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
