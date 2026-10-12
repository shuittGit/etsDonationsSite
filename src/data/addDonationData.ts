import { supabase } from './usersData';

export interface NewDonationRecord {
  /** Users id of the donor (the Name selection). */
  user_id: number;
  total_num_of_donations: number;
  total_amount: number;
  /** YYYY-MM-DD */
  start_date: string;
  /** YYYY-MM-DD (the last element of scheduled_payments) */
  end_date: string;
  /** One YYYY-MM-DD date per donation; the first is the start date. */
  scheduled_payments: string[];
  /** The Non_Profit id chosen by a SuperAdmin; an Admin's own Non Profit is used regardless. */
  non_profit_id?: number | null;
}

/**
 * Updates an existing donation. The database function keeps the ledger's old Donations records
 * in place while it updates the Donation_Ledgers record and inserts the new Donations records,
 * and only then deletes the old ones, all in one transaction. If anything fails, nothing changes.
 */
export async function updateDonation(
  username: string,
  pin: number,
  ledgerId: number,
  record: NewDonationRecord
): Promise<{ success: true } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('update_donation', {
    p_username: username,
    p_pin: String(pin),
    p_ledger_id: ledgerId,
    p_user_id: record.user_id,
    p_total_num_of_donations: record.total_num_of_donations,
    p_total_amount: record.total_amount,
    p_start_date: record.start_date,
    p_end_date: record.end_date,
    p_scheduled_payments: record.scheduled_payments,
  });

  if (error) {
    console.error('update_donation failed:', error);
    return { success: false, error: `Unable to update the donation: ${error.message}` };
  }
  if (data?.success) return { success: true };

  const messages: Record<string, string> = {
    not_authorized: 'You lack the proper permissions to edit this donation.',
    not_found: 'That donation ledger no longer exists.',
    invalid_input: 'Please check the form values and try again.',
    user_not_found: 'The selected donor no longer exists.',
  };
  return { success: false, error: messages[data?.error] ?? 'Unable to update the donation.' };
}

/**
 * Inserts the Donation_Ledgers record and, using that record's id as donation_ledger_id,
 * one Donations record per scheduled payment (the amount is the average donation amount and
 * date_applied is that element of scheduled_payments). Both steps run inside one database
 * function, so either everything is saved or nothing is.
 */
export async function addDonation(
  username: string,
  pin: number,
  record: NewDonationRecord
): Promise<{ success: true; donationLedgerId: number } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('add_donation', {
    p_username: username,
    p_pin: String(pin),
    p_user_id: record.user_id,
    p_total_num_of_donations: record.total_num_of_donations,
    p_total_amount: record.total_amount,
    p_start_date: record.start_date,
    p_end_date: record.end_date,
    p_scheduled_payments: record.scheduled_payments,
    p_non_profit_id: record.non_profit_id ?? null,
  });

  if (error) {
    console.error('add_donation failed:', error);
    return { success: false, error: `Unable to save the donation: ${error.message}` };
  }
  if (data?.success) return { success: true, donationLedgerId: data.donation_ledger_id };

  const messages: Record<string, string> = {
    not_authorized: 'You lack the proper permissions to add a donation.',
    invalid_input: 'Please check the form values and try again.',
    user_not_found: 'The selected donor no longer exists.',
    no_non_profit: 'No Non Profit is assigned to your account, so a donation cannot be added.',
  };
  return { success: false, error: messages[data?.error] ?? 'Unable to save the donation.' };
}
