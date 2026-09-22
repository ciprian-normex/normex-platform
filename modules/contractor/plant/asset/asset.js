import { calculateHire, selectHire, belongsToAsset, isHireOwnership as sharedHireOwnership, weeklyHireRate as sharedWeeklyRate, validHireRate } from "../shared/plant-hire.js";
import {
  db, auth
} from "/js/firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  PLANT_TYPES, getPlantTypeLabel,
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

let assetDocumentId =
  null;

let selectedView =
  "overview";


let asset =
  null;

let hireRecords =
  [];

let currentHireRecord = null;
let currentHireSelection = { state: "UNKNOWN", reason: "Hire information unavailable", record: null };
let hireReadComplete = false;

let assignments =
  [];

let movements =
  [];

let inspections =
  [];

let defects =
  [];

let maintenanceRecords =
  [];

let issues =
  [];

let documents =
  [];


let canManagePlant =
  false;

let canViewPlantCosts =
  false;


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


function setText(
  id,
  value
) {

  const element =
    getElement(
      id
    );


  if (
    element
  ) {

    element.textContent =
      value ??
      "";

  }

}


function cleanString(
  value
) {

  return String(
    value ??
    ""
  ).trim();

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


function formatText(
  value
) {

  const cleaned =
    cleanString(
      value
    );


  if (
    !cleaned
  ) {

    return "—";

  }


  return cleaned
    .replaceAll(
      "_",
      " "
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );

}


function formatCurrency(
  value
) {

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


  const parsed =
    new Date(
      value
    );


  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;

}


function formatDate(
  value
) {

  const date =
    parseDate(
      value
    );


  if (
    !date
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


function daysBetween(
  startValue,
  endValue
) {

  const start =
    parseDate(
      startValue
    );


  const end =
    parseDate(
      endValue
    );


  if (
    !start ||
    !end
  ) {

    return null;

  }


  const startDate =
    new Date(
      start
    );


  const endDate =
    new Date(
      end
    );


  startDate.setHours(
    0,
    0,
    0,
    0
  );


  endDate.setHours(
    0,
    0,
    0,
    0
  );


  return Math.floor(
    (
      endDate -
      startDate
    )
    /
    86400000
  );

}


/* =========================================================
   ASSET REFERENCE HELPERS

   Supports:
   old test record:
     document ID = random Firebase ID
     plantReference = HRE-0001

   and new records:
     document ID = HRE-0002
     plantReference = HRE-0002
========================================================= */

function getAssetPlantId() {

  return (

    cleanString(
      asset?.plantId
    )

    ||

    cleanString(
      asset?.plantReference
    )

    ||

    cleanString(
      asset?.id
    )

  );

}


function recordBelongsToAsset(
  record
) {

  if (
    !record ||
    !asset
  ) {

    return false;

  }


  const possibleRecordIds = [

    record.plantId,
    record.plantReference,
    record.assetId

  ]
    .map(
      cleanString
    )
    .filter(
      Boolean
    );


  const possibleAssetIds = [

    asset.id,
    asset.plantId,
    asset.plantReference

  ]
    .map(
      cleanString
    )
    .filter(
      Boolean
    );


  return possibleRecordIds.some(
    (
      value
    ) =>
      possibleAssetIds.includes(
        value
      )
  );

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
   START
========================================================= */

function waitForWorkspace() {

  if (
    window.NORMEX_CURRENT_USER
  ) {

    initialiseAsset(
      window.NORMEX_CURRENT_USER
    );

    return;

  }


  window.addEventListener(
    "normex:workspace-ready",
    (
      event
    ) => {

      initialiseAsset(
        event.detail.profile
      );

    },
    {
      once:
        true
    }
  );

}


async function initialiseAsset(
  profile
) {

  currentProfile =
    profile;


  organisationId =
    currentProfile?.organisationId ||
    null;


  assetDocumentId =
    cleanString(
      new URLSearchParams(
        window.location.search
      ).get(
        "id"
      )
    );


  if (
    !organisationId
  ) {

    showLoadError(
      "Organisation context is missing."
    );

    return;

  }


  if (
    !assetDocumentId
  ) {

    showLoadError(
      "No plant asset was selected."
    );

    return;

  }


  resolveAccess();


  initialisePlantShell({
    activePage:
      "fleet",

    workspaceName:
      "Fleet & Transport Control"
  });


  bindAssetNavigation();
  bindAssetEditing();
  bindDeploymentWorkflow();


  await loadAssetWorkspace();

}


/* =========================================================
   LOAD ASSET
========================================================= */

async function loadAssetWorkspace() {

  try {

    await loadAsset();


    if (
      !asset
    ) {

      return;

    }


    renderHero();


    await Promise.all([

      loadHireRecords(),
      loadAssignments(),
      loadMovements(),
      loadInspections(),
      loadDefects(),
      loadMaintenance(),
      loadIssues(),
      loadDocuments()

    ]);


    selectCurrentHireRecord();

    renderHero();

    renderSelectedView();


  } catch (
    error
  ) {

    console.error(
      "NORMEX Asset workspace failed:",
      error
    );


    showLoadError(
      "The plant asset workspace could not be loaded."
    );

  }

}


async function loadAsset() {

  const directReference =
    doc(
      db,
      "plantAssets",
      assetDocumentId
    );


  const directSnapshot =
    await getDoc(
      directReference
    );


  if (
    directSnapshot.exists()
  ) {

    const data =
      directSnapshot.data();


    if (
      data.organisationId !==
        organisationId
    ) {

      throw new Error(
        "Plant asset belongs to another organisation."
      );

    }


    asset = {

      id:
        directSnapshot.id,

      ...data,
      id: directSnapshot.id

    };


    return;

  }


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


  const matching =
    snapshot.docs.filter(
      (
        item
      ) => {

        const data =
          item.data();


        return (

          cleanString(
            data.plantReference
          ) ===
            assetDocumentId

          ||

          cleanString(
            data.plantId
          ) ===
            assetDocumentId

        );

      }
    );


  if (
    !matching.length
  ) {

    asset =
      null;


    showLoadError(
      "The selected plant asset does not exist."
    );


    return;

  }


  if (matching.length !== 1) throw new Error("Multiple assets share this reference. Open the asset using its record link.");
  asset = { ...matching[0].data(), id: matching[0].id };

}


/* =========================================================
   SAFE RELATED COLLECTION LOAD
========================================================= */

async function loadOrganisationCollection(
  collectionName
) {

  try {

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            collectionName
          ),

          where(
            "organisationId",
            "==",
            organisationId
          )
        )
      );


    return snapshot.docs
      .map(
        (
          item
        ) => ({

          id:
            item.id,

          ...item.data()

        })
      );


  } catch (
    error
  ) {

    console.warn(
      `NORMEX ${collectionName} unavailable:`,
      error
    );


    return [];

  }

}

/* =========================================================
   RELATED RECORD LOADERS
========================================================= */

async function loadHireRecords() {
  hireReadComplete = false;
  hireRecords = [];
  if (!canViewPlantCosts) return;
  try {
    const snapshot = await getDocs(query(collection(db, "plantHireRecords"), where("organisationId", "==", organisationId)));
    hireRecords = snapshot.docs.map(item => ({ ...item.data(), id: item.id })).filter(record => belongsToAsset(record, asset));
    hireReadComplete = true;
  } catch (error) {
    // A failed hire read must remain unknown; operational history loads separately.
    hireReadComplete = false;
  }
}


async function loadAssignments() {

  const records =
    await loadOrganisationCollection(
      "plantAssignments"
    );


  assignments =
    records.filter(
      recordBelongsToAsset
    );

}


async function loadMovements() {

  const records =
    await loadOrganisationCollection(
      "plantMovements"
    );


  movements =
    records.filter(
      recordBelongsToAsset
    );

}


async function loadInspections() {

  const records =
    await loadOrganisationCollection(
      "plantInspections"
    );


  inspections =
    records.filter(
      recordBelongsToAsset
    );

}


async function loadDefects() {

  const records =
    await loadOrganisationCollection(
      "plantDefects"
    );


  defects =
    records.filter(
      recordBelongsToAsset
    );

}


async function loadMaintenance() {

  const records =
    await loadOrganisationCollection(
      "plantMaintenance"
    );


  maintenanceRecords =
    records.filter(
      recordBelongsToAsset
    );

}


async function loadIssues() {

  const records =
    await loadOrganisationCollection(
      "plantIssues"
    );


  issues =
    records.filter(
      recordBelongsToAsset
    );

}


async function loadDocuments() {

  try {

    const records =
      await loadOrganisationCollection(
        "documents"
      );


    documents =
      records.filter(
        (
          record
        ) => {

          if (
            recordBelongsToAsset(
              record
            )
          ) {

            return true;

          }


          const entityId =
            cleanString(
              record.entityId
            );


          return (

            cleanString(
              record.entityType
            ).toUpperCase() ===
              "PLANT"

            &&

            [
              asset.id,
              asset.plantId,
              asset.plantReference
            ]
              .map(
                cleanString
              )
              .filter(
                Boolean
              )
              .includes(
                entityId
              )

          );

        }
      );


  } catch (
    error
  ) {

    console.warn(
      "NORMEX Plant documents unavailable:",
      error
    );


    documents =
      [];

  }

}


/* =========================================================
   CURRENT HIRE
========================================================= */

function selectCurrentHireRecord() {
  currentHireSelection = selectHire(asset, hireRecords, { complete: hireReadComplete });
  currentHireRecord = currentHireSelection.record;
}


/* =========================================================
   HERO
========================================================= */

function renderHero() {
  getElement("assetEditButton").hidden = !canEditAsset(currentProfile, organisationId, asset);

  if (
    !asset
  ) {

    return;

  }


  setText(
    "assetReference",
    asset.plantReference ||
    asset.plantId ||
    asset.id
  );


  setText(
    "assetDescription",
    [

      asset.manufacturer,
      asset.model,
      getPlantTypeLabel(
        asset.plantType
      )

    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      )
    ||
    "Plant asset"
  );


  setText(
    "assetCurrentLocation",
    asset.currentLocationLabel ||
    "Not confirmed"
  );


  setText(
    "assetCurrentProject",
    asset.currentProjectName ||
    "Not allocated"
  );


  setText(
    "assetCurrentUse",
    deriveCurrentUse()
  );


  setText(
    "assetSupplier",
    asset.supplierName ||
    currentHireRecord?.supplierName ||
    "Not applicable"
  );


  const latestInspection =
    getLatestInspection();


  setText(
    "assetHeroInspection",
    latestInspection
      ? formatDate(
          latestInspection.inspectionDate ||
          latestInspection.completedAt ||
          latestInspection.createdAt
        )
      : (
          asset.lastInspectionLabel ||
          "No record"
        )
  );


  const nextMovement =
    getNextMovement();


  setText(
    "assetHeroNextMovement",
    nextMovement
      ? (
          nextMovement.toLocation
            ? `${formatDate(
                nextMovement.plannedDate
              )} · ${nextMovement.toLocation}`
            : formatDate(
                nextMovement.plannedDate
              )
        )
      : "Not planned"
  );


  const ownershipChip =
    getElement(
      "assetOwnershipChip"
    );


  if (
    ownershipChip
  ) {

    ownershipChip.textContent =
      getPlantOwnershipLabel(
        asset.ownershipType
      )
      ||
      "Ownership not recorded";

  }


  const status =
    getElement(
      "assetStatus"
    );


  if (
    status
  ) {

    status.textContent =
      getPlantStatusLabel(
        asset.status ||
        "AVAILABLE"
      );


    status.className =
      `asset-status-chip ${getStatusClass(
        asset.status
      )}`;

  }


  document.title =
    `${
      asset.plantReference ||
      asset.plantId ||
      "Plant Asset"
    } | NORMEX`;

}


/* =========================================================
   DERIVED POSITION
========================================================= */

function deriveCurrentUse() {

  if (
    isOffRoad()
  ) {

    return "Off road";

  }


  switch (
    cleanString(
      asset.status
    ).toUpperCase()
  ) {

    case "DEPLOYED":

      return "In use";


    case "IN_TRANSIT":

      return "In transit";


    case "AWAITING_TRANSPORT":

      return "Awaiting transport";


    case "MAINTENANCE":

      return "Under maintenance";


    case "RESERVED":

      return "Reserved";


    case "AVAILABLE":

      return (
        isHiredAsset()

        &&

        !asset.currentProjectId

        &&

        !asset.currentProjectName
      )
        ? "Idle / available"
        : "Available";


    default:

      return formatText(
        asset.status ||
        "AVAILABLE"
      );

  }

}


function isHiredAsset() {
  return sharedHireOwnership(asset);
}


function isOffRoad() {

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
      cleanString(
        asset?.status
      ).toUpperCase()
    )

  );

}


function getOpenDefects() {

  return defects.filter(
    (
      record
    ) =>
      ![
        "CLOSED",
        "RETURNED_TO_SERVICE"
      ].includes(
        cleanString(
          record.status
        ).toUpperCase()
      )
  );

}


function getOpenIssues() {

  return issues.filter(
    (
      record
    ) =>
      ![
        "CLOSED",
        "RESOLVED"
      ].includes(
        cleanString(
          record.status
        ).toUpperCase()
      )
  );

}


function getLatestInspection() {

  return inspections
    .slice()
    .sort(
      (
        a,
        b
      ) => (

        (
          parseDate(
            b.inspectionDate ||
            b.completedAt ||
            b.createdAt
          )?.getTime()
          ||
          0
        )

        -

        (
          parseDate(
            a.inspectionDate ||
            a.completedAt ||
            a.createdAt
          )?.getTime()
          ||
          0
        )

      )
    )[0]
    ||
    null;

}


function getNextMovement() {

  const now =
    new Date();


  return movements
    .filter(
      (
        record
      ) => {

        const date =
          parseDate(
            record.plannedDate
          );


        return (

          date

          &&

          date >=
            now

          &&

          ![
            "DELIVERED",
            "CANCELLED"
          ].includes(
            cleanString(
              record.status
            ).toUpperCase()
          )

        );

      }
    )
    .sort(
      (
        a,
        b
      ) => (

        parseDate(
          a.plannedDate
        )

        -

        parseDate(
          b.plannedDate
        )

      )
    )[0]
    ||
    null;

}


function getNextMaintenance() {

  const now =
    new Date();


  return maintenanceRecords
    .filter(
      (
        record
      ) => {

        const date =
          parseDate(
            record.dueDate ||
            record.plannedDate
          );


        return (

          date

          &&

          date >=
            now

          &&

          cleanString(
            record.status
          ).toUpperCase() !==
            "COMPLETED"

        );

      }
    )
    .sort(
      (
        a,
        b
      ) => (

        parseDate(
          a.dueDate ||
          a.plannedDate
        )

        -

        parseDate(
          b.dueDate ||
          b.plannedDate
        )

      )
    )[0]
    ||
    null;

}


/* =========================================================
   FINANCIAL CALCULATIONS
========================================================= */

function calculateHireDays() {
  return calculateHire(currentHireRecord).days;
}


function calculateHireExposure() {
  return calculateHire(currentHireRecord).estimatedCost;
}


function weeklyHireRate() {
  return sharedWeeklyRate(currentHireRecord?.hireRate, currentHireRecord?.hireRateUnit);
}


function formatHireRate() {
  if (!currentHireRecord) return currentHireSelection.reason;
  if (validHireRate(currentHireRecord.hireRate) === null || sharedWeeklyRate(currentHireRecord.hireRate, currentHireRecord.hireRateUnit) === null) return "Unknown";
  return formatCurrency(currentHireRecord.hireRate) + " / " + cleanString(currentHireRecord.hireRateUnit).toLowerCase();
}

/* =========================================================
   VIEW SWITCHING
========================================================= */

function bindAssetNavigation() {

  document
    .querySelectorAll(
      "[data-asset-view]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () => {

            selectedView =
              button.dataset.assetView;


            document
              .querySelectorAll(
                "[data-asset-view]"
              )
              .forEach(
                (
                  item
                ) =>
                  item.classList.toggle(
                    "is-active",
                    item ===
                      button
                  )
              );


            renderSelectedView();

          }
        );

      }
    );

}


function renderSelectedView() {

  switch (
    selectedView
  ) {

    case "financials":

      renderFinancialView();

      break;


    case "deployment":

      renderDeploymentView();

      break;


    case "inspections":

      renderInspectionsView();

      break;


    case "defects":

      renderDefectsView();

      break;


    case "maintenance":

      renderMaintenanceView();

      break;


    case "compliance":

      renderComplianceView();

      break;


    case "documents":

      renderDocumentsView();

      break;


    case "overview":

    default:

      renderOverviewView();

      break;

  }

}


/* =========================================================
   OVERVIEW
========================================================= */

function renderOverviewView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  if (
    !root
  ) {

    return;

  }


  const latestInspection =
    getLatestInspection();


  const nextMaintenance =
    getNextMaintenance();


  const nextMovement =
    getNextMovement();


  const openDefects =
    getOpenDefects();


  const openIssues =
    getOpenIssues();


  const primaryIssue =
    openIssues[0]
    ||
    null;


  root.innerHTML = `

    ${sectionHeading(
      "Asset Control",
      "Overview",
      "Current operational and financial position for this plant asset."
    )}


    <div class="asset-control-grid">


      ${controlCard(
        "Operational State",
        deriveCurrentUse(),
        asset.currentProjectName ||
        "Current asset position",
        isOffRoad()
          ? "alert"
          : ""
      )}


      ${controlCard(
        "Location",
        asset.currentLocationLabel ||
        "Not confirmed",
        asset.currentLocationConfirmedAt
          ? `Confirmed ${formatDate(
              asset.currentLocationConfirmedAt
            )}`
          : "Location confirmation required",
        asset.currentLocationLabel
          ? ""
          : "watch"
      )}


      ${controlCard(
        "Last Inspection",
        latestInspection
          ? formatDate(
              latestInspection.inspectionDate ||
              latestInspection.completedAt ||
              latestInspection.createdAt
            )
          : (
              asset.lastInspectionLabel ||
              "No record"
            ),
        latestInspection
          ? formatText(
              latestInspection.result ||
              "Recorded"
            )
          : "No inspection history",
        latestInspection
          ? ""
          : "watch"
      )}


      ${controlCard(
        "Open Defects",
        String(
          openDefects.length
        ),
        openDefects.length
          ? "Unresolved plant faults"
          : "No open defects recorded",
        openDefects.length
          ? "alert"
          : ""
      )}


      ${controlCard(
        "Compliance",
        asset.complianceLabel ||
        deriveComplianceLabel(),
        "Current evidence position",
        (
          asset.complianceHold ===
            true
        )
          ? "alert"
          : ""
      )}


      ${controlCard(
        "Next Action",
        deriveNextAction(
          primaryIssue,
          nextMaintenance,
          nextMovement
        ),
        deriveNextActionNote(
          primaryIssue,
          nextMaintenance,
          nextMovement
        ),
        primaryIssue
          ? "watch"
          : ""
      )}


    </div>


    ${
      renderOverviewFinancialPanel()
    }


    <div class="asset-two-column">


      <section class="asset-panel">

        <div class="asset-panel__header">

          <div>

            <h4>
              Current Plant Position
            </h4>

            <p>
              Identity, deployment and present control state.
            </p>

          </div>

        </div>


        ${renderIdentityDetails()}

      </section>


      <section class="asset-panel">

        <div class="asset-panel__header">

          <div>

            <h4>
              ${
                primaryIssue
                  ? "Current Issue"
                  : "Plant Control"
              }
            </h4>

            <p>
              ${
                primaryIssue
                  ? "Most relevant unresolved operational issue."
                  : "No significant Plant Issue currently linked."
              }
            </p>

          </div>

        </div>


        ${
          primaryIssue
            ? renderIssueCard(
                primaryIssue
              )
            : renderNoIssueState()
        }

      </section>


    </div>

  `;

}


/* =========================================================
   OVERVIEW FINANCIAL PANEL
========================================================= */

function renderOverviewFinancialPanel() {

  if (
    !canViewPlantCosts
  ) {

    return `

      <section class="asset-financial-panel">

        <div class="asset-financial-panel__header">

          <div>

            <h4>
              Financial Position
            </h4>

            <p>
              Commercial Plant information is restricted for this access profile.
            </p>

          </div>

        </div>

        <div class="asset-restricted">
          Hire rates and financial exposure are not available with your current permissions.
        </div>

      </section>

    `;

  }


  if (
    !isHiredAsset()
  ) {

    return `

      <section class="asset-financial-panel">

        <div class="asset-financial-panel__header">

          <div>

            <h4>
              Financial Position
            </h4>

            <p>
              Organisation-owned plant. Repair, maintenance, transport and lifecycle costs will build here.
            </p>

          </div>

        </div>


        <div class="asset-financial-grid">

          ${financialCard(
            "Ownership",
            "Owned",
            "No live hire commitment"
          )}

          ${financialCard(
            "Repair Spend",
            calculateRepairSpend(),
            "Recorded defect / repair costs"
          )}

          ${financialCard(
            "Maintenance Spend",
            calculateMaintenanceSpend(),
            "Recorded maintenance cost"
          )}

          ${financialCard(
            "Transport Spend",
            calculateTransportSpend(),
            "Recorded movement cost"
          )}

          ${financialCard(
            "Downtime",
            calculateRecordedDowntime(),
            "Recorded defect downtime"
          )}

        </div>

      </section>

    `;

  }


  if (!currentHireRecord) {
    return '<section class="asset-financial-panel">' + emptyState("Hire information unknown", currentHireSelection.reason) + '</section>';
  }
  const exposure =
    calculateHireExposure();


  const days =
    calculateHireDays();


  const weekly =
    weeklyHireRate();


  const idle =
    deriveCurrentUse() ===
      "Idle / available";


  return `

    <section class="asset-financial-panel">

      <div class="asset-financial-panel__header">

        <div>

          <h4>
            Live Hire Position
          </h4>

          <p>
            Current rate, duration and hire exposure for this machine.
          </p>

        </div>


        ${
          idle
            ? `
              <span class="asset-control-chip asset-status-chip is-watch">
                Idle Hire
              </span>
            `
            : ""
        }

      </div>


      <div class="asset-financial-grid">


        ${financialCard(
          "Hire Rate",
          formatHireRate(),
          currentHireRecord?.supplierName ||
          asset.supplierName ||
          "Supplier not recorded"
        )}


        ${financialCard(
          "On Hire Since",
          formatDate(
            currentHireRecord?.hireStartDate
          ),
          days !==
            null
            ? `${days} day${
                days === 1
                  ? ""
                  : "s"
              } on hire`
            : "Hire duration unavailable"
        )}


        ${financialCard(
          "Exposure to Date",
          exposure !==
            null
            ? formatCurrency(
                exposure
              )
            : "Not calculated",
          "Approximate hire exposure"
        )}


        ${financialCard(
          "Expected Off-Hire",
          formatDate(
            currentHireRecord?.expectedOffHireDate
          ),
          offHireNote()
        )}


        ${financialCard(
          idle
            ? "Current Cost Pressure"
            : "Weekly Equivalent",
          weekly !==
            null
            ? `${formatCurrency(
                weekly
              )} / week`
            : "Not recorded",
          idle
            ? "Hire continues while asset is recorded idle"
            : "Normalised weekly commitment",
          idle
            ? "watch"
            : ""
        )}


      </div>

    </section>

  `;

}


/* =========================================================
   FINANCIALS VIEW
========================================================= */

function renderFinancialView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  if (
    !root
  ) {

    return;

  }


  if (
    !canViewPlantCosts
  ) {

    root.innerHTML = `

      ${sectionHeading(
        "Commercial Control",
        "Financials",
        "Hire, repair, maintenance and movement cost position."
      )}

      <div class="asset-restricted">
        You do not have permission to view Plant commercial information.
      </div>

    `;

    return;

  }


  if (
    isHiredAsset()
  ) {

    renderHiredFinancialView(
      root
    );

    return;

  }


  renderOwnedFinancialView(
    root
  );

}


function renderHiredFinancialView(
  root
) {

  if (!currentHireRecord) {
    root.innerHTML = sectionHeading("Commercial Control", "Financials", "Hire information needs review") + emptyState("Hire information unknown", currentHireSelection.reason) + renderHireHistory();
    return;
  }
  const exposure =
    calculateHireExposure();


  const days =
    calculateHireDays();


  root.innerHTML = `

    ${sectionHeading(
      "Commercial Control",
      "Financials",
      "Hire terms, current exposure and recorded asset-related costs."
    )}


    <div class="asset-summary-grid">


      ${summaryCard(
        "Current Hire Rate",
        formatHireRate(),
        currentHireRecord?.supplierName ||
        asset.supplierName ||
        "Supplier not recorded"
      )}


      ${summaryCard(
        "Hire Duration",
        days !==
          null
          ? `${days} days`
          : "—",
        `Started ${formatDate(
          currentHireRecord?.hireStartDate
        )}`
      )}


      ${summaryCard(
        "Exposure to Date",
        exposure !==
          null
          ? formatCurrency(
              exposure
            )
          : "—",
        "Approximate hire exposure"
      )}


      ${summaryCard(
        "Expected Off-Hire",
        formatDate(
          currentHireRecord?.expectedOffHireDate
        ),
        offHireNote(),
        offHireRequiresAttention()
          ? "watch"
          : ""
      )}


      ${summaryCard(
        "Delivery Charge",
        formatCurrency(
          currentHireRecord?.deliveryCharge
        ),
        "Recorded delivery cost"
      )}


      ${summaryCard(
        "Collection Charge",
        formatCurrency(
          currentHireRecord?.collectionCharge
        ),
        "Expected / recorded collection cost"
      )}


      ${summaryCard(
        "Repair Spend",
        calculateRepairSpend(),
        "Recorded repair costs"
      )}


      ${summaryCard(
        "Transport Spend",
        calculateTransportSpend(),
        "Recorded movement costs"
      )}


    </div>


    <div class="asset-two-column">


      <section class="asset-panel">

        <div class="asset-panel__header">

          <div>

            <h4>
              Hire Agreement
            </h4>

            <p>
              Current supplier and contractual position.
            </p>

          </div>

        </div>


        ${renderHireDetails()}

      </section>


      <section class="asset-panel">

        <div class="asset-panel__header">

          <div>

            <h4>
              Hire History
            </h4>

            <p>
              All hire periods recorded against this Plant ID.
            </p>

          </div>

        </div>


        ${renderHireHistory()}

      </section>


    </div>

  `;

}


function renderOwnedFinancialView(
  root
) {

  root.innerHTML = `

    ${sectionHeading(
      "Commercial Control",
      "Financials",
      "Recorded ownership, repair, maintenance and transport cost."
    )}


    <div class="asset-summary-grid">


      ${summaryCard(
        "Ownership",
        "Owned",
        "Organisation asset"
      )}


      ${summaryCard(
        "Repair Spend",
        calculateRepairSpend(),
        "Recorded repair costs"
      )}


      ${summaryCard(
        "Maintenance Spend",
        calculateMaintenanceSpend(),
        "Recorded maintenance costs"
      )}


      ${summaryCard(
        "Transport Spend",
        calculateTransportSpend(),
        "Recorded movement costs"
      )}


      ${summaryCard(
        "Downtime",
        calculateRecordedDowntime(),
        "Recorded defect downtime"
      )}


      ${summaryCard(
        "Open Defects",
        String(
          getOpenDefects().length
        ),
        "Unresolved defect records",
        getOpenDefects().length
          ? "alert"
          : ""
      )}


      ${summaryCard(
        "Next Service",
        getNextMaintenance()
          ? formatDate(
              getNextMaintenance().dueDate ||
              getNextMaintenance().plannedDate
            )
          : "Not planned",
        "Future maintenance"
      )}


      ${summaryCard(
        "Current Position",
        deriveCurrentUse(),
        asset.currentLocationLabel ||
        "Location not confirmed"
      )}


    </div>

  `;

}

/* =========================================================
   LOCATION & DEPLOYMENT
========================================================= */

function renderDeploymentView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  if (
    !root
  ) {

    return;

  }


  const timeline = buildDeploymentTimeline();
  const currentAssignment = getCurrentAssignment(assignments);
  const canManageDeployment = canEditAsset(currentProfile, organisationId, asset);


  root.innerHTML = `

    ${sectionHeading(
      "Operational Location",
      "Location & Deployment",
      "Where the plant is, where it has been and what is planned next."
    )}


    <div class="asset-summary-grid">


      ${summaryCard("Current Position", asset.currentProjectName || "Not allocated", asset.currentLocationLabel || "Location not confirmed")}


      ${summaryCard("Assignment Status", currentAssignment ? formatText(currentAssignment.status) : "Unassigned", currentAssignment ? `Since ${formatDate(currentAssignment.assignedFrom)}` : "No active assignment")}


      ${summaryCard("Location Confirmed", asset.currentLocationConfirmedAt ? formatDate(asset.currentLocationConfirmedAt) : "Not recorded", asset.currentLocationConfirmedByName || asset.currentLocationConfirmedByUid || "Confirmation required")}


      ${summaryCard("Operational State", deriveCurrentUse(), getPlantStatusLabel(asset.status || "AVAILABLE"))}


    </div>

    <section class="asset-panel asset-deployment-actions">
      <div class="asset-panel__header"><div><h4>Deployment Actions</h4><p>Assignment records preserve project deployment history. Location confirmation records where the asset is; it does not create a movement.</p></div></div>
      ${canManageDeployment ? `<div class="asset-deployment-actions__buttons">
        <button type="button" data-deployment-action="location">Confirm / Update Location</button>
        ${currentAssignment ? `<button type="button" data-deployment-action="reassign">Reassign</button><button type="button" data-deployment-action="release" class="asset-deployment-actions__release">Release</button>` : `<button type="button" data-deployment-action="assign">Assign to Project</button>`}
      </div>` : `<p class="asset-deployment-actions__restricted">You can view the current position. Plant-management permission is required to change it.</p>`}
    </section>


    <section class="asset-panel">

      <div class="asset-panel__header">

        <div>

          <h4>
            Location & Deployment History
          </h4>

          <p>
            Assignment and movement records are presented together as one asset history.
          </p>

        </div>

      </div>


      ${
        timeline.length
          ? `

            <div class="asset-timeline">

              ${timeline
                .map(
                  renderTimelineRecord
                )
                .join("")}

            </div>

          `
          : emptyState(
              "No deployment history yet",
              "Assignments, completed movements and location confirmations will build the location history for this machine."
            )
      }

    </section>

  `;

  root.querySelectorAll("[data-deployment-action]").forEach(button => button.addEventListener("click", () => openDeploymentEditor(button.dataset.deploymentAction)));

}


/* =========================================================
   INSPECTIONS
========================================================= */

function renderInspectionsView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  const latest =
    getLatestInspection();


  root.innerHTML = `

    ${sectionHeading(
      "Asset Assurance",
      "Inspections",
      "Pre-use, on-hire, off-hire, formal and return-to-service inspection history.",
      `${inspections.length} records`
    )}


    <div class="asset-summary-grid">


      ${summaryCard(
        "Last Inspection",
        latest
          ? formatDate(
              latest.inspectionDate ||
              latest.completedAt ||
              latest.createdAt
            )
          : "No record",
        latest
          ? formatText(
              latest.inspectionType ||
              latest.result ||
              "Inspection"
            )
          : "No inspection history",
        latest
          ? ""
          : "watch"
      )}


      ${summaryCard(
        "Last Result",
        latest
          ? formatText(
              latest.result ||
              latest.status ||
              "Recorded"
            )
          : "—",
        latest?.completedByName ||
        latest?.createdByName ||
        "No user recorded"
      )}


      ${summaryCard(
        "Total Inspections",
        String(
          inspections.length
        ),
        "Permanent asset history"
      )}


      ${summaryCard(
        "Open Defects",
        String(
          getOpenDefects().length
        ),
        "Defects currently unresolved",
        getOpenDefects().length
          ? "alert"
          : ""
      )}


    </div>


    ${
      inspections.length
        ? `

          <div class="asset-timeline">

            ${inspections
              .slice()
              .sort(
                newestFirstBy([
                  "inspectionDate",
                  "completedAt",
                  "createdAt"
                ])
              )
              .map(
                (
                  record
                ) => `

                  <article class="asset-timeline-row">

                    <div class="asset-timeline-row__date">
                      ${escapeHtml(
                        formatDate(
                          record.inspectionDate ||
                          record.completedAt ||
                          record.createdAt
                        )
                      )}
                    </div>

                    <div class="asset-timeline-row__main">

                      <strong>
                        ${escapeHtml(
                          formatText(
                            record.inspectionType ||
                            "PLANT_INSPECTION"
                          )
                        )}
                      </strong>

                      <span>
                        ${escapeHtml(
                          record.completedByName ||
                          record.createdByName ||
                          "User not recorded"
                        )}
                      </span>

                    </div>

                    <span class="asset-timeline-row__status">
                      ${escapeHtml(
                        formatText(
                          record.result ||
                          record.status ||
                          "RECORDED"
                        )
                      )}
                    </span>

                  </article>

                `
              )
              .join("")}

          </div>

        `
        : emptyState(
            "No inspections recorded",
            "Once pre-use, on-hire, off-hire or formal inspections are linked to this Plant ID, the complete history will appear here."
          )
    }

  `;

}


/* =========================================================
   DEFECTS
========================================================= */

function renderDefectsView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  const open =
    getOpenDefects();


  root.innerHTML = `

    ${sectionHeading(
      "Reliability Control",
      "Defects & Repairs",
      "Faults, repair progress, downtime and reliability history.",
      `${open.length} open`
    )}


    <div class="asset-summary-grid">


      ${summaryCard(
        "Open Defects",
        String(
          open.length
        ),
        "Unresolved faults",
        open.length
          ? "alert"
          : ""
      )}


      ${summaryCard(
        "Plant State",
        isOffRoad()
          ? "Off Road"
          : deriveCurrentUse(),
        isOffRoad()
          ? "Current use restricted"
          : "Current operational state",
        isOffRoad()
          ? "alert"
          : ""
      )}


      ${summaryCard(
        "Repair Spend",
        canViewPlantCosts
          ? calculateRepairSpend()
          : "Restricted",
        "Recorded repair cost"
      )}


      ${summaryCard(
        "Recorded Downtime",
        calculateRecordedDowntime(),
        "Across recorded defects"
      )}


    </div>


    ${
      defects.length
        ? `

          <div class="asset-timeline">

            ${defects
              .slice()
              .sort(
                newestFirstBy([
                  "reportedAt",
                  "createdAt"
                ])
              )
              .map(
                (
                  record
                ) => `

                  <article class="asset-timeline-row">

                    <div class="asset-timeline-row__date">
                      ${escapeHtml(
                        formatDate(
                          record.reportedAt ||
                          record.createdAt
                        )
                      )}
                    </div>

                    <div class="asset-timeline-row__main">

                      <strong>
                        ${escapeHtml(
                          record.title ||
                          record.defectType ||
                          "Plant Defect"
                        )}
                      </strong>

                      <span>
                        ${escapeHtml(
                          record.description ||
                          record.currentPosition ||
                          "No description recorded"
                        )}
                      </span>

                    </div>

                    <span class="asset-timeline-row__status">
                      ${escapeHtml(
                        formatText(
                          record.status ||
                          "REPORTED"
                        )
                      )}
                    </span>

                  </article>

                `
              )
              .join("")}

          </div>

        `
        : emptyState(
            "No defects recorded",
            "Reported faults, repairs, parts, downtime and return-to-service history will remain permanently linked to this machine."
          )
    }

  `;

}


/* =========================================================
   MAINTENANCE
========================================================= */

function renderMaintenanceView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  const next =
    getNextMaintenance();


  root.innerHTML = `

    ${sectionHeading(
      "Asset Care",
      "Maintenance",
      "Service planning, repairs and maintenance history."
    )}


    <div class="asset-summary-grid">


      ${summaryCard(
        "Next Service",
        next
          ? formatDate(
              next.dueDate ||
              next.plannedDate
            )
          : "Not planned",
        next?.maintenanceType ||
        "No future maintenance recorded"
      )}


      ${summaryCard(
        "Maintenance Records",
        String(
          maintenanceRecords.length
        ),
        "Permanent maintenance history"
      )}


      ${summaryCard(
        "Recorded Spend",
        canViewPlantCosts
          ? calculateMaintenanceSpend()
          : "Restricted",
        "Maintenance costs recorded"
      )}


      ${summaryCard(
        "Ownership",
        getPlantOwnershipLabel(
          asset.ownershipType
        ),
        isHiredAsset()
          ? "Supplier responsibility may apply"
          : "Organisation-owned asset"
      )}


    </div>


    ${
      maintenanceRecords.length
        ? `

          <div class="asset-timeline">

            ${maintenanceRecords
              .slice()
              .sort(
                newestFirstBy([
                  "completedDate",
                  "plannedDate",
                  "createdAt"
                ])
              )
              .map(
                (
                  record
                ) => `

                  <article class="asset-timeline-row">

                    <div class="asset-timeline-row__date">
                      ${escapeHtml(
                        formatDate(
                          record.completedDate ||
                          record.plannedDate ||
                          record.createdAt
                        )
                      )}
                    </div>

                    <div class="asset-timeline-row__main">

                      <strong>
                        ${escapeHtml(
                          record.maintenanceType ||
                          "Maintenance"
                        )}
                      </strong>

                      <span>
                        ${escapeHtml(
                          record.description ||
                          record.supplierName ||
                          "Maintenance record"
                        )}
                      </span>

                    </div>

                    <span class="asset-timeline-row__status">
                      ${escapeHtml(
                        formatText(
                          record.status ||
                          "RECORDED"
                        )
                      )}
                    </span>

                  </article>

                `
              )
              .join("")}

          </div>

        `
        : emptyState(
            "No maintenance history",
            "Services, repairs, parts and planned maintenance will build the permanent asset record here."
          )
    }

  `;

}


/* =========================================================
   COMPLIANCE
========================================================= */

function renderComplianceView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  const types = [
    "LOLER",
    "PUWER",
    "MOT",
    "INSURANCE"
  ];


  const cards =
    types.map(
      (
        type
      ) => {

        const matching =
          findLatestDocumentByType(
            type
          );


        return `

          <article class="asset-record-card">

            <div class="asset-record-card__top">

              <strong>
                ${escapeHtml(
                  type
                )}
              </strong>

              <span>
                ${
                  matching
                    ? escapeHtml(
                        deriveDocumentStatus(
                          matching
                        )
                      )
                    : "Not recorded"
                }
              </span>

            </div>

            <p>

              ${
                matching
                  ? escapeHtml(
                      matching.title ||
                      matching.fileName ||
                      "Evidence recorded"
                    )
                  : "No current evidence is linked to this asset."
              }

            </p>

            <small>

              ${
                matching?.expiryDate
                  ? `Expiry ${escapeHtml(
                      formatDate(
                        matching.expiryDate
                      )
                    )}`
                  : "No expiry recorded"
              }

            </small>

          </article>

        `;

      }
    );


  root.innerHTML = `

    ${sectionHeading(
      "Plant Assurance",
      "Compliance",
      "Derived evidence position answering whether this machine can remain in service."
    )}


    <div class="asset-summary-grid">

      ${summaryCard(
        "Overall Position",
        deriveComplianceLabel(),
        "Derived from linked evidence",
        asset.complianceHold ===
          true
          ? "alert"
          : ""
      )}

      ${summaryCard(
        "Evidence Records",
        String(
          documents.length
        ),
        "Documents linked to this asset"
      )}

      ${summaryCard(
        "Compliance Hold",
        asset.complianceHold ===
          true
          ? "Yes"
          : "No",
        asset.complianceHold ===
          true
          ? "Plant use restricted"
          : "No compliance hold recorded",
        asset.complianceHold ===
          true
          ? "alert"
          : ""
      )}

      ${summaryCard(
        "Safe to Use",
        asset.safeToUse ===
          false
          ? "No"
          : "Yes",
        "Current cached safety state",
        asset.safeToUse ===
          false
          ? "alert"
          : ""
      )}

    </div>


    <div class="asset-record-grid">

      ${cards.join("")}

    </div>

  `;

}


/* =========================================================
   DOCUMENTS
========================================================= */

function renderDocumentsView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  const groups =
    groupDocuments();


  root.innerHTML = `

    ${sectionHeading(
      "Controlled Evidence",
      "Documents",
      "Certificates, contracts, condition evidence, repair records, transport evidence and commercial documents.",
      `${documents.length} records`
    )}


    ${
      documents.length

        ? Object.entries(
            groups
          )
            .map(
              (
                [
                  group,
                  records
                ]
              ) => `

                <section class="asset-panel">

                  <div class="asset-panel__header">

                    <div>

                      <h4>
                        ${escapeHtml(
                          group
                        )}
                      </h4>

                      <p>
                        ${records.length} record${
                          records.length === 1
                            ? ""
                            : "s"
                        }
                      </p>

                    </div>

                  </div>


                  <div class="asset-record-grid">

                    ${records
                      .map(
                        (
                          record
                        ) => `

                          <article class="asset-record-card">

                            <div class="asset-record-card__top">

                              <strong>
                                ${escapeHtml(
                                  record.title ||
                                  record.fileName ||
                                  formatText(
                                    record.documentType ||
                                    "DOCUMENT"
                                  )
                                )}
                              </strong>

                              <span>
                                ${escapeHtml(
                                  deriveDocumentStatus(
                                    record
                                  )
                                )}
                              </span>

                            </div>

                            <p>
                              ${escapeHtml(
                                formatText(
                                  record.documentType ||
                                  record.category ||
                                  "DOCUMENT"
                                )
                              )}
                            </p>

                            <small>
                              ${
                                record.expiryDate
                                  ? `Expiry ${escapeHtml(
                                      formatDate(
                                        record.expiryDate
                                      )
                                    )}`
                                  : `Recorded ${escapeHtml(
                                      formatDate(
                                        record.createdAt
                                      )
                                    )}`
                              }
                            </small>

                          </article>

                        `
                      )
                      .join("")}

                  </div>

                </section>

              `
            )
            .join("")

        : emptyState(
            "No documents linked",
            "LOLER certificates, hire contracts, condition photographs, repair evidence, invoices and manuals will be retained against this Plant ID."
          )
    }

  `;

}


/* =========================================================
   REUSABLE UI HELPERS
========================================================= */

function sectionHeading(
  eyebrow,
  title,
  note,
  count =
    ""
) {

  return `

    <div class="asset-section-heading">

      <div>

        <p class="asset-eyebrow">
          ${escapeHtml(
            eyebrow
          )}
        </p>

        <h3 class="asset-section-heading__title">
          ${escapeHtml(
            title
          )}
        </h3>

        <p class="asset-section-heading__note">
          ${escapeHtml(
            note
          )}
        </p>

      </div>


      ${
        count
          ? `
            <span class="asset-section-count">
              ${escapeHtml(
                count
              )}
            </span>
          `
          : ""
      }

    </div>

  `;

}


function controlCard(
  label,
  value,
  note,
  state =
    ""
) {

  return `

    <article
      class="
        asset-control-card
        ${
          state
            ? `is-${state}`
            : ""
        }
      "
    >

      <span>
        ${escapeHtml(
          label
        )}
      </span>

      <strong>
        ${escapeHtml(
          value
        )}
      </strong>

      <small>
        ${escapeHtml(
          note
        )}
      </small>

    </article>

  `;

}


function financialCard(
  label,
  value,
  note,
  state =
    ""
) {

  return `

    <article
      class="
        asset-financial-card
        ${
          state
            ? `is-${state}`
            : ""
        }
      "
    >

      <span>
        ${escapeHtml(
          label
        )}
      </span>

      <strong>
        ${escapeHtml(
          value
        )}
      </strong>

      <small>
        ${escapeHtml(
          note
        )}
      </small>

    </article>

  `;

}


function summaryCard(
  label,
  value,
  note,
  state =
    ""
) {

  return `

    <article
      class="
        asset-summary-card
        ${
          state
            ? `is-${state}`
            : ""
        }
      "
    >

      <span>
        ${escapeHtml(
          label
        )}
      </span>

      <strong>
        ${escapeHtml(
          value
        )}
      </strong>

      <small>
        ${escapeHtml(
          note
        )}
      </small>

    </article>

  `;

}


function emptyState(
  title,
  note
) {

  return `

    <div class="asset-empty">

      <strong>
        ${escapeHtml(
          title
        )}
      </strong>

      <span>
        ${escapeHtml(
          note
        )}
      </span>

    </div>

  `;

}


/* =========================================================
   IDENTITY DETAILS
========================================================= */

function renderIdentityDetails() {

  const fields = [
    ["Year", asset.year || "Not recorded"],
    ["Specification", asset.specification || "Not recorded"],
    ["Notes", asset.notes || "Not recorded"],

    [
      "Plant Type",
      getPlantTypeLabel(
        asset.plantType
      )
    ],

    [
      "Manufacturer",
      asset.manufacturer ||
      "Not recorded"
    ],

    [
      "Model",
      asset.model ||
      "Not recorded"
    ],

    [
      "Serial Number",
      asset.serialNumber ||
      "Not recorded"
    ],

    [
      "Registration",
      asset.registrationNumber ||
      "Not applicable"
    ],

    [
      "Operating Weight",
      asset.operatingWeight ||
      "Not recorded"
    ],

    [
      "Capacity / Reach",
      asset.capacity ||
      "Not recorded"
    ],

    [
      "Fuel / Power",
      formatText(
        asset.fuelType
      )
    ]

  ];


  return `

    <div class="asset-detail-grid">

      ${fields
        .map(
          (
            [
              label,
              value
            ]
          ) => `

            <div class="asset-detail">

              <span>
                ${escapeHtml(
                  label
                )}
              </span>

              <strong>
                ${escapeHtml(
                  value
                )}
              </strong>

            </div>

          `
        )
        .join("")}

    </div>


    ${
      Array.isArray(
        asset.attachments
      )
      &&
      asset.attachments.length
        ? `

          <div class="asset-tag-list">

            ${asset.attachments
              .map(
                (
                  item
                ) => `

                  <span class="asset-tag">
                    ${escapeHtml(
                      item
                    )}
                  </span>

                `
              )
              .join("")}

          </div>

        `
        : ""
    }

  `;

}


/* =========================================================
   ISSUE
========================================================= */

function renderIssueCard(
  issue
) {

  const high =
    [
      "HIGH",
      "CRITICAL",
      "STOPPER"
    ].includes(
      cleanString(
        issue.impactLevel
      ).toUpperCase()
    );


  return `

    <article
      class="
        asset-issue-card
        ${
          high
            ? "is-high"
            : ""
        }
      "
    >

      <div class="asset-issue-card__top">

        <strong>
          ${escapeHtml(
            issue.title ||
            "Plant Issue"
          )}
        </strong>

        <span>
          ${escapeHtml(
            formatText(
              issue.status ||
              "OPEN"
            )
          )}
        </span>

      </div>


      <p>
        ${escapeHtml(
          issue.currentPosition ||
          issue.description ||
          "No current position recorded."
        )}
      </p>


      <div class="asset-issue-milestone">

        <div>

          <span>
            Next Milestone
          </span>

          <strong>
            ${escapeHtml(
              issue.nextMilestone ||
              "Not recorded"
            )}
          </strong>

        </div>

        <div>

          <span>
            Due
          </span>

          <strong>
            ${escapeHtml(
              formatDate(
                issue.nextMilestoneDate
              )
            )}
          </strong>

        </div>

      </div>

    </article>

  `;

}


function renderNoIssueState() {

  return emptyState(
    "No significant Plant Issue",
    "Project stoppers, sourcing problems, repair delays and other major exceptions will appear here when linked to this asset."
  );

}


/* =========================================================
   HIRE DETAILS / HISTORY
========================================================= */

function renderHireDetails() {

  if (
    !currentHireRecord
  ) {

    return emptyState(
      "Hire information unknown",
      currentHireSelection.reason
    );

  }


  const fields = [

    [
      "Supplier",
      currentHireRecord.supplierName ||
      asset.supplierName ||
      "Not recorded"
    ],

    [
      "Supplier Asset Ref",
      currentHireRecord.supplierPlantReference ||
      asset.supplierPlantReference ||
      "Not recorded"
    ],

    [
      "Contract Ref",
      currentHireRecord.hireContractReference ||
      "Not recorded"
    ],

    [
      "Hire Status",
      formatText(
        currentHireRecord.status ||
        "ACTIVE"
      )
    ],

    [
      "Minimum Hire",
      currentHireRecord.minimumHirePeriod ||
      "Not recorded"
    ],

    [
      "Contact",
      currentHireRecord.contactName ||
      "Not recorded"
    ],

    [
      "Phone",
      currentHireRecord.contactPhone ||
      "Not recorded"
    ],

    [
      "Email",
      currentHireRecord.contactEmail ||
      "Not recorded"
    ]

  ];


  return `

    <div class="asset-detail-grid">

      ${fields
        .map(
          (
            [
              label,
              value
            ]
          ) => `

            <div class="asset-detail">

              <span>
                ${escapeHtml(
                  label
                )}
              </span>

              <strong>
                ${escapeHtml(
                  value
                )}
              </strong>

            </div>

          `
        )
        .join("")}

    </div>

  `;

}


function renderHireHistory() {

  if (
    !hireRecords.length
  ) {

    return emptyState(
      "No hire history",
      "Hire periods will remain permanently linked to this Plant ID."
    );

  }


  return `

    <div class="asset-timeline">

      ${hireRecords
        .slice()
        .sort(
          newestFirstBy([
            "hireStartDate",
            "createdAt"
          ])
        )
        .map(
          (
            record
          ) => `

            <article class="asset-timeline-row">

              <div class="asset-timeline-row__date">
                ${escapeHtml(
                  formatDate(
                    record.hireStartDate ||
                    record.createdAt
                  )
                )}
              </div>

              <div class="asset-timeline-row__main">

                <strong>
                  ${escapeHtml(
                    record.supplierName ||
                    "Hire Supplier"
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    validHireRate(record.hireRate) !== null && sharedWeeklyRate(record.hireRate, record.hireRateUnit) !== null
                      ? `${
                          formatCurrency(
                            record.hireRate
                          )
                        } / ${
                          cleanString(
                            record.hireRateUnit ||
                            "WEEK"
                          ).toLowerCase()
                        }`
                      : "Rate not recorded"
                  )}
                </span>

              </div>

              <span class="asset-timeline-row__status">
                ${escapeHtml(
                  formatText(
                    record.status ||
                    "ACTIVE"
                  )
                )}
              </span>

            </article>

          `
        )
        .join("")}

    </div>

  `;

}


/* =========================================================
   DEPLOYMENT TIMELINE
========================================================= */

function buildDeploymentTimeline() {

  const records =
    [];


  assignments.forEach(
    (
      record
    ) => {

      records.push({

        date:
          record.assignedFrom ||
          record.createdAt,

        type:
          "ASSIGNMENT",

        title:
          record.projectName ||
          "Plant Assignment",

        description:
          record.assignmentPurpose ||
          record.currentPosition ||
          `Assigned to project${record.createdByName || record.createdByUid ? ` by ${record.createdByName || record.createdByUid}` : ""}`,

        status:
          record.status ||
          "ACTIVE"

      });

    }
  );


  movements.forEach(
    (
      record
    ) => {

      records.push({

        date:
          record.actualDate ||
          record.plannedDate ||
          record.createdAt,

        type:
          "MOVEMENT",

        title:
          `${
            record.fromLocation ||
            "Unknown"
          } → ${
            record.toLocation ||
            "Unknown"
          }`,

        description:
          record.transportSupplier ||
          record.bookingReference ||
          "Plant movement",

        status:
          record.status ||
          "PLANNED"

      });

    }
  );


  if (
    asset.currentLocationConfirmedAt &&
    !(Array.isArray(asset.locationHistory) && asset.locationHistory.length)
  ) {

    records.push({

      date:
        asset.currentLocationConfirmedAt,

      type:
        "LOCATION",

      title:
        asset.currentLocationLabel ||
        "Location Confirmed",

      description:
        "Recorded plant location confirmed",

      status:
        "CONFIRMED"

    });

  }

  (Array.isArray(asset.locationHistory) ? asset.locationHistory : []).forEach(record => {
    records.push({ date: record.confirmedAt, type: "LOCATION", title: record.locationLabel || "Location confirmed", description: `Confirmed by ${record.confirmedByName || record.confirmedByUid || "Unknown user"}`, status: "CONFIRMED" });
  });


  return records.sort(
    (
      a,
      b
    ) => (

      (
        parseDate(
          b.date
        )?.getTime()
        ||
        0
      )

      -

      (
        parseDate(
          a.date
        )?.getTime()
        ||
        0
      )

    )
  );

}


function renderTimelineRecord(
  record
) {

  return `

    <article class="asset-timeline-row">

      <div class="asset-timeline-row__date">
        ${escapeHtml(
          formatDate(
            record.date
          )
        )}
      </div>

      <div class="asset-timeline-row__main">

        <strong>
          ${escapeHtml(
            record.title
          )}
        </strong>

        <span>
          ${escapeHtml(
            `${formatText(
              record.type
            )} · ${record.description}`
          )}
        </span>

      </div>

      <span class="asset-timeline-row__status">
        ${escapeHtml(
          formatText(
            record.status
          )
        )}
      </span>

    </article>

  `;

}


/* =========================================================
   COST HELPERS
========================================================= */

function calculateRepairSpend() {

  const total =
    defects.reduce(
      (
        sum,
        record
      ) => {

        const values = [

          record.repairCost,
          record.partsCost,
          record.replacementPlantCost,
          record.transportCost

        ];


        return sum +
          values.reduce(
            (
              local,
              value
            ) => {

              const number =
                Number(
                  value
                );


              return local +
                (
                  Number.isFinite(
                    number
                  )
                    ? number
                    : 0
                );

            },
            0
          );

      },
      0
    );


  return formatCurrency(
    total
  );

}


function calculateMaintenanceSpend() {

  const total =
    maintenanceRecords.reduce(
      (
        sum,
        record
      ) => {

        const number =
          Number(
            record.cost ||
            record.totalCost
          );


        return sum +
          (
            Number.isFinite(
              number
            )
              ? number
              : 0
          );

      },
      0
    );


  return formatCurrency(
    total
  );

}


function calculateTransportSpend() {

  const total =
    movements.reduce(
      (
        sum,
        record
      ) => {

        const number =
          Number(
            record.cost ||
            record.transportCost
          );


        return sum +
          (
            Number.isFinite(
              number
            )
              ? number
              : 0
          );

      },
      0
    );


  return formatCurrency(
    total
  );

}


function calculateRecordedDowntime() {

  let totalHours =
    0;


  defects.forEach(
    (
      record
    ) => {

      if (
        Number.isFinite(
          Number(
            record.downtimeHours
          )
        )
      ) {

        totalHours +=
          Number(
            record.downtimeHours
          );

        return;

      }


      const start =
        parseDate(
          record.downtimeStart
        );


      const end =
        parseDate(
          record.downtimeEnd
        );


      if (
        start &&
        end &&
        end >
          start
      ) {

        totalHours +=
          (
            end -
            start
          )
          /
          3600000;

      }

    }
  );


  if (
    totalHours <
      24
  ) {

    return `${Math.round(
      totalHours *
      10
    ) / 10}h`;

  }


  return `${
    Math.round(
      (
        totalHours /
        24
      )
      *
      10
    ) /
    10
  } days`;

}


/* =========================================================
   OTHER DERIVED HELPERS
========================================================= */

function deriveComplianceLabel() {

  if (
    asset.complianceHold ===
      true
  ) {

    return "Hold";

  }


  if (
    cleanString(
      asset.complianceLabel
    )
  ) {

    return asset.complianceLabel;

  }


  if (
    !documents.length
  ) {

    return "Not assessed";

  }


  const expired =
    documents.some(
      (
        record
      ) =>
        deriveDocumentStatus(
          record
        ) ===
          "Expired"
    );


  return expired
    ? "Attention Required"
    : "Evidence Recorded";

}


function deriveDocumentStatus(
  record
) {

  if (
    cleanString(
      record.status
    )
  ) {

    return formatText(
      record.status
    );

  }


  const expiry =
    parseDate(
      record.expiryDate
    );


  if (
    !expiry
  ) {

    return "Recorded";

  }


  const days =
    daysBetween(
      new Date(),
      expiry
    );


  if (
    days <
      0
  ) {

    return "Expired";

  }


  if (
    days <=
      30
  ) {

    return "Expiring";

  }


  return "Current";

}


function findLatestDocumentByType(
  type
) {

  return documents
    .filter(
      (
        record
      ) =>
        cleanString(
          record.documentType
        ).toUpperCase() ===
          type
    )
    .sort(
      newestFirstBy([
        "issuedDate",
        "createdAt"
      ])
    )[0]
    ||
    null;

}


function groupDocuments() {

  const groups =
    {};


  documents.forEach(
    (
      record
    ) => {

      const type =
        cleanString(
          record.documentType
        ).toUpperCase();


      let group =
        "Other";


      if (
        [
          "LOLER",
          "PUWER",
          "MOT",
          "INSURANCE"
        ].includes(
          type
        )
      ) {

        group =
          "Compliance";

      } else if (
        type.includes(
          "HIRE"
        )
      ) {

        group =
          "Hire";

      } else if (
        [
          "ON_HIRE_CONDITION",
          "OFF_HIRE_CONDITION",
          "CONDITION"
        ].includes(
          type
        )
      ) {

        group =
          "Condition";

      } else if (
        type.includes(
          "REPAIR"
        )
        ||
        type.includes(
          "PART"
        )
      ) {

        group =
          "Repair";

      } else if (
        type.includes(
          "DELIVERY"
        )
        ||
        type.includes(
          "TRANSPORT"
        )
        ||
        type.includes(
          "COLLECTION"
        )
      ) {

        group =
          "Transport";

      } else if (
        type.includes(
          "INVOICE"
        )
        ||
        type.includes(
          "COMMERCIAL"
        )
      ) {

        group =
          "Commercial";

      } else if (
        type.includes(
          "MANUAL"
        )
      ) {

        group =
          "Manuals";

      }


      if (
        !groups[group]
      ) {

        groups[group] =
          [];

      }


      groups[group].push(
        record
      );

    }
  );


  return groups;

}


function offHireNote() {

  if (
    !currentHireRecord?.expectedOffHireDate
  ) {

    return "No expected off-hire date recorded";

  }


  const days =
    daysBetween(
      new Date(),
      currentHireRecord.expectedOffHireDate
    );


  if (
    days ===
      null
  ) {

    return "Review hire period";

  }


  if (
    days <
      0
  ) {

    return `${Math.abs(
      days
    )} days past expected off-hire`;

  }


  if (
    days ===
      0
  ) {

    return "Expected off-hire today";

  }


  return `${days} days remaining`;

}


function offHireRequiresAttention() {

  if (
    !currentHireRecord?.expectedOffHireDate
  ) {

    return true;

  }


  const days =
    daysBetween(
      new Date(),
      currentHireRecord.expectedOffHireDate
    );


  return (
    days !==
      null

    &&

    days <=
      14
  );

}


function deriveNextAction(
  issue,
  maintenance,
  movement
) {

  if (
    issue?.nextMilestone
  ) {

    return issue.nextMilestone;

  }


  if (
    movement
  ) {

    return "Movement";

  }


  if (
    maintenance
  ) {

    return "Maintenance";

  }


  return "No action";

}


function deriveNextActionNote(
  issue,
  maintenance,
  movement
) {

  if (
    issue?.nextMilestone
  ) {

    return issue.nextMilestoneDate
      ? `Due ${formatDate(
          issue.nextMilestoneDate
        )}`
      : "Milestone date not recorded";

  }


  if (
    movement
  ) {

    return `${
      formatDate(
        movement.plannedDate
      )
    } · ${
      movement.toLocation ||
      "Destination not recorded"
    }`;

  }


  if (
    maintenance
  ) {

    return formatDate(
      maintenance.dueDate ||
      maintenance.plannedDate
    );

  }


  return "No immediate milestone recorded";

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


function newestFirstBy(
  fields
) {

  return (
    a,
    b
  ) => {

    const getTimestamp =
      (
        record
      ) => {

        for (
          const field of
          fields
        ) {

          const date =
            parseDate(
              record[field]
            );


          if (
            date
          ) {

            return date.getTime();

          }

        }


        return 0;

      };


    return (
      getTimestamp(
        b
      )
      -
      getTimestamp(
        a
      )
    );

  };

}


/* =========================================================
   ERROR
========================================================= */

function showLoadError(
  message
) {

  const root =
    getElement(
      "assetLoadError"
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


/* =========================================================
   START
========================================================= */

/* Master-data editing stays local to the Asset workspace. */
const ASSET_EDIT_FIELDS = Object.freeze({
  plantType: ["Plant type", 60], manufacturer: ["Manufacturer", 120], model: ["Model", 120],
  serialNumber: ["Serial number", 160], registrationNumber: ["Registration", 40],
  year: ["Year", 4], fuelType: ["Fuel / power", 80], operatingWeight: ["Operating weight", 100],
  capacity: ["Capacity / reach", 100], attachments: ["Attachments / equipment", 160],
  specification: ["Specification", 4000], notes: ["Notes", 4000]
});
let assetEditBaseline = null;
let assetEditSaving = false;

function canEditAsset(profile, org, record) {
  const bands = { WORKER: 0, SUPERVISOR: 1, SITE_MANAGER: 2, PROJECT_MANAGER: 3,
    SENIOR_PROJECT_MANAGER: 4, HEALTH_SAFETY: 4.5, SENIOR_HEALTH_SAFETY: 4.6,
    CONTRACTS_MANAGER: 5, PLANT_TRANSPORT_MANAGER: 5.5, ORGANISATION_MANAGER: 6, PLATFORM_ADMIN: 99 };
  if (!org || profile?.status !== "ACTIVE" || profile.organisationId !== org || record?.organisationId !== org ||
      !profile.permissions || typeof profile.permissions !== "object" || Array.isArray(profile.permissions) ||
      !Object.hasOwn(bands, profile.roleCode) || profile.accessLevel !== bands[profile.roleCode]) return false;
  return ["PLATFORM_ADMIN", "PLANT_TRANSPORT_MANAGER"].includes(profile.roleCode) ||
    profile.permissions?.canManagePlant === true || profile.permissions?.canManageOrganisation === true;
}

function normaliseAssetEditValue(key, value) {
  if (key === "attachments") {
    const entries = Array.isArray(value) ? value : String(value ?? "").split(/\r?\n/);
    return [...new Set(entries.map(item => String(item).trim()).filter(Boolean))];
  }

  const text = String(value ?? "").trim();
  return key === "year" && /^\d{4}$/.test(text) ? Number(text) : text || null;
}

function buildAssetEditUpdate(input, baseline, current, profile, org, uid, timestamp) {
  if (!uid || !canEditAsset(profile, org, current) || baseline.organisationId !== org)
    throw new Error("You no longer have permission to edit this asset in this organisation.");
  for (const key of ["id", "plantId", "plantReference", "organisationId"])
    if (baseline[key] !== current[key]) throw new Error("Asset identity changed. Close the editor and refresh before editing.");
  const changes = {};
  for (const [key, [label, maximum]] of Object.entries(ASSET_EDIT_FIELDS)) {
    const value = normaliseAssetEditValue(key, input[key]);
    if (["plantType", "manufacturer", "model"].includes(key) && !value) throw new Error(`${label} is required.`);
    if (key === "plantType" && !PLANT_TYPES.some(type => type.code === value)) throw new Error("Choose a known plant type.");
    if (key === "year" && value !== null && (!Number.isInteger(value) || value < 1900 || value > new Date().getFullYear() + 1))
      throw new Error("Enter a four-digit year from 1900 to next year, or leave it blank.");
    if (key === "attachments") {
      if (value.length > 50 || value.some(item => item.length > maximum)) throw new Error("Use at most 50 attachments, each up to 160 characters.");
    } else if (String(value ?? "").length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
    const previous = normaliseAssetEditValue(key, baseline[key]);
    if (JSON.stringify(value) === JSON.stringify(previous)) continue;
    if (JSON.stringify(normaliseAssetEditValue(key, current[key])) !== JSON.stringify(previous))
      throw new Error(`${label} was changed by another user. Your entries are retained; close and refresh before retrying.`);
    changes[key] = value;
  }
  if (!Object.keys(changes).length) return changes;
  return { ...changes, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp };
}

function readAssetEditForm() {
  return Object.fromEntries(Object.keys(ASSET_EDIT_FIELDS).map(key => [key, getElement(`assetEdit_${key}`).value]));
}

function hasAssetEditChanges() {
  if (!assetEditBaseline) return false;
  const input = readAssetEditForm();
  return Object.keys(ASSET_EDIT_FIELDS).some(key => JSON.stringify(normaliseAssetEditValue(key, input[key])) !==
    JSON.stringify(normaliseAssetEditValue(key, assetEditBaseline[key])));
}

function closeAssetEditor() {
  if (assetEditSaving || (hasAssetEditChanges() && !window.confirm("Discard your unsaved asset changes?"))) return;
  getElement("assetEditDialog").close();
  assetEditBaseline = null;
}

function openAssetEditor() {
  if (!auth.currentUser || !canEditAsset(currentProfile, organisationId, asset)) return;
  assetEditBaseline = { ...asset, attachments: Array.isArray(asset.attachments) ? [...asset.attachments] : [] };
  const sections = [ ["Identity", ["plantType", "manufacturer", "model", "serialNumber", "registrationNumber"]],
    ["Specification", ["year", "fuelType", "operatingWeight", "capacity"]],
    ["Attachments / equipment", ["attachments"]], ["Additional information", ["specification", "notes"]] ];
  getElement("assetEditFields").innerHTML = sections.map(([title, keys]) => `<section><h3>${title}</h3><div class="asset-edit-grid">${keys.map(key => {
    const [label, maximum] = ASSET_EDIT_FIELDS[key];
    const value = key === "attachments" ? assetEditBaseline.attachments.join("\n") : asset[key] ?? "";
    const required = ["plantType", "manufacturer", "model"].includes(key);
    const attributes = `id="assetEdit_${key}" name="${key}" ${required ? "required" : ""}`;
    let control;
    if (key === "plantType") control = `<select ${attributes}><option value="">Select plant type</option>${PLANT_TYPES.map(type => `<option value="${type.code}" ${type.code === value ? "selected" : ""}>${escapeHtml(type.label)}</option>`).join("")}</select>`;
    else if (["attachments", "specification", "notes"].includes(key)) control = `<textarea ${attributes} rows="3" maxlength="${key === "attachments" ? 8050 : maximum}">${escapeHtml(value)}</textarea>`;
    else control = `<input ${attributes} value="${escapeHtml(value)}" maxlength="${maximum}" ${key === "year" ? 'inputmode="numeric"' : ""}>`;
    return `<label class="${["attachments", "specification", "notes"].includes(key) ? "asset-edit-wide" : ""}" for="assetEdit_${key}">${label}${required ? " *" : ""}${control}${key === "attachments" ? "<small>One attachment per line.</small>" : key === "capacity" ? "<small>Include units, for example 4 tonnes / 17 metres.</small>" : ""}</label>`;
  }).join("")}</div></section>`).join("");
  setText("assetEditIdentity", asset.plantReference || asset.plantId || asset.id);
  setText("assetEditOwnership", `${getPlantOwnershipLabel(asset.ownershipType)} · Ownership locked`);
  getElement("assetEditError").hidden = true;
  getElement("assetEditConfirmation").hidden = true;
  getElement("assetEditDialog").showModal();
}

async function saveAssetEdit(event) {
  event.preventDefault();
  if (assetEditSaving || !assetEditBaseline) return;
  const errorElement = getElement("assetEditError");
  errorElement.hidden = true;
  assetEditSaving = true;
  getElement("assetEditFields").disabled = true;
  getElement("assetEditSave").disabled = true;
  setText("assetEditSave", "Saving…");
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Your session has ended. Sign in again before saving.");
    const baseline = assetEditBaseline;
    const input = readAssetEditForm();
    // Validate before starting a network request; revalidate against fresh records inside the transaction.
    buildAssetEditUpdate(input, baseline, baseline, currentProfile, organisationId, uid, null);
    const result = await runTransaction(db, async transaction => {
      if (auth.currentUser?.uid !== uid) throw new Error("Your signed-in user changed. Close and reopen the editor.");
      const profileSnapshot = await transaction.get(doc(db, "users", uid));
      const reference = doc(db, "plantAssets", baseline.id);
      const snapshot = await transaction.get(reference);
      if (!profileSnapshot.exists() || !snapshot.exists()) throw new Error("Your profile or this asset is no longer available.");
      const latest = { ...snapshot.data(), id: snapshot.id };
      const update = buildAssetEditUpdate(input, baseline, latest, profileSnapshot.data(), organisationId, uid, serverTimestamp());
      if (auth.currentUser?.uid !== uid) throw new Error("Your signed-in user changed. Close and reopen the editor.");
      if (Object.keys(update).length) transaction.update(reference, update);
      return { latest, update };
    });
    asset = { ...result.latest, ...result.update };
    const changed = Object.keys(result.update).filter(key => Object.hasOwn(ASSET_EDIT_FIELDS, key));
    assetEditBaseline = null;
    getElement("assetEditDialog").close();
    renderHero();
    renderSelectedView();
    setText("assetEditConfirmation", changed.length ? `Asset updated · ${changed.map(key => ASSET_EDIT_FIELDS[key][0]).join(", ")}` : "No changes to save.");
    getElement("assetEditConfirmation").hidden = false;
  } catch (error) {
    errorElement.textContent = error.code?.includes("permission-denied") ? "Save denied. Your permission may have changed. Your entries have been retained." :
      error.code?.includes("unavailable") ? "Unable to connect. Your entries are retained; reconnect and try again." : error.message || "Unable to save. Your entries have been retained.";
    errorElement.hidden = false;
  } finally {
    assetEditSaving = false;
    getElement("assetEditFields").disabled = false;
    getElement("assetEditSave").disabled = false;
    setText("assetEditSave", "Save changes");
  }
}

function bindAssetEditing() {
  getElement("assetEditButton").onclick = openAssetEditor;
  getElement("assetEditClose").onclick = closeAssetEditor;
  getElement("assetEditCancel").onclick = closeAssetEditor;
  getElement("assetEditForm").onsubmit = saveAssetEdit;
  getElement("assetEditDialog").oncancel = event => { event.preventDefault(); closeAssetEditor(); };
  window.addEventListener("beforeunload", event => {
    if (assetEditSaving || hasAssetEditChanges()) { event.preventDefault(); event.returnValue = ""; }
  });
}

/* Location and deployment are controlled event writes. */
let deploymentMode = null;
let deploymentProjects = [];
let deploymentSaving = false;

function localCalendarDay() { return new Date().toISOString().slice(0, 10); }
function activeAssignment(record) {
  const status = cleanString(record?.status).toUpperCase();
  return ["ACTIVE", "CONFIRMED", "PLANNED"].includes(status) && (!record.assignedUntil || String(record.assignedUntil).slice(0, 10) >= localCalendarDay());
}
function getCurrentAssignment(records) { return records.filter(activeAssignment).sort((a, b) => String(b.assignedFrom || "").localeCompare(String(a.assignedFrom || "")))[0] || null; }
function deploymentActor(profile, record) { return canEditAsset(profile, organisationId, record); }

async function loadDeploymentProjects() {
  try {
    const snapshot = await getDocs(query(collection(db, "projects"), where("organisationId", "==", organisationId)));
    deploymentProjects = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(project => !["CLOSED", "CANCELLED", "ARCHIVED"].includes(cleanString(project.status).toUpperCase()));
    return deploymentProjects;
  } catch (error) {
    deploymentProjects = [];
    throw new Error(error.code?.includes("permission-denied") ? "Projects are unavailable to your account, so an assignment cannot be created." : "Projects could not be loaded. Try again when the connection is available.");
  }
}

function openDeploymentEditor(mode) {
  if (!auth.currentUser || !deploymentActor(currentProfile, asset)) return;
  deploymentMode = mode;
  const dialog = getElement("deploymentDialog");
  const current = getCurrentAssignment(assignments);
  setText("deploymentIdentity", asset.plantReference || asset.plantId || asset.id);
  setText("deploymentCurrentPosition", `${asset.currentProjectName || "No project"} · ${asset.currentLocationLabel || "Location not confirmed"}`);
  getElement("deploymentError").hidden = true;
  const titles = { location: ["Confirm / Update Location", "Record the asset's current location. This does not create a transport movement."], assign: ["Assign to Project", "Create a project deployment record and update the current project."], reassign: ["Reassign Asset", "Release the active assignment and create a new project deployment record."], release: ["Release Asset", "Close the active assignment and clear the current project."] };
  setText("deploymentTitle", titles[mode][0]); setText("deploymentDescription", titles[mode][1]);
  setText("deploymentHelp", mode === "location" ? "A location confirmation is retained in the asset history." : "Assignment history is retained; this action does not create a movement.");
  if (mode === "location") {
    getElement("deploymentFields").innerHTML = `<section><h3>Current Location</h3><div class="asset-edit-grid"><label class="asset-edit-wide">Location *<input id="deploymentLocation" maxlength="160" value="${escapeHtml(asset.currentLocationLabel || "")}" required><small>Use a clear site, depot or supplier location.</small></label></div></section>`;
    getElement("deploymentSave").textContent = "Confirm location";
    dialog.showModal(); return;
  }
  if (mode === "release") {
    if (!current) return;
    getElement("deploymentFields").innerHTML = `<section><h3>Release from project</h3><p class="asset-deployment-actions__restricted">This will close the active assignment to ${escapeHtml(current.projectName || current.projectId)} today. Physical collection or relocation belongs in Movements.</p></section>`;
    getElement("deploymentSave").textContent = "Release asset";
    dialog.showModal(); return;
  }
  getElement("deploymentFields").innerHTML = `<section><h3>Project</h3><div class="asset-edit-grid"><label class="asset-edit-wide">Project *<select id="deploymentProject" required><option value="">Loading projects…</option></select><small>Only projects in this organisation can be selected.</small></label></div></section>`;
  getElement("deploymentSave").textContent = mode === "reassign" ? "Reassign asset" : "Assign asset";
  dialog.showModal();
  loadDeploymentProjects().then(projects => {
    const select = getElement("deploymentProject"); if (!select || !dialog.open) return;
    select.innerHTML = `<option value="">Select project</option>${projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name || project.projectName || project.projectCode || project.id)}</option>`).join("")}`;
  }).catch(error => { const errorElement = getElement("deploymentError"); errorElement.textContent = error.message; errorElement.hidden = false; getElement("deploymentSave").disabled = true; });
}

function closeDeploymentEditor() { if (!deploymentSaving) getElement("deploymentDialog").close(); }

function deploymentLocationUpdate(current, location, uid, profile, eventDate, timestamp) {
  const history = Array.isArray(current.locationHistory) ? current.locationHistory.slice(-99) : [];
  history.push({ type: "LOCATION_CONFIRMED", locationLabel: location, confirmedAt: eventDate, confirmedByUid: uid, confirmedByName: cleanString(profile.displayName) || null });
  return { currentLocationLabel: location, currentLocationConfirmedAt: timestamp, currentLocationConfirmedByUid: uid, currentLocationConfirmedByName: cleanString(profile.displayName) || null, locationHistory: history, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp };
}

async function saveDeployment(event) {
  event.preventDefault(); if (deploymentSaving || !deploymentMode) return;
  const errorElement = getElement("deploymentError"); errorElement.hidden = true; deploymentSaving = true;
  getElement("deploymentFields").disabled = true; getElement("deploymentSave").disabled = true;
  try {
    const uid = auth.currentUser?.uid; if (!uid) throw new Error("Your session has ended. Sign in again before saving.");
    const mode = deploymentMode, eventDate = localCalendarDay();
    const location = mode === "location" ? cleanString(getElement("deploymentLocation")?.value) : null;
    const selectedProjectId = ["assign", "reassign"].includes(mode) ? cleanString(getElement("deploymentProject")?.value) : null;
    if (mode === "location" && !location) throw new Error("Enter the current location.");
    if (["assign", "reassign"].includes(mode) && !selectedProjectId) throw new Error("Select a project.");
    const result = await runTransaction(db, async transaction => {
      const profileSnapshot = await transaction.get(doc(db, "users", uid));
      const assetReference = doc(db, "plantAssets", asset.id); const assetSnapshot = await transaction.get(assetReference);
      if (!profileSnapshot.exists() || !assetSnapshot.exists()) throw new Error("Your profile or this asset is no longer available.");
      const latest = { ...assetSnapshot.data(), id: assetSnapshot.id }, profile = profileSnapshot.data();
      if (auth.currentUser?.uid !== uid || !deploymentActor(profile, latest)) throw new Error("You no longer have permission to change this asset.");
      const assignmentSnapshot = await transaction.get(query(collection(db, "plantAssignments"), where("organisationId", "==", organisationId)));
      const related = assignmentSnapshot.docs.map(item => ({ ...item.data(), id: item.id })).filter(record => recordBelongsToAsset({ ...record, plantId: record.plantId }));
      const current = getCurrentAssignment(related); if (related.filter(activeAssignment).length > 1) throw new Error("Multiple active assignments need review before this asset can be changed.");
      const timestamp = serverTimestamp(); let assetUpdate = {};
      if (mode === "location") assetUpdate = deploymentLocationUpdate(latest, location, uid, profile, eventDate, timestamp);
      else if (mode === "release") { if (!current) throw new Error("There is no active assignment to release."); transaction.update(doc(db, "plantAssignments", current.id), { status: "RELEASED", assignedUntil: eventDate, releasedAt: timestamp, releasedByUid: uid, releasedByName: cleanString(profile.displayName) || null, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp }); assetUpdate = { currentProjectId: null, currentProjectName: null, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp }; }
      else {
        const projectSnapshot = await transaction.get(doc(db, "projects", selectedProjectId)); if (!projectSnapshot.exists()) throw new Error("The selected project is no longer available.");
        const project = projectSnapshot.data(); if (project.organisationId !== organisationId || ["CLOSED", "CANCELLED", "ARCHIVED"].includes(cleanString(project.status).toUpperCase())) throw new Error("The selected project cannot receive this asset.");
        if (current && mode === "assign") throw new Error("This asset already has an active assignment. Use Reassign instead.");
        if (current) transaction.update(doc(db, "plantAssignments", current.id), { status: "RELEASED", assignedUntil: eventDate, releasedAt: timestamp, releasedByUid: uid, releasedByName: cleanString(profile.displayName) || null, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp });
        const assignmentReference = doc(collection(db, "plantAssignments")); transaction.set(assignmentReference, { organisationId, plantId: latest.plantId, plantReference: latest.plantReference || latest.plantId, assetId: latest.id, projectId: selectedProjectId, projectName: cleanString(project.name || project.projectName || project.projectCode || selectedProjectId), status: "ACTIVE", assignedFrom: eventDate, createdByUid: uid, createdByName: cleanString(profile.displayName) || null, createdAt: timestamp, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp });
        assetUpdate = { currentProjectId: selectedProjectId, currentProjectName: cleanString(project.name || project.projectName || project.projectCode || selectedProjectId), updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp };
      }
      transaction.update(assetReference, assetUpdate); return { latest, assetUpdate };
    });
    asset = { ...result.latest, ...result.assetUpdate, ...(deploymentMode === "location" ? { currentLocationConfirmedAt: eventDate } : {}) };
    await loadAssignments(); renderHero(); renderSelectedView(); closeDeploymentEditor(); setText("assetEditConfirmation", deploymentMode === "location" ? "Location confirmed" : deploymentMode === "release" ? "Asset released from project" : deploymentMode === "reassign" ? "Asset reassigned" : "Asset assigned to project"); getElement("assetEditConfirmation").hidden = false;
  } catch (error) { errorElement.textContent = error.code?.includes("permission-denied") ? "Save denied. Your entries are retained." : error.message || "Unable to save. Your entries are retained."; errorElement.hidden = false; }
  finally { deploymentSaving = false; getElement("deploymentFields").disabled = false; getElement("deploymentSave").disabled = false; }
}

function bindDeploymentWorkflow() {
  getElement("deploymentClose").onclick = closeDeploymentEditor; getElement("deploymentCancel").onclick = closeDeploymentEditor; getElement("deploymentForm").onsubmit = saveDeployment;
  getElement("deploymentDialog").oncancel = event => { event.preventDefault(); closeDeploymentEditor(); };
}

waitForWorkspace();
