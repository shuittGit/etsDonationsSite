import { supabase } from './usersData';

/** An option for the Admin dropdown: a Users id and "first_name last_name". */
export interface AdminOption {
  id: number;
  name: string;
}

export interface NonProfitRow {
  name: string;
  /** Only a SuperAdmin can pick this; otherwise the creator becomes the admin. */
  admin_id?: number | null;
  email?: string;
  phone_number?: string;
  address?: string;
  description?: string;
}

/** A Non_Profit record plus its administrator's details from the Users table. */
export interface NonProfitListRow {
  id: number;
  created_at: string;
  modified_at: string | null;
  name: string;
  description: string | null;
  admin_id: number;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  url: string | null;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
}

export interface NonProfitsTable {
  columns: string[];
  rows: NonProfitListRow[];
}

/**
 * Obtains every column name and every record of the Non_Profit table with the administrator's
 * first_name, last_name, username and role from Users. SuperAdmin only (verified in the database).
 */
export async function fetchNonProfits(
  username: string,
  pin: number
): Promise<{ success: true; table: NonProfitsTable } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_non_profits', {
    p_username: username,
    p_pin: String(pin),
  });
  if (error) {
    return { success: false, error: `Unable to load non profits: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to view this page.' };
  }
  return { success: true, table: { columns: data.columns, rows: data.rows } };
}

/** What the Non Profit Details popup shows. */
export interface NonProfitDetails {
  id: number;
  name: string;
  email: string | null;
  url: string | null;
  phone_number: string | null;
  address: string | null;
  first_name: string;
  last_name: string;
  username: string;
}

/**
 * Obtains one Non_Profit record's name, email, url, phone and address, and its administrator's
 * first_name, last_name and username from Users. SuperAdmin only (verified in the database).
 */
export async function fetchNonProfitDetails(
  username: string,
  pin: number,
  nonProfitId: number
): Promise<{ success: true; details: NonProfitDetails } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('get_non_profit_details', {
    p_username: username,
    p_pin: String(pin),
    p_non_profit_id: nonProfitId,
  });
  if (error) {
    return { success: false, error: `Unable to load the details: ${error.message}` };
  }
  if (!data?.success) {
    return {
      success: false,
      error:
        data?.error === 'not_found'
          ? 'That non profit no longer exists.'
          : 'You lack the proper permissions to view these details.',
    };
  }
  return { success: true, details: data };
}

/**
 * Deletes a non profit: the Donations records of its ledgers, then the ledgers, then the Non_Profit
 * record itself, in one database transaction (so a failure part-way changes nothing). SuperAdmin only.
 */
export async function deleteNonProfit(
  username: string,
  pin: number,
  nonProfitId: number
): Promise<
  | { success: true; deletedDonations: number; deletedLedgers: number }
  | { success: false; error: string }
> {
  const { data, error } = await supabase.rpc('delete_non_profit', {
    p_username: username,
    p_pin: String(pin),
    p_non_profit_id: nonProfitId,
  });
  if (error) {
    console.error('delete_non_profit failed:', error);
    return { success: false, error: `Unable to delete the non profit: ${error.message}` };
  }
  if (data?.success) {
    return {
      success: true,
      deletedDonations: data.deleted_donations,
      deletedLedgers: data.deleted_ledgers,
    };
  }
  return {
    success: false,
    error:
      data?.error === 'not_found'
        ? 'That non profit no longer exists.'
        : 'You lack the proper permissions to delete a non profit.',
  };
}

/** An id and name from the Non_Profit table, for the Non Profit dropdown. */
export interface NonProfitOption {
  id: number;
  name: string;
}

/** Obtains the id and name of every Non_Profit record. SuperAdmin only (verified in the database). */
export async function fetchNonProfitOptions(
  username: string,
  pin: number
): Promise<{ success: true; nonProfits: NonProfitOption[] } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_non_profit_options', {
    p_username: username,
    p_pin: String(pin),
  });
  if (error) {
    return { success: false, error: `Unable to load non profits: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to choose a non profit.' };
  }
  return { success: true, nonProfits: data.non_profits };
}

/** A Non_Profit record loaded for editing, with the people selectable as its admin. */
export interface NonProfitForEdit {
  id: number;
  name: string;
  description: string | null;
  email: string | null;
  url: string | null;
  phone_number: string | null;
  address: string | null;
  admin_id: number;
  /** The current admin plus every Admin-role user who has no Non Profit yet. */
  admins: AdminOption[];
}

/**
 * Obtains one Non_Profit record (name, email, url, phone, address, ...) and the users who can be
 * its admin: the current admin plus Admin-role users without a Non Profit. SuperAdmin only.
 */
export async function fetchNonProfitForEdit(
  username: string,
  pin: number,
  nonProfitId: number
): Promise<{ success: true; nonProfit: NonProfitForEdit } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('get_non_profit_for_edit', {
    p_username: username,
    p_pin: String(pin),
    p_non_profit_id: nonProfitId,
  });
  if (error) {
    return { success: false, error: `Unable to load the non profit: ${error.message}` };
  }
  if (!data?.success) {
    return {
      success: false,
      error:
        data?.error === 'not_found'
          ? 'That non profit no longer exists.'
          : 'You lack the proper permissions to edit this non profit.',
    };
  }
  return { success: true, nonProfit: data };
}

export interface NonProfitUpdate {
  admin_id: number;
  name: string;
  description?: string;
  email?: string;
  url?: string;
  phone_number?: string;
  address?: string;
}

/** Updates the Non_Profit record with the given id (SuperAdmin only). */
export async function updateNonProfit(
  username: string,
  pin: number,
  nonProfitId: number,
  update: NonProfitUpdate
): Promise<{ success: true } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('update_non_profit', {
    p_username: username,
    p_pin: String(pin),
    p_non_profit_id: nonProfitId,
    p_admin_id: update.admin_id,
    p_name: update.name,
    p_description: update.description ?? null,
    p_email: update.email ?? null,
    p_url: update.url ?? null,
    p_phone_number: update.phone_number ?? null,
    p_address: update.address ?? null,
  });
  if (error) {
    console.error('update_non_profit failed:', error);
    return { success: false, error: `Unable to update the non profit: ${error.message}` };
  }
  if (data?.success) return { success: true };

  const messages: Record<string, string> = {
    name_exists: NON_PROFIT_EXISTS_MESSAGE,
    admin_taken: 'That admin is already assigned to another Non Profit.',
    admin_not_found: 'The selected admin no longer exists.',
    not_found: 'That non profit no longer exists.',
    not_authorized: 'You lack the proper permissions to edit this non profit.',
    invalid_input: 'Please enter a name and choose an admin.',
  };
  return { success: false, error: messages[data?.error] ?? 'Unable to update the non profit.' };
}

export const NON_PROFIT_EXISTS_MESSAGE = 'Non Profit already exist. Please select another name';

/**
 * Obtains the id and name (first_name + last_name) of every Users row that is not
 * already the admin_id of a Non_Profit. SuperAdmin only (verified in the database).
 */
export async function fetchAvailableAdmins(
  username: string,
  pin: number
): Promise<{ success: true; admins: AdminOption[] } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_available_admins', {
    p_username: username,
    p_pin: String(pin),
  });
  if (error) {
    return { success: false, error: `Unable to load admins: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to choose an admin.' };
  }
  return { success: true, admins: data.admins };
}

/**
 * Checks the Non_Profit table for the name; if it is free, inserts the form values.
 */
export async function createNonProfit(
  username: string,
  pin: number,
  row: NonProfitRow
): Promise<{ success: true } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('create_non_profit', {
    p_username: username,
    p_pin: String(pin),
    p_name: row.name,
    p_admin_id: row.admin_id ?? null,
    p_email: row.email ?? null,
    p_phone_number: row.phone_number ?? null,
    p_address: row.address ?? null,
    p_description: row.description ?? null,
  });

  if (error) {
    console.error('create_non_profit failed:', error);
    return { success: false, error: `Unable to save the Non Profit: ${error.message}` };
  }
  if (data?.success) return { success: true };

  const messages: Record<string, string> = {
    name_exists: NON_PROFIT_EXISTS_MESSAGE,
    admin_taken: 'That admin is already assigned to a Non Profit.',
    admin_not_found: 'The selected admin no longer exists.',
    not_authorized: 'You lack the proper permissions to create a Non Profit.',
    invalid_input: 'Please enter a name.',
  };
  return { success: false, error: messages[data?.error] ?? 'Unable to save the Non Profit.' };
}
