-- get_non_profit_details
-- Used by the Details popup on the Non Profits page. For one Non_Profit record (p_non_profit_id)
-- it returns:
--   Non_Profit: name, email, url, phone_number, address
--   Users:      first_name, last_name, username   (Users.id = Non_Profit.admin_id)
-- Non_Profit links to Users through admin_id (there is no user_id column on Non_Profit).
-- SuperAdmin only (username + PIN are verified in the database).
-- Requires public._superadmin_id from users_admin_rpcs.sql.

create or replace function public.get_non_profit_details(
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

  select
    n.id,
    n.name,
    n.email,
    n.url,
    n.phone_number,
    n.address,
    u.first_name,
    u.last_name,
    u.username
  into r
  from public."Non_Profit" n
  join public."Users" u on u.id = n.admin_id
  where n.id = p_non_profit_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'success', true,
    'id', r.id,
    'name', r.name,
    'email', r.email,
    'url', r.url,
    'phone_number', r.phone_number,
    'address', r.address,
    'first_name', r.first_name,
    'last_name', r.last_name,
    'username', r.username
  );
end;
$$;

revoke all on function public.get_non_profit_details(text, text, bigint) from public;
grant execute on function public.get_non_profit_details(text, text, bigint) to anon, authenticated;
