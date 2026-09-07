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

export type UserDomain = "utility" | "hvac" | "all";

/**
 * Determines whether a user role is scoped to Utility, HVAC, or All (unrestricted).
 */
export const getRoleDomain = (role?: string | null): UserDomain => {
  if (!role) return "all";
  const normalized = role.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (
    normalized === "operator_utility" ||
    normalized === "kashift_utility" ||
    normalized === "unit_head_utility"
  ) {
    return "utility";
  }
  if (
    normalized === "operator_hvac" ||
    normalized === "kashift_hvac" ||
    normalized === "unit_head_hvac"
  ) {
    return "hvac";
  }
  return "all"; // admin, leader, senior_unit_head, kashift_utility_hvac, operator (legacy generic)
};

/**
 * Checks if a unit ID belongs to the HVAC domain.
 */
export const isHvacUnit = (unitId?: string | null): boolean => {
  if (!unitId) return false;
  const lower = unitId.toLowerCase();
  return lower.startsWith("ahu-") || lower.startsWith("hvac-") || lower.startsWith("oac-");
};

/**
 * Checks if a unit ID belongs to the Utility domain.
 */
export const isUtilityUnit = (unitId?: string | null): boolean => {
  if (!unitId) return false;
  return !isHvacUnit(unitId);
};

/**
 * Verifies if the operator/user role is authorized to complete/interact with tasks on this unit.
 * Enforces strict NO CROSS-HANDLING:
 * - Operator Utility can ONLY interact with Utility tasks.
 * - Operator HVAC can ONLY interact with HVAC tasks.
 */
export const canInteractWithTask = (
  role?: string | null,
  unitId?: string | null
): boolean => {
  const domain = getRoleDomain(role);
  if (domain === "all") return true;
  if (domain === "utility") return isUtilityUnit(unitId);
  if (domain === "hvac") return isHvacUnit(unitId);
  return true;
};

/**
 * Checks if a role is any operator variant (operator_utility, operator_hvac, or legacy operator).
 */
export const isOperatorRole = (role?: string | null): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return (
    normalized === "operator" ||
    normalized === "operator_utility" ||
    normalized === "operator_hvac"
  );
};
