// Local master-data tests: no Firebase connection or live writes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { PLANT_TYPES } from "../../modules/contractor/plant/shared/plant-catalogue.js";

const source = readFileSync(new URL("../../modules/contractor/plant/asset/asset.js", import.meta.url), "utf8");
const context = vm.createContext({ PLANT_TYPES, cleanString: value => String(value ?? "").trim() });
vm.runInContext(source.slice(source.indexOf("const ASSET_EDIT_FIELDS"), source.lastIndexOf("waitForWorkspace();")), context);
const { canEditAsset, buildAssetEditUpdate, getCurrentAssignment, deploymentLocationUpdate } = context;
const manager = { organisationId: "a", status: "ACTIVE", roleCode: "PLANT_TRANSPORT_MANAGER", accessLevel: 5.5, displayName: "Alex", permissions: {} };
const asset = { id: "a__EXC-0001", plantId: "EXC-0001", plantReference: "EXC-0001", organisationId: "a", plantType: "EXCAVATOR", manufacturer: "Hitachi", model: "ZX", attachments: [], ownershipType: "HIRED", currentHireRecordId: "hire", safeToUse: false };
const build = (input = {}, current = asset, profile = manager, uid = "user") =>
  JSON.parse(JSON.stringify(buildAssetEditUpdate({ ...asset, ...input }, asset, current, profile, "a", uid, "server-time")));

test("canonical management permissions include admin; reject inactive, numeric-only, transport-only and foreign tenant", () => {
  assert.equal(canEditAsset(manager, "a", asset), true);
  assert.equal(canEditAsset({ ...manager, roleCode: "PLATFORM_ADMIN", accessLevel: 99 }, "a", asset), true);
  assert.equal(canEditAsset({ ...manager, roleCode: "SITE_MANAGER", accessLevel: 2, permissions: { canManagePlant: true } }, "a", asset), true);
  for (const patch of [{ status: "INACTIVE" }, { accessLevel: 99 }, { accessLevel: "5.5" }, { organisationId: "b" }, { permissions: null }, { roleCode: "SITE_MANAGER", accessLevel: 2, permissions: { canManageTransport: true } }])
    assert.equal(canEditAsset({ ...manager, ...patch }, "a", asset), false);
});
test("controlled update excludes immutable, hire and operational fields and adds audit", () => {
  assert.deepEqual(build({ manufacturer: " Volvo ", plantId: "BAD", id: "BAD", organisationId: "b", ownershipType: "OWNED", safeToUse: true, currentHireRecordId: null }),
    { manufacturer: "Volvo", updatedByUid: "user", updatedByName: "Alex", updatedAt: "server-time" });
});
test("optional blanks normalise to null; attachments trim, deduplicate and remain strings", () => {
  assert.deepEqual(build({ attachments: " Bucket \n\nHammer\nBucket ", year: "2020" }).attachments, ["Bucket", "Hammer"]);
  assert.equal(build({ year: "2020" }).year, 2020);
  const result = buildAssetEditUpdate({ ...asset, serialNumber: " " }, { ...asset, serialNumber: "old" }, { ...asset, serialNumber: "old" }, manager, "a", "user", "time");
  assert.equal(result.serialNumber, null);
  assert.deepEqual(build({ manufacturer: " Hitachi " }), {});
});
test("required, catalogue, length, year and attachment validation", () => {
  for (const input of [{ manufacturer: "" }, { model: "" }, { plantType: "FAKE" }, { notes: "x".repeat(4001) }, { year: "1899" }, { year: "2020.5" }, { year: "9999" }, { attachments: ["x".repeat(161)] }, { attachments: Array.from({ length: 51 }, (_, i) => String(i)) }])
    assert.throws(() => build(input));
});
test("fresh identity, tenant, authentication and permission checks fail closed", () => {
  for (const patch of [{ id: "other" }, { plantId: "other" }, { plantReference: "other" }, { organisationId: "b" }]) assert.throws(() => build({ model: "new" }, { ...asset, ...patch }));
  assert.throws(() => build({ model: "new" }, asset, { ...manager, status: "INACTIVE" }));
  assert.throws(() => build({ model: "new" }, asset, manager, null));
});
test("concurrent same-field changes rejected; unrelated changes preserved by minimal patch", () => {
  assert.throws(() => build({ model: "new" }, { ...asset, model: "someone else's model" }), /another user/);
  const update = build({ model: "new" }, { ...asset, manufacturer: "Latest", currentProjectId: "project" });
  assert.equal(update.model, "new");
  assert.equal(Object.hasOwn(update, "manufacturer"), false);
  assert.equal(Object.hasOwn(update, "currentProjectId"), false);
});

test("deployment resolves one current assignment and does not revive released history", () => {
  const current = getCurrentAssignment([
    { id: "old", status: "RELEASED", assignedFrom: "2026-01-01", assignedUntil: "2026-02-01" },
    { id: "current", status: "ACTIVE", assignedFrom: "2026-09-20" }
  ]);
  assert.equal(current.id, "current");
});

test("location confirmation keeps prior history and only updates position/audit fields", () => {
  const update = deploymentLocationUpdate({ ...asset, locationHistory: [{ locationLabel: "Depot", confirmedAt: "2026-09-01" }], currentProjectId: "project-a" }, "Site A", "user", manager, "2026-09-20", "server-time");
  assert.equal(update.currentLocationLabel, "Site A");
  assert.equal(update.locationHistory.length, 2);
  assert.equal(update.locationHistory[1].confirmedByUid, "user");
  assert.equal(Object.hasOwn(update, "currentProjectId"), false);
});
