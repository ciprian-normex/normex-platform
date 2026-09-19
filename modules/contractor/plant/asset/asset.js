import {
  db
} from "/js/firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
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

let assetDocumentId =
  null;

let selectedView =
  "overview";


let asset =
  null;

let hireRecords =
  [];

let currentHireRecord =
  null;

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

      ...data

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
    snapshot.docs.find(
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
    !matching
  ) {

    asset =
      null;


    showLoadError(
      "The selected plant asset does not exist."
    );


    return;

  }


  asset = {

    id:
      matching.id,

    ...matching.data()

  };

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

  const records =
    await loadOrganisationCollection(
      "plantHireRecords"
    );


  hireRecords =
    records.filter(
      recordBelongsToAsset
    );

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

  if (
    !hireRecords.length
  ) {

    currentHireRecord =
      null;

    return;

  }


  const preferredId =
    cleanString(
      asset.currentHireRecordId
    );


  if (
    preferredId
  ) {

    const exact =
      hireRecords.find(
        (
          record
        ) =>
          record.id ===
            preferredId
      );


    if (
      exact
    ) {

      currentHireRecord =
        exact;

      return;

    }

  }


  currentHireRecord =
    hireRecords
      .slice()
      .sort(
        (
          a,
          b
        ) => {

          const aActive =
            [
              "ACTIVE",
              "OFF_HIRE_REQUESTED"
            ].includes(
              cleanString(
                a.status
              ).toUpperCase()
            )
              ? 1
              : 0;


          const bActive =
            [
              "ACTIVE",
              "OFF_HIRE_REQUESTED"
            ].includes(
              cleanString(
                b.status
              ).toUpperCase()
            )
              ? 1
              : 0;


          if (
            aActive !==
              bActive
          ) {

            return (
              bActive -
              aActive
            );

          }


          return (

            (
              parseDate(
                b.hireStartDate ||
                b.createdAt
              )?.getTime()
              ||
              0
            )

            -

            (
              parseDate(
                a.hireStartDate ||
                a.createdAt
              )?.getTime()
              ||
              0
            )

          );

        }
      )[0]
    ||
    null;

}


/* =========================================================
   HERO
========================================================= */

function renderHero() {

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

  return [
    "HIRED",
    "LEASED",
    "CROSS_HIRED"
  ].includes(
    cleanString(
      asset?.ownershipType
    ).toUpperCase()
  );

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

  if (
    !currentHireRecord?.hireStartDate
  ) {

    return null;

  }


  const finish =
    currentHireRecord.offHireConfirmedDate ||
    new Date();


  const days =
    daysBetween(
      currentHireRecord.hireStartDate,
      finish
    );


  if (
    days ===
      null
  ) {

    return null;

  }


  return Math.max(
    1,
    days +
      1
  );

}


function calculateHireExposure() {

  if (
    currentHireRecord?.hireRate ==
      null

    ||

    !currentHireRecord?.hireStartDate
  ) {

    return null;

  }


  const days =
    calculateHireDays();


  if (
    days ===
      null
  ) {

    return null;

  }


  const rate =
    Number(
      currentHireRecord.hireRate
    );


  if (
    !Number.isFinite(
      rate
    )
  ) {

    return null;

  }


  switch (
    cleanString(
      currentHireRecord.hireRateUnit
    ).toUpperCase()
  ) {

    case "DAY":

      return days *
        rate;


    case "MONTH":

      return (
        days /
        30.4375
      )
      *
      rate;


    case "WEEK":

    default:

      return (
        days /
        7
      )
      *
      rate;

  }

}


function weeklyHireRate() {

  if (
    currentHireRecord?.hireRate ==
      null
  ) {

    return null;

  }


  const rate =
    Number(
      currentHireRecord.hireRate
    );


  if (
    !Number.isFinite(
      rate
    )
  ) {

    return null;

  }


  switch (
    cleanString(
      currentHireRecord.hireRateUnit
    ).toUpperCase()
  ) {

    case "DAY":

      return rate *
        7;


    case "MONTH":

      return rate *
        12 /
        52;


    case "WEEK":

    default:

      return rate;

  }

}


function formatHireRate() {

  if (
    !currentHireRecord

    ||

    currentHireRecord.hireRate ==
      null
  ) {

    return "Not recorded";

  }


  return `${
    formatCurrency(
      currentHireRecord.hireRate
    )
  } / ${
    cleanString(
      currentHireRecord.hireRateUnit ||
      "WEEK"
    ).toLowerCase()
  }`;

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


  const timeline =
    buildDeploymentTimeline();


  root.innerHTML = `

    ${sectionHeading(
      "Operational Location",
      "Location & Deployment",
      "Where the plant is, where it has been and what is planned next."
    )}


    <div class="asset-summary-grid">


      ${summaryCard(
        "Current Location",
        asset.currentLocationLabel ||
        "Not confirmed",
        asset.currentLocationConfirmedAt
          ? `Confirmed ${formatDate(
              asset.currentLocationConfirmedAt
            )}`
          : "Location should be confirmed"
      )}


      ${summaryCard(
        "Current Project",
        asset.currentProjectName ||
        "Not allocated",
        asset.currentProjectName
          ? "Current deployment"
          : "No active project recorded"
      )}


      ${summaryCard(
        "Operational State",
        deriveCurrentUse(),
        getPlantStatusLabel(
          asset.status ||
          "AVAILABLE"
        )
      )}


      ${summaryCard(
        "Next Movement",
        getNextMovement()
          ? formatDate(
              getNextMovement().plannedDate
            )
          : "Not planned",
        getNextMovement()?.toLocation ||
        "No future movement recorded"
      )}


    </div>


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
      "No hire record",
      "No current hire agreement is linked to this asset."
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
                    record.hireRate !=
                      null
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
          "Assigned to project",

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
    asset.currentLocationConfirmedAt
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

waitForWorkspace();