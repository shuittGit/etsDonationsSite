-- delete_donation_ledger
-- Used by the Delete link on the Donation Ledgers page (SuperAdmin only; username + PIN are
-- verified in the database). For the chosen Donation_Ledgers record (p_ledger_id) it
--   1. deletes the "Donations" records where Donations.donation_ledger_id = that ledger's id, and
--      only once that has succeeded
--   2. deletes the "Donation_Ledgers" record whose id is p_ledger_id.
-- The donations go first, then the ledger. Both steps run in ONE transaction, so if the second
-- step fails the first is undone and nothing is lost.
-- Returns how many Donations records were removed.
-- Requires public._superadmin_id from users_admin_rpcs.sql.

create or replace function public.delete_donation_ledger(
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
  v_deleted_donations int;
begin
  if public._superadmin_id(p_username, p_pin) is null then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  if not exists (select 1 from public."Donation_Ledgers" l where l.id = p_ledger_id) then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  -- 1. the donations of this ledger
  delete from public."Donations" d
  where d.donation_ledger_id = p_ledger_id;
  get diagnostics v_deleted_donations = row_count;

  -- 2. the ledger itself
  delete from public."Donation_Ledgers" l
  where l.id = p_ledger_id;

  return jsonb_build_object('success', true, 'deleted_donations', v_deleted_donations);
end;
$$;

revoke all on function public.delete_donation_ledger(text, text, bigint) from public;
grant execute on function public.delete_donation_ledger(text, text, bigint) to anon, authenticated;
