import { belongsToAsset, calendarDay, isHireOwnership, selectHire } from "../shared/plant-hire.js";

export const AVAILABILITY_STATES = Object.freeze([
  "AVAILABLE_NOW", "AVAILABLE_SOON", "ALLOCATED", "MAINTENANCE", "BLOCKED", "OFF_HIRE"
]);

export const CRITICAL_SOURCES = Object.freeze([
  "plantAssets", "plantAssignments", "plantMaintenance", "plantDefects", "plantMovements"
]);

const terminal = new Set(["CLOSED", "COMPLETED", "CANCELLED", "RELEASED"]);
const code = (value) => String(value ?? "").trim().toUpperCase();
const loaded = (source) => Boolean(source && ["LOADED_WITH_DATA", "LOADED_EMPTY"].includes(source.state) && source.complete !== false);
const rows = (sources, name) => loaded(sources[name]) ? sources[name].data || [] : [];
const related = (records, asset) => records.filter((record) => belongsToAsset(record, asset));
const inRange = (day, from, to) => day !== null && day >= from && day <= to;

function reference(asset) {
  return asset.plantReference || asset.plantId || asset.registrationNumber || asset.registration || asset.id;
}

function assetName(asset) {
  const machine = [asset.manufacturer || asset.make, asset.model].filter(Boolean).join(" ");
  return machine || asset.plantType || asset.vehicleType || asset.equipmentType || "Plant asset";
}

function dateCandidate(record, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], record);
    if (calendarDay(value) !== null) return value;
  }
  return null;
}

function currentAssignments(asset, assignments, today) {
  return related(assignments, asset).filter((record) => {
    if (terminal.has(code(record.status)) || !["ACTIVE", "CONFIRMED", "PLANNED"].includes(code(record.status))) return false;
    const start = calendarDay(record.assignedFrom);
    const end = calendarDay(record.assignedUntil);
    return start !== null && start <= today && (record.assignedUntil ? end !== null && end >= today : true);
  });
}

function activeMaintenance(asset, maintenance, today) {
  return related(maintenance, asset).filter((record) => {
    const status = code(record.status);
    if (terminal.has(status)) return false;
    if (["IN_PROGRESS", "UNAVAILABLE"].includes(status) || code(record.booking?.availability) === "PLANNED_UNAVAILABLE") {
      const start = calendarDay(dateCandidate(record, ["startedAt", "plannedDate", "dueDate", "booking.bookedAt"]));
      const end = calendarDay(record.expectedReturnDate);
      return (start === null || start <= today) && (end === null || end >= today);
    }
    return false;
  });
}

function blockingDefects(asset, defects) {
  return related(defects, asset).filter((record) => !terminal.has(code(record.status)) && (
    record.operationalHold === true || record.stopUse === true || code(record.operationalPosition) === "STOP_USE"
  ));
}

function currentMovements(asset, movements, today) {
  return related(movements, asset).filter((record) => {
    if (["DELIVERED", "CANCELLED"].includes(code(record.status))) return false;
    const planned = calendarDay(record.plannedDate);
    return code(record.status) === "IN_TRANSIT" || (planned !== null && planned <= today && ["PLANNED", "READY"].includes(code(record.status)));
  });
}

function event(type, title, date, asset, detail, tone) {
  const day = calendarDay(date);
  return day === null ? null : { type, title, date, day, assetId: asset.id, assetReference: reference(asset), detail, tone };
}

function futureEvents(asset, sources, today, horizonEnd) {
  const result = [];
  for (const assignment of related(rows(sources, "plantAssignments"), asset)) {
    if (terminal.has(code(assignment.status))) continue;
    const release = event("RELEASE", "Allocation release", assignment.assignedUntil, asset, assignment.projectName || "Current commitment", "release");
    const start = event("ALLOCATION", "Allocation starts", assignment.assignedFrom, asset, assignment.projectName || "Project commitment", "movement");
    if (release && inRange(release.day, today, horizonEnd)) result.push(release);
    if (start && start.day > today && start.day <= horizonEnd) result.push(start);
  }
  for (const record of related(rows(sources, "plantMaintenance"), asset)) {
    if (terminal.has(code(record.status))) continue;
    const planned = event("MAINTENANCE", "Maintenance planned", dateCandidate(record, ["plannedDate", "dueDate", "booking.bookedAt", "nextReviewDate"]), asset, record.maintenanceType || record.provider || "Maintenance commitment", "maintenance");
    if (planned && inRange(planned.day, today, horizonEnd)) result.push(planned);
  }
  for (const movement of related(rows(sources, "plantMovements"), asset)) {
    if (["DELIVERED", "CANCELLED"].includes(code(movement.status))) continue;
    const planned = event("MOVEMENT", "Movement planned", movement.plannedDate, asset, [movement.fromLocation, movement.toLocation].filter(Boolean).join(" to ") || "Location change", "movement");
    if (planned && inRange(planned.day, today, horizonEnd)) result.push(planned);
  }
  return result.sort((a, b) => a.day - b.day);
}

function assetPosition(asset, sources, today, horizonEnd) {
  const dataIssues = [];
  const required = CRITICAL_SOURCES.filter((name) => name !== "plantAssets" && !loaded(sources[name]));
  if (isHireOwnership(asset) && !loaded(sources.plantHireRecords)) required.push("plantHireRecords");
  if (required.length) dataIssues.push(`Unavailable dependencies: ${required.join(", ")}`);

  const assignments = currentAssignments(asset, rows(sources, "plantAssignments"), today);
  const maintenance = activeMaintenance(asset, rows(sources, "plantMaintenance"), today);
  const defects = blockingDefects(asset, rows(sources, "plantDefects"));
  const movements = currentMovements(asset, rows(sources, "plantMovements"), today);
  const events = futureEvents(asset, sources, today, horizonEnd);
  const blockers = [];

  if (asset.complianceHold === true) blockers.push({ title: "Compliance hold", detail: asset.complianceHoldReason || "A compliance restriction is recorded.", tone: "alert" });
  if (asset.safeToUse === false || asset.offRoad === true || ["OFF_ROAD", "COMPLIANCE_HOLD"].includes(code(asset.status))) blockers.push({ title: "Asset unavailable", detail: "The canonical asset record is marked off road or unsafe to use.", tone: "alert" });
  defects.forEach((record) => blockers.push({ title: "Operational defect", detail: record.description || "An active stop-use defect is recorded.", tone: "alert" }));
  maintenance.forEach((record) => blockers.push({ title: "Maintenance unavailable", detail: record.maintenanceType || record.provider || "Active maintenance window", tone: "warning" }));

  let hire = null;
  let hireSelection = null;
  if (isHireOwnership(asset)) {
    if (loaded(sources.plantHireRecords)) {
      hireSelection = selectHire(asset, rows(sources, "plantHireRecords"), { complete: true });
      hire = hireSelection.record;
      if (hireSelection.state !== "SELECTED") dataIssues.push(hireSelection.reason);
    }
  }
  const offHireDay = calendarDay(hire?.expectedOffHireDate);
  const offHireDue = Boolean(hire && !hire.offHireConfirmedDate && ["ACTIVE", "OFF_HIRE_REQUESTED"].includes(code(hire.status)) && (code(hire.status) === "OFF_HIRE_REQUESTED" || inRange(offHireDay, today, horizonEnd)));
  if (offHireDue) {
    const item = event("OFF_HIRE", "Expected off-hire", hire.expectedOffHireDate || new Date(today * 86400000), asset, "Planning date only; confirmation remains authoritative.", "blocked");
    if (item) events.push(item);
  }

  const returns = maintenance.map((record) => calendarDay(record.expectedReturnDate)).filter((day) => day !== null && day >= today);
  const releases = assignments.map((record) => calendarDay(record.assignedUntil)).filter((day) => day !== null && day >= today);
  const explicit = calendarDay(asset.availableFrom);
  const availableDay = [...returns, ...releases, explicit].filter((day) => day !== null).sort((a, b) => b - a)[0] ?? today;
  const availableSoon = availableDay > today && availableDay <= horizonEnd && blockers.filter((item) => item.tone === "alert").length === 0;

  let position = "AVAILABLE_NOW";
  if (required.length) position = null;
  else if (blockers.some((item) => item.tone === "alert")) position = "BLOCKED";
  else if (maintenance.length) position = "MAINTENANCE";
  else if (assignments.length || movements.length || asset.currentProjectId || asset.currentAssignedPersonId || code(asset.status) === "IN_TRANSIT") position = "ALLOCATED";
  else if (offHireDue) position = "OFF_HIRE";
  else if (availableSoon) position = "AVAILABLE_SOON";

  const responsibility = assignments[0]?.assignmentType === "PERSON"
    ? assignments[0].personName || asset.currentAssignedPersonName
    : assignments[0]?.projectName || movements[0]?.toProjectName || asset.currentProjectName || asset.currentAssignedPersonName || null;
  const nextCommitment = events.find((item) => item.day >= today) || null;
  return {
    asset,
    position,
    responsibility,
    projectId: assignments[0]?.projectId || asset.currentProjectId || null,
    projectName: assignments[0]?.projectName || asset.currentProjectName || null,
    location: asset.currentLocationLabel || null,
    availableFrom: availableDay,
    availableSoon,
    offHireDue,
    nextCommitment,
    blockers,
    futureEvents: events.sort((a, b) => a.day - b.day),
    isDataComplete: required.length === 0 && (!isHireOwnership(asset) || loaded(sources.plantHireRecords)),
    dataIssues,
    reference: reference(asset),
    name: assetName(asset)
  };
}

export function buildAvailabilityModel(sources, { horizonDays = 30, now = new Date() } = {}) {
  const today = calendarDay(now);
  const horizon = Number.isFinite(Number(horizonDays)) ? Math.max(0, Number(horizonDays)) : 30;
  const model = { assessment: "NOT_ASSESSED", horizonDays: horizon, today, horizonEnd: today === null ? null : today + horizon, assets: [], outlook: [], summary: {}, sourceIssues: [] };
  if (today === null || !loaded(sources.plantAssets)) {
    model.sourceIssues = CRITICAL_SOURCES.filter((name) => !loaded(sources[name]));
    return model;
  }
  model.assets = rows(sources, "plantAssets")
    .filter((asset) => asset.active !== false && code(asset.status) !== "INACTIVE")
    .map((asset) => assetPosition(asset, sources, today, model.horizonEnd));
  model.outlook = model.assets.flatMap((item) => item.futureEvents).sort((a, b) => a.day - b.day);
  model.sourceIssues = CRITICAL_SOURCES.filter((name) => !loaded(sources[name]));
  if (model.assets.some((item) => isHireOwnership(item.asset)) && !loaded(sources.plantHireRecords)) model.sourceIssues.push("plantHireRecords");
  const assessable = model.sourceIssues.length === 0;
  for (const state of AVAILABILITY_STATES) {
    model.summary[state] = assessable
      ? model.assets.filter((item) => state === "AVAILABLE_SOON" ? item.availableSoon : state === "OFF_HIRE" ? item.offHireDue : item.position === state).length
      : null;
  }
  model.assessment = assessable ? (model.assets.length ? "ASSESSED" : "EMPTY") : "NOT_ASSESSED";
  return model;
}
