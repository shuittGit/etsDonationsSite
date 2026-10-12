-- list_available_admins  (replaces the earlier version; same signature)
-- Returns the id and "first_name last_name" (as name) of every Users row that
--   * has the role 'Admin', and
--   * is NOT already the admin of a Non Profit (no Non_Profit.admin_id equal to Users.id).
-- Used by the Admin dropdown on the New Non Profit page. SuperAdmin only.
-- (Non_Profit links to Users through admin_id; there is no user_id column on Non_Profit.)
-- Requires public._superadmin_id from users_admin_rpcs.sql.

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

revoke all on function public.list_available_admins(text, text) from public;
grant execute on function public.list_available_admins(text, text) to anon, authenticated;
