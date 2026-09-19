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

let hireByAssetKey =
  new Map();


let selectedPlantType =
  "";

let selectedFleetView =
  "ALL";

let stagedAttachments =
  [];


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


function isHireOwnership(
  ownershipType
) {

  return [
    "HIRED",
    "LEASED",
    "CROSS_HIRED"
  ].includes(
    ownershipType
  );

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

function weeklyEquivalent(
  rate,
  unit
) {

  const value =
    Number(
      rate
    );


  if (
    !Number.isFinite(
      value
    )
    ||
    value <
      0
  ) {

    return 0;

  }


  switch (
    cleanString(
      unit
    ).toUpperCase()
  ) {

    case "DAY":

      return value *
        7;


    case "MONTH":

      return value *
        12 /
        52;


    case "WEEK":

    default:

      return value;

  }

}


function estimatedHireExposure(
  record
) {

  if (
    !record

    ||

    record.hireRate ==
      null

    ||

    !record.hireStartDate
  ) {

    return null;

  }


  const start =
    parseDate(
      record.hireStartDate
    );


  const finish =
    parseDate(
      record.offHireConfirmedDate
    )
    ||
    new Date();


  if (
    !start

    ||

    finish <
      start
  ) {

    return null;

  }


  const days =
    Math.max(
      1,
      Math.floor(
        (
          finish -
          start
        )
        /
        86400000
      )
      +
      1
    );


  const rate =
    Number(
      record.hireRate
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
      record.hireRateUnit
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

    console.error(
      "NORMEX Fleet: organisation context is missing."
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


  renderStaticOptions();

  applyAccessControl();

  bindEvents();


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


  await Promise.all([
    loadPlantAssets(),
    loadHireRecords()
  ]);


  rebuildHireLookup();

  renderEverything();

}


async function loadPlantAssets() {

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


  } catch (
    error
  ) {

    console.error(
      "NORMEX Fleet could not load plantAssets:",
      error
    );


    plantAssets =
      [];

  }

}


async function loadHireRecords() {

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


  } catch (
    error
  ) {

    console.warn(
      "NORMEX Fleet could not load plantHireRecords:",
      error
    );


    hireRecords =
      [];

  }

}


function rebuildHireLookup() {

  hireByAssetKey =
    new Map();


  hireRecords.forEach(
    (
      record
    ) => {

      const keys = [

        cleanString(
          record.plantId
        ),

        cleanString(
          record.plantReference
        )

      ].filter(
        Boolean
      );


      keys.forEach(
        (
          key
        ) => {

          const existing =
            hireByAssetKey.get(
              key
            );


          if (
            !existing

            ||

            hireRecordPriority(
              record
            )
            >
            hireRecordPriority(
              existing
            )
          ) {

            hireByAssetKey.set(
              key,
              record
            );

          }

        }
      );

    }
  );

}


function hireRecordPriority(
  record
) {

  const status =
    cleanString(
      record?.status
    ).toUpperCase();


  let score =
    0;


  if (
    status ===
      "ACTIVE"
  ) {

    score +=
      10000000000000;

  }


  if (
    status ===
      "OFF_HIRE_REQUESTED"
  ) {

    score +=
      9000000000000;

  }


  const updated =
    parseDate(
      record?.updatedAt
    )?.getTime()
    ||
    0;


  return score +
    updated;

}


function getHireRecordForAsset(
  asset
) {

  if (
    !asset
  ) {

    return null;

  }


  if (
    asset.currentHireRecordId
  ) {

    const direct =
      hireRecords.find(
        (
          record
        ) =>
          record.id ===
            asset.currentHireRecordId
      );


    if (
      direct
    ) {

      return direct;

    }

  }


  return (

    hireByAssetKey.get(
      cleanString(
        asset.id
      )
    )

    ||

    hireByAssetKey.get(
      cleanString(
        asset.plantReference
      )
    )

    ||

    null

  );

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

  renderFinancialMetrics();

  renderFleetMetrics();

  renderPriorityFleet();

  renderCategories();

  applyFleetFilters();

}


/* =========================================================
   FINANCIAL POSITION
========================================================= */

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
          hire

          &&

          [
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
          (
            estimatedHireExposure(
              hire
            )
            ||
            0
          )
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

function renderFleetMetrics() {

  const root =
    getElement(
      "fleetMetrics"
    );


  if (
    !root
  ) {

    return;

  }


  const active =
    plantAssets.filter(
      isActiveAsset
    );


  const deployed =
    active.filter(
      (
        asset
      ) =>
        asset.status ===
          "DEPLOYED"
    ).length;


  const available =
    active.filter(
      (
        asset
      ) =>
        asset.status ===
          "AVAILABLE"
    ).length;


  const hired =
    active.filter(
      (
        asset
      ) =>
        isHireOwnership(
          asset.ownershipType
        )
    ).length;


  const owned =
    active.filter(
      (
        asset
      ) =>
        asset.ownershipType ===
          "OWNED"
    ).length;


  const offRoad =
    active.filter(
      isOffRoad
    ).length;


  const cards = [

    {
      label:
        "Total Plant",

      value:
        active.length,

      note:
        "Active fleet assets"
    },

    {
      label:
        "Deployed",

      value:
        deployed,

      note:
        "Currently recorded in use"
    },

    {
      label:
        "Available",

      value:
        available,

      note:
        "Ready for allocation"
    },

    {
      label:
        "Hired / Leased",

      value:
        hired,

      note:
        "External fleet"
    },

    {
      label:
        "Owned",

      value:
        owned,

      note:
        "Organisation-owned plant"
    },

    {
      label:
        "Off Road / Hold",

      value:
        offRoad,

      note:
        "Defect or compliance restriction",

      alert:
        offRoad >
          0
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
              ${
                card.alert
                  ? "is-alert"
                  : ""
              }
            "
          >

            <span>
              ${escapeHtml(
                card.label
              )}
            </span>

            <strong>
              ${card.value}
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
   PRIORITY HIRED / OWNED VIEWS
========================================================= */

function renderPriorityFleet() {

  const active =
    plantAssets.filter(
      isActiveAsset
    );


  const hired =
    active.filter(
      (
        asset
      ) =>
        isHireOwnership(
          asset.ownershipType
        )
    );


  const owned =
    active.filter(
      (
        asset
      ) =>
        asset.ownershipType ===
          "OWNED"
    );


  setCount(
    "hiredFleetCount",
    hired.length
  );


  setCount(
    "ownedFleetCount",
    owned.length
  );


  renderPriorityCards(
    "hiredFleetGrid",
    sortHiredForPriority(
      hired
    ).slice(
      0,
      6
    ),
    "HIRED"
  );


  renderPriorityCards(
    "ownedFleetGrid",
    sortOwnedForPriority(
      owned
    ).slice(
      0,
      6
    ),
    "OWNED"
  );

}


function sortHiredForPriority(
  records
) {

  return records
    .slice()
    .sort(
      (
        a,
        b
      ) => {

        const aPriority =
          (
            isOffRoad(
              a
            )
              ? 100
              : 0
          )
          +
          (
            isIdleHiredAsset(
              a
            )
              ? 50
              : 0
          );


        const bPriority =
          (
            isOffRoad(
              b
            )
              ? 100
              : 0
          )
          +
          (
            isIdleHiredAsset(
              b
            )
              ? 50
              : 0
          );


        if (
          aPriority !==
            bPriority
        ) {

          return (
            bPriority -
            aPriority
          );

        }


        const aHire =
          getHireRecordForAsset(
            a
          );


        const bHire =
          getHireRecordForAsset(
            b
          );


        const aWeekly =
          weeklyEquivalent(
            aHire?.hireRate,
            aHire?.hireRateUnit
          );


        const bWeekly =
          weeklyEquivalent(
            bHire?.hireRate,
            bHire?.hireRateUnit
          );


        return (
          bWeekly -
          aWeekly
        );

      }
    );

}


function sortOwnedForPriority(
  records
) {

  return records
    .slice()
    .sort(
      (
        a,
        b
      ) => {

        if (
          isOffRoad(
            a
          )
          !==
          isOffRoad(
            b
          )
        ) {

          return isOffRoad(
            b
          )
            ? 1
            : -1;

        }


        return cleanString(
          a.plantReference
        ).localeCompare(
          cleanString(
            b.plantReference
          )
        );

      }
    );

}


function renderPriorityCards(
  rootId,
  records,
  viewType
) {

  const root =
    getElement(
      rootId
    );


  if (
    !root
  ) {

    return;

  }


  if (
    !records.length
  ) {

    root.innerHTML =
      emptyState(
        viewType ===
          "HIRED"
          ? "No hired or leased plant is recorded yet."
          : "No owned plant is recorded yet."
      );

    return;

  }


  root.innerHTML =
    records
      .map(
        (
          asset
        ) =>
          renderPriorityAssetCard(
            asset,
            viewType
          )
      )
      .join("");

}


function renderPriorityAssetCard(
  asset,
  viewType
) {

  const hire =
    getHireRecordForAsset(
      asset
    );


  const idleHire =
    isIdleHiredAsset(
      asset
    );


  const offRoad =
    isOffRoad(
      asset
    );


  const cardClasses = [
    "fleet-priority-card"
  ];


  if (
    idleHire
  ) {

    cardClasses.push(
      "is-idle-hire"
    );

  }


  if (
    offRoad
  ) {

    cardClasses.push(
      "is-off-road"
    );

  }


  const facts =
    viewType ===
      "HIRED"

      ? [

          [
            "Supplier",
            asset.supplierName ||
            hire?.supplierName ||
            "Not recorded"
          ],

          [
            "Current Location",
            asset.currentLocationLabel ||
            "Not confirmed"
          ],

          [
            "Hire Rate",
            canViewPlantCosts
              ? formatHireRate(
                  hire
                )
              : "Restricted"
          ],

          [
            "Expected Off-Hire",
            formatDate(
              hire?.expectedOffHireDate
            )
          ]

        ]

      : [

          [
            "Current Project",
            asset.currentProjectName ||
            "Not allocated"
          ],

          [
            "Current Location",
            asset.currentLocationLabel ||
            "Not confirmed"
          ],

          [
            "Last Inspection",
            asset.lastInspectionLabel ||
            "No record"
          ],

          [
            "Compliance",
            asset.complianceLabel ||
            "Not assessed"
          ]

        ];


  return `

    <article
      class="${cardClasses.join(
        " "
      )}"
    >

      <div class="fleet-priority-card__top">

        <div>

          <span class="fleet-priority-card__reference">

            ${escapeHtml(
              asset.plantReference ||
              asset.id
            )}

          </span>

          <strong class="fleet-priority-card__model">

            ${escapeHtml(
              assetDisplayName(
                asset
              )
            )}

          </strong>

          <span class="fleet-priority-card__type">

            ${escapeHtml(
              getPlantTypeLabel(
                asset.plantType
              )
            )}

          </span>

        </div>


        <span
          class="
            fleet-status-chip
            ${getStatusClass(
              asset.status
            )}
          "
        >

          ${escapeHtml(
            getPlantStatusLabel(
              asset.status ||
              "AVAILABLE"
            )
          )}

        </span>

      </div>


      <div class="fleet-priority-card__facts">

        ${facts
          .map(
            (
              [
                label,
                value
              ]
            ) => `

              <div>

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


      <div class="fleet-priority-card__footer">

        <span
          class="
            fleet-card-signal
            ${
              offRoad
                ? "is-alert"
                : idleHire
                  ? "is-watch"
                  : ""
            }
          "
        >

          ${escapeHtml(
            getAssetSignal(
              asset,
              hire
            )
          )}

        </span>


        <a
          class="fleet-small-action"
          href="${assetUrl(
            asset
          )}"
        >
          Open Asset
        </a>

      </div>

    </article>

  `;

}


/* =========================================================
   CATEGORY VIEW
========================================================= */

function buildCategoryPositions() {

  const grouped =
    new Map();


  plantAssets
    .filter(
      isActiveAsset
    )
    .forEach(
      (
        asset
      ) => {

        const code =
          asset.plantType ||
          "OTHER";


        if (
          !grouped.has(
            code
          )
        ) {

          grouped.set(
            code,
            []
          );

        }


        grouped
          .get(
            code
          )
          .push(
            asset
          );

      }
    );


  return Array
    .from(
      grouped.entries()
    )
    .map(
      (
        [
          code,
          assets
        ]
      ) => ({

        code,

        label:
          getPlantTypeLabel(
            code
          ),

        total:
          assets.length,

        deployed:
          assets.filter(
            (
              asset
            ) =>
              asset.status ===
                "DEPLOYED"
          ).length,

        available:
          assets.filter(
            (
              asset
            ) =>
              asset.status ===
                "AVAILABLE"
          ).length,

        hired:
          assets.filter(
            (
              asset
            ) =>
              isHireOwnership(
                asset.ownershipType
              )
          ).length,

        offRoad:
          assets.filter(
            isOffRoad
          ).length

      }))
    .sort(
      (
        a,
        b
      ) =>
        a.label.localeCompare(
          b.label
        )
    );

}


function renderCategories() {

  const root =
    getElement(
      "fleetCategoryGrid"
    );


  if (
    !root
  ) {

    return;

  }


  const categories =
    buildCategoryPositions();


  const count =
    getElement(
      "fleetCategoryCount"
    );


  if (
    count
  ) {

    count.textContent =
      `${categories.length} ${
        categories.length ===
          1
          ? "category"
          : "categories"
      }`;

  }


  if (
    !categories.length
  ) {

    root.innerHTML =
      emptyState(
        "Fleet categories will appear when plant assets are added."
      );

    return;

  }


  root.innerHTML =
    categories
      .map(
        (
          category
        ) => `

          <article
            class="
              fleet-category-card
              ${
                selectedPlantType ===
                  category.code
                  ? "is-active"
                  : ""
              }
            "
            data-fleet-category="${escapeHtml(
              category.code
            )}"
            tabindex="0"
            role="button"
            aria-label="View ${escapeHtml(
              category.label
            )}"
          >

            <div class="fleet-category-card__top">

              <span class="fleet-category-card__code">
                ${escapeHtml(
                  getPlantPrefix(
                    category.code
                  )
                )}
              </span>

              <span class="fleet-category-card__count">
                ${category.total} plant
              </span>

            </div>


            <strong>
              ${escapeHtml(
                category.label
              )}
            </strong>


            <div class="fleet-category-card__position">

              <div>
                <span>Deployed</span>
                <b>${category.deployed}</b>
              </div>

              <div>
                <span>Available</span>
                <b>${category.available}</b>
              </div>

              <div>
                <span>Hired</span>
                <b>${category.hired}</b>
              </div>

              <div>
                <span>Off Road</span>
                <b>${category.offRoad}</b>
              </div>

            </div>

          </article>

        `
      )
      .join("");


  root
    .querySelectorAll(
      "[data-fleet-category]"
    )
    .forEach(
      (
        card
      ) => {

        const selectCategory =
          () => {

            const code =
              card.dataset.fleetCategory;


            selectedPlantType =
              selectedPlantType ===
                code
                ? ""
                : code;


            syncTypeFilterFromCategory();

            renderCategories();

            applyFleetFilters();

          };


        card.addEventListener(
          "click",
          selectCategory
        );


        card.addEventListener(
          "keydown",
          (
            event
          ) => {

            if (
              [
                "Enter",
                " "
              ].includes(
                event.key
              )
            ) {

              event.preventDefault();

              selectCategory();

            }

          }
        );

      }
    );

}


function syncTypeFilterFromCategory() {

  const filter =
    getElement(
      "fleetTypeFilter"
    );


  if (
    filter
  ) {

    filter.value =
      selectedPlantType;

  }

}


/* =========================================================
   FILTER / MAIN ASSET VIEW
========================================================= */

function applyFleetFilters() {

  const search =
    normaliseText(
      getElement(
        "fleetSearchInput"
      )?.value
    );


  const typeFilter =
    cleanString(
      getElement(
        "fleetTypeFilter"
      )?.value
    );


  const statusFilter =
    cleanString(
      getElement(
        "fleetStatusFilter"
      )?.value
    );


  const effectiveType =
    typeFilter ||
    selectedPlantType;


  const filtered =
    plantAssets
      .filter(
        isActiveAsset
      )
      .filter(
        (
          asset
        ) => {

          const hire =
            getHireRecordForAsset(
              asset
            );


          const searchText = [

            asset.id,
            asset.plantReference,
            asset.manufacturer,
            asset.model,
            asset.serialNumber,
            asset.registrationNumber,
            asset.supplierName,
            hire?.supplierName,
            asset.currentLocationLabel,
            asset.currentProjectName

          ]
            .filter(
              Boolean
            )
            .join(
              " "
            )
            .toLowerCase();


          const ownershipMatch = (

            selectedFleetView ===
              "ALL"

            ||

            (
              selectedFleetView ===
                "OWNED"

              &&

              asset.ownershipType ===
                "OWNED"
            )

            ||

            (
              selectedFleetView ===
                "HIRED"

              &&

              isHireOwnership(
                asset.ownershipType
              )
            )

          );


          return (

            ownershipMatch

            &&

            (
              !effectiveType

              ||

              asset.plantType ===
                effectiveType
            )

            &&

            (
              !statusFilter

              ||

              asset.status ===
                statusFilter
            )

            &&

            (
              !search

              ||

              searchText.includes(
                search
              )
            )

          );

        }
      );


  updateCurrentFleetHeading(
    filtered
  );


  renderFleetCards(
    filtered
  );


  renderFleetRegister(
    filtered
  );

}


function updateCurrentFleetHeading(
  records
) {

  const title =
    getElement(
      "currentFleetTitle"
    );


  const note =
    getElement(
      "currentFleetNote"
    );


  const count =
    getElement(
      "currentFleetCount"
    );


  const typeFilter =
    cleanString(
      getElement(
        "fleetTypeFilter"
      )?.value
    )
    ||
    selectedPlantType;


  let baseTitle =
    "Current Fleet";


  let baseNote =
    "Live asset position across the organisation.";


  if (
    selectedFleetView ===
      "HIRED"
  ) {

    baseTitle =
      "Hired / Leased Fleet";


    baseNote =
      "External plant currently recorded across the organisation.";

  } else if (
    selectedFleetView ===
      "OWNED"
  ) {

    baseTitle =
      "Owned Fleet";


    baseNote =
      "Organisation-owned plant currently in the fleet.";

  }


  if (
    typeFilter
  ) {

    baseTitle =
      `${getPlantTypeLabel(
        typeFilter
      )} · ${baseTitle}`;

  }


  if (
    title
  ) {

    title.textContent =
      baseTitle;

  }


  if (
    note
  ) {

    note.textContent =
      baseNote;

  }


  if (
    count
  ) {

    count.textContent =
      `${records.length} plant`;

  }

}


function renderFleetCards(
  records
) {

  const root =
    getElement(
      "fleetAssetGrid"
    );


  if (
    !root
  ) {

    return;

  }


  if (
    !records.length
  ) {

    root.innerHTML =
      emptyState(
        plantAssets.length
          ? "No plant matches the current fleet view."
          : "No plant assets have been added yet."
      );

    return;

  }


  root.innerHTML =
    records
      .map(
        renderFleetAssetCard
      )
      .join("");

}


function renderFleetAssetCard(
  asset
) {

  const hire =
    getHireRecordForAsset(
      asset
    );


  const hired =
    isHireOwnership(
      asset.ownershipType
    );


  const idleHire =
    isIdleHiredAsset(
      asset
    );


  const offRoad =
    isOffRoad(
      asset
    );


  const cardClasses = [
    "fleet-asset-card"
  ];


  if (
    idleHire
  ) {

    cardClasses.push(
      "is-idle-hire"
    );

  }


  if (
    offRoad
  ) {

    cardClasses.push(
      "is-off-road"
    );

  }


  const fourthFact =
    hired

      ? [
          "Off-Hire",
          formatDate(
            hire?.expectedOffHireDate
          )
        ]

      : [
          "Inspection",
          asset.lastInspectionLabel ||
          "No record"
        ];


  return `

    <article
      class="${cardClasses.join(
        " "
      )}"
    >

      <div class="fleet-asset-card__header">

        <span class="fleet-asset-card__reference">

          ${escapeHtml(
            asset.plantReference ||
            asset.id
          )}

        </span>


        <div class="fleet-asset-card__chips">

          <span class="fleet-ownership-chip">

            ${escapeHtml(
              getPlantOwnershipLabel(
                asset.ownershipType
              )
              ||
              "Unknown"
            )}

          </span>


          <span
            class="
              fleet-status-chip
              ${getStatusClass(
                asset.status
              )}
            "
          >

            ${escapeHtml(
              getPlantStatusLabel(
                asset.status ||
                "AVAILABLE"
              )
            )}

          </span>

        </div>

      </div>


      <strong class="fleet-asset-card__model">

        ${escapeHtml(
          assetDisplayName(
            asset
          )
        )}

      </strong>


      <span class="fleet-asset-card__type">

        ${escapeHtml(
          getPlantTypeLabel(
            asset.plantType
          )
        )}

      </span>


      <div class="fleet-asset-card__facts">


        <div>

          <span>
            Current Project
          </span>

          <strong>
            ${escapeHtml(
              asset.currentProjectName ||
              "Not allocated"
            )}
          </strong>

        </div>


        <div>

          <span>
            Current Location
          </span>

          <strong>
            ${escapeHtml(
              asset.currentLocationLabel ||
              "Not confirmed"
            )}
          </strong>

        </div>


        <div>

          <span>
            ${
              hired
                ? "Hire Rate"
                : "Compliance"
            }
          </span>

          <strong>

            ${escapeHtml(
              hired
                ? (
                    canViewPlantCosts
                      ? formatHireRate(
                          hire
                        )
                      : "Restricted"
                  )
                : (
                    asset.complianceLabel ||
                    "Not assessed"
                  )
            )}

          </strong>

        </div>


        <div>

          <span>
            ${escapeHtml(
              fourthFact[0]
            )}
          </span>

          <strong>
            ${escapeHtml(
              fourthFact[1]
            )}
          </strong>

        </div>


      </div>


      <div class="fleet-asset-card__footer">

        <span
          class="
            fleet-asset-card__signal
            ${
              offRoad
                ? "is-alert"
                : idleHire
                  ? "is-watch"
                  : ""
            }
          "
        >

          ${escapeHtml(
            getAssetSignal(
              asset,
              hire
            )
          )}

        </span>


        <a
          class="fleet-small-action"
          href="${assetUrl(
            asset
          )}"
        >
          Open Asset
        </a>

      </div>


    </article>

  `;

}

/* =========================================================
   REGISTER
========================================================= */

function renderFleetRegister(
  records
) {

  const root =
    getElement(
      "fleetRegister"
    );


  if (
    !root
  ) {

    return;

  }


  setCount(
    "fleetRegisterCount",
    records.length
  );


  if (
    !records.length
  ) {

    root.innerHTML =
      emptyState(
        "No plant records in this view."
      );

    return;

  }


  root.innerHTML = `

    <table class="fleet-table">

      <thead>

        <tr>

          <th>
            Plant ID
          </th>

          <th>
            Plant
          </th>

          <th>
            Ownership
          </th>

          <th>
            Current Project
          </th>

          <th>
            Location
          </th>

          <th>
            Status
          </th>

          ${
            canViewPlantCosts
              ? "<th>Hire Rate</th>"
              : ""
          }

          <th></th>

        </tr>

      </thead>


      <tbody>

        ${records
          .map(
            (
              asset
            ) => {

              const hire =
                getHireRecordForAsset(
                  asset
                );


              return `

                <tr>

                  <td>

                    <strong>
                      ${escapeHtml(
                        asset.plantReference ||
                        asset.id
                      )}
                    </strong>

                  </td>


                  <td>
                    ${escapeHtml(
                      assetDisplayName(
                        asset
                      )
                    )}
                  </td>


                  <td>
                    ${escapeHtml(
                      getPlantOwnershipLabel(
                        asset.ownershipType
                      )
                      ||
                      "—"
                    )}
                  </td>


                  <td>
                    ${escapeHtml(
                      asset.currentProjectName ||
                      "Not allocated"
                    )}
                  </td>


                  <td>
                    ${escapeHtml(
                      asset.currentLocationLabel ||
                      "Not confirmed"
                    )}
                  </td>


                  <td>
                    ${escapeHtml(
                      getPlantStatusLabel(
                        asset.status ||
                        "AVAILABLE"
                      )
                    )}
                  </td>


                  ${
                    canViewPlantCosts
                      ? `

                        <td>

                          ${escapeHtml(
                            isHireOwnership(
                              asset.ownershipType
                            )
                              ? formatHireRate(
                                  hire
                                )
                              : "—"
                          )}

                        </td>

                      `
                      : ""
                  }


                  <td>

                    <a
                      class="fleet-small-action"
                      href="${assetUrl(
                        asset
                      )}"
                    >
                      Open
                    </a>

                  </td>

                </tr>

              `;

            }
          )
          .join("")}

      </tbody>

    </table>

  `;

}


/* =========================================================
   CARD / DISPLAY HELPERS
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


function formatHireRate(
  hire
) {

  if (
    !hire

    ||

    hire.hireRate ==
      null
  ) {

    return "Not recorded";

  }


  const unit =
    cleanString(
      hire.hireRateUnit ||
      "WEEK"
    ).toLowerCase();


  return (
    `${formatCurrency(
      hire.hireRate
    )} / ${unit}`
  );

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

function setFleetView(
  view
) {

  selectedFleetView =
    view;


  document
    .querySelectorAll(
      "[data-fleet-view]"
    )
    .forEach(
      (
        button
      ) => {

        button.classList.toggle(
          "is-active",
          button.dataset.fleetView ===
            view
        );

      }
    );


  applyFleetFilters();

}


function showHiredFleet() {

  setFleetView(
    "HIRED"
  );


  scrollToCurrentFleet();

}


function showOwnedFleet() {

  setFleetView(
    "OWNED"
  );


  scrollToCurrentFleet();

}


function scrollToCurrentFleet() {

  getElement(
    "currentFleetTitle"
  )
    ?.closest(
      ".fleet-section"
    )
    ?.scrollIntoView({
      behavior:
        "smooth",

      block:
        "start"
    });

}


function clearFilters() {

  selectedPlantType =
    "";


  selectedFleetView =
    "ALL";


  [
    "fleetSearchInput",
    "fleetTypeFilter",
    "fleetStatusFilter"
  ].forEach(
    (
      id
    ) => {

      const element =
        getElement(
          id
        );


      if (
        element
      ) {

        element.value =
          "";

      }

    }
  );


  document
    .querySelectorAll(
      "[data-fleet-view]"
    )
    .forEach(
      (
        button
      ) => {

        button.classList.toggle(
          "is-active",
          button.dataset.fleetView ===
            "ALL"
        );

      }
    );


  renderCategories();

  applyFleetFilters();

}


/* =========================================================
   ADD PLANT MODAL
========================================================= */

function openAddPlantModal() {

  if (
    !canManagePlant
  ) {

    return;

  }


  stagedAttachments =
    [];


  getElement(
    "addPlantForm"
  )?.reset();


  hideModalMessage();

  renderAttachments();

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


  getElement(
    "fleetSearchInput"
  )?.addEventListener(
    "input",
    applyFleetFilters
  );


  getElement(
    "fleetTypeFilter"
  )?.addEventListener(
    "change",
    () => {

      selectedPlantType =
        cleanString(
          getElement(
            "fleetTypeFilter"
          )?.value
        );


      renderCategories();

      applyFleetFilters();

    }
  );


  getElement(
    "fleetStatusFilter"
  )?.addEventListener(
    "change",
    applyFleetFilters
  );


  getElement(
    "clearFleetFilters"
  )?.addEventListener(
    "click",
    clearFilters
  );


  getElement(
    "showAllHiredButton"
  )?.addEventListener(
    "click",
    showHiredFleet
  );


  getElement(
    "showAllOwnedButton"
  )?.addEventListener(
    "click",
    showOwnedFleet
  );


  document
    .querySelectorAll(
      "[data-fleet-view]"
    )
    .forEach(
      (
        button
      ) => {

        button.addEventListener(
          "click",
          () =>
            setFleetView(
              button.dataset.fleetView
            )
        );

      }
    );


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