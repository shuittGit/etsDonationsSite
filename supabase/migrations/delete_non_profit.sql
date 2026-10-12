-- delete_non_profit
-- Used by the Delete link on the Non Profits page (SuperAdmin only; username + PIN are verified
-- in the database). For the chosen Non_Profit record (p_non_profit_id), in this order:
--   1. finds the ids of the Donation_Ledgers records that belong to it
--      (Donation_Ledgers.non_profit_id = the Non Profit's id),
--   2. deletes the "Donations" records of those ledgers
--      (Donations.donation_ledger_id = Donation_Ledgers.id),
--   3. deletes those "Donation_Ledgers" records, and
--   4. deletes the "Non_Profit" record itself.
-- Each step needs the one before it to have worked, and all four run in ONE transaction: if any
-- step fails, every step is undone and nothing is lost.
-- Returns how many Donations and Donation_Ledgers records were removed.
-- Requires public._superadmin_id from users_admin_rpcs.sql.

create or replace function public.delete_non_profit(
  p_username text,
  p_pin text,
  p_non_profit_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_ids bigint[];
  v_deleted_donations int;
  v_deleted_ledgers int;
begin
  if public._superadmin_id(p_username, p_pin) is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  if not exists (select 1 from public."Non_Profit" n where n.id = p_non_profit_id) then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  -- 1. the ledgers tied to this Non Profit
  select coalesce(array_agg(l.id), '{}'::bigint[])
    into v_ledger_ids
  from public."Donation_Ledgers" l
  where l.non_profit_id = p_non_profit_id;

  -- 2. the donations of those ledgers
  delete from public."Donations" d
  where d.donation_ledger_id = any (v_ledger_ids);
  get diagnostics v_deleted_donations = row_count;

  -- 3. the ledgers
  delete from public."Donation_Ledgers" l
  where l.id = any (v_ledger_ids);
  get diagnostics v_deleted_ledgers = row_count;

  -- 4. the Non Profit
  delete from public."Non_Profit" n
  where n.id = p_non_profit_id;

  return jsonb_build_object(
    'success', true,
    'deleted_donations', v_deleted_donations,
    'deleted_ledgers', v_deleted_ledgers
  );
end;
$$;

revoke all on function public.delete_non_profit(text, text, bigint) from public;
grant execute on function public.delete_non_profit(text, text, bigint) to anon, authenticated;
