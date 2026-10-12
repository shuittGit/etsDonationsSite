import { supabase } from './usersData';

/** One Donations record with its donor and Non Profit. */
export interface DonationListRow {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  /** The Non Profit's name. */
  name: string;
  amount: number;
  /** YYYY-MM-DD */
  date_applied: string;
}

/** The numbers on the dashboard cards above the Donations List grid. */
export interface DonationsListStats {
  total_donated: number;
  total_contributors: number;
  non_profits: number;
  total_allocated: number;
  total_allocated_amount: number;
  total_remaining: number;
  total_remaining_amount: number;
}

/**
 * Obtains the dashboard card numbers for what the signed-in user may see: a Donor their own
 * donations, an Admin those of their Non Profit, a SuperAdmin everything (decided in the database),
 * narrowed by the same payment type, year ('YYYY' or 'All') and Non Profit id (or 'All') as the grid.
 */
export async function fetchDonationsListStats(
  username: string,
  pin: number,
  displayType: PaymentType = 'All',
  year: string = 'All',
  nonProfitId: string = 'All'
): Promise<{ success: true; stats: DonationsListStats } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('get_donations_list_stats', {
    p_username: username,
    p_pin: String(pin),
    p_display_type: displayType,
    p_year: year,
    p_non_profit_id: nonProfitId,
  });
  if (error) {
    return { success: false, error: `Unable to load the totals: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to view these totals.' };
  }
  return { success: true, stats: data };
}

/** An id and name from the Non_Profit table, for the Non Profit dropdown. */
export interface NonProfitFilterOption {
  id: number;
  name: string;
}

/**
 * Obtains the Non Profits the signed-in user may filter by: a Donor gets those they have a ledger
 * with, an Admin the one they administer, a SuperAdmin all of them. The page adds 'All' itself.
 */
export async function fetchDonationNonProfits(
  username: string,
  pin: number
): Promise<{ success: true; nonProfits: NonProfitFilterOption[] } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_donation_non_profits', {
    p_username: username,
    p_pin: String(pin),
  });
  if (error) {
    return { success: false, error: `Unable to load the non profits: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to view this page.' };
  }
  return { success: true, nonProfits: data.non_profits };
}

/**
 * Obtains every year ('YYYY', newest first) from the earliest to the latest date_applied among the
 * donations the signed-in user may see. It does not depend on the Payment Type or Non Profit
 * selections. The page adds the 'All' option itself.
 */
export async function fetchDonationYears(
  username: string,
  pin: number
): Promise<{ success: true; years: string[] } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_donation_years', {
    p_username: username,
    p_pin: String(pin),
  });
  if (error) {
    return { success: false, error: `Unable to load the years: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to view this page.' };
  }
  return { success: true, years: data.years };
}

/** Which payments to list: applied so far, still to come, or all of them. */
export type PaymentType = 'Allocated' | 'Remaining' | 'All';

export const PAYMENT_TYPES: PaymentType[] = ['Allocated', 'Remaining', 'All'];

/**
 * Obtains the donations the signed-in user may see, newest date_applied first: a Donor sees their
 * own, an Admin the donations of their Non Profit, a SuperAdmin all of them (decided in the
 * database from the verified username + PIN). displayType narrows them by date_applied:
 * Allocated = on or before today, Remaining = after today, All = every record. year is
 * 'YYYY' (date_applied from YYYY-01-01 to YYYY-12-31) or 'All' (no year limit). nonProfitId is
 * a Non_Profit id (as text) or 'All' (no Non Profit limit).
 */
export async function fetchDonationsList(
  username: string,
  pin: number,
  displayType: PaymentType = 'Allocated',
  year: string = String(new Date().getFullYear()),
  nonProfitId: string = 'All'
): Promise<{ success: true; donations: DonationListRow[] } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_donations', {
    p_username: username,
    p_pin: String(pin),
    p_display_type: displayType,
    p_year: year,
    p_non_profit_id: nonProfitId,
  });
  if (error) {
    return { success: false, error: `Unable to load donations: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to view this page.' };
  }
  return { success: true, donations: data.donations };
}
