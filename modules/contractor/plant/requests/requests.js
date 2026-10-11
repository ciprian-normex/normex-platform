import { auth, db } from "/js/firebase.js";
import {
  collection, collectionGroup, doc, getDoc, getDocs, query,
  runTransaction, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { initialisePlantShell } from "/modules/contractor/plant/shared/plant-shell.js";
import {
  escapePlantHtml as escapeHtml, formatPlantDate, parsePlantDate
} from "/modules/contractor/plant/shared/plant-utils.js";
import {
  ITEM_ACTION_TYPES, attentionRank, defaultActionType, deriveParentStatus,
  hasDownstreamLinks, isOpenRequest
} from "./requests-model.js";

const $ = (id) => document.getElementById(id);
const clean = (value) => String(value ?? "").trim();
const upper = (value) => clean(value).toUpperCase();
const label = (value) => upper(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const CLOSED_PROJECTS = new Set(["COMPLETE", "CLOSED", "CANCELLED", "ARCHIVED"]);
const PLANT_TYPES = [
  ["EXCAVATOR", "Excavator"], ["DUMPER", "Dumper"], ["TELEHANDLER", "Telehandler"],
  ["ROLLER", "Roller"], ["ACCESS_PLATFORM", "Access platform"], ["CRANE", "Crane"],
  ["GENERATOR", "Generator"], ["COMPRESSOR", "Compressor"], ["SMALL_PLANT", "Small Plant / tools"],
  ["ROAD_VEHICLE", "Road vehicle"], ["TRAILER_ATTACHMENT", "Trailer / attachment"], ["OTHER", "Other"]
];

let profile = null;
let organisationId = null;
let projects = [];
let assets = [];
let assignments = [];
let requests = [];
let hireRecords = [];
let selectedRequest = null;
let editingRequest = null;
let saving = false;
let summaryFilter = "";
let sourceStates = { projects: "LOADING", assets: "LOADING", requests: "LOADING" };

function isManager(actor = profile, record = { organisationId }) {
  if (!actor || actor.status !== "ACTIVE" || actor.organisationId !== organisationId || record?.organisationId !== organisationId) return false;
  const permissions = actor.permissions && typeof actor.permissions === "object" ? actor.permissions : {};
  return Number(actor.accessLevel) >= 99 || ["PLATFORM_ADMIN", "ORGANISATION_MANAGER", "PLANT_TRANSPORT_MANAGER"].includes(upper(actor.roleCode || actor.role)) || permissions.canManagePlant === true || permissions.canManageTransport === true || permissions.canManageOrganisation === true;
}

function canRaise(actor = profile) {
  const permissions = actor?.permissions || {};
  return actor?.status === "ACTIVE" && actor.organisationId === organisationId && (isManager(actor) || Number(actor.accessLevel) >= 2 || permissions.canRequestPlant === true);
}

function canViewAllProjects(actor = profile) {
  return isManager(actor) || actor?.permissions?.canViewAllProjects === true || Number(actor?.accessLevel) >= 99;
}

function projectName(project) {
  return project?.name || project?.projectName || project?.projectCode || project?.id || "Project not recorded";
}

function assetReference(asset) {
  return asset?.plantReference || asset?.plantId || asset?.registrationNumber || asset?.registration || asset?.id || "Asset not recorded";
}

function assetName(asset) {
  return [assetReference(asset), [asset?.manufacturer || asset?.make, asset?.model].filter(Boolean).join(" "), label(asset?.plantType || asset?.equipmentType || asset?.vehicleType || asset?.assetClass)].filter(Boolean).join(" · ");
}

function requestReference(request) {
  return request?.requestReference || request?.reference || `REQ-${clean(request?.id).slice(-6).toUpperCase()}`;
}

function dateValue(value) {
  const date = parsePlantDate(value);
  return date ? date.getTime() : 0;
}

function eventEntry(action, actor, detail = "") {
  return { action, at: now(), byUid: auth.currentUser?.uid || null, byName: clean(actor?.displayName || actor?.email) || "User", detail: clean(detail) || null };
}

function uniqueById(rows) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function queryOrganisationCollection(name) {
  const snapshot = await getDocs(query(collection(db, name), where("organisationId", "==", organisationId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function profileProjectIds() {
  const values = [];
  [profile?.projectIds, profile?.accessibleProjectIds, profile?.assignedProjectIds].forEach((list) => {
    if (Array.isArray(list)) values.push(...list);
  });
  if (profile?.projectAccess && typeof profile.projectAccess === "object") values.push(...Object.keys(profile.projectAccess));
  if (Array.isArray(profile?.projects)) values.push(...profile.projects.map((item) => typeof item === "string" ? item : item?.projectId || item?.id));
  return [...new Set(values.map(clean).filter(Boolean))];
}

async function membershipProjectIds() {
  const ids = profileProjectIds();
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return ids;
    const snapshot = await getDocs(query(collectionGroup(db, "members"), where("uid", "==", uid), where("active", "==", true)));
    snapshot.docs.forEach((membership) => {
      const projectId = membership.ref.parent.parent?.id;
      if (projectId) ids.push(projectId);
    });
  } catch (error) {
    console.info("Project membership discovery is unavailable; using profile project scope.", error?.code || error);
  }
  return [...new Set(ids)];
}

async function loadProjects() {
  if (canViewAllProjects()) return queryOrganisationCollection("projects");
  const ids = await membershipProjectIds();
  const results = await Promise.allSettled(ids.map((id) => getDoc(doc(db, "projects", id))));
  return results.filter((result) => result.status === "fulfilled" && result.value.exists()).map((result) => ({ id: result.value.id, ...result.value.data() })).filter((project) => project.organisationId === organisationId);
}

async function loadScopedCollection(name, projectField = "projectId") {
  if (isManager()) return queryOrganisationCollection(name);
  if (!projects.length) return [];
  const results = await Promise.allSettled(projects.map((project) => getDocs(query(collection(db, name), where("organisationId", "==", organisationId), where(projectField, "==", project.id)))));
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return uniqueById(results.flatMap((result) => result.value.docs.map((item) => ({ id: item.id, ...item.data() }))));
}

async function loadRequests() {
  if (isManager()) return queryOrganisationCollection("plantRequests");
  const reads = projects.map((project) => getDocs(query(collection(db, "plantRequests"), where("organisationId", "==", organisationId), where("projectId", "==", project.id))));
  reads.push(getDocs(query(collection(db, "plantRequests"), where("organisationId", "==", organisationId), where("createdByUid", "==", auth.currentUser.uid))));
  const results = await Promise.allSettled(reads);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return uniqueById(results.flatMap((result) => result.value.docs.map((item) => ({ id: item.id, ...item.data() }))));
}

async function loadData() {
  sourceStates = { projects: "LOADING", assets: "LOADING", requests: "LOADING" };
  setTruthState("Loading Plant requests…");
  renderTruthLoading();
  try {
    projects = (await loadProjects()).filter((project) => !CLOSED_PROJECTS.has(upper(project.status)));
    sourceStates.projects = projects.length ? "LOADED_WITH_DATA" : "LOADED_EMPTY";
  } catch (error) {
    projects = [];
    sourceStates.projects = error?.code?.includes("permission-denied") ? "PERMISSION_DENIED" : "ERROR";
    console.error("Requests project load failed:", error);
  }

  const [assetResult, assignmentResult, requestResult, hireResult] = await Promise.allSettled([
    loadScopedCollection("plantAssets", "currentProjectId"), loadScopedCollection("plantAssignments"), loadRequests(),
    isManager() ? queryOrganisationCollection("plantHireRecords") : Promise.resolve([])
  ]);
  if (assetResult.status === "fulfilled") {
    assets = assetResult.value;
    sourceStates.assets = assets.length ? "LOADED_WITH_DATA" : "LOADED_EMPTY";
  } else {
    assets = [];
    sourceStates.assets = assetResult.reason?.code?.includes("permission-denied") ? "PERMISSION_DENIED" : "ERROR";
    console.error("Requests asset load failed:", assetResult.reason);
  }
  assignments = assignmentResult.status === "fulfilled" ? assignmentResult.value : [];
  if (assignmentResult.status === "rejected") console.error("Requests assignment load failed:", assignmentResult.reason);
  if (requestResult.status === "fulfilled") {
    requests = requestResult.value;
    sourceStates.requests = requests.length ? "LOADED_WITH_DATA" : "LOADED_EMPTY";
  } else {
    requests = [];
    sourceStates.requests = requestResult.reason?.code?.includes("permission-denied") ? "PERMISSION_DENIED" : "ERROR";
    console.error("Requests register load failed:", requestResult.reason);
  }
  hireRecords = hireResult.status === "fulfilled" ? hireResult.value : [];
  populateSelectors();
  renderAll();
  const gaps = Object.entries(sourceStates).filter(([, state]) => ["PERMISSION_DENIED", "ERROR"].includes(state));
  setTruthState(gaps.length ? `Some request information is unavailable (${gaps.map(([name]) => name).join(", ")}).` : isManager() ? "Request control ready. Review and handoff actions are available." : "Accessible project requests are ready.");
}

function renderTruthLoading() {
  ["requestsOpenCount", "requestsPendingCount", "requestsApprovedCount", "requestsUrgentCount", "requestsCompletedCount", "requestRegisterCount", "contextAllocatedPlant", "contextVehicles", "contextOpenRequests", "contextAwaitingPlant"].forEach((id) => { if ($(id)) $(id).textContent = "—"; });
  $("requestAttentionList").innerHTML = truthMessage("Loading requests", "Current demand and review actions are being loaded.");
  $("requestRegisterBody").innerHTML = `<tr><td colspan="8">${truthMessage("Loading request register", "Please wait while accessible records are loaded.", "requests-empty-state--table")}</td></tr>`;
}

function truthMessage(title, copy, className = "") {
  return `<div class="requests-empty-state ${className}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></div>`;
}

function setTruthState(message) {
  $("requestsSystemStatus").textContent = message;
}

function populateSelectors() {
  const options = projects.sort((a, b) => projectName(a).localeCompare(projectName(b))).map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(projectName(project))}</option>`).join("");
  $("requestProjectId").innerHTML = `<option value="">Select project</option>${options}`;
  $("requestContextProject").innerHTML = `<option value="">All accessible projects</option>${options}`;
  $("requestProjectFilter").innerHTML = `<option value="">All accessible projects</option>${options}`;
  $("requestPlantType").innerHTML = `<option value="">Select type</option>${PLANT_TYPES.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}`;
  $("requesterPreview").textContent = profile.displayName || profile.email || "Current user";
  syncAssetOptions();
}

function assignmentMatchesAsset(assignment, asset) {
  const values = [asset?.id, asset?.plantId, asset?.plantReference].filter(Boolean);
  return [assignment?.assetId, assignment?.plantId, assignment?.plantReference].some((value) => values.includes(value));
}

function assetBelongsToProject(asset, projectId) {
  if (!projectId) return isManager();
  if (asset.currentProjectId === projectId) return true;
  return assignments.some((assignment) => assignment.projectId === projectId && assignmentMatchesAsset(assignment, asset) && ["ACTIVE", "CONFIRMED", "PLANNED"].includes(upper(assignment.status)));
}

function syncAssetOptions(selected = "") {
  const projectId = $("requestProjectId")?.value || editingRequest?.projectId || "";
  const scoped = assets.filter((asset) => isManager() || assetBelongsToProject(asset, projectId));
  const placeholder = ["PERMISSION_DENIED", "ERROR"].includes(sourceStates.assets) ? "Asset list unavailable" : projectId || isManager() ? "Select allocated asset" : "Select a project first";
  $("requestAssetId").innerHTML = `<option value="">${placeholder}</option>${scoped.map((asset) => `<option value="${escapeHtml(asset.id)}" ${asset.id === selected ? "selected" : ""}>${escapeHtml(assetName(asset))}</option>`).join("")}`;
}

function selectedRequestType() {
  return document.querySelector('input[name="requestType"]:checked')?.value || "PLANT_REQUIRED";
}

function syncRequestTypeFields() {
  const type = selectedRequestType();
  document.querySelectorAll("[data-request-fields]").forEach((group) => { group.hidden = !clean(group.dataset.requestFields).split(/\s+/).includes(type); });
  const firstType = $("requestItemsEditor")?.querySelector("select[data-item-action]");
  if (firstType && $("requestItemsEditor").children.length === 1 && !editingRequest) firstType.value = defaultActionType(type);
}

function itemId() {
  return globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addItemEditor(item = {}) {
  const root = $("requestItemsEditor");
  if (root.children.length >= 12) return;
  const row = document.createElement("div");
  row.className = "requests-item-editor";
  row.dataset.itemId = item.itemId || itemId();
  row.innerHTML = `<label><span>Action</span><select data-item-action>${ITEM_ACTION_TYPES.map((action) => `<option value="${action}" ${action === (item.actionType || defaultActionType(selectedRequestType())) ? "selected" : ""}>${label(action)}</option>`).join("")}</select></label><label class="requests-item-editor__description"><span>Description</span><input data-item-description maxlength="500" value="${escapeHtml(item.description || "")}" placeholder="Specific action to review"></label><label><span>Priority</span><select data-item-priority><option value="NORMAL">Normal</option><option value="HIGH" ${item.priority === "HIGH" ? "selected" : ""}>High</option><option value="URGENT" ${item.priority === "URGENT" ? "selected" : ""}>Urgent</option></select></label><button type="button" data-remove-item aria-label="Remove action item">×</button>`;
  root.append(row);
  syncRemoveItemButtons();
}

function syncRemoveItemButtons() {
  const rows = [...$("requestItemsEditor").children];
  rows.forEach((row) => { row.querySelector("[data-remove-item]").hidden = rows.length === 1; });
}

function readItems(status) {
  const requirement = clean($("requestRequirement").value);
  const items = [...$("requestItemsEditor").children].map((row, index) => {
    const description = clean(row.querySelector("[data-item-description]").value) || (index === 0 ? requirement : "");
    if (!description) throw new Error(`Describe action item ${index + 1}.`);
    return { itemId: row.dataset.itemId || itemId(), actionType: row.querySelector("[data-item-action]").value, description, priority: row.querySelector("[data-item-priority]").value, status, createdAt: editingRequest?.items?.find((item) => item.itemId === row.dataset.itemId)?.createdAt || now() };
  });
  if (!items.length) throw new Error("Add at least one action item.");
  return items;
}

function openRequestDialog(request = null) {
  if (!canRaise() || sourceStates.projects !== "LOADED_WITH_DATA") {
    setTruthState(sourceStates.projects === "LOADED_EMPTY" ? "No accessible active project is available for a request." : "Requests cannot be raised because accessible projects are unavailable.");
    return;
  }
  editingRequest = request;
  $("requestForm").reset();
  $("requestItemsEditor").innerHTML = "";
  $("requestFormError").hidden = true;
  $("requestDialogTitle").textContent = request ? `Edit ${requestReference(request)}` : "New Request";
  if (request) {
    const typeInput = document.querySelector(`input[name="requestType"][value="${request.requestType}"]`);
    if (typeInput) typeInput.checked = true;
    $("requestProjectId").value = request.projectId || "";
    $("requestPriority").value = request.priority || "NORMAL";
    $("requestSafetyCritical").checked = request.safetyCritical === true;
    $("requestPlantType").value = request.requestedPlantType || "";
    $("requestQuantity").value = request.quantity || 1;
    $("requestRequirement").value = request.requirement || "";
    $("requestRequiredFrom").value = clean(request.requiredFrom).slice(0, 10);
    $("requestRequiredUntil").value = clean(request.requiredUntil).slice(0, 10);
    $("requestLocation").value = request.location || "";
    $("requestNotes").value = request.notes || "";
    (request.items || []).forEach(addItemEditor);
    syncAssetOptions(request.assetId);
  } else {
    $("requestRequiredFrom").value = today();
    addItemEditor();
  }
  if (!$("requestItemsEditor").children.length) addItemEditor();
  syncRequestTypeFields();
  $("requestDialog").showModal();
}

function closeRequestDialog() {
  if (!saving && $("requestDialog").open) $("requestDialog").close();
}

function formData(status) {
  const type = selectedRequestType();
  const project = projects.find((item) => item.id === $("requestProjectId").value);
  const asset = assets.find((item) => item.id === $("requestAssetId").value);
  const requirement = clean($("requestRequirement").value);
  const requiredFrom = clean($("requestRequiredFrom").value);
  const requiredUntil = clean($("requestRequiredUntil").value) || null;
  if (!project) throw new Error("Select an accessible project.");
  if (!requirement) throw new Error("Describe the requirement or issue.");
  if (!requiredFrom) throw new Error("Enter the required-from date.");
  if (requiredUntil && requiredUntil < requiredFrom) throw new Error("Required-until cannot be before required-from.");
  if (type === "PLANT_REQUIRED" && !$("requestPlantType").value) throw new Error("Select the Plant or equipment type.");
  if (["SERVICE_REPAIR", "MOVEMENT", "OFF_HIRE", "REPLACEMENT"].includes(type) && !asset) throw new Error("Select an asset from the project context.");
  const itemStatus = status === "DRAFT" ? "DRAFT" : "SUBMITTED";
  return {
    requestType: type, projectId: project.id, projectName: projectName(project),
    assetId: asset?.id || null, assetReference: asset ? assetReference(asset) : null, assetClass: asset?.assetClass || null,
    priority: $("requestPriority").value, safetyCritical: $("requestSafetyCritical").checked, status, requirement,
    location: clean($("requestLocation").value) || null, notes: clean($("requestNotes").value) || null,
    requiredFrom, requiredUntil, requestedPlantType: type === "PLANT_REQUIRED" ? $("requestPlantType").value : null,
    quantity: type === "PLANT_REQUIRED" ? Math.max(1, Number($("requestQuantity").value) || 1) : null,
    sourceType: editingRequest?.sourceType || "MANUAL", sourceInspectionId: editingRequest?.sourceInspectionId || null,
    sourceAssetId: editingRequest?.sourceAssetId || null, sourceAssetReference: editingRequest?.sourceAssetReference || null,
    sourceProjectId: editingRequest?.sourceProjectId || null, sourceProjectName: editingRequest?.sourceProjectName || null,
    items: readItems(itemStatus), attachments: Array.isArray(editingRequest?.attachments) ? editingRequest.attachments : []
  };
}

async function saveRequest(status) {
  if (saving) return;
  saving = true;
  $("requestFormError").hidden = true;
  $("requestSaveDraftButton").disabled = true;
  $("requestSubmitButton").disabled = true;
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Your session has ended. Sign in again before saving.");
    const data = formData(status);
    await runTransaction(db, async (transaction) => {
      const profileSnapshot = await transaction.get(doc(db, "users", uid));
      const projectSnapshot = await transaction.get(doc(db, "projects", data.projectId));
      const assetSnapshot = data.assetId ? await transaction.get(doc(db, "plantAssets", data.assetId)) : null;
      if (!profileSnapshot.exists() || !projectSnapshot.exists()) throw new Error("Your profile or selected project is no longer available.");
      const actor = profileSnapshot.data();
      if (!canRaise({ ...actor, uid })) throw new Error("You no longer have permission to raise Plant requests.");
      if (projectSnapshot.data().organisationId !== organisationId) throw new Error("The selected project is outside your organisation.");
      if (data.assetId && (!assetSnapshot?.exists() || assetSnapshot.data().organisationId !== organisationId || (!isManager(actor) && assetSnapshot.data().currentProjectId !== data.projectId))) throw new Error("The selected asset is no longer available in this project.");
      const timestamp = serverTimestamp();
      const actorName = clean(actor.displayName || actor.email) || "User";
      if (editingRequest) {
        const reference = doc(db, "plantRequests", editingRequest.id);
        const latestSnapshot = await transaction.get(reference);
        if (!latestSnapshot.exists() || latestSnapshot.data().status !== "DRAFT" || (latestSnapshot.data().createdByUid !== uid && !isManager(actor, latestSnapshot.data()))) throw new Error("Only an unchanged draft can be edited.");
        transaction.update(reference, { ...data, updatedByUid: uid, updatedByName: actorName, updatedAt: timestamp, submittedAt: status === "SUBMITTED" ? timestamp : null, history: [...(latestSnapshot.data().history || []), eventEntry(status === "SUBMITTED" ? "SUBMITTED" : "DRAFT_UPDATED", actor)] });
      } else {
        const reference = doc(collection(db, "plantRequests"));
        transaction.set(reference, { organisationId, requestReference: `REQ-${reference.id.slice(-6).toUpperCase()}`, ...data, createdByUid: uid, createdByName: actorName, createdAt: timestamp, updatedByUid: uid, updatedByName: actorName, updatedAt: timestamp, submittedAt: status === "SUBMITTED" ? timestamp : null, reviewedByUid: null, reviewedByName: null, reviewedAt: null, completedAt: null, history: [eventEntry(status === "SUBMITTED" ? "SUBMITTED" : "DRAFT_SAVED", actor)] });
      }
    });
    closeRequestDialog();
    await loadData();
  } catch (error) {
    $("requestFormError").textContent = error?.message || "The request could not be saved.";
    $("requestFormError").hidden = false;
    console.error("Request save failed:", error);
  } finally {
    saving = false;
    $("requestSaveDraftButton").disabled = false;
    $("requestSubmitButton").disabled = false;
  }
}

function summaryMatches(request) {
  if (!summaryFilter) return true;
  const status = upper(request.status);
  if (summaryFilter === "OPEN") return isOpenRequest(request);
  if (summaryFilter === "PENDING_APPROVAL") return ["SUBMITTED", "UNDER_REVIEW", "PARTIALLY_APPROVED"].includes(status);
  if (summaryFilter === "APPROVED") return status === "APPROVED";
  if (summaryFilter === "URGENT") return request.safetyCritical === true || upper(request.priority) === "URGENT";
  if (summaryFilter === "COMPLETED") return status === "COMPLETED" && dateValue(request.completedAt || request.updatedAt) >= Date.now() - 30 * 86400000;
  return true;
}

function filteredRequests() {
  const search = clean($("requestSearchInput").value).toLowerCase();
  const type = $("requestTypeFilter").value;
  const status = $("requestStatusFilter").value;
  const priority = $("requestPriorityFilter").value;
  const projectId = $("requestProjectFilter").value;
  return requests.filter((request) => {
    const text = [requestReference(request), request.assetReference, request.projectName, request.createdByName, request.requestType, request.requirement, ...(request.items || []).map((item) => `${item.actionType} ${item.description}`)].join(" ").toLowerCase();
    return summaryMatches(request) && (!search || text.includes(search)) && (!type || request.requestType === type) && (!status || request.status === status) && (!priority || request.priority === priority) && (!projectId || request.projectId === projectId);
  }).sort((a, b) => attentionRank(a) - attentionRank(b) || dateValue(b.createdAt) - dateValue(a.createdAt));
}

function statusBadge(status) {
  return `<span class="requests-status requests-status--${upper(status).toLowerCase().replaceAll("_", "-")}">${escapeHtml(label(status))}</span>`;
}

function priorityBadge(request) {
  return `<span class="requests-priority requests-priority--${upper(request.priority).toLowerCase()}">${escapeHtml(label(request.priority))}</span>${request.safetyCritical ? `<span class="requests-safety-badge">Safety-critical</span>` : ""}`;
}

function requiredLabel(request) {
  const from = formatPlantDate(request.requiredFrom) || "Not recorded";
  return request.requiredUntil ? `${from} – ${formatPlantDate(request.requiredUntil)}` : from;
}

function renderSummary() {
  if (["ERROR", "PERMISSION_DENIED"].includes(sourceStates.requests)) return;
  const recent = Date.now() - 30 * 86400000;
  $("requestsOpenCount").textContent = requests.filter(isOpenRequest).length;
  $("requestsPendingCount").textContent = requests.filter((request) => ["SUBMITTED", "UNDER_REVIEW", "PARTIALLY_APPROVED"].includes(upper(request.status))).length;
  $("requestsApprovedCount").textContent = requests.filter((request) => upper(request.status) === "APPROVED").length;
  $("requestsUrgentCount").textContent = requests.filter((request) => isOpenRequest(request) && (request.safetyCritical || upper(request.priority) === "URGENT")).length;
  $("requestsCompletedCount").textContent = requests.filter((request) => upper(request.status) === "COMPLETED" && dateValue(request.completedAt || request.updatedAt) >= recent).length;
}

function renderProjectContext() {
  const projectId = $("requestContextProject").value;
  if (["ERROR", "PERMISSION_DENIED"].includes(sourceStates.assets)) {
    ["contextAllocatedPlant", "contextVehicles"].forEach((id) => $(id).textContent = "Unavailable");
    $("projectAssetsPreview").innerHTML = truthMessage("Asset context unavailable", "The asset read failed; an empty list is not inferred.");
  } else {
    const scopedAssets = projectId ? assets.filter((asset) => assetBelongsToProject(asset, projectId)) : assets;
    const vehicles = scopedAssets.filter((asset) => upper(asset.assetClass) === "ROAD_VEHICLE" || /VEHICLE|VAN|CAR|TRUCK/.test(upper(asset.vehicleType || asset.plantType)));
    $("contextAllocatedPlant").textContent = scopedAssets.length;
    $("contextVehicles").textContent = vehicles.length;
    $("projectAssetsPreview").innerHTML = projectId ? scopedAssets.length ? `<div class="requests-project-assets-grid">${scopedAssets.slice(0, 8).map((asset) => `<article><strong>${escapeHtml(assetReference(asset))}</strong><span>${escapeHtml(assetName(asset).replace(`${assetReference(asset)} · `, ""))}</span><small>${escapeHtml(asset.currentLocationLabel || "Location not confirmed")}</small></article>`).join("")}</div>` : truthMessage("No project assets recorded", "No accessible assets are currently assigned to this project.") : truthMessage("Select a project to view allocated assets", "Project-linked Plant and equipment will appear here.");
  }
  if (["ERROR", "PERMISSION_DENIED"].includes(sourceStates.requests)) {
    $("contextOpenRequests").textContent = "Unavailable";
    $("contextAwaitingPlant").textContent = "Unavailable";
  } else {
    const scopedRequests = projectId ? requests.filter((request) => request.projectId === projectId) : requests;
    $("contextOpenRequests").textContent = scopedRequests.filter(isOpenRequest).length;
    $("contextAwaitingPlant").textContent = scopedRequests.filter((request) => ["APPROVED", "PARTIALLY_APPROVED"].includes(upper(request.status)) && (request.items || []).some((item) => upper(item.status) === "APPROVED" && !itemHasLink(item))).length;
  }
}

function itemHasLink(item) {
  return ["linkedDefectId", "linkedMaintenanceId", "linkedMovementId", "linkedAssignmentId", "linkedHireRecordId"].some((field) => item?.[field]);
}

function renderAttention() {
  if (["ERROR", "PERMISSION_DENIED"].includes(sourceStates.requests)) {
    $("requestAttentionList").innerHTML = truthMessage("Attention queue unavailable", "The request read failed; no empty state is inferred.");
    return;
  }
  const rows = requests.filter((request) => isOpenRequest(request) && (attentionRank(request) < 6 || upper(request.status) === "SUBMITTED")).sort((a, b) => attentionRank(a) - attentionRank(b) || dateValue(a.requiredFrom) - dateValue(b.requiredFrom)).slice(0, 12);
  $("requestAttentionList").innerHTML = rows.length ? rows.map((request) => `<details class="requests-attention-card ${request.safetyCritical ? "is-safety-critical" : ""}"><summary><div><strong>${escapeHtml(requestReference(request))}</strong><span>${escapeHtml(request.requirement || label(request.requestType))}</span></div><div><span>${escapeHtml(request.projectName || "Project not recorded")}</span><small>${(request.items || []).length} action item${(request.items || []).length === 1 ? "" : "s"}</small></div><div>${priorityBadge(request)}</div><div>${statusBadge(request.status)}</div></summary><div class="requests-attention-detail">${(request.items || []).map((item) => `<div><span>${escapeHtml(label(item.actionType))}</span><strong>${escapeHtml(item.description)}</strong>${statusBadge(item.status)}</div>`).join("")}<button class="requests-row-action" type="button" data-open-request="${escapeHtml(request.id)}">Open request</button></div></details>`).join("") : truthMessage("No requests need attention", "New project and site requests will appear here when action is required.");
}

function renderRegister() {
  if (["ERROR", "PERMISSION_DENIED"].includes(sourceStates.requests)) {
    $("requestRegisterCount").textContent = "Unavailable";
    $("requestRegisterBody").innerHTML = `<tr><td colspan="8">${truthMessage("Request register unavailable", "The request read failed; no zero count is shown.", "requests-empty-state--table")}</td></tr>`;
    return;
  }
  const rows = filteredRequests();
  $("requestRegisterCount").textContent = rows.length;
  $("requestRegisterBody").innerHTML = rows.length ? rows.map((request) => `<tr class="${request.safetyCritical ? "is-safety-critical" : ""}"><td><div class="requests-register-main"><strong>${escapeHtml(requestReference(request))}</strong><span>${escapeHtml(label(request.requestType))} · ${(request.items || []).length} item${(request.items || []).length === 1 ? "" : "s"}</span></div></td><td>${escapeHtml(request.projectName || "Not recorded")}</td><td>${escapeHtml(request.requirement || "Not recorded")}</td><td>${escapeHtml(requiredLabel(request))}</td><td>${priorityBadge(request)}</td><td>${statusBadge(request.status)}</td><td>${escapeHtml(request.createdByName || "Not recorded")}</td><td><button type="button" class="requests-row-action" data-open-request="${escapeHtml(request.id)}">Open</button></td></tr>`).join("") : `<tr><td colspan="8">${truthMessage("No requests match", "Change the filters or raise a new request.", "requests-empty-state--table")}</td></tr>`;
}

function renderAll() {
  renderSummary(); renderProjectContext(); renderAttention(); renderRegister();
  $("newRequestButton").hidden = !canRaise();
}

function linkedRecords(item) {
  const links = [
    ["linkedMaintenanceId", "Maintenance", "/modules/contractor/plant/maintenance/"],
    ["linkedMovementId", "Movement", "/modules/contractor/plant/movements/"],
    ["linkedAssignmentId", "Assignment", "/modules/contractor/plant/availability/"],
    ["linkedHireRecordId", "Hire record", "/modules/contractor/plant/suppliers/"],
    ["linkedDefectId", "Defect", "/modules/contractor/plant/defects/"]
  ].filter(([field]) => item?.[field]);
  return links.length ? `<div class="requests-linked-records">${links.map(([field, name, href]) => `<a href="${href}">${escapeHtml(name)} <strong>${escapeHtml(item[field])}</strong></a>`).join("")}</div>` : "";
}

function itemManagementActions(request, item) {
  if (!isManager(profile, request)) return "";
  const status = upper(item.status);
  if (["SUBMITTED", "UNDER_REVIEW", "DEFERRED"].includes(status)) return `<div class="requests-item-actions"><button data-item-action-button="APPROVED" data-item-id="${item.itemId}">Approve</button><button data-item-action-button="REJECTED" data-item-id="${item.itemId}" class="is-danger">Reject</button><button data-item-action-button="DEFERRED" data-item-id="${item.itemId}">Defer</button></div>`;
  if (status === "APPROVED") {
    if (["SERVICE", "REPAIR", "INVESTIGATE"].includes(item.actionType)) return `<button class="requests-button requests-button--primary" data-convert-item="maintenance" data-item-id="${item.itemId}">Create maintenance</button>`;
    if (item.actionType === "MOVE") return `<button class="requests-button requests-button--primary" data-convert-item="movement" data-item-id="${item.itemId}">Create movement</button>`;
    if (item.actionType === "OFF_HIRE") return `<button class="requests-button requests-button--primary" data-convert-item="off_hire" data-item-id="${item.itemId}">Start off-hire</button>`;
    if (["ALLOCATE", "REPLACE"].includes(item.actionType)) return `<div class="requests-convert-select"><select data-allocation-asset="${item.itemId}"><option value="">Select available asset</option>${assets.filter((asset) => !["OFF_ROAD", "ARCHIVED", "DISPOSED"].includes(upper(asset.status))).map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(assetName(asset))}</option>`).join("")}</select><button class="requests-button requests-button--primary" data-convert-item="allocate" data-item-id="${item.itemId}">${item.actionType === "REPLACE" ? "Plan replacement" : "Allocate asset"}</button>${item.actionType === "ALLOCATE" ? `<button class="requests-button" data-convert-item="external_hire" data-item-id="${item.itemId}">External hire needed</button>` : ""}</div>`;
    return `<button class="requests-button requests-button--primary" data-convert-item="complete" data-item-id="${item.itemId}">Resolve item</button>`;
  }
  if (status === "IN_PROGRESS") return `<button class="requests-button requests-button--primary" data-convert-item="complete" data-item-id="${item.itemId}">Mark complete</button>`;
  return "";
}

function openRequestDrawer(request) {
  selectedRequest = request;
  $("requestDrawerReference").textContent = requestReference(request);
  $("requestDrawerTitle").textContent = request.requirement || label(request.requestType);
  $("requestDrawerSubtitle").textContent = `${request.projectName || "Project not recorded"} · Raised by ${request.createdByName || "Unknown"}`;
  const source = upper(request.sourceType) === "INSPECTION" ? `Daily Plant Inspection · ${request.sourceInspectionId || "Reference unavailable"}` : "Manual request";
  $("requestDrawerBody").innerHTML = `<div class="requests-detail-grid"><div class="requests-detail-item"><span>Status</span><strong>${label(request.status)}</strong></div><div class="requests-detail-item"><span>Priority</span><strong>${label(request.priority)}${request.safetyCritical ? " · Safety-critical" : ""}</strong></div><div class="requests-detail-item"><span>Project</span><strong>${escapeHtml(request.projectName || "Not recorded")}</strong></div><div class="requests-detail-item"><span>Asset</span><strong>${escapeHtml(request.assetReference || "Not applicable")}</strong></div><div class="requests-detail-item"><span>Required</span><strong>${escapeHtml(requiredLabel(request))}</strong></div><div class="requests-detail-item"><span>Source</span><strong>${escapeHtml(source)}</strong></div></div><section class="requests-detail-section"><h3>Location & notes</h3><div class="requests-detail-copy"><strong>${escapeHtml(request.location || "Location not recorded")}</strong><br>${escapeHtml(request.notes || "No additional notes")}</div></section><section class="requests-detail-section"><h3>Action items</h3><div class="requests-detail-items">${(request.items || []).map((item) => `<article class="requests-detail-action ${upper(item.priority) === "URGENT" ? "is-urgent" : ""}"><header><div><span>${escapeHtml(label(item.actionType))}</span><strong>${escapeHtml(item.description)}</strong></div>${statusBadge(item.status)}</header>${item.resolutionNotes ? `<p>${escapeHtml(item.resolutionNotes)}</p>` : ""}${linkedRecords(item)}${itemManagementActions(request, item)}</article>`).join("") || truthMessage("No action items recorded", "This legacy request requires management review.")}</div></section><section class="requests-detail-section"><h3>Attachments</h3>${(request.attachments || []).length ? `<ul class="requests-attachments">${request.attachments.map((attachment) => `<li>${escapeHtml(attachment.name || attachment.fileName || "Linked evidence")}</li>`).join("")}</ul>` : `<div class="requests-detail-copy">No attachments. New uploads are unavailable while Storage access remains denied.</div>`}</section><section class="requests-detail-section"><h3>History</h3><div class="requests-history">${(request.history || []).slice().reverse().map((event) => `<div class="requests-history-item"><time>${escapeHtml(formatPlantDate(event.at) || "Date pending")}</time><div><strong>${escapeHtml(label(event.action))}</strong><span>${escapeHtml([event.byName, event.detail].filter(Boolean).join(" · ") || "System event")}</span></div></div>`).join("") || truthMessage("No recorded history", "Legacy request history is not available.")}</div></section>`;
  const ownDraft = request.status === "DRAFT" && (request.createdByUid === auth.currentUser?.uid || isManager(profile, request));
  const canCancel = (isManager(profile, request) || request.createdByUid === auth.currentUser?.uid) && ["DRAFT", "SUBMITTED"].includes(request.status) && !hasDownstreamLinks(request);
  $("requestDrawerActions").innerHTML = `${ownDraft ? `<button class="requests-button" data-drawer-action="edit">Edit draft</button>` : ""}${canCancel ? `<button class="requests-button requests-button--danger" data-drawer-action="cancel">Cancel request</button>` : ""}`;
  $("requestDrawer").classList.add("is-open");
  $("requestDrawer").setAttribute("aria-hidden", "false");
}

function closeRequestDrawer() {
  $("requestDrawer").classList.remove("is-open");
  $("requestDrawer").setAttribute("aria-hidden", "true");
  selectedRequest = null;
}

async function mutateRequest(request, mutation) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Your session has ended.");
  await runTransaction(db, async (transaction) => {
    const profileSnapshot = await transaction.get(doc(db, "users", uid));
    const reference = doc(db, "plantRequests", request.id);
    const requestSnapshot = await transaction.get(reference);
    if (!profileSnapshot.exists() || !requestSnapshot.exists()) throw new Error("Your profile or this request is no longer available.");
    await mutation(transaction, profileSnapshot.data(), reference, requestSnapshot.data());
  });
}

async function reviewItem(request, itemId, nextStatus) {
  try {
    await mutateRequest(request, (transaction, actor, reference, latest) => {
      if (!isManager(actor, latest)) throw new Error("Plant / Transport management permission is required.");
      const items = (latest.items || []).map((item) => item.itemId === itemId ? { ...item, status: nextStatus, reviewedByUid: auth.currentUser.uid, reviewedByName: clean(actor.displayName) || null, reviewedAt: now() } : item);
      if (!items.some((item) => item.itemId === itemId)) throw new Error("The action item no longer exists.");
      const timestamp = serverTimestamp();
      transaction.update(reference, { items, status: deriveParentStatus(items, latest.status), reviewedByUid: auth.currentUser.uid, reviewedByName: clean(actor.displayName) || null, reviewedAt: timestamp, updatedByUid: auth.currentUser.uid, updatedByName: clean(actor.displayName) || null, updatedAt: timestamp, history: [...(latest.history || []), eventEntry(`ITEM_${nextStatus}`, actor, items.find((item) => item.itemId === itemId)?.description)] });
    });
    await refreshAndReopen(request.id);
  } catch (error) {
    setTruthState(error.message || "The item could not be reviewed.");
    console.error("Request item review failed:", error);
  }
}

function downstreamBase(actor, request, asset = null) {
  return { organisationId, assetId: asset?.id || request.assetId || null, plantId: asset?.plantId || request.assetReference || null, plantReference: asset ? assetReference(asset) : request.assetReference || null, assetClass: asset?.assetClass || request.assetClass || null, projectId: request.projectId || null, projectName: request.projectName || null, requestId: request.id, requestReference: requestReference(request), createdByUid: auth.currentUser.uid, createdByName: clean(actor.displayName) || null, createdAt: serverTimestamp(), updatedByUid: auth.currentUser.uid, updatedByName: clean(actor.displayName) || null, updatedAt: serverTimestamp() };
}

async function convertItem(request, itemId, kind, assetId = "") {
  try {
    await mutateRequest(request, async (transaction, actor, reference, latest) => {
      if (!isManager(actor, latest)) throw new Error("Plant / Transport management permission is required.");
      const items = [...(latest.items || [])];
      const index = items.findIndex((item) => item.itemId === itemId);
      if (index < 0 || upper(items[index].status) !== (kind === "complete" ? "IN_PROGRESS" : "APPROVED")) throw new Error("The action item changed and must be reviewed again.");
      const item = { ...items[index] };
      let linkedField = null;
      let linkedId = null;
      let historyAction = "ITEM_COMPLETED";
      let nextStatus = "IN_PROGRESS";
      if (kind === "maintenance") {
        if (!latest.assetId) throw new Error("An asset is required before maintenance can be created.");
        const target = doc(collection(db, "plantMaintenance"));
        transaction.set(target, { ...downstreamBase(actor, { ...latest, id: request.id }), maintenanceType: item.actionType === "SERVICE" ? "SERVICE" : "REPAIR", status: "SCHEDULED", plannedDate: latest.requiredFrom || today(), dueDate: latest.requiredFrom || today(), workRequired: item.description, notes: latest.notes || null, statusHistory: [{ status: "SCHEDULED", at: now(), byUid: auth.currentUser.uid, byName: clean(actor.displayName) || null }] });
        linkedField = "linkedMaintenanceId"; linkedId = target.id; historyAction = "MAINTENANCE_CREATED";
      } else if (kind === "movement") {
        if (!latest.assetId || !latest.location) throw new Error("An asset and destination location are required before a movement can be created.");
        const currentAsset = assets.find((asset) => asset.id === latest.assetId);
        const target = doc(collection(db, "plantMovements"));
        transaction.set(target, { ...downstreamBase(actor, { ...latest, id: request.id }, currentAsset), status: "PLANNED", plannedDate: latest.requiredFrom || today(), plannedTime: null, fromLocation: currentAsset?.currentLocationLabel || "Location not confirmed", toLocation: latest.location, fromProjectId: currentAsset?.currentProjectId || null, fromProjectName: currentAsset?.currentProjectName || null, toProjectId: latest.projectId || null, toProjectName: latest.projectName || null, notes: item.description, statusHistory: [{ status: "PLANNED", at: now(), byUid: auth.currentUser.uid, byName: clean(actor.displayName) || null }] });
        linkedField = "linkedMovementId"; linkedId = target.id; historyAction = "MOVEMENT_CREATED";
      } else if (kind === "off_hire") {
        const hire = hireRecords.find((record) => [record.assetId, record.plantId, record.plantReference].some((value) => [latest.assetId, latest.assetReference].includes(value)));
        if (!hire) throw new Error("No accessible canonical hire record is linked to this asset.");
        const hireRef = doc(db, "plantHireRecords", hire.id);
        const hireSnapshot = await transaction.get(hireRef);
        if (!hireSnapshot.exists() || hireSnapshot.data().organisationId !== organisationId) throw new Error("The hire record is no longer available.");
        transaction.update(hireRef, { status: "OFF_HIRE_REQUESTED", offHireRequestedAt: serverTimestamp(), offHireRequestedByUid: auth.currentUser.uid, offHireRequestedByName: clean(actor.displayName) || null, updatedByUid: auth.currentUser.uid, updatedByName: clean(actor.displayName) || null, updatedAt: serverTimestamp(), requestId: request.id, requestReference: requestReference(request) });
        linkedField = "linkedHireRecordId"; linkedId = hire.id; historyAction = "OFF_HIRE_STARTED";
      } else if (kind === "allocate") {
        if (!assetId) throw new Error("Select an available asset.");
        const assetSnapshot = await transaction.get(doc(db, "plantAssets", assetId));
        if (!assetSnapshot.exists() || assetSnapshot.data().organisationId !== organisationId) throw new Error("Select an available organisation asset.");
        const selectedAsset = { id: assetSnapshot.id, ...assetSnapshot.data() };
        if (["OFF_ROAD", "ARCHIVED", "DISPOSED"].includes(upper(selectedAsset.status))) throw new Error("The selected asset is not available for allocation.");
        const target = doc(collection(db, "plantAssignments"));
        transaction.set(target, { ...downstreamBase(actor, { ...latest, id: request.id }, selectedAsset), assignmentType: "PROJECT", status: "PLANNED", assignedFrom: latest.requiredFrom || today(), assignedUntil: latest.requiredUntil || null, replacementForAssetId: item.actionType === "REPLACE" ? latest.assetId || null : null, replacementReason: item.actionType === "REPLACE" ? item.description : null });
        linkedField = "linkedAssignmentId"; linkedId = target.id; historyAction = item.actionType === "REPLACE" ? "REPLACEMENT_PLANNED" : "ASSET_ALLOCATED";
      } else if (kind === "external_hire") {
        const target = doc(collection(db, "plantHireRecords"));
        const provisionalReference = `REQUEST-${requestReference(request)}`;
        transaction.set(target, { organisationId, plantId: provisionalReference, plantReference: provisionalReference, requestedPlantType: latest.requestedPlantType || null, quantity: latest.quantity || 1, projectId: latest.projectId, projectName: latest.projectName, status: "SOURCING", requestId: request.id, requestReference: requestReference(request), requiredFrom: latest.requiredFrom || null, requiredUntil: latest.requiredUntil || null, createdByUid: auth.currentUser.uid, createdByName: clean(actor.displayName) || null, createdAt: serverTimestamp(), updatedByUid: auth.currentUser.uid, updatedByName: clean(actor.displayName) || null, updatedAt: serverTimestamp() });
        linkedField = "linkedHireRecordId"; linkedId = target.id; historyAction = "EXTERNAL_HIRE_INITIATED";
      } else if (kind === "complete") {
        nextStatus = "COMPLETED";
      } else {
        throw new Error("This handoff is not supported.");
      }
      if (linkedField) item[linkedField] = linkedId;
      item.status = nextStatus;
      item.convertedAt = linkedField ? now() : item.convertedAt || null;
      item.completedAt = nextStatus === "COMPLETED" ? now() : item.completedAt || null;
      items[index] = item;
      const parentStatus = deriveParentStatus(items, latest.status);
      transaction.update(reference, { items, status: parentStatus, completedAt: parentStatus === "COMPLETED" ? serverTimestamp() : latest.completedAt || null, updatedByUid: auth.currentUser.uid, updatedByName: clean(actor.displayName) || null, updatedAt: serverTimestamp(), history: [...(latest.history || []), eventEntry(historyAction, actor, linkedId || item.description)] });
    });
    await refreshAndReopen(request.id);
  } catch (error) {
    setTruthState(error.message || "The downstream handoff could not be created.");
    console.error("Request handoff failed:", error);
  }
}

async function cancelRequest(request) {
  try {
    await mutateRequest(request, (transaction, actor, reference, latest) => {
      const owner = latest.createdByUid === auth.currentUser.uid;
      if (!(isManager(actor, latest) || owner) || !["DRAFT", "SUBMITTED"].includes(latest.status) || hasDownstreamLinks(latest)) throw new Error("This request can no longer be cancelled directly.");
      const items = (latest.items || []).map((item) => ({ ...item, status: "CANCELLED", cancelledAt: now() }));
      transaction.update(reference, { status: "CANCELLED", items, cancelledAt: serverTimestamp(), updatedByUid: auth.currentUser.uid, updatedByName: clean(actor.displayName) || null, updatedAt: serverTimestamp(), history: [...(latest.history || []), eventEntry("CANCELLED", actor)] });
    });
    closeRequestDrawer();
    await loadData();
  } catch (error) {
    setTruthState(error.message || "The request could not be cancelled.");
  }
}

async function refreshAndReopen(id) {
  closeRequestDrawer();
  await loadData();
  const refreshed = requests.find((request) => request.id === id);
  if (refreshed) openRequestDrawer(refreshed);
}

function bindEvents() {
  $("newRequestButton").addEventListener("click", () => openRequestDialog());
  $("requestDialogClose").addEventListener("click", closeRequestDialog);
  $("requestCancelButton").addEventListener("click", closeRequestDialog);
  $("requestDialog").addEventListener("cancel", (event) => { event.preventDefault(); closeRequestDialog(); });
  $("requestForm").addEventListener("submit", (event) => { event.preventDefault(); saveRequest("SUBMITTED"); });
  $("requestSaveDraftButton").addEventListener("click", () => saveRequest("DRAFT"));
  document.querySelectorAll('input[name="requestType"]').forEach((input) => input.addEventListener("change", syncRequestTypeFields));
  $("requestProjectId").addEventListener("change", () => syncAssetOptions());
  $("requestAddItemButton").addEventListener("click", () => addItemEditor());
  $("requestItemsEditor").addEventListener("click", (event) => { const button = event.target.closest("[data-remove-item]"); if (!button) return; button.closest(".requests-item-editor").remove(); syncRemoveItemButtons(); });
  $("requestContextProject").addEventListener("change", renderProjectContext);
  ["requestSearchInput", "requestTypeFilter", "requestStatusFilter", "requestPriorityFilter", "requestProjectFilter"].forEach((id) => $(id).addEventListener(id === "requestSearchInput" ? "input" : "change", renderRegister));
  document.querySelectorAll("[data-request-summary]").forEach((tile) => tile.addEventListener("click", () => {
    summaryFilter = summaryFilter === tile.dataset.requestSummary ? "" : tile.dataset.requestSummary;
    document.querySelectorAll("[data-request-summary]").forEach((item) => item.classList.toggle("is-active", item.dataset.requestSummary === summaryFilter));
    $("clearRequestSummaryFilter").hidden = !summaryFilter;
    renderRegister();
  }));
  $("clearRequestSummaryFilter").addEventListener("click", () => { summaryFilter = ""; document.querySelectorAll("[data-request-summary]").forEach((item) => item.classList.remove("is-active")); $("clearRequestSummaryFilter").hidden = true; renderRegister(); });
  document.addEventListener("click", (event) => { const button = event.target.closest("[data-open-request]"); if (!button) return; const request = requests.find((item) => item.id === button.dataset.openRequest); if (request) openRequestDrawer(request); });
  $("requestDrawerClose").addEventListener("click", closeRequestDrawer);
  $("requestDrawerBackdrop").addEventListener("click", closeRequestDrawer);
  $("requestDrawerActions").addEventListener("click", (event) => { const button = event.target.closest("[data-drawer-action]"); if (!button || !selectedRequest) return; if (button.dataset.drawerAction === "edit") { const request = selectedRequest; closeRequestDrawer(); openRequestDialog(request); } else if (button.dataset.drawerAction === "cancel") cancelRequest(selectedRequest); });
  $("requestDrawerBody").addEventListener("click", (event) => {
    const review = event.target.closest("[data-item-action-button]");
    if (review && selectedRequest) { reviewItem(selectedRequest, review.dataset.itemId, review.dataset.itemActionButton); return; }
    const convert = event.target.closest("[data-convert-item]");
    if (convert && selectedRequest) { const select = $("requestDrawerBody").querySelector(`[data-allocation-asset="${CSS.escape(convert.dataset.itemId)}"]`); convertItem(selectedRequest, convert.dataset.itemId, convert.dataset.convertItem, select?.value || ""); }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && $("requestDrawer").classList.contains("is-open")) closeRequestDrawer(); });
}

async function initialise(nextProfile) {
  profile = nextProfile;
  organisationId = profile?.organisationId || null;
  initialisePlantShell({ activePage: "requests", workspaceName: "Fleet & Transport Control" });
  bindEvents();
  if (!organisationId) {
    sourceStates = { projects: "UNAVAILABLE", assets: "UNAVAILABLE", requests: "UNAVAILABLE" };
    setTruthState("Unavailable: organisation context is missing.");
    renderTruthLoading();
    return;
  }
  await loadData();
}

function waitForWorkspace() {
  if (window.NORMEX_CURRENT_USER) initialise(window.NORMEX_CURRENT_USER);
  else window.addEventListener("normex:workspace-ready", (event) => initialise(event.detail.profile), { once: true });
}

waitForWorkspace();
