-- Lets a SuperAdmin pick the Non Profit when adding a donation.
-- Run this whole file once in the Supabase SQL Editor. It needs users_admin_rpcs.sql
-- (public._superadmin_id) to have been run first.

-- ---------------------------------------------------------------------------
-- list_non_profit_options
-- Returns the id and name of every Non_Profit record, for the Non Profit dropdown on the
-- New Donation page. SuperAdmin only (username + PIN are verified in the database).
-- ---------------------------------------------------------------------------
create or replace function public.list_non_profit_options(p_username text, p_pin text)
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
    'non_profits', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', n.id, 'name', n.name) order by n.name),
        '[]'::jsonb
      )
      from public."Non_Profit" n
    )
  );
end;
$$;

revoke all on function public.list_non_profit_options(text, text) from public;
grant execute on function public.list_non_profit_options(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- add_donation  (replaces the earlier version; new last parameter p_non_profit_id)
-- Does exactly what it did before:
--   1. inserts the "Donation_Ledgers" record and keeps its id as the donation_ledger_id,
--   2. inserts one "Donations" record per scheduled payment date,
-- in ONE transaction. The only change is which Non Profit the ledger belongs to:
--   * SuperAdmin -> p_non_profit_id (the dropdown choice). If it is null, the Non Profit the
--                   SuperAdmin administers is used, if any.
--   * Admin      -> always the Non Profit they administer (p_non_profit_id is ignored).
-- ---------------------------------------------------------------------------
drop function if exists public.add_donation(text, text, bigint, int, numeric, date, date, jsonb);

create or replace function public.add_donation(
  p_username text,
  p_pin text,
  p_user_id bigint,
  p_total_num_of_donations int,
  p_total_amount numeric,
  p_start_date date,
  p_end_date date,
  p_scheduled_payments jsonb,
  p_non_profit_id bigint default null
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

  if caller_role = 'SuperAdmin' and p_non_profit_id is not null then
    select n.id into v_non_profit_id
    from public."Non_Profit" n
    where n.id = p_non_profit_id;
  else
    select n.id into v_non_profit_id
    from public."Non_Profit" n
    where n.admin_id = caller_id
    limit 1;
  end if;

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

revoke all on function public.add_donation(text, text, bigint, int, numeric, date, date, jsonb, bigint) from public;
grant execute on function public.add_donation(text, text, bigint, int, numeric, date, date, jsonb, bigint) to anon, authenticated;
