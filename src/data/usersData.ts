import { createClient } from '@supabase/supabase-js';

/**
 * "Users" table access, backed by the Supabase project.
 *
 * Inserts go through the `create_user` database function (see
 * supabase/migrations/create_user_rpc.sql), which checks for an existing username
 * and inserts the row in one step. The browser never reads the Users table directly.
 */

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

export interface UserRow {
  username: string;
  first_name: string;
  last_name: string;
  pin: string;
  email?: string;
  phone_number?: string;
  address?: string;
}

/** A row of the Supabase Users table. */
export interface UserTableRow {
  id: number;
  created_at: string;
  first_name: string;
  last_name: string;
  username: string;
  pin: number;
  role: string;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  modified_at: string | null;
}

export interface UsersTable {
  columns: string[];
  rows: UserTableRow[];
}

export const ROLE_OPTIONS = ['Donor', 'Admin', 'Awaiting Approval'];

/** Signs in against the Users table. Returns the matching user's details, or null. */
export async function loginUser(
  username: string,
  pin: number
): Promise<{
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  has_non_profit: boolean;
} | null> {
  const { data, error } = await supabase.rpc('login_user', { p_username: username, p_pin: pin });
  if (error) {
    console.error('login_user failed:', error);
    return null;
  }
  return data?.success ? data : null;
}

/**
 * Obtains every column name and every record of the Users table.
 * Only a SuperAdmin (verified in the database with their username + PIN) can read it.
 */
export async function fetchUsersTable(
  adminUsername: string,
  adminPin: number
): Promise<{ success: true; table: UsersTable } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_users', {
    p_username: adminUsername,
    p_pin: String(adminPin),
  });
  if (error) {
    return { success: false, error: `Unable to load users: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to view this page.' };
  }
  return { success: true, table: { columns: data.columns, rows: data.rows } };
}

/**
 * Deletes a user: the donations and ledgers tied to them (as a donor, or through a Non Profit they
 * administer), that Non Profit, then the Users record itself, in one database transaction (so a
 * failure part-way changes nothing). SuperAdmin only; a SuperAdmin cannot delete themselves.
 */
export async function deleteUser(
  adminUsername: string,
  adminPin: number,
  targetId: number
): Promise<{ success: true } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('delete_user', {
    p_username: adminUsername,
    p_pin: String(adminPin),
    p_user_id: targetId,
  });
  if (error) {
    console.error('delete_user failed:', error);
    return { success: false, error: `Unable to delete the user: ${error.message}` };
  }
  if (data?.success) return { success: true };

  const messages: Record<string, string> = {
    not_authorized: 'You lack the proper permissions to delete a user.',
    cannot_delete_self: 'You cannot delete your own account.',
    not_found: 'That user no longer exists.',
  };
  return { success: false, error: messages[data?.error] ?? 'Unable to delete the user.' };
}

/** Updates the Role field of one row in the Users table (SuperAdmin only). */
export async function updateUserRole(
  adminUsername: string,
  adminPin: number,
  targetId: number,
  role: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('update_user_role', {
    p_username: adminUsername,
    p_pin: String(adminPin),
    p_target_id: targetId,
    p_role: role,
  });
  if (error) {
    return { success: false, error: `Unable to update the role: ${error.message}` };
  }
  if (data?.success) return { success: true };

  const messages: Record<string, string> = {
    not_authorized: 'You lack the proper permissions to change roles.',
    cannot_change_own_role: 'You cannot change your own role.',
    invalid_role: 'That role is not allowed.',
    not_found: 'That user no longer exists.',
  };
  return { success: false, error: messages[data?.error] ?? 'Unable to update the role.' };
}

export const USERNAME_EXISTS_MESSAGE = 'Username already exist. Please select another username';

/**
 * Checks the Users table for the username; if it is free, inserts the form values.
 */
export async function createUser(
  row: UserRow
): Promise<{ success: true } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('create_user', {
    p_username: row.username,
    p_first_name: row.first_name,
    p_last_name: row.last_name,
    p_pin: row.pin,
    p_email: row.email ?? null,
    p_phone_number: row.phone_number ?? null,
    p_address: row.address ?? null,
  });

  if (error) {
    console.error('create_user failed:', error);
    return { success: false, error: `Unable to save the profile: ${error.message}` };
  }
  if (data?.success) {
    return { success: true };
  }
  if (data?.error === 'username_exists') {
    return { success: false, error: USERNAME_EXISTS_MESSAGE };
  }
  return { success: false, error: 'Unable to save the profile. Please check the form and try again.' };
}
