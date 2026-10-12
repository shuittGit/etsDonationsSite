-- update_donation
-- Used by the Update Donation button on the Edit Donation popup (Donation Ledgers page).
-- In ONE transaction it:
--   1. sets aside the ledger's existing "Donations" records (their ids are remembered but the
--      rows are left in place for now),
--   2. updates the "Donation_Ledgers" record with the form values
--        (user_id, total_num_of_donations, total_amount, donation_start_date, donation_end_date),
--   3. inserts the new "Donations" records, one per scheduled payment date, and
--   4. ONLY THEN deletes the old "Donations" records that were set aside in step 1.
-- The old donations are therefore never removed until the new ones are saved, and because it is
-- all one transaction, any error undoes every step and the original donations are untouched.
--
-- Rules:
--   * The caller (username + PIN) must be a SuperAdmin, or an Admin of the ledger's Non Profit
--     (Non_Profit.admin_id = caller id).
--   * Each donation amount is total_amount / total_num_of_donations rounded to 2 decimals; the
--     last payment absorbs any rounding difference so the amounts add up to the total.
--   * p_scheduled_payments is a JSON array of 'YYYY-MM-DD' strings with one entry per donation;
--     the first must equal p_start_date and the last p_end_date.
--   * The ledger's non_profit_id is not changed.

create or replace function public.update_donation(
  p_username text,
  p_pin text,
  p_ledger_id bigint,
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
  v_ledger_admin_id bigint;
  v_old_donation_ids bigint[];
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

  select n.admin_id
    into v_ledger_admin_id
  from public."Donation_Ledgers" l
  join public."Non_Profit" n on n.id = l.non_profit_id
  where l.id = p_ledger_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if caller_role <> 'SuperAdmin' and v_ledger_admin_id <> caller_id then
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

  -- 1. set aside the existing donations (remember their ids; rows stay until step 4)
  select coalesce(array_agg(d.id), '{}'::bigint[])
    into v_old_donation_ids
  from public."Donations" d
  where d.donation_ledger_id = p_ledger_id;

  -- 2. update the Donation_Ledgers record
  update public."Donation_Ledgers"
  set user_id = p_user_id,
      total_num_of_donations = p_total_num_of_donations,
      total_amount = p_total_amount,
      donation_start_date = p_start_date,
      donation_end_date = p_end_date,
      modified_at = now()
  where id = p_ledger_id;

  -- 3. insert the new Donations records, one per scheduled payment date
  v_avg := round(p_total_amount / p_total_num_of_donations, 2);

  insert into public."Donations" (donation_ledger_id, amount, date_applied)
  select
    p_ledger_id,
    case
      when t.idx = p_total_num_of_donations
        then p_total_amount - v_avg * (p_total_num_of_donations - 1)
      else v_avg
    end,
    t.payment_date::date
  from jsonb_array_elements_text(p_scheduled_payments) with ordinality as t(payment_date, idx);

  -- 4. only now remove the old donations that were set aside
  delete from public."Donations" d
  where d.id = any (v_old_donation_ids);

  return jsonb_build_object('success', true, 'donation_ledger_id', p_ledger_id);
end;
$$;

revoke all on function public.update_donation(text, text, bigint, bigint, int, numeric, date, date, jsonb) from public;
grant execute on function public.update_donation(text, text, bigint, bigint, int, numeric, date, date, jsonb) to anon, authenticated;
