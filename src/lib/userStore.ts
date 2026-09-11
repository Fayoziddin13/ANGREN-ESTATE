import { UserProfile, UserRole } from "./types";

/**
 * User Store & Role Definitions for ANGREN ESTATE
 *
 * In Phase 4B Step 4, mock users were completely purged and replaced with canonical
 * Supabase auth.users & public.profiles. Admin management operates via
 * /api/admin/users and /api/admin/users/[id].
 */

export const SUPPORTED_ROLES: UserRole[] = ["user", "admin", "realtor"];

export interface StoredUser extends UserProfile {
  role: "user" | "admin" | "realtor";
}

// Pure backward-compatible stubs (zero mock data stored)
export function getStoredUsers(): UserProfile[] {
  return [];
}
