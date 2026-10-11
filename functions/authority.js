"use strict";

const ROLES = Object.freeze([
  { roleCode: "WORKER", label: "Worker", accessLevel: 0, permissions: {} },
  { roleCode: "SUPERVISOR", label: "Supervisor", accessLevel: 1, permissions: {} },
  { roleCode: "SITE_MANAGER", label: "Site Manager", accessLevel: 2, permissions: {} },
  { roleCode: "PROJECT_MANAGER", label: "Project Manager", accessLevel: 3, permissions: {} },
  { roleCode: "SENIOR_PROJECT_MANAGER", label: "Senior Project Manager", accessLevel: 4, permissions: { canViewAllProjects: true } },
  { roleCode: "HEALTH_SAFETY", label: "Health & Safety", accessLevel: 4.5, permissions: {} },
  { roleCode: "SENIOR_HEALTH_SAFETY", label: "Senior Health & Safety", accessLevel: 4.6, permissions: { canViewAllProjects: true, canManageAssurance: true } },
  { roleCode: "CONTRACTS_MANAGER", label: "Contracts Manager", accessLevel: 5, permissions: { canViewAllProjects: true, canCreateProjects: true, canViewCommercial: true, canManageCommercial: true } },
  { roleCode: "PLANT_TRANSPORT_MANAGER", label: "Plant / Transport Manager", accessLevel: 5.5, permissions: { canViewAllProjects: true, canViewPlant: true, canRequestPlant: true, canManagePlant: true, canManageTransport: true } },
  { roleCode: "ORGANISATION_MANAGER", label: "Organisation Manager", accessLevel: 6, permissions: { canViewAllProjects: true, canCreateProjects: true, canManageOrganisation: true, canManageUsers: true, canManageAssurance: true, canViewCommercial: true, canManageCommercial: true, canViewPlant: true, canRequestPlant: true, canManagePlant: true, canManageTransport: true } },
  { roleCode: "PLATFORM_ADMIN", label: "Platform Administration", accessLevel: 99, permissions: { canViewAllProjects: true, canCreateProjects: true, canManageOrganisation: true, canManageUsers: true, canManageAssurance: true, canViewCommercial: true, canManageCommercial: true, canViewPlant: true, canRequestPlant: true, canManagePlant: true, canManageTransport: true } }
]);

const ROLE_MAP = new Map(ROLES.map(role => [role.roleCode, role]));
const EMPLOYMENT_TYPES = new Set(["EMPLOYEE", "AGENCY", "SUBCONTRACTOR"]);
const ACCOUNT_STATUSES = new Set(["INVITED", "ACTIVE", "INACTIVE"]);
const canonicalRole = profile => ROLE_MAP.get(String(profile?.roleCode || "").trim().toUpperCase()) || null;

function isCanonicalProfile(profile) {
  const role = canonicalRole(profile);
  return Boolean(role && profile?.status === "ACTIVE" && Number(profile.accessLevel) === role.accessLevel && typeof profile.organisationId === "string" && profile.organisationId.trim());
}

function isPlatformAdmin(profile) {
  return isCanonicalProfile(profile) && profile.roleCode === "PLATFORM_ADMIN";
}

function canAdministerUsers(profile) {
  if (isPlatformAdmin(profile)) return true;
  return isCanonicalProfile(profile) && profile.roleCode === "ORGANISATION_MANAGER" && profile.permissions?.canManageUsers === true && profile.permissions?.canManageOrganisation === true;
}

function roleForAssignment(actor, roleCode = "WORKER") {
  const role = ROLE_MAP.get(String(roleCode || "WORKER").trim().toUpperCase());
  if (!role) throw Object.assign(new Error("Unknown authority."), { reason: "INVALID_AUTHORITY" });
  if (!canAdministerUsers(actor) || role.accessLevel >= Number(actor.accessLevel)) throw Object.assign(new Error("Authority must be below your own."), { reason: "AUTHORITY_NOT_BELOW_ACTOR" });
  return { ...role, permissions: { ...role.permissions } };
}

function assertTargetManageable(actor, actorUid, target, targetUid) {
  if (!canAdministerUsers(actor)) throw Object.assign(new Error("User administration permission is required."), { reason: "PERMISSION_DENIED" });
  if (!target || !ACCOUNT_STATUSES.has(target.status)) throw Object.assign(new Error("The target account is unavailable."), { reason: "TARGET_UNAVAILABLE" });
  if (actorUid === targetUid) throw Object.assign(new Error("You cannot manage your own authority or account status here."), { reason: "SELF_MANAGEMENT_DENIED" });
  if (!isPlatformAdmin(actor) && target.organisationId !== actor.organisationId) throw Object.assign(new Error("The target account belongs to another organisation."), { reason: "WRONG_ORGANISATION" });
  if (Number(target.accessLevel) >= Number(actor.accessLevel)) throw Object.assign(new Error("Peer and higher-authority accounts cannot be managed."), { reason: "TARGET_NOT_BELOW_ACTOR" });
  return true;
}

function assignableRoles(actor) {
  return canAdministerUsers(actor) ? ROLES.filter(role => role.accessLevel < Number(actor.accessLevel)).map(role => ({ ...role, permissions: { ...role.permissions } })) : [];
}

function existingAccountOutcome(status) {
  if (status === "ACTIVE") return "EXISTING_ACTIVE";
  if (status === "INVITED") return "INVITATION_PENDING";
  if (status === "INACTIVE") return "EXISTING_INACTIVE";
  throw Object.assign(new Error("The existing account has an unsupported status."), { reason: "TARGET_UNAVAILABLE" });
}

function assertStatusTransition(current, next) {
  const valid = (next === "INACTIVE" && ["ACTIVE", "INVITED"].includes(current)) || (next === "ACTIVE" && current === "INACTIVE");
  if (!valid) throw Object.assign(new Error("The requested account status transition is not allowed."), { reason: "INVALID_STATUS_TRANSITION" });
  return next;
}

module.exports = { ACCOUNT_STATUSES, EMPLOYMENT_TYPES, ROLES, ROLE_MAP, assertStatusTransition, assertTargetManageable, assignableRoles, canAdministerUsers, canonicalRole, existingAccountOutcome, isCanonicalProfile, isPlatformAdmin, roleForAssignment };
