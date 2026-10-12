-- get_donations_list_stats
-- Supplies the dashboard cards above the grid on the Donations List page. One call returns:
--   total_donated            = sum of Donations.amount
--   total_contributors       = number of different users (Donation_Ledgers.user_id) with a donation
--   non_profits              = number of different Non Profits with a donation
--   total_allocated          = number of Donations records with date_applied <= today
--   total_allocated_amount   = sum of Donations.amount where date_applied <= today
--   total_remaining          = number of Donations records with date_applied >  today
--   total_remaining_amount   = sum of Donations.amount where date_applied >  today
--
-- The numbers follow the same three selections as the grid (list_donations), so the cards always
-- describe the records the grid is showing:
--   p_display_type  'Allocated' -> date_applied <= today
--                   'Remaining' -> date_applied >  today
--                   'All'       -> every record                                   (default 'All')
--   p_year          'YYYY'      -> date_applied between YYYY-01-01 and YYYY-12-31
--                   'All'       -> no year limit                                   (default 'All')
--   p_non_profit_id a Non_Profit.id (as text) -> only that Non Profit's donations
--                   'All'       -> no Non Profit limit                             (default 'All')
-- Anything else is refused (invalid_input).
--
-- It is a function and not plain views: a view cannot know who is asking or take these
-- parameters, and a view in the public schema would be readable through the public API by anyone
-- holding the site's key. This function verifies the caller's username + PIN and then counts only
-- what that role may see (the same rules as list_donations):
--   * Donor      -> only their own ledgers (Donation_Ledgers.user_id = their Users.id)
--   * Admin      -> only the Non Profit they administer (Non_Profit.admin_id = their Users.id)
--   * SuperAdmin -> everything
--   * any other role -> not_authorized
--
-- "Total Payments Allocated" and the other payment cards were described as "the sum of id". A sum
-- of ids has no meaning, so the payment cards are COUNTS of Donations records and the amount
-- cards are SUMS of their amounts.

-- the earlier version without parameters is removed so only one get_donations_list_stats exists
-- (two overloads would make the RPC call ambiguous)
drop function if exists public.get_donations_list_stats(text, text);

create or replace function public.get_donations_list_stats(
  p_username text,
  p_pin text,
  p_display_type text default 'All',
  p_year text default 'All',
  p_non_profit_id text default 'All'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id bigint;
  caller_role text;
  v_total_donated numeric;
  v_total_allocated bigint;
  v_total_allocated_amount numeric;
  v_total_remaining bigint;
  v_total_remaining_amount numeric;
  v_total_contributors bigint;
  v_non_profits bigint;
begin
  if p_pin is null or p_pin !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  if p_display_type is null or p_display_type not in ('Allocated', 'Remaining', 'All') then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  if p_year is null or (p_year <> 'All' and p_year !~ '^[0-9]{4}$') then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  if p_non_profit_id is null or (p_non_profit_id <> 'All' and p_non_profit_id !~ '^[0-9]{1,18}$') then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  select u.id, u.role
    into caller_id, caller_role
  from public."Users" u
  where lower(u.username) = lower(trim(p_username)) and u.pin = p_pin::int
  limit 1;

  if caller_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  select
    coalesce(sum(d.amount), 0),
    count(d.id) filter (where d.date_applied <= current_date),
    coalesce(sum(d.amount) filter (where d.date_applied <= current_date), 0),
    count(d.id) filter (where d.date_applied > current_date),
    coalesce(sum(d.amount) filter (where d.date_applied > current_date), 0),
    count(distinct l.user_id),
    count(distinct n.id)
    into v_total_donated, v_total_allocated, v_total_allocated_amount,
         v_total_remaining, v_total_remaining_amount,
         v_total_contributors, v_non_profits
  from public."Donations" d
  join public."Donation_Ledgers" l on l.id = d.donation_ledger_id
  join public."Non_Profit" n on n.id = l.non_profit_id
  where (
          caller_role = 'SuperAdmin'
          or (caller_role = 'Admin' and n.admin_id = caller_id)
          or (caller_role not in ('SuperAdmin', 'Admin') and l.user_id = caller_id)
        )
    and (
          p_display_type = 'All'
          or (p_display_type = 'Allocated' and d.date_applied <= current_date)
          or (p_display_type = 'Remaining' and d.date_applied > current_date)
        )
    and (
          p_year = 'All'
          or d.date_applied between make_date(p_year::int, 1, 1) and make_date(p_year::int, 12, 31)
        )
    and (
          p_non_profit_id = 'All'
          or n.id = p_non_profit_id::bigint
        );

  return jsonb_build_object(
    'success', true,
    'total_donated', v_total_donated,
    'total_contributors', v_total_contributors,
    'non_profits', v_non_profits,
    'total_allocated', v_total_allocated,
    'total_allocated_amount', v_total_allocated_amount,
    'total_remaining', v_total_remaining,
    'total_remaining_amount', v_total_remaining_amount
  );
end;
$$;

revoke all on function public.get_donations_list_stats(text, text, text, text, text) from public;
grant execute on function public.get_donations_list_stats(text, text, text, text, text) to anon, authenticated;
