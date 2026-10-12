-- get_donation_ledger_details
-- Used by the Details popup on the Donation Ledgers page. For one Donation_Ledgers record
-- (p_ledger_id) it returns, joined together:
--   Donation_Ledgers: donation_start_date, donation_end_date, total_num_of_donations, total_amount
--   Non_Profit:       name              (Non_Profit.id = Donation_Ledgers.non_profit_id)
--   Users:            first_name, last_name, username   (Users.id = Donation_Ledgers.user_id)
--   Donations:        amount, date_applied  (Donations.donation_ledger_id = Donation_Ledgers.id)
-- plus these calculated fields:
--   avg_donation_amount     = average of the ledger's Donations.amount
--   num_donations_allocated = count of the ledger's Donations records applied so far
--   num_donations_remaining = total_num_of_donations - num_donations_allocated
--   amount_allocated        = sum of the ledger's Donations.amount applied so far
--   amount_remaining        = total_amount - amount_allocated
--
-- "Applied so far" means date_applied <= today. add_donation creates ALL of a ledger's
-- Donations rows up front (one per scheduled payment), so counting every row would always
-- give allocated = total and remaining = 0. To count every row instead, delete the line
--   and d.date_applied <= current_date
-- from both queries below.
--
-- Who can call it (username + PIN are verified in the database):
--   * SuperAdmin -> any ledger
--   * Admin      -> only a ledger of the Non Profit they administer (Non_Profit.admin_id = their id)
--   * any other role (a Donor, ...) -> only a ledger tied to their own user id
--     (Donation_Ledgers.user_id = their Users.id)

create or replace function public.get_donation_ledger_details(
  p_username text,
  p_pin text,
  p_ledger_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id bigint;
  caller_role text;
  r record;
  v_allocated_count int;
  v_allocated_amount numeric;
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

  select
    l.id,
    l.user_id,
    l.donation_start_date,
    l.donation_end_date,
    l.total_num_of_donations,
    l.total_amount,
    n.name as non_profit_name,
    n.admin_id,
    u.first_name,
    u.last_name,
    u.username
  into r
  from public."Donation_Ledgers" l
  join public."Users" u on u.id = l.user_id
  join public."Non_Profit" n on n.id = l.non_profit_id
  where l.id = p_ledger_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if caller_role = 'Admin' and r.admin_id <> caller_id then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  -- any other role (a Donor, ...) may only open a ledger tied to their own user id
  if caller_role not in ('SuperAdmin', 'Admin') and r.user_id <> caller_id then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  select count(d.id), coalesce(sum(d.amount), 0)
    into v_allocated_count, v_allocated_amount
  from public."Donations" d
  where d.donation_ledger_id = r.id
    and d.date_applied <= current_date;

  return jsonb_build_object(
    'success', true,
    'donation_ledger_id', r.id,
    'user_id', r.user_id,
    'first_name', r.first_name,
    'last_name', r.last_name,
    'username', r.username,
    'non_profit_name', r.non_profit_name,
    'donation_start_date', r.donation_start_date,
    'donation_end_date', r.donation_end_date,
    'total_num_of_donations', r.total_num_of_donations,
    'total_amount', r.total_amount,
    'avg_donation_amount', (
      select round(avg(d.amount), 2) from public."Donations" d where d.donation_ledger_id = r.id
    ),
    'num_donations_allocated', v_allocated_count,
    'num_donations_remaining', r.total_num_of_donations - v_allocated_count,
    'amount_allocated', v_allocated_amount,
    'amount_remaining', r.total_amount - v_allocated_amount,
    'donations', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('amount', d.amount, 'date_applied', d.date_applied)
          order by d.date_applied
        ),
        '[]'::jsonb
      )
      from public."Donations" d
      where d.donation_ledger_id = r.id
    )
  );
end;
$$;

revoke all on function public.get_donation_ledger_details(text, text, bigint) from public;
grant execute on function public.get_donation_ledger_details(text, text, bigint) to anon, authenticated;
