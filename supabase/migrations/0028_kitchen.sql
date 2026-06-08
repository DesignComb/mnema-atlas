-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0028 · Mnema Kitchen (recipes / pantry / shopping / meal plan)              ║
-- ║                                                                            ║
-- ║ A personal cooking space: keep recipes, track what's in the pantry, build  ║
-- ║ a shopping list (auto-fillable from a recipe's ingredients), and plan      ║
-- ║ meals by day. Built for BYO-AI: "幫我把這份食譜存起來", "冰箱還有雞蛋跟    ║
-- ║ 青菜,晚餐吃什麼" — your own AI reads/writes the structured rows.            ║
-- ║                                                                            ║
-- ║ Single-owner (personal), same security spine as Captures (0024): owner-    ║
-- ║ only RLS SELECT, every write through a SECURITY DEFINER RPC that stamps     ║
-- ║ the resolved user_id. No `space` column.                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 1) Tables ─────────────────────────────────────────────────────────────────
create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 300),
  description   text check (description is null or char_length(description) <= 5000),
  instructions  text check (instructions is null or char_length(instructions) <= 50000),  -- markdown steps
  ingredients   jsonb not null default '[]',   -- [{ name, quantity, unit }]
  servings      integer,
  total_minutes integer,
  tags          text[] not null default '{}',
  source_url    text check (source_url is null or char_length(source_url) <= 2000),
  image_url     text check (image_url is null or char_length(image_url) <= 2000),
  is_favorite   boolean not null default false,
  created_via   text not null default 'ui' check (created_via in ('ui','rest','mcp')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists recipes_user_idx on public.recipes (user_id, updated_at desc);

create table if not exists public.pantry_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  quantity    numeric,
  unit        text check (unit is null or char_length(unit) <= 24),
  category    text check (category is null or char_length(category) <= 60),
  location    text check (location is null or char_length(location) <= 60),  -- fridge / freezer / pantry
  expires_on  date,
  notes       text check (notes is null or char_length(notes) <= 1000),
  created_via text not null default 'ui' check (created_via in ('ui','rest','mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pantry_items_user_idx on public.pantry_items (user_id, expires_on);

create table if not exists public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  quantity    text check (quantity is null or char_length(quantity) <= 60),
  category    text check (category is null or char_length(category) <= 60),
  is_checked  boolean not null default false,
  recipe_id   uuid references public.recipes(id) on delete set null,
  sort_order  integer not null default 0,
  created_via text not null default 'ui' check (created_via in ('ui','rest','mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists shopping_items_user_idx on public.shopping_items (user_id, is_checked, sort_order);

create table if not exists public.meal_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  plan_date   date not null,
  slot        text not null default 'dinner' check (slot in ('breakfast','lunch','dinner','snack')),
  recipe_id   uuid references public.recipes(id) on delete set null,
  title       text check (title is null or char_length(title) <= 300),
  note        text check (note is null or char_length(note) <= 1000),
  created_via text not null default 'ui' check (created_via in ('ui','rest','mcp')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists meal_plans_user_date_idx on public.meal_plans (user_id, plan_date);

-- ── 2) updated_at triggers ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['recipes','pantry_items','shopping_items','meal_plans']
  loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s;', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s for each row execute function app.set_updated_at();', t);
  end loop;
end;
$$;

-- ── 3) Per-user quotas ────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select * from (values
    ('recipes','user_id','20000'),
    ('pantry_items','user_id','50000'),
    ('shopping_items','user_id','50000'),
    ('meal_plans','user_id','200000')
  ) as v(tbl, col, cap)
  loop
    execute format('drop trigger if exists %1$s_quota on public.%1$s;', r.tbl);
    execute format('create trigger %1$s_quota before insert on public.%1$s for each row execute function app.enforce_row_quota(%2$L, %3$L);', r.tbl, r.cap, r.col);
  end loop;
end;
$$;

-- ── 4) RLS (owner-only SELECT; writes via RPC only) ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['recipes','pantry_items','shopping_items','meal_plans']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select auth.uid()) = user_id);', t);
  end loop;
end;
$$;

-- ── 5) Recipes ────────────────────────────────────────────────────────────────
create or replace function public.create_recipe(
  p_user_id uuid, p_title text,
  p_description text default null, p_instructions text default null, p_ingredients jsonb default null,
  p_servings integer default null, p_total_minutes integer default null, p_tags text[] default null,
  p_source_url text default null, p_image_url text default null, p_is_favorite boolean default false,
  p_created_via text default 'ui'
)
returns public.recipes language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.recipes;
begin
  insert into public.recipes (user_id, title, description, instructions, ingredients, servings, total_minutes, tags, source_url, image_url, is_favorite, created_via)
  values (
    v_uid, p_title, nullif(p_description, ''), nullif(p_instructions, ''), coalesce(p_ingredients, '[]'::jsonb),
    p_servings, p_total_minutes, coalesce(p_tags, '{}'), nullif(p_source_url, ''), nullif(p_image_url, ''),
    coalesce(p_is_favorite, false), coalesce(nullif(p_created_via, ''), 'ui')
  )
  returning * into v_row;
  return v_row;
end;
$$;

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
    image_url     = coalesce(nullif(p_image_url, ''), image_url),
    is_favorite   = coalesce(p_is_favorite, is_favorite)
  where id = p_recipe_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'recipe not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_recipe(p_user_id uuid, p_recipe_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.recipes where id = p_recipe_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.list_recipes(
  p_user_id uuid, p_query text default null, p_favorites_only boolean default false, p_limit integer default 200
)
returns setof public.recipes language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.recipes
    where user_id = v_uid
      and (p_query is null or p_query = '' or title ilike '%' || p_query || '%')
      and (not coalesce(p_favorites_only, false) or is_favorite)
    order by is_favorite desc, updated_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

create or replace function public.get_recipe(p_user_id uuid, p_recipe_id uuid)
returns public.recipes language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.recipes;
begin
  select * into v_row from public.recipes where id = p_recipe_id and user_id = v_uid;
  if v_row.id is null then raise exception 'recipe not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

-- ── 6) Pantry ─────────────────────────────────────────────────────────────────
create or replace function public.add_pantry_item(
  p_user_id uuid, p_name text,
  p_quantity numeric default null, p_unit text default null, p_category text default null,
  p_location text default null, p_expires_on date default null, p_notes text default null,
  p_created_via text default 'ui'
)
returns public.pantry_items language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.pantry_items;
begin
  insert into public.pantry_items (user_id, name, quantity, unit, category, location, expires_on, notes, created_via)
  values (v_uid, p_name, p_quantity, nullif(p_unit, ''), nullif(p_category, ''), nullif(p_location, ''), p_expires_on, nullif(p_notes, ''), coalesce(nullif(p_created_via, ''), 'ui'))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_pantry_item(
  p_user_id uuid, p_item_id uuid,
  p_name text default null, p_quantity numeric default null, p_unit text default null,
  p_category text default null, p_location text default null, p_expires_on date default null, p_notes text default null
)
returns public.pantry_items language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.pantry_items;
begin
  update public.pantry_items set
    name       = coalesce(nullif(p_name, ''), name),
    quantity   = coalesce(p_quantity, quantity),
    unit       = coalesce(nullif(p_unit, ''), unit),
    category   = coalesce(nullif(p_category, ''), category),
    location   = coalesce(nullif(p_location, ''), location),
    expires_on = coalesce(p_expires_on, expires_on),
    notes      = coalesce(nullif(p_notes, ''), notes)
  where id = p_item_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'pantry item not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_pantry_item(p_user_id uuid, p_item_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.pantry_items where id = p_item_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.list_pantry(p_user_id uuid, p_limit integer default 500)
returns setof public.pantry_items language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.pantry_items where user_id = v_uid
    order by category nulls last, name
    limit greatest(1, least(coalesce(p_limit, 500), 2000));
end;
$$;

-- ── 7) Shopping list ──────────────────────────────────────────────────────────
-- Add one or many items in a single call (jsonb array of {name, quantity?, category?, recipe_id?}).
create or replace function public.add_shopping_items(p_user_id uuid, p_items jsonb, p_created_via text default 'ui')
returns setof public.shopping_items language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    insert into public.shopping_items (user_id, name, quantity, category, recipe_id, created_via)
    select v_uid, x.name, nullif(x.quantity, ''), nullif(x.category, ''), x.recipe_id, coalesce(nullif(p_created_via, ''), 'ui')
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(name text, quantity text, category text, recipe_id uuid)
    where x.name is not null and x.name <> ''
    returning *;
end;
$$;

create or replace function public.update_shopping_item(
  p_user_id uuid, p_item_id uuid,
  p_name text default null, p_quantity text default null, p_category text default null,
  p_is_checked boolean default null, p_sort_order integer default null
)
returns public.shopping_items language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.shopping_items;
begin
  update public.shopping_items set
    name       = coalesce(nullif(p_name, ''), name),
    quantity   = coalesce(nullif(p_quantity, ''), quantity),
    category   = coalesce(nullif(p_category, ''), category),
    is_checked = coalesce(p_is_checked, is_checked),
    sort_order = coalesce(p_sort_order, sort_order)
  where id = p_item_id and user_id = v_uid
  returning * into v_row;
  if v_row.id is null then raise exception 'shopping item not found' using errcode = 'P0002'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_shopping_item(p_user_id uuid, p_item_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.shopping_items where id = p_item_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.clear_checked_shopping(p_user_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.shopping_items where user_id = v_uid and is_checked;
  get diagnostics v_n = row_count; return v_n;
end;
$$;

create or replace function public.list_shopping(p_user_id uuid, p_limit integer default 500)
returns setof public.shopping_items language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.shopping_items where user_id = v_uid
    order by is_checked, sort_order, created_at
    limit greatest(1, least(coalesce(p_limit, 500), 2000));
end;
$$;

-- ── 8) Meal plan ──────────────────────────────────────────────────────────────
create or replace function public.set_meal_plan(
  p_user_id uuid, p_plan_id uuid default null,
  p_plan_date date default null, p_slot text default null, p_recipe_id uuid default null,
  p_title text default null, p_note text default null, p_created_via text default 'ui'
)
returns public.meal_plans language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_row public.meal_plans;
begin
  if p_plan_id is not null then
    update public.meal_plans set
      plan_date = coalesce(p_plan_date, plan_date),
      slot      = coalesce(nullif(p_slot, ''), slot),
      recipe_id = coalesce(p_recipe_id, recipe_id),
      title     = coalesce(nullif(p_title, ''), title),
      note      = coalesce(nullif(p_note, ''), note)
    where id = p_plan_id and user_id = v_uid
    returning * into v_row;
    if v_row.id is null then raise exception 'meal plan not found' using errcode = 'P0002'; end if;
    return v_row;
  end if;
  insert into public.meal_plans (user_id, plan_date, slot, recipe_id, title, note, created_via)
  values (v_uid, coalesce(p_plan_date, current_date), coalesce(nullif(p_slot, ''), 'dinner'), p_recipe_id, nullif(p_title, ''), nullif(p_note, ''), coalesce(nullif(p_created_via, ''), 'ui'))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.delete_meal_plan(p_user_id uuid, p_plan_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.meal_plans where id = p_plan_id and user_id = v_uid;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

create or replace function public.list_meal_plans(
  p_user_id uuid, p_from date default null, p_to date default null, p_limit integer default 500
)
returns setof public.meal_plans language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := app.resolve_uid(p_user_id);
begin
  return query
    select * from public.meal_plans
    where user_id = v_uid
      and (p_from is null or plan_date >= p_from)
      and (p_to   is null or plan_date <= p_to)
    order by plan_date, slot
    limit greatest(1, least(coalesce(p_limit, 500), 2000));
end;
$$;

-- ── 9) Grants: owner (authenticated) + Worker (service_role) ───────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_recipe(uuid,text,text,text,jsonb,integer,integer,text[],text,text,boolean,text)',
    'public.update_recipe(uuid,uuid,text,text,text,jsonb,integer,integer,text[],text,text,boolean)',
    'public.delete_recipe(uuid,uuid)',
    'public.list_recipes(uuid,text,boolean,integer)',
    'public.get_recipe(uuid,uuid)',
    'public.add_pantry_item(uuid,text,numeric,text,text,text,date,text,text)',
    'public.update_pantry_item(uuid,uuid,text,numeric,text,text,text,date,text)',
    'public.delete_pantry_item(uuid,uuid)',
    'public.list_pantry(uuid,integer)',
    'public.add_shopping_items(uuid,jsonb,text)',
    'public.update_shopping_item(uuid,uuid,text,text,text,boolean,integer)',
    'public.delete_shopping_item(uuid,uuid)',
    'public.clear_checked_shopping(uuid)',
    'public.list_shopping(uuid,integer)',
    'public.set_meal_plan(uuid,uuid,date,text,uuid,text,text,text)',
    'public.delete_meal_plan(uuid,uuid)',
    'public.list_meal_plans(uuid,date,date,integer)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- App-wide anon lockdown (this migration added public functions). Re-revoke and
-- re-grant only the one legitimately anon-callable function.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
