-- list_donations
-- Feeds the Donations List page. One row per Donations record, newest date_applied first:
--   Users:      first_name, last_name, username   (the donor: Users.id = Donation_Ledgers.user_id)
--   Non_Profit: name                              (Non_Profit.id = Donation_Ledgers.non_profit_id)
--   Donations:  amount, date_applied              (Donations.donation_ledger_id = Donation_Ledgers.id)
-- Sorted by date_applied descending.
--
-- Which rows come back depends on WHO is asking, worked out here from the caller's verified
-- username + PIN (not from values sent by the browser, which anyone could change):
--   * Donor      -> only donations whose ledger belongs to them (Donation_Ledgers.user_id = their id)
--   * Admin      -> only donations of the Non Profit they administer
--                   (Donation_Ledgers.non_profit_id = the Non_Profit.id whose admin_id is theirs)
--   * SuperAdmin -> every donation
--   * any other role -> not_authorized
--
-- The Users join is to the donor of the ledger. Non_Profit has no user_id column (it links to its
-- administrator through admin_id), so Users cannot be joined to Non_Profit to name the donor.

--
-- p_display_type chooses which payments are returned, by date_applied compared with today:
--   'Allocated' (default) -> date_applied <= today
--   'Remaining'           -> date_applied >  today
--   'All'                 -> every record, whatever the date_applied
-- Anything else is refused (invalid_input).

-- the earlier 2-parameter version is removed so only one list_donations exists
-- (two overloads would make the RPC call ambiguous)
drop function if exists public.list_donations(text, text);
drop function if exists public.list_donations(text, text, text);
drop function if exists public.list_donations(text, text, text, text);

-- p_non_profit_id limits the records to one Non Profit (Non_Profit.id, sent as text):
--   '3'     -> only donations whose ledger belongs to Non Profit 3
--   'All'   -> no Non Profit limit (the role, payment type and year still apply)
-- It defaults to 'All'. Anything else is refused (invalid_input).

-- p_year limits the records to one calendar year of date_applied:
--   '2024'  -> date_applied between 2024-01-01 and 2024-12-31
--   'All'   -> no year limit (the payment type still applies)
-- It defaults to the current year. Anything else is refused (invalid_input).

create or replace function public.list_donations(
  p_username text,
  p_pin text,
  p_display_type text default 'Allocated',
  p_year text default to_char(current_date, 'YYYY'),
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
  v_non_profit_id bigint;
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

  -- an Admin sees the donations of their own Non Profit
  if caller_role = 'Admin' then
    select n.id into v_non_profit_id
    from public."Non_Profit" n
    where n.admin_id = caller_id
    limit 1;
  end if;

  return jsonb_build_object(
    'success', true,
    'donations', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.date_applied desc, r.id desc), '[]'::jsonb)
      from (
        select
          d.id,
          u.username,
          u.first_name,
          u.last_name,
          n.name,
          d.amount,
          d.date_applied
        from public."Donations" d
        join public."Donation_Ledgers" l on l.id = d.donation_ledger_id
        join public."Users" u on u.id = l.user_id
        join public."Non_Profit" n on n.id = l.non_profit_id
        where (
                caller_role = 'SuperAdmin'
                or (caller_role not in ('SuperAdmin', 'Admin') and l.user_id = caller_id)
                or (caller_role = 'Admin' and l.non_profit_id = v_non_profit_id)
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
              )
      ) r
    )
  );
end;
$$;

revoke all on function public.list_donations(text, text, text, text, text) from public;
grant execute on function public.list_donations(text, text, text, text, text) to anon, authenticated;


-- The Year dropdown's list of years comes from list_donation_years, which now lives in
-- list_donation_years.sql (run that file too).
