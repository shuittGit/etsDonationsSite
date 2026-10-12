-- Functions behind the Edit Non Profit popup on the Non Profits page.
-- Run this whole file once in the Supabase SQL Editor.
-- Both are SuperAdmin only (username + PIN are verified in the database) and use
-- public._superadmin_id from users_admin_rpcs.sql.
-- Non_Profit links to Users through admin_id (there is no user_id column on Non_Profit).

-- ---------------------------------------------------------------------------
-- get_non_profit_for_edit
-- Returns one Non_Profit record (name, description, email, url, phone_number, address, admin_id)
-- and the list of people who can be chosen as its admin:
--   * the Non Profit's current admin (the default selection), plus
--   * every Users row with the role 'Admin' that is not the admin of any Non Profit yet.
-- Each person is returned as id and name (first_name + ' ' + last_name).
-- ---------------------------------------------------------------------------
create or replace function public.get_non_profit_for_edit(
  p_username text,
  p_pin text,
  p_non_profit_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if public._superadmin_id(p_username, p_pin) is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  select n.id, n.name, n.description, n.email, n.url, n.phone_number, n.address, n.admin_id
    into r
  from public."Non_Profit" n
  where n.id = p_non_profit_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'success', true,
    'id', r.id,
    'name', r.name,
    'description', r.description,
    'email', r.email,
    'url', r.url,
    'phone_number', r.phone_number,
    'address', r.address,
    'admin_id', r.admin_id,
    'admins', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)
          order by u.first_name, u.last_name
        ),
        '[]'::jsonb
      )
      from public."Users" u
      where u.id = r.admin_id
         or (
           u.role = 'Admin'
           and not exists (select 1 from public."Non_Profit" n2 where n2.admin_id = u.id)
         )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- update_non_profit
-- Updates the Non_Profit record with the given id: admin_id (the chosen user), name,
-- description, email, url, phone_number and address.
--   * name must not be blank and must not belong to a different Non Profit (case-insensitive)
--   * the chosen admin must exist and must not already be the admin of a different Non Profit
-- ---------------------------------------------------------------------------
create or replace function public.update_non_profit(
  p_username text,
  p_pin text,
  p_non_profit_id bigint,
  p_admin_id bigint,
  p_name text,
  p_description text default null,
  p_email text default null,
  p_url text default null,
  p_phone_number text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public._superadmin_id(p_username, p_pin) is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  if coalesce(trim(p_name), '') = '' or p_admin_id is null then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  if not exists (select 1 from public."Non_Profit" n where n.id = p_non_profit_id) then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if not exists (select 1 from public."Users" u where u.id = p_admin_id) then
    return jsonb_build_object('success', false, 'error', 'admin_not_found');
  end if;

  if exists (
    select 1 from public."Non_Profit" n
    where lower(n.name) = lower(trim(p_name)) and n.id <> p_non_profit_id
  ) then
    return jsonb_build_object('success', false, 'error', 'name_exists');
  end if;

  if exists (
    select 1 from public."Non_Profit" n
    where n.admin_id = p_admin_id and n.id <> p_non_profit_id
  ) then
    return jsonb_build_object('success', false, 'error', 'admin_taken');
  end if;

  update public."Non_Profit"
  set admin_id = p_admin_id,
      name = trim(p_name),
      description = nullif(trim(p_description), ''),
      email = nullif(trim(p_email), ''),
      url = nullif(trim(p_url), ''),
      phone_number = nullif(trim(p_phone_number), ''),
      address = nullif(trim(p_address), ''),
      modified_at = now()
  where id = p_non_profit_id;

  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'name_exists');
end;
$$;

revoke all on function public.get_non_profit_for_edit(text, text, bigint) from public;
revoke all on function public.update_non_profit(text, text, bigint, bigint, text, text, text, text, text, text) from public;
grant execute on function public.get_non_profit_for_edit(text, text, bigint) to anon, authenticated;
grant execute on function public.update_non_profit(text, text, bigint, bigint, text, text, text, text, text, text) to anon, authenticated;
