-- One username per user, case-insensitive
create unique index if not exists users_username_lower_key
  on public."Users" (lower(username));

-- Checks the Users table for the username and inserts the row if it is free.
-- SECURITY DEFINER so the browser never needs direct read/insert access to "Users"
-- (which holds PINs); RLS stays on and no table policies are opened.
create or replace function public.create_user(
  p_username text,
  p_first_name text,
  p_last_name text,
  p_pin text,
  p_email text default null,
  p_phone_number text default null,
  p_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(trim(p_username), '') = ''
     or coalesce(trim(p_first_name), '') = ''
     or coalesce(trim(p_last_name), '') = ''
     or p_pin is null or p_pin !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  if exists (
    select 1 from public."Users" u where lower(u.username) = lower(trim(p_username))
  ) then
    return jsonb_build_object('success', false, 'error', 'username_exists');
  end if;

  insert into public."Users" (username, first_name, last_name, pin, email, phone_number, address)
  values (
    trim(p_username), trim(p_first_name), trim(p_last_name), p_pin::int,
    nullif(trim(p_email), ''), nullif(trim(p_phone_number), ''), nullif(trim(p_address), '')
  );

  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'username_exists');
end;
$$;

revoke all on function public.create_user(text, text, text, text, text, text, text) from public;
grant execute on function public.create_user(text, text, text, text, text, text, text) to anon, authenticated;
