// Run: node --test .tests/plant/overview.test.mjs
// Where child processes are restricted, add --experimental-test-isolation=none.
// Local fixtures only; no Firebase connection, writes, or production credentials.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { PLANT_NAV_ITEMS, getActivePlantPageFromPath } from "../../modules/contractor/plant/shared/plant-shell.js";
import * as hire from "../../modules/contractor/plant/shared/plant-hire.js";
import * as model from "../../modules/contractor/plant/overview/overview-model.js";
import * as utils from "../../modules/contractor/plant/shared/plant-utils.js";
import { getPlantTypeLabel } from "../../modules/contractor/plant/shared/plant-catalogue.js";

const today = new Date("2026-09-19T12:00:00Z");
const manager = { uid: "manager", organisationId: "tenant-a", status: "ACTIVE", roleCode: "PLANT_TRANSPORT_MANAGER", accessLevel: 5.5, permissions: {} };
const site = { ...manager, roleCode: "SITE_MANAGER", accessLevel: 2 };
const asset = { id: "tenant-a__HRE-0001", plantId: "HRE-0001", plantReference: "HRE-0001", organisationId: "tenant-a", ownershipType: "HIRED", status: "AVAILABLE", currentLocationLabel: "Depot", currentLocationConfirmedAt: "2026-09-18" };
const record = { id: "hire-1", organisationId: "tenant-a", plantId: "HRE-0001", status: "ACTIVE", hireStartDate: "2026-09-01", hireRate: 100, hireRateUnit: "DAY", expectedOffHireDate: "2026-09-25" };
function sources(overrides = {}) {
  const data = { plantAssets: [asset], plantHireRecords: [record], ...overrides };
  return Object.fromEntries(Object.keys(model.SOURCE_NAMES).map(name => [name, model.loadedSource("tenant-a", data[name] || [], 500, today)]));
}
const build = (data = {}, profile = manager) => model.buildOverview(sources(data), profile, today);
const position = (result, label) => result.position.find(item => item.label === label).value;

test("one hired asset: inclusive exposure, weekly commitment and idle attention", () => {
  const result = build();
  assert.equal(result.finance.exposure, 1900);
  assert.equal(result.finance.weekly, 700);
  assert.equal(result.finance.idle, 1);
  assert.equal(position(result, "Total fleet"), 1);
  assert.ok(result.attention.some(item => item.title.includes("without productive assignment")));
});
test("owned asset has no hire commitment; compliance remains not assessed", () => {
  const result = build({ plantAssets: [{ ...asset, ownershipType: "OWNED" }], plantHireRecords: [] });
  assert.equal(position(result, "Owned"), 1);
  assert.equal(result.finance.active, 0);
  assert.equal(result.operations.find(item => item.name === "compliance").state, "NOT_ASSESSED");
});
test("off-road blocker is dominant and asset is never available", () => {
  const result = build({ plantAssets: [{ ...asset, offRoad: true }] });
  assert.equal(position(result, "Off road / hold"), 1);
  assert.equal(position(result, "Available"), 0);
  assert.equal(result.attention[0].priority, 0);
});
test("empty successful dataset is empty, not safety assurance", () => {
  const result = build({ plantAssets: [], plantHireRecords: [] });
  assert.equal(position(result, "Total fleet"), 0);
  assert.equal(result.assessment, "NOT_ASSESSED");
  assert.equal(result.operations.find(item => item.name === "plantMaintenance").note, "Maintenance not assessed");
});
for (const rate of [undefined, null, "", " ", -1, "invalid", NaN, Infinity, true, [], {}]) {
  test(`invalid rate (${String(rate)}) never becomes zero`, () => {
    assert.equal(hire.calculateHire({ ...record, hireRate: rate }, today).state, "UNKNOWN");
    const result = build({ plantHireRecords: [{ ...record, hireRate: rate }] });
    assert.equal(result.finance.weekly, null);
    assert.equal(result.finance.exposure, null);
  });
}
test("an explicitly recorded zero rate is valid", () => {
  assert.equal(hire.calculateHire({ ...record, hireRate: 0 }, today).estimatedCost, 0);
});
test("missing and unsupported rate units remain unknown", () => {
  for (const unit of [undefined, "", "HOUR"]) assert.equal(hire.calculateHire({ ...record, hireRateUnit: unit }, today).state, "UNKNOWN");
});
test("expected off-hire, past or future, never caps accrued exposure", () => {
  for (const date of ["2026-09-02", "2027-01-01"]) assert.equal(hire.calculateHire({ ...record, expectedOffHireDate: date, hireEndDate: date }, today).estimatedCost, 1900);
  assert.ok(build({ plantHireRecords: [{ ...record, expectedOffHireDate: "2026-09-02" }] }).attention.some(item => item.title === "Past expected off-hire"));
});
test("confirmed off-hire caps exposure inclusively", () => {
  assert.equal(hire.calculateHire({ ...record, offHireConfirmedDate: "2026-09-03" }, today).estimatedCost, 300);
  assert.equal(build({ plantHireRecords: [{ ...record, offHireConfirmedDate: "2026-09-03" }] }).finance.active, 0);
});
test("invalid dates are unknown; no rounding an impossible date into next month", () => {
  for (const value of ["2026-02-30", "not a date", ""]) assert.equal(hire.calculateHire({ ...record, offHireConfirmedDate: value }, today).state, "UNKNOWN");
  assert.equal(hire.calculateHire({ ...record, hireStartDate: "2027-01-01" }, today).state, "UNKNOWN");
});
test("inclusive calendar days across UK daylight-saving and midnight boundaries", () => {
  assert.equal(hire.calculateHire({ ...record, hireStartDate: "2026-03-28", offHireConfirmedDate: "2026-03-30" }, today).days, 3);
  assert.equal(hire.calculateHire({ ...record, hireStartDate: "2026-10-24", offHireConfirmedDate: "2026-10-26" }, today).days, 3);
  assert.equal(hire.calculateHire({ ...record, hireStartDate: "2026-09-18T23:30:00Z" }, today).days, 1);
});
test("Firestore-style timestamp and existing rate conversions", () => {
  assert.equal(hire.calculateHire({ ...record, hireStartDate: { toDate: () => new Date("2026-09-01T12:00:00Z") } }, today).days, 19);
  assert.equal(hire.weeklyHireRate(100, "MONTH"), 100 * 12 / 52);
  assert.equal(hire.calculateHire({ ...record, hireRateUnit: "MONTH" }, today).estimatedCost, 19 / 30.4375 * 100);
});
test("all hire ownership categories share behaviour", () => {
  for (const ownershipType of ["HIRED", "LEASED", "CROSS_HIRED"]) {
    assert.ok(hire.isHireOwnership(ownershipType));
    assert.equal(build({ plantAssets: [{ ...asset, ownershipType }] }).finance.active, 1);
  }
});
test("multiple active records require review; valid explicit pointer is honoured", () => {
  const records = [record, { ...record, id: "hire-2" }];
  assert.equal(hire.selectHire(asset, records).state, "AMBIGUOUS");
  assert.equal(hire.selectHire({ ...asset, currentHireRecordId: "hire-2" }, records).record.id, "hire-2");
  const result = build({ plantHireRecords: records });
  assert.equal(result.finance.weekly, null);
  assert.ok(result.attention.some(item => item.title === "Ambiguous hire records"));
});
test("hire pointer cannot cross tenants or assets; missing pointer stays unknown", () => {
  assert.equal(hire.selectHire({ ...asset, currentHireRecordId: "hire-1" }, [{ ...record, organisationId: "tenant-b" }]).state, "UNKNOWN");
  assert.equal(hire.selectHire({ ...asset, currentHireRecordId: "hire-1" }, [{ ...record, plantId: "OTHER" }]).state, "UNKNOWN");
  assert.equal(hire.selectHire({ ...asset, currentHireRecordId: "missing" }, [record]).state, "UNKNOWN");
  assert.equal(hire.selectHire({ ...asset, currentHireRecordId: "old" }, [record, { ...record, id: "old", offHireConfirmedDate: "2026-09-10" }]).state, "UNKNOWN");
});
test("legacy random keys and explicit tenant asset keys remain readable", () => {
  assert.ok(hire.belongsToAsset(record, { ...asset, id: "random-document-id" }));
  assert.ok(hire.belongsToAsset({ ...record, plantId: null, assetKey: asset.id }, asset));
  assert.ok(hire.belongsToAsset({ ...record, plantId: null, assetId: asset.id }, asset));
  assert.equal(hire.belongsToAsset({ ...record, assetKey: "different" }, asset), false);
});
test("restricted Site Manager and H&S profiles have no costs", () => {
  for (const profile of [site, { ...site, roleCode: "HEALTH_SAFETY", accessLevel: 4.5 }, { ...site, permissions: { canManageTransport: true, canManagePlant: true, canManageOrganisation: true } }]) {
    const result = build({}, profile);
    assert.equal(result.access.costs, false);
    assert.equal(result.finance, null);
    assert.deepEqual(result.hires, []);
    assert.equal(result.sources.plantHireRecords.data.length, 0);
  }
});
test("canonical managers/admin and explicit Commercial permission receive costs", () => {
  for (const profile of [manager, { ...manager, roleCode: "ORGANISATION_MANAGER", accessLevel: 6 }, { ...manager, roleCode: "PLATFORM_ADMIN", accessLevel: 99 }, { ...site, permissions: { canViewCommercial: true } }]) assert.equal(model.overviewAccess(profile).costs, true);
});
test("inactive and invalid role-band profiles are denied", () => {
  for (const profile of [{ ...manager, status: "INACTIVE" }, { ...site, accessLevel: 99 }, { ...manager, roleCode: "" }]) assert.deepEqual(model.overviewAccess(profile), { view: false, costs: false });
});
for (const [code, state] of [["permission-denied", "PERMISSION_DENIED"], ["unavailable", "UNAVAILABLE"], ["deadline-exceeded", "UNAVAILABLE"], ["unexpected", "ERROR"]]) {
  test(`${code}: failures never become zero defects`, () => {
    const data = sources();
    data.plantDefects = model.failedSource("tenant-a", { code });
    const result = model.buildOverview(data, manager, today);
    assert.equal(result.operations.find(item => item.name === "plantDefects").count, null);
    assert.equal(result.sources.plantDefects.state, state);
    assert.ok(result.attention.some(item => item.title.includes("Defects information")));
  });
}
test("bounded query exactly at limit is incomplete, with no fleet or cost total", () => {
  const data = sources();
  data.plantAssets = model.loadedSource("tenant-a", [asset], 1, today);
  const result = model.buildOverview(data, manager, today);
  assert.equal(model.sourceLabel(data.plantAssets), "PARTIAL / INCOMPLETE");
  assert.ok(result.position.every(item => item.value === null));
  assert.equal(result.finance.weekly, null);
});
test("partial defects preserve known defects but withhold total", () => {
  const data = sources();
  data.plantDefects = model.loadedSource("tenant-a", [{ ...record, id: "def-1", status: "REPORTED" }], 1, today);
  const result = model.buildOverview(data, manager, today);
  assert.equal(result.operations.find(item => item.name === "plantDefects").count, null);
  assert.ok(result.attention.some(item => item.title === "Open defect"));
});
test("partial hire lookup without pointer cannot imply a unique current record", () => {
  assert.equal(hire.selectHire(asset, [record], { complete: false }).state, "UNKNOWN");
  const data = sources(); data.plantHireRecords = model.loadedSource("tenant-a", [record], 1, today);
  assert.equal(model.buildOverview(data, manager, today).finance.exposure, null);
});
test("known blocker survives unavailable secondary source", () => {
  const data = sources({ plantAssets: [{ ...asset, safeToUse: false }] });
  data.plantMaintenance = model.failedSource("tenant-a", { code: "unavailable" });
  const result = model.buildOverview(data, manager, today);
  assert.equal(result.attention[0].title, "Plant unavailable / off road");
  assert.equal(result.assessment, "NOT_ASSESSED");
});
test("tenant change rejects retained results; scope mismatch cannot become empty success", () => {
  const result = model.buildOverview(sources(), { ...manager, organisationId: "tenant-b" }, today);
  assert.equal(position(result, "Total fleet"), null);
  assert.equal(model.loadedSource("tenant-a", [{ ...asset, organisationId: "tenant-b" }]).state, "ERROR");
});
test("missing status cannot default to AVAILABLE", () => {
  const result = build({ plantAssets: [{ ...asset, status: undefined }] });
  assert.equal(position(result, "Available"), null);
  assert.ok(result.attention.some(item => item.title === "Operational state unknown"));
});
test("assigned project cache without canonical assignment does not imply idle", () => {
  const result = build({ plantAssets: [{ ...asset, currentProjectId: "project-1" }] });
  assert.equal(result.finance.idle, null);
  assert.equal(position(result, "Currently assigned"), null);
});
test("canonical active assignment is counted without inventing productivity", () => {
  const result = build({ plantAssignments: [{ ...record, id: "asn-1", projectId: "project-1", assignedFrom: "2026-09-01" }] });
  assert.equal(position(result, "Currently assigned"), 1);
  assert.equal(result.finance.idle, 0);
});
test("upcoming uses recorded dates, overdue work becomes attention", () => {
  const result = build({ plantMaintenance: [{ ...record, id: "mnt-1", status: "PLANNED", dueDate: "2026-09-18" }], plantMovements: [{ ...record, id: "mov-1", status: "BOOKED", plannedDate: "2026-09-20" }] });
  assert.ok(result.attention.some(item => item.title === "Overdue maintenance"));
  assert.ok(result.upcoming.some(item => item.title === "Movement"));
  const missing = build({ plantHireRecords: [{ ...record, expectedOffHireDate: undefined }] });
  assert.equal(missing.upcoming.length, 0);
});
test("closed hire without confirmation cannot falsely show zero commitment", () => {
  assert.equal(build({ plantHireRecords: [{ ...record, status: "CLOSED" }] }).finance.weekly, null);
});
test("orphan active hire prevents a zero total", () => {
  const result = build({ plantAssets: [] });
  assert.equal(result.finance.weekly, null);
  assert.ok(result.attention.some(item => item.title.includes("without a current fleet asset")));
});
test("all eight loading/assessment states remain distinct", () => {
  for (const state of model.STATES) assert.equal(model.sourceResult("tenant-a", state).state, state);
  assert.equal(model.STATES.length, 8);
});

// Execute the real page controller and render functions with a minimal DOM and
// Firestore transport double. This checks actual query suppression and HTML output.
async function pageHarness(profile, { failures = {}, dataset = {}, deferred = {}, waitForLoad = true } = {}) {
  const source = await readFile(new URL("../../modules/contractor/plant/overview/overview.js", import.meta.url), "utf8");
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { innerHTML: "", textContent: "", disabled: false, setAttribute() {}, addEventListener() {} }); return elements.get(id); };
  const queries = [];
  const events = {};
  const context = {
    ...model, ...hire, ...utils, escape: utils.escapePlantHtml, getPlantTypeLabel,
    db: {}, auth: {}, console, Date, Intl, setTimeout, clearTimeout, encodeURIComponent,
    document: { getElementById: element, querySelectorAll: () => [] },
    window: { addEventListener: (name, fn) => { events[name] = fn; } },
    initialisePlantShell() {}, onAuthStateChanged() {},
    collection: (_, name) => name, where: (...args) => args, limit: value => value,
    query: (name, scope, cap) => ({ name, scope, cap }),
    getDocsFromServer: async request => {
      queries.push(request);
      if (deferred[request.name]) await deferred[request.name];
      if (failures[request.name]) throw { code: failures[request.name] };
      const rows = dataset[request.name] || [];
      return { docs: rows.slice(0, request.cap).map(row => ({ id: row.id, data: () => row })) };
    }
  };
  vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, "") + "\nglobalThis.page = { initialise, load };", context);
  const pending = context.page.initialise(profile);
  if (waitForLoad) await pending;
  return { html: () => element("plantOverviewContent").innerHTML, queries, elements, context, pending };
}
test("restricted page never queries hire records or renders operational cost fields", async () => {
  const page = await pageHarness(site, { dataset: { plantAssets: [{ ...asset, hireRate: 987654, supplierCost: 987654 }], plantIssues: [{ ...record, id: "issue-1", title: "Repair costs £987654", repairCost: 987654 }] } });
  assert.equal(page.queries.some(query => query.name === "plantHireRecords"), false);
  assert.match(page.html(), /Restricted/);
  assert.doesNotMatch(page.html(), /987654/);
  assert.ok(page.queries.every(query => query.scope[0] === "organisationId" && query.scope[2] === "tenant-a" && query.cap === 500));
});
test("authorised page queries hires and renders all seven approved sections", async () => {
  const page = await pageHarness(manager, { dataset: { plantAssets: [asset], plantHireRecords: [record] } });
  assert.ok(page.queries.some(query => query.name === "plantHireRecords"));
  for (const title of ["Plant Position", "Attention Required", "Hire / Financial Position", "Priority Assets", "Plant Controls", "Upcoming"]) assert.ok(page.html().includes(title));
  const html = await readFile(new URL("../../modules/contractor/plant/overview/index.html", import.meta.url), "utf8");
  assert.ok(html.includes("Plant Control"));
});
test("inactive page makes no reads", async () => {
  const page = await pageHarness({ ...manager, status: "INACTIVE" });
  assert.equal(page.queries.length, 0);
  assert.match(page.html(), /PERMISSION_DENIED/);
});
test("rendered denied/failed sources and blockers never become healthy", async () => {
  const page = await pageHarness(manager, { dataset: { plantAssets: [{ ...asset, offRoad: true }] }, failures: { plantDefects: "permission-denied", plantMaintenance: "unavailable" } });
  assert.match(page.html(), /PERMISSION_DENIED/);
  assert.match(page.html(), /UNAVAILABLE/);
  assert.match(page.html(), /Plant unavailable \/ off road/);
  assert.doesNotMatch(page.html(), /0 defects|0 issues|All clear|safe to use|£0\.00/i);
});
test("rendered source text is HTML escaped", async () => {
  const page = await pageHarness(manager, { dataset: { plantAssets: [{ ...asset, plantReference: '<img src=x onerror="alert(1)">', offRoad: true }] } });
  assert.doesNotMatch(page.html(), /<img/);
  assert.match(page.html(), /&lt;img/);
});

test("late requests cannot repopulate content after profile changes", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const page = await pageHarness(manager, { dataset: { plantAssets: [{ ...asset, plantReference: "OLD-TENANT-ASSET", offRoad: true }] }, deferred: { plantAssets: pending }, waitForLoad: false });
  await page.context.page.initialise({ ...manager, status: "INACTIVE" });
  release();
  await page.pending;
  assert.match(page.html(), /PERMISSION_DENIED/);
  assert.doesNotMatch(page.html(), /OLD-TENANT-ASSET/);
  assert.equal(page.elements.get("refreshPlant").disabled, false);
});
test("real controller at query limit labels partial and withholds totals", async () => {
  const rows = Array.from({ length: 500 }, (_, index) => ({ ...asset, id: `asset-${index}`, ownershipType: "OWNED", offRoad: index === 0 }));
  const page = await pageHarness(site, { dataset: { plantAssets: rows } });
  assert.match(page.html(), /PARTIAL \/ INCOMPLETE/);
  assert.match(page.html(), /Partial/);
  assert.match(page.html(), /Plant unavailable \/ off road/);
  assert.doesNotMatch(page.html(), /<strong[^>]*>500<\/strong>/);
});

async function legacyPage(file, state) {
  const source = await readFile(new URL(`../../modules/contractor/plant/${file}`, import.meta.url), "utf8");
  const elements = new Map();
  const context = {
    ...hire, sharedHireOwnership: hire.isHireOwnership, sharedWeeklyRate: hire.weeklyHireRate,
    console, Intl, Date: class extends Date { constructor(...args) { super(...(args.length ? args : [today])); } },
    document: { getElementById: id => { if (!elements.has(id)) elements.set(id, { innerHTML: "" }); return elements.get(id); } },
    fixtures: state
  };
  const setup = file.startsWith("fleet")
    ? "plantAssets = fixtures.assets; hireRecords = fixtures.hires; hireReadComplete = true; assetReadComplete = true; canViewPlantCosts = true; rebuildHireLookup(); globalThis.api = { getHireRecordForAsset, weeklyEquivalent, estimatedHireExposure, formatHireRate, renderFinancialMetrics };"
    : "asset = fixtures.assets[0]; hireRecords = fixtures.hires; hireReadComplete = true; canViewPlantCosts = true; selectCurrentHireRecord(); globalThis.api = { calculateHireDays, calculateHireExposure, weeklyHireRate, formatHireRate, renderOverviewFinancialPanel };";
  vm.runInNewContext(source.replace(/^import [\s\S]*?;\r?\n/gm, "").replace(/^waitForWorkspace\(\);/gm, "") + "\n" + setup, context);
  return { api: context.api, elements };
}
test("Fleet, Asset and Overview calculate identical current hire exposure", async () => {
  const state = { assets: [asset], hires: [record] };
  const fleet = await legacyPage("fleet/fleet.js", state);
  const detail = await legacyPage("asset/asset.js", state);
  // Fleet helper uses the fixed Date supplied to its context for its caller; the
  // shared helper itself takes current date, so use confirmed dates for parity.
  const confirmed = { ...record, offHireConfirmedDate: "2026-09-19" };
  const fixed = await legacyPage("asset/asset.js", { ...state, hires: [confirmed] });
  assert.equal(fleet.api.estimatedHireExposure(confirmed), 1900);
  assert.equal(fixed.api.calculateHireExposure(), 1900);
  assert.equal(fixed.api.calculateHireDays(), 19);
  assert.equal(detail.api.weeklyHireRate(), build().finance.weekly);
});
test("Fleet and Asset expose ambiguous hire selection instead of silently choosing", async () => {
  const state = { assets: [asset], hires: [record, { ...record, id: "hire-2" }] };
  const fleet = await legacyPage("fleet/fleet.js", state);
  fleet.api.renderFinancialMetrics();
  assert.match(fleet.elements.get("financialMetrics").innerHTML, /Multiple active hire records/);
  assert.equal(fleet.api.getHireRecordForAsset(asset), null);
  const detail = await legacyPage("asset/asset.js", state);
  assert.match(detail.api.renderOverviewFinancialPanel(), /Multiple active hire records/);
});
test("Fleet and Asset missing rate display stays unknown", async () => {
  const missing = { ...record, hireRate: null };
  const state = { assets: [asset], hires: [missing] };
  const fleet = await legacyPage("fleet/fleet.js", state);
  fleet.api.renderFinancialMetrics();
  assert.doesNotMatch(fleet.elements.get("financialMetrics").innerHTML, /£0/);
  assert.equal(fleet.api.formatHireRate(missing), "Unknown");
  const detail = await legacyPage("asset/asset.js", state);
  assert.equal(detail.api.formatHireRate(), "Unknown");
  assert.equal(detail.api.calculateHireExposure(), null);
});

test("canonical admin has an explicit override without tenant context; no reads until scoped", async () => {
  const admin = { status: "ACTIVE", accessLevel: 99, roleCode: "PLATFORM_ADMIN" };
  assert.deepEqual(model.overviewAccess(admin), { view: true, costs: true });
  assert.equal(model.overviewContext(admin).state, "MISSING_ORGANISATION_CONTEXT");
  const page = await pageHarness(admin);
  assert.equal(page.queries.length, 0);
  assert.match(page.html(), /MISSING_ORGANISATION_CONTEXT/);
  assert.doesNotMatch(page.html(), /PERMISSION_DENIED/);
});
test("admin does not inherit authority from legacy role or string level", async () => {
  for (const profile of [{ ...manager, accessLevel: 99, roleCode: undefined, role: "PLATFORM_ADMIN" }, { ...manager, accessLevel: "99", roleCode: "PLATFORM_ADMIN" }]) {
    const page = await pageHarness(profile);
    assert.equal(page.queries.length, 0);
    assert.match(page.html(), /PERMISSION_DENIED/);
    assert.match(page.html(), /Canonical/);
  }
});
test("single asset card survives a denied secondary source for a restricted reader", async () => {
  const page = await pageHarness(site, { dataset: { plantAssets: [{ ...asset, manufacturer: "Hitachi", model: "ZX490", plantType: "HIGH_REACH_EXCAVATOR" }] }, failures: { plantMaintenance: "permission-denied" } });
  assert.match(page.html(), /plant-asset-grid--single/);
  assert.match(page.html(), /HRE-0001/);
  assert.match(page.html(), /Hitachi ZX490/);
  assert.match(page.html(), /Depot/);
  assert.match(page.html(), /Maintenance information unavailable/);
  assert.equal(page.elements.get("plantLoadStatus").textContent.startsWith("DATA_UNAVAILABLE"), true);
  assert.equal(page.elements.get("addPlantLink").hidden, true);
});
test("financial panel normalises daily and idle weekly exposure from shared hire values", () => {
  const result = build();
  assert.equal(result.finance.daily, result.finance.weekly / 7);
  assert.equal(result.finance.idleWeekly, 700);
  assert.equal(result.finance.offHireAction, 1);
  assert.ok(result.attention.every(item => item.why && item.currentPosition && item.nextAction));
});
test("root redirect, shared navigation and relocated links resolve", async () => {
  const root = await readFile(new URL("../../modules/contractor/plant/index.html", import.meta.url), "utf8");
  assert.match(root, /http-equiv="refresh"/);
  assert.match(root, /url=\/modules\/contractor\/plant\/overview\/index.html/);
  assert.doesNotMatch(root, /plantOverviewContent|plant\.js/);
  assert.equal(PLANT_NAV_ITEMS[0].href, "/modules/contractor/plant/overview/index.html");
  for (const path of ["/modules/contractor/plant/", "/modules/contractor/plant/overview/", "/modules/contractor/plant/overview/index.html"]) assert.equal(getActivePlantPageFromPath(path), "overview");
  assert.equal(getActivePlantPageFromPath("/modules/contractor/plant/fleet/index.html"), "fleet");
  assert.deepEqual(PLANT_NAV_ITEMS.map(item => item.label), ["Overview", "Requests", "Fleet", "Availability", "Movements", "Defects", "Maintenance", "Compliance", "Suppliers"]);
  const page = await pageHarness(manager, { dataset: { plantAssets: [asset], plantHireRecords: [record] } });
  assert.match(page.html(), /\.\.\/asset\/index.html\?id=/);
  assert.equal(page.elements.get("addPlantLink").hidden, false);
});
test("Fleet action=add opens existing workflow only after management permission", async () => {
  const file = await readFile(new URL("../../modules/contractor/plant/fleet/fleet.js", import.meta.url), "utf8");
  const fn = file.match(/function openRequestedPlantAction\([\s\S]*?\n\}/)[0];
  for (const [allowed, search, expected] of [[true, "?action=add", 1], [false, "?action=add", 0], [true, "", 0]]) {
    let opened = 0;
    vm.runInNewContext(fn + "\nopenRequestedPlantAction();", { canManagePlant: allowed, URLSearchParams, window: { location: { search } }, openAddPlantModal: () => opened++ });
    assert.equal(opened, expected);
  }
  const init = file.match(/async function initialiseFleet\([\s\S]*?\n\}/)[0];
  assert.ok(init.indexOf("resolveAccess();") < init.indexOf("openRequestedPlantAction();"));
});
