-- delete_user
-- Used by the Delete link on the Users page (SuperAdmin only; username + PIN are verified in the
-- database). For the chosen Users record (p_user_id), in this order:
--   1. finds the Non Profits the user administers (Non_Profit.admin_id = the user's id), and the
--      ids of every Donation_Ledgers record tied to them (Donation_Ledgers.non_profit_id) or to
--      the user as a donor (Donation_Ledgers.user_id = the user's id),
--   2. deletes the "Donations" records of those ledgers (Donations.donation_ledger_id),
--   3. deletes those "Donation_Ledgers" records,
--   4. deletes the Non Profits the user administers, and
--   5. deletes the "Users" record itself.
-- Each step needs the one before it to have worked, and all of them run in ONE transaction: if any
-- step fails, every step is undone and nothing is lost.
--
-- Guard: a SuperAdmin cannot delete their own account (that would lock them out).
--
-- Returns how many Donations, Donation_Ledgers and Non_Profit records were removed.
-- Requires public._superadmin_id from users_admin_rpcs.sql.

create or replace function public.delete_user(
  p_username text,
  p_pin text,
  p_user_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id bigint := public._superadmin_id(p_username, p_pin);
  v_non_profit_ids bigint[];
  v_ledger_ids bigint[];
  v_deleted_donations int;
  v_deleted_ledgers int;
  v_deleted_non_profits int;
begin
  if v_caller_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  if p_user_id = v_caller_id then
    return jsonb_build_object('success', false, 'error', 'cannot_delete_self');
  end if;

  if not exists (select 1 from public."Users" u where u.id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  -- 1. the Non Profits this user administers, and every ledger tied to them or to the user
  select coalesce(array_agg(n.id), '{}'::bigint[])
    into v_non_profit_ids
  from public."Non_Profit" n
  where n.admin_id = p_user_id;

  select coalesce(array_agg(l.id), '{}'::bigint[])
    into v_ledger_ids
  from public."Donation_Ledgers" l
  where l.user_id = p_user_id
     or l.non_profit_id = any (v_non_profit_ids);

  -- 2. the donations of those ledgers
  delete from public."Donations" d
  where d.donation_ledger_id = any (v_ledger_ids);
  get diagnostics v_deleted_donations = row_count;

  -- 3. the ledgers
  delete from public."Donation_Ledgers" l
  where l.id = any (v_ledger_ids);
  get diagnostics v_deleted_ledgers = row_count;

  -- 4. the Non Profits this user administers
  delete from public."Non_Profit" n
  where n.id = any (v_non_profit_ids);
  get diagnostics v_deleted_non_profits = row_count;

  -- 5. the user
  delete from public."Users" u
  where u.id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'deleted_donations', v_deleted_donations,
    'deleted_ledgers', v_deleted_ledgers,
    'deleted_non_profits', v_deleted_non_profits
  );
end;
$$;

revoke all on function public.delete_user(text, text, bigint) from public;
grant execute on function public.delete_user(text, text, bigint) to anon, authenticated;
