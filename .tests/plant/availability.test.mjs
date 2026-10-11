import assert from "node:assert/strict";
import test from "node:test";
import { buildAvailabilityModel } from "../../modules/contractor/plant/availability/availability-model.js";

const org = "org-1";
const asset = (extra = {}) => ({ id: "asset-1", organisationId: org, active: true, assetClass: "PLANT_MACHINERY", ownershipType: "OWNED", plantReference: "PLT-0001", ...extra });
const complete = (data = []) => ({ state: data.length ? "LOADED_WITH_DATA" : "LOADED_EMPTY", data, complete: true });
const sources = (extra = {}) => ({
  plantAssets: complete([asset()]), plantAssignments: complete(), plantMaintenance: complete(),
  plantDefects: complete(), plantMovements: complete(), plantHireRecords: complete(), ...extra
});

test("derives available now only when every readiness dependency is assessed", () => {
  const model = buildAvailabilityModel(sources(), { now: "2026-09-27", horizonDays: 30 });
  assert.equal(model.assets[0].position, "AVAILABLE_NOW");
  assert.equal(model.summary.AVAILABLE_NOW, 1);
});

test("blocked precedence wins over maintenance and allocation", () => {
  const model = buildAvailabilityModel(sources({
    plantAssets: complete([asset({ complianceHold: true })]),
    plantAssignments: complete([{ id: "a", organisationId: org, assetId: "asset-1", projectId: "p1", projectName: "Project", status: "ACTIVE", assignedFrom: "2026-09-01" }]),
    plantMaintenance: complete([{ id: "m", organisationId: org, assetId: "asset-1", status: "IN_PROGRESS", plannedDate: "2026-09-20" }])
  }), { now: "2026-09-27" });
  assert.equal(model.assets[0].position, "BLOCKED");
});

test("horizon recalculates availability-soon and outlook", () => {
  const assignment = { id: "a", organisationId: org, assetId: "asset-1", projectId: "p1", status: "ACTIVE", assignedFrom: "2026-09-01", assignedUntil: "2026-10-07" };
  const seven = buildAvailabilityModel(sources({ plantAssignments: complete([assignment]) }), { now: "2026-09-27", horizonDays: 7 });
  const fourteen = buildAvailabilityModel(sources({ plantAssignments: complete([assignment]) }), { now: "2026-09-27", horizonDays: 14 });
  assert.equal(seven.summary.AVAILABLE_SOON, 0);
  assert.equal(fourteen.summary.AVAILABLE_SOON, 1);
  assert.equal(fourteen.outlook[0].type, "RELEASE");
});

test("dependency failure does not become empty or available", () => {
  const model = buildAvailabilityModel(sources({ plantDefects: { state: "PERMISSION_DENIED", data: [], complete: false } }), { now: "2026-09-27" });
  assert.equal(model.assessment, "NOT_ASSESSED");
  assert.equal(model.assets[0].position, null);
  assert.equal(model.summary.AVAILABLE_NOW, null);
});

test("off-hire is derived only from an active linked hire within the horizon", () => {
  const hired = asset({ ownershipType: "HIRED", currentHireRecordId: "h1" });
  const model = buildAvailabilityModel(sources({
    plantAssets: complete([hired]),
    plantHireRecords: complete([{ id: "h1", organisationId: org, assetId: "asset-1", status: "ACTIVE", expectedOffHireDate: "2026-10-03" }])
  }), { now: "2026-09-27", horizonDays: 7 });
  assert.equal(model.assets[0].position, "OFF_HIRE");
  assert.equal(model.summary.OFF_HIRE, 1);
});

test("an active movement prevents an asset being presented as ready", () => {
  const model = buildAvailabilityModel(sources({
    plantMovements: complete([{ id: "move-1", organisationId: org, assetId: "asset-1", status: "IN_TRANSIT", plannedDate: "2026-09-27", toProjectName: "Project B" }])
  }), { now: "2026-09-27" });
  assert.equal(model.assets[0].position, "ALLOCATED");
  assert.equal(model.summary.AVAILABLE_NOW, 0);
});
