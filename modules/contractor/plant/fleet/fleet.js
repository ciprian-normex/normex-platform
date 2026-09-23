import { calendarDay, calculateHire, selectHire, isHireOwnership as sharedHireOwnership, weeklyHireRate as sharedWeeklyRate, validHireRate } from "../shared/plant-hire.js";
import {
  auth,
  db
} from "/js/firebase.js";

import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  PLANT_TYPES,
  PLANT_OWNERSHIP_TYPES,
  PLANT_STATUSES,
  getPlantPrefix,
  getPlantTypeLabel,
  getPlantOwnershipLabel,
  getPlantStatusLabel
} from "/modules/contractor/plant/shared/plant-catalogue.js";

import {
  initialisePlantShell
} from "/modules/contractor/plant/shared/plant-shell.js";


/* =========================================================
   STATE
========================================================= */

let currentProfile =
  null;

let organisationId =
  null;


let canViewPlant =
  false;

let canRequestPlant =
  false;

let canManagePlant =
  false;

let canViewPlantCosts =
  false;


let plantAssets =
  [];

let hireRecords =
  [];

let hireSelectionByAsset = new Map();
let hireReadComplete = false;
let assetReadComplete = false;


let stagedAttachments =
  [];

let stagedDocuments = [];

function omitUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

const omit = omitUndefined;


/* =========================================================
   BASIC HELPERS
========================================================= */

function getElement(
  id
) {

  return document.getElementById(
    id
  );

}


function cleanString(
  value
) {

  return String(
    value ??
    ""
  ).trim();

}


function nullableString(
  value
) {

  const cleaned =
    cleanString(
      value
    );


  return cleaned ||
    null;

}


function nullableNumber(
  value
) {

  const cleaned =
    cleanString(
      value
    );


  if (
    !cleaned
  ) {

    return null;

  }


  const number =
    Number(
      cleaned
    );


  return Number.isFinite(
    number
  )
    ? number
    : null;

}


function escapeHtml(
  value
) {

  return String(
    value ??
    ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


function currentUid() {

  return (
    auth.currentUser?.uid ||
    currentProfile?.uid ||
    null
  );

}


function currentUserName() {

  return (
    currentProfile?.displayName ||
    auth.currentUser?.displayName ||
    currentProfile?.email ||
    auth.currentUser?.email ||
    "NORMEX User"
  );

}


function isHireOwnership(ownershipType) {
  return sharedHireOwnership(ownershipType);
}


function isActiveAsset(
  asset
) {

  return (
    asset?.active !==
      false

    &&

    asset?.status !==
      "INACTIVE"
  );

}


function isOffRoad(
  asset
) {

  return (

    asset?.safeToUse ===
      false

    ||

    asset?.offRoad ===
      true

    ||

    asset?.complianceHold ===
      true

    ||

    [
      "OFF_ROAD",
      "COMPLIANCE_HOLD"
    ].includes(
      asset?.status
    )

  );

}


function isIdleHiredAsset(
  asset
) {

  if (
    !isHireOwnership(
      asset?.ownershipType
    )
  ) {

    return false;

  }


  if (
    isOffRoad(
      asset
    )
  ) {

    return false;

  }


  return (

    [
      "AVAILABLE"
    ].includes(
      asset?.status
    )

    &&

    !cleanString(
      asset?.currentProjectId
    )

    &&

    !cleanString(
      asset?.currentProjectName
    )

  );

}


/* =========================================================
   CURRENCY / DATES
========================================================= */

function formatCurrency(
  value
) {
  if (value == null || value === "") return "Unknown";
  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "—";

  }


  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      maximumFractionDigits:
        0
    }
  ).format(
    number
  );

}


function formatDate(
  value
) {

  if (
    !value
  ) {

    return "—";

  }


  let date =
    null;


  if (
    typeof value?.toDate ===
      "function"
  ) {

    date =
      value.toDate();

  } else {

    date =
      new Date(
        value
      );

  }


  if (
    !date

    ||

    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric"
    }
  ).format(
    date
  );

}


function parseDate(
  value
) {

  if (
    !value
  ) {

    return null;

  }


  if (
    typeof value?.toDate ===
      "function"
  ) {

    return value.toDate();

  }


  const date =
    new Date(
      value
    );


  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;

}


function dateDiffInDays(
  start,
  end
) {

  const startDate =
    parseDate(
      start
    );


  const endDate =
    parseDate(
      end
    );


  if (
    !startDate ||
    !endDate
  ) {

    return null;

  }


  const startDay =
    new Date(
      startDate
    );


  const endDay =
    new Date(
      endDate
    );


  startDay.setHours(
    0,
    0,
    0,
    0
  );


  endDay.setHours(
    0,
    0,
    0,
    0
  );


  return Math.floor(
    (
      endDay -
      startDay
    )
    /
    86400000
  );

}


/* =========================================================
   HIRE CALCULATIONS
========================================================= */

function weeklyEquivalent(rate, unit) {
  return sharedWeeklyRate(rate, unit);
}


function estimatedHireExposure(record) {
  return calculateHire(record).estimatedCost;
}


function normaliseText(
  value
) {

  return cleanString(
    value
  ).toLowerCase();

}


/* =========================================================
   WORKSPACE START
========================================================= */

function waitForWorkspace() {

  if (
    window.NORMEX_CURRENT_USER
  ) {

    initialiseFleet(
      window.NORMEX_CURRENT_USER
    );

    return;

  }


  window.addEventListener(
    "normex:workspace-ready",
    (
      event
    ) => {

      initialiseFleet(
        event.detail.profile
      );

    },
    {
      once:
        true
    }
  );

}


async function initialiseFleet(
  profile
) {

  currentProfile =
    profile;


  organisationId =
    currentProfile?.organisationId ||
    null;


  if (
    !organisationId
  ) {

    getElement("fleetLoadStatus").textContent = "Unavailable: organisation context is missing.";
    getElement("fleetRegister").setAttribute("aria-busy", "false");

    return;

  }


  resolveAccess();


  initialisePlantShell({
    activePage:
      "fleet",

    workspaceName:
      "Fleet & Transport Control"
  });


  renderStaticOptions();

  applyAccessControl();

  bindEvents();


  initialiseRegisterFilters();
  openRequestedPlantAction();

  await loadFleetData();

}


/* =========================================================
   ACCESS
========================================================= */

function resolveAccess() {

  const level =
    Number(
      currentProfile?.accessLevel ??
      0
    );


  const permissions =
    currentProfile?.permissions ||
    {};


  const roleCode =
    cleanString(
      currentProfile?.roleCode ||
      currentProfile?.role
    );


  const platformAdmin =
    level >=
      99;


  canViewPlant = (

    platformAdmin

    ||

    permissions.canViewPlant ===
      true

    ||

    permissions.canManagePlant ===
      true

    ||

    permissions.canManageTransport ===
      true

    ||

    level >=
      1

  );


  canRequestPlant = (

    platformAdmin

    ||

    permissions.canRequestPlant ===
      true

    ||

    permissions.canManagePlant ===
      true

    ||

    permissions.canManageTransport ===
      true

    ||

    level >=
      2

  );


  canManagePlant = (

    platformAdmin

    ||

    permissions.canManagePlant ===
      true

    ||

    permissions.canManageTransport ===
      true

    ||

    permissions.canManageOrganisation ===
      true

    ||

    roleCode ===
      "PLANT_TRANSPORT_MANAGER"

    ||

    roleCode ===
      "ORGANISATION_MANAGER"

  );


  canViewPlantCosts = (

    platformAdmin

    ||

    permissions.canViewCommercial ===
      true

    ||

    permissions.canManageCommercial ===
      true

    ||

    permissions.canManagePlant ===
      true

    ||

    permissions.canManageTransport ===
      true

    ||

    permissions.canManageOrganisation ===
      true

    ||

    roleCode ===
      "PLANT_TRANSPORT_MANAGER"

    ||

    roleCode ===
      "ORGANISATION_MANAGER"

  );

}


/* =========================================================
   ACCESS UI
========================================================= */

function applyAccessControl() {

  const addPlantButton =
    getElement(
      "addPlantButton"
    );


  const requestPlantButton =
    getElement(
      "requestPlantButton"
    );


  const hireControlButton =
    getElement(
      "hireControlButton"
    );


  const financialPositionSection =
    getElement(
      "financialPositionSection"
    );


  const fleetAccessLabel =
    getElement(
      "fleetAccessLabel"
    );


  if (
    addPlantButton
  ) {

    addPlantButton.hidden =
      !canManagePlant;

  }


  if (
    requestPlantButton
  ) {

    requestPlantButton.hidden =
      !canRequestPlant;

  }


  if (
    hireControlButton
  ) {

    hireControlButton.hidden =
      !(
        canManagePlant ||
        canViewPlantCosts
      );

  }


  if (
    financialPositionSection
  ) {

    financialPositionSection.hidden =
      !canViewPlantCosts;

  }


  if (
    fleetAccessLabel
  ) {

    fleetAccessLabel.classList.toggle(
      "can-manage",
      canManagePlant
    );


    fleetAccessLabel.textContent =
      canManagePlant
        ? "Plant management"
        : canRequestPlant
          ? "View + request"
          : "Read only";

  }

}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadFleetData() {

  if (
    !canViewPlant
  ) {

    plantAssets =
      [];


    hireRecords =
      [];


    rebuildHireLookup();

    renderEverything();

    return;

  }


  fleetAssetState = "Loading"; fleetHireState = canViewPlantCosts ? "Loading" : "Restricted";
  assetReadComplete = false; hireReadComplete = false;
  plantAssets = []; hireRecords = [];
  renderEverything();
  await Promise.all([
    loadPlantAssets(),
    loadHireRecords()
  ]);


  rebuildHireLookup();

  renderEverything();

}


async function loadPlantAssets() {

  assetReadComplete = false;
  try {

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "plantAssets"
          ),

          where(
            "organisationId",
            "==",
            organisationId
          )
        )
      );


    plantAssets =
      snapshot.docs
        .map(
          (
            item
          ) => ({

            id:
              item.id,

            ...item.data()

          })
        )
        .sort(
          (
            a,
            b
          ) =>
            cleanString(
              a.plantReference
            ).localeCompare(
              cleanString(
                b.plantReference
              )
            )
        );


    assetReadComplete = snapshot.metadata?.fromCache !== true;
    fleetAssetState = assetReadComplete ? "Loaded" : "Partial";
  } catch (
    error
  ) {

    fleetAssetState = fleetReadError(error);


    plantAssets =
      [];

  }

}


async function loadHireRecords() {

  hireReadComplete = false;
  hireRecords = [];
  if (!canViewPlantCosts) return;
  try {

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "plantHireRecords"
          ),

          where(
            "organisationId",
            "==",
            organisationId
          )
        )
      );


    hireRecords =
      snapshot.docs.map(
        (
          item
        ) => ({

          id:
            item.id,

          ...item.data()

        })
      );


    hireReadComplete = snapshot.metadata?.fromCache !== true;
    fleetHireState = hireReadComplete ? "Loaded" : "Partial";
  } catch (
    error
  ) {

    fleetHireState = fleetReadError(error);


    hireRecords =
      [];

  }

}


function fleetReadError(error) { return String(error?.code).includes("permission-denied") ? "Restricted" : /unavailable|deadline-exceeded/.test(String(error?.code)) ? "Unavailable" : "Error"; }

function rebuildHireLookup() {
  hireSelectionByAsset = new Map(plantAssets.map(asset => [asset.id, selectHire(asset, hireRecords, { complete: hireReadComplete })]));
}





function getHireRecordForAsset(asset) {
  return hireSelectionByAsset.get(asset?.id)?.record || null;
}


/* =========================================================
   STATIC OPTIONS
========================================================= */

function renderStaticOptions() {

  const plantType =
    getElement(
      "plantType"
    );


  const typeFilter =
    getElement(
      "fleetTypeFilter"
    );


  const ownership =
    getElement(
      "plantOwnershipType"
    );


  const statusFilter =
    getElement(
      "fleetStatusFilter"
    );


  const typeOptions =
    PLANT_TYPES
      .map(
        (
          item
        ) => `

          <option
            value="${escapeHtml(
              item.code
            )}"
          >
            ${escapeHtml(
              item.label
            )}
          </option>

        `
      )
      .join("");


  if (
    plantType
  ) {

    plantType.innerHTML = `

      <option value="">
        Select Plant Type
      </option>

      ${typeOptions}

    `;

  }


  if (
    typeFilter
  ) {

    typeFilter.innerHTML = `

      <option value="">
        All Plant Types
      </option>

      ${typeOptions}

    `;

  }


  if (
    ownership
  ) {

    ownership.innerHTML = `

      <option value="">
        Select Ownership
      </option>

      ${PLANT_OWNERSHIP_TYPES
        .map(
          (
            item
          ) => `

            <option
              value="${escapeHtml(
                item.code
              )}"
            >
              ${escapeHtml(
                item.label
              )}
            </option>

          `
        )
        .join("")}

    `;

  }


  if (
    statusFilter
  ) {

    statusFilter.innerHTML = `

      <option value="">
        All Statuses
      </option>

      ${PLANT_STATUSES
        .map(
          (
            item
          ) => `

            <option
              value="${escapeHtml(
                item.code
              )}"
            >
              ${escapeHtml(
                item.label
              )}
            </option>

          `
        )
        .join("")}

    `;

  }

}

/* =========================================================
   MASTER RENDER
========================================================= */

function renderEverything() {
  const select = getElement("fleetProjectFilter");
  const selected = select?.value || "";
  const projects = new Map(plantAssets.filter(isActiveAsset).filter(asset => asset.currentProjectId).map(asset => [asset.currentProjectId, asset.currentProjectName || asset.currentProjectId]));
  if (select) {
    select.innerHTML = '<option value="">All projects</option><option value="__UNASSIGNED">No recorded project</option>' + [...projects].sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("");
    if (selected && !["__UNASSIGNED", ...projects.keys()].includes(selected)) select.add(new Option("Requested project (no loaded match)", selected));
    select.value = selected;
  }
  applyFleetFilters();
}

const fleetFilterIds = { search: "fleetSearchInput", ownership: "fleetOwnershipFilter", type: "fleetTypeFilter", status: "fleetStatusFilter", project: "fleetProjectFilter", attention: "fleetAttentionFilter" };
let fleetPage = 0;
let fleetQuickFilter = "";
let fleetSortDescending = false;
const fleetPageSize = 25;
let fleetAssetState = "Loading";
let fleetHireState = "Loading";

function recordedAssigned(asset) {
  return Boolean(cleanString(asset.currentProjectId) || cleanString(asset.currentProjectName));
}
function recordedAvailable(asset) {
  return asset.status === "AVAILABLE" && !isOffRoad(asset) && !recordedAssigned(asset);
}
function fleetAttention(asset) {
  const flags = [];
  const hire = canViewPlantCosts ? getHireRecordForAsset(asset) : null;
  let label = "No recorded signal", rank = 9, tone = "neutral";
  const add = (flag, text, priority, colour) => { flags.push(flag); if (priority < rank) { label = text; rank = priority; tone = colour; } };
  if (isOffRoad(asset)) add("OFF_ROAD", "Off road / hold", 0, "danger");
  if (asset.status === "MAINTENANCE") add("MAINTENANCE", "Maintenance recorded", 2, "warning");
  if (!PLANT_STATUSES.some(item => item.code === asset.status)) add("STATE", "State needs review", 3, "information");
  if (canViewPlantCosts && isHireOwnership(asset.ownershipType)) {
    const selection = hireSelectionByAsset.get(asset.id);
    if (selection?.state !== "SELECTED" || calculateHire(hire).state !== "KNOWN") add("HIRE_UNKNOWN", "Hire needs review", 3, "information");
    if (hire && !hire.offHireConfirmedDate && ["ACTIVE", "OFF_HIRE_REQUESTED"].includes(hire.status)) {
      const due = calendarDay(hire.expectedOffHireDate), today = calendarDay(new Date());
      if (due !== null && due <= today + 14) add("OFF_HIRE", due < today ? "Off-hire overdue" : "Off-hire due soon", due < today ? 1 : 2, "warning");
    }
  }
  const locationDay = calendarDay(asset.currentLocationConfirmedAt);
  if (!asset.currentLocationLabel || locationDay === null || locationDay > calendarDay(new Date())) add("LOCATION", "Location unconfirmed", 4, "information");
  if (isIdleHiredAsset(asset) && (!hire || !hire.offHireConfirmedDate)) add("IDLE", "Hired / recorded unassigned", 5, "information");
  if (!flags.length) flags.push("NONE");
  return { flags, label, rank, tone };
}
function renderFleetMetrics() {
  const active = plantAssets.filter(isActiveAsset);
  const metrics = [["TOTAL", "Total", active.length], ["ASSIGNED", "Assigned", active.filter(recordedAssigned).length], ["AVAILABLE", "Available", active.filter(recordedAvailable).length], ["HIRED", "Hired / leased", active.filter(asset => isHireOwnership(asset.ownershipType)).length], ["OFF_ROAD", "Off road / hold", active.filter(isOffRoad).length]];
  getElement("fleetMetrics").innerHTML = metrics.map(([key, label, count]) => `<button type="button" data-fleet-quick="${key}" aria-pressed="${fleetQuickFilter === key}" ${!canViewPlant ? "disabled" : ""}><span>${label}</span><strong>${assetReadComplete ? count : "--"}</strong><small>${key === "TOTAL" ? "Active assets" : key === "ASSIGNED" ? "Recorded project" : key === "AVAILABLE" ? "Readiness not assessed" : "Filter register"}</small></button>`).join("");
}
function initialiseRegisterFilters() {
  const params = new URLSearchParams(window.location.search);
  const allow = {
    ownership: ["HIRED", "OWNED", "LEASED", "CROSS_HIRED", "OTHER"],
    type: PLANT_TYPES.map(item => item.code),
    status: PLANT_STATUSES.map(item => item.code),
    attention: ["OFF_ROAD", "OFF_HIRE", "LOCATION", "IDLE", "HIRE_UNKNOWN", "NONE", "MAINTENANCE"]
  };
  for (const [key, values] of Object.entries(allow)) {
    const value = params.get(key);
    if (values.includes(value) && !(!canViewPlantCosts && key === "attention" && ["OFF_HIRE", "HIRE_UNKNOWN"].includes(value))) getElement(fleetFilterIds[key]).value = value;
  }
  const project = params.get("project");
  if (project && project.length < 200) { getElement("fleetProjectFilter").add(new Option("Requested project", project)); getElement("fleetProjectFilter").value = project; }
  if (!canViewPlantCosts) {
    for (const value of ["OFF_HIRE", "HIRE_UNKNOWN"]) getElement("fleetAttentionFilter").querySelector(`option[value="${value}"]`)?.remove();
    getElement("fleetSort").querySelector('option[value="offhire"]')?.remove();
  }
}
function applyFleetFilters() {
  renderFleetMetrics();
  const filters = Object.fromEntries(Object.entries(fleetFilterIds).map(([key, id]) => [key, cleanString(getElement(id)?.value)]));
  const active = plantAssets.filter(asset => filters.status === "INACTIVE" ? !isActiveAsset(asset) : isActiveAsset(asset));
  const ownershipMatches = (asset, ownership) => !ownership || (ownership === "HIRED" ? isHireOwnership(asset.ownershipType) : asset.ownershipType === ownership);
  const statusMatches = (asset, value) => !value || (value === "AVAILABLE" ? recordedAvailable(asset) : value === "OFF_ROAD" ? isOffRoad(asset) : asset.status === value);
  const filtered = active.filter(asset => {
    const hire = canViewPlantCosts ? getHireRecordForAsset(asset) : null;
    const search = [asset.id, asset.plantId, asset.plantReference, asset.manufacturer, asset.model, asset.serialNumber, asset.registrationNumber, asset.supplierName, hire?.supplierName, asset.currentLocationLabel, asset.currentProjectName].filter(Boolean).join(" ").toLowerCase();
    const quick = !fleetQuickFilter || fleetQuickFilter === "TOTAL" || (fleetQuickFilter === "ASSIGNED" ? recordedAssigned(asset) : fleetQuickFilter === "HIRED" ? isHireOwnership(asset.ownershipType) : statusMatches(asset, fleetQuickFilter));
    return quick && search.includes(filters.search.toLowerCase()) && ownershipMatches(asset, filters.ownership) && (!filters.type || asset.plantType === filters.type) && statusMatches(asset, filters.status) && (!filters.project || (filters.project === "__UNASSIGNED" ? !recordedAssigned(asset) : asset.currentProjectId === filters.project)) && (!filters.attention || fleetAttention(asset).flags.includes(filters.attention));
  });
  const sort = getElement("fleetSort")?.value || "attention";
  const id = asset => asset.plantReference || asset.plantId || asset.id;
  const value = asset => ({ id: id(asset), type: getPlantTypeLabel(asset.plantType), ownership: asset.ownershipType || "", status: isOffRoad(asset) ? "OFF_ROAD" : asset.status || "", project: asset.currentProjectName || asset.currentProjectId || "", attention: fleetAttention(asset).rank, offhire: canViewPlantCosts ? calendarDay(getHireRecordForAsset(asset)?.expectedOffHireDate) : null })[sort];
  filtered.sort((a, b) => {
    const av = value(a), bv = value(b);
    if (av == null || bv == null) return av == null && bv == null ? String(id(a)).localeCompare(String(id(b)), "en-GB", { numeric: true }) : av == null ? 1 : -1;
    const result = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv), "en-GB", { numeric: true });
    return (fleetSortDescending ? -result : result) || String(id(a)).localeCompare(String(id(b)), "en-GB", { numeric: true });
  });
  getElement("fleetLoadStatus").textContent = !canViewPlant ? "Restricted: Plant access is required." : fleetAssetState === "Loading" ? "Loading Fleet..." : ["Unavailable", "Restricted", "Error"].includes(fleetAssetState) ? `${fleetAssetState}: Fleet could not be loaded.` : `${assetReadComplete ? "Current Fleet records loaded" : "Partial data: cached records only; organisation totals withheld"}${canViewPlantCosts && !hireReadComplete ? ` | Hire information: ${fleetHireState}` : !canViewPlantCosts ? " | Financial information: Restricted" : ""}`;
  const chips = Object.entries(filters).filter(([, val]) => val).map(([key, val]) => {
    const el = getElement(fleetFilterIds[key]);
    const text = key === "search" ? val : el.selectedOptions[0]?.textContent || val;
    return `<button type="button" data-clear-filter="${key}" aria-label="Remove ${escapeHtml(key)} filter">${escapeHtml(text)} &times;</button>`;
  });
  if (fleetQuickFilter) chips.unshift(`<button type="button" data-clear-filter="quick">${escapeHtml(fleetQuickFilter.replaceAll("_", " "))} &times;</button>`);
  getElement("fleetFilterChips").innerHTML = chips.join("");
  getElement("fleetSortDirection").textContent = fleetSortDescending ? "Descending" : "Ascending";
  renderFleetRegister(filtered);
}
function renderFleetRegister(records) {
  const root = getElement("fleetRegister");
  root.setAttribute("aria-busy", String(canViewPlant && fleetAssetState === "Loading"));
  const pages = Math.max(1, Math.ceil(records.length / fleetPageSize));
  fleetPage = Math.min(fleetPage, pages - 1);
  getElement("fleetPagination").innerHTML = records.length ? `<button type="button" data-page="-1" ${fleetPage === 0 ? "disabled" : ""}>Previous</button><span>Page ${fleetPage + 1} of ${pages}</span><button type="button" data-page="1" ${fleetPage + 1 === pages ? "disabled" : ""}>Next</button>` : "";
  getElement("fleetRegisterCount").textContent = !canViewPlant || ["Loading", "Unavailable", "Restricted", "Error"].includes(fleetAssetState) ? "" : `${records.length ? fleetPage * fleetPageSize + 1 : 0}-${Math.min((fleetPage + 1) * fleetPageSize, records.length)} of ${records.length} matching loaded assets${!assetReadComplete ? " (partial data)" : ""}`;
  if (!canViewPlant || ["Loading", "Unavailable", "Restricted", "Error"].includes(fleetAssetState)) { root.innerHTML = emptyState(!canViewPlant ? "Restricted" : fleetAssetState === "Loading" ? "Loading Plant records..." : `${fleetAssetState}: refresh to retry.`); return; }
  if (!records.length) { root.innerHTML = emptyState(!assetReadComplete ? "Partial data: no matches in cached records. Complete Fleet position is unavailable." : plantAssets.filter(isActiveAsset).length ? "No filter matches. Clear filters to see loaded Fleet records." : "No active assets recorded. Add Plant to start the organisation register."); return; }
  const columns = ["Plant ID", "Plant", "Ownership", "Status", "Current project", "Current location", "Supplier", "Expected off-hire", ...(canViewPlantCosts ? ["Hire rate"] : []), "Attention", "Action"];
  root.innerHTML = `<table class="fleet-master-table"><thead><tr>${columns.map(label => `<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${records.slice(fleetPage * fleetPageSize, (fleetPage + 1) * fleetPageSize).map(asset => {
    const hire = canViewPlantCosts ? getHireRecordForAsset(asset) : null;
    const hired = isHireOwnership(asset.ownershipType);
    const signal = fleetAttention(asset);
    const cells = [escapeHtml(asset.plantReference || asset.plantId || asset.id), `${escapeHtml(assetDisplayName(asset))}<small>${escapeHtml(getPlantTypeLabel(asset.plantType))}</small>`, escapeHtml(getPlantOwnershipLabel(asset.ownershipType) || "Unknown"), `<span class="fleet-register-signal ${isOffRoad(asset) ? "danger" : "neutral"}">${escapeHtml(isOffRoad(asset) ? "Off road / hold" : asset.status ? getPlantStatusLabel(asset.status) : "Unknown")}</span>`, escapeHtml(asset.currentProjectName || asset.currentProjectId || "Not recorded"), escapeHtml(asset.currentLocationLabel || "Not confirmed"), escapeHtml(asset.supplierName || hire?.supplierName || "Not recorded"), !hired ? "Not applicable" : !canViewPlantCosts ? "Restricted" : hire?.offHireConfirmedDate ? "Off-hire confirmed" : calendarDay(hire?.expectedOffHireDate) === null ? "Unknown" : escapeHtml(formatDate(hire.expectedOffHireDate)), ...(canViewPlantCosts ? [hired ? escapeHtml(formatHireRate(hire)) : "Not applicable"] : []), `<span class="fleet-register-signal ${signal.tone}">${escapeHtml(signal.label)}</span>`, `<a href="${assetUrl(asset)}">Open Asset &rarr;</a>`];
    const details = [2, 5, 6, 7, ...(canViewPlantCosts ? [8] : [])].map(index => '<div><dt>' + columns[index] + '</dt><dd>' + cells[index] + '</dd></div>').join('');
    cells[cells.length - 1] += '<details class="fleet-row-details"><summary>More details</summary><dl>' + details + '</dl></details>';
    return `<tr>${cells.map((cell, i) => `<td data-label="${columns[i]}"><div>${cell}</div></td>`).join("")}</tr>`;
  }).join("")}</tbody></table>`;
}
function clearFilters() {
  Object.values(fleetFilterIds).forEach(id => { getElement(id).value = ""; });
  fleetQuickFilter = ""; fleetPage = 0; fleetSortDescending = false;
  getElement("fleetSort").value = "attention";
  applyFleetFilters();
}
function bindRegisterEvents() {
  for (const [key, id] of Object.entries(fleetFilterIds)) getElement(id).addEventListener(key === "search" ? "input" : "change", () => { fleetPage = 0; applyFleetFilters(); });
  getElement("fleetSort").addEventListener("change", () => { fleetPage = 0; applyFleetFilters(); });
  getElement("clearFleetFilters").addEventListener("click", clearFilters);
  getElement("fleetSortDirection").addEventListener("click", () => { fleetSortDescending = !fleetSortDescending; fleetPage = 0; applyFleetFilters(); });
  getElement("fleetWorkspace").addEventListener("click", event => {
    const button = event.target.closest("button[data-fleet-quick], button[data-clear-filter], button[data-page]");
    if (!button) return;
    if (button.dataset.fleetQuick) { fleetQuickFilter = fleetQuickFilter === button.dataset.fleetQuick || button.dataset.fleetQuick === "TOTAL" ? "" : button.dataset.fleetQuick; fleetPage = 0; }
    if (button.dataset.clearFilter) { if (button.dataset.clearFilter === "quick") fleetQuickFilter = ""; else getElement(fleetFilterIds[button.dataset.clearFilter]).value = ""; fleetPage = 0; }
    if (button.dataset.page) fleetPage = Math.max(0, fleetPage + Number(button.dataset.page));
    applyFleetFilters();
    if (button.dataset.page) getElement("fleetRegister").scrollIntoView({ block: "start" });
  });
}

function renderFinancialMetrics() {

  const root =
    getElement(
      "financialMetrics"
    );


  if (
    !root

    ||

    !canViewPlantCosts
  ) {

    return;

  }


  const activeAssets =
    plantAssets.filter(
      isActiveAsset
    );


  const hiredAssets =
    activeAssets.filter(
      (
        asset
      ) =>
        isHireOwnership(
          asset.ownershipType
        )
    );


  const selections = hiredAssets.map(asset => hireSelectionByAsset.get(asset.id));
  const unknownSelection = !assetReadComplete || !hireReadComplete || selections.some(item => !item?.record || (calculateHire(item.record).state !== "KNOWN") || (!item.record.offHireConfirmedDate && !["ACTIVE", "OFF_HIRE_REQUESTED"].includes(cleanString(item.record.status).toUpperCase())));
  if (unknownSelection) {
    const ambiguous = selections.some(item => item?.state === "AMBIGUOUS");
    root.innerHTML = emptyState(ambiguous ? "Multiple active hire records require review. Hire totals are unknown." : "Hire information incomplete or invalid. Hire totals are unknown.");
    return;
  }

  const activeHireRecords =
    hiredAssets
      .map(
        (
          asset
        ) => ({

          asset,

          hire:
            getHireRecordForAsset(
              asset
            )

        })
      )
      .filter(
        ({
          hire
        }) =>
          hire && !hire.offHireConfirmedDate && [
            "ACTIVE",
            "OFF_HIRE_REQUESTED"
          ].includes(
            cleanString(
              hire.status
            ).toUpperCase()
          )
      );


  const weeklyCommitment =
    activeHireRecords.reduce(
      (
        sum,
        {
          hire
        }
      ) =>
        sum +
        weeklyEquivalent(
          hire.hireRate,
          hire.hireRateUnit
        ),
      0
    );


  const idleHireAssets =
    activeHireRecords.filter(
      ({
        asset
      }) =>
        isIdleHiredAsset(
          asset
        )
    );


  const idleWeeklyExposure =
    idleHireAssets.reduce(
      (
        sum,
        {
          hire
        }
      ) =>
        sum +
        weeklyEquivalent(
          hire.hireRate,
          hire.hireRateUnit
        ),
      0
    );


  const totalExposure =
    activeHireRecords.reduce(
      (
        sum,
        {
          hire
        }
      ) => {

        return (
          sum
          +
          estimatedHireExposure(hire)
        );

      },
      0
    );


  const now =
    new Date();


  const offHireSoon =
    activeHireRecords.filter(
      ({
        hire
      }) => {

        const end =
          parseDate(
            hire.expectedOffHireDate
          );


        if (
          !end
        ) {

          return false;

        }


        const days =
          dateDiffInDays(
            now,
            end
          );


        return (
          days !==
            null

          &&

          days >=
            0

          &&

          days <=
            14
        );

      }
    ).length;


  const cards = [

    {
      label:
        "Active Hire Commitment",

      value:
        formatCurrency(
          weeklyCommitment
        ),

      note:
        "Approximate weekly external plant cost",

      className:
        "is-financial"
    },

    {
      label:
        "Idle Hire Exposure",

      value:
        formatCurrency(
          idleWeeklyExposure
        ),

      note:
        `${idleHireAssets.length} hired asset${
          idleHireAssets.length === 1
            ? ""
            : "s"
        } currently idle`,

      className:
        idleHireAssets.length
          ? "is-watch"
          : "is-financial"
    },

    {
      label:
        "Hire Exposure to Date",

      value:
        formatCurrency(
          totalExposure
        ),

      note:
        "Approximate current exposure across active hires",

      className:
        "is-financial"
    },

    {
      label:
        "Off-Hire in 14 Days",

      value:
        offHireSoon,

      note:
        "Hire periods requiring review soon",

      className:
        offHireSoon
          ? "is-watch"
          : "is-financial"
    },

    {
      label:
        "Active Hire Records",

      value:
        activeHireRecords.length,

      note:
        "Current hired / leased plant commitments",

      className:
        "is-financial"
    }

  ];


  root.innerHTML =
    cards
      .map(
        (
          card
        ) => `

          <article
            class="
              fleet-metric
              ${card.className}
            "
          >

            <span>
              ${escapeHtml(
                card.label
              )}
            </span>

            <strong>
              ${escapeHtml(
                card.value
              )}
            </strong>

            <small>
              ${escapeHtml(
                card.note
              )}
            </small>

          </article>

        `
      )
      .join("");

}


/* =========================================================
   FLEET POSITION
========================================================= */

function assetDisplayName(
  asset
) {

  return [

    asset?.manufacturer,
    asset?.model

  ]
    .filter(
      Boolean
    )
    .join(
      " "
    )

    ||

    getPlantTypeLabel(
      asset?.plantType
    );

}


function assetUrl(
  asset
) {

  return (
    "/modules/contractor/plant/asset/?id="
    +
    encodeURIComponent(
      asset?.id ||
      asset?.plantReference ||
      ""
    )
  );

}


function formatHireRate(hire) {
  if (!hire || validHireRate(hire.hireRate) === null || sharedWeeklyRate(hire.hireRate, hire.hireRateUnit) === null) return "Unknown";
  return formatCurrency(hire.hireRate) + " / " + cleanString(hire.hireRateUnit).toLowerCase();
}


function getAssetSignal(
  asset,
  hire
) {


  if (
    isOffRoad(
      asset
    )
  ) {

    return (
      asset.status ===
        "COMPLIANCE_HOLD"

      ||

      asset.complianceHold ===
        true
    )
      ? "Compliance hold requires action"
      : "Plant is recorded off road";

  }


  const selection = hireSelectionByAsset.get(asset?.id);
  if (canViewPlantCosts && isHireOwnership(asset?.ownershipType) && selection?.state !== "SELECTED") {
    return selection?.reason || "Hire information unknown";
  }

  if (
    isIdleHiredAsset(
      asset
    )
  ) {

    const weekly =
      weeklyEquivalent(
        hire?.hireRate,
        hire?.hireRateUnit
      );


    return (
      canViewPlantCosts

      &&

      weekly >
        0
    )
      ? `Idle hire · approx. ${formatCurrency(
          weekly
        )} / week`
      : "Hired plant recorded idle";

  }


  if (
    asset.status ===
      "DEPLOYED"
  ) {

    return asset.currentProjectName
      ? `In use · ${asset.currentProjectName}`
      : "Deployed · project not recorded";

  }


  if (
    asset.status ===
      "AVAILABLE"
  ) {

    return "Available for allocation";

  }


  return getPlantStatusLabel(
    asset.status ||
    "AVAILABLE"
  );

}


function getStatusClass(
  status
) {

  switch (
    cleanString(
      status
    ).toUpperCase()
  ) {

    case "AVAILABLE":

      return "is-available";


    case "DEPLOYED":

      return "is-deployed";


    case "OFF_ROAD":

    case "COMPLIANCE_HOLD":

      return "is-off-road";


    case "IN_TRANSIT":

    case "AWAITING_TRANSPORT":

      return "is-transit";


    case "MAINTENANCE":

    case "OFF_HIRE_PENDING":

      return "is-watch";


    default:

      return "";

  }

}


function setCount(
  id,
  count
) {

  const element =
    getElement(
      id
    );


  if (
    element
  ) {

    element.textContent =
      `${count} plant`;

  }

}


function emptyState(
  message
) {

  return `

    <div class="fleet-empty">

      <strong>
        No records to show
      </strong>

      <span>
        ${escapeHtml(
          message
        )}
      </span>

    </div>

  `;

}


/* =========================================================
   VIEW SWITCH / FILTERS
========================================================= */

function openAddPlantModal() {

  if (
    !canManagePlant
  ) {

    return;

  }


  stagedAttachments =
    [];

  stagedDocuments = [];


  getElement(
    "addPlantForm"
  )?.reset();


  hideModalMessage();

  renderAttachments();

  renderStagedDocuments();

  updateHireDetails();

  updateReferencePreview();


  const modal =
    getElement(
      "addPlantModal"
    );


  if (
    modal
  ) {

    modal.hidden =
      false;

  }

}


function closeAddPlantModal() {

  const modal =
    getElement(
      "addPlantModal"
    );


  if (
    modal
  ) {

    modal.hidden =
      true;

  }


  stagedAttachments =
    [];

  stagedDocuments = [];

  renderStagedDocuments();


  setSavingState(
    false
  );

}


function updateHireDetails() {

  const ownership =
    cleanString(
      getElement(
        "plantOwnershipType"
      )?.value
    );


  const section =
    getElement(
      "hireDetailsSection"
    );


  if (
    section
  ) {

    section.hidden =
      !isHireOwnership(
        ownership
      );

  }

}


function updateReferencePreview() {

  const code =
    cleanString(
      getElement(
        "plantType"
      )?.value
    );


  const root =
    getElement(
      "plantReferencePreview"
    );


  if (
    !root
  ) {

    return;

  }


  root.textContent =
    code
      ? `${getPlantPrefix(
          code
        )}-XXXX`
      : "Generated when plant is saved";

}


/* =========================================================
   ATTACHMENTS
========================================================= */

function addAttachment() {

  const input =
    getElement(
      "plantAttachmentInput"
    );


  const value =
    cleanString(
      input?.value
    );


  if (
    !value
  ) {

    return;

  }


  const exists =
    stagedAttachments.some(
      (
        item
      ) =>
        item.toLowerCase() ===
          value.toLowerCase()
    );


  if (
    !exists
  ) {

    stagedAttachments.push(
      value
    );

  }


  if (
    input
  ) {

    input.value =
      "";

  }


  renderAttachments();

}


function renderAttachments() {

  const root =
    getElement(
      "plantAttachmentList"
    );


  if (
    !root
  ) {

    return;

  }


  if (
    !stagedAttachments.length
  ) {

    root.innerHTML = `

      <span class="fleet-muted-text">
        No attachments added
      </span>

    `;

    return;

  }


  root.innerHTML =
    stagedAttachments
      .map(
        (
          item,
          index
        ) => `

          <span class="fleet-tag">

            ${escapeHtml(
              item
            )}

            <button
              type="button"
              data-remove-attachment="${index}"
              aria-label="Remove ${escapeHtml(
                item
              )}"
            >
              ×
            </button>

          </span>

        `
      )
      .join("");


  root
    .querySelectorAll(
      "[data-remove-attachment]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            stagedAttachments.splice(
              Number(
                button.dataset.removeAttachment
              ),
              1
            );


            renderAttachments();

          }
        );

      }
    );

}


/* =========================================================
   CREATE CANONICAL PLANT RECORD
========================================================= */

async function createPlant(
  event
) {

  event.preventDefault();


  if (
    !canManagePlant
  ) {

    showModalMessage(
      "You do not have permission to create plant records."
    );

    return;

  }


  hideModalMessage();


  const plantType =
    cleanString(
      getElement(
        "plantType"
      )?.value
    );


  const ownershipType =
    cleanString(
      getElement(
        "plantOwnershipType"
      )?.value
    );


  const supplierName =
    cleanString(
      getElement(
        "plantSupplierName"
      )?.value
    );


  if (
    !plantType

    ||

    !ownershipType
  ) {

    showModalMessage(
      "Plant type and ownership are required."
    );

    return;

  }


  if (
    isHireOwnership(
      ownershipType
    )

    &&

    !supplierName
  ) {

    showModalMessage(
      "Hire supplier is required for hired or leased plant."
    );

    return;

  }


  const prefix =
    getPlantPrefix(
      plantType
    );


  const counterId =
    `${organisationId}_${prefix}`;


  const counterReference =
    doc(
      db,
      "plantCounters",
      counterId
    );


  const existingReferences =
    new Set(
      plantAssets
        .map(
          (
            asset
          ) =>
            cleanString(
              asset.plantReference
            )
        )
        .filter(
          Boolean
        )
    );


  setSavingState(
    true
  );


  try {

    let allocatedPlantReference =
      null;


    await runTransaction(
      db,
      async (
        transaction
      ) => {

        const counterSnapshot =
          await transaction.get(
            counterReference
          );


        let nextNumber =
          counterSnapshot.exists()
            ? Number(
                counterSnapshot.data()
                  .nextNumber
              )
            : 1;


        if (
          !Number.isInteger(
            nextNumber
          )

          ||

          nextNumber <
            1
        ) {

          nextNumber =
            1;

        }


        let plantDocumentReference =
          null;


        let candidateSnapshot =
          null;


        for (
          let attempts =
            0;

          attempts <
            100;

          attempts +=
            1
        ) {

          allocatedPlantReference =
            `${prefix}-${String(
              nextNumber
            ).padStart(
              4,
              "0"
            )}`;


          plantDocumentReference =
            doc(
              db,
              "plantAssets",
              allocatedPlantReference
            );


          candidateSnapshot =
            await transaction.get(
              plantDocumentReference
            );


          if (
            !candidateSnapshot.exists()

            &&

            !existingReferences.has(
              allocatedPlantReference
            )
          ) {

            break;

          }


          nextNumber +=
            1;

        }


        if (
          !allocatedPlantReference

          ||

          !plantDocumentReference

          ||

          candidateSnapshot?.exists()
        ) {

          throw new Error(
            "NORMEX could not allocate a unique Plant ID."
          );

        }


        const hireDocumentReference =
          isHireOwnership(
            ownershipType
          )

            ? doc(
                db,
                "plantHireRecords",
                `HIRE-${allocatedPlantReference}-001`
              )

            : null;


        if (
          hireDocumentReference
        ) {

          const existingHire =
            await transaction.get(
              hireDocumentReference
            );


          if (
            existingHire.exists()
          ) {

            throw new Error(
              "The first hire record for this Plant ID already exists."
            );

          }

        }


        transaction.set(
          counterReference,
          {

            organisationId,

            prefix,

            nextNumber:
              nextNumber +
              1,

            updatedByUid:
              currentUid(),

            updatedAt:
              serverTimestamp()

          },
          {
            merge:
              false
          }
        );


        const initialStatus =
          cleanString(
            getElement(
              "plantInitialStatus"
            )?.value
          )
          ||
          "AVAILABLE";


        const currentLocationLabel =
          nullableString(
            getElement(
              "plantCurrentLocation"
            )?.value
          );


        transaction.set(
          plantDocumentReference,
          {

            organisationId,

            plantId:
              allocatedPlantReference,

            plantReference:
              allocatedPlantReference,

            plantType,

            ownershipType,


            manufacturer:
              nullableString(
                getElement(
                  "plantManufacturer"
                )?.value
              ),

            model:
              nullableString(
                getElement(
                  "plantModel"
                )?.value
              ),

            serialNumber:
              nullableString(
                getElement(
                  "plantSerialNumber"
                )?.value
              ),

            registrationNumber:
              nullableString(
                getElement(
                  "plantRegistrationNumber"
                )?.value
              ),

            year:
              nullableNumber(
                getElement(
                  "plantYear"
                )?.value
              ),

            fuelType:
              nullableString(
                getElement(
                  "plantFuelType"
                )?.value
              ),

            motExpiry:
              nullableString(
                getElement("plantMotExpiry")?.value
              ),

            assignedToName:
              nullableString(
                getElement("plantAssignedToName")?.value
              ),

            lastServiceDate:
              nullableString(
                getElement("plantLastServiceDate")?.value
              ),

            lastServiceMileage:
              nullableNumber(
                getElement("plantLastServiceMileage")?.value
              ),

            currentMileage:
              nullableNumber(
                getElement("plantCurrentMileage")?.value
              ),

            operatingWeight:
              nullableString(
                getElement(
                  "plantOperatingWeight"
                )?.value
              ),

            capacity:
              nullableString(
                getElement(
                  "plantCapacity"
                )?.value
              ),

            specification:
              nullableString(
                getElement(
                  "plantSpecification"
                )?.value
              ),

            attachments:
              [
                ...stagedAttachments
              ],


            supplierName:
              isHireOwnership(
                ownershipType
              )
                ? supplierName
                : null,

            supplierPlantReference:
              isHireOwnership(
                ownershipType
              )
                ? nullableString(
                    getElement(
                      "plantSupplierReference"
                    )?.value
                  )
                : null,


            currentHireRecordId:
              hireDocumentReference?.id ||
              null,

            currentProjectId:
              null,

            currentProjectName:
              null,

            currentLocationLabel,

            currentLocationConfirmedAt:
              currentLocationLabel
                ? serverTimestamp()
                : null,

            currentLocationConfirmedByUid:
              currentLocationLabel
                ? currentUid()
                : null,


            status:
              initialStatus,

            safeToUse:
              initialStatus !==
                "OFF_ROAD",

            offRoad:
              initialStatus ===
                "OFF_ROAD",

            complianceHold:
              false,

            complianceLabel:
              "Compliance not assessed",

            lastInspectionLabel:
              null,


            notes:
              nullableString(
                getElement(
                  "plantNotes"
                )?.value
              ),

            active:
              true,


            createdByUid:
              currentUid(),

            createdByName:
              currentUserName(),

            createdAt:
              serverTimestamp(),

            updatedByUid:
              currentUid(),

            updatedAt:
              serverTimestamp()

          }
        );


        if (
          hireDocumentReference
        ) {

          transaction.set(
            hireDocumentReference,
            {

              organisationId,

              plantId:
                allocatedPlantReference,

              plantReference:
                allocatedPlantReference,

              ownershipType,


              supplierName,

              supplierPlantReference:
                nullableString(
                  getElement(
                    "plantSupplierReference"
                  )?.value
                ),


              hireStartDate:
                nullableString(
                  getElement(
                    "plantHireStart"
                  )?.value
                ),

              expectedOffHireDate:
                nullableString(
                  getElement(
                    "plantExpectedOffHire"
                  )?.value
                ),

              offHireRequestedDate:
                null,

              offHireConfirmedDate:
                null,


              hireRate:
                nullableNumber(
                  getElement(
                    "plantHireRate"
                  )?.value
                ),

              hireRateUnit:
                cleanString(
                  getElement(
                    "plantHireRateUnit"
                  )?.value
                )
                ||
                "WEEK",

              minimumHirePeriod:
                nullableString(
                  getElement(
                    "plantMinimumHirePeriod"
                  )?.value
                ),

              deliveryCharge:
                nullableNumber(
                  getElement(
                    "plantDeliveryCharge"
                  )?.value
                ),

              collectionCharge:
                nullableNumber(
                  getElement(
                    "plantCollectionCharge"
                  )?.value
                ),

              damageWaiver:
                null,

              fuelBasis:
                null,


              hireContractReference:
                nullableString(
                  getElement(
                    "plantHireContractReference"
                  )?.value
                ),

              contactName:
                nullableString(
                  getElement(
                    "plantHireContactName"
                  )?.value
                ),

              contactPhone:
                nullableString(
                  getElement(
                    "plantHireContactPhone"
                  )?.value
                ),

              contactEmail:
                nullableString(
                  getElement(
                    "plantHireContactEmail"
                  )?.value
                ),


              status:
                "ACTIVE",


              createdByUid:
                currentUid(),

              createdByName:
                currentUserName(),

              createdAt:
                serverTimestamp(),

              updatedByUid:
                currentUid(),

              updatedAt:
                serverTimestamp()

            }
          );

        }

      }
    );


    closeAddPlantModal();


    await loadFleetData();


    console.info(
      `NORMEX Plant created: ${allocatedPlantReference}`
    );


  } catch (
    error
  ) {

    console.error(
      "NORMEX Plant creation failed:",
      error
    );


    showModalMessage(
      error?.message ||
      "The plant record could not be saved."
    );


  } finally {

    setSavingState(
      false
    );

  }

}


/* =========================================================
   MODAL MESSAGE / SAVING
========================================================= */

function setSavingState(
  saving
) {

  const button =
    getElement(
      "savePlant"
    );


  if (
    !button
  ) {

    return;

  }


  button.disabled =
    saving;


  button.textContent =
    saving
      ? "Saving Plant..."
      : "Add Plant";

}


function showModalMessage(
  message
) {

  const root =
    getElement(
      "addPlantError"
    );


  if (
    !root
  ) {

    return;

  }


  root.textContent =
    message;


  root.hidden =
    false;

}


function hideModalMessage() {

  const root =
    getElement(
      "addPlantError"
    );


  if (
    root
  ) {

    root.hidden =
      true;

  }

}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  getElement(
    "addPlantButton"
  )?.addEventListener(
    "click",
    openAddPlantModal
  );


  getElement(
    "closeAddPlantModal"
  )?.addEventListener(
    "click",
    closeAddPlantModal
  );


  getElement(
    "cancelAddPlant"
  )?.addEventListener(
    "click",
    closeAddPlantModal
  );


  getElement(
    "addPlantBackdrop"
  )?.addEventListener(
    "click",
    closeAddPlantModal
  );


  getElement(
    "plantType"
  )?.addEventListener(
    "change",
    updateReferencePreview
  );


  getElement(
    "plantOwnershipType"
  )?.addEventListener(
    "change",
    updateHireDetails
  );


  getElement(
    "addPlantAttachmentButton"
  )?.addEventListener(
    "click",
    addAttachment
  );


  getElement(
    "plantAttachmentInput"
  )?.addEventListener(
    "keydown",
    (
      event
    ) => {

      if (
        event.key ===
          "Enter"
      ) {

        event.preventDefault();

        addAttachment();

      }

    }
  );


  getElement(
    "addPlantForm"
  )?.addEventListener(
    "submit",
    createPlant
  );


  bindRegisterEvents();
  document.addEventListener(
    "keydown",
    (
      event
    ) => {

      if (
        event.key ===
          "Escape"

        &&

        !getElement(
          "addPlantModal"
        )?.hidden
      ) {

        closeAddPlantModal();

      }

    }
  );

}


/* =========================================================
   START
========================================================= */

waitForWorkspace();
function openRequestedPlantAction() {
  if (canManagePlant && new URLSearchParams(window.location.search).get("action") === "add") {
    openAddPlantModal();
  }
}

/* Fleet V2 approved modal controller. It only controls existing V2 hooks. */
const FLEET_ASSET_CLASSES = ["ROAD_VEHICLE", "PLANT_MACHINERY", "SMALL_PLANT", "TRAILER_ATTACHMENT", "OTHER"];
function getSelectedAssetClass() { return document.querySelector('input[name="assetClass"]:checked')?.value || "ROAD_VEHICLE"; }
function assetPrefixForClass(assetClass = getSelectedAssetClass()) {
  const value = id => String(getElement(id)?.value || "").trim().toUpperCase();
  if (assetClass === "ROAD_VEHICLE") return ({ CAR:"CAR", VAN:"VAN", PICKUP:"PUP", HGV:"HGV", MINIBUS:"MIN", OTHER_ROAD_VEHICLE:"VEH" })[value("vehicleType")] || "VEH";
  if (assetClass === "SMALL_PLANT") return ({ GRINDER:"GRD", CUT_OFF_SAW:"SAW", BREAKER:"BRK", WELDER:"WLD", PUMP:"PMP", VACUUM_EXTRACTION:"VAC", SMALL_GENERATOR:"GEN", COMPRESSOR:"COM" })[value("equipmentType")] || "SPL";
  if (assetClass === "TRAILER_ATTACHMENT") return value("attachmentType") === "TRAILER" ? "TRL" : "ATT";
  if (assetClass === "OTHER") return "AST";
  return getPlantPrefix(value("plantType")) || "PLT";
}
function applyAssetClassUI() {
  const assetClass = getSelectedAssetClass();
  document.querySelectorAll(".asset-class-card").forEach(card => card.classList.toggle("is-selected", card.querySelector('input[name="assetClass"]')?.checked));
  ["asset-class-section", "specification-for", "maintenance-for", "position-for"].forEach(attribute => document.querySelectorAll(`[data-${attribute}]`).forEach(section => {
    const visible = String(section.dataset[attribute.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] || "").split(/\s+/).includes(assetClass);
    section.hidden = !visible;
    section.querySelectorAll("[required]").forEach(input => { if (!visible) input.dataset.v2Required = "true"; input.required = visible && input.dataset.v2Required === "true"; });
  }));
  updateV2ReferencePreview();
}
function updateV2ReferencePreview() { const preview = getElement("plantReferencePreview"); if (preview) preview.textContent = `${assetPrefixForClass()}-XXXX`; }
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('input[name="assetClass"]').forEach(input => input.addEventListener("change", () => { applyAssetClassUI(); updateV2ReferencePreview(); }));
  ["vehicleType", "plantType", "equipmentType", "attachmentType"].forEach(id => getElement(id)?.addEventListener("change", updateV2ReferencePreview));
  if (document.querySelector('input[name="assetClass"]')) applyAssetClassUI();
});

function buildAssetPayload(assetClass, allocatedReference) {
  const value=id=>nullableString(getElement(id)?.value), number=id=>nullableNumber(getElement(id)?.value), ownershipType=value("plantOwnershipType"), status=value("plantInitialStatus")||"AVAILABLE";
  const base={organisationId,assetClass,plantId:allocatedReference,plantReference:allocatedReference,ownershipType,homeBase:value("assetHomeBase")||"Colemans Yard",currentLocationLabel:value("plantCurrentLocation"),status,safeToUse:status!=="OFF_ROAD",offRoad:status==="OFF_ROAD",complianceHold:false,attachments:[...stagedAttachments],notes:value("plantNotes"),active:true};
  if(assetClass==="ROAD_VEHICLE")return {...base,vehicleType:value("vehicleType"),registrationNumber:value("plantRegistrationNumber"),manufacturer:value("plantManufacturer"),model:value("plantModel"),vin:value("vehicleVin"),serialNumber:value("plantSerialNumber"),year:number("plantYear"),fuelType:value("plantFuelType"),operatingWeight:value("vehicleOperatingWeight"),capacity:value("vehicleCapacity"),specification:value("vehicleSpecification"),assignedToName:value("plantAssignedToName"),currentMileage:number("plantCurrentMileage"),motExpiry:value("plantMotExpiry"),lastServiceDate:value("plantLastServiceDate"),lastServiceMileage:number("plantLastServiceMileage"),nextServiceDate:value("vehicleNextServiceDate")};
  if(assetClass==="PLANT_MACHINERY")return {...base,plantType:value("plantType"),manufacturer:value("plantManufacturerPlant"),model:value("plantModelPlant"),serialNumber:value("plantSerialNumberPlant"),year:number("plantYearPlant"),fuelType:value("plantFuelTypePlant"),operatingWeight:value("plantOperatingWeight"),capacity:value("plantCapacity"),operatingHours:number("plantOperatingHours"),operatingHoursAt:value("plantOperatingHoursAt"),specification:value("plantSpecification"),lastServiceDate:value("plantLastServiceDatePlant"),lastServiceHours:number("plantLastServiceHours"),nextServiceDate:value("plantNextServiceDate")};
  return base;
}
function validateAssetV2(assetClass){const value=id=>cleanString(getElement(id)?.value), ownership=value("plantOwnershipType");const required=assetClass==="ROAD_VEHICLE"?["vehicleType","plantRegistrationNumber","plantManufacturer","plantModel"]:assetClass==="PLANT_MACHINERY"?["plantType"]:[];if(!ownership||required.some(id=>!value(id)))throw Error("Complete the required fields for this asset class.");if(isHireOwnership(ownership)&&!value("plantSupplierName"))throw Error("Hire supplier is required for hired or leased assets.");}
async function createAssetV2(event){event.preventDefault();const assetClass=getSelectedAssetClass();if(!["ROAD_VEHICLE","PLANT_MACHINERY"].includes(assetClass))return;event.stopImmediatePropagation();try{validateAssetV2(assetClass);const uid=currentUid(),prefix=assetPrefixForClass(assetClass),counterRef=doc(db,"plantCounters",`${organisationId}_${prefix}`);let reference;await runTransaction(db,async transaction=>{const user=await transaction.get(doc(db,"users",uid)),counter=await transaction.get(counterRef);const p=user.data();if(!user.exists()||!(p?.status==="ACTIVE"&&(p.roleCode==="PLATFORM_ADMIN"&&p.accessLevel===99||p.roleCode==="PLANT_TRANSPORT_MANAGER"||p.permissions?.canManagePlant||p.permissions?.canManageTransport||p.permissions?.canManageOrganisation)))throw Error("Plant management permission required.");let n=counter.exists()?Number(counter.data().nextNumber)||1:1;reference=`${prefix}-${String(n).padStart(4,"0")}`;const assetRef=doc(db,"plantAssets",reference);if((await transaction.get(assetRef)).exists())throw Error("Asset ID collision. Try saving again.");transaction.set(counterRef,{organisationId,prefix,nextNumber:n+1,updatedByUid:uid,updatedAt:serverTimestamp()});transaction.set(assetRef,omit({...buildAssetPayload(assetClass,reference),createdByUid:uid,createdByName:currentUserName(),createdAt:serverTimestamp(),updatedByUid:uid,updatedAt:serverTimestamp()}));});console.info(`NORMEX Asset created: ${reference}`);closeAddPlantModal();await loadPlantAssets();}catch(error){console.error("NORMEX Asset save failed",error);showModalMessage(error.message||"The asset record could not be saved.");}}
document.addEventListener("submit",event=>{if(event.target?.id==="addPlantForm")createAssetV2(event);},true);

function readableFileSize(size){return size>=1048576?`${(size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(size/1024))} KB`;}
function renderStagedDocuments(){const queue=getElement("assetDocumentQueue");if(!queue)return;queue.innerHTML=stagedDocuments.length?stagedDocuments.map((item,index)=>`<div class="asset-document-queue__item"><strong>${escapeHtml(item.documentType)}</strong><span>${escapeHtml(item.fileName)} · ${readableFileSize(item.size)}</span><button type="button" data-remove-staged-document="${index}">Remove</button></div>`).join(""):"<span class=\"fleet-muted-text\">No documents staged</span>";}
function removeStagedDocument(index){stagedDocuments.splice(index,1);renderStagedDocuments();}
function stageAssetDocuments(){const type=cleanString(getElement("assetDocumentType")?.value),input=getElement("assetDocumentFiles"),files=[...(input?.files||[])];if(!type){showModalMessage("Select a document type before staging files.");return;}if(!files.length){showModalMessage("Select one or more PDF files.");return;}for(const file of files){if(!(file.type==="application/pdf"||/\.pdf$/i.test(file.name))){showModalMessage("Only PDF documents can be staged.");return;}if(!stagedDocuments.some(item=>item.fileName===file.name&&item.size===file.size&&item.file.lastModified===file.lastModified))stagedDocuments.push({documentType:type,file,fileName:file.name,size:file.size});}input.value="";renderStagedDocuments();hideModalMessage();}
document.addEventListener("DOMContentLoaded",()=>{getElement("stageAssetDocument")?.addEventListener("click",stageAssetDocuments);getElement("assetDocumentQueue")?.addEventListener("click",event=>{const button=event.target.closest("[data-remove-staged-document]");if(button)removeStagedDocument(Number(button.dataset.removeStagedDocument));});renderStagedDocuments();});
