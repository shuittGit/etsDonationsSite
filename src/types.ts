export interface DonationRecord {
  userId: string;
  name: string;
  pin: string;
  nonProfit: string;
  amount: number;
  dateDonated: string;
}

export interface UserSession {
  username: string;
  name: string;
  isAdmin: boolean;
  loginTime: string;
  /** Role from the Supabase Users table (only set for database sign-ins). */
  role?: string;
  /** PIN of a database sign-in; the Users page sends it to prove the caller is a SuperAdmin. */
  pin?: number;
  /** id of the user's row in the Users table (database sign-ins only). */
  id?: number;
  /** Whether the user's id is already an admin_id in Non_Profit (database sign-ins only). */
  hasNonProfit?: boolean;
}

