-- Functions behind the Users page and database sign-in.
-- All are SECURITY DEFINER so the browser never reads/updates "Users" directly
-- (RLS stays on, no table policies are opened). Each admin function re-checks that
-- the caller's username + PIN belong to a user whose role is 'SuperAdmin'.

-- Internal helper: returns the caller's id if they are a SuperAdmin, otherwise null.
-- Not callable from the browser.
create or replace function public._superadmin_id(p_username text, p_pin text)
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select u.id
  from public."Users" u
  where p_pin ~ '^[0-9]{1,4}$'
    and lower(u.username) = lower(trim(p_username))
    and u.pin = p_pin::int
    and u.role = 'SuperAdmin'
  limit 1;
$$;

revoke all on function public._superadmin_id(text, text) from public, anon, authenticated;

-- Sign-in against the Users table.
create or replace function public.login_user(p_username text, p_pin int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public."Users"%rowtype;
begin
/*
  if p_pin is null or p_pin !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('success', false);
  end if;
*/
  select * into u
  from public."Users"
  where lower(username) = lower(trim(p_username)) and pin = p_pin::int
  limit 1;

  if not found then
    return jsonb_build_object('success', false);
  end if;

  return jsonb_build_object(
    'success', true,
    'username', u.username,
    'first_name', u.first_name,
    'last_name', u.last_name,
    'role', u.role
  );
end;
$$;

-- All column names and all records of the Users table (SuperAdmin only).
create or replace function public.list_users(p_username text, p_pin text)
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
    'columns', (
      select coalesce(jsonb_agg(c.column_name order by c.ordinal_position), '[]'::jsonb)
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'Users'
    ),
    'rows', (
      select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb)
      from public."Users" u
    )
  );
end;
$$;

-- Update one user's role (SuperAdmin only; a SuperAdmin cannot change their own role).
create or replace function public.update_user_role(
  p_username text,
  p_pin text,
  p_target_id bigint,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id bigint := public._superadmin_id(p_username, p_pin);
begin
  if caller_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  if p_role not in ('Donor', 'Admin', 'Awaiting Approval') then
    return jsonb_build_object('success', false, 'error', 'invalid_role');
  end if;

  if p_target_id = caller_id then
    return jsonb_build_object('success', false, 'error', 'cannot_change_own_role');
  end if;

  update public."Users"
  set role = p_role, modified_at = now()
  where id = p_target_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.login_user(text, integer) from public;
revoke all on function public.list_users(text, text) from public;
revoke all on function public.update_user_role(text, text, bigint, text) from public;
grant execute on function public.login_user(text, integer) to anon, authenticated;
grant execute on function public.list_users(text, text) to anon, authenticated;
grant execute on function public.update_user_role(text, text, bigint, text) to anon, authenticated;

-- To make yourself the first SuperAdmin (run once, with your own username):
--   update public."Users" set role = 'SuperAdmin' where lower(username) = 'your_username';
