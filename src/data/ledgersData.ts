import { supabase } from './usersData';

/** One row of the ledgers grid: a Donation_Ledgers record plus its Users / Donations details. */
export interface DonationLedgerRow {
  id: number;
  user_id: number;
  created_at: string;
  modified_at: string | null;
  non_profit_id: number;
  non_profit_name: string;
  username: string;
  first_name: string;
  last_name: string;
  total_num_of_donations: number | null;
  total_amount: number | null;
  num_donations_made: number | null;
  amount_allocated: number | null;
  num_donations_remaining: number | null;
  amount_remaining: number | null;
  donation_start_date: string | null;
  donation_end_date: string | null;
}

export interface DonationLedgersTable {
  columns: string[];
  rows: DonationLedgerRow[];
}

/**
 * Deletes a donation ledger: first its Donations records, then the Donation_Ledgers record itself,
 * in one database transaction (so a failure part-way changes nothing). SuperAdmin only.
 */
export async function deleteDonationLedger(
  username: string,
  pin: number,
  ledgerId: number
): Promise<{ success: true; deletedDonations: number } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('delete_donation_ledger', {
    p_username: username,
    p_pin: String(pin),
    p_ledger_id: ledgerId,
  });
  if (error) {
    console.error('delete_donation_ledger failed:', error);
    return { success: false, error: `Unable to delete the donation ledger: ${error.message}` };
  }
  if (data?.success) return { success: true, deletedDonations: data.deleted_donations };
  return {
    success: false,
    error:
      data?.error === 'not_found'
        ? 'That donation ledger no longer exists.'
        : 'You lack the proper permissions to delete a donation ledger.',
  };
}

/** The numbers on the summary cards above the Donation Ledgers grid. */
export interface DonationLedgerStats {
  total_donated: number;
  total_contributors: number;
  non_profits: number;
  total_allocated: number;
  total_allocated_amount: number;
}

/**
 * Obtains the summary card numbers. A SuperAdmin gets totals for everything; an Admin gets them
 * for the Non Profit they administer (verified in the database).
 */
export async function fetchDonationLedgerStats(
  username: string,
  pin: number
): Promise<{ success: true; stats: DonationLedgerStats } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('get_donation_ledger_stats', {
    p_username: username,
    p_pin: String(pin),
  });
  if (error) {
    return { success: false, error: `Unable to load the totals: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to view these totals.' };
  }
  return { success: true, stats: data };
}

/** Everything the Details popup shows for one Donation_Ledgers record. */
export interface DonationLedgerDetails {
  donation_ledger_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
  non_profit_name: string;
  donation_start_date: string | null;
  donation_end_date: string | null;
  total_num_of_donations: number | null;
  total_amount: number | null;
  avg_donation_amount: number | null;
  num_donations_allocated: number;
  num_donations_remaining: number | null;
  amount_allocated: number;
  amount_remaining: number | null;
  /** Donations amount / date_applied pairs, earliest first. */
  donations: { amount: number; date_applied: string }[];
}

/**
 * Obtains the details of one donation ledger from the Users, Donation_Ledgers, Non_Profit and
 * Donations tables, including the allocated / remaining counts and amounts.
 */
export async function fetchDonationLedgerDetails(
  username: string,
  pin: number,
  ledgerId: number
): Promise<{ success: true; details: DonationLedgerDetails } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('get_donation_ledger_details', {
    p_username: username,
    p_pin: String(pin),
    p_ledger_id: ledgerId,
  });
  if (error) {
    return { success: false, error: `Unable to load the details: ${error.message}` };
  }
  if (!data?.success) {
    return {
      success: false,
      error:
        data?.error === 'not_found'
          ? 'That donation ledger no longer exists.'
          : 'You lack the proper permissions to view these details.',
    };
  }
  return { success: true, details: data };
}

/**
 * Obtains every column name and every record of the Donation_Ledgers table, with the
 * user's username / first_name / last_name. A SuperAdmin gets every ledger; an Admin only the
 * ledgers of the Non Profit they administer (verified in the database).
 */
export async function fetchDonationLedgers(
  username: string,
  pin: number
): Promise<{ success: true; table: DonationLedgersTable } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_donation_ledgers', {
    p_username: username,
    p_pin: String(pin),
  });
  if (error) {
    return { success: false, error: `Unable to load donation ledgers: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to view this page.' };
  }
  return { success: true, table: { columns: data.columns, rows: data.rows } };
}
