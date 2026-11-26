// Who may use which environment. Roles come from host.user, under the claim below.
//
// The platform writes the parts of a role separated by backslashes, and the number of backslashes differs
// between roles: a tenant role looks like "<tenantId>\\[XMCloud]\\User" (two backslashes) in the data. So every
// role is normalised, with each run of backslashes reduced to one, before it is compared. Both formats match.

const ROLES_CLAIM = "https://auth.sitecorecloud.io/claims/roles";

// Organization roles that may use every environment, with no per-environment check.
const FULL_ACCESS_ROLES = ["[Organization]\\Organization Admin", "[Organization]\\Organization Owner"];

// Per-environment roles. Each is written as "<tenantId>" followed by a backslash and one of these suffixes.
const ENVIRONMENT_ROLE_SUFFIXES = ["[XMCloud]\\User", "[XMCloud]\\Advance User"];

function normalizeRole(role: string): string {
  return role.replace(/\\+/g, "\\");
}

// Reads the role list from host.user. Anything other than a list of strings counts as no roles.
export function readRoles(userInfo: unknown): string[] {
  if (!userInfo || typeof userInfo !== "object") return [];
  const roles = (userInfo as Record<string, unknown>)[ROLES_CLAIM];
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
}

export function hasFullAccess(roles: string[]): boolean {
  const normalized = roles.map(normalizeRole);
  return FULL_ACCESS_ROLES.some((role) => normalized.includes(normalizeRole(role)));
}

// True when the user holds an XMCloud User or Advance User role for the environment's tenant.
export function canUseTenant(roles: string[], tenantId: string): boolean {
  const normalized = roles.map(normalizeRole);
  return ENVIRONMENT_ROLE_SUFFIXES.some((suffix) => normalized.includes(normalizeRole(`${tenantId}\\${suffix}`)));
}
