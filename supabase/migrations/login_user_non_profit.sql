-- Replaces public.login_user so the sign-in also returns:
--   id               - the user's id in "Users"
--   has_non_profit   - true when that id is already an admin_id in "Non_Profit"
-- The app uses these to send an Admin who has no Non Profit yet to the New Non Profit page.
-- Same signature as before (text, integer), so create or replace is enough; grants stay in place.

create or replace function public.login_user(p_username text, p_pin int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public."Users"%rowtype;
begin
  select * into u
  from public."Users"
  where lower(username) = lower(trim(p_username)) and pin = p_pin
  limit 1;

  if not found then
    return jsonb_build_object('success', false);
  end if;

  return jsonb_build_object(
    'success', true,
    'id', u.id,
    'username', u.username,
    'first_name', u.first_name,
    'last_name', u.last_name,
    'role', u.role,
    'has_non_profit', exists (
      select 1 from public."Non_Profit" n where n.admin_id = u.id
    )
  );
end;
$$;

revoke all on function public.login_user(text, integer) from public;
grant execute on function public.login_user(text, integer) to anon, authenticated;
