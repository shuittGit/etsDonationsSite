-- list_donation_years  (replaces the earlier version; it no longer takes a payment type)
-- Fills the Year dropdown on the Donations List page with every year from the EARLIEST year of
-- Donations.date_applied through the LATEST year, newest first ('YYYY'), for the donations the
-- caller may see. The span has no gaps: if the earliest is 2025 and the latest 2027, the list is
-- 2027, 2026, 2025 even when a year in between has no donations.
-- It does not depend on the Payment Type or Non Profit selections, so the list stays the same when
-- those change. The page adds the 'All' option itself, after the last year, and opens on the
-- current year.
--
-- Whose donations count (the same Donor / Admin / SuperAdmin rules as list_donations):
--   * SuperAdmin      -> every donation
--   * Admin           -> only the Non Profit they administer (Non_Profit.admin_id = their id)
--   * any other role  -> only the donations on their own ledgers (Donation_Ledgers.user_id = their id)
-- No donations in scope gives an empty list.

-- the earlier version with a payment type argument is removed so only one list_donation_years exists
-- (two overloads would make the RPC call ambiguous)
drop function if exists public.list_donation_years(text, text, text);

create or replace function public.list_donation_years(p_username text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id bigint;
  caller_role text;
  v_non_profit_id bigint;
  v_first_year int;
  v_last_year int;
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

  if caller_role = 'Admin' then
    select n.id into v_non_profit_id
    from public."Non_Profit" n
    where n.admin_id = caller_id
    limit 1;
  end if;

  -- earliest and latest year of date_applied among the donations in scope
  select
    extract(year from min(d.date_applied))::int,
    extract(year from max(d.date_applied))::int
    into v_first_year, v_last_year
  from public."Donations" d
  join public."Donation_Ledgers" l on l.id = d.donation_ledger_id
  where caller_role = 'SuperAdmin'
     or (caller_role = 'Admin' and l.non_profit_id = v_non_profit_id)
     or (caller_role not in ('SuperAdmin', 'Admin') and l.user_id = caller_id);

  return jsonb_build_object(
    'success', true,
    'years', (
      case
        when v_first_year is null then '[]'::jsonb
        else (
          select jsonb_agg(y::text order by y desc)
          from generate_series(v_first_year, v_last_year) as y
        )
      end
    )
  );
end;
$$;

revoke all on function public.list_donation_years(text, text) from public;
grant execute on function public.list_donation_years(text, text) to anon, authenticated;
