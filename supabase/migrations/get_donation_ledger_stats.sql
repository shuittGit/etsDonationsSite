-- get_donation_ledger_stats
-- Supplies the five summary cards above the Donation Ledgers grid. One call returns:
--   total_donated           = sum of Donations.amount
--   total_contributors      = number of different users (Donation_Ledgers.user_id) with a ledger
--   non_profits             = count of Non_Profit.name, for Non Profits that have at least one
--                             donation ledger (like contributors, it follows the ledgers)
--   total_allocated         = number of Donations records with date_applied <= today
--   total_allocated_amount  = sum of Donations.amount where date_applied <= today
--
-- This is a function and not a plain view on purpose:
--   * a view cannot know who is asking, so it could not show an Admin only their own Non
--     Profit's numbers (a SuperAdmin sees everything, an Admin only the ledgers of the Non
--     Profit they administer, the same rule as list_donation_ledgers), and
--   * a view in the public schema would be readable through the public API by anyone holding
--     the site's key, while this function verifies the caller's username + PIN first.
--
-- "Total Allocated" and "Total Allocated Amount" were both described as "the sum of id". A sum
-- of ids has no meaning, so the first is the COUNT of Donations records and the second is the SUM
-- of their amounts, both for donations applied on or before today.
-- "Total Contributors" counts each user once, however many ledgers they have. To count ledger
-- rows instead, change count(distinct l.user_id) to count(l.user_id) below.

create or replace function public.get_donation_ledger_stats(p_username text, p_pin text)
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
  v_total_contributors bigint;
  v_non_profits bigint;
begin
  if p_pin is null or p_pin !~ '^[0-9]{1,4}$' then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  select u.id, u.role
    into caller_id, caller_role
  from public."Users" u
  where lower(u.username) = lower(trim(p_username)) and u.pin = p_pin::int
  limit 1;

  if caller_id is null or caller_role not in ('SuperAdmin', 'Admin') then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  -- Donations (scoped to the caller's Non Profit unless SuperAdmin)
  select
    coalesce(sum(d.amount), 0),
    count(d.id) filter (where d.date_applied <= current_date),
    coalesce(sum(d.amount) filter (where d.date_applied <= current_date), 0)
    into v_total_donated, v_total_allocated, v_total_allocated_amount
  from public."Donations" d
  join public."Donation_Ledgers" l on l.id = d.donation_ledger_id
  join public."Non_Profit" n on n.id = l.non_profit_id
  where caller_role = 'SuperAdmin' or n.admin_id = caller_id;

  -- Contributors
  select count(distinct l.user_id)
    into v_total_contributors
  from public."Donation_Ledgers" l
  join public."Non_Profit" n on n.id = l.non_profit_id
  where caller_role = 'SuperAdmin' or n.admin_id = caller_id;

  -- Non Profits that have at least one donation ledger, so deleting a Non Profit's last ledger
  -- lowers the count (a Non Profit with no ledgers is not counted)
  select count(n.name)
    into v_non_profits
  from public."Non_Profit" n
  where (caller_role = 'SuperAdmin' or n.admin_id = caller_id)
    and exists (
      select 1 from public."Donation_Ledgers" l where l.non_profit_id = n.id
    );

  return jsonb_build_object(
    'success', true,
    'total_donated', v_total_donated,
    'total_contributors', v_total_contributors,
    'non_profits', v_non_profits,
    'total_allocated', v_total_allocated,
    'total_allocated_amount', v_total_allocated_amount
  );
end;
$$;

revoke all on function public.get_donation_ledger_stats(text, text) from public;
grant execute on function public.get_donation_ledger_stats(text, text) to anon, authenticated;
