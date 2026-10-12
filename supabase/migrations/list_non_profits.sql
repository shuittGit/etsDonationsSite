-- list_non_profits
-- Returns every column name of "Non_Profit" and every Non_Profit record, together with the
-- first_name, last_name, username (and role) of the user who administers it.
-- The Non_Profit table links to Users through admin_id, so the join is
--   Users.id = Non_Profit.admin_id
-- SuperAdmin only (username + PIN are verified in the database).
-- Requires public._superadmin_id from users_admin_rpcs.sql.

create or replace function public.list_non_profits(p_username text, p_pin text)
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
      where c.table_schema = 'public' and c.table_name = 'Non_Profit'
    ),
    'rows', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.name, r.id), '[]'::jsonb)
      from (
        select
          n.*,
          u.first_name,
          u.last_name,
          u.username,
          u.role
        from public."Non_Profit" n
        join public."Users" u on u.id = n.admin_id
      ) r
    )
  );
end;
$$;

revoke all on function public.list_non_profits(text, text) from public;
grant execute on function public.list_non_profits(text, text) to anon, authenticated;
