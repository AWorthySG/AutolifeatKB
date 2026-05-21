-- AutolifeatKB initial schema
-- Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ============================================================
-- Tables
-- ============================================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  telegram_user_id bigint unique,
  telegram_chat_id bigint,
  link_code text unique,
  active_household_id uuid,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.users
  add constraint users_active_household_fk
  foreign key (active_household_id) references public.households(id) on delete set null;

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_user_id uuid references public.users(id) on delete set null,
  name text not null,
  normalized_name text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null,
  category text,
  added_at timestamptz not null default now(),
  expires_at date,
  low_threshold numeric check (low_threshold is null or low_threshold >= 0),
  typical_purchase_quantity numeric,
  notes text
);

create index items_household_idx on public.items (household_id);
create index items_normalized_idx on public.items (household_id, normalized_name);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_user_id uuid references public.users(id) on delete set null,
  name text not null,
  default_servings integer not null default 2 check (default_servings > 0),
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  quantity_per_serving numeric not null check (quantity_per_serving > 0),
  unit text not null
);

create table public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_user_id uuid references public.users(id) on delete set null,
  name text not null,
  normalized_name text not null,
  quantity_wanted numeric,
  unit text,
  source text not null check (source in ('auto_low_stock', 'auto_used_up', 'manual', 'recipe_planned')),
  linked_item_id uuid references public.items(id) on delete set null,
  done boolean not null default false,
  done_by_user_id uuid references public.users(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index shopping_list_open_unique
  on public.shopping_list (household_id, normalized_name)
  where done = false;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('add', 'deduct', 'cook', 'shop_add', 'shop_complete', 'member_joined')),
  payload_json jsonb not null default '{}'::jsonb,
  raw_text text,
  photo_path text,
  llm_response jsonb,
  created_at timestamptz not null default now()
);

create index events_household_idx on public.events (household_id, created_at desc);

-- ============================================================
-- Helper functions
-- ============================================================

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  select upper(substring(encode(gen_random_bytes(6), 'base64') from 1 for 8));
$$;

create or replace function public.gen_link_code()
returns text
language sql
volatile
as $$
  select upper(substring(encode(gen_random_bytes(6), 'base64') from 1 for 8));
$$;

-- Auto-create a user row + default household on first sign-in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.users (id, display_name, link_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), gen_link_code())
  on conflict (id) do nothing;

  insert into public.households (name, owner_user_id, invite_code)
  values ('My Fridge', new.id, gen_invite_code())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  update public.users
  set active_household_id = new_household_id
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Auto shopping list triggers
-- ============================================================

-- When an item's quantity drops to 0 or below its low_threshold, open a shopping_list row.
create or replace function public.maybe_open_shopping_list_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  open_source text;
  want_qty numeric;
begin
  -- Only react to updates that decrease quantity (or set it for the first time)
  if tg_op = 'UPDATE' and new.quantity = old.quantity then
    return new;
  end if;

  if new.quantity <= 0 then
    open_source := 'auto_used_up';
    want_qty := coalesce(new.typical_purchase_quantity, 1);
  elsif new.low_threshold is not null and new.quantity < new.low_threshold then
    open_source := 'auto_low_stock';
    want_qty := coalesce(new.typical_purchase_quantity, new.low_threshold);
  else
    return new;
  end if;

  insert into public.shopping_list
    (household_id, name, normalized_name, quantity_wanted, unit, source)
  values
    (new.household_id, new.name, new.normalized_name, want_qty, new.unit, open_source)
  on conflict (household_id, normalized_name) where done = false do nothing;

  return new;
end;
$$;

drop trigger if exists items_maybe_open_shopping on public.items;
create trigger items_maybe_open_shopping
  after insert or update of quantity on public.items
  for each row execute function public.maybe_open_shopping_list_row();

-- When a new item is added whose normalized_name matches an open shopping_list row,
-- close that row.
create or replace function public.maybe_close_shopping_list_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quantity > 0 then
    update public.shopping_list
    set done = true,
        done_at = now(),
        linked_item_id = new.id
    where household_id = new.household_id
      and normalized_name = new.normalized_name
      and done = false;
  end if;
  return new;
end;
$$;

drop trigger if exists items_maybe_close_shopping on public.items;
create trigger items_maybe_close_shopping
  after insert on public.items
  for each row execute function public.maybe_close_shopping_list_row();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.users enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.shopping_list enable row level security;
alter table public.events enable row level security;

-- users: a user can read + update their own row only
create policy users_self_select on public.users
  for select using (id = auth.uid());
create policy users_self_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- households: members can read; only owner can update; anyone authenticated can insert
create policy households_member_select on public.households
  for select using (public.is_household_member(id));
create policy households_owner_update on public.households
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy households_authenticated_insert on public.households
  for insert with check (owner_user_id = auth.uid());

-- household_members: members can read the membership list; only the user themselves can insert
-- (covering both "owner creates household" and "user accepts invite" via server-side RPC).
create policy household_members_self_select on public.household_members
  for select using (
    user_id = auth.uid()
    or public.is_household_member(household_id)
  );
create policy household_members_self_insert on public.household_members
  for insert with check (user_id = auth.uid());
create policy household_members_self_delete on public.household_members
  for delete using (user_id = auth.uid());

-- items / recipes / recipe_ingredients / shopping_list / events: household members only
create policy items_member_all on public.items
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy recipes_member_all on public.recipes
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy recipe_ingredients_member_all on public.recipe_ingredients
  for all using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  );

create policy shopping_list_member_all on public.shopping_list
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy events_member_all on public.events
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ============================================================
-- RPCs
-- ============================================================

-- Accept an invite code: adds the caller to the household and switches their active household.
create or replace function public.join_household_by_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into target_household_id
  from public.households
  where invite_code = p_invite_code;

  if target_household_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (target_household_id, auth.uid(), 'member')
  on conflict do nothing;

  update public.users
  set active_household_id = target_household_id
  where id = auth.uid();

  insert into public.events (household_id, actor_user_id, kind, payload_json)
  values (target_household_id, auth.uid(), 'member_joined', jsonb_build_object('via', 'invite_code'));

  return target_household_id;
end;
$$;

-- Switch active household (must be a member).
create or replace function public.set_active_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of household %', p_household_id;
  end if;

  update public.users
  set active_household_id = p_household_id
  where id = auth.uid();
end;
$$;

-- Rotate the household invite code (owner only).
create or replace function public.rotate_invite_code(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not exists (
    select 1 from public.households
    where id = p_household_id and owner_user_id = auth.uid()
  ) then
    raise exception 'only the owner can rotate the invite code';
  end if;

  new_code := public.gen_invite_code();
  update public.households set invite_code = new_code where id = p_household_id;
  return new_code;
end;
$$;
