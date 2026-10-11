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

let people =
  [];

let peopleReadComplete =
  false;

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
let documentsReadComplete =
  false;

const relatedReadStatus = {};


let canManagePlant =
  false;

let canViewPlantCosts =
  false;

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

function resolvedAssetClass(
  record
) {

  const explicitClass =
    cleanString(
      record?.assetClass
    ).toUpperCase();


  if (
    [
      "ROAD_VEHICLE",
      "PLANT_MACHINERY",
      "SMALL_PLANT",
      "TRAILER_ATTACHMENT",
      "OTHER"
    ].includes(
      explicitClass
    )
  ) {

    return explicitClass;

  }


  return cleanString(
    record?.plantType
  )
    ? "PLANT_MACHINERY"
    : "OTHER";

}


function isRoadVehicle() {
  return resolvedAssetClass(asset) === "ROAD_VEHICLE";
}


function isPlantMachinery() {
  return resolvedAssetClass(asset) === "PLANT_MACHINERY";
}


function assetClassLabel() {
  const labels = {
    ROAD_VEHICLE: "Road Vehicle",
    PLANT_MACHINERY: "Plant & Machinery",
    SMALL_PLANT: "Small Plant",
    TRAILER_ATTACHMENT: "Trailer / Attachment",
    OTHER: "Other Asset"
  };

  return labels[resolvedAssetClass(asset)] || labels.OTHER;
}


function unknownValue(value) {
  return cleanString(value) || "Not recorded";
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


function personDisplayName(
  person
) {

  return cleanString(
    person?.displayName
    ||
    [person?.firstName, person?.lastName].filter(Boolean).join(" ")
  );

}


function activeAssignmentsOfType(
  records,
  assignmentType
) {

  return records
    .filter(
      record =>
        cleanString(record.assignmentType).toUpperCase() === assignmentType
        &&
        activeAssignment(record)
    )
    .sort(
      (a, b) => String(b.assignedFrom || "").localeCompare(String(a.assignedFrom || ""))
    );

}


function currentPersonAssignment(
  records = assignments
) {

  return activeAssignmentsOfType(records, "PERSON")[0] || null;

}


function currentProjectAssignment(
  records = assignments
) {

  return activeAssignmentsOfType(records, "PROJECT")[0] || null;

}


function primaryAssignmentRecord() {
  return isRoadVehicle() ? currentPersonAssignment() : currentProjectAssignment();
}


function primaryAssignmentLabel() {
  return isRoadVehicle() ? "Assigned To" : "Current Project";
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
    record.assetId,
    record.entityId

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
  bindLifecycleWorkflow();


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


    relatedReadStatus[collectionName] = true;
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


    relatedReadStatus[collectionName] = false;
    return [];

  }

}


async function loadAssetLinkedCollection(
  collectionName,
  includeEntityId = false
) {

  const assetIdentifiers = [asset?.id, asset?.plantId, asset?.plantReference]
    .map(cleanString)
    .filter((value, index, list) => value && list.indexOf(value) === index);
  const fields = ["assetId", "plantId", "plantReference"];
  const identifiers = fields.flatMap(field => assetIdentifiers.map(value => [field, value]));

  if (includeEntityId) {
    identifiers.push(...assetIdentifiers.map(value => ["entityId", value]));
  }

  const reads = identifiers
    .filter(([, value], index, list) => cleanString(value) && list.findIndex(([field, candidate]) => field === identifiers[index][0] && candidate === value) === index)
    .map(([field, value]) => getDocs(query(
      collection(db, collectionName),
      where("organisationId", "==", organisationId),
      where(field, "==", value)
    )));

  const snapshots = await Promise.all(reads);
  const records = new Map();
  snapshots.forEach(snapshot => snapshot.docs.forEach(item => records.set(item.id, { id: item.id, ...item.data() })));
  return [...records.values()];

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


async function loadPeople() {

  peopleReadComplete = false;

  try {

    const snapshot =
      await getDocs(
        query(
          collection(db, "people"),
          where("organisationId", "==", organisationId)
        )
      );

    people = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(person => {
        const status = cleanString(person.employmentStatus).toUpperCase();
        const disabled = person.disabled === true || cleanString(person.disabled).toUpperCase() === "TRUE" || person.isDisabled === true;
        const inactive = cleanString(person.status).toUpperCase() === "INACTIVE" || cleanString(person.personStatus).toUpperCase() === "INACTIVE";
        return !["LEFT", "INACTIVE", "DISABLED", "ARCHIVED"].includes(status) && person.archived !== true && !disabled && !inactive;
      });
    peopleReadComplete = true;

  } catch (error) {

    console.warn("NORMEX people records unavailable:", error);
    people = [];
    peopleReadComplete = false;

  }

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

  documentsReadComplete = false;

  try {

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "documents"
          ),
          where(
            "organisationId",
            "==",
            organisationId
          )
        )
      );

    const records = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));


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

    documentsReadComplete = true;


  } catch (
    error
  ) {

    console.warn(
      "NORMEX Plant documents unavailable:",
      error
    );


    documents =
      [];

    documentsReadComplete = false;

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
  renderLifecycleVisibility();

  if (
    !asset
  ) {

    return;

  }

  const assetClass = resolvedAssetClass(asset);
  const hero = getElement("assetHero");
  const workspace = getElement("assetWorkspace");
  if (hero) hero.dataset.assetClass = assetClass;
  if (workspace) workspace.dataset.assetClass = assetClass;

  const roadVehicle = assetClass === "ROAD_VEHICLE";
  const personAssignment = currentPersonAssignment();
  const projectAssignment = currentProjectAssignment();

  setText(
    "assetEyebrow",
    roadVehicle ? "Road Vehicle" : isPlantMachinery() ? "Plant & Machinery" : assetClassLabel()
  );

  setText(
    "assetReference",
    roadVehicle
      ? asset.registrationNumber || asset.plantReference || asset.plantId || asset.id
      : asset.plantReference || asset.plantId || asset.id
  );


  setText(
    "assetDescription",
    [
      asset.manufacturer,
      asset.model,
      roadVehicle
        ? asset.vehicleType
        : getPlantTypeLabel(asset.plantType)
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      )
    ||
    roadVehicle ? "Road vehicle details not recorded" : "Plant asset details not recorded"
  );

  setText("assetInternalReference", asset.plantReference || asset.plantId || asset.id);
  setText("assetClassLabel", assetClassLabel());
  const identityMeta = getElement("assetIdentityMeta");
  if (identityMeta) identityMeta.hidden = false;

  const positionLabels = roadVehicle
    ? ["Current Location", "Assigned To", "Current Use", "Operational Status", "Last Inspection", "Next Action"]
    : ["Current Location", "Current Project", "Current Use", "Assigned To", "Last Inspection", "Next Action"];
  positionLabels.forEach((label, index) => setText(`assetPositionLabel${index + 1}`, label));


  setText(
    "assetCurrentLocation",
    unknownValue(asset.currentLocationLabel)
  );


  setText(
    "assetCurrentProject",
    roadVehicle
      ? "Not applicable"
      : unknownValue(projectAssignment?.projectName || asset.currentProjectName)
  );


  setText(
    "assetCurrentUse",
    deriveCurrentUse()
  );

  setText(
    "assetHeroAssignment",
    isRoadVehicle()
      ? unknownValue(personAssignment?.personName || asset.currentAssignedPersonName)
      : unknownValue(projectAssignment?.projectName || asset.currentProjectName)
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
        "Not recorded"
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
      : "Not recorded"
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
      roadVehicle
        ? asset.registrationNumber || asset.plantReference || asset.plantId || "Road Vehicle"
        : asset.plantReference || asset.plantId || "Plant Asset"
    } | NORMEX`;

}


function isCanonicalPlatformAdmin(profile) {
  return Number(profile?.accessLevel) >= 99 && cleanString(profile?.roleCode).toUpperCase() === "PLATFORM_ADMIN";
}


function renderLifecycleVisibility() {
  const actions = getElement("assetLifecycleActions");
  const archiveButton = getElement("assetArchiveButton");
  const deleteButton = getElement("assetDeleteButton");
  const canArchive = canManagePlant === true;
  const canDelete = isCanonicalPlatformAdmin(currentProfile);
  if (actions) actions.hidden = !canArchive && !canDelete;
  if (archiveButton) archiveButton.hidden = !canArchive;
  if (deleteButton) deleteButton.hidden = !canDelete;
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

  bindAssetShortcuts();

}


function bindAssetShortcuts() {
  getElement("assetWorkspace")?.querySelectorAll("[data-asset-shortcut]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.assetShortcut && button.dataset.assetShortcut !== "#") window.location.href = button.dataset.assetShortcut;
    });
  });
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
      isRoadVehicle() ? "Current operational and service position for this road vehicle." : "Current operational and financial position for this plant asset."
    )}


    <div class="asset-control-grid">
      ${renderClassAwareOverviewControls(
        latestInspection,
        nextMaintenance,
        nextMovement,
        primaryIssue,
        openDefects
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
              ${isRoadVehicle() ? "Vehicle Details / Current Position" : "Current Plant Position"}
            </h4>

            <p>
              ${isRoadVehicle() ? "Vehicle identity, service baseline and present control state." : "Identity, deployment and present control state."}
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

  root.querySelectorAll("[data-deployment-action]").forEach(button => {
    button.addEventListener("click", () => openDeploymentEditor(button.dataset.deploymentAction));
  });

}


function renderClassAwareOverviewControls(
  latestInspection,
  nextMaintenance,
  nextMovement,
  primaryIssue,
  openDefects
) {

  const inspectionDate = latestInspection
    ? formatDate(latestInspection.inspectionDate || latestInspection.completedAt || latestInspection.createdAt)
    : unknownValue(asset.lastInspectionLabel);
  const personAssignment = currentPersonAssignment();
  const projectAssignment = currentProjectAssignment();

  if (isRoadVehicle()) {
    const canManageAssignment = canEditAsset(currentProfile, organisationId, asset);
    const assignmentAction = personAssignment ? "person-change" : "person-assign";
    const assignmentLabel = personAssignment ? "Change Person" : "Assign Person";
    const assignmentCard = `
      <div class="asset-overview-assignment">
        ${controlCard("Assigned To", personAssignment?.personName || asset.currentAssignedPersonName || "Not allocated", "Primary person responsibility")}
        ${canManageAssignment ? `<button type="button" class="asset-action-button asset-action-button--primary" data-deployment-action="${assignmentAction}">${assignmentLabel}</button>` : ""}
      </div>
    `;

    return [
      controlCard("Availability", deriveCurrentUse(), "Current vehicle state", isOffRoad() ? "alert" : ""),
      controlCard("MOT", asset.motExpiry ? formatDate(asset.motExpiry) : "Not recorded", asset.motExpiry ? "Expiry date" : "MOT evidence required", asset.motExpiry ? "" : "watch"),
      controlCard("Service", relatedReadStatus.plantMaintenance === false ? "Unknown" : asset.nextServiceDate ? formatDate(asset.nextServiceDate) : "Not recorded", relatedReadStatus.plantMaintenance === false ? "Maintenance read failed" : asset.lastServiceDate ? `Last ${formatDate(asset.lastServiceDate)}` : "Service baseline incomplete", relatedReadStatus.plantMaintenance === false || !asset.nextServiceDate ? "watch" : ""),
      controlCard("Inspection", inspectionDate, latestInspection ? formatText(latestInspection.result || "Recorded") : "No inspection history", latestInspection ? "" : "watch"),
      controlCard("Defects", relatedReadStatus.plantDefects === false ? "Unknown" : String(openDefects.length), relatedReadStatus.plantDefects === false ? "Defect read failed" : openDefects.length ? "Unresolved vehicle faults" : "No open defects recorded", relatedReadStatus.plantDefects === false ? "watch" : openDefects.length ? "alert" : ""),
      assignmentCard
    ].join("");
  }

  const canManageAssignment = canEditAsset(currentProfile, organisationId, asset);
  const assignmentAction = projectAssignment ? "project-change" : "project-assign";
  const assignmentLabel = projectAssignment ? "Change Project" : "Assign Project";
  const assignmentCard = `
    <div class="asset-overview-assignment">
      ${controlCard("Current Project", projectAssignment?.projectName || asset.currentProjectName || "Not allocated", "Primary project responsibility")}
      ${canManageAssignment ? `<button type="button" class="asset-action-button asset-action-button--primary" data-deployment-action="${assignmentAction}">${assignmentLabel}</button>` : ""}
    </div>
  `;

  return [
    controlCard("Availability", deriveCurrentUse(), asset.currentProjectName || "Current asset position", isOffRoad() ? "alert" : ""),
    controlCard("Compliance", deriveComplianceLabel(), "Current evidence position", asset.complianceHold === true ? "alert" : ""),
    controlCard("Maintenance", relatedReadStatus.plantMaintenance === false ? "Unknown" : nextMaintenance ? formatDate(nextMaintenance.dueDate || nextMaintenance.plannedDate) : "Not recorded", relatedReadStatus.plantMaintenance === false ? "Maintenance read failed" : nextMaintenance ? "Next planned service" : "Maintenance baseline incomplete", relatedReadStatus.plantMaintenance === false || !nextMaintenance ? "watch" : ""),
    controlCard("Inspection", inspectionDate, latestInspection ? formatText(latestInspection.result || "Recorded") : "No inspection history", latestInspection ? "" : "watch"),
    controlCard("Defects", relatedReadStatus.plantDefects === false ? "Unknown" : String(openDefects.length), relatedReadStatus.plantDefects === false ? "Defect read failed" : openDefects.length ? "Unresolved Plant faults" : "No open defects recorded", relatedReadStatus.plantDefects === false ? "watch" : openDefects.length ? "alert" : ""),
    assignmentCard
  ].join("");
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
            calculateActualMaintenanceSpend(),
            "Completed maintenance only"
          )}

          ${financialCard(
            "Committed Maintenance",
            calculateCommittedMaintenanceCost(),
            "Scheduled and planned maintenance"
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
            Current rate, duration and hire exposure for this ${isRoadVehicle() ? "vehicle" : "machine"}.
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
              All hire periods recorded against this ${isRoadVehicle() ? "vehicle asset" : "Plant ID"}.
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
        calculateActualMaintenanceSpend(),
        "Completed maintenance costs"
      )}

      ${summaryCard(
        "Committed Maintenance",
        calculateCommittedMaintenanceCost(),
        "Scheduled and planned maintenance"
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
        relatedReadStatus.plantDefects === false ? "Unknown" : String(getOpenDefects().length),
        relatedReadStatus.plantDefects === false ? "Defect read failed" : "Unresolved defect records",
        relatedReadStatus.plantDefects === false ? "watch" : getOpenDefects().length ? "alert" : ""
      )}


      ${summaryCard(
        "Next Service",
        relatedReadStatus.plantMaintenance === false
          ? "Unknown"
          : getNextMaintenance()
          ? formatDate(
              getNextMaintenance().dueDate ||
              getNextMaintenance().plannedDate
            )
          : "Not planned",
        relatedReadStatus.plantMaintenance === false ? "Maintenance read failed" : "Future maintenance"
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

  const root = getElement("assetWorkspace");
  if (!root) return;
  const timeline = buildDeploymentTimeline();
  const currentPerson = currentPersonAssignment();
  const currentProject = currentProjectAssignment();
  const canManageDeployment = canEditAsset(currentProfile, organisationId, asset);
  root.innerHTML = `
    ${sectionHeading("Operational Location", "Location & Deployment", isRoadVehicle() ? "Where the vehicle is, where it has been and what is planned next." : "Where the plant is, where it has been and what is planned next.")}
    ${renderDeploymentActionBar(canManageDeployment, currentPerson, currentProject)}
    <div class="asset-summary-grid">
      ${summaryCard(isRoadVehicle() ? "Assigned Person" : "Current Project", isRoadVehicle() ? currentPerson?.personName || asset.currentAssignedPersonName || "Not allocated" : currentProject?.projectName || asset.currentProjectName || "Not allocated", isRoadVehicle() ? (currentPerson ? `Since ${formatDate(currentPerson.assignedFrom)}` : "No active person assignment") : (currentProject ? `Since ${formatDate(currentProject.assignedFrom)}` : "No active project assignment"))}
      ${summaryCard(isRoadVehicle() ? "Current Project" : "Current Location", isRoadVehicle() ? "Not applicable" : asset.currentLocationLabel || "Not recorded", isRoadVehicle() ? "Road vehicle responsibility is person-based." : asset.currentLocationConfirmedByName || asset.currentLocationConfirmedByUid || "Confirmation required")}
      ${summaryCard("Location Confirmed", asset.currentLocationConfirmedAt ? formatDate(asset.currentLocationConfirmedAt) : "Not recorded", asset.currentLocationConfirmedByName || asset.currentLocationConfirmedByUid || "Confirmation required")}
      ${summaryCard("Operational State", deriveCurrentUse(), getPlantStatusLabel(asset.status || "AVAILABLE"))}
    </div>
    <section class="asset-panel">
      <div class="asset-panel__header"><div><h4>Location & Deployment History</h4><p>Assignment and movement records are presented together as one asset history.</p></div></div>
      ${timeline.length ? `<div class="asset-timeline">${timeline.map(renderTimelineRecord).join("")}</div>` : emptyState("No deployment history yet", isRoadVehicle() ? "Assignments, completed movements and location confirmations will build this vehicle history." : "Assignments, completed movements and location confirmations will build the location history for this machine.")}
    </section>`;
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

    ${renderAssetActionBar("Assurance history", "Create the next inspection in the owning workflow.", "+ New Inspection", "/modules/contractor/plant/compliance/")}


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
        relatedReadStatus.plantInspections === false ? "Unknown" : String(inspections.length),
        relatedReadStatus.plantInspections === false ? "Inspection read failed" : "Permanent asset history",
        relatedReadStatus.plantInspections === false ? "watch" : ""
      )}


      ${summaryCard(
        "Open Defects",
        relatedReadStatus.plantDefects === false ? "Unknown" : String(getOpenDefects().length),
        relatedReadStatus.plantDefects === false ? "Defect read failed" : "Defects currently unresolved",
        relatedReadStatus.plantDefects === false ? "watch" : getOpenDefects().length
          ? "alert"
          : ""
      )}


    </div>


    ${
      relatedReadStatus.plantInspections !== false && inspections.length
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
            relatedReadStatus.plantInspections === false ? "Inspections unavailable" : isRoadVehicle() ? "No inspections recorded for this vehicle" : "No inspections recorded",
            relatedReadStatus.plantInspections === false ? "The inspection query failed; no empty state is inferred." : isRoadVehicle() ? "Pre-use, on-hire, off-hire and formal inspection history will appear here." : "Once pre-use, on-hire, off-hire or formal inspections are linked to this asset, the complete history will appear here."
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
      relatedReadStatus.plantDefects === false ? "Read failed" : `${open.length} open`
    )}

    ${renderAssetActionBar("Reliability history", "Report a fault in the owning defects workflow.", "+ Report Defect", "/modules/contractor/plant/defects/")}


    <div class="asset-summary-grid">


      ${summaryCard(
        "Open Defects",
        relatedReadStatus.plantDefects === false ? "Unknown" : String(open.length),
        relatedReadStatus.plantDefects === false ? "Defect read failed" : "Unresolved faults",
        relatedReadStatus.plantDefects === false ? "watch" : open.length
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
            isRoadVehicle() ? "No defects recorded for this vehicle" : "No defects recorded",
            isRoadVehicle() ? "Reported faults, repairs, downtime and return-to-service history will remain linked to this vehicle." : "Reported faults, repairs, parts, downtime and return-to-service history will remain permanently linked to this machine."
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

    ${canManagePlant ? `<div class="asset-action-bar">
      <div class="asset-action-bar__context"><strong>Maintenance control</strong><span>Record service history and plan the next intervention.</span></div>
      <div class="asset-action-bar__actions">
        <button type="button" class="asset-action-button asset-action-button--primary" data-maintenance-action="plan">Plan Maintenance</button>
        ${isRoadVehicle() ? `<button type="button" class="asset-action-button" data-maintenance-action="service">Record Service</button><button type="button" class="asset-action-button" data-maintenance-action="mot">Record MOT</button><button type="button" class="asset-action-button" data-maintenance-action="mileage">Update Mileage</button>` : ""}
      </div>
    </div>` : ""}

    <div class="asset-summary-grid">
      ${renderMaintenanceBaseline()}
    </div>


    <div class="asset-summary-grid">


      ${summaryCard(
        "Next Service",
        relatedReadStatus.plantMaintenance === false
          ? "Unknown"
          : next
          ? formatDate(
              next.dueDate ||
              next.plannedDate
            )
          : "Not planned",
        relatedReadStatus.plantMaintenance === false ? "Maintenance read failed" : next?.maintenanceType || "No future maintenance recorded",
        relatedReadStatus.plantMaintenance === false ? "watch" : ""
      )}


      ${summaryCard("Maintenance Records", relatedReadStatus.plantMaintenance === false ? "Unknown" : String(maintenanceRecords.length), relatedReadStatus.plantMaintenance === false ? "Maintenance read failed" : "Permanent maintenance history", relatedReadStatus.plantMaintenance === false ? "watch" : "")}


      ${summaryCard(
        "Actual Spend",
        canViewPlantCosts
          ? calculateActualMaintenanceSpend()
          : "Restricted",
        "Completed maintenance costs"
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
      relatedReadStatus.plantMaintenance !== false && maintenanceRecords.length
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
                          renderMaintenanceRecordDetails(record)
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
            relatedReadStatus.plantMaintenance === false ? "Maintenance unavailable" : "No maintenance history",
            relatedReadStatus.plantMaintenance === false ? "The maintenance query failed; no empty state is inferred." : "Services, repairs, parts and planned maintenance will build the permanent asset record here."
          )
    }

  `;

  root.querySelectorAll("[data-maintenance-action]").forEach(button => button.addEventListener("click", () => openMaintenanceDialog(button.dataset.maintenanceAction)));

}


function renderMaintenanceBaseline() {

  const fields = isRoadVehicle()
    ? [
        ["Current Mileage", asset.currentMileage],
        ["MOT Expiry", formatDate(asset.motExpiry)],
        ["Last Service Date", formatDate(asset.lastServiceDate)],
        ["Last Service Mileage", asset.lastServiceMileage],
        ["Next Service", formatDate(asset.nextServiceDate)]
      ]
    : [
        ["Operating Hours", asset.operatingHours],
        ["Last Service Date", formatDate(asset.lastServiceDate)],
        ["Last Service Hours", asset.lastServiceHours],
        ["Next Service", formatDate(asset.nextServiceDate)]
      ];

  return fields.map(([label, value]) => summaryCard(label, unknownValue(value), "Asset master baseline")).join("");
}


function renderMaintenanceRecordDetails(
  record
) {

  const fields = [];
  const type = cleanString(record.maintenanceType).toUpperCase();
  const date = record.serviceDate || record.testDate || record.plannedDate || record.completedDate;
  if (date) fields.push(formatDate(date));
  if (type) fields.push(type);
  if (record.provider) fields.push(`Provider: ${record.provider}`);
  if (record.mileage !== undefined && record.mileage !== null && cleanString(record.mileage)) fields.push(`Mileage: ${record.mileage}`);
  if (record.estimatedCost !== undefined && record.estimatedCost !== null && cleanString(record.estimatedCost)) fields.push(`Estimated: ${formatCurrency(record.estimatedCost)}`);
  if (record.cost !== undefined && record.cost !== null && cleanString(record.cost)) fields.push(`Cost: ${formatCurrency(record.cost)}`);
  if (record.workCompleted) fields.push(`Work: ${record.workCompleted}`);
  if (record.result) fields.push(`Result: ${formatText(record.result)}`);
  if (record.newExpiryDate) fields.push(`Expiry: ${formatDate(record.newExpiryDate)}`);
  if (record.expectedReturnDate) fields.push(`Return: ${formatDate(record.expectedReturnDate)}`);
  if (record.nextServiceDate) fields.push(`Next service: ${formatDate(record.nextServiceDate)}`);
  if (record.nextServiceMileage !== undefined && record.nextServiceMileage !== null && cleanString(record.nextServiceMileage)) fields.push(`Next mileage: ${record.nextServiceMileage}`);
  if (record.notes) fields.push(`Notes: ${record.notes}`);
  return fields.join(" · ") || "Maintenance record";
}


/* =========================================================
   COMPLIANCE
========================================================= */

function renderComplianceView() {

  const root =
    getElement(
      "assetWorkspace"
    );


  const types = isRoadVehicle()
    ? ["MOT", "INSURANCE"]
    : isPlantMachinery()
      ? ["LOLER", "PUWER", "INSURANCE"]
      : ["LOLER", "PUWER", "MOT", "INSURANCE"];


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
      isRoadVehicle() ? "Vehicle Assurance" : "Plant Assurance",
      "Compliance",
      isRoadVehicle() ? "MOT and insurance evidence relevant to this road vehicle." : "Derived evidence position answering whether this machine can remain in service."
    )}

    ${isRoadVehicle() && canManagePlant ? `<div class="asset-action-bar"><div class="asset-action-bar__context"><strong>Evidence actions</strong><span>Evidence is stored through the controlled Documents workflow.</span></div><div class="asset-action-bar__actions"><button type="button" class="asset-action-button" data-document-action="MOT_CERTIFICATE">Add MOT Evidence</button><button type="button" class="asset-action-button" data-document-action="INSURANCE">Add Insurance</button></div></div>` : ""}


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
        documentsReadComplete ? String(documents.length) : "Unknown",
        documentsReadComplete ? "Documents linked to this asset" : "Document query failed"
      )}

      ${summaryCard(
        "Compliance Hold",
        asset.complianceHold === true ? "Yes" : asset.complianceHold === false ? "No" : "Not recorded",
        asset.complianceHold === true ? "Plant use restricted" : asset.complianceHold === false ? "No compliance hold recorded" : "Compliance hold state unknown",
        asset.complianceHold ===
          true
          ? "alert"
          : ""
      )}

      ${summaryCard(
        "Safe to Use",
        asset.safeToUse === true ? "Yes" : asset.safeToUse === false ? "No" : "Not recorded",
        asset.safeToUse === undefined || asset.safeToUse === null ? "Current cached safety state unavailable" : "Current cached safety state",
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

  root.querySelectorAll("[data-document-action]").forEach(button => button.addEventListener("click", () => openDocumentDialog(button.dataset.documentAction)));

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
      documentsReadComplete ? `${documents.length} records` : "Read failed"
    )}

    ${canManagePlant ? `<div class="asset-action-bar"><div class="asset-action-bar__context"><strong>Controlled evidence</strong><span>Add a PDF only when the Storage upload path is available.</span></div><div class="asset-action-bar__actions"><button type="button" class="asset-action-button asset-action-button--primary" data-document-action="">+ Add Document</button></div></div>` : ""}

    ${documentsReadComplete
      ? (documents.length
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

                            <div class="asset-document-actions">
                              <button type="button" disabled title="Unavailable while Firebase Storage rules deny reads">View</button>
                              <button type="button" disabled title="Metadata actions are held until the controlled document path is enabled">Edit Metadata</button>
                              <button type="button" disabled title="Unavailable while Firebase Storage rules deny writes">Replace / New Version</button>
                              <button type="button" disabled title="Metadata lifecycle action is not enabled in this pass">Archive</button>
                            </div>

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
            `LOLER certificates, hire contracts, condition photographs, repair evidence, invoices and manuals will be retained against this ${isRoadVehicle() ? "vehicle asset" : "Plant ID"}.`
          ))
      : emptyState("Documents unavailable", "The document query failed. No document count or health state is inferred.")
    }

  `;

  root.querySelectorAll("[data-document-action]").forEach(button => button.addEventListener("click", () => openDocumentDialog(button.dataset.documentAction || "")));

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


function renderAssetActionBar(
  context,
  explanation,
  label,
  path,
  secondary = ""
) {

  return `<div class="asset-action-bar"><div class="asset-action-bar__context"><strong>${escapeHtml(context)}</strong><span>${escapeHtml(explanation)}</span></div><div class="asset-action-bar__actions"><button type="button" class="asset-action-button asset-action-button--primary" data-asset-shortcut="${escapeHtml(`${path}?assetId=${encodeURIComponent(asset.id)}&assetReference=${encodeURIComponent(asset.plantReference || asset.plantId || "")}&assetClass=${encodeURIComponent(resolvedAssetClass(asset))}`)}">${escapeHtml(label)}</button>${secondary}</div></div>`;
}


function renderDeploymentActionBar(
  canManageDeployment,
  currentPerson,
  currentProject
) {

  if (!canManageDeployment) {
    return `<div class="asset-action-bar"><div class="asset-action-bar__context"><strong>Deployment is read-only</strong><span>Plant-management permission is required to change this asset's position.</span></div></div>`;
  }

  const personActions = isRoadVehicle()
    ? `${currentPerson ? `<button type="button" class="asset-action-button" data-deployment-action="person-change">Change Person</button><button type="button" class="asset-action-button" data-deployment-action="person-release">Release Person</button>` : `<button type="button" class="asset-action-button" data-deployment-action="person-assign">Assign Person</button>`}`
    : "";
  const projectActions = isRoadVehicle()
    ? ""
    : currentProject
      ? `<button type="button" class="asset-action-button" data-deployment-action="project-change">Change Project</button><button type="button" class="asset-action-button" data-deployment-action="project-release">Release Project</button>`
      : `<button type="button" class="asset-action-button asset-action-button--primary" data-deployment-action="project-assign">Assign Project</button>`;
  return `<div class="asset-action-bar"><div class="asset-action-bar__context"><strong>${isRoadVehicle() ? "Vehicle deployment" : "Plant deployment"}</strong><span>Assignment history and location confirmations are retained.</span></div><div class="asset-action-bar__actions">${personActions}${projectActions}<button type="button" class="asset-action-button" data-deployment-action="location">Confirm Location</button></div></div>`;
}


function assetShortcut(
  label,
  path,
  disabled = false
) {

  const target =
    path === "#"
      ? "#"
      : `${path}${path.includes("?") ? "&" : "?"}assetId=${encodeURIComponent(asset.id)}`;

  return `<div class="asset-action-row"><button type="button" class="asset-edit-primary" data-asset-shortcut="${escapeHtml(target)}" ${disabled ? "disabled title=\"Coming next\"" : ""}>${escapeHtml(label)}</button></div>`;
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

  const personAssignment = currentPersonAssignment();
  const projectAssignment = currentProjectAssignment();

  const fields = isRoadVehicle()
    ? [
        ["Registration", asset.registrationNumber],
        ["Make", asset.manufacturer],
        ["Model", asset.model],
        ["Vehicle Type", asset.vehicleType],
        ["VIN", asset.vin],
        ["Year", asset.year],
        ["Fuel", formatText(asset.fuelType)],
        ["Home Base", asset.homeBase],
        ["Current Mileage", asset.currentMileage],
        ["MOT Expiry", formatDate(asset.motExpiry)],
        ["Last Service Date", formatDate(asset.lastServiceDate)],
        ["Last Service Mileage", asset.lastServiceMileage],
        ["Next Service / Review", formatDate(asset.nextServiceDate)],
        ["Current Location", asset.currentLocationLabel],
        ["Assigned Person", personAssignment?.personName || asset.currentAssignedPersonName],
        ["Status", getPlantStatusLabel(asset.status || "AVAILABLE")]
      ]
    : [
        ["Plant ID", asset.plantReference || asset.plantId],
        ["Plant Type", getPlantTypeLabel(asset.plantType)],
        ["Manufacturer", asset.manufacturer],
        ["Model", asset.model],
        ["Serial Number", asset.serialNumber],
        ["Year", asset.year],
        ["Fuel", formatText(asset.fuelType)],
        ["Operating Weight", asset.operatingWeight],
        ["Capacity / Reach", asset.capacity],
        ["Operating Hours", asset.operatingHours],
        ["Home Base", asset.homeBase],
        ["Current Project", asset.currentProjectName],
        ["Current Location", asset.currentLocationLabel],
        ["Status", getPlantStatusLabel(asset.status || "AVAILABLE")],
        ["Specification", asset.specification],
        ["Notes", asset.notes]
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
                  unknownValue(value)
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
      `Hire periods will remain permanently linked to this ${isRoadVehicle() ? "vehicle asset" : "Plant ID"}.`
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
      const type = cleanString(record.assignmentType).toUpperCase();
      const assignmentLabel = type === "PERSON"
        ? record.personName || record.personId || "Person assignment"
        : record.projectName || record.projectId || "Project assignment";

      records.push({

        date:
          record.assignedFrom ||
          record.createdAt,

        type:
          "ASSIGNMENT",

        title:
          assignmentLabel,

        description:
          type === "PERSON"
            ? `Person assignment${record.createdByName || record.createdByUid ? ` by ${record.createdByName || record.createdByUid}` : ""}`
            : record.assignmentPurpose ||
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

  if (relatedReadStatus.plantDefects === false) return "Unknown";

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


function calculateActualMaintenanceSpend() {

  if (relatedReadStatus.plantMaintenance === false) return "Unknown";

  const total =
    maintenanceRecords.reduce(
      (
        sum,
        record
      ) => {

        if (cleanString(record.status).toUpperCase() !== "COMPLETED") return sum;
        const number = Number(record.cost ?? record.totalCost ?? record.actualCost);


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


function calculateCommittedMaintenanceCost() {

  if (relatedReadStatus.plantMaintenance === false) return "Unknown";

  const total =
    maintenanceRecords.reduce(
      (
        sum,
        record
      ) => {

        const status = cleanString(record.status).toUpperCase();
        if (!["SCHEDULED", "PLANNED", "IN_PROGRESS"].includes(status)) return sum;
        const number = Number(record.estimatedCost ?? record.cost ?? record.totalCost ?? 0);

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


function calculateMaintenanceSpend() {
  return calculateActualMaintenanceSpend();
}


function calculateTransportSpend() {

  if (relatedReadStatus.plantMovements === false) return "Unknown";

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

  if (relatedReadStatus.plantDefects === false) return "Unknown";

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

  const lifecycleStatus = cleanString(
    record.lifecycleStatus ||
    record.documentStatus
  ).toUpperCase();

  if (record.archived === true || ["ARCHIVED", "REPLACED", "SUPERSEDED"].includes(lifecycleStatus)) {
    return lifecycleStatus === "REPLACED" || lifecycleStatus === "SUPERSEDED" ? "Replaced" : "Archived";
  }

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

  const types = type === "MOT" ? ["MOT", "MOT_CERTIFICATE"] : [type];

  return documents
    .filter(
      (
        record
      ) =>
        types.includes(cleanString(record.documentType).toUpperCase())
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
          "MOT_CERTIFICATE",
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
const ASSET_EDIT_SCHEMAS = Object.freeze({
  ROAD_VEHICLE: {
    vehicleType: ["Vehicle type", 80], registrationNumber: ["Registration", 40], manufacturer: ["Manufacturer", 120],
    model: ["Model", 120], vin: ["VIN", 80], serialNumber: ["Serial number", 160], year: ["Year", 4],
    fuelType: ["Fuel", 80], homeBase: ["Home base", 160], currentMileage: ["Current mileage", 20],
    motExpiry: ["MOT expiry", 10], lastServiceDate: ["Last service date", 10], lastServiceMileage: ["Last service mileage", 20],
    nextServiceDate: ["Next service date", 10], specification: ["Specification", 4000], notes: ["Notes", 4000]
  },
  PLANT_MACHINERY: {
    plantType: ["Plant type", 60], manufacturer: ["Manufacturer", 120], model: ["Model", 120], serialNumber: ["Serial number", 160],
    year: ["Year", 4], fuelType: ["Fuel / power", 80], operatingWeight: ["Operating weight", 100], capacity: ["Capacity / reach", 100],
    operatingHours: ["Operating hours", 20], operatingHoursAt: ["Operating hours at", 10], homeBase: ["Home base", 160],
    lastServiceDate: ["Last service date", 10], lastServiceHours: ["Last service hours", 20], nextServiceDate: ["Next service date", 10],
    specification: ["Specification", 4000], notes: ["Notes", 4000]
  }
});
let assetEditBaseline = null;
let assetEditSaving = false;

function assetEditFields() {
  return ASSET_EDIT_SCHEMAS[resolvedAssetClass(asset)] || ASSET_EDIT_SCHEMAS.PLANT_MACHINERY;
}

function assetManagementAuthority(profile, org, record) {
  if (!org || !profile || cleanString(profile.status).toUpperCase() !== "ACTIVE") return false;
  if (cleanString(profile.organisationId) !== cleanString(org)) return false;
  if (record && cleanString(record.organisationId) !== cleanString(org)) return false;

  const permissions = profile.permissions || {};
  const roleCode = cleanString(profile.roleCode || profile.role).toUpperCase();
  const accessLevel = Number(profile.accessLevel ?? 0);

  return accessLevel >= 99 ||
    roleCode === "PLATFORM_ADMIN" ||
    roleCode === "PLANT_TRANSPORT_MANAGER" ||
    roleCode === "ORGANISATION_MANAGER" ||
    permissions.canManagePlant === true ||
    permissions.canManageTransport === true ||
    permissions.canManageOrganisation === true;
}

function canEditAsset(profile, org, record) {
  return assetManagementAuthority(profile, org, record);
}

function normaliseAssetEditValue(key, value) {
  const text = String(value ?? "").trim();
  return key === "year" && /^\d{4}$/.test(text) ? Number(text) : text || null;
}

function buildAssetEditUpdate(input, baseline, current, profile, org, uid, timestamp) {
  if (!uid || !canEditAsset(profile, org, current) || baseline.organisationId !== org)
    throw new Error("You no longer have permission to edit this asset in this organisation.");
  for (const key of ["id", "assetClass", "plantId", "plantReference", "organisationId", "ownershipType", "createdByUid", "createdAt"])
    if (baseline[key] !== current[key]) throw new Error("Asset identity changed. Close the editor and refresh before editing.");
  const changes = {};
  const fields = assetEditFields();
  for (const [key, [label, maximum]] of Object.entries(fields)) {
    const value = normaliseAssetEditValue(key, input[key]);
    if (["plantType", "manufacturer", "model"].includes(key) && !value) throw new Error(`${label} is required.`);
    if (key === "plantType" && !PLANT_TYPES.some(type => type.code === value)) throw new Error("Choose a known plant type.");
    if (key === "year" && value !== null && (!Number.isInteger(value) || value < 1900 || value > new Date().getFullYear() + 1))
      throw new Error("Enter a four-digit year from 1900 to next year, or leave it blank.");
    if (String(value ?? "").length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
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
  return Object.fromEntries(Object.keys(assetEditFields()).map(key => [key, getElement(`assetEdit_${key}`).value]));
}

function hasAssetEditChanges() {
  if (!assetEditBaseline) return false;
  const input = readAssetEditForm();
  return Object.keys(assetEditFields()).some(key => JSON.stringify(normaliseAssetEditValue(key, input[key])) !==
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
  const fields = assetEditFields();
  const keys = Object.keys(fields);
  const sections = [
    ["Identity", keys.filter(key => ["vehicleType", "plantType", "registrationNumber", "manufacturer", "model", "vin", "serialNumber"].includes(key))],
    ["Operational baseline", keys.filter(key => !["vehicleType", "plantType", "registrationNumber", "manufacturer", "model", "vin", "serialNumber", "specification", "notes"].includes(key))],
    ["Additional information", keys.filter(key => ["specification", "notes"].includes(key))]
  ].filter(([, sectionKeys]) => sectionKeys.length);
  getElement("assetEditFields").innerHTML = sections.map(([title, keys]) => `<section><h3>${title}</h3><div class="asset-edit-grid">${keys.map(key => {
    const [label, maximum] = fields[key];
    const value = asset[key] ?? "";
    const required = ["plantType", "manufacturer", "model"].includes(key);
    const attributes = `id="assetEdit_${key}" name="${key}" ${required ? "required" : ""}`;
    let control;
    if (key === "plantType") control = `<select ${attributes}><option value="">Select plant type</option>${PLANT_TYPES.map(type => `<option value="${type.code}" ${type.code === value ? "selected" : ""}>${escapeHtml(type.label)}</option>`).join("")}</select>`;
    else if (["specification", "notes"].includes(key)) control = `<textarea ${attributes} rows="3" maxlength="${maximum}">${escapeHtml(value)}</textarea>`;
    else control = `<input ${attributes} type="${key.toLowerCase().includes("date") || key === "motExpiry" ? "date" : "text"}" value="${escapeHtml(value)}" maxlength="${maximum}" ${key === "year" || key.toLowerCase().includes("mileage") || key.toLowerCase().includes("hours") ? 'inputmode="numeric"' : ""}>`;
    return `<label class="${["specification", "notes"].includes(key) ? "asset-edit-wide" : ""}" for="assetEdit_${key}">${label}${required ? " *" : ""}${control}${key === "capacity" ? "<small>Include units, for example 4 tonnes / 17 metres.</small>" : ""}</label>`;
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
      const freshProfile = { uid, ...profileSnapshot.data() };
      if (freshProfile.organisationId !== organisationId || latest.organisationId !== organisationId) throw new Error("This asset is outside your organisation.");
      const update = buildAssetEditUpdate(input, baseline, latest, freshProfile, organisationId, uid, serverTimestamp());
      if (auth.currentUser?.uid !== uid) throw new Error("Your signed-in user changed. Close and reopen the editor.");
      if (Object.keys(update).length) transaction.update(reference, update);
      return { latest, update };
    });
    asset = { ...result.latest, ...result.update };
    const fields = assetEditFields();
    const changed = Object.keys(result.update).filter(key => Object.hasOwn(fields, key));
    assetEditBaseline = null;
    getElement("assetEditDialog").close();
    renderHero();
    renderSelectedView();
    setText("assetEditConfirmation", changed.length ? `Asset updated · ${changed.map(key => fields[key][0]).join(", ")}` : "No changes to save.");
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
  getElement("assetEditDialog").addEventListener("click", event => { if (event.target === event.currentTarget) closeAssetEditor(); });
  window.addEventListener("beforeunload", event => {
    if (assetEditSaving || hasAssetEditChanges()) { event.preventDefault(); event.returnValue = ""; }
  });
}

/* Location and deployment are controlled event writes. */
let deploymentMode = null;
let deploymentProjects = [];
let deploymentSaving = false;
let assetWorkflowMode = null;
let assetWorkflowSaving = false;

function localCalendarDay() { return new Date().toISOString().slice(0, 10); }
function activeAssignment(record) {
  const status = cleanString(record?.status).toUpperCase();
  return ["ACTIVE", "CONFIRMED", "PLANNED"].includes(status) && (!record.assignedUntil || String(record.assignedUntil).slice(0, 10) >= localCalendarDay());
}
function getCurrentAssignment(records) { return records.filter(activeAssignment).sort((a, b) => String(b.assignedFrom || "").localeCompare(String(a.assignedFrom || "")))[0] || null; }
function deploymentActor(profile, record) { return assetManagementAuthority(profile, organisationId, record); }

function freshPlantManager(profile, record) {
  return assetManagementAuthority(profile, organisationId, record);
}

function workflowDialog() {
  let dialog = getElement("assetWorkflowDialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "assetWorkflowDialog";
  dialog.className = "asset-edit-dialog";
  dialog.innerHTML = `<form id="assetWorkflowForm" novalidate><header class="asset-edit-header"><div><h2 id="assetWorkflowTitle"></h2><p id="assetWorkflowDescription"></p></div><button type="button" id="assetWorkflowClose" aria-label="Close">×</button></header><fieldset id="assetWorkflowFields" class="asset-edit-body"></fieldset><p id="assetWorkflowError" class="asset-edit-error" role="alert" hidden></p><footer class="asset-edit-footer"><span>Changes are recorded against this asset history.</span><div class="asset-edit-footer__actions"><button type="button" id="assetWorkflowCancel">Cancel</button><button type="submit" id="assetWorkflowSave" class="asset-edit-primary">Save</button></div></footer></form>`;
  document.body.append(dialog);
  const close = () => { if (!assetWorkflowSaving && dialog.open) dialog.close(); };
  getElement("assetWorkflowClose").onclick = close;
  getElement("assetWorkflowCancel").onclick = close;
  dialog.oncancel = event => { event.preventDefault(); close(); };
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
  getElement("assetWorkflowForm").onsubmit = saveAssetWorkflow;
  return dialog;
}

function workflowField(key, label, type = "text", required = false, options = []) {
  const attrs = `id="assetWorkflow_${key}" name="${key}" ${required ? "required" : ""}`;
  const control = type === "select"
    ? `<select ${attrs}><option value="">Select ${escapeHtml(label.toLowerCase())}</option>${options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(formatText(option))}</option>`).join("")}</select>`
    : type === "textarea"
      ? `<textarea ${attrs} rows="3"></textarea>`
      : `<input ${attrs} type="${type}">`;
  return `<label class="${type === "textarea" ? "asset-edit-wide" : ""}"><span>${escapeHtml(label)}${required ? " *" : ""}</span>${control}</label>`;
}

function openMaintenanceDialog(mode) {
  if (!canManagePlant || !asset) return;
  assetWorkflowMode = mode;
  const dialog = workflowDialog();
  const definitions = {
    plan: ["Plan Maintenance", "Schedule a maintenance intervention.", [workflowField("maintenanceType", "Maintenance type", "select", true, ["SERVICE", "REPAIR", "MOT_TEST", "INSPECTION", "TYRES", "OTHER"]), workflowField("plannedDate", "Planned date", "date", true), workflowField("provider", "Provider"), workflowField("expectedReturnDate", "Expected return date", "date"), workflowField("estimatedCost", "Estimated cost", "number"), workflowField("notes", "Notes", "textarea")]],
    service: ["Record Service", "Record a completed service, including historical work.", [workflowField("serviceDate", "Service date", "date", true), workflowField("mileage", "Mileage", "number", true), workflowField("provider", "Provider"), workflowField("workCompleted", "Work completed", "textarea", true), workflowField("cost", "Cost", "number"), workflowField("nextServiceDate", "Next service date", "date"), workflowField("nextServiceMileage", "Next service mileage", "number"), workflowField("notes", "Notes", "textarea")]],
    mot: ["Record MOT", "Record a completed MOT test, including historical tests.", [workflowField("testDate", "Test date", "date", true), workflowField("mileage", "Mileage", "number"), workflowField("provider", "Test station / provider"), workflowField("result", "Result", "select", true, ["PASS", "FAIL", "ADVISORY_PASS"]), workflowField("cost", "Cost", "number"), workflowField("newExpiryDate", "New expiry date", "date"), workflowField("notes", "Notes", "textarea")]],
    mileage: ["Update Mileage", "Update the current vehicle mileage.", [workflowField("currentMileage", "Current mileage", "number", true), workflowField("recordedDate", "Recorded date", "date", true), workflowField("note", "Note", "textarea")]]
  };
  const definition = definitions[mode];
  if (!definition) return;
  setText("assetWorkflowTitle", definition[0]);
  setText("assetWorkflowDescription", definition[1]);
  getElement("assetWorkflowFields").innerHTML = `<div class="asset-edit-grid">${definition[2].join("")}</div>`;
  getElement("assetWorkflowError").hidden = true;
  setText("assetWorkflowSave", mode === "mileage" ? "Update mileage" : "Save");
  dialog.showModal();
}

function workflowInput(key) {
  return cleanString(getElement(`assetWorkflow_${key}`)?.value);
}

function omitUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

async function saveAssetWorkflow(event) {
  event.preventDefault();
  if (assetWorkflowSaving || !assetWorkflowMode || !asset) return;
  const error = getElement("assetWorkflowError");
  error.hidden = true;
  assetWorkflowSaving = true;
  getElement("assetWorkflowFields").disabled = true;
  getElement("assetWorkflowSave").disabled = true;
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Your session has ended. Sign in again before saving.");
    const mode = assetWorkflowMode;
    const values = Object.fromEntries(["maintenanceType", "plannedDate", "provider", "expectedReturnDate", "estimatedCost", "notes", "serviceDate", "mileage", "workCompleted", "cost", "nextServiceDate", "nextServiceMileage", "testDate", "result", "newExpiryDate", "currentMileage", "recordedDate", "note"].map(key => [key, workflowInput(key)]));
    if (mode === "plan" && (!values.maintenanceType || !values.plannedDate)) throw new Error("Choose a maintenance type and planned date.");
    if (mode === "service" && (!values.serviceDate || !values.mileage || !values.workCompleted)) throw new Error("Enter the service date, mileage and work completed.");
    if (mode === "mot" && (!values.testDate || !values.result)) throw new Error("Enter the test date and result.");
    if (mode === "mileage" && (!values.currentMileage || !values.recordedDate)) throw new Error("Enter the current mileage and recorded date.");
    const result = await runTransaction(db, async transaction => {
      const profileSnapshot = await transaction.get(doc(db, "users", uid));
      const assetReference = doc(db, "plantAssets", asset.id);
      const assetSnapshot = await transaction.get(assetReference);
      if (!profileSnapshot.exists() || !assetSnapshot.exists()) throw new Error("Your profile or this asset is no longer available.");
      const freshProfile = { uid, ...profileSnapshot.data() };
      const latest = { id: assetSnapshot.id, ...assetSnapshot.data() };
      if (!freshPlantManager(freshProfile, latest)) throw new Error("Plant-management permission is required for this action.");
      const timestamp = serverTimestamp();
      if (mode === "mileage") {
        const update = omitUndefined({ currentMileage: Number(values.currentMileage), currentMileageRecordedDate: values.recordedDate, currentMileageNote: values.note || null, updatedByUid: uid, updatedByName: cleanString(freshProfile.displayName) || null, updatedAt: timestamp });
        transaction.update(assetReference, update);
        return { assetUpdate: update, maintenance: null };
      }
      const completed = mode !== "plan";
      const maintenance = omitUndefined({ organisationId, assetId: latest.id, plantId: latest.plantId || latest.plantReference || latest.id, plantReference: latest.plantReference || latest.plantId || latest.id, assetClass: resolvedAssetClass(latest), status: completed ? "COMPLETED" : "SCHEDULED", maintenanceType: mode === "service" ? "SERVICE" : mode === "mot" ? "MOT_TEST" : values.maintenanceType, plannedDate: mode === "plan" ? values.plannedDate : mode === "service" ? values.serviceDate : values.testDate, serviceDate: mode === "service" ? values.serviceDate : undefined, testDate: mode === "mot" ? values.testDate : undefined, provider: values.provider || undefined, expectedReturnDate: values.expectedReturnDate || undefined, estimatedCost: values.estimatedCost ? Number(values.estimatedCost) : undefined, mileage: values.mileage ? Number(values.mileage) : undefined, result: values.result || undefined, cost: values.cost ? Number(values.cost) : undefined, workCompleted: values.workCompleted || undefined, nextServiceDate: values.nextServiceDate || undefined, nextServiceMileage: values.nextServiceMileage ? Number(values.nextServiceMileage) : undefined, newExpiryDate: values.newExpiryDate || undefined, notes: values.notes || undefined, createdByUid: uid, createdByName: cleanString(freshProfile.displayName) || null, createdAt: timestamp, updatedByUid: uid, updatedByName: cleanString(freshProfile.displayName) || null, updatedAt: timestamp });
      transaction.set(doc(collection(db, "plantMaintenance")), maintenance);
      const assetUpdate = mode === "service" ? omitUndefined({ lastServiceDate: values.serviceDate, lastServiceMileage: Number(values.mileage), nextServiceDate: values.nextServiceDate || null, nextServiceMileage: values.nextServiceMileage ? Number(values.nextServiceMileage) : undefined, updatedByUid: uid, updatedByName: cleanString(freshProfile.displayName) || null, updatedAt: timestamp }) : mode === "mot" ? omitUndefined({ motExpiry: values.newExpiryDate || null, updatedByUid: uid, updatedByName: cleanString(freshProfile.displayName) || null, updatedAt: timestamp }) : {};
      if (Object.keys(assetUpdate).length) transaction.update(assetReference, assetUpdate);
      return { assetUpdate, maintenance };
    });
    asset = { ...asset, ...result.assetUpdate };
    await loadMaintenance();
    renderHero();
    renderSelectedView();
    workflowDialog().close();
    setText("assetEditConfirmation", mode === "mileage" ? "Mileage updated" : "Maintenance history updated");
    getElement("assetEditConfirmation").hidden = false;
  } catch (workflowError) {
    error.textContent = workflowError.code?.includes("permission-denied") ? "Save denied by Firestore rules. No changes were made." : workflowError.message || "Unable to save. No changes were made.";
    error.hidden = false;
  } finally {
    assetWorkflowSaving = false;
    getElement("assetWorkflowFields").disabled = false;
    getElement("assetWorkflowSave").disabled = false;
  }
}

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


function projectDisplayName(
  project
) {

  return cleanString(
    project?.projectName
    ||
    project?.name
    ||
    project?.projectCode
    ||
    project?.id
  );

}


function activeAssignmentConflict(
  records,
  assignmentType
) {

  return activeAssignmentsOfType(records, assignmentType).length > 1;

}


function assignmentTargetType(
  mode
) {

  return mode.startsWith("person")
    ? "PERSON"
    : "PROJECT";

}

function openDeploymentEditor(mode) {
  if (!auth.currentUser || !deploymentActor(currentProfile, asset)) return;
  const dialog = getElement("deploymentDialog");
  const assignmentType = assignmentTargetType(mode);
  const current = assignmentType === "PERSON" ? currentPersonAssignment() : currentProjectAssignment();
  const currentPerson = currentPersonAssignment();
  const currentProject = currentProjectAssignment();
  deploymentMode = mode;
  setText("deploymentIdentity", asset.plantReference || asset.plantId || asset.id);
  const deploymentPosition = isRoadVehicle()
    ? `${currentPerson?.personName || asset.currentAssignedPersonName || "No person"} · ${asset.currentLocationLabel || "Location not confirmed"}`
    : `${currentProject?.projectName || asset.currentProjectName || "No project"} · ${currentPerson?.personName || asset.currentAssignedPersonName || "No person"} · ${asset.currentLocationLabel || "Location not confirmed"}`;
  setText("deploymentCurrentPosition", deploymentPosition);
  getElement("deploymentError").hidden = true;
  const titles = { location: ["Confirm / Update Location", "Record the asset's current location. This does not create a transport movement."], "person-assign": ["Assign Person", "Create a person responsibility record for this vehicle."], "person-change": ["Change Person", "Release the current person responsibility and create a new one."], "person-release": ["Release Person", "Close the current person responsibility."], "project-assign": ["Assign Project", "Create a project deployment record and update the project cache."], "project-change": ["Change Project", "Release the current project deployment and create a new one."], "project-release": ["Release Project", "Close the current project deployment and clear the project cache."] };
  setText("deploymentTitle", titles[deploymentMode][0]); setText("deploymentDescription", titles[deploymentMode][1]);
  setText("deploymentHelp", deploymentMode === "location" ? "A location confirmation is retained in the asset history." : "Assignment history is retained; this action does not create a movement.");
  if (deploymentMode === "location") {
    getElement("deploymentFields").innerHTML = `<section><h3>Current Location</h3><div class="asset-edit-grid"><label class="asset-edit-wide">Location *<input id="deploymentLocation" maxlength="160" value="${escapeHtml(asset.currentLocationLabel || "")}" required><small>Use a clear site, depot or supplier location.</small></label></div></section>`;
    getElement("deploymentSave").textContent = "Confirm location";
    dialog.showModal(); return;
  }
  if (deploymentMode.endsWith("release")) {
    if (!current) return;
    const currentLabel = assignmentType === "PERSON" ? current.personName : current.projectName;
    getElement("deploymentFields").innerHTML = `<section><h3>Release ${assignmentType === "PERSON" ? "person" : "project"}</h3><p class="asset-deployment-actions__restricted">This will close the active assignment to ${escapeHtml(currentLabel || "the current assignment")} today. History is retained.</p></section>`;
    getElement("deploymentSave").textContent = `Release ${assignmentType === "PERSON" ? "person" : "project"}`;
    dialog.showModal(); return;
  }
  if (assignmentType === "PERSON") {
    getElement("deploymentFields").innerHTML = `<section><h3>Person</h3><div class="asset-edit-grid"><label class="asset-edit-wide">Person *<select id="deploymentPerson" required><option value="">Loading people…</option></select><small>Only active people in this organisation can be selected.</small></label><label>Assigned from *<input id="deploymentAssignedFrom" type="date" value="${escapeHtml(localCalendarDay())}" required></label><label>Assigned until <input id="deploymentAssignedUntil" type="date"></label><label class="asset-edit-wide">Current location *<input id="deploymentLocation" maxlength="160" value="${escapeHtml(asset.currentLocationLabel || "")}" required></label><label class="asset-edit-wide">Notes <textarea id="deploymentNotes" rows="3" maxlength="500" placeholder="Operational notes or handover remarks"></textarea></label></div></section>`;
    getElement("deploymentSave").textContent = deploymentMode === "person-change" ? "Change person" : "Assign person";
    dialog.showModal();
    loadPeople().then(() => {
      const select = getElement("deploymentPerson");
      if (!select || !dialog.open) return;
      select.innerHTML = `<option value="">Select person</option>${people.map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml([personDisplayName(person), person.primaryRole || person.role || person.jobTitle].filter(Boolean).join(" · "))}</option>`).join("")}`;
      if (currentPerson && deploymentMode === "person-change") {
        select.value = currentPerson.personId || currentPerson.personName || "";
      }
    });
    return;
  }
  getElement("deploymentFields").innerHTML = `<section><h3>Project</h3><div class="asset-edit-grid"><label class="asset-edit-wide">Project *<select id="deploymentProject" required><option value="">Loading projects…</option></select><small>Only active projects in this organisation can be selected.</small></label><label>Assigned from *<input id="deploymentAssignedFrom" type="date" value="${escapeHtml(localCalendarDay())}" required></label><label>Assigned until <input id="deploymentAssignedUntil" type="date"></label><label class="asset-edit-wide">Current location *<input id="deploymentLocation" maxlength="160" value="${escapeHtml(asset.currentLocationLabel || "")}" required></label><label class="asset-edit-wide">Notes <textarea id="deploymentNotes" rows="3" maxlength="500" placeholder="Operational notes or handover remarks"></textarea></label></div></section>`;
  getElement("deploymentSave").textContent = deploymentMode === "project-change" ? "Change project" : "Assign project";
  dialog.showModal();
  loadDeploymentProjects().then(projects => {
    const select = getElement("deploymentProject"); if (!select || !dialog.open) return;
    select.innerHTML = `<option value="">Select project</option>${projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(projectDisplayName(project) || project.projectCode || project.name || project.id)}</option>`).join("")}`;
    if (currentProject && deploymentMode === "project-change") {
      select.value = currentProject.projectId || currentProject.projectName || "";
    }
  }).catch(error => { const errorElement = getElement("deploymentError"); errorElement.textContent = error.message; errorElement.hidden = false; getElement("deploymentSave").disabled = true; });
}

function closeDeploymentEditor() { if (!deploymentSaving) getElement("deploymentDialog").close(); }

function deploymentLocationUpdate(current, location, uid, profile, eventDate, timestamp) {
  const history = Array.isArray(current.locationHistory) ? current.locationHistory.slice(-99) : [];
  history.push({ type: "LOCATION_CONFIRMED", locationLabel: location, confirmedAt: eventDate, confirmedByUid: uid, confirmedByName: cleanString(profile.displayName) || null });
  return { currentLocationLabel: location, currentLocationConfirmedAt: timestamp, currentLocationConfirmedByUid: uid, currentLocationConfirmedByName: cleanString(profile.displayName) || null, locationHistory: history, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp };
}

async function saveDeployment(event) {
  event.preventDefault();
  if (deploymentSaving || !deploymentMode) return;
  const errorElement = getElement("deploymentError");
  errorElement.hidden = true;
  deploymentSaving = true;
  getElement("deploymentFields").disabled = true;
  getElement("deploymentSave").disabled = true;
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Your session has ended. Sign in again before saving.");
    const mode = deploymentMode;
    const eventDate = localCalendarDay();
    const assignedFrom = cleanString(getElement("deploymentAssignedFrom")?.value) || eventDate;
    const assignedUntil = cleanString(getElement("deploymentAssignedUntil")?.value) || null;
    const location = mode === "location" ? cleanString(getElement("deploymentLocation")?.value) : cleanString(getElement("deploymentLocation")?.value) || asset.currentLocationLabel || "";
    const notes = cleanString(getElement("deploymentNotes")?.value) || null;
    const assignmentType = assignmentTargetType(mode);
    const selectedPersonId = mode.includes("person") && !mode.endsWith("release") ? cleanString(getElement("deploymentPerson")?.value) : null;
    const selectedProjectId = mode.includes("project") && !mode.endsWith("release") ? cleanString(getElement("deploymentProject")?.value) : null;
    if (mode === "location" && !location) throw new Error("Enter the current location.");
    if (mode.includes("person") && !mode.endsWith("release") && !selectedPersonId) throw new Error("Select a person.");
    if (mode.includes("project") && !mode.endsWith("release") && !selectedProjectId) throw new Error("Select a project.");
    if (mode !== "location" && !assignedFrom) throw new Error("Select the assignment start date.");
    const preflightAssignments = mode === "location"
      ? []
      : await loadAssetLinkedCollection("plantAssignments");
    const preflightRelevant = activeAssignmentsOfType(preflightAssignments, assignmentType);
    if (preflightRelevant.length > 1) throw new Error(`Multiple active ${assignmentType === "PERSON" ? "person" : "project"} assignments exist. Resolve the data-integrity issue before creating another.`);
    const preflightCurrentId = preflightRelevant[0]?.id || null;
    const result = await runTransaction(db, async transaction => {
      const profileSnapshot = await transaction.get(doc(db, "users", uid));
      const assetReference = doc(db, "plantAssets", asset.id);
      const assetSnapshot = await transaction.get(assetReference);
      if (!profileSnapshot.exists() || !assetSnapshot.exists()) throw new Error("Your profile or this asset is no longer available.");
      const profile = { uid, ...profileSnapshot.data() };
      const latest = { id: assetSnapshot.id, ...assetSnapshot.data() };
      if (auth.currentUser?.uid !== uid || !freshPlantManager(profile, latest)) throw new Error("You no longer have permission to change this asset.");
      if (mode === "location") {
        const assetUpdate = deploymentLocationUpdate(latest, location, uid, profile, eventDate, serverTimestamp());
        transaction.update(assetReference, assetUpdate);
        return { assetUpdate };
      }
      let current = null;
      if (preflightCurrentId) {
        const currentReference = doc(db, "plantAssignments", preflightCurrentId);
        const currentSnapshot = await transaction.get(currentReference);
        if (!currentSnapshot.exists()) throw new Error("The assignment changed while this action was opening. Refresh and try again.");
        const exactCurrent = { id: currentSnapshot.id, ...currentSnapshot.data() };
        if (exactCurrent.organisationId !== organisationId || !recordBelongsToAsset(exactCurrent) || cleanString(exactCurrent.assignmentType).toUpperCase() !== assignmentType || !activeAssignment(exactCurrent)) {
          throw new Error("The assignment changed while this action was opening. Refresh and try again.");
        }
        current = exactCurrent;
      }
      const timestamp = serverTimestamp();
      if (mode.endsWith("release")) {
        if (!current) throw new Error("There is no active assignment to release.");
        const releaseDate = eventDate;
        transaction.update(doc(db, "plantAssignments", current.id), { status: "RELEASED", assignedUntil: releaseDate, releasedAt: timestamp, releasedByUid: uid, releasedByName: cleanString(profile.displayName) || null, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp });
        const assetUpdate = assignmentType === "PERSON" ? { currentAssignedPersonId: null, currentAssignedPersonName: null } : { currentProjectId: null, currentProjectName: null };
        transaction.update(assetReference, { ...assetUpdate, currentLocationLabel: location || latest.currentLocationLabel || null, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp });
        return { assetUpdate: { ...assetUpdate, currentLocationLabel: location || latest.currentLocationLabel || null, updatedAt: timestamp } };
      }
      let selectedId = selectedPersonId;
      let selectedName = "";
      let extra = {};
      if (assignmentType === "PERSON") {
        const person = people.find(item => item.id === selectedPersonId);
        if (!person || person.organisationId !== organisationId || ["LEFT", "INACTIVE", "DISABLED"].includes(cleanString(person.employmentStatus).toUpperCase()) || person.archived === true) throw new Error("The selected person is no longer active in this organisation.");
        selectedName = personDisplayName(person);
        extra = { personId: selectedId, personName: selectedName };
      } else {
        const projectSnapshot = await transaction.get(doc(db, "projects", selectedProjectId));
        if (!projectSnapshot.exists()) throw new Error("The selected project is no longer available.");
        const project = { id: projectSnapshot.id, ...projectSnapshot.data() };
        if (project.organisationId !== organisationId || ["CLOSED", "CANCELLED", "ARCHIVED"].includes(cleanString(project.status).toUpperCase())) throw new Error("The selected project cannot receive this asset.");
        selectedName = projectDisplayName(project);
        extra = { projectId: selectedId, projectName: selectedName };
      }
      if (current) transaction.update(doc(db, "plantAssignments", current.id), { status: "RELEASED", assignedUntil: assignedFrom || eventDate, releasedAt: timestamp, releasedByUid: uid, releasedByName: cleanString(profile.displayName) || null, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp });
      const assignment = {
        organisationId,
        assetId: latest.id,
        plantId: latest.plantId || latest.plantReference || latest.id,
        plantReference: latest.plantReference || latest.plantId || latest.id,
        assetClass: resolvedAssetClass(latest),
        assignmentType,
        status: "ACTIVE",
        assignedFrom,
        assignedUntil: assignedUntil || null,
        location: location || latest.currentLocationLabel || null,
        notes: notes || null,
        createdByUid: uid,
        createdByName: cleanString(profile.displayName) || null,
        createdAt: timestamp,
        updatedByUid: uid,
        updatedByName: cleanString(profile.displayName) || null,
        updatedAt: timestamp,
        ...extra
      };
      transaction.set(doc(collection(db, "plantAssignments")), assignment);
      const assetUpdate = assignmentType === "PERSON"
        ? { currentAssignedPersonId: selectedId, currentAssignedPersonName: selectedName }
        : { currentProjectId: selectedId, currentProjectName: selectedName };
      const cacheLocation = { currentLocationLabel: location || latest.currentLocationLabel || null };
      transaction.update(assetReference, { ...assetUpdate, ...cacheLocation, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp });
      return { assetUpdate: { ...assetUpdate, ...cacheLocation, updatedAt: timestamp } };
    });
    asset = { ...asset, ...result.assetUpdate };
    await loadAssignments();
    renderHero();
    renderSelectedView();
    closeDeploymentEditor();
    setText("assetEditConfirmation", mode === "location" ? "Location confirmed" : "Assignment updated");
    getElement("assetEditConfirmation").hidden = false;
  } catch (error) {
    errorElement.textContent = error.code?.includes("permission-denied") ? "Save denied by Firestore rules. No changes were made." : error.message || "Unable to save. No changes were made.";
    errorElement.hidden = false;
  } finally {
    deploymentSaving = false;
    getElement("deploymentFields").disabled = false;
    getElement("deploymentSave").disabled = false;
  }
}

function bindDeploymentWorkflow() {
  getElement("deploymentClose").onclick = closeDeploymentEditor; getElement("deploymentCancel").onclick = closeDeploymentEditor; getElement("deploymentForm").onsubmit = saveDeployment;
  getElement("deploymentDialog").oncancel = event => { event.preventDefault(); closeDeploymentEditor(); };
  getElement("deploymentDialog").addEventListener("click", event => { if (event.target === event.currentTarget) closeDeploymentEditor(); });
}


function bindLifecycleWorkflow() {
  const archiveDialog = getElement("assetArchiveDialog");
  const deleteDialog = getElement("assetDeleteDialog");
  const close = dialog => () => { if (dialog?.open) dialog.close(); };
  getElement("assetArchiveButton").onclick = () => { getElement("assetArchiveError").hidden = true; archiveDialog.showModal(); };
  getElement("assetDeleteButton").onclick = () => { getElement("assetDeleteError").hidden = true; deleteDialog.showModal(); };
  getElement("assetArchiveClose").onclick = close(archiveDialog);
  getElement("assetArchiveCancel").onclick = close(archiveDialog);
  getElement("assetDeleteClose").onclick = close(deleteDialog);
  getElement("assetDeleteCancel").onclick = close(deleteDialog);
  getElement("assetArchiveForm").onsubmit = saveAssetArchive;
  getElement("assetDeleteForm").onsubmit = saveAssetDelete;
  archiveDialog.oncancel = event => { event.preventDefault(); close(archiveDialog)(); };
  deleteDialog.oncancel = event => { event.preventDefault(); close(deleteDialog)(); };
  archiveDialog.addEventListener("click", event => { if (event.target === archiveDialog) close(archiveDialog)(); });
  deleteDialog.addEventListener("click", event => { if (event.target === deleteDialog) close(deleteDialog)(); });
}

let lifecycleSaving = false;

async function saveAssetArchive(event) {
  event.preventDefault();
  if (lifecycleSaving || !asset || !canManagePlant) return;
  const error = getElement("assetArchiveError");
  const reason = cleanString(getElement("assetArchiveReason")?.value);
  if (!reason) { error.textContent = "Select an archive reason."; error.hidden = false; return; }
  lifecycleSaving = true;
  getElement("assetArchiveConfirm").disabled = true;
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Your session has ended. Sign in again before archiving.");
    const result = await runTransaction(db, async transaction => {
      const profileSnapshot = await transaction.get(doc(db, "users", uid));
      const reference = doc(db, "plantAssets", asset.id);
      const assetSnapshot = await transaction.get(reference);
      if (!profileSnapshot.exists() || !assetSnapshot.exists()) throw new Error("Your profile or this asset is no longer available.");
      const profile = { uid, ...profileSnapshot.data() };
      const latest = { id: assetSnapshot.id, ...assetSnapshot.data() };
      if (!freshPlantManager(profile, latest)) throw new Error("Plant-management permission is required to archive this asset.");
      const timestamp = serverTimestamp();
      const update = { archived: true, active: false, status: "ARCHIVED", archivedAt: timestamp, archivedByUid: uid, archivedByName: cleanString(profile.displayName) || null, archiveReason: reason, archiveNotes: cleanString(getElement("assetArchiveNotes")?.value) || null, updatedByUid: uid, updatedByName: cleanString(profile.displayName) || null, updatedAt: timestamp };
      transaction.update(reference, update);
      return update;
    });
    asset = { ...asset, ...result };
    archiveDialogClose();
    renderHero();
    renderSelectedView();
    setText("assetEditConfirmation", "Asset archived");
    getElement("assetEditConfirmation").hidden = false;
  } catch (archiveError) {
    error.textContent = archiveError.code?.includes("permission-denied") ? "Archive denied by Firestore rules. No changes were made." : archiveError.message || "Unable to archive. No changes were made.";
    error.hidden = false;
  } finally {
    lifecycleSaving = false;
    getElement("assetArchiveConfirm").disabled = false;
  }
}

function archiveDialogClose() { getElement("assetArchiveDialog")?.close(); }

function openDocumentDialog(preselectedType = "") {
  if (!canManagePlant) return;
  let dialog = getElement("assetDocumentDialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "assetDocumentDialog";
    dialog.className = "asset-edit-dialog";
    dialog.innerHTML = `<form id="assetDocumentForm" novalidate><header class="asset-edit-header"><div><h2>Add Document</h2><p>Prepare controlled evidence for this asset.</p></div><button type="button" id="assetDocumentClose" aria-label="Close">×</button></header><div class="asset-edit-body"><div class="asset-edit-grid"><label><span>Document type *</span><select id="assetDocumentType" required></select></label><label><span>Title *</span><input id="assetDocumentTitle" required maxlength="160"></label><label><span>PDF file *</span><input id="assetDocumentFile" type="file" accept="application/pdf" required></label><label><span>Issue date</span><input id="assetDocumentIssueDate" type="date"></label><label><span>Expiry date</span><input id="assetDocumentExpiryDate" type="date"></label><label class="asset-edit-wide"><span>Notes</span><textarea id="assetDocumentNotes" rows="3"></textarea></label></div><p class="asset-document-storage-blocker">Upload is currently unavailable: <strong>storage.rules denies all Firebase Storage reads and writes</strong>. No Firestore document will be created without a safely uploaded PDF.</p></div><p id="assetDocumentError" class="asset-edit-error" role="alert" hidden></p><footer class="asset-edit-footer"><span>Binary evidence is never stored in Firestore.</span><div class="asset-edit-footer__actions"><button type="button" id="assetDocumentCancel">Cancel</button><button type="submit" id="assetDocumentSave" class="asset-edit-primary" disabled title="Blocked by current Firebase Storage rules">Upload document</button></div></footer></form>`;
    document.body.append(dialog);
    const close = () => dialog.close();
    getElement("assetDocumentClose").onclick = close;
    getElement("assetDocumentCancel").onclick = close;
    dialog.oncancel = event => { event.preventDefault(); close(); };
    dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
    getElement("assetDocumentForm").onsubmit = event => { event.preventDefault(); getElement("assetDocumentError").textContent = "Upload blocked: storage.rules currently denies all Firebase Storage reads and writes."; getElement("assetDocumentError").hidden = false; };
  }
  const types = isRoadVehicle() ? ["INSURANCE", "MOT_CERTIFICATE", "V5C", "SERVICE_RECORD", "OWNERSHIP_EVIDENCE", "WARRANTY", "MANUAL", "OTHER"] : ["LOLER", "PUWER", "OWNERSHIP_EVIDENCE", "PURCHASE_INVOICE", "MANUAL", "WARRANTY", "SERVICE_RECORD", "OTHER"];
  getElement("assetDocumentType").innerHTML = `<option value="">Select document type</option>${types.map(type => `<option value="${type}">${formatText(type)}</option>`).join("")}`;
  getElement("assetDocumentType").value = types.includes(preselectedType) ? preselectedType : "";
  getElement("assetDocumentError").hidden = true;
  dialog.showModal();
}

async function saveAssetDelete(event) {
  event.preventDefault();
  if (lifecycleSaving || !asset || !isCanonicalPlatformAdmin(currentProfile)) return;
  const error = getElement("assetDeleteError");
  const confirmation = cleanString(getElement("assetDeleteConfirmation")?.value);
  const permanentId = asset.plantReference || asset.plantId || asset.id;
  if (confirmation !== permanentId) { error.textContent = "Type the permanent Asset ID exactly to confirm deletion."; error.hidden = false; return; }
  lifecycleSaving = true;
  getElement("assetDeleteConfirm").disabled = true;
  try {
    const uid = auth.currentUser?.uid;
    const linkedCollections = [
      "plantMaintenance",
      "plantDefects",
      "plantInspections",
      "plantMovements",
      "plantAssignments",
      "documents"
    ];
    const linkedHistory = (
      await Promise.all(
        linkedCollections.map(collectionName =>
          loadAssetLinkedCollection(collectionName, collectionName === "documents")
        )
      )
    ).flat();
    if (linkedHistory.length) throw new Error("Linked operational history exists. Archive the asset instead of deleting it.");
    const result = await runTransaction(db, async transaction => {
      const profileSnapshot = await transaction.get(doc(db, "users", uid));
      const reference = doc(db, "plantAssets", asset.id);
      const assetSnapshot = await transaction.get(reference);
      if (!profileSnapshot.exists() || !assetSnapshot.exists()) throw new Error("Your profile or this asset is no longer available.");
      const profile = { uid, ...profileSnapshot.data() };
      const latest = { id: assetSnapshot.id, ...assetSnapshot.data() };
      if (!isCanonicalPlatformAdmin(profile) || profile.organisationId !== organisationId || latest.organisationId !== organisationId) throw new Error("Platform Admin authority is required to delete this asset.");
      transaction.delete(reference);
      return true;
    });
    if (result) window.location.href = "/modules/contractor/plant/fleet/";
  } catch (deleteError) {
    error.textContent = deleteError.code?.includes("permission-denied") ? "Delete denied by Firestore rules. No changes were made." : deleteError.message || "Unable to delete. No changes were made.";
    error.hidden = false;
  } finally {
    lifecycleSaving = false;
    getElement("assetDeleteConfirm").disabled = false;
  }
}

waitForWorkspace();
