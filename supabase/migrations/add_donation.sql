-- add_donation
-- Used by the Add Donation button on the New Donation page. In ONE transaction it:
--   1. inserts the record into "Donation_Ledgers"
--        (user_id, total_num_of_donations, total_amount, non_profit_id,
--         donation_start_date, donation_end_date)
--      and captures that record's id (the donation_ledger_id), then
--   2. loops over the scheduled payment dates and inserts one "Donations" record per date
--        (donation_ledger_id, amount, date_applied).
-- Doing both steps in one function means a failure in step 2 undoes step 1, so a ledger
-- can never be left behind without its donations.
--
-- Rules:
--   * The caller (username + PIN) must be an Admin or a SuperAdmin.
--   * non_profit_id is the Non Profit the caller administers (Non_Profit.admin_id = caller id).
--   * Each donation amount is total_amount / total_num_of_donations rounded to 2 decimals;
--     the last payment absorbs any rounding difference so the amounts always add up to the total.
--   * p_scheduled_payments is a JSON array of 'YYYY-MM-DD' strings with one entry per donation,
--     and p_end_date must equal its last entry.

create or replace function public.add_donation(
  p_username text,
  p_pin text,
  p_user_id bigint,
  p_total_num_of_donations int,
  p_total_amount numeric,
  p_start_date date,
  p_end_date date,
  p_scheduled_payments jsonb
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
  v_ledger_id bigint;
  v_avg numeric;
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

  if p_user_id is null
     or p_total_num_of_donations is null or p_total_num_of_donations < 1
     or p_total_amount is null or p_total_amount <= 0
     or p_start_date is null or p_end_date is null
     or p_scheduled_payments is null
     or jsonb_typeof(p_scheduled_payments) <> 'array'
     or jsonb_array_length(p_scheduled_payments) <> p_total_num_of_donations
     or (p_scheduled_payments ->> (p_total_num_of_donations - 1))::date <> p_end_date
     or (p_scheduled_payments ->> 0)::date <> p_start_date then
    return jsonb_build_object('success', false, 'error', 'invalid_input');
  end if;

  if not exists (select 1 from public."Users" u where u.id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;

  select n.id into v_non_profit_id
  from public."Non_Profit" n
  where n.admin_id = caller_id
  limit 1;

  if v_non_profit_id is null then
    return jsonb_build_object('success', false, 'error', 'no_non_profit');
  end if;

  -- 1. the Donation_Ledgers record; keep its id as donation_ledger_id
  insert into public."Donation_Ledgers"
    (user_id, non_profit_id, total_amount, total_num_of_donations,
     donation_start_date, donation_end_date)
  values
    (p_user_id, v_non_profit_id, p_total_amount, p_total_num_of_donations,
     p_start_date, p_end_date)
  returning id into v_ledger_id;

  -- 2. one Donations record per scheduled payment date
  v_avg := round(p_total_amount / p_total_num_of_donations, 2);

  insert into public."Donations" (donation_ledger_id, amount, date_applied)
  select
    v_ledger_id,
    case
      when t.idx = p_total_num_of_donations
        then p_total_amount - v_avg * (p_total_num_of_donations - 1)
      else v_avg
    end,
    t.payment_date::date
  from jsonb_array_elements_text(p_scheduled_payments) with ordinality as t(payment_date, idx);

  return jsonb_build_object('success', true, 'donation_ledger_id', v_ledger_id);
end;
$$;

revoke all on function public.add_donation(text, text, bigint, int, numeric, date, date, jsonb) from public;
grant execute on function public.add_donation(text, text, bigint, int, numeric, date, date, jsonb) to anon, authenticated;
