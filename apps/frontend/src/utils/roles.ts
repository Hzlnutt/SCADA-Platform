/**
 * Role Permission Helpers
 * Utility functions to verify user permissions across the SCADA platform.
 */

/**
 * Checks if the given role is an authorized Unit Head or Admin:
 * - Admin (admin, superadmin, developer, dev)
 * - Senior Unit Head (senior_unit_head, senior unit head)
 * - Unit Head Utility (unit_head_utility, unit head utility)
 * - Unit Head HVAC (unit_head_hvac, unit head hvac)
 * - Unit Head (unit_head, unithead)
 *
 * Disallowed roles:
 * - Leader, KaShift (all variants), Operator, User, etc.
 */
export const isUnitHeadOrAdmin = (role?: string | null): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return (
    normalized === "admin" ||
    normalized === "superadmin" ||
    normalized === "developer" ||
    normalized === "dev" ||
    normalized === "senior_unit_head" ||
    normalized === "unit_head_utility" ||
    normalized === "unit_head_hvac" ||
    normalized === "unit_head" ||
    normalized === "unithead" ||
    normalized.startsWith("senior_unit_head") ||
    normalized.startsWith("unit_head")
  );
};

/**
 * Checks if the given role is allowed to view and access Configuration and Audit Trail pages/tabs/controls.
 * Only Senior Unit Head, Unit Head Utility, Unit Head HVAC, and Admin are allowed.
 */
export const canAccessConfigAndAudit = (role?: string | null): boolean => {
  return isUnitHeadOrAdmin(role);
};

/**
 * Checks if the given role is allowed to see and use the HVAC Control Panel and control Setpoints.
 * Only Senior Unit Head, Unit Head Utility, Unit Head HVAC, and Admin are allowed.
 * Other roles can only view setpoints and cannot access control panel.
 */
export const canAccessHvacControls = (role?: string | null): boolean => {
  return isUnitHeadOrAdmin(role);
};
