-- list_donation_ledgers  (replaces the earlier version; same signature)
-- Returns every column name of "Donation_Ledgers" and the ledger records, joined with:
--   * "Users"      (Users.id = Donation_Ledgers.user_id)        -> username, first_name, last_name
--   * "Non_Profit" (Non_Profit.id = Donation_Ledgers.non_profit_id) -> non_profit_name
-- and these calculated fields, worked out from "Donations" for each ledger
-- (Donations.donation_ledger_id = Donation_Ledgers.id, and the ledger's user_id = Users.id):
--   num_donations_made = count of the ledger's Donations records applied so far
--   amount_allocated   = sum of the amount of those Donations records
-- "Applied so far" means date_applied <= today. add_donation creates ALL of a ledger's Donations
-- rows up front, so counting every row would make these always equal the totals. To count every
-- record instead, delete the line  where d.date_applied <= current_date  in the subquery below.
-- Who can call it (username + PIN are verified in the database):
--   * SuperAdmin -> every ledger
--   * Admin      -> only the ledgers of the Non Profit they administer (Non_Profit.admin_id = their id)
--   * any other role (a newly created account, a Donor, ...) -> only the ledgers tied to their own
--     user id (Donation_Ledgers.user_id = their Users.id); for a new account that is none
--   * a username / PIN that does not match a user -> not_authorized

create or replace function public.list_donation_ledgers(p_username text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id bigint;
  caller_role text;
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

  return jsonb_build_object(
    'success', true,
    'columns', (
      select coalesce(jsonb_agg(c.column_name order by c.ordinal_position), '[]'::jsonb)
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'Donation_Ledgers'
    ),
    'rows', (
      select coalesce(jsonb_agg(r.record order by r.username, r.id), '[]'::jsonb)
      from (
        select
          l.id,
          u.username,
          -- the ledger's own columns, then the joined and calculated fields (these replace any
          -- stored column of the same name)
          to_jsonb(l) || jsonb_build_object(
            'username', u.username,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'non_profit_name', n.name,
            'num_donations_made', coalesce(dn.num_donations_made, 0),
            'amount_allocated', coalesce(dn.amount_allocated, 0)
          ) as record
        from public."Donation_Ledgers" l
        join public."Users" u on u.id = l.user_id
        join public."Non_Profit" n on n.id = l.non_profit_id
        left join (
          -- per ledger: how many Donations records are applied so far, and their total amount
          select
            d.donation_ledger_id,
            count(d.id) as num_donations_made,
            sum(d.amount) as amount_allocated
          from public."Donations" d
          where d.date_applied <= current_date
          group by d.donation_ledger_id
        ) dn on dn.donation_ledger_id = l.id
        where caller_role = 'SuperAdmin'
           or (caller_role = 'Admin' and n.admin_id = caller_id)
           -- any other role (such as a newly created account): only ledgers tied to their own user id
           or (caller_role not in ('SuperAdmin', 'Admin') and l.user_id = caller_id)
      ) r
    )
  );
end;
$$;

revoke all on function public.list_donation_ledgers(text, text) from public;
grant execute on function public.list_donation_ledgers(text, text) to anon, authenticated;
