import { supabase } from './usersData';

/** A Users row with the role Donor: id, "first_name last_name" (as name) and username. */
export interface DonorOption {
  id: number;
  name: string;
  username: string;
}

/**
 * Obtains the id, name (first_name + last_name) and username of every Users row whose
 * role is Donor. SuperAdmin and Admin only (verified in the database).
 */
export async function fetchDonors(
  username: string,
  pin: number
): Promise<{ success: true; donors: DonorOption[] } | { success: false; error: string }> {
  const { data, error } = await supabase.rpc('list_donors', {
    p_username: username,
    p_pin: String(pin),
  });
  if (error) {
    return { success: false, error: `Unable to load donors: ${error.message}` };
  }
  if (!data?.success) {
    return { success: false, error: 'You lack the proper permissions to choose a donor.' };
  }
  return { success: true, donors: data.donors };
}
