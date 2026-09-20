import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../../modules/contractor/plant/movements/movements.js", import.meta.url), "utf8");
const start = source.indexOf("const STATUSES");
const end = source.lastIndexOf("waitForWorkspace();");
const context = vm.createContext({ organisationId: "tenant-a" });
vm.runInContext(source.slice(start, end).replace("let profile, organisationId, assets", "let profile; organisationId = 'tenant-a'; let assets"), context);
const { management, allowedTransition, deliveryAssetUpdate } = context;
const manager = { status: "ACTIVE", organisationId: "tenant-a", roleCode: "PLANT_TRANSPORT_MANAGER", accessLevel: 5.5, permissions: {}, displayName: "Alex" };
const record = { organisationId: "tenant-a" };

test("movement management is tenant-scoped and rejects inactive or numeric-only authority", () => {
  assert.equal(management(manager, record), true);
  assert.equal(management({ ...manager, roleCode: "PLATFORM_ADMIN", accessLevel: 99 }, record), true);
  assert.equal(management({ ...manager, organisationId: "tenant-b" }, record), false);
  assert.equal(management({ ...manager, status: "INACTIVE" }, record), false);
  assert.equal(management({ ...manager, roleCode: "SITE_MANAGER", accessLevel: 99 }, record), false);
  assert.equal(management(manager, { organisationId: "tenant-b" }), false);
});
test("lifecycle allows only forward operational transitions and cancellation before delivery", () => {
  assert.equal(allowedTransition("PLANNED", "READY"), true);
  assert.equal(allowedTransition("READY", "IN_TRANSIT"), true);
  assert.equal(allowedTransition("IN_TRANSIT", "DELIVERED"), true);
  assert.equal(allowedTransition("PLANNED", "DELIVERED"), false);
  assert.equal(allowedTransition("DELIVERED", "CANCELLED"), false);
});
test("delivery, and only delivery, produces the destination asset position patch", () => {
  const update = deliveryAssetUpdate({ toLocation: "Project B", toProjectId: "project-b", toProjectName: "Project B" }, "uid", manager, "server-time");
  assert.deepEqual(JSON.parse(JSON.stringify(update)), { currentLocationLabel: "Project B", currentLocationConfirmedAt: "server-time", currentLocationConfirmedByUid: "uid", currentLocationConfirmedByName: "Alex", currentProjectId: "project-b", currentProjectName: "Project B", updatedByUid: "uid", updatedByName: "Alex", updatedAt: "server-time" });
});
