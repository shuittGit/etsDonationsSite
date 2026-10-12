-- list_donation_non_profits
-- Fills the Non Profit dropdown on the Donations List page: the id and name of the Non Profits
-- the caller may filter by, depending on their role (worked out here from the verified
-- username + PIN):
--   * Donor      -> the Non Profits that have a ledger of theirs
--                   (Donation_Ledgers.user_id = their Users.id, Donation_Ledgers.non_profit_id = Non_Profit.id)
--   * Admin      -> the Non Profit they administer (Non_Profit.admin_id = their Users.id)
--   * SuperAdmin -> every Non Profit
--   but, for Admin and SuperAdmin, only Non Profits that have at least one donation ledger.
--   * any other role -> not_authorized
-- The page adds the 'All' option itself when more than one Non Profit comes back.
-- (Non_Profit has no user_id column; it links to its administrator through admin_id.)

create or replace function public.list_donation_non_profits(p_username text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id bigint;
  caller_role text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  select u.id, u.role
    into caller_id, caller_role
  from public."Users" u
  where lower(u.username) = lower(trim(p_username)) and u.pin = p_pin::int
  limit 1;

  if caller_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  return jsonb_build_object(
    'success', true,
    'non_profits', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', n.id, 'name', n.name) order by n.name),
        '[]'::jsonb
      )
      from public."Non_Profit" n
      where
        -- SuperAdmin and Admin: Non Profits that have at least one donation ledger (a Non Profit
        -- with no ledgers has no donations to filter, so it is not offered)
        (
          (caller_role = 'SuperAdmin' or (caller_role = 'Admin' and n.admin_id = caller_id))
          and exists (
            select 1 from public."Donation_Ledgers" l where l.non_profit_id = n.id
          )
        )
        -- Donor: Non Profits that have a ledger of their own
        or (
          caller_role not in ('SuperAdmin', 'Admin')
          and exists (
            select 1 from public."Donation_Ledgers" l
            where l.non_profit_id = n.id and l.user_id = caller_id
          )
        )
    )
  );
end;
$$;

revoke all on function public.list_donation_non_profits(text, text) from public;
grant execute on function public.list_donation_non_profits(text, text) to anon, authenticated;
