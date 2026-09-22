import { calendarDay, calculateHire, isHireOwnership, selectHire, belongsToAsset } from "../shared/plant-hire.js";

export const STATES = Object.freeze(["LOADING", "LOADED_WITH_DATA", "LOADED_EMPTY", "NOT_APPLICABLE", "NOT_ASSESSED", "PERMISSION_DENIED", "UNAVAILABLE", "ERROR"]);
export const SOURCE_NAMES = Object.freeze({ plantAssets: "Fleet", plantAssignments: "Assignments", plantHireRecords: "Hire", plantIssues: "Issues", plantDefects: "Defects", plantMaintenance: "Maintenance", plantMovements: "Movements" });
export const QUERY_LIMIT = 500;
const code = value => String(value ?? "").trim().toUpperCase();
const bands = { WORKER: 0, SUPERVISOR: 1, SITE_MANAGER: 2, PROJECT_MANAGER: 3, SENIOR_PROJECT_MANAGER: 4, HEALTH_SAFETY: 4.5, SENIOR_HEALTH_SAFETY: 4.6, CONTRACTS_MANAGER: 5, PLANT_TRANSPORT_MANAGER: 5.5, ORGANISATION_MANAGER: 6, PLATFORM_ADMIN: 99 };

// This read/UI gate does not fix backend field confidentiality in operational
// documents. Existing rules and other pages require a separate security task.
export function overviewAccess(profile) {
  const valid = profile?.status === "ACTIVE" && Object.hasOwn(bands, profile.roleCode) && bands[profile.roleCode] === profile.accessLevel;
  if (!valid) return { view: false, costs: false };
  const p = profile.permissions || {};
  const manager = ["PLANT_TRANSPORT_MANAGER", "ORGANISATION_MANAGER", "PLATFORM_ADMIN"].includes(profile.roleCode);
  const view = manager || p.canViewPlant === true || p.canRequestPlant === true || p.canManagePlant === true || p.canManageTransport === true || profile.accessLevel >= 1;
  return { view, costs: Boolean(view && (manager || p.canViewCommercial === true || p.canManageCommercial === true)) };
}

// Capability is independent of tenant selection. Never query without both.
export function overviewContext(profile) {
  if (!overviewAccess(profile).view) {
    const reason = profile?.status !== "ACTIVE" ? "An ACTIVE user profile is required." : !profile.roleCode ? "Canonical roleCode is missing from the user profile." : bands[profile.roleCode] !== profile.accessLevel ? "Canonical roleCode and numeric accessLevel do not match." : "Plant workspace capability is required.";
    return { state: "PERMISSION_DENIED", reason };
  }
  if (typeof profile.organisationId !== "string" || !profile.organisationId.trim()) return { state: "MISSING_ORGANISATION_CONTEXT", reason: "Plant capability is valid. An authorised organisation context is required before reading data." };
  return { state: "READY", reason: "" };
}

export function canAddPlant(profile) {
  if (overviewContext(profile).state !== "READY") return false;
  return ["PLATFORM_ADMIN", "ORGANISATION_MANAGER", "PLANT_TRANSPORT_MANAGER"].includes(profile.roleCode) || profile.permissions?.canManagePlant === true || profile.permissions?.canManageOrganisation === true || profile.permissions?.canManageTransport === true;
}

export function sourceResult(scope, state = "LOADING", data = [], options = {}) {
  return { scope, state, data, complete: false, freshness: "UNKNOWN", lastSuccess: null, reason: "", ...options };
}
export function loadedSource(scope, data, limit = QUERY_LIMIT, now = new Date()) {
  if (data.some(row => row.organisationId !== scope)) return sourceResult(scope, "ERROR", [], { reason: "Organisation mismatch" });
  return sourceResult(scope, data.length ? "LOADED_WITH_DATA" : "LOADED_EMPTY", data, { complete: data.length < limit, freshness: "CURRENT", lastSuccess: now.toISOString(), reason: data.length >= limit ? "Partial / incomplete — query limit reached" : "" });
}
export function failedSource(scope, error) {
  const code = String(error?.code || "").replace("firestore/", "");
  const state = code === "permission-denied" ? "PERMISSION_DENIED" : ["unavailable", "deadline-exceeded", "resource-exhausted"].includes(code) ? "UNAVAILABLE" : "ERROR";
  return sourceResult(scope, state, [], { reason: state === "PERMISSION_DENIED" ? "Access denied" : "Information unavailable — retry" });
}
export const isComplete = result => Boolean(result && ["LOADED_WITH_DATA", "LOADED_EMPTY"].includes(result.state) && result.complete && result.freshness === "CURRENT");
export function sourceLabel(result) {
  if (!result) return "UNAVAILABLE";
  if (["LOADED_WITH_DATA", "LOADED_EMPTY"].includes(result.state) && !result.complete) return "PARTIAL / INCOMPLETE";
  return result.state;
}

export function buildOverview(sources, profile, today = new Date()) {
  const access = overviewAccess(profile);
  const scope = profile?.organisationId;
  const model = { access, context: overviewContext(profile), assets: [], position: [], attention: [], hires: [], upcoming: [], operations: [], finance: null, sources: {}, assessment: "NOT_ASSESSED" };
  if (model.context.state !== "READY") return model;
  // Reject stale or foreign source results even if a caller accidentally retains them.
  for (const name of Object.keys(SOURCE_NAMES)) {
    model.sources[name] = name === "plantHireRecords" && !access.costs
      ? sourceResult(scope, "PERMISSION_DENIED", [], { reason: "Restricted" })
      : sources[name]?.scope === scope ? sources[name] : sourceResult(scope, "UNAVAILABLE");
  }
  const src = model.sources;
  const rows = name => ["LOADED_WITH_DATA", "LOADED_EMPTY"].includes(src[name].state) ? src[name].data.filter(row => row.organisationId === scope) : [];
  const complete = (...names) => names.every(name => isComplete(src[name]));
  const assets = rows("plantAssets");
  const active = assets.filter(asset => asset.active !== false && code(asset.status) !== "INACTIVE");
  const day = calendarDay(today);
  const ref = asset => asset.plantReference || asset.plantId || asset.id;
  const blocked = asset => asset.safeToUse === false || asset.offRoad === true || asset.complianceHold === true || ["OFF_ROAD", "COMPLIANCE_HOLD"].includes(code(asset.status));
  const add = (title, detail, asset = null, priority = 2, extra = {}) => model.attention.push({ title, detail, asset, priority, ...extra });
  const assignments = rows("plantAssignments");
  function assignmentState(asset) {
    if (!complete("plantAssignments")) return null;
    const related = assignments.filter(row => belongsToAsset(row, asset));
    let assigned = false;
    for (const row of related) {
      const status = code(row.status);
      if (["CLOSED", "COMPLETED", "CANCELLED", "RELEASED"].includes(status)) continue;
      const start = calendarDay(row.assignedFrom);
      const end = row.assignedUntil ? calendarDay(row.assignedUntil) : null;
      if (!["ACTIVE", "PLANNED", "CONFIRMED"].includes(status) || start === null || (row.assignedUntil && end === null) || !row.projectId) return null;
      if (start <= day && (end === null || end >= day)) assigned = true;
    }
    if (!assigned && (asset.currentProjectId || asset.currentProjectName)) return null;
    return assigned;
  }
  const assignmentsByAsset = new Map(active.map(asset => [asset.id, assignmentState(asset)]));
  const metric = (label, value, reliable, note = "") => ({ label, value: reliable ? value : null, note: reliable ? note : "Information incomplete or unknown" });
  const fleetComplete = complete("plantAssets");
  const ownershipKnown = active.every(asset => ["OWNED", "HIRED", "LEASED", "CROSS_HIRED", "OTHER"].includes(code(asset.ownershipType)));
  const knownStatuses = ["AVAILABLE", "DEPLOYED", "RESERVED", "AWAITING_TRANSPORT", "IN_TRANSIT", "OFF_ROAD", "MAINTENANCE", "COMPLIANCE_HOLD", "OFF_HIRE_PENDING"];
  const statusesKnown = active.every(asset => knownStatuses.includes(code(asset.status)));
  model.position = [
    metric("Total fleet", active.length, fleetComplete, "Active assets"),
    metric("Hired / leased", active.filter(isHireOwnership).length, fleetComplete && ownershipKnown),
    metric("Owned", active.filter(asset => code(asset.ownershipType) === "OWNED").length, fleetComplete && ownershipKnown),
    metric("Currently assigned", [...assignmentsByAsset.values()].filter(value => value === true).length, fleetComplete && complete("plantAssignments") && [...assignmentsByAsset.values()].every(value => value !== null)),
    metric("Available", active.filter(asset => code(asset.status) === "AVAILABLE" && !blocked(asset) && assignmentsByAsset.get(asset.id) === false).length, fleetComplete && statusesKnown && complete("plantAssignments") && [...assignmentsByAsset.values()].every(value => value !== null), "Recorded available; readiness not assessed"),
    metric("Off road / hold", active.filter(blocked).length, fleetComplete && statusesKnown, "Recorded restrictions")
  ];
  for (const [name, result] of Object.entries(src)) {
    if (name === "plantHireRecords" && !access.costs) continue;
    if (result.state !== "LOADING" && !isComplete(result)) add(`${SOURCE_NAMES[name]} information unavailable or incomplete`, `${sourceLabel(result)} · ${result.reason || "Conclusions withheld"}`, null, 3);
  }
  for (const asset of active) {
    if (blocked(asset)) add("Plant unavailable / off road", "Review the restriction and arrange authorised follow-up.", asset, 0);
    const confirmedDay = calendarDay(asset.currentLocationConfirmedAt);
    if (!asset.currentLocationLabel || confirmedDay === null || confirmedDay > day) add("Location not confirmed", "Confirm the recorded physical location.", asset);
    if (!knownStatuses.includes(code(asset.status))) add("Operational state unknown", "Review the asset record.", asset);
    if (!["OWNED", "HIRED", "LEASED", "CROSS_HIRED", "OTHER"].includes(code(asset.ownershipType))) add("Ownership information unknown", "Confirm the asset ownership before assessing hire commitment.", asset);
    if (assignmentsByAsset.get(asset.id) === null && complete("plantAssignments")) add("Assignment needs review", "Current assignment cannot be established from recorded data.", asset);
  }
  const operationSpecs = [
    ["plantIssues", ["CLOSED", "RESOLVED", "CANCELLED"], "Open Plant issue", "nextMilestoneDate"],
    ["plantDefects", ["CLOSED", "RETURNED_TO_SERVICE", "CANCELLED"], "Open defect", null],
    ["plantMaintenance", ["COMPLETED", "CANCELLED"], "Maintenance", "dueDate"],
    ["plantMovements", ["DELIVERED", "COMPLETED", "CANCELLED"], "Movement", "plannedDate"]
  ];
  for (const [name, closed, title, dateField] of operationSpecs) {
    const records = rows(name).filter(row => !closed.includes(code(row.status)));
    const maintenanceUnassessed = name === "plantMaintenance" && complete(name) && !rows(name).length;
    model.operations.push({ name, label: SOURCE_NAMES[name], state: maintenanceUnassessed ? "NOT_ASSESSED" : sourceLabel(src[name]), count: complete(name) && !maintenanceUnassessed ? records.length : null, note: !complete(name) ? "Information unavailable or incomplete" : maintenanceUnassessed ? "Maintenance not assessed" : records.length ? "Outstanding records" : "No open records recorded" });
    for (const row of records) {
      const asset = assets.find(item => belongsToAsset(row, item)) || null;
      const due = dateField ? row[dateField] || (name === "plantMaintenance" ? row.plannedDate : null) : null;
      const date = calendarDay(due);
      const recordRef = row.issueId || row.defectId || row.maintenanceId || row.movementId || row.id;
      // Restricted readers receive identifiers/status only: existing free-text
      // payloads can mix operational explanations and financial information.
      const narrative = access.costs ? row.title || row.currentPosition || "" : "";
      const detail = `${recordRef} · ${code(row.status) || "Status not assessed"}${narrative ? ` · ${narrative}` : ""}`;
      if (name === "plantIssues" || name === "plantDefects" || date === null || date < day || ["READY_FOR_COLLECTION", "TRANSPORT_REQUESTED"].includes(code(row.status))) {
        add(date !== null && date < day ? `Overdue ${title.toLowerCase()}` : title, `${detail}${date === null && dateField ? " · Due date not recorded" : ""}`, asset, name === "plantDefects" ? 1 : 2, { source: name, recordStatus: code(row.status), due, responsible: row.responsiblePersonName || row.ownerName || null, programmeImpact: access.costs ? row.programmeImpact || null : null, recordedNextAction: access.costs ? row.nextMilestone || null : null });
      }
      if (date !== null && date >= day && date <= day + 30) model.upcoming.push({ title, asset, date: due, day: date, detail });
    }
  }
  model.operations.push({ name: "compliance", label: "Compliance", state: fleetComplete ? "NOT_ASSESSED" : "UNAVAILABLE", count: null, note: "Explicit holds shown above. Compliance evidence is not assessed here." });
  if (access.costs) {
    let financialComplete = complete("plantAssets", "plantHireRecords") && ownershipKnown;
    const hired = active.filter(isHireOwnership);
    const unmatchedHires = rows("plantHireRecords").filter(record => !record.offHireConfirmedDate && ["ACTIVE", "OFF_HIRE_REQUESTED"].includes(code(record.status)) && !hired.some(asset => belongsToAsset(record, asset)));
    if (unmatchedHires.length) {
      financialComplete = false;
      add("Hire records without a current fleet asset", "Review active hire links and inactive assets before assessing commitment.");
    }
    for (const asset of hired) {
      if (src.plantHireRecords.state === "LOADING") continue;
      const selection = selectHire(asset, rows("plantHireRecords"), { complete: complete("plantHireRecords") });
      const hire = selection.record;
      const estimate = calculateHire(hire, today);
      const activeHire = hire && ["ACTIVE", "OFF_HIRE_REQUESTED"].includes(code(hire.status)) && !hire.offHireConfirmedDate;
      if (!hire || estimate.state !== "KNOWN") {
        financialComplete = false;
        add(selection.state === "AMBIGUOUS" ? "Ambiguous hire records" : "Hire information needs review", hire ? estimate.reason : selection.reason, asset);
      }
      if (hire && !activeHire && !hire.offHireConfirmedDate) {
        financialComplete = false;
        add("Hire status needs confirmation", "Confirmed off-hire is not recorded; current commitment is unknown.", asset);
      }
      if (hire?.offHireConfirmedDate) continue;
      const idle = activeHire && assignmentsByAsset.get(asset.id) === false && code(asset.status) === "AVAILABLE" && !blocked(asset);
      const expected = calendarDay(hire?.expectedOffHireDate);
      let reason = !activeHire ? "Current hire commitment unknown" : blocked(asset) ? "Off road / hold" : idle ? "No productive assignment recorded" : "Active hire commitment";
      if (idle) add("Hired Plant without productive assignment", "Review allocation or arrange off-hire.", asset, 1);
      if (activeHire && expected !== null && expected <= day + 14) {
        reason = expected < day ? "Past expected off-hire" : "Expected off-hire approaching";
        add(reason, "Confirm continued need and supplier off-hire arrangements.", asset, 1);
      }
      if (activeHire && expected === null) add("Expected off-hire unknown", "Review the hire plan.", asset);
      if (activeHire && expected !== null && expected >= day && expected <= day + 30) model.upcoming.push({ title: "Expected off-hire", asset, date: hire.expectedOffHireDate, day: expected, detail: "Planning date; charges continue until confirmed off-hire" });
      model.hires.push({ asset, hire, estimate, reason: hire ? reason : selection.reason, idle });
    }
    const sum = key => model.hires.reduce((total, row) => total + (row.estimate[key] ?? 0), 0);
    model.finance = { complete: financialComplete, active: financialComplete ? model.hires.length : null, weekly: financialComplete ? sum("weekly") : null, exposure: financialComplete ? sum("estimatedCost") : null, idle: financialComplete && complete("plantAssignments") && [...assignmentsByAsset.values()].every(value => value !== null) ? model.hires.filter(row => row.idle).length : null };
    model.finance.daily = model.finance.weekly === null ? null : model.finance.weekly / 7;
    model.finance.idleWeekly = model.finance.idle === null ? null : model.hires.filter(row => row.idle).reduce((sum, row) => sum + row.estimate.weekly, 0);
    model.finance.offHireAction = financialComplete && model.hires.every(row => calendarDay(row.hire?.expectedOffHireDate) !== null) ? model.hires.filter(row => calendarDay(row.hire.expectedOffHireDate) <= day + 14).length : null;
    model.hires.sort((a, b) => Number(b.idle || blocked(b.asset)) - Number(a.idle || blocked(a.asset)) || (b.estimate.weekly ?? -1) - (a.estimate.weekly ?? -1));
  }
  model.attention.sort((a, b) => a.priority - b.priority);
  for (const item of model.attention) {
    const hire = model.hires.find(row => row.asset.id === item.asset?.id);
    item.currentPosition = item.recordStatus || (item.asset && blocked(item.asset) ? "OFF_ROAD / HOLD" : item.asset?.status) || "Information gap";
    item.why = item.priority === 0 ? "Recorded restrictions may prevent safe deployment." : /hire/i.test(item.title) ? "Hire charges may continue beyond productive need." : item.source === "plantDefects" ? "An unresolved fault may affect availability and safe use." : /unavailable|incomplete|unknown|review/i.test(item.title) ? "A reliable control decision needs complete information." : "Outstanding work may affect the next deployment.";
    item.nextAction = item.recordedNextAction || (item.source === "plantDefects" ? "Review fault, repair owner and return-to-service requirements" : item.source === "plantMaintenance" ? "Confirm service responsibility and maintenance date" : item.source === "plantMovements" ? "Confirm transport booking, collection and delivery" : item.source === "plantIssues" ? "Review issue owner and next milestone" : item.asset ? item.detail : "Refresh information; review access or missing records if unresolved");
    item.financial = access.costs && hire ? { weekly: hire.estimate.weekly, daily: hire.estimate.weekly === null ? null : hire.estimate.weekly / 7 } : null;
    item.supplier = item.asset?.supplierName || hire?.hire?.supplierName || null;
    item.expectedOffHire = hire?.hire?.expectedOffHireDate || null;
  }
  model.assets = active.map(asset => {
    const issue = model.attention.find(item => item.asset?.id === asset.id);
    const hire = model.hires.find(row => row.asset.id === asset.id) || null;
    return { asset, hire, issue, priority: issue?.priority ?? 4, nextAction: issue?.nextAction || "Review asset details and planned allocation" };
  }).sort((a, b) => a.priority - b.priority || String(a.asset.plantReference || a.asset.id).localeCompare(String(b.asset.plantReference || b.asset.id)));
  model.upcoming.sort((a, b) => a.day - b.day);
  return model;
}

// Presentation aggregates only. The canonical hire calculator and read gates
// above remain authoritative; incomplete reads never become organisation totals.
export function buildManagement(model, today = new Date()) {
  const day = calendarDay(today);
  const src = model.sources;
  const complete = (...names) => names.every(name => isComplete(src[name]));
  const records = name => ["LOADED_WITH_DATA", "LOADED_EMPTY"].includes(src[name]?.state) ? src[name].data : [];
  const categories = ["Assigned", "Available", "Off road / hold", "Maintenance", "In transit", "Other", "Unknown"];
  const rows = model.assets.map(item => {
    const asset = item.asset;
    const blocked = asset.safeToUse === false || asset.offRoad === true || asset.complianceHold === true || ["OFF_ROAD", "COMPLIANCE_HOLD"].includes(code(asset.status));
    let allocation = { key: "unknown", label: "Allocation unknown" };
    if (complete("plantAssignments")) {
      const related = records("plantAssignments").filter(row => belongsToAsset(row, asset) && !["CLOSED", "COMPLETED", "CANCELLED", "RELEASED"].includes(code(row.status)));
      const valid = related.every(row => ["ACTIVE", "PLANNED", "CONFIRMED"].includes(code(row.status)) && calendarDay(row.assignedFrom) !== null && (!row.assignedUntil || calendarDay(row.assignedUntil) !== null && calendarDay(row.assignedUntil) >= calendarDay(row.assignedFrom)) && row.projectId);
      const current = related.filter(row => calendarDay(row.assignedFrom) <= day && (!row.assignedUntil || calendarDay(row.assignedUntil) >= day));
      if (valid && current.length === 1) allocation = { key: `project:${current[0].projectId}`, label: current[0].projectName || current[0].projectId };
      else if (valid && current.length === 0 && !asset.currentProjectId && !asset.currentProjectName) allocation = { key: "unassigned", label: "Unassigned" };
    }
    const status = code(asset.status);
    let category = "Unknown";
    if (blocked) category = "Off road / hold";
    else if (status === "MAINTENANCE") category = "Maintenance";
    else if (status === "IN_TRANSIT") category = "In transit";
    else if (allocation.key.startsWith("project:") && ["DEPLOYED", "RESERVED", "AWAITING_TRANSPORT", "OFF_HIRE_PENDING"].includes(status)) category = "Assigned";
    else if (status === "AVAILABLE" && allocation.key === "unassigned") category = "Available";
    else if (["RESERVED", "AWAITING_TRANSPORT", "OFF_HIRE_PENDING"].includes(status) && allocation.key !== "unknown") category = "Other";
    return { ...item, allocation, category, blocked, hired: isHireOwnership(asset) };
  });
  const chartComplete = complete("plantAssets", "plantAssignments");
  const positions = categories.map(label => ({ label, count: chartComplete ? rows.filter(row => row.category === label).length : null }));
  const projectMap = new Map();
  for (const row of rows) {
    const group = projectMap.get(row.allocation.key) || { ...row.allocation, rows: [], weekly: 0 };
    group.rows.push(row);
    group.weekly += row.hire?.estimate.weekly ?? 0;
    projectMap.set(group.key, group);
  }
  const projects = [...projectMap.values()].sort((a, b) => b.rows.filter(row => row.blocked).length - a.rows.filter(row => row.blocked).length || a.label.localeCompare(b.label));
  const exposure = model.access.costs && model.finance.complete ? projects.filter(group => group.rows.some(row => row.hire)).sort((a, b) => b.weekly - a.weekly) : [];
  const named = exposure.filter(group => group.key.startsWith("project:"));
  const bars = [...named.slice(0, 5), ...exposure.filter(group => !group.key.startsWith("project:"))];
  if (named.length > 5) bars.push({ key: "other", label: "Other projects", weekly: named.slice(5).reduce((sum, group) => sum + group.weekly, 0), keys: named.slice(5).map(group => group.key) });
  const attention = model.attention.filter(item => item.asset || item.source || !/information unavailable or incomplete/.test(item.title));
  const gaps = Object.entries(src).filter(([name, source]) => !(name === "plantHireRecords" && !model.access.costs) && !isComplete(source));
  const summary = [];
  const total = model.position[0].value;
  if (total !== null) summary.push(`${total} active asset${total === 1 ? "" : "s"} recorded.`);
  else summary.push("Fleet information is incomplete; totals withheld.");
  if (chartComplete && total > 0) summary.push(`${positions[0].count} assigned, ${positions[1].count} available and ${positions[2].count} off road / hold.`);
  if (model.access.costs && model.finance.weekly !== null) summary.push(`Current hire commitment is ${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(model.finance.weekly)}/week.`);
  if (gaps.length) summary.push(`${gaps.map(([name]) => SOURCE_NAMES[name]).join(", ")} information is incomplete.`);
  if (attention.length) summary.push(`${attention.length} known action${attention.length === 1 ? "" : "s"} require${attention.length === 1 ? "s" : ""} attention.`);
  else summary.push(gaps.length ? "Actions cannot be fully assessed; safety and compliance remain unassessed." : "No actions identified in loaded records; safety and compliance remain unassessed.");
  return { rows, positions, projects, bars, attention, gaps, chartComplete, summary: summary.join(" "), day };
}

export function filterManagementRows(rows, filter, today = new Date()) {
  if (!filter || filter.kind === "all") return rows;
  return rows.filter(row => {
    if (filter.kind === "position") return row.category === filter.value;
    if (filter.kind === "project") return (filter.keys || [filter.value]).includes(row.allocation.key);
    if (filter.kind === "hired") return row.hired;
    if (filter.kind === "idle") return row.hire?.idle === true;
    if (filter.kind === "due") {
      const due = calendarDay(row.hire?.hire?.expectedOffHireDate);
      return due !== null && due <= calendarDay(today) + 14;
    }
    return true;
  });
}

// Asset-centred presentation of existing concerns. No new financial accrual or
// workflow state is inferred here; amounts are canonical current commitments.
export function buildAttentionQueue(model, management, today = new Date()) {
  const day = calendarDay(today);
  const groups = new Map();
  management.attention.forEach((concern, index) => {
    const key = concern.asset?.id || `unlinked:${index}`;
    if (!groups.has(key)) groups.set(key, { key, asset: concern.asset, concerns: [] });
    groups.get(key).concerns.push(concern);
  });
  const queue = [...groups.values()].map(group => {
    const row = management.rows.find(item => item.asset.id === group.asset?.id);
    const hire = model.access.costs ? row?.hire : null;
    const current = hire?.hire && ["ACTIVE", "OFF_HIRE_REQUESTED"].includes(code(hire.hire.status)) && !hire.hire.offHireConfirmedDate;
    const expected = current ? calendarDay(hire.hire.expectedOffHireDate) : null;
    const overdue = expected !== null && expected < day;
    const weekly = current ? hire.estimate.weekly : null;
    const locationUnknown = group.concerns.some(item => item.title === "Location not confirmed");
    const commercialRisk = overdue && row?.allocation.key === "unassigned" && locationUnknown && weekly > 0;
    const concernUrgency = item => {
      if (item.title === "Plant unavailable / off road") return 3;
      if (item.title === "Past expected off-hire" || item.title.startsWith("Overdue ") || item.source === "plantDefects" || item.source === "plantIssues") return 2;
      if (item.title === "Expected off-hire approaching") return 1;
      return 0;
    };
    group.concerns.sort((a, b) => concernUrgency(b) - concernUrgency(a));
    const level = commercialRisk ? 3 : Math.max(...group.concerns.map(concernUrgency));
    const primary = group.concerns[0];
    const impact = model.access.costs && primary.programmeImpact ? primary.programmeImpact : row?.blocked ? "Recorded restriction prevents availability" : commercialRisk ? "Overdue hire, unassigned; location not confirmed" : overdue ? "Hire continues beyond expected off-hire" : current && expected !== null && expected <= day + 14 ? "Expected off-hire due; confirm continued requirement" : hire?.idle ? "No productive assignment recorded" : locationUnknown ? "Location confirmation required" : primary.currentPosition === "Information gap" ? "Control information needs review" : "Review recorded operational position";
    return { ...group, row, level, tone: ["information", "warning", "pressure", "danger"][level], label: ["Information", "Due soon", "High", "Critical"][level], primary, impact, weekly, overdue, commercial: Boolean(current && (overdue || hire.idle || row?.blocked)) };
  });
  queue.sort((a, b) => b.level - a.level || (b.weekly ?? -1) - (a.weekly ?? -1) || a.key.localeCompare(b.key));
  const datesKnown = model.access.costs && model.hires.every(row => calendarDay(row.hire?.expectedOffHireDate) !== null);
  const financeKnown = model.access.costs && model.finance.complete;
  const allocationKnown = isComplete(model.sources.plantAssignments) && management.rows.every(row => row.allocation.key !== "unknown");
  const overdueWeekly = financeKnown && datesKnown ? model.hires.filter(row => calendarDay(row.hire?.expectedOffHireDate) < day).reduce((sum, row) => sum + row.estimate.weekly, 0) : null;
  return { queue, overdueWeekly, commercialAssets: financeKnown && datesKnown && allocationKnown ? queue.filter(group => group.commercial).length : null };
}
