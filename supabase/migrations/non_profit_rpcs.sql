-- Functions behind the New Non Profit page.
-- Run this whole file once in the Supabase SQL Editor (it needs users_admin_rpcs.sql
-- to have been run first, because it uses public._superadmin_id).

-- One Non Profit per name, case-insensitive
create unique index if not exists non_profit_name_lower_key
  on public."Non_Profit" (lower(name));

-- ---------------------------------------------------------------------------
-- list_available_admins
-- Returns the id and "first_name last_name" (as name) of every Users row with the role
-- 'Admin' whose id is NOT already used as an admin_id in Non_Profit. SuperAdmin only.
-- ---------------------------------------------------------------------------
create or replace function public.list_available_admins(p_username text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public._superadmin_id(p_username, p_pin) is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  return jsonb_build_object(
    'success', true,
    'admins', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)
          order by u.first_name, u.last_name
        ),
        '[]'::jsonb
      )
      from public."Users" u
      where u.role = 'Admin'
        and not exists (
          select 1 from public."Non_Profit" n where n.admin_id = u.id
        )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- create_non_profit
-- Checks Non_Profit for the name; if it is free, inserts the row.
--  * The caller proves who they are with their username + PIN.
--  * Only a SuperAdmin can choose the admin (p_admin_id). Anyone else, and a
--    SuperAdmin who leaves it blank, becomes the admin themselves
--    (Non_Profit.admin_id is NOT NULL).
--  * An admin can only administer one Non Profit.
-- ---------------------------------------------------------------------------
-- Non_Profit gets a description column (no-op if it already exists)
alter table public."Non_Profit" add column if not exists description text;

-- Drop the previous 7-parameter version so only one create_non_profit exists
-- (two overloads would make the RPC call ambiguous).
drop function if exists public.create_non_profit(text, text, text, bigint, text, text, text);

create or replace function public.create_non_profit(
  p_username text,
  p_pin text,
  p_name text,
  p_admin_id bigint default null,
  p_email text default null,
  p_phone_number text default null,
  p_address text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id bigint;
  caller_is_super boolean;
  v_admin_id bigint;
begin
  if p_pin is null or p_pin !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  select u.id, (u.role = 'SuperAdmin')
    into caller_id, caller_is_super
  from public."Users" u
  where lower(u.username) = lower(trim(p_username)) and u.pin = p_pin::int
  limit 1;

  if caller_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  if caller_is_super and p_admin_id is not null then
    v_admin_id := p_admin_id;
  else
    v_admin_id := caller_id;
  end if;

  if not exists (select 1 from public."Users" u where u.id = v_admin_id) then
    return jsonb_build_object('success', false, 'error', 'admin_not_found');
  end if;

  if exists (
    select 1 from public."Non_Profit" n where lower(n.name) = lower(trim(p_name))
  ) then
    return jsonb_build_object('success', false, 'error', 'name_exists');
  end if;

  if exists (select 1 from public."Non_Profit" n where n.admin_id = v_admin_id) then
    return jsonb_build_object('success', false, 'error', 'admin_taken');
  end if;

  insert into public."Non_Profit" (name, admin_id, email, phone_number, address, description)
  values (
    trim(p_name), v_admin_id,
    nullif(trim(p_email), ''), nullif(trim(p_phone_number), ''), nullif(trim(p_address), ''),
    nullif(trim(p_description), '')
  );

  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'name_exists');
end;
$$;

revoke all on function public.list_available_admins(text, text) from public;
revoke all on function public.create_non_profit(text, text, text, bigint, text, text, text, text) from public;
grant execute on function public.list_available_admins(text, text) to anon, authenticated;
grant execute on function public.create_non_profit(text, text, text, bigint, text, text, text, text) to anon, authenticated;
