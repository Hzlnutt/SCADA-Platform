/**
 * Role Permission Helpers
 * Utility functions to verify user permissions across the SCADA platform.
 */

/**
 * Checks if the given role is allowed to view and access Configuration and Audit Trail pages/tabs/controls.
 * Allowed roles:
 * - Admin (admin, superadmin, developer, dev)
 * - Leader (leader, team_leader, etc.)
 * - KaShift (kashift, kashift_hvac, kashift_utility, kashift_utility_hvac, ka_shift, kepala_shift, etc.)
 *
 * Disallowed roles:
 * - Operator, user, guest, viewer, etc.
 */
export const canAccessConfigAndAudit = (role?: string | null): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return (
    normalized === "leader" ||
    normalized.includes("leader") ||
    normalized.includes("kashift") ||
    normalized.includes("ka_shift") ||
    normalized.includes("kepala_shift") ||
    normalized === "admin" ||
    normalized === "superadmin" ||
    normalized === "developer" ||
    normalized === "dev"
  );
};
