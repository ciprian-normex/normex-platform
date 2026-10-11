"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { assertStatusTransition, assertTargetManageable, existingAccountOutcome, roleForAssignment } = require("../authority.js");

const org = { status: "ACTIVE", organisationId: "alpha", roleCode: "ORGANISATION_MANAGER", accessLevel: 6, permissions: { canManageUsers: true, canManageOrganisation: true } };
const platform = { status: "ACTIVE", organisationId: "platform", roleCode: "PLATFORM_ADMIN", accessLevel: 99, permissions: {} };
const target = (extra = {}) => ({ status: "ACTIVE", organisationId: "alpha", roleCode: "WORKER", accessLevel: 0, ...extra });
const reason = (fn, value) => assert.throws(fn, error => error.reason === value);

test("unauthenticated and inactive actors are denied", () => {
  reason(() => roleForAssignment(null, "WORKER"), "AUTHORITY_NOT_BELOW_ACTOR");
  reason(() => roleForAssignment({ ...org, status: "INACTIVE" }, "WORKER"), "AUTHORITY_NOT_BELOW_ACTOR");
});
test("wrong organisation is denied", () => reason(() => assertTargetManageable(org, "actor", target({ organisationId: "beta" }), "target"), "WRONG_ORGANISATION"));
test("level 6 may assign 5.5", () => assert.equal(roleForAssignment(org, "PLANT_TRANSPORT_MANAGER").accessLevel, 5.5));
test("level 6 cannot assign 6 or 99", () => {
  reason(() => roleForAssignment(org, "ORGANISATION_MANAGER"), "AUTHORITY_NOT_BELOW_ACTOR");
  reason(() => roleForAssignment(org, "PLATFORM_ADMIN"), "AUTHORITY_NOT_BELOW_ACTOR");
});
test("self authority/status management is denied", () => reason(() => assertTargetManageable(org, "same", target(), "same"), "SELF_MANAGEMENT_DENIED"));
test("peer management is denied", () => reason(() => assertTargetManageable(org, "actor", target({ roleCode: "ORGANISATION_MANAGER", accessLevel: 6 }), "peer"), "TARGET_NOT_BELOW_ACTOR"));
test("Platform Admin remains subject to below-own-level", () => reason(() => roleForAssignment(platform, "PLATFORM_ADMIN"), "AUTHORITY_NOT_BELOW_ACTOR"));
test("normal invite defaults to Worker level 0", () => assert.deepEqual(roleForAssignment(org), { roleCode: "WORKER", label: "Worker", accessLevel: 0, permissions: {} }));
test("duplicate email outcomes remain truthful", () => {
  assert.equal(existingAccountOutcome("ACTIVE"), "EXISTING_ACTIVE");
  assert.equal(existingAccountOutcome("INVITED"), "INVITATION_PENDING");
  assert.equal(existingAccountOutcome("INACTIVE"), "EXISTING_INACTIVE");
});
test("reactivation is an in-place status transition", () => {
  const uid = "existing-uid";
  assert.equal(assertStatusTransition("INACTIVE", "ACTIVE"), "ACTIVE");
  assert.equal(uid, "existing-uid");
  reason(() => assertStatusTransition("ACTIVE", "ACTIVE"), "INVALID_STATUS_TRANSITION");
});
test("a pending invitation can be withdrawn without deletion", () => {
  assert.equal(assertStatusTransition("INVITED", "INACTIVE"), "INACTIVE");
});
