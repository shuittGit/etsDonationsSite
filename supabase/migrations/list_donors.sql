-- list_donors
-- Returns the id, name (first_name + ' ' + last_name) and username of every row in "Users"
-- whose role is 'Donor'. Used by the Name dropdown on the New Donation page.
-- SuperAdmin and Admin only (username + PIN are verified in the database).

create or replace function public.list_donors(p_username text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  select u.role
    into caller_role
  from public."Users" u
  where lower(u.username) = lower(trim(p_username)) and u.pin = p_pin::int
  limit 1;

  if caller_role is null or caller_role not in ('SuperAdmin', 'Admin') then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  return jsonb_build_object(
    'success', true,
    'donors', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'name', u.first_name || ' ' || u.last_name,
            'username', u.username
          )
          order by u.first_name, u.last_name
        ),
        '[]'::jsonb
      )
      from public."Users" u
      where u.role = 'Donor'
    )
  );
end;
$$;

revoke all on function public.list_donors(text, text) from public;
grant execute on function public.list_donors(text, text) to anon, authenticated;
