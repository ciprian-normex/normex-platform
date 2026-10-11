import { auth, db } from "/js/firebase.js";
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { initialisePlantShell } from "/modules/contractor/plant/shared/plant-shell.js";
import { escapePlantHtml as esc, formatPlantDate } from "/modules/contractor/plant/shared/plant-utils.js";
import { AVAILABILITY_STATES, buildAvailabilityModel } from "./availability-model.js";

const $ = id => document.getElementById(id), clean = value => String(value ?? "").trim(), upper = value => clean(value).toUpperCase();
const label = value => upper(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const SOURCE_NAMES = ["plantAssets", "plantAssignments", "plantMaintenance", "plantDefects", "plantMovements", "plantHireRecords"];
const CLOSED_PROJECTS = new Set(["COMPLETE", "CLOSED", "CANCELLED", "ARCHIVED"]);
let profile, organisationId, projects = [], sources = {}, model = buildAvailabilityModel({}), selectedHorizonDays = 30, selectedSummaryFilter = "", generation = 0;

function isManager(actor = profile) {
  const permissions = actor?.permissions || {};
  return actor?.status === "ACTIVE" && actor.organisationId === organisationId && (Number(actor.accessLevel) >= 99 || ["PLATFORM_ADMIN", "ORGANISATION_MANAGER", "PLANT_TRANSPORT_MANAGER"].includes(upper(actor.roleCode || actor.role)) || permissions.canManagePlant || permissions.canManageTransport || permissions.canManageOrganisation);
}
function canViewPlant(actor = profile) { const permissions = actor?.permissions || {}; return isManager(actor) || Number(actor?.accessLevel) >= 1 || permissions.canViewPlant === true || permissions.canRequestPlant === true; }
function canViewPlantCosts(actor = profile) { const permissions = actor?.permissions || {}; return isManager(actor) || permissions.canViewCommercial === true || permissions.canManageCommercial === true; }
const source = (state = "LOADING", data = [], reason = "") => ({ state, data, reason, complete: ["LOADED_WITH_DATA", "LOADED_EMPTY"].includes(state) });
const loaded = data => source(data.length ? "LOADED_WITH_DATA" : "LOADED_EMPTY", data);
function failed(error) { const code = String(error?.code || ""); return source(code.includes("permission-denied") ? "PERMISSION_DENIED" : code.includes("unavailable") ? "UNAVAILABLE" : "ERROR", [], code.includes("permission-denied") ? "Access denied" : "Information unavailable"); }
const unique = rows => [...new Map(rows.map(row => [row.id, row])).values()];

function profileProjectIds() {
  const values = [];
  [profile?.projectIds, profile?.accessibleProjectIds, profile?.assignedProjectIds].forEach(list => Array.isArray(list) && values.push(...list));
  if (profile?.projectAccess && typeof profile.projectAccess === "object") values.push(...Object.keys(profile.projectAccess));
  if (Array.isArray(profile?.projects)) values.push(...profile.projects.map(item => typeof item === "string" ? item : item?.projectId || item?.id));
  return [...new Set(values.map(clean).filter(Boolean))];
}
async function membershipProjectIds() {
  const ids = profileProjectIds();
  try {
    const uid = auth.currentUser?.uid;
    if (uid) (await getDocs(query(collectionGroup(db, "members"), where("uid", "==", uid), where("active", "==", true)))).docs.forEach(item => item.ref.parent.parent?.id && ids.push(item.ref.parent.parent.id));
  } catch (error) { console.info("Availability membership discovery unavailable; using profile project scope.", error?.code || error); }
  return [...new Set(ids)];
}
async function organisationRows(name) { const snap = await getDocs(query(collection(db, name), where("organisationId", "==", organisationId))); return snap.docs.map(item => ({ id: item.id, ...item.data() })); }
async function loadProjects() {
  if (isManager() || profile?.permissions?.canViewAllProjects) return organisationRows("projects");
  const results = await Promise.allSettled((await membershipProjectIds()).map(id => getDoc(doc(db, "projects", id))));
  return results.filter(result => result.status === "fulfilled" && result.value.exists()).map(result => ({ id: result.value.id, ...result.value.data() })).filter(project => project.organisationId === organisationId);
}
async function projectRows(name, fields) {
  if (isManager()) return organisationRows(name);
  if (!projects.length) return [];
  const results = await Promise.allSettled(projects.flatMap(project => fields.map(field => getDocs(query(collection(db, name), where("organisationId", "==", organisationId), where(field, "==", project.id))))));
  const rejection = results.find(result => result.status === "rejected");
  if (rejection) throw rejection.reason;
  return unique(results.flatMap(result => result.value.docs.map(item => ({ id: item.id, ...item.data() }))));
}
async function linkedRows(name, assets, linkFields = ["assetId"]) {
  if (isManager()) return organisationRows(name);
  if (!assets.length) return [];
  const requests = [];
  for (const field of linkFields) {
    const values = [...new Set(assets.map(asset => field === "assetKey" || field === "assetId" ? asset.id : asset[field]).map(clean).filter(Boolean))];
    for (let index = 0; index < values.length; index += 30) requests.push(getDocs(query(collection(db, name), where("organisationId", "==", organisationId), where(field, "in", values.slice(index, index + 30)))));
  }
  const results = await Promise.allSettled(requests);
  const rejection = results.find(result => result.status === "rejected");
  if (rejection) throw rejection.reason;
  return unique(results.flatMap(result => result.value.docs.map(item => ({ id: item.id, ...item.data() }))));
}
async function addAssignmentAssets(assets, assignments) {
  if (isManager()) return assets;
  const known = new Set(assets.map(asset => asset.id));
  const ids = [...new Set(assignments.map(item => clean(item.assetId)).filter(id => id && !known.has(id)))];
  const results = await Promise.allSettled(ids.map(id => getDoc(doc(db, "plantAssets", id))));
  return unique([...assets, ...results.filter(result => result.status === "fulfilled" && result.value.exists()).map(result => ({ id: result.value.id, ...result.value.data() })).filter(asset => asset.organisationId === organisationId)]);
}
async function loadData() {
  const run = ++generation;
  SOURCE_NAMES.forEach(name => { sources[name] = source(); }); renderLoading();
  try { projects = (await loadProjects()).filter(project => !CLOSED_PROJECTS.has(upper(project.status))); } catch (error) { projects = []; SOURCE_NAMES.forEach(name => { sources[name] = failed(error); }); console.error("Availability project scope failed:", error); if (run === generation) renderAll(); return; }
  if (run !== generation) return;
  const initial = await Promise.allSettled([projectRows("plantAssets", ["currentProjectId"]), projectRows("plantAssignments", ["projectId"]), projectRows("plantMovements", ["fromProjectId", "toProjectId"])]);
  sources.plantAssets = initial[0].status === "fulfilled" ? loaded(initial[0].value) : failed(initial[0].reason);
  sources.plantAssignments = initial[1].status === "fulfilled" ? loaded(initial[1].value) : failed(initial[1].reason);
  sources.plantMovements = initial[2].status === "fulfilled" ? loaded(initial[2].value) : failed(initial[2].reason);
  if (initial[0].status === "fulfilled" && initial[1].status === "fulfilled") try { sources.plantAssets = loaded(await addAssignmentAssets(initial[0].value, initial[1].value)); } catch (error) { sources.plantAssets = failed(error); }
  const related = await Promise.allSettled([linkedRows("plantMaintenance", sources.plantAssets.data || []), linkedRows("plantDefects", sources.plantAssets.data || []), canViewPlantCosts() ? linkedRows("plantHireRecords", sources.plantAssets.data || [], ["assetId", "assetKey", "plantId", "plantReference"]) : Promise.resolve(null)]);
  if (run !== generation) return;
  ["plantMaintenance", "plantDefects", "plantHireRecords"].forEach((name, index) => { sources[name] = name === "plantHireRecords" && !canViewPlantCosts() ? source("PERMISSION_DENIED", [], "Commercial hire records are restricted") : related[index].status === "fulfilled" ? loaded(related[index].value) : failed(related[index].reason); if (related[index].status === "rejected") console.error(`Availability ${name} load failed:`, related[index].reason); });
  renderAll();
}

const projectName = project => project?.name || project?.projectName || project?.projectCode || project?.id || "Project not recorded";
const dayDate = day => Number.isFinite(day) ? new Date(day * 86400000) : null;
const dateLabel = day => dayDate(day) ? formatPlantDate(dayDate(day)) : "Not recorded";
const stateLabel = position => position ? label(position) : "Not assessed";
const stateClass = position => ({ AVAILABLE_NOW: "is-available", AVAILABLE_SOON: "is-soon", ALLOCATED: "is-allocated", MAINTENANCE: "is-maintenance", BLOCKED: "is-blocked", OFF_HIRE: "is-maintenance" }[position] || "");
function matchesState(item, state) { return !state || state === "AVAILABLE_SOON" ? (!state || item.availableSoon) : state === "OFF_HIRE" ? item.offHireDue : item.position === state; }
const summaryFiltered = item => matchesState(item, selectedSummaryFilter);
const empty = (title, detail, extra = "") => `<div class="availability-empty-state ${extra}"><strong>${esc(title)}</strong><span>${esc(detail)}</span></div>`;

function renderLoading() {
  $("availabilitySystemStatus").textContent = "Loading accessible Plant availability…";
  ["availableNowCount", "availableSoonCount", "allocatedCount", "maintenanceBlockedCount", "blockedCount", "offHireDueCount", "availabilityRegisterCount"].forEach(id => { $(id).textContent = "—"; });
  $("availabilityOutlook").innerHTML = empty("Loading availability outlook", "Current and future commitments are being checked.");
  $("availabilityReadyGrid").innerHTML = empty("Loading ready assets", "Availability controls are being assessed.", "availability-empty-state--wide");
  $("availabilityRegisterBody").innerHTML = `<tr class="availability-register-empty-row"><td colspan="8">${empty("Loading availability register", "Accessible records are being loaded.", "availability-empty-state--table")}</td></tr>`;
}
function renderAccessDenied(message) {
  $("availabilitySystemStatus").textContent = message;
  ["availableNowCount", "availableSoonCount", "allocatedCount", "maintenanceBlockedCount", "blockedCount", "offHireDueCount", "availabilityRegisterCount"].forEach(id => { $(id).textContent = "Unavailable"; });
  $("availabilityOutlook").innerHTML = empty("Availability unavailable", message);
  $("availabilityReadyGrid").innerHTML = empty("Readiness unavailable", message, "availability-empty-state--wide");
  $("availabilityRegisterBody").innerHTML = `<tr class="availability-register-empty-row"><td colspan="8">${empty("Register unavailable", message, "availability-empty-state--table")}</td></tr>`;
}
function populateProjectFilter() {
  const current = $("availabilityProjectFilter").value;
  $("availabilityProjectFilter").innerHTML = `<option value="">All accessible projects</option>${projects.slice().sort((a,b) => projectName(a).localeCompare(projectName(b))).map(project => `<option value="${esc(project.id)}">${esc(projectName(project))}</option>`).join("")}`;
  if ([...$("availabilityProjectFilter").options].some(option => option.value === current)) $("availabilityProjectFilter").value = current;
}
function filteredRows() {
  const search = clean($("availabilitySearchInput").value).toLowerCase(), assetClass = $("availabilityClassFilter").value, state = $("availabilityStateFilter").value, project = $("availabilityProjectFilter").value, ownership = $("availabilityOwnershipFilter").value;
  return model.assets.filter(item => { const asset = item.asset, text = [item.reference, item.name, asset.registrationNumber, asset.serialNumber].join(" ").toLowerCase(); return (!search || text.includes(search)) && (!assetClass || upper(asset.assetClass) === assetClass) && matchesState(item, state) && summaryFiltered(item) && (!project || item.projectId === project) && (!ownership || upper(asset.ownershipType || asset.ownership) === ownership); });
}
function renderSummary() {
  const ids = { AVAILABLE_NOW: "availableNowCount", AVAILABLE_SOON: "availableSoonCount", ALLOCATED: "allocatedCount", MAINTENANCE: "maintenanceBlockedCount", BLOCKED: "blockedCount", OFF_HIRE: "offHireDueCount" };
  AVAILABILITY_STATES.forEach(state => { $(ids[state]).textContent = model.summary[state] == null ? "Unavailable" : String(model.summary[state]); });
}
function renderReady() {
  const rows = model.assets.filter(item => item.position === "AVAILABLE_NOW" && summaryFiltered(item)).slice(0, 12);
  $("availabilityReadyGrid").innerHTML = rows.length ? rows.map(item => `<article class="availability-ready-card"><div class="availability-ready-card__top"><div><strong>${esc(item.reference)}</strong><span>${esc(item.name)}</span><small>${esc(item.location || "Location not confirmed")}</small></div><span class="availability-state-chip is-available">Available now</span></div><div class="availability-ready-card__meta"><div><span>Class</span><strong>${esc(label(item.asset.assetClass || "OTHER"))}</strong></div><div><span>Ownership</span><strong>${esc(label(item.asset.ownershipType || "Not recorded"))}</strong></div></div><button class="availability-row-action" type="button" data-open-availability="${esc(item.asset.id)}">Review</button></article>`).join("") : empty(model.assessment === "NOT_ASSESSED" ? "Readiness not assessed" : "No assets ready to allocate", model.assessment === "NOT_ASSESSED" ? "One or more operational dependencies are unavailable." : "No accessible asset currently meets every readiness control.", "availability-empty-state--wide");
}
function renderOutlook() {
  const events = model.outlook.filter(event => model.assets.find(item => item.asset.id === event.assetId && summaryFiltered(item))).slice(0, 10);
  $("availabilityOutlook").innerHTML = events.length ? events.map(item => `<article class="availability-outlook-item is-${esc(item.tone)}"><span class="availability-outlook-date">${esc(dateLabel(item.day))}</span><strong class="availability-outlook-title">${esc(item.title)}</strong><span class="availability-outlook-asset">${esc(item.assetReference)}</span><span class="availability-outlook-note">${esc(item.detail)}</span></article>`).join("") : empty(model.assessment === "NOT_ASSESSED" ? "Outlook not assessed" : "No changes in this horizon", model.assessment === "NOT_ASSESSED" ? "Required planning sources are unavailable." : "No accessible event falls within this period.");
}
function renderRegister() {
  const rows = filteredRows(); $("availabilityRegisterCount").textContent = String(rows.length);
  $("availabilityRegisterBody").innerHTML = rows.length ? rows.map(item => `<tr><td><div class="availability-register-main"><strong>${esc(item.reference)}</strong><span>${esc(item.name)}</span></div></td><td>${esc(label(item.asset.assetClass || "OTHER"))}</td><td><div class="availability-register-main"><strong>${esc(item.responsibility || "Not allocated")}</strong><span>${esc(item.projectName || "No current project")}</span></div></td><td>${esc(item.location || "Not confirmed")}</td><td>${item.position === "AVAILABLE_NOW" ? "Now" : esc(dateLabel(item.availableFrom))}</td><td>${item.nextCommitment ? `<div class="availability-register-main"><strong>${esc(item.nextCommitment.title)}</strong><span>${esc(dateLabel(item.nextCommitment.day))}</span></div>` : "None in horizon"}</td><td><span class="availability-state-chip ${stateClass(item.position)}">${esc(stateLabel(item.position))}</span></td><td><button class="availability-row-action" type="button" data-open-availability="${esc(item.asset.id)}">Open</button></td></tr>`).join("") : `<tr class="availability-register-empty-row"><td colspan="8">${empty("No matching assets", "Adjust the filters or selected availability position.", "availability-empty-state--table")}</td></tr>`;
}
function renderStatus() {
  if (model.assessment === "NOT_ASSESSED") $("availabilitySystemStatus").textContent = `Availability not fully assessed. Unavailable dependencies: ${model.sourceIssues.map(name => name.replace("plant", "")).join(", ") || "fleet"}.`;
  else if (model.assessment === "EMPTY") $("availabilitySystemStatus").textContent = isManager() ? "No active Plant assets are recorded for this organisation." : "No active Plant assets are visible in your accessible projects.";
  else $("availabilitySystemStatus").textContent = isManager() ? "Organisation-wide availability assessed from current operational records." : "Availability assessed for your accessible project scope.";
}
function renderAll() { model = buildAvailabilityModel(sources, { horizonDays: selectedHorizonDays }); $("availabilityHorizonLabel").textContent = selectedHorizonDays === 0 ? "Today" : `Next ${selectedHorizonDays} days`; document.querySelectorAll("[data-horizon-days]").forEach(button => button.classList.toggle("is-active", Number(button.dataset.horizonDays) === selectedHorizonDays)); populateProjectFilter(); renderStatus(); renderSummary(); renderOutlook(); renderReady(); renderRegister(); }

function openDrawer(assetId) {
  const item = model.assets.find(candidate => candidate.asset.id === assetId); if (!item) return;
  $("availabilityDrawerEyebrow").textContent = stateLabel(item.position); $("availabilityDrawerTitle").textContent = item.reference; $("availabilityDrawerSubtitle").textContent = item.name;
  const detail = [["Current position", stateLabel(item.position)], ["Responsibility", item.responsibility || "Not allocated"], ["Current location", item.location || "Not confirmed"], ["Available from", item.position === "AVAILABLE_NOW" ? "Now" : dateLabel(item.availableFrom)], ["Next commitment", item.nextCommitment?.title || "None in horizon"], ["Data quality", item.isDataComplete ? "Current sources assessed" : "Incomplete"]];
  const notices = [...item.blockers, ...item.dataIssues.map(issue => ({ title: "Information incomplete", detail: issue, tone: "warning" }))];
  const events = item.futureEvents.map(event => `<div class="availability-blocker"><strong>${esc(event.title)} · ${esc(dateLabel(event.day))}</strong><span>${esc(event.detail)}</span></div>`).join("");
  $("availabilityDrawerBody").innerHTML = `<div class="availability-detail-grid">${detail.map(([name,value]) => `<div class="availability-detail-item"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join("")}</div><div class="availability-blocker-list">${notices.length ? notices.map(notice => `<div class="availability-blocker is-${esc(notice.tone)}"><strong>${esc(notice.title)}</strong><span>${esc(notice.detail)}</span></div>`).join("") : `<div class="availability-blocker"><strong>No current blockers</strong><span>No defect, compliance or active maintenance restriction was found in the assessed sources.</span></div>`}${events}</div>`;
  $("availabilityOpenAsset").href = `/modules/contractor/plant/asset/index.html?id=${encodeURIComponent(assetId)}`; $("availabilityDrawer").classList.add("is-open"); $("availabilityDrawer").setAttribute("aria-hidden", "false");
}
function closeDrawer() { $("availabilityDrawer").classList.remove("is-open"); $("availabilityDrawer").setAttribute("aria-hidden", "true"); }
function bind() {
  document.querySelectorAll("[data-horizon-days]").forEach(button => button.addEventListener("click", () => { selectedHorizonDays = Number(button.dataset.horizonDays); renderAll(); }));
  document.querySelectorAll("[data-availability-summary]").forEach(tile => tile.addEventListener("click", () => { selectedSummaryFilter = selectedSummaryFilter === tile.dataset.availabilitySummary ? "" : tile.dataset.availabilitySummary; document.querySelectorAll("[data-availability-summary]").forEach(candidate => candidate.classList.toggle("is-active", candidate.dataset.availabilitySummary === selectedSummaryFilter)); $("clearAvailabilitySummaryFilter").hidden = !selectedSummaryFilter; renderOutlook(); renderReady(); renderRegister(); }));
  $("clearAvailabilitySummaryFilter").addEventListener("click", () => { selectedSummaryFilter = ""; document.querySelectorAll("[data-availability-summary]").forEach(tile => tile.classList.remove("is-active")); $("clearAvailabilitySummaryFilter").hidden = true; renderOutlook(); renderReady(); renderRegister(); });
  ["availabilitySearchInput", "availabilityClassFilter", "availabilityStateFilter", "availabilityProjectFilter", "availabilityOwnershipFilter"].forEach(id => $(id).addEventListener($(id).tagName === "INPUT" ? "input" : "change", renderRegister));
  document.addEventListener("click", event => { const button = event.target.closest("[data-open-availability]"); if (button) openDrawer(button.dataset.openAvailability); });
  $("availabilityDrawerClose").addEventListener("click", closeDrawer); $("availabilityDrawerBackdrop").addEventListener("click", closeDrawer); document.addEventListener("keydown", event => event.key === "Escape" && closeDrawer());
}
async function initialise(nextProfile) { profile = nextProfile; organisationId = clean(profile?.organisationId); if (profile?.status !== "ACTIVE" || !organisationId) { renderAccessDenied("An active organisation profile is required before availability can be assessed."); return; } if (!canViewPlant()) { renderAccessDenied("Plant workspace access is required before availability can be assessed."); return; } await loadData(); }
bind(); initialisePlantShell({ activePage: "availability", workspaceName: "Fleet & Transport Control" });
if (window.NORMEX_CURRENT_USER) initialise(window.NORMEX_CURRENT_USER); else window.addEventListener("normex:workspace-ready", event => initialise(event.detail.profile), { once: true });
