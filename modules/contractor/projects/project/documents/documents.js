import {
  auth,
  db,
  storage
} from "/js/firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

import {
  renderProjectNav
} from "/modules/contractor/projects/shared/project-nav.js";

import {
  canProfileReviewAssignment,
  getDocumentReviewRoleOptions,
  getRoleLabel
} from "/modules/contractor/shared/js/roles.js";


/* =========================================================
   STATE
========================================================= */

let currentProfile = null;
let currentProject = null;
let currentProjectId = null;

let canManageProjectDocuments = false;
let canManageAssuranceDocuments = false;
let canReadCommercialDocuments = false;

let projectPhases = [];
let currentPhase = null;
let nextPhase = null;

let scopeMap = new Map();

let allDocuments = [];
let documentFamilies = [];
let documentRequirements = [];

let activeCategory = "ALL";

let selectedFamily = null;
let selectedReviewRevision = null;


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_FILE_SIZE =
  100 * 1024 * 1024;


const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];


const CATEGORY_LABELS = {

  ALL:
    "All",

  PROJECT:
    "Project Information",

  SCOPE:
    "Scope",

  TECHNICAL:
    "Technical & Design",

  ASSURANCE:
    "Assurance",

  DRAWING:
    "Drawings",

  PROGRAMME:
    "Programme",

  COMMERCIAL:
    "Commercial",

  GENERAL:
    "General"

};


const DOCUMENT_TYPES = {

  PROJECT: [

    [
      "PRE_CONSTRUCTION_INFORMATION",
      "Pre-Construction Information"
    ],

    [
      "CONSTRUCTION_PHASE_PLAN",
      "Construction Phase Plan"
    ],

    [
      "LOGISTICS_PLAN",
      "Logistics Plan"
    ],

    [
      "TRAFFIC_MANAGEMENT_PLAN",
      "Traffic Management Plan"
    ],

    [
      "EMERGENCY_ARRANGEMENTS",
      "Emergency Arrangements"
    ],

    [
      "ENVIRONMENTAL_PLAN",
      "Environmental Plan"
    ],

    [
      "WASTE_MANAGEMENT_PLAN",
      "Waste Management Plan"
    ],

    [
      "PROJECT_ORGANOGRAM",
      "Project Organogram"
    ],

    [
      "CLIENT_REQUIREMENT",
      "Client Requirement"
    ],

    [
      "PROJECT_APPOINTMENT",
      "Project Appointment"
    ],

    [
      "PROJECT_PROCEDURE",
      "Project Procedure"
    ],

    [
      "OTHER",
      "Other"
    ]

  ],


  SCOPE: [

    [
      "SCOPE_DOCUMENT",
      "Scope Document"
    ],

    [
      "CLIENT_INSTRUCTION",
      "Client Instruction"
    ],

    [
      "DRAWING",
      "Drawing"
    ],

    [
      "SKETCH",
      "Sketch"
    ],

    [
      "PHOTOGRAPH",
      "Photograph"
    ],

    [
      "SUPPORTING_DETAIL",
      "Supporting Detail"
    ],

    [
      "OTHER",
      "Other"
    ]

  ],


  TECHNICAL: [

    [
      "ENGINEERING_CALCULATION",
      "Engineering Calculation"
    ],

    [
      "DESIGN",
      "Design"
    ],

    [
      "DESIGN_CHECK",
      "Design Check"
    ],

    [
      "TEMPORARY_WORKS_DESIGN",
      "Temporary Works Design"
    ],

    [
      "TEMPORARY_WORKS_CHECK",
      "Temporary Works Check"
    ],

    [
      "TECHNICAL_SUBMISSION",
      "Technical Submission"
    ],

    [
      "SPECIFICATION",
      "Specification"
    ],

    [
      "ENGINEERING_APPROVAL",
      "Engineering Approval"
    ],

    [
      "OTHER",
      "Other"
    ]

  ],


  ASSURANCE: [

    [
      "RAMS",
      "RAMS"
    ],

    [
      "COSHH",
      "COSHH Assessment"
    ],

    [
      "LIFT_PLAN",
      "Lift Plan"
    ],

    [
      "ISOLATION_CERTIFICATE",
      "Isolation Certificate"
    ],

    [
      "INCIDENT_EVIDENCE",
      "Incident Evidence"
    ],

    [
      "NCR_EVIDENCE",
      "NCR Evidence"
    ],

    [
      "INSPECTION_EVIDENCE",
      "Inspection Evidence"
    ],

    [
      "TRANSPORT_AUTHORISATION",
      "Transport Authorisation"
    ],

    [
      "OTHER",
      "Other"
    ]

  ],


  DRAWING: [

    [
      "DRAWING",
      "Drawing"
    ],

    [
      "MARKED_UP_DRAWING",
      "Marked-Up Drawing"
    ],

    [
      "SKETCH",
      "Sketch"
    ],

    [
      "AS_BUILT_DRAWING",
      "As-Built Drawing"
    ],

    [
      "OTHER",
      "Other"
    ]

  ],


  PROGRAMME: [

    [
      "BASELINE_PROGRAMME",
      "Baseline Programme"
    ],

    [
      "PROGRAMME_REVISION",
      "Programme Revision"
    ],

    [
      "LOOKAHEAD_PROGRAMME",
      "Lookahead Programme"
    ],

    [
      "RECOVERY_PROGRAMME",
      "Recovery Programme"
    ],

    [
      "PROGRESS_SCHEDULE",
      "Progress Schedule"
    ],

    [
      "OTHER",
      "Other"
    ]

  ],


  GENERAL: [

    [
      "GENERAL_DOCUMENT",
      "General Document"
    ],

    [
      "CORRESPONDENCE",
      "Correspondence"
    ],

    [
      "PHOTOGRAPH",
      "Photograph"
    ],

    [
      "OTHER",
      "Other"
    ]

  ]

};


const DOCUMENT_REFERENCE_PREFIX = {

  PRE_CONSTRUCTION_INFORMATION:
    "PCI",

  CONSTRUCTION_PHASE_PLAN:
    "CPP",

  LOGISTICS_PLAN:
    "LOG",

  TRAFFIC_MANAGEMENT_PLAN:
    "TMP",

  EMERGENCY_ARRANGEMENTS:
    "EMG",

  ENVIRONMENTAL_PLAN:
    "ENV",

  WASTE_MANAGEMENT_PLAN:
    "WMP",

  PROJECT_ORGANOGRAM:
    "ORG",

  CLIENT_REQUIREMENT:
    "CLR",

  PROJECT_APPOINTMENT:
    "APT",

  PROJECT_PROCEDURE:
    "PRO",

  SCOPE_DOCUMENT:
    "SCOPE",

  CLIENT_INSTRUCTION:
    "CI",

  ENGINEERING_CALCULATION:
    "CALC",

  DESIGN:
    "DES",

  DESIGN_CHECK:
    "DCHK",

  TEMPORARY_WORKS_DESIGN:
    "TW",

  TEMPORARY_WORKS_CHECK:
    "TWC",

  TECHNICAL_SUBMISSION:
    "TS",

  SPECIFICATION:
    "SPEC",

  ENGINEERING_APPROVAL:
    "EA",

  RAMS:
    "RAMS",

  COSHH:
    "COSHH",

  LIFT_PLAN:
    "LP",

  ISOLATION_CERTIFICATE:
    "ISO",

  INCIDENT_EVIDENCE:
    "INC",

  NCR_EVIDENCE:
    "NCR",

  INSPECTION_EVIDENCE:
    "INSP",

  TRANSPORT_AUTHORISATION:
    "TA",

  DRAWING:
    "DRG",

  MARKED_UP_DRAWING:
    "MDRG",

  SKETCH:
    "SK",

  AS_BUILT_DRAWING:
    "ABD",

  BASELINE_PROGRAMME:
    "BP",

  PROGRAMME_REVISION:
    "PRG",

  LOOKAHEAD_PROGRAMME:
    "LA",

  RECOVERY_PROGRAMME:
    "REC",

  PROGRESS_SCHEDULE:
    "PS",

  GENERAL_DOCUMENT:
    "GEN",

  CORRESPONDENCE:
    "COR",

  PHOTOGRAPH:
    "PHOTO",

  SUPPORTING_DETAIL:
    "SUP",

  OTHER:
    "DOC"

};


const EXTERNAL_SOURCE_TYPES = [

  "CLIENT",

  "DESIGNER",

  "CONTRACTOR",

  "CONSULTANT",

  "OTHER_EXTERNAL"

];


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


  if (element) {

    element.textContent =
      value ?? "";

  }

}


function setInput(
  id,
  value
) {

  const element =
    getElement(
      id
    );


  if (element) {

    element.value =
      value ?? "";

  }

}


function cleanString(
  value
) {

  return String(
    value ?? ""
  ).trim();

}


function nullableString(
  value
) {

  const valueString =
    cleanString(
      value
    );


  return valueString ||
    null;

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


function getProjectId() {

  return new URLSearchParams(
    window.location.search
  ).get(
    "id"
  );

}


/* =========================================================
   WORKSPACE READY
========================================================= */

function waitForWorkspace() {

  if (
    window.NORMEX_CURRENT_USER
  ) {

    initialiseDocumentsPage(
      window.NORMEX_CURRENT_USER
    );

    return;

  }


  window.addEventListener(

    "normex:workspace-ready",

    (event) => {

      initialiseDocumentsPage(
        event.detail.profile
      );

    },

    {
      once: true
    }

  );

}


/* =========================================================
   PROJECT
========================================================= */

async function loadProject() {

  const snapshot =
    await getDoc(
      doc(
        db,
        "projects",
        currentProjectId
      )
    );


  if (
    !snapshot.exists()
  ) {

    return null;

  }


  return {

    id:
      snapshot.id,

    ...snapshot.data()

  };

}


/* =========================================================
   ACCESS
========================================================= */

async function determineAccess() {

  const uid =
    currentUid();


  canManageProjectDocuments =
    false;

  canManageAssuranceDocuments =
    false;

  canReadCommercialDocuments =
    false;


  if (!uid) {

    return;

  }


  /*
   * Explicit platform override.
   */

  if (
    Number(
      currentProfile?.accessLevel
    ) >= 99
  ) {

    canManageProjectDocuments =
      true;

    canManageAssuranceDocuments =
      true;

    canReadCommercialDocuments =
      true;

    return;

  }


  const permissions =
    currentProfile?.permissions ||
    {};


  if (
    permissions.canManageOrganisation ===
      true
  ) {

    canManageProjectDocuments =
      true;

  }


  if (
    permissions.canManageAssurance ===
      true
  ) {

    canManageAssuranceDocuments =
      true;

  }


  if (
    permissions.canViewCommercial ===
      true ||
    permissions.canManageCommercial ===
      true
  ) {

    canReadCommercialDocuments =
      true;

  }


  try {

    const membershipSnapshot =
      await getDoc(
        doc(
          db,
          "projects",
          currentProjectId,
          "members",
          uid
        )
      );


    if (
      !membershipSnapshot.exists()
    ) {

      return;

    }


    const membership =
      membershipSnapshot.data();


    if (
      membership.active !==
        true
    ) {

      return;

    }


    if (
      membership.canManageProject ===
        true
    ) {

      canManageProjectDocuments =
        true;

    }


    if (
      membership.canManageAssurance ===
        true
    ) {

      canManageAssuranceDocuments =
        true;

    }


    if (
      membership.canViewCommercial ===
        true ||
      membership.canManageCommercial ===
        true
    ) {

      canReadCommercialDocuments =
        true;

    }


  } catch (error) {

    console.warn(
      "NORMEX document access lookup failed:",
      error
    );

  }

}


/* =========================================================
   PROJECT PHASES
========================================================= */

async function loadProjectPhases() {

  projectPhases = [];

  currentPhase = null;

  nextPhase = null;


  try {

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "projectPhases"
          ),
          where(
            "projectId",
            "==",
            currentProjectId
          )
        )
      );


    projectPhases =
      snapshot.docs
        .map(
          (item) => ({

            id:
              item.id,

            ...item.data()

          })
        )
        .filter(
          (item) =>
            item.organisationId ===
              currentProject.organisationId
        )
        .sort(
          (a, b) =>
            Number(
              a.sequence ??
              9999
            ) -
            Number(
              b.sequence ??
              9999
            )
        );


    currentPhase =
      projectPhases.find(
        (phase) =>
          phase.id ===
            currentProject.currentPhaseId
      )
      ||
      projectPhases.find(
        (phase) =>
          phase.status ===
            "LIVE" ||
          phase.status ===
            "CURRENT"
      )
      ||
      null;


    if (
      currentPhase
    ) {

      const currentIndex =
        projectPhases.findIndex(
          (phase) =>
            phase.id ===
              currentPhase.id
        );


      nextPhase =
        projectPhases[
          currentIndex + 1
        ] ||
        null;

    } else {

      nextPhase =
        projectPhases.find(
          (phase) =>
            ![
              "COMPLETE",
              "COMPLETED",
              "ARCHIVED"
            ].includes(
              phase.status
            )
        )
        ||
        null;

    }


  } catch (error) {

    console.warn(
      "NORMEX project phases could not be loaded:",
      error
    );

  }

}


/* =========================================================
   SCOPES
========================================================= */

async function loadScopes() {

  scopeMap =
    new Map();


  try {

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "projectScopes"
          ),
          where(
            "projectId",
            "==",
            currentProjectId
          )
        )
      );


    snapshot.docs.forEach(
      (item) => {

        const data =
          item.data();


        if (
          data.organisationId ===
            currentProject.organisationId
        ) {

          scopeMap.set(
            item.id,
            {

              id:
                item.id,

              ...data

            }
          );

        }

      }
    );


  } catch (error) {

    console.warn(
      "NORMEX document scope labels failed:",
      error
    );

  }

}


/* =========================================================
   LOAD DOCUMENT REQUIREMENTS
========================================================= */

async function loadDocumentRequirements() {

  documentRequirements =
    [];


  try {

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "documentRequirements"
          ),
          where(
            "projectId",
            "==",
            currentProjectId
          )
        )
      );


    documentRequirements =
      snapshot.docs
        .map(
          (item) => ({

            id:
              item.id,

            ...item.data()

          })
        )
        .filter(
          (item) =>
            item.organisationId ===
              currentProject.organisationId
        );


  } catch (error) {

    console.warn(
      "NORMEX document requirements could not be loaded:",
      error
    );


    documentRequirements =
      [];

  }

}


/* =========================================================
   LOAD DOCUMENTS
========================================================= */

async function loadDocuments() {

  allDocuments =
    [];


  const categories = [

    "PROJECT",

    "SCOPE",

    "TECHNICAL",

    "ASSURANCE",

    "DRAWING",

    "PROGRAMME",

    "GENERAL"

  ];


  if (
    canReadCommercialDocuments
  ) {

    categories.push(
      "COMMERCIAL"
    );

  }


  const results =
    await Promise.all(

      categories.map(

        async (category) => {

          try {

            const snapshot =
              await getDocs(
                query(
                  collection(
                    db,
                    "documents"
                  ),
                  where(
                    "projectId",
                    "==",
                    currentProjectId
                  ),
                  where(
                    "category",
                    "==",
                    category
                  )
                )
              );


            return snapshot.docs.map(
              (item) => ({

                id:
                  item.id,

                ...item.data()

              })
            );


          } catch (error) {

            console.warn(
              `NORMEX could not load ${category} documents:`,
              error
            );


            return [];

          }

        }

      )

    );


  allDocuments =
    results
      .flat()
      .filter(
        (item) =>
          item.organisationId ===
            currentProject.organisationId
      );


  buildDocumentFamilies();

  deriveRequirementStatuses();

  renderEverything();

}


/* =========================================================
   BUILD DOCUMENT FAMILIES
========================================================= */

function buildDocumentFamilies() {

  const familyMap =
    new Map();


  allDocuments.forEach(
    (item) => {

      const familyId =
        item.documentFamilyId ||
        item.id;


      if (
        !familyMap.has(
          familyId
        )
      ) {

        familyMap.set(
          familyId,
          {

            id:
              familyId,

            revisions:
              []

          }
        );

      }


      familyMap
        .get(
          familyId
        )
        .revisions
        .push(
          item
        );

    }
  );


  documentFamilies =
    Array
      .from(
        familyMap.values()
      )
      .map(
        enrichFamily
      )
      .sort(
        compareFamilies
      );

}


/* =========================================================
   ENRICH DOCUMENT FAMILY
========================================================= */

function enrichFamily(
  family
) {

  const revisions =
    family.revisions
      .slice()
      .sort(
        compareRevisionsNewestFirst
      );


  const latest =
    revisions[0] ||
    null;


  const current =
    revisions.find(
      (item) =>
        item.isCurrent ===
          true &&
        item.status ===
          "CURRENT" &&
        item.uploadStatus ===
          "COMPLETE"
    )
    ||
    revisions.find(
      (item) =>
        item.isCurrent ===
          true &&
        item.uploadStatus ===
          "COMPLETE"
    )
    ||
    null;


  const pendingReview =
    revisions.find(
      (item) =>
        isReviewPending(
          item
        )
    )
    ||
    null;


  const latestProblem =
    revisions.find(
      (item) =>
        [
          "REVISE_AND_RESUBMIT",
          "REJECTED"
        ].includes(
          item.reviewStatus
        )
    )
    ||
    null;


  const displayRevision =
    pendingReview ||
    latestProblem ||
    current ||
    latest;


  return {

    ...family,

    revisions,

    latest,

    current,

    pendingReview,

    latestProblem,

    displayRevision,


    category:
      displayRevision?.category ||
      "GENERAL",


    documentType:
      displayRevision?.documentType ||
      "DOCUMENT",


    title:
      displayRevision?.title ||
      displayRevision?.fileName ||
      "Document",


    reference:
      displayRevision?.reference ||
      null,


    ownerName:
      displayRevision?.ownerName ||
      current?.ownerName ||
      displayRevision?.uploadedByName ||
      "Not assigned",


    reviewRoleCode:
      pendingReview?.reviewRoleCode ||
      displayRevision?.reviewRoleCode ||
      null,


    requirementId:
      displayRevision?.requirementId ||
      current?.requirementId ||
      null,


    scopeId:
      displayRevision?.scopeId ||
      current?.scopeId ||
      null,


    phaseId:
      displayRevision?.phaseId ||
      current?.phaseId ||
      null,


    sourceType:
      displayRevision?.sourceType ||
      current?.sourceType ||
      "INTERNAL",


    state:
      getFamilyState({
        current,
        pendingReview,
        latestProblem
      })

  };

}


/* =========================================================
   FAMILY STATE
========================================================= */

function getFamilyState(
  family
) {

  if (
    family.pendingReview
  ) {

    return "UNDER_REVIEW";

  }


  if (
    family.latestProblem
      ?.reviewStatus ===
        "REVISE_AND_RESUBMIT"
  ) {

    return "REVISE_AND_RESUBMIT";

  }


  if (
    family.latestProblem
      ?.reviewStatus ===
        "REJECTED"
  ) {

    return "REJECTED";

  }


  if (
    family.current
      ?.controlStatus ===
        "REFERENCE"
  ) {

    return "REFERENCE";

  }


  if (
    family.current
  ) {

    return "CURRENT";

  }


  return "NO_CURRENT";

}


/* =========================================================
   REVIEW PENDING
========================================================= */

function isReviewPending(
  item
) {

  return (

    item?.reviewRequired ===
      true &&

    [
      "PENDING",
      "UNDER_REVIEW"
    ].includes(
      item.reviewStatus
    ) &&

    item.uploadStatus ===
      "COMPLETE"

  );

}


/* =========================================================
   FAMILY SORT
========================================================= */

function compareFamilies(
  a,
  b
) {

  const priority = {

    UNDER_REVIEW:
      0,

    REVISE_AND_RESUBMIT:
      1,

    REJECTED:
      2,

    NO_CURRENT:
      3,

    CURRENT:
      4,

    REFERENCE:
      5

  };


  const difference =
    (
      priority[
        a.state
      ] ??
      99
    )
    -
    (
      priority[
        b.state
      ] ??
      99
    );


  if (
    difference !==
      0
  ) {

    return difference;

  }


  return (
    timestampToMilliseconds(
      b.latest?.uploadedAt
    )
    -
    timestampToMilliseconds(
      a.latest?.uploadedAt
    )
  );

}


/* =========================================================
   REVISION SORT
========================================================= */

function compareRevisionsNewestFirst(
  a,
  b
) {

  const dateDifference =
    timestampToMilliseconds(
      b.uploadedAt
    )
    -
    timestampToMilliseconds(
      a.uploadedAt
    );


  if (
    dateDifference !==
      0
  ) {

    return dateDifference;

  }


  return String(
    b.revision ||
    ""
  ).localeCompare(
    String(
      a.revision ||
      ""
    ),
    undefined,
    {
      numeric: true
    }
  );

}


/* =========================================================
   REQUIREMENT DERIVATION
========================================================= */

function deriveRequirementStatuses() {

  documentRequirements =
    documentRequirements.map(
      (requirement) => ({

        ...requirement,

        derivedStatus:
          calculateRequirementStatus(
            requirement
          )

      })
    );

}


/* =========================================================
   CALCULATE REQUIREMENT STATUS
========================================================= */

function calculateRequirementStatus(
  requirement
) {

  if (
    requirement.requirementState ===
      "NOT_REQUIRED"
  ) {

    return "NOT_REQUIRED";

  }


  const family =
    getRequirementFamily(
      requirement
    );


  if (!family) {

    if (
      requirement.requirementState ===
        "CONDITIONAL"
    ) {

      return "CONDITIONAL";

    }


    return "MISSING";

  }


  /*
   * Important:
   * if an older accepted revision is still current,
   * the requirement remains satisfied while the
   * next revision is under review.
   */

  if (
    family.state ===
      "UNDER_REVIEW"
  ) {

    return family.current
      ? "SATISFIED"
      : "UNDER_REVIEW";

  }


  /*
   * Same logic if a proposed revision has been
   * rejected or returned for revision.
   */

  if (
    [
      "REVISE_AND_RESUBMIT",
      "REJECTED"
    ].includes(
      family.state
    )
  ) {

    return family.current
      ? "SATISFIED"
      : "ACTION_REQUIRED";

  }


  if (
    family.state ===
      "NO_CURRENT"
  ) {

    return "NO_CURRENT_REVISION";

  }


  if (
    [
      "CURRENT",
      "REFERENCE"
    ].includes(
      family.state
    )
  ) {

    return "SATISFIED";

  }


  return "MISSING";

}


/* =========================================================
   REQUIREMENT → FAMILY
========================================================= */

function getRequirementFamily(
  requirement
) {

  /*
   * Preferred:
   * explicit link.
   */

  if (
    requirement.documentFamilyId
  ) {

    const explicitFamily =
      documentFamilies.find(
        (item) =>
          item.id ===
            requirement.documentFamilyId
      );


    if (
      explicitFamily
    ) {

      return explicitFamily;

    }

  }


  /*
   * Fallback:
   * match the same type/context for older records.
   */

  return (

    documentFamilies.find(
      (item) =>

        item.category ===
          requirement.category &&

        item.documentType ===
          requirement.documentType &&

        (
          !requirement.scopeId ||
          item.scopeId ===
            requirement.scopeId
        ) &&

        (
          !requirement.phaseId ||
          item.phaseId ===
            requirement.phaseId
        )
    )

    ||

    null

  );

}


/* =========================================================
   MAIN RENDER
========================================================= */

function renderEverything() {

  renderGateCards();

  renderImportantItems();

  renderReviewQueue();

  renderRequirements();


  renderCategoryTabs();

  renderDocumentScopeFilter();

  applyDocumentFilters();


  renderRecentActivity();

  renderRequirementOptions();

  updateReferencePreview();

}


/* =========================================================
   PROJECT / PHASE GATES
========================================================= */

function renderGateCards() {

  const root =
    getElement(
      "documentGateGrid"
    );


  if (!root) {

    return;

  }


  const gateDefinitions = [

    {

      key:
        "PROJECT_START",

      eyebrow:
        "Project Start",

      title:
        "Project Start",

      requirements:
        requirementsForGate(
          "PROJECT_START"
        )

    },


    {

      key:
        "CURRENT_PHASE",

      eyebrow:
        "Current Phase",

      title:
        currentPhase?.name ||
        currentProject.currentPhaseName ||
        "No current phase",

      requirements:
        currentPhase
          ? requirementsForPhase(
              currentPhase.id
            )
          : []

    },


    {

      key:
        "NEXT_PHASE",

      eyebrow:
        "Next Phase",

      title:
        nextPhase?.name ||
        "No next phase configured",

      requirements:
        nextPhase
          ? requirementsForPhase(
              nextPhase.id
            )
          : []

    },


    {

      key:
        "PROJECT_HANDOVER",

      eyebrow:
        "Project Handover",

      title:
        "Handover Information",

      requirements:
        requirementsForGate(
          "PROJECT_HANDOVER"
        )

    }

  ];


  const gateResults =
    gateDefinitions.map(
      buildGateResult
    );


  root.innerHTML =
    gateResults
      .map(
        renderGateCard
      )
      .join("");


  const blockingCount =
    gateResults.reduce(
      (
        total,
        gate
      ) =>
        total +
        gate.blockers,
      0
    );


  if (
    !documentRequirements.length
  ) {

    setText(
      "documentReadinessLabel",
      "No requirements configured"
    );

  } else if (
    blockingCount >
      0
  ) {

    setText(
      "documentReadinessLabel",
      `${blockingCount} blocking ${
        blockingCount === 1
          ? "issue"
          : "issues"
      }`
    );

  } else {

    setText(
      "documentReadinessLabel",
      "No document blockers"
    );

  }

}


/* =========================================================
   REQUIREMENTS FOR GATE
========================================================= */

function requirementsForGate(
  gateType
) {

  return documentRequirements.filter(
    (requirement) =>

      requirement.gateType ===
        gateType &&

      requirement.requirementState !==
        "NOT_REQUIRED"
  );

}


/* =========================================================
   REQUIREMENTS FOR PHASE
========================================================= */

function requirementsForPhase(
  phaseId
) {

  return documentRequirements.filter(
    (requirement) =>

      requirement.phaseId ===
        phaseId &&

      [
        "PHASE_START",
        "PHASE_COMPLETE"
      ].includes(
        requirement.gateType
      ) &&

      requirement.requirementState !==
        "NOT_REQUIRED"
  );

}


/* =========================================================
   BUILD GATE RESULT
========================================================= */

function buildGateResult(
  definition
) {

  const requirements =
    definition.requirements;


  const blockers =
    requirements.filter(
      (item) =>

        item.blocksProgress ===
          true &&

        [
          "MISSING",
          "UNDER_REVIEW",
          "ACTION_REQUIRED",
          "NO_CURRENT_REVISION"
        ].includes(
          item.derivedStatus
        )
    ).length;


  const actionCount =
    requirements.filter(
      (item) =>
        [
          "MISSING",
          "UNDER_REVIEW",
          "ACTION_REQUIRED",
          "NO_CURRENT_REVISION"
        ].includes(
          item.derivedStatus
        )
    ).length;


  const satisfied =
    requirements.filter(
      (item) =>
        item.derivedStatus ===
          "SATISFIED"
    ).length;


  let status =
    "READY";


  if (
    blockers >
      0
  ) {

    status =
      "BLOCKED";

  } else if (
    actionCount >
      0
  ) {

    status =
      "ACTION";

  } else if (
    !requirements.length
  ) {

    status =
      "NO_REQUIREMENTS";

  }


  return {

    ...definition,

    blockers,

    actionCount,

    satisfied,

    total:
      requirements.length,

    status

  };

}


/* =========================================================
   RENDER GATE CARD
========================================================= */

function renderGateCard(
  gate
) {

  let className =
    "documents-gate-card";


  if (
    gate.status ===
      "BLOCKED"
  ) {

    className +=
      " is-blocked";

  } else if (
    gate.status ===
      "ACTION"
  ) {

    className +=
      " is-warning";

  } else if (
    gate.status ===
      "READY"
  ) {

    className +=
      " is-ready";

  }


  const statusLabel = {

    READY:
      "READY",

    BLOCKED:
      "NOT READY",

    ACTION:
      "ACTION REQUIRED",

    NO_REQUIREMENTS:
      "NO REQUIREMENTS SET"

  }[
    gate.status
  ];


  const meta =
    gate.total
      ? `${gate.satisfied} / ${gate.total} satisfied${
          gate.blockers
            ? ` · ${gate.blockers} blocking`
            : ""
        }`
      : "No requirements configured for this gate";


  return `

    <article class="${className}">

      <span class="documents-gate-card__eyebrow">

        ${escapeHtml(
          gate.eyebrow
        )}

      </span>


      <h4>

        ${escapeHtml(
          gate.title
        )}

      </h4>


      <span class="documents-gate-card__status">

        ${escapeHtml(
          statusLabel
        )}

      </span>


      <span class="documents-gate-card__meta">

        ${escapeHtml(
          meta
        )}

      </span>

    </article>

  `;

}

/* =========================================================
   BLOCKING / IMPORTANT ITEMS
========================================================= */

function renderImportantItems() {

  const panel =
    getElement(
      "importantItemsPanel"
    );


  const root =
    getElement(
      "importantItemsList"
    );


  if (
    !panel ||
    !root
  ) {

    return;

  }


  const items =
    documentRequirements
      .filter(
        (requirement) =>

          requirement.requirementState !==
            "NOT_REQUIRED" &&

          (
            requirement.blocksProgress ===
              true ||

            requirement.criticality ===
              "CRITICAL"
          ) &&

          [
            "MISSING",
            "UNDER_REVIEW",
            "ACTION_REQUIRED",
            "NO_CURRENT_REVISION"
          ].includes(
            requirement.derivedStatus
          )
      )
      .sort(
        (a, b) =>

          Number(
            b.blocksProgress ===
              true
          )
          -
          Number(
            a.blocksProgress ===
              true
          )
      );


  panel.hidden =
    items.length ===
      0;


  setText(
    "importantItemsCount",
    `${items.length} ${
      items.length === 1
        ? "item"
        : "items"
    }`
  );


  root.innerHTML =
    items
      .map(
        (requirement) => {

          const family =
            getRequirementFamily(
              requirement
            );


          const rowClass =
            requirement.blocksProgress ===
              true
              ? "documents-priority-row is-blocking"
              : "documents-priority-row";


          return `

            <article class="${rowClass}">

              <div>

                ${renderCriticalityChip(
                  requirement.criticality
                )}

              </div>


              <div>

                <strong>

                  ${escapeHtml(
                    requirement.title
                  )}

                </strong>

                <span>

                  ${escapeHtml(
                    getRequirementContextLabel(
                      requirement
                    )
                  )}

                </span>

              </div>


              <div>

                <strong>

                  ${escapeHtml(
                    formatRequirementStatus(
                      requirement.derivedStatus
                    )
                  )}

                </strong>

                <span>

                  ${
                    requirement.blocksProgress ===
                      true
                      ? "Blocks progression"
                      : "Important, non-blocking"
                  }

                </span>

              </div>


              <div>

                ${
                  family

                    ? `

                      <button
                        class="documents-small-action"
                        type="button"
                        data-open-priority-family="${escapeHtml(
                          family.id
                        )}"
                      >
                        Open
                      </button>

                    `

                    : `

                      <button
                        class="documents-small-action"
                        type="button"
                        data-add-for-requirement="${escapeHtml(
                          requirement.id
                        )}"
                      >
                        Add Document
                      </button>

                    `
                }

              </div>

            </article>

          `;

        }
      )
      .join("");


  root
    .querySelectorAll(
      "[data-open-priority-family]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openDocumentWorkspace(
              button.dataset
                .openPriorityFamily
            );

          }
        );

      }
    );


  root
    .querySelectorAll(
      "[data-add-for-requirement]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openAddDocumentModal(
              button.dataset
                .addForRequirement
            );

          }
        );

      }
    );

}


/* =========================================================
   REVIEW QUEUE
========================================================= */

function renderReviewQueue() {

  const panel =
    getElement(
      "reviewQueuePanel"
    );


  const root =
    getElement(
      "reviewQueueList"
    );


  if (
    !panel ||
    !root
  ) {

    return;

  }


  const reviewItems =
    documentFamilies
      .filter(
        (family) =>
          family.pendingReview
      )
      .map(
        (family) => ({

          family,

          revision:
            family.pendingReview

        })
      )
      .sort(
        compareReviewItems
      );


  panel.hidden =
    reviewItems.length ===
      0;


  setText(
    "reviewQueueCount",
    `${reviewItems.length} ${
      reviewItems.length ===
        1
        ? "review"
        : "reviews"
    }`
  );


  root.innerHTML =
    reviewItems
      .map(
        (
          {
            family,
            revision
          }
        ) => {

          const canReview =
            canCurrentUserReviewRevision(
              revision
            );


          return `

            <article class="documents-review-row">

              <div>

                <strong>

                  ${escapeHtml(
                    family.reference ||
                    family.title
                  )}

                  · Rev

                  ${escapeHtml(
                    revision.revision ||
                    "—"
                  )}

                </strong>

                <span>

                  ${escapeHtml(
                    family.title
                  )}

                </span>

              </div>


              <div>

                <strong>

                  ${escapeHtml(
                    revision.reviewRoleCode
                      ? getRoleLabel(
                          revision.reviewRoleCode
                        )
                      : "Not assigned"
                  )}

                </strong>

                <span>
                  Reviewer role
                </span>

              </div>


              <div
                class="${reviewDueClass(
                  revision.reviewDueDate
                )}"
              >

                <strong>

                  ${escapeHtml(
                    formatReviewDueDate(
                      revision.reviewDueDate
                    )
                  )}

                </strong>

                <span>
                  Review due
                </span>

              </div>


              <button
                class="${
                  canReview
                    ? "documents-primary-action"
                    : "documents-small-action"
                }"
                type="button"
                data-open-review-family="${escapeHtml(
                  family.id
                )}"
              >

                ${
                  canReview
                    ? "Review"
                    : "Open"
                }

              </button>

            </article>

          `;

        }
      )
      .join("");


  root
    .querySelectorAll(
      "[data-open-review-family]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openDocumentWorkspace(
              button.dataset
                .openReviewFamily
            );

          }
        );

      }
    );

}


/* =========================================================
   REVIEW QUEUE SORT
========================================================= */

function compareReviewItems(
  a,
  b
) {

  const aDate =
    parseDateOnly(
      a.revision.reviewDueDate
    );


  const bDate =
    parseDateOnly(
      b.revision.reviewDueDate
    );


  if (
    aDate &&
    bDate
  ) {

    return (
      aDate -
      bDate
    );

  }


  if (
    aDate
  ) {

    return -1;

  }


  if (
    bDate
  ) {

    return 1;

  }


  return (

    timestampToMilliseconds(
      a.revision.uploadedAt
    )
    -
    timestampToMilliseconds(
      b.revision.uploadedAt
    )

  );

}


/* =========================================================
   FILTER REQUIREMENTS
========================================================= */

function filteredRequirements() {

  const gate =
    cleanString(
      getElement(
        "requirementGateFilter"
      )?.value
    );


  const criticality =
    cleanString(
      getElement(
        "requirementCriticalityFilter"
      )?.value
    );


  const status =
    cleanString(
      getElement(
        "requirementStatusFilter"
      )?.value
    );


  return documentRequirements
    .filter(
      (item) =>

        (
          !gate ||

          (
            item.gateType ||
            "NONE"
          ) ===
            gate
        )

        &&

        (
          !criticality ||

          item.criticality ===
            criticality
        )

        &&

        (
          !status ||

          item.derivedStatus ===
            status
        )
    )
    .sort(
      compareRequirements
    );

}


/* =========================================================
   REQUIREMENT SORT
========================================================= */

function compareRequirements(
  a,
  b
) {

  const gatePriority = {

    PROJECT_START:
      0,

    PHASE_START:
      1,

    PHASE_COMPLETE:
      2,

    PROJECT_HANDOVER:
      3,

    NONE:
      4

  };


  const criticalityPriority = {

    CRITICAL:
      0,

    REQUIRED:
      1,

    SUPPORTING:
      2

  };


  const gateDifference =
    (
      gatePriority[
        a.gateType ||
        "NONE"
      ] ??
      99
    )
    -
    (
      gatePriority[
        b.gateType ||
        "NONE"
      ] ??
      99
    );


  if (
    gateDifference !==
      0
  ) {

    return gateDifference;

  }


  const blockDifference =
    Number(
      b.blocksProgress ===
        true
    )
    -
    Number(
      a.blocksProgress ===
        true
    );


  if (
    blockDifference !==
      0
  ) {

    return blockDifference;

  }


  return (

    (
      criticalityPriority[
        a.criticality
      ] ??
      99
    )

    -

    (
      criticalityPriority[
        b.criticality
      ] ??
      99
    )

  );

}


/* =========================================================
   RENDER REQUIREMENTS
========================================================= */

function renderRequirements() {

  const root =
    getElement(
      "documentRequirementsRegister"
    );


  if (!root) {

    return;

  }


  const requirements =
    filteredRequirements();


  if (
    !requirements.length
  ) {

    root.innerHTML = `

      <div class="documents-empty documents-empty--compact">
        No document requirements match this view.
      </div>

    `;

    return;

  }


  root.innerHTML = `

    <table class="documents-requirements-table">

      <thead>

        <tr>

          <th>
            Priority
          </th>

          <th>
            Requirement
          </th>

          <th>
            Gate / Context
          </th>

          <th>
            Blocking
          </th>

          <th>
            Review Role
          </th>

          <th>
            Position
          </th>

          <th></th>

        </tr>

      </thead>


      <tbody>

        ${requirements
          .map(
            renderRequirementRow
          )
          .join("")}

      </tbody>

    </table>

  `;


  root
    .querySelectorAll(
      "[data-open-requirement-family]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openDocumentWorkspace(
              button.dataset
                .openRequirementFamily
            );

          }
        );

      }
    );


  root
    .querySelectorAll(
      "[data-add-requirement-document]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openAddDocumentModal(
              button.dataset
                .addRequirementDocument
            );

          }
        );

      }
    );

}


/* =========================================================
   REQUIREMENT ROW
========================================================= */

function renderRequirementRow(
  requirement
) {

  const family =
    getRequirementFamily(
      requirement
    );


  return `

    <tr>

      <td>

        ${renderCriticalityChip(
          requirement.criticality
        )}

      </td>


      <td class="requirement-name">

        <strong>

          ${escapeHtml(
            requirement.title ||
            formatDocumentType(
              requirement.documentType
            )
          )}

        </strong>

        <span>

          ${escapeHtml(
            CATEGORY_LABELS[
              requirement.category
            ] ||
            requirement.category
          )}

          ·

          ${escapeHtml(
            formatRequirementState(
              requirement.requirementState
            )
          )}

        </span>

      </td>


      <td>

        ${escapeHtml(
          getRequirementContextLabel(
            requirement
          )
        )}

      </td>


      <td>

        ${
          requirement.blocksProgress ===
            true

            ? `

              <span class="requirement-blocking is-blocking">
                Blocks
              </span>

            `

            : `

              <span class="requirement-blocking">
                Non-blocking
              </span>

            `
        }

      </td>


      <td>

        ${escapeHtml(
          requirement.reviewRoleCode
            ? getRoleLabel(
                requirement.reviewRoleCode
              )
            : "—"
        )}

      </td>


      <td>

        ${renderRequirementStatusChip(
          requirement.derivedStatus
        )}

      </td>


      <td>

        ${
          family

            ? `

              <button
                class="documents-small-action"
                type="button"
                data-open-requirement-family="${escapeHtml(
                  family.id
                )}"
              >
                Open
              </button>

            `

            : (

              requirement.requirementState !==
                "NOT_REQUIRED"

                ? `

                  <button
                    class="documents-small-action"
                    type="button"
                    data-add-requirement-document="${escapeHtml(
                      requirement.id
                    )}"
                  >
                    Add Document
                  </button>

                `

                : "—"

            )
        }

      </td>

    </tr>

  `;

}


/* =========================================================
   REQUIREMENT CONTEXT
========================================================= */

function getRequirementContextLabel(
  requirement
) {

  const gateLabel =
    formatGateType(
      requirement.gateType ||
      "NONE"
    );


  let context =
    "Project";


  if (
    requirement.phaseId
  ) {

    context =
      getPhaseLabel(
        requirement.phaseId
      );

  } else if (
    requirement.scopeId
  ) {

    context =
      getScopeLabel(
        requirement.scopeId
      );

  }


  return `${gateLabel} · ${context}`;

}


/* =========================================================
   CRITICALITY CHIP
========================================================= */

function renderCriticalityChip(
  criticality
) {

  let className =
    "requirement-criticality";


  if (
    criticality ===
      "CRITICAL"
  ) {

    className +=
      " is-critical";

  }


  if (
    criticality ===
      "REQUIRED"
  ) {

    className +=
      " is-required";

  }


  if (
    criticality ===
      "SUPPORTING"
  ) {

    className +=
      " is-supporting";

  }


  return `

    <span class="${className}">

      ${escapeHtml(
        formatStatus(
          criticality
        )
      )}

    </span>

  `;

}


/* =========================================================
   REQUIREMENT STATUS CHIP
========================================================= */

function renderRequirementStatusChip(
  status
) {

  let className =
    "documents-chip";


  if (
    status ===
      "SATISFIED"
  ) {

    className +=
      " is-satisfied";

  }


  if (
    status ===
      "UNDER_REVIEW"
  ) {

    className +=
      " is-review";

  }


  if (
    [
      "MISSING",
      "ACTION_REQUIRED",
      "NO_CURRENT_REVISION"
    ].includes(
      status
    )
  ) {

    className +=
      " is-danger";

  }


  if (
    [
      "CONDITIONAL",
      "NOT_REQUIRED"
    ].includes(
      status
    )
  ) {

    className +=
      " is-reference";

  }


  return `

    <span class="${className}">

      ${escapeHtml(
        formatRequirementStatus(
          status
        )
      )}

    </span>

  `;

}


/* =========================================================
   DOCUMENT CATEGORY TABS
========================================================= */

function renderCategoryTabs() {

  const root =
    getElement(
      "documentCategoryTabs"
    );


  if (!root) {

    return;

  }


  const categories = [

    "ALL",

    "PROJECT",

    "SCOPE",

    "TECHNICAL",

    "ASSURANCE",

    "DRAWING",

    "PROGRAMME"

  ];


  if (
    canReadCommercialDocuments
  ) {

    categories.push(
      "COMMERCIAL"
    );

  }


  categories.push(
    "GENERAL"
  );


  root.innerHTML =
    categories
      .map(
        (category) => `

          <button
            class="
              documents-category-tab
              ${
                activeCategory ===
                  category
                  ? "is-active"
                  : ""
              }
            "
            type="button"
            data-category="${category}"
          >

            ${escapeHtml(
              CATEGORY_LABELS[
                category
              ]
            )}

          </button>

        `
      )
      .join("");


  root
    .querySelectorAll(
      "[data-category]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            activeCategory =
              button.dataset.category;


            renderCategoryTabs();

            applyDocumentFilters();

          }
        );

      }
    );

}


/* =========================================================
   SCOPE / PHASE FILTER
========================================================= */

function renderDocumentScopeFilter() {

  const select =
    getElement(
      "documentScopeFilter"
    );


  if (!select) {

    return;

  }


  const phaseOptions =
    projectPhases.map(
      (phase) => `

        <option
          value="PHASE:${escapeHtml(
            phase.id
          )}"
        >

          Phase ·

          ${escapeHtml(
            phase.name ||
            phase.id
          )}

        </option>

      `
    );


  const scopeOptions =
    Array
      .from(
        scopeMap.values()
      )
      .sort(
        (a, b) =>

          String(
            a.scopeCode ||
            ""
          ).localeCompare(
            String(
              b.scopeCode ||
              ""
            ),
            undefined,
            {
              numeric: true
            }
          )
      )
      .map(
        (scope) => `

          <option
            value="SCOPE:${escapeHtml(
              scope.id
            )}"
          >

            Scope ·

            ${escapeHtml(
              `${scope.scopeCode} · ${scope.name}`
            )}

          </option>

        `
      );


  select.innerHTML = `

    <option value="">
      All Scopes / Phases
    </option>

    ${phaseOptions.join("")}

    ${scopeOptions.join("")}

  `;

}


/* =========================================================
   APPLY DOCUMENT FILTERS
========================================================= */

function applyDocumentFilters() {

  const search =
    cleanString(
      getElement(
        "documentSearchInput"
      )?.value
    ).toLowerCase();


  const state =
    cleanString(
      getElement(
        "documentStateFilter"
      )?.value
    );


  const scopePhase =
    cleanString(
      getElement(
        "documentScopeFilter"
      )?.value
    );


  const filtered =
    documentFamilies.filter(
      (family) => {

        const searchable =
          [

            family.reference,

            family.title,

            family.documentType,

            family.ownerName,

            family.latest?.fileName,

            family.current?.fileName,

            getScopeLabel(
              family.scopeId
            ),

            getPhaseLabel(
              family.phaseId
            ),

            formatSourceType(
              family.sourceType
            )

          ]
            .filter(
              Boolean
            )
            .join(
              " "
            )
            .toLowerCase();


        let contextMatches =
          true;


        if (
          scopePhase
        ) {

          const [
            contextType,
            contextId
          ] =
            scopePhase.split(
              ":"
            );


          contextMatches =
            contextType ===
              "SCOPE"
              ? family.scopeId ===
                  contextId
              : family.phaseId ===
                  contextId;

        }


        return (

          (
            activeCategory ===
              "ALL" ||

            family.category ===
              activeCategory
          )

          &&

          (
            !state ||

            family.state ===
              state
          )

          &&

          (
            !search ||

            searchable.includes(
              search
            )
          )

          &&

          contextMatches

        );

      }
    );


  renderDocumentRegister(
    filtered
  );

}


/* =========================================================
   DOCUMENT REGISTER
========================================================= */

function renderDocumentRegister(
  families
) {

  const root =
    getElement(
      "documentsRegister"
    );


  if (!root) {

    return;

  }


  setText(
    "documentsRegisterCount",
    `${families.length} ${
      families.length === 1
        ? "document"
        : "documents"
    }`
  );


  if (
    !families.length
  ) {

    root.innerHTML = `

      <div class="documents-empty">
        No controlled documents match this view.
      </div>

    `;

    return;

  }


  root.innerHTML = `

    <table class="documents-table">

      <thead>

        <tr>

          <th>
            Reference
          </th>

          <th>
            Document
          </th>

          <th>
            Type
          </th>

          <th>
            Scope / Phase
          </th>

          <th>
            Current Rev
          </th>

          <th>
            Status
          </th>

          <th>
            Source
          </th>

          <th>
            Updated
          </th>

          <th></th>

        </tr>

      </thead>


      <tbody>

        ${families
          .map(
            renderFamilyRow
          )
          .join("")}

      </tbody>

    </table>

  `;


  root
    .querySelectorAll(
      "[data-open-family]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openDocumentWorkspace(
              button.dataset
                .openFamily
            );

          }
        );

      }
    );

}


/* =========================================================
   FAMILY ROW
========================================================= */

function renderFamilyRow(
  family
) {

  return `

    <tr>

      <td>

        <strong>

          ${escapeHtml(
            family.reference ||
            "—"
          )}

        </strong>

      </td>


      <td class="documents-name">

        <strong>

          ${escapeHtml(
            family.title
          )}

        </strong>

        <span>

          ${escapeHtml(
            family.latest?.fileName ||
            family.current?.fileName ||
            ""
          )}

        </span>

      </td>


      <td>

        ${escapeHtml(
          formatDocumentType(
            family.documentType
          )
        )}

      </td>


      <td>

        ${escapeHtml(
          getFamilyContextLabel(
            family
          )
        )}

      </td>


      <td>

        <strong>

          ${escapeHtml(
            family.current?.revision ||
            "—"
          )}

        </strong>

      </td>


      <td>

        ${renderFamilyStateChip(
          family.state
        )}

      </td>


      <td>

        ${escapeHtml(
          formatSourceType(
            family.sourceType
          )
        )}

      </td>


      <td>

        ${escapeHtml(
          formatFirestoreDate(
            family.latest?.updatedAt ||
            family.latest?.uploadedAt
          )
        )}

      </td>


      <td>

        <button
          class="documents-small-action"
          type="button"
          data-open-family="${escapeHtml(
            family.id
          )}"
        >
          Open
        </button>

      </td>

    </tr>

  `;

}


/* =========================================================
   FAMILY CONTEXT
========================================================= */

function getFamilyContextLabel(
  family
) {

  if (
    family.scopeId
  ) {

    return getScopeLabel(
      family.scopeId
    );

  }


  if (
    family.phaseId
  ) {

    return getPhaseLabel(
      family.phaseId
    );

  }


  return "Project";

}


/* =========================================================
   FAMILY STATE CHIP
========================================================= */

function renderFamilyStateChip(
  state
) {

  let className =
    "documents-chip";


  if (
    state ===
      "CURRENT"
  ) {

    className +=
      " is-current";

  }


  if (
    state ===
      "UNDER_REVIEW"
  ) {

    className +=
      " is-review";

  }


  if (
    [
      "REVISE_AND_RESUBMIT",
      "REJECTED",
      "NO_CURRENT"
    ].includes(
      state
    )
  ) {

    className +=
      " is-danger";

  }


  if (
    state ===
      "REFERENCE"
  ) {

    className +=
      " is-reference";

  }


  return `

    <span class="${className}">

      ${escapeHtml(
        formatFamilyState(
          state
        )
      )}

    </span>

  `;

}


/* =========================================================
   OPEN DOCUMENT WORKSPACE
========================================================= */

function openDocumentWorkspace(
  familyId
) {

  selectedFamily =
    documentFamilies.find(
      (family) =>
        family.id ===
          familyId
    )
    ||
    null;


  if (
    !selectedFamily
  ) {

    return;

  }


  selectedReviewRevision =
    selectedFamily.pendingReview ||
    selectedFamily.latestProblem ||
    selectedFamily.latest ||
    null;


  renderDocumentWorkspace();


  const modal =
    getElement(
      "documentWorkspaceModal"
    );


  if (
    modal
  ) {

    modal.hidden =
      false;

  }


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE DOCUMENT WORKSPACE
========================================================= */

function closeDocumentWorkspace() {

  selectedFamily =
    null;

  selectedReviewRevision =
    null;


  const modal =
    getElement(
      "documentWorkspaceModal"
    );


  if (
    modal
  ) {

    modal.hidden =
      true;

  }


  const revisionSection =
    getElement(
      "newRevisionSection"
    );


  if (
    revisionSection
  ) {

    revisionSection.hidden =
      true;

  }


  document.body.style.overflow =
    "";


  resetNewRevisionForm();

}


/* =========================================================
   RENDER DOCUMENT WORKSPACE
========================================================= */

function renderDocumentWorkspace() {

  if (
    !selectedFamily
  ) {

    return;

  }


  const family =
    selectedFamily;


  const current =
    family.current;


  const latest =
    family.latest;


  setText(
    "documentWorkspaceReference",
    family.reference ||
    "Controlled Document"
  );


  setText(
    "documentWorkspaceTitle",
    family.title
  );


  setText(
    "documentWorkspaceSubtitle",
    `${
      CATEGORY_LABELS[
        family.category
      ] ||
      family.category
    } · ${formatDocumentType(
      family.documentType
    )}`
  );


  const summaryRoot =
    getElement(
      "documentWorkspaceSummary"
    );


  if (
    summaryRoot
  ) {

    summaryRoot.innerHTML = `

      <article>

        <span>
          Current Revision
        </span>

        <strong>

          ${escapeHtml(
            current?.revision ||
            "No current revision"
          )}

        </strong>

      </article>


      <article>

        <span>
          Latest Revision
        </span>

        <strong>

          ${escapeHtml(
            latest?.revision ||
            "—"
          )}

        </strong>

      </article>


      <article>

        <span>
          Status
        </span>

        <strong>

          ${escapeHtml(
            formatFamilyState(
              family.state
            )
          )}

        </strong>

      </article>


      <article>

        <span>
          Owner
        </span>

        <strong>

          ${escapeHtml(
            family.ownerName
          )}

        </strong>

      </article>


      <article>

        <span>
          Source
        </span>

        <strong>

          ${escapeHtml(
            formatSourceType(
              family.sourceType
            )
          )}

        </strong>

      </article>


      <article>

        <span>
          External Status
        </span>

        <strong>

          ${escapeHtml(
            formatExternalStatus(
              latest?.externalStatus ||
              current?.externalStatus
            )
          )}

        </strong>

      </article>


      <article>

        <span>
          Context
        </span>

        <strong>

          ${escapeHtml(
            getFamilyContextLabel(
              family
            )
          )}

        </strong>

      </article>


      <article>

        <span>
          Revisions
        </span>

        <strong>
          ${family.revisions.length}
        </strong>

      </article>

    `;

  }


  renderLinkedRequirement();

  renderReviewSection();

  renderRevisionHistory();

  renderWorkspaceActionButtons();

}


/* =========================================================
   WORKSPACE ACTION BUTTONS
========================================================= */

function renderWorkspaceActionButtons() {

  const currentButton =
    getElement(
      "viewCurrentDocumentButton"
    );


  const latestButton =
    getElement(
      "viewLatestDocumentButton"
    );


  const revisionButton =
    getElement(
      "showNewRevisionButton"
    );


  if (
    currentButton
  ) {

    currentButton.hidden =
      !selectedFamily?.current;

  }


  if (
    latestButton
  ) {

    latestButton.hidden =
      !selectedFamily?.latest;

  }


  if (
    revisionButton
  ) {

    revisionButton.hidden =
      !canManageFamily(
        selectedFamily
      );

  }

}


/* =========================================================
   LINKED REQUIREMENT
========================================================= */

function renderLinkedRequirement() {

  const root =
    getElement(
      "documentRequirementLink"
    );


  if (!root) {

    return;

  }


  const requirement =
    selectedFamily?.requirementId

      ? documentRequirements.find(
          (item) =>
            item.id ===
              selectedFamily.requirementId
        )

      : documentRequirements.find(
          (item) =>
            getRequirementFamily(
              item
            )?.id ===
              selectedFamily?.id
        );


  if (
    !requirement
  ) {

    root.hidden =
      true;

    root.innerHTML =
      "";

    return;

  }


  root.hidden =
    false;


  root.innerHTML = `

    <span>
      Linked Requirement
    </span>

    <strong>

      ${escapeHtml(
        requirement.title
      )}

      ·

      ${escapeHtml(
        formatRequirementStatus(
          requirement.derivedStatus
        )
      )}

      ${
        requirement.blocksProgress ===
          true
          ? " · BLOCKING"
          : ""
      }

    </strong>

  `;

}


/* =========================================================
   CAN MANAGE FAMILY
========================================================= */

function canManageFamily(
  family
) {

  if (
    !family
  ) {

    return false;

  }


  if (
    Number(
      currentProfile?.accessLevel
    ) >= 99
  ) {

    return true;

  }


  if (
    family.category ===
      "ASSURANCE"
  ) {

    return canManageAssuranceDocuments;

  }


  return canManageProjectDocuments;

}


/* =========================================================
   CAN CURRENT USER REVIEW
========================================================= */

function canCurrentUserReviewRevision(
  revision
) {

  if (
    !revision
      ?.reviewRoleCode
  ) {

    return false;

  }


  return canProfileReviewAssignment(
    currentProfile,
    revision.reviewRoleCode
  );

}


/* =========================================================
   RENDER REVIEW SECTION
========================================================= */

function renderReviewSection() {

  const section =
    getElement(
      "documentReviewSection"
    );


  const details =
    getElement(
      "documentReviewDetails"
    );


  const actions =
    getElement(
      "documentReviewActions"
    );


  const badge =
    getElement(
      "documentReviewAssignmentBadge"
    );


  const revision =
    selectedReviewRevision;


  if (
    !section ||
    !details ||
    !revision ||
    revision.reviewRequired !==
      true
  ) {

    if (
      section
    ) {

      section.hidden =
        true;

    }


    return;

  }


  section.hidden =
    false;


  if (
    badge
  ) {

    badge.textContent =
      revision.reviewRoleCode
        ? getRoleLabel(
            revision.reviewRoleCode
          )
        : "Not assigned";

  }


  details.innerHTML = `

    <div class="document-review-detail">

      <span>
        Revision
      </span>

      <strong>

        ${escapeHtml(
          revision.revision ||
          "—"
        )}

      </strong>

    </div>


    <div class="document-review-detail">

      <span>
        Assigned Role
      </span>

      <strong>

        ${escapeHtml(
          revision.reviewRoleCode
            ? getRoleLabel(
                revision.reviewRoleCode
              )
            : "Not assigned"
        )}

      </strong>

    </div>


    <div class="document-review-detail">

      <span>
        Review Due
      </span>

      <strong>

        ${escapeHtml(
          formatReviewDueDate(
            revision.reviewDueDate
          )
        )}

      </strong>

    </div>


    <div class="document-review-detail">

      <span>
        Review Status
      </span>

      <strong>

        ${escapeHtml(
          formatReviewStatus(
            revision.reviewStatus
          )
        )}

      </strong>

    </div>


    <div class="document-review-detail">

      <span>
        Submitted By
      </span>

      <strong>

        ${escapeHtml(
          revision.uploadedByName ||
          "NORMEX User"
        )}

      </strong>

    </div>


    <div class="document-review-detail">

      <span>
        Decision By
      </span>

      <strong>

        ${escapeHtml(
          revision.reviewedByName ||
          "Pending"
        )}

      </strong>

    </div>


    ${
      revision.reviewComments

        ? `

          <div
            class="
              document-review-detail
              document-review-detail--comments
            "
          >

            <span>
              Review Comments
            </span>

            <strong>

              ${escapeHtml(
                revision.reviewComments
              )}

            </strong>

          </div>

        `

        : ""
    }

  `;


  if (
    actions
  ) {

    actions.hidden =
      !(
        isReviewPending(
          revision
        )
        &&
        canCurrentUserReviewRevision(
          revision
        )
      );

  }


  setInput(
    "documentReviewComments",
    ""
  );


  hideMessage(
    "documentReviewError"
  );

}

/* =========================================================
   REVIEW DECISION
========================================================= */

async function makeReviewDecision(
  decision
) {

  const revision =
    selectedReviewRevision;


  if (
    !revision ||
    !selectedFamily ||
    !isReviewPending(
      revision
    ) ||
    !canCurrentUserReviewRevision(
      revision
    )
  ) {

    return;

  }


  const comments =
    cleanString(
      getElement(
        "documentReviewComments"
      )?.value
    );


  if (
    [
      "REVISE_AND_RESUBMIT",
      "REJECTED",
      "ACCEPTED_WITH_COMMENTS"
    ].includes(
      decision
    ) &&
    !comments
  ) {

    showMessage(
      "documentReviewError",
      "Add review comments before saving this decision."
    );

    return;

  }


  const batch =
    writeBatch(
      db
    );


  const revisionReference =
    doc(
      db,
      "documents",
      revision.id
    );


  try {

    if (
      [
        "ACCEPTED",
        "ACCEPTED_WITH_COMMENTS"
      ].includes(
        decision
      )
    ) {

      /*
       * A newly accepted revision becomes the current
       * controlled revision.
       *
       * Any previous current revision is superseded.
       */

      selectedFamily.revisions.forEach(
        (item) => {

          if (
            item.id ===
              revision.id
          ) {

            return;

          }


          if (
            item.isCurrent ===
              true ||
            item.status ===
              "CURRENT"
          ) {

            batch.update(
              doc(
                db,
                "documents",
                item.id
              ),
              {

                isCurrent:
                  false,

                status:
                  "SUPERSEDED",

                supersededByDocumentId:
                  revision.id,

                updatedByUid:
                  currentUid(),

                updatedAt:
                  serverTimestamp()

              }
            );

          }

        }
      );


      batch.update(
        revisionReference,
        {

          reviewStatus:
            decision,

          reviewComments:
            comments ||
            null,

          reviewedByUid:
            currentUid(),

          reviewedByName:
            currentUserName(),

          reviewedAt:
            serverTimestamp(),

          controlStatus:
            "CURRENT",

          status:
            "CURRENT",

          isCurrent:
            true,

          supersedesDocumentId:
            selectedFamily.current?.id ||
            revision.supersedesDocumentId ||
            null,

          updatedByUid:
            currentUid(),

          updatedAt:
            serverTimestamp()

        }
      );

    } else {

      /*
       * A rejected or revise/resubmit revision does NOT
       * invalidate the previously accepted revision.
       */

      batch.update(
        revisionReference,
        {

          reviewStatus:
            decision,

          reviewComments:
            comments ||
            null,

          reviewedByUid:
            currentUid(),

          reviewedByName:
            currentUserName(),

          reviewedAt:
            serverTimestamp(),

          controlStatus:
            "ACTION_REQUIRED",

          status:
            decision,

          isCurrent:
            false,

          updatedByUid:
            currentUid(),

          updatedAt:
            serverTimestamp()

        }
      );

    }


    createDocumentActivity(
      batch,
      {

        type:
          "DOCUMENT_REVIEW_DECISION",

        documentId:
          revision.id,

        documentFamilyId:
          selectedFamily.id,

        revision:
          revision.revision,

        decision,

        reviewRoleCode:
          revision.reviewRoleCode ||
          null,

        summary:
          `${
            selectedFamily.reference ||
            selectedFamily.title
          } · Rev ${
            revision.revision ||
            "—"
          } · ${
            formatReviewStatus(
              decision
            )
          }`

      }
    );


    await batch.commit();


    const familyId =
      selectedFamily.id;


    await loadDocuments();


    selectedFamily =
      documentFamilies.find(
        (family) =>
          family.id ===
            familyId
      )
      ||
      null;


    selectedReviewRevision =
      selectedFamily?.pendingReview ||
      selectedFamily?.latestProblem ||
      selectedFamily?.latest ||
      null;


    if (
      selectedFamily
    ) {

      renderDocumentWorkspace();

    }


  } catch (error) {

    console.error(
      "NORMEX document review decision failed:",
      error
    );


    showMessage(
      "documentReviewError",
      "The review decision could not be saved."
    );

  }

}


/* =========================================================
   REVISION HISTORY
========================================================= */

function renderRevisionHistory() {

  const root =
    getElement(
      "documentRevisionHistory"
    );


  if (
    !root ||
    !selectedFamily
  ) {

    return;

  }


  root.innerHTML =
    selectedFamily.revisions
      .map(
        (revision) => {

          const current =
            revision.isCurrent ===
              true &&
            revision.status ===
              "CURRENT";


          const superseded =
            revision.status ===
              "SUPERSEDED";


          const note =
            revision.revisionNote
              ? revision.revisionNote
              : "No revision note recorded";


          return `

            <article
              class="
                document-revision-row
                ${
                  current
                    ? "is-current"
                    : ""
                }
                ${
                  superseded
                    ? "is-superseded"
                    : ""
                }
              "
            >

              <div class="document-revision-row__rev">

                Rev

                ${escapeHtml(
                  revision.revision ||
                  "—"
                )}

              </div>


              <div class="document-revision-row__title">

                <strong>

                  ${escapeHtml(
                    revision.fileName ||
                    revision.title ||
                    "Document"
                  )}

                </strong>

                <span>

                  ${escapeHtml(
                    note
                  )}

                </span>

                <span>

                  ${escapeHtml(
                    revision.uploadedByName ||
                    "NORMEX User"
                  )}

                  ·

                  ${escapeHtml(
                    formatRevisionState(
                      revision
                    )
                  )}

                </span>

              </div>


              <div class="document-revision-row__meta">

                ${escapeHtml(
                  formatFirestoreDate(
                    revision.uploadedAt
                  )
                )}

              </div>


              <div>

                ${renderRevisionChip(
                  revision
                )}

              </div>


              <div>

                ${
                  revision.uploadStatus ===
                    "COMPLETE"

                    ? `

                      <button
                        class="documents-small-action"
                        type="button"
                        data-view-revision="${escapeHtml(
                          revision.id
                        )}"
                      >
                        View
                      </button>

                    `

                    : ""
                }

              </div>

            </article>

          `;

        }
      )
      .join("");


  root
    .querySelectorAll(
      "[data-view-revision]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openPhysicalDocument(
              button.dataset
                .viewRevision
            );

          }
        );

      }
    );

}


/* =========================================================
   REVISION CHIP
========================================================= */

function renderRevisionChip(
  revision
) {

  if (
    revision.isCurrent ===
      true &&
    revision.status ===
      "CURRENT"
  ) {

    return renderFamilyStateChip(
      "CURRENT"
    );

  }


  if (
    isReviewPending(
      revision
    )
  ) {

    return renderFamilyStateChip(
      "UNDER_REVIEW"
    );

  }


  if (
    revision.reviewStatus ===
      "REVISE_AND_RESUBMIT"
  ) {

    return renderFamilyStateChip(
      "REVISE_AND_RESUBMIT"
    );

  }


  if (
    revision.reviewStatus ===
      "REJECTED"
  ) {

    return renderFamilyStateChip(
      "REJECTED"
    );

  }


  if (
    revision.status ===
      "SUPERSEDED"
  ) {

    return `

      <span class="documents-chip is-reference">
        Superseded
      </span>

    `;

  }


  if (
    revision.controlStatus ===
      "REFERENCE"
  ) {

    return renderFamilyStateChip(
      "REFERENCE"
    );

  }


  return `

    <span class="documents-chip">

      ${escapeHtml(
        formatRevisionState(
          revision
        )
      )}

    </span>

  `;

}


/* =========================================================
   AUTOMATIC DOCUMENT REFERENCE
========================================================= */

function getReferencePrefix(
  documentType
) {

  return (
    DOCUMENT_REFERENCE_PREFIX[
      documentType
    ] ||
    "DOC"
  );

}


/* =========================================================
   REFERENCE PREVIEW
========================================================= */

function updateReferencePreview() {

  const documentType =
    getElement(
      "addDocumentType"
    )?.value;


  const preview =
    getElement(
      "addDocumentReferencePreview"
    );


  if (
    !preview
  ) {

    return;

  }


  const prefix =
    getReferencePrefix(
      documentType
    );


  preview.value =
    `${prefix}-AUTO`;

}


/* =========================================================
   ALLOCATE DOCUMENT REFERENCE
========================================================= */

async function allocateDocumentReference(
  documentType
) {

  const prefix =
    getReferencePrefix(
      documentType
    );


  const projectReference =
    doc(
      db,
      "projects",
      currentProjectId
    );


  const nextNumber =
    await runTransaction(
      db,
      async (transaction) => {

        const projectSnapshot =
          await transaction.get(
            projectReference
          );


        if (
          !projectSnapshot.exists()
        ) {

          throw new Error(
            "Project not found while allocating document reference."
          );

        }


        const data =
          projectSnapshot.data();


        const counters =
          {
            ...(
              data.documentCounters ||
              {}
            )
          };


        const currentNumber =
          Number(
            counters[
              prefix
            ] ||
            0
          );


        const allocated =
          currentNumber +
          1;


        counters[
          prefix
        ] =
          allocated;


        transaction.update(
          projectReference,
          {

            documentCounters:
              counters

          }
        );


        return allocated;

      }
    );


  return `${prefix}-${String(
    nextNumber
  ).padStart(
    3,
    "0"
  )}`;

}


/* =========================================================
   OPEN ADD DOCUMENT
========================================================= */

function openAddDocumentModal(
  requirementId = null
) {

  resetAddDocumentForm();


  renderUploadCategoryOptions();

  updateDocumentTypeOptions();


  renderReviewRoleOptions(
    "addDocumentReviewRole"
  );


  renderRequirementOptions();


  renderScopeOptions(
    "addDocumentScope"
  );


  renderPhaseOptions(
    "addDocumentPhase"
  );


  setInput(
    "addDocumentOwner",
    currentUserName()
  );


  if (
    requirementId
  ) {

    const requirement =
      documentRequirements.find(
        (item) =>
          item.id ===
            requirementId
      );


    if (
      requirement
    ) {

      setInput(
        "addDocumentCategory",
        requirement.category
      );


      updateDocumentTypeOptions();


      setInput(
        "addDocumentType",
        requirement.documentType
      );


      setInput(
        "addDocumentTitle",
        requirement.title
      );


      setInput(
        "addDocumentRequirement",
        requirement.id
      );


      setInput(
        "addDocumentScope",
        requirement.scopeId ||
        ""
      );


      setInput(
        "addDocumentPhase",
        requirement.phaseId ||
        ""
      );


      if (
        requirement.reviewRoleCode
      ) {

        setInput(
          "addDocumentReviewRequired",
          "YES"
        );


        setInput(
          "addDocumentReviewRole",
          requirement.reviewRoleCode
        );

      }

    }

  }


  updateReviewRequirementFields(
    "add"
  );


  updateExternalSourceFields();


  updateReferencePreview();


  const modal =
    getElement(
      "addDocumentModal"
    );


  if (
    modal
  ) {

    modal.hidden =
      false;

  }


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE ADD DOCUMENT
========================================================= */

function closeAddDocumentModal() {

  const modal =
    getElement(
      "addDocumentModal"
    );


  if (
    modal
  ) {

    modal.hidden =
      true;

  }


  document.body.style.overflow =
    "";


  resetAddDocumentForm();

}


/* =========================================================
   DOCUMENT CATEGORY OPTIONS
========================================================= */

function renderUploadCategoryOptions() {

  const select =
    getElement(
      "addDocumentCategory"
    );


  if (
    !select
  ) {

    return;

  }


  const categories = [

    [
      "PROJECT",
      "Project Information"
    ],

    [
      "SCOPE",
      "Scope"
    ],

    [
      "TECHNICAL",
      "Technical & Design"
    ],

    [
      "DRAWING",
      "Drawing"
    ],

    [
      "PROGRAMME",
      "Programme"
    ],

    [
      "GENERAL",
      "General"
    ]

  ];


  if (
    canManageAssuranceDocuments
  ) {

    categories.splice(
      3,
      0,
      [
        "ASSURANCE",
        "Assurance"
      ]
    );

  }


  select.innerHTML =
    categories
      .map(
        (
          [
            value,
            label
          ]
        ) => `

          <option value="${value}">
            ${escapeHtml(
              label
            )}
          </option>

        `
      )
      .join("");

}


/* =========================================================
   DOCUMENT TYPE OPTIONS
========================================================= */

function updateDocumentTypeOptions() {

  const category =
    getElement(
      "addDocumentCategory"
    )?.value ||
    "PROJECT";


  const select =
    getElement(
      "addDocumentType"
    );


  if (
    !select
  ) {

    return;

  }


  const types =
    DOCUMENT_TYPES[
      category
    ] ||
    [
      [
        "OTHER",
        "Other"
      ]
    ];


  select.innerHTML =
    types
      .map(
        (
          [
            value,
            label
          ]
        ) => `

          <option value="${value}">
            ${escapeHtml(
              label
            )}
          </option>

        `
      )
      .join("");


  updateReferencePreview();

}


/* =========================================================
   REVIEW ROLE OPTIONS
========================================================= */

function renderReviewRoleOptions(
  selectId
) {

  const select =
    getElement(
      selectId
    );


  if (
    !select
  ) {

    return;

  }


  const options =
    getDocumentReviewRoleOptions();


  select.innerHTML = `

    <option value="">
      Select reviewer role
    </option>

    ${options
      .map(
        (option) => `

          <option
            value="${escapeHtml(
              option.value
            )}"
          >

            ${escapeHtml(
              option.label
            )}

          </option>

        `
      )
      .join("")}

  `;

}


/* =========================================================
   REVIEW REQUIREMENT FIELDS
========================================================= */

function updateReviewRequirementFields(
  mode
) {

  const requiredSelectId =
    mode ===
      "revision"
      ? "newRevisionReviewRequired"
      : "addDocumentReviewRequired";


  const roleFieldId =
    mode ===
      "revision"
      ? "newRevisionReviewRoleField"
      : "addDocumentReviewRoleField";


  const dueFieldId =
    mode ===
      "revision"
      ? "newRevisionReviewDueField"
      : "addDocumentReviewDueField";


  const required =
    getElement(
      requiredSelectId
    )?.value ===
      "YES";


  const roleField =
    getElement(
      roleFieldId
    );


  const dueField =
    getElement(
      dueFieldId
    );


  if (
    roleField
  ) {

    roleField.hidden =
      !required;

  }


  if (
    dueField
  ) {

    dueField.hidden =
      !required;

  }

}


/* =========================================================
   EXTERNAL SOURCE FIELDS
========================================================= */

function updateExternalSourceFields() {

  const sourceType =
    getElement(
      "addDocumentSourceType"
    )?.value ||
    "INTERNAL";


  const field =
    getElement(
      "addDocumentExternalStatusField"
    );


  if (
    field
  ) {

    field.hidden =
      !EXTERNAL_SOURCE_TYPES.includes(
        sourceType
      );

  }

}


/* =========================================================
   ADD DOCUMENT FILE
========================================================= */

function handleAddDocumentFileSelection() {

  const file =
    getElement(
      "addDocumentFile"
    )?.files?.[0];


  updateFileDisplay(
    file,
    "addDocumentFileTitle",
    "addDocumentFileMeta",
    "Select PDF or image"
  );


  const title =
    getElement(
      "addDocumentTitle"
    );


  if (
    file &&
    title &&
    !cleanString(
      title.value
    )
  ) {

    title.value =
      removeFileExtension(
        file.name
      );

  }

}


/* =========================================================
   CREATE CONTROLLED DOCUMENT
========================================================= */

async function createControlledDocument(
  event
) {

  event.preventDefault();


  hideMessage(
    "addDocumentError"
  );


  const form =
    new FormData(
      event.currentTarget
    );


  const category =
    cleanString(
      form.get(
        "category"
      )
    );


  if (
    category ===
      "ASSURANCE" &&
    !canManageAssuranceDocuments
  ) {

    showMessage(
      "addDocumentError",
      "You do not have permission to add assurance documents."
    );

    return;

  }


  if (
    category !==
      "ASSURANCE" &&
    !canManageProjectDocuments
  ) {

    showMessage(
      "addDocumentError",
      "You do not have permission to add project documents."
    );

    return;

  }


  const file =
    getElement(
      "addDocumentFile"
    )?.files?.[0];


  const fileError =
    validateFile(
      file
    );


  if (
    fileError
  ) {

    showMessage(
      "addDocumentError",
      fileError
    );

    return;

  }


  const title =
    cleanString(
      form.get(
        "title"
      )
    );


  const documentType =
    cleanString(
      form.get(
        "documentType"
      )
    );


  const ownerName =
    cleanString(
      form.get(
        "ownerName"
      )
    );


  const revision =
    cleanString(
      form.get(
        "revision"
      )
    );


  const reviewRequired =
    form.get(
      "reviewRequired"
    ) ===
      "YES";


  const reviewRoleCode =
    reviewRequired
      ? cleanString(
          form.get(
            "reviewRoleCode"
          )
        )
      : null;


  const reviewDueDate =
    reviewRequired
      ? nullableString(
          form.get(
            "reviewDueDate"
          )
        )
      : null;


  const requirementId =
    nullableString(
      form.get(
        "requirementId"
      )
    );


  if (
    !title ||
    !documentType ||
    !ownerName ||
    !revision
  ) {

    showMessage(
      "addDocumentError",
      "Title, document type, owner and revision are required."
    );

    return;

  }


  if (
    reviewRequired &&
    !reviewRoleCode
  ) {

    showMessage(
      "addDocumentError",
      "Select the role responsible for reviewing this document."
    );

    return;

  }


  const button =
    getElement(
      "saveAddDocument"
    );


  if (
    button
  ) {

    button.disabled =
      true;

    button.textContent =
      "Allocating reference...";

  }


  try {

    const reference =
      await allocateDocumentReference(
        documentType
      );


    const documentReference =
      doc(
        collection(
          db,
          "documents"
        )
      );


    const documentFamilyId =
      documentReference.id;


    const storagePath =
      buildStoragePath(
        category,
        documentReference.id,
        file.name
      );


    const sourceType =
      cleanString(
        form.get(
          "sourceType"
        )
      )
      ||
      "INTERNAL";


    const externalStatus =
      EXTERNAL_SOURCE_TYPES.includes(
        sourceType
      )
        ? nullableString(
            form.get(
              "externalStatus"
            )
          )
        : null;


    const controlStatus =
      reviewRequired
        ? "UNDER_REVIEW"
        : "CURRENT";


    const reviewStatus =
      reviewRequired
        ? "PENDING"
        : "NOT_REQUIRED";


    if (
      button
    ) {

      button.textContent =
        "Uploading...";

    }


    showProgress(
      "add"
    );


    const batch =
      writeBatch(
        db
      );


    batch.set(
      documentReference,
      {

        organisationId:
          currentProject.organisationId,

        projectId:
          currentProjectId,


        scopeId:
          nullableString(
            form.get(
              "scopeId"
            )
          ),


        phaseId:
          nullableString(
            form.get(
              "phaseId"
            )
          ),


        requirementId,

        documentFamilyId,

        category,

        documentType,

        title,

        reference,

        revision,


        revisionNote:
          null,


        documentDate:
          nullableString(
            form.get(
              "documentDate"
            )
          ),


        ownerUid:
          currentUid(),

        ownerName,


        sourceType,

        externalStatus,


        reviewRequired,

        reviewRoleCode,

        reviewDueDate,

        reviewStatus,


        reviewComments:
          null,

        reviewedByUid:
          null,

        reviewedByName:
          null,

        reviewedAt:
          null,


        controlStatus,

        status:
          "PENDING_UPLOAD",


        sourceRecordType:
          "PROJECT_DOCUMENT",

        sourceRecordId:
          currentProjectId,


        storagePath,

        fileName:
          file.name,

        mimeType:
          file.type,

        fileSize:
          file.size,


        uploadedByUid:
          currentUid(),

        uploadedByName:
          currentUserName(),

        uploadedAt:
          serverTimestamp(),


        supersedesDocumentId:
          null,

        supersededByDocumentId:
          null,


        isCurrent:
          reviewRequired
            ? false
            : true,


        uploadStatus:
          "PENDING",


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


    createDocumentActivity(
      batch,
      {

        type:
          reviewRequired
            ? "DOCUMENT_SUBMITTED_FOR_REVIEW"
            : "DOCUMENT_CREATED",

        documentId:
          documentReference.id,

        documentFamilyId,

        requirementId,

        revision,

        reviewRoleCode,

        summary:
          `${reference} · ${title} · Rev ${revision}`

      }
    );


    await batch.commit();


    await uploadDocumentFile(
      file,
      category,
      documentReference.id,
      storagePath,
      (percentage) => {

        updateProgress(
          "add",
          percentage
        );

      }
    );


    const completionBatch =
      writeBatch(
        db
      );


    completionBatch.update(
      documentReference,
      {

        status:
          reviewRequired
            ? "UNDER_REVIEW"
            : "CURRENT",

        uploadStatus:
          "COMPLETE",

        updatedByUid:
          currentUid(),

        updatedAt:
          serverTimestamp()

      }
    );


    if (
      requirementId
    ) {

      completionBatch.update(
        doc(
          db,
          "documentRequirements",
          requirementId
        ),
        {

          documentFamilyId,

          updatedByUid:
            currentUid(),

          updatedAt:
            serverTimestamp()

        }
      );

    }


    await completionBatch.commit();


    closeAddDocumentModal();


    await loadDocumentRequirements();

    await loadDocuments();


  } catch (error) {

    console.error(
      "NORMEX controlled document creation failed:",
      error
    );


    showMessage(
      "addDocumentError",
      "The controlled document could not be created. Check Firestore permissions and try again."
    );


  } finally {

    if (
      button
    ) {

      button.disabled =
        false;

      button.textContent =
        "Add Document";

    }

  }

}


/* =========================================================
   OPEN NEW REVISION
========================================================= */

function openNewRevisionSection() {

  if (
    !selectedFamily ||
    !canManageFamily(
      selectedFamily
    )
  ) {

    return;

  }


  resetNewRevisionForm();


  setInput(
    "newRevisionNumber",
    suggestNextRevision(
      selectedFamily.latest?.revision ||
      ""
    )
  );


  renderReviewRoleOptions(
    "newRevisionReviewRole"
  );


  setInput(
    "newRevisionReviewRole",
    selectedFamily.pendingReview
      ?.reviewRoleCode ||
    selectedFamily.latest
      ?.reviewRoleCode ||
    ""
  );


  const reviewRequired =
    selectedFamily.latest
      ?.reviewRequired !==
        false;


  setInput(
    "newRevisionReviewRequired",
    reviewRequired
      ? "YES"
      : "NO"
  );


  setInput(
    "newRevisionReviewDueDate",
    ""
  );


  updateReviewRequirementFields(
    "revision"
  );


  const section =
    getElement(
      "newRevisionSection"
    );


  if (
    section
  ) {

    section.hidden =
      false;

  }

}


/* =========================================================
   CLOSE NEW REVISION
========================================================= */

function closeNewRevisionSection() {

  const section =
    getElement(
      "newRevisionSection"
    );


  if (
    section
  ) {

    section.hidden =
      true;

  }


  resetNewRevisionForm();

}


/* =========================================================
   NEW REVISION FILE
========================================================= */

function handleNewRevisionFileSelection() {

  const file =
    getElement(
      "newRevisionFile"
    )?.files?.[0];


  updateFileDisplay(
    file,
    "newRevisionFileTitle",
    "newRevisionFileMeta",
    "Select new revision"
  );

}


/* =========================================================
   UPLOAD NEW REVISION
========================================================= */

async function uploadNewRevision(
  event
) {

  event.preventDefault();


  if (
    !selectedFamily ||
    !canManageFamily(
      selectedFamily
    )
  ) {

    return;

  }


  hideMessage(
    "newRevisionError"
  );


  const form =
    new FormData(
      event.currentTarget
    );


  const revision =
    cleanString(
      form.get(
        "revision"
      )
    );


  const revisionNote =
    cleanString(
      form.get(
        "revisionNote"
      )
    );


  const reviewRequired =
    form.get(
      "reviewRequired"
    ) ===
      "YES";


  const reviewRoleCode =
    reviewRequired
      ? cleanString(
          form.get(
            "reviewRoleCode"
          )
        )
      : null;


  const reviewDueDate =
    reviewRequired
      ? nullableString(
          form.get(
            "reviewDueDate"
          )
        )
      : null;


  const file =
    getElement(
      "newRevisionFile"
    )?.files?.[0];


  const fileError =
    validateFile(
      file
    );


  if (
    fileError
  ) {

    showMessage(
      "newRevisionError",
      fileError
    );

    return;

  }


  if (
    !revision ||
    !revisionNote
  ) {

    showMessage(
      "newRevisionError",
      "New revision and What Changed are required."
    );

    return;

  }


  if (
    selectedFamily.revisions.some(
      (item) =>
        cleanString(
          item.revision
        ).toLowerCase() ===
          revision.toLowerCase()
    )
  ) {

    showMessage(
      "newRevisionError",
      "That revision already exists for this document."
    );

    return;

  }


  if (
    reviewRequired &&
    !reviewRoleCode
  ) {

    showMessage(
      "newRevisionError",
      "Select the role responsible for reviewing this revision."
    );

    return;

  }


  const basis =
    selectedFamily.current ||
    selectedFamily.latest;


  if (
    !basis
  ) {

    return;

  }


  const documentReference =
    doc(
      collection(
        db,
        "documents"
      )
    );


  const storagePath =
    buildStoragePath(
      basis.category,
      documentReference.id,
      file.name
    );


  const button =
    getElement(
      "saveNewRevision"
    );


  if (
    button
  ) {

    button.disabled =
      true;

    button.textContent =
      "Uploading...";

  }


  showProgress(
    "revision"
  );


  try {

    const batch =
      writeBatch(
        db
      );


    batch.set(
      documentReference,
      {

        organisationId:
          currentProject.organisationId,

        projectId:
          currentProjectId,


        scopeId:
          basis.scopeId ||
          null,


        phaseId:
          basis.phaseId ||
          null,


        requirementId:
          basis.requirementId ||
          selectedFamily.requirementId ||
          null,


        documentFamilyId:
          selectedFamily.id,


        category:
          basis.category,


        documentType:
          basis.documentType,


        title:
          basis.title,


        reference:
          basis.reference,


        revision,

        revisionNote,


        documentDate:
          nullableString(
            form.get(
              "documentDate"
            )
          ),


        ownerUid:
          basis.ownerUid ||
          currentUid(),

        ownerName:
          basis.ownerName ||
          currentUserName(),


        sourceType:
          basis.sourceType ||
          "INTERNAL",


        externalStatus:
          basis.externalStatus ||
          null,


        reviewRequired,

        reviewRoleCode,

        reviewDueDate,


        reviewStatus:
          reviewRequired
            ? "PENDING"
            : "NOT_REQUIRED",


        reviewComments:
          null,

        reviewedByUid:
          null,

        reviewedByName:
          null,

        reviewedAt:
          null,


        controlStatus:
          reviewRequired
            ? "UNDER_REVIEW"
            : "CURRENT",


        status:
          "PENDING_UPLOAD",


        sourceRecordType:
          basis.sourceRecordType ||
          "PROJECT_DOCUMENT",


        sourceRecordId:
          basis.sourceRecordId ||
          currentProjectId,


        storagePath,


        fileName:
          file.name,


        mimeType:
          file.type,


        fileSize:
          file.size,


        uploadedByUid:
          currentUid(),

        uploadedByName:
          currentUserName(),

        uploadedAt:
          serverTimestamp(),


        supersedesDocumentId:
          selectedFamily.current?.id ||
          basis.id,


        supersededByDocumentId:
          null,


        isCurrent:
          reviewRequired
            ? false
            : true,


        uploadStatus:
          "PENDING",


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


    /*
     * If no review is required, this revision becomes
     * current immediately and the old current revision
     * is superseded immediately.
     */

    if (
      !reviewRequired &&
      selectedFamily.current
    ) {

      batch.update(
        doc(
          db,
          "documents",
          selectedFamily.current.id
        ),
        {

          isCurrent:
            false,

          status:
            "SUPERSEDED",

          supersededByDocumentId:
            documentReference.id,

          updatedByUid:
            currentUid(),

          updatedAt:
            serverTimestamp()

        }
      );

    }


    createDocumentActivity(
      batch,
      {

        type:
          reviewRequired
            ? "DOCUMENT_REVISION_SUBMITTED"
            : "DOCUMENT_REVISION_CREATED",

        documentId:
          documentReference.id,

        documentFamilyId:
          selectedFamily.id,

        revision,

        reviewRoleCode,

        summary:
          `${
            basis.reference ||
            basis.title
          } · Rev ${revision}`

      }
    );


    await batch.commit();


    await uploadDocumentFile(
      file,
      basis.category,
      documentReference.id,
      storagePath,
      (percentage) => {

        updateProgress(
          "revision",
          percentage
        );

      }
    );


    const completionBatch =
      writeBatch(
        db
      );


    completionBatch.update(
      documentReference,
      {

        status:
          reviewRequired
            ? "UNDER_REVIEW"
            : "CURRENT",

        uploadStatus:
          "COMPLETE",

        updatedByUid:
          currentUid(),

        updatedAt:
          serverTimestamp()

      }
    );


    await completionBatch.commit();


    const familyId =
      selectedFamily.id;


    closeNewRevisionSection();


    await loadDocuments();


    selectedFamily =
      documentFamilies.find(
        (family) =>
          family.id ===
            familyId
      )
      ||
      null;


    selectedReviewRevision =
      selectedFamily?.pendingReview ||
      selectedFamily?.latestProblem ||
      selectedFamily?.latest ||
      null;


    if (
      selectedFamily
    ) {

      renderDocumentWorkspace();

    }


  } catch (error) {

    console.error(
      "NORMEX document revision upload failed:",
      error
    );


    showMessage(
      "newRevisionError",
      "The new revision could not be uploaded."
    );


  } finally {

    if (
      button
    ) {

      button.disabled =
        false;

      button.textContent =
        "Upload Revision";

    }

  }

}


/* =========================================================
   OPEN REQUIREMENT MODAL
========================================================= */

function openRequirementModal() {

  resetRequirementForm();


  renderRequirementCategoryOptions();

  updateRequirementDocumentTypes();


  renderReviewRoleOptions(
    "requirementReviewRole"
  );


  renderScopeOptions(
    "requirementScope"
  );


  renderPhaseOptions(
    "requirementPhase"
  );


  updateRequirementGateFields();


  const modal =
    getElement(
      "requirementModal"
    );


  if (
    modal
  ) {

    modal.hidden =
      false;

  }


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE REQUIREMENT MODAL
========================================================= */

function closeRequirementModal() {

  const modal =
    getElement(
      "requirementModal"
    );


  if (
    modal
  ) {

    modal.hidden =
      true;

  }


  document.body.style.overflow =
    "";


  resetRequirementForm();

}


/* =========================================================
   REQUIREMENT CATEGORY OPTIONS
========================================================= */

function renderRequirementCategoryOptions() {

  const select =
    getElement(
      "requirementCategory"
    );


  if (
    !select
  ) {

    return;

  }


  const categories = [

    [
      "PROJECT",
      "Project Information"
    ],

    [
      "SCOPE",
      "Scope"
    ],

    [
      "TECHNICAL",
      "Technical & Design"
    ],

    [
      "ASSURANCE",
      "Assurance"
    ],

    [
      "DRAWING",
      "Drawings"
    ],

    [
      "PROGRAMME",
      "Programme"
    ],

    [
      "GENERAL",
      "General"
    ]

  ];


  select.innerHTML =
    categories
      .map(
        (
          [
            value,
            label
          ]
        ) => `

          <option value="${value}">
            ${escapeHtml(
              label
            )}
          </option>

        `
      )
      .join("");

}


/* =========================================================
   REQUIREMENT DOCUMENT TYPES
========================================================= */

function updateRequirementDocumentTypes() {

  const category =
    getElement(
      "requirementCategory"
    )?.value ||
    "PROJECT";


  const select =
    getElement(
      "requirementDocumentType"
    );


  if (
    !select
  ) {

    return;

  }


  const types =
    DOCUMENT_TYPES[
      category
    ] ||
    [
      [
        "OTHER",
        "Other"
      ]
    ];


  select.innerHTML =
    types
      .map(
        (
          [
            value,
            label
          ]
        ) => `

          <option value="${value}">
            ${escapeHtml(
              label
            )}
          </option>

        `
      )
      .join("");

}


/* =========================================================
   REQUIREMENT GATE FIELDS
========================================================= */

function updateRequirementGateFields() {

  const gateType =
    getElement(
      "requirementGateType"
    )?.value ||
    "PROJECT_START";


  const phaseField =
    getElement(
      "requirementPhaseField"
    );


  if (
    phaseField
  ) {

    phaseField.hidden =
      ![
        "PHASE_START",
        "PHASE_COMPLETE"
      ].includes(
        gateType
      );

  }

}


/* =========================================================
   CREATE DOCUMENT REQUIREMENT
========================================================= */

async function createDocumentRequirement(
  event
) {

  event.preventDefault();


  hideMessage(
    "requirementError"
  );


  if (
    !canManageProjectDocuments &&
    !canManageAssuranceDocuments
  ) {

    showMessage(
      "requirementError",
      "You do not have permission to manage document requirements."
    );

    return;

  }


  const form =
    new FormData(
      event.currentTarget
    );


  const category =
    cleanString(
      form.get(
        "category"
      )
    );


  const documentType =
    cleanString(
      form.get(
        "documentType"
      )
    );


  const title =
    cleanString(
      form.get(
        "title"
      )
    );


  const criticality =
    cleanString(
      form.get(
        "criticality"
      )
    );


  const requirementState =
    cleanString(
      form.get(
        "requirementState"
      )
    );


  const gateType =
    cleanString(
      form.get(
        "gateType"
      )
    )
    ||
    "NONE";


  const phaseId =
    [
      "PHASE_START",
      "PHASE_COMPLETE"
    ].includes(
      gateType
    )
      ? nullableString(
          form.get(
            "phaseId"
          )
        )
      : null;


  if (
    !category ||
    !documentType ||
    !title ||
    !criticality ||
    !requirementState
  ) {

    showMessage(
      "requirementError",
      "Category, document type, title, criticality and requirement state are required."
    );

    return;

  }


  if (
    [
      "PHASE_START",
      "PHASE_COMPLETE"
    ].includes(
      gateType
    ) &&
    !phaseId
  ) {

    showMessage(
      "requirementError",
      "Select the phase controlled by this requirement."
    );

    return;

  }


  const requirementReference =
    doc(
      collection(
        db,
        "documentRequirements"
      )
    );


  const button =
    getElement(
      "saveRequirement"
    );


  if (
    button
  ) {

    button.disabled =
      true;

    button.textContent =
      "Saving...";

  }


  try {

    const batch =
      writeBatch(
        db
      );


    batch.set(
      requirementReference,
      {

        organisationId:
          currentProject.organisationId,

        projectId:
          currentProjectId,


        scopeId:
          nullableString(
            form.get(
              "scopeId"
            )
          ),


        phaseId,


        category,

        documentType,

        title,

        criticality,


        blocksProgress:
          form.get(
            "blocksProgress"
          ) ===
            "YES",


        requirementState,

        gateType,


        reviewRoleCode:
          nullableString(
            form.get(
              "reviewRoleCode"
            )
          ),


        documentFamilyId:
          null,


        notes:
          nullableString(
            form.get(
              "notes"
            )
          ),


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


    createDocumentActivity(
      batch,
      {

        type:
          "DOCUMENT_REQUIREMENT_CREATED",

        requirementId:
          requirementReference.id,

        summary:
          title

      }
    );


    await batch.commit();


    closeRequirementModal();


    await loadDocumentRequirements();


    deriveRequirementStatuses();

    renderEverything();


  } catch (error) {

    console.error(
      "NORMEX document requirement creation failed:",
      error
    );


    showMessage(
      "requirementError",
      "The document requirement could not be created."
    );


  } finally {

    if (
      button
    ) {

      button.disabled =
        false;

      button.textContent =
        "Add Requirement";

    }

  }

}


/* =========================================================
   REQUIREMENT OPTIONS
========================================================= */

function renderRequirementOptions() {

  const select =
    getElement(
      "addDocumentRequirement"
    );


  if (
    !select
  ) {

    return;

  }


  const openRequirements =
    documentRequirements.filter(
      (requirement) =>
        requirement.requirementState !==
          "NOT_REQUIRED"
    );


  select.innerHTML = `

    <option value="">
      No Linked Requirement
    </option>

    ${openRequirements
      .map(
        (requirement) => `

          <option
            value="${escapeHtml(
              requirement.id
            )}"
          >

            ${escapeHtml(
              requirement.title
            )}

            ·

            ${escapeHtml(
              getRequirementContextLabel(
                requirement
              )
            )}

          </option>

        `
      )
      .join("")}

  `;

}


/* =========================================================
   SCOPE OPTIONS
========================================================= */

function renderScopeOptions(
  selectId
) {

  const select =
    getElement(
      selectId
    );


  if (
    !select
  ) {

    return;

  }


  const scopes =
    Array
      .from(
        scopeMap.values()
      )
      .sort(
        (a, b) =>

          String(
            a.scopeCode ||
            ""
          ).localeCompare(
            String(
              b.scopeCode ||
              ""
            ),
            undefined,
            {
              numeric: true
            }
          )
      );


  select.innerHTML = `

    <option value="">
      Project Level
    </option>

    ${scopes
      .map(
        (scope) => `

          <option
            value="${escapeHtml(
              scope.id
            )}"
          >

            ${escapeHtml(
              `${scope.scopeCode} · ${scope.name}`
            )}

          </option>

        `
      )
      .join("")}

  `;

}


/* =========================================================
   PHASE OPTIONS
========================================================= */

function renderPhaseOptions(
  selectId
) {

  const select =
    getElement(
      selectId
    );


  if (
    !select
  ) {

    return;

  }


  select.innerHTML = `

    <option value="">
      Project Level
    </option>

    ${projectPhases
      .map(
        (phase) => `

          <option
            value="${escapeHtml(
              phase.id
            )}"
          >

            ${escapeHtml(
              phase.name ||
              phase.id
            )}

          </option>

        `
      )
      .join("")}

  `;

}


/* =========================================================
   OPEN PHYSICAL DOCUMENT
========================================================= */

async function openPhysicalDocument(
  documentId
) {

  const item =
    allDocuments.find(
      (documentRecord) =>
        documentRecord.id ===
          documentId
    );


  if (
    !item?.storagePath
  ) {

    return;

  }


  try {

    const url =
      await getDownloadURL(
        ref(
          storage,
          item.storagePath
        )
      );


    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );


  } catch (error) {

    console.error(
      "NORMEX document open failed:",
      error
    );


    window.alert(
      "The document could not be opened."
    );

  }

}


/* =========================================================
   UPLOAD FILE
========================================================= */

function uploadDocumentFile(
  file,
  category,
  documentId,
  storagePath,
  progressCallback
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const task =
        uploadBytesResumable(
          ref(
            storage,
            storagePath
          ),
          file,
          {

            contentType:
              file.type,


            customMetadata: {

              organisationId:
                currentProject.organisationId,

              projectId:
                currentProjectId,

              documentId,

              category:
                category.toLowerCase(),

              uploadedByUid:
                currentUid()

            }

          }
        );


      task.on(
        "state_changed",

        (snapshot) => {

          const percentage =
            snapshot.totalBytes
              ? Math.round(
                  (
                    snapshot.bytesTransferred /
                    snapshot.totalBytes
                  ) * 100
                )
              : 0;


          progressCallback(
            percentage
          );

        },

        reject,

        resolve
      );

    }
  );

}


/* =========================================================
   STORAGE PATH
========================================================= */

function buildStoragePath(
  category,
  documentId,
  fileName
) {

  return [

    "organisations",

    currentProject.organisationId,

    "projects",

    currentProjectId,

    "documents",

    category.toLowerCase(),

    documentId,

    sanitiseFileName(
      fileName
    )

  ].join(
    "/"
  );

}


/* =========================================================
   DOCUMENT ACTIVITY
========================================================= */

function createDocumentActivity(
  batch,
  data
) {

  const activityReference =
    doc(
      collection(
        db,
        "projects",
        currentProjectId,
        "activity"
      )
    );


  batch.set(
    activityReference,
    {

      organisationId:
        currentProject.organisationId,

      projectId:
        currentProjectId,

      sourceRecordType:
        "DOCUMENT",

      createdByUid:
        currentUid(),

      createdByName:
        currentUserName(),

      createdAt:
        serverTimestamp(),

      ...data

    }
  );

}


/* =========================================================
   RECENT ACTIVITY
========================================================= */

function renderRecentActivity() {

  const root =
    getElement(
      "documentsRecentActivity"
    );


  if (
    !root
  ) {

    return;

  }


  const recent =
    allDocuments
      .slice()
      .sort(
        (a, b) =>

          timestampToMilliseconds(
            b.updatedAt ||
            b.uploadedAt
          )
          -
          timestampToMilliseconds(
            a.updatedAt ||
            a.uploadedAt
          )
      )
      .slice(
        0,
        4
      );


  if (
    !recent.length
  ) {

    root.innerHTML = `

      <div class="documents-empty documents-empty--compact">
        No recent document activity
      </div>

    `;

    return;

  }


  root.innerHTML =
    recent
      .map(
        (item) => `

          <article class="documents-activity-row">

            <span>

              ${escapeHtml(
                formatFirestoreDate(
                  item.updatedAt ||
                  item.uploadedAt
                )
              )}

            </span>


            <div>

              <strong>

                ${escapeHtml(
                  item.reference ||
                  item.title ||
                  "Document"
                )}

                · Rev

                ${escapeHtml(
                  item.revision ||
                  "—"
                )}

              </strong>

              <span>

                ${escapeHtml(
                  formatRevisionState(
                    item
                  )
                )}

              </span>

            </div>


            <span>

              ${escapeHtml(
                item.reviewedByName ||
                item.uploadedByName ||
                "NORMEX User"
              )}

            </span>

          </article>

        `
      )
      .join("");

}


/* =========================================================
   FILE VALIDATION
========================================================= */

function validateFile(
  file
) {

  if (
    !file
  ) {

    return "Select a document to upload.";

  }


  if (
    !ALLOWED_FILE_TYPES.includes(
      file.type
    )
  ) {

    return "Only PDF, JPG and PNG files can be uploaded.";

  }


  if (
    file.size >
      MAX_FILE_SIZE
  ) {

    return "The selected file is larger than the 100 MB limit.";

  }


  return null;

}


/* =========================================================
   FILE DISPLAY
========================================================= */

function updateFileDisplay(
  file,
  titleId,
  metaId,
  emptyTitle
) {

  if (
    !file
  ) {

    setText(
      titleId,
      emptyTitle
    );


    setText(
      metaId,
      "PDF, JPG or PNG · Maximum 100 MB"
    );


    return;

  }


  setText(
    titleId,
    file.name
  );


  setText(
    metaId,
    `${formatFileSize(
      file.size
    )} · ${formatMimeType(
      file.type
    )}`
  );

}


/* =========================================================
   UPLOAD PROGRESS
========================================================= */

function showProgress(
  mode
) {

  const prefix =
    mode ===
      "revision"
      ? "newRevision"
      : "addDocument";


  const progress =
    getElement(
      `${prefix}UploadProgress`
    );


  if (
    progress
  ) {

    progress.hidden =
      false;

  }


  updateProgress(
    mode,
    0
  );

}


function updateProgress(
  mode,
  percentage
) {

  const prefix =
    mode ===
      "revision"
      ? "newRevision"
      : "addDocument";


  const bar =
    getElement(
      `${prefix}UploadProgressBar`
    );


  if (
    bar
  ) {

    bar.style.width =
      `${percentage}%`;

  }


  setText(
    `${prefix}UploadProgressText`,
    percentage >=
      100
      ? "Upload complete"
      : `Uploading ${percentage}%`
  );

}


/* =========================================================
   RESET ADD DOCUMENT FORM
========================================================= */

function resetAddDocumentForm() {

  getElement(
    "addDocumentForm"
  )?.reset();


  setText(
    "addDocumentFileTitle",
    "Select PDF or image"
  );


  setText(
    "addDocumentFileMeta",
    "PDF, JPG or PNG · Maximum 100 MB"
  );


  const progress =
    getElement(
      "addDocumentUploadProgress"
    );


  if (
    progress
  ) {

    progress.hidden =
      true;

  }


  hideMessage(
    "addDocumentError"
  );

}


/* =========================================================
   RESET NEW REVISION
========================================================= */

function resetNewRevisionForm() {

  getElement(
    "newRevisionForm"
  )?.reset();


  setText(
    "newRevisionFileTitle",
    "Select new revision"
  );


  setText(
    "newRevisionFileMeta",
    "PDF, JPG or PNG · Maximum 100 MB"
  );


  const progress =
    getElement(
      "newRevisionUploadProgress"
    );


  if (
    progress
  ) {

    progress.hidden =
      true;

  }


  hideMessage(
    "newRevisionError"
  );

}


/* =========================================================
   RESET REQUIREMENT FORM
========================================================= */

function resetRequirementForm() {

  getElement(
    "requirementForm"
  )?.reset();


  hideMessage(
    "requirementError"
  );

}


/* =========================================================
   MESSAGES
========================================================= */

function hideMessage(
  id
) {

  const element =
    getElement(
      id
    );


  if (
    element
  ) {

    element.hidden =
      true;

  }

}


function showMessage(
  id,
  message
) {

  const element =
    getElement(
      id
    );


  if (
    !element
  ) {

    return;

  }


  element.textContent =
    message;


  element.hidden =
    false;

}


/* =========================================================
   FAMILY STATE FORMAT
========================================================= */

function formatFamilyState(
  state
) {

  const labels = {

    CURRENT:
      "Current Controlled",

    UNDER_REVIEW:
      "Under Review",

    REVISE_AND_RESUBMIT:
      "Revise & Resubmit",

    REJECTED:
      "Rejected",

    REFERENCE:
      "Reference",

    NO_CURRENT:
      "No Current Revision"

  };


  return (
    labels[
      state
    ] ||
    formatStatus(
      state
    )
  );

}


/* =========================================================
   REVIEW STATUS FORMAT
========================================================= */

function formatReviewStatus(
  status
) {

  const labels = {

    PENDING:
      "Awaiting Review",

    UNDER_REVIEW:
      "Under Review",

    ACCEPTED:
      "Accepted",

    ACCEPTED_WITH_COMMENTS:
      "Accepted with Comments",

    REVISE_AND_RESUBMIT:
      "Revise & Resubmit",

    REJECTED:
      "Rejected",

    NOT_REQUIRED:
      "Review Not Required"

  };


  return (
    labels[
      status
    ] ||
    formatStatus(
      status
    )
  );

}


/* =========================================================
   REQUIREMENT STATE FORMAT
========================================================= */

function formatRequirementState(
  state
) {

  const labels = {

    REQUIRED:
      "Required",

    CONDITIONAL:
      "Conditional",

    NOT_REQUIRED:
      "Not Required"

  };


  return (
    labels[
      state
    ] ||
    formatStatus(
      state
    )
  );

}


/* =========================================================
   REQUIREMENT STATUS FORMAT
========================================================= */

function formatRequirementStatus(
  status
) {

  const labels = {

    MISSING:
      "Missing",

    UNDER_REVIEW:
      "Under Review",

    SATISFIED:
      "Satisfied",

    ACTION_REQUIRED:
      "Action Required",

    NO_CURRENT_REVISION:
      "No Current Revision",

    CONDITIONAL:
      "Conditional",

    NOT_REQUIRED:
      "Not Required"

  };


  return (
    labels[
      status
    ] ||
    formatStatus(
      status
    )
  );

}


/* =========================================================
   GATE TYPE FORMAT
========================================================= */

function formatGateType(
  value
) {

  const labels = {

    PROJECT_START:
      "Project Start",

    PHASE_START:
      "Phase Start",

    PHASE_COMPLETE:
      "Phase Complete",

    PROJECT_HANDOVER:
      "Project Handover",

    NONE:
      "No Gate"

  };


  return (
    labels[
      value
    ] ||
    formatStatus(
      value
    )
  );

}


/* =========================================================
   REVISION STATE FORMAT
========================================================= */

function formatRevisionState(
  item
) {

  if (
    item.isCurrent ===
      true &&
    item.status ===
      "CURRENT"
  ) {

    return "Current Controlled";

  }


  if (
    isReviewPending(
      item
    )
  ) {

    return `Under Review${
      item.reviewRoleCode
        ? ` · ${getRoleLabel(
            item.reviewRoleCode
          )}`
        : ""
    }`;

  }


  if (
    item.reviewStatus &&
    item.reviewStatus !==
      "NOT_REQUIRED"
  ) {

    return formatReviewStatus(
      item.reviewStatus
    );

  }


  if (
    item.status ===
      "SUPERSEDED"
  ) {

    return "Superseded";

  }


  if (
    item.controlStatus ===
      "REFERENCE"
  ) {

    return "Reference";

  }


  return formatStatus(
    item.status ||
    item.controlStatus ||
    "Document"
  );

}


/* =========================================================
   DOCUMENT TYPE FORMAT
========================================================= */

function formatDocumentType(
  value
) {

  return formatStatus(
    value
  );

}


/* =========================================================
   SOURCE TYPE FORMAT
========================================================= */

function formatSourceType(
  value
) {

  const labels = {

    INTERNAL:
      "Internal",

    CLIENT:
      "Client",

    DESIGNER:
      "Designer",

    CONTRACTOR:
      "Contractor",

    CONSULTANT:
      "Consultant",

    OTHER_EXTERNAL:
      "Other External"

  };


  return (
    labels[
      value
    ] ||
    formatStatus(
      value
    )
  );

}


/* =========================================================
   EXTERNAL STATUS FORMAT
========================================================= */

function formatExternalStatus(
  value
) {

  if (
    !value
  ) {

    return "Not stated";

  }


  return formatStatus(
    value
  );

}


/* =========================================================
   GENERIC STATUS FORMAT
========================================================= */

function formatStatus(
  value
) {

  return String(
    value ||
    ""
  )
    .toLowerCase()
    .split(
      "_"
    )
    .map(
      (part) =>
        part.charAt(
          0
        ).toUpperCase()
        +
        part.slice(
          1
        )
    )
    .join(
      " "
    );

}


/* =========================================================
   SCOPE LABEL
========================================================= */

function getScopeLabel(
  scopeId
) {

  if (
    !scopeId
  ) {

    return "";

  }


  const scope =
    scopeMap.get(
      scopeId
    );


  if (
    !scope
  ) {

    return "Project Scope";

  }


  return `${scope.scopeCode} · ${scope.name}`;

}


/* =========================================================
   PHASE LABEL
========================================================= */

function getPhaseLabel(
  phaseId
) {

  if (
    !phaseId
  ) {

    return "";

  }


  const phase =
    projectPhases.find(
      (item) =>
        item.id ===
          phaseId
    );


  return (
    phase?.name ||
    "Project Phase"
  );

}


/* =========================================================
   TIMESTAMP → MILLISECONDS
========================================================= */

function timestampToMilliseconds(
  value
) {

  if (
    !value
  ) {

    return 0;

  }


  if (
    typeof value.toMillis ===
      "function"
  ) {

    return value.toMillis();

  }


  if (
    typeof value.toDate ===
      "function"
  ) {

    return value
      .toDate()
      .getTime();

  }


  const date =
    new Date(
      value
    );


  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();

}


/* =========================================================
   FIRESTORE DATE
========================================================= */

function formatFirestoreDate(
  value
) {

  const milliseconds =
    timestampToMilliseconds(
      value
    );


  if (
    !milliseconds
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
    new Date(
      milliseconds
    )
  );

}


/* =========================================================
   DATE ONLY PARSER
========================================================= */

function parseDateOnly(
  value
) {

  if (
    !value
  ) {

    return null;

  }


  const date =
    new Date(
      `${value}T00:00:00`
    );


  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;

}


/* =========================================================
   REVIEW DUE FORMAT
========================================================= */

function formatReviewDueDate(
  value
) {

  const date =
    parseDateOnly(
      value
    );


  if (
    !date
  ) {

    return "No due date";

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


/* =========================================================
   REVIEW DUE CLASS
========================================================= */

function reviewDueClass(
  value
) {

  const date =
    parseDateOnly(
      value
    );


  if (
    !date
  ) {

    return "documents-review-due";

  }


  const today =
    new Date();


  today.setHours(
    0,
    0,
    0,
    0
  );


  const differenceDays =
    Math.round(
      (
        date.getTime()
        -
        today.getTime()
      )
      /
      86400000
    );


  if (
    differenceDays <
      0
  ) {

    return "documents-review-due is-overdue";

  }


  if (
    differenceDays <=
      2
  ) {

    return "documents-review-due is-due-soon";

  }


  return "documents-review-due";

}


/* =========================================================
   FILE SIZE
========================================================= */

function formatFileSize(
  bytes
) {

  if (
    bytes <
      1024 * 1024
  ) {

    return `${Math.round(
      bytes /
      1024
    )} KB`;

  }


  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(
    1
  )} MB`;

}


/* =========================================================
   MIME TYPE
========================================================= */

function formatMimeType(
  type
) {

  const labels = {

    "application/pdf":
      "PDF",

    "image/jpeg":
      "JPG",

    "image/png":
      "PNG"

  };


  return (
    labels[
      type
    ] ||
    "File"
  );

}


/* =========================================================
   REMOVE FILE EXTENSION
========================================================= */

function removeFileExtension(
  fileName
) {

  return String(
    fileName ||
    ""
  ).replace(
    /\.[^/.]+$/,
    ""
  );

}


/* =========================================================
   SUGGEST NEXT REVISION
========================================================= */

function suggestNextRevision(
  value
) {

  const cleaned =
    cleanString(
      value
    );


  if (
    !cleaned
  ) {

    return "1";

  }


  if (
    /^\d+$/.test(
      cleaned
    )
  ) {

    return String(
      Number(
        cleaned
      ) +
      1
    );

  }


  if (
    /^[A-Za-z]$/.test(
      cleaned
    )
  ) {

    return String.fromCharCode(
      cleaned
        .toUpperCase()
        .charCodeAt(
          0
        )
      +
      1
    );

  }


  return "";

}


/* =========================================================
   SAFE FILE NAME
========================================================= */

function sanitiseFileName(
  fileName
) {

  return String(
    fileName ||
    "document"
  )
    .trim()
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    );

}


/* =========================================================
   HTML ESCAPE
========================================================= */

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


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  getElement(
    "addProjectDocumentButton"
  )?.addEventListener(
    "click",
    () => {

      openAddDocumentModal();

    }
  );


  getElement(
    "closeAddDocumentModal"
  )?.addEventListener(
    "click",
    closeAddDocumentModal
  );


  getElement(
    "cancelAddDocument"
  )?.addEventListener(
    "click",
    closeAddDocumentModal
  );


  getElement(
    "addDocumentBackdrop"
  )?.addEventListener(
    "click",
    closeAddDocumentModal
  );


  getElement(
    "addDocumentCategory"
  )?.addEventListener(
    "change",
    updateDocumentTypeOptions
  );


  getElement(
    "addDocumentType"
  )?.addEventListener(
    "change",
    updateReferencePreview
  );


  getElement(
    "addDocumentSourceType"
  )?.addEventListener(
    "change",
    updateExternalSourceFields
  );


  getElement(
    "addDocumentReviewRequired"
  )?.addEventListener(
    "change",
    () => {

      updateReviewRequirementFields(
        "add"
      );

    }
  );


  getElement(
    "addDocumentFile"
  )?.addEventListener(
    "change",
    handleAddDocumentFileSelection
  );


  getElement(
    "addDocumentForm"
  )?.addEventListener(
    "submit",
    createControlledDocument
  );


  getElement(
    "addRequirementButton"
  )?.addEventListener(
    "click",
    openRequirementModal
  );


  getElement(
    "closeRequirementModal"
  )?.addEventListener(
    "click",
    closeRequirementModal
  );


  getElement(
    "cancelRequirement"
  )?.addEventListener(
    "click",
    closeRequirementModal
  );


  getElement(
    "requirementBackdrop"
  )?.addEventListener(
    "click",
    closeRequirementModal
  );


  getElement(
    "requirementCategory"
  )?.addEventListener(
    "change",
    updateRequirementDocumentTypes
  );


  getElement(
    "requirementGateType"
  )?.addEventListener(
    "change",
    updateRequirementGateFields
  );


  getElement(
    "requirementForm"
  )?.addEventListener(
    "submit",
    createDocumentRequirement
  );


  getElement(
    "requirementGateFilter"
  )?.addEventListener(
    "change",
    renderRequirements
  );


  getElement(
    "requirementCriticalityFilter"
  )?.addEventListener(
    "change",
    renderRequirements
  );


  getElement(
    "requirementStatusFilter"
  )?.addEventListener(
    "change",
    renderRequirements
  );


  getElement(
    "documentSearchInput"
  )?.addEventListener(
    "input",
    applyDocumentFilters
  );


  getElement(
    "documentStateFilter"
  )?.addEventListener(
    "change",
    applyDocumentFilters
  );


  getElement(
    "documentScopeFilter"
  )?.addEventListener(
    "change",
    applyDocumentFilters
  );


  getElement(
    "closeDocumentWorkspace"
  )?.addEventListener(
    "click",
    closeDocumentWorkspace
  );


  getElement(
    "documentWorkspaceBackdrop"
  )?.addEventListener(
    "click",
    closeDocumentWorkspace
  );


  getElement(
    "viewCurrentDocumentButton"
  )?.addEventListener(
    "click",
    () => {

      if (
        selectedFamily?.current
      ) {

        openPhysicalDocument(
          selectedFamily.current.id
        );

      }

    }
  );


  getElement(
    "viewLatestDocumentButton"
  )?.addEventListener(
    "click",
    () => {

      if (
        selectedFamily?.latest
      ) {

        openPhysicalDocument(
          selectedFamily.latest.id
        );

      }

    }
  );


  getElement(
    "showNewRevisionButton"
  )?.addEventListener(
    "click",
    openNewRevisionSection
  );


  getElement(
    "cancelNewRevision"
  )?.addEventListener(
    "click",
    closeNewRevisionSection
  );


  getElement(
    "newRevisionReviewRequired"
  )?.addEventListener(
    "change",
    () => {

      updateReviewRequirementFields(
        "revision"
      );

    }
  );


  getElement(
    "newRevisionFile"
  )?.addEventListener(
    "change",
    handleNewRevisionFileSelection
  );


  getElement(
    "newRevisionForm"
  )?.addEventListener(
    "submit",
    uploadNewRevision
  );


  document
    .querySelectorAll(
      "[data-review-decision]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            makeReviewDecision(
              button.dataset
                .reviewDecision
            );

          }
        );

      }
    );

}


/* =========================================================
   INITIALISE
========================================================= */

async function initialiseDocumentsPage(
  profile
) {

  currentProfile =
    profile;


  currentProjectId =
    getProjectId();


  if (
    !currentProjectId
  ) {

    console.error(
      "NORMEX Documents: no project ID supplied."
    );

    return;

  }


  try {

    currentProject =
      await loadProject();


    if (
      !currentProject
    ) {

      console.error(
        "NORMEX Documents: project not found."
      );

      return;

    }


    if (
      Number(
        currentProfile.accessLevel
      ) <
        99 &&
      currentProject.organisationId !==
        currentProfile.organisationId
    ) {

      console.error(
        "NORMEX Documents: organisation mismatch."
      );

      return;

    }


    renderProjectNav();


    setText(
      "projectSubnavName",
      currentProject.name ||
      "Project"
    );


    await determineAccess();


    await Promise.all(
      [

        loadProjectPhases(),

        loadScopes()

      ]
    );


    await loadDocumentRequirements();


    const addDocumentButton =
      getElement(
        "addProjectDocumentButton"
      );


    if (
      addDocumentButton
    ) {

      addDocumentButton.hidden =
        !(
          canManageProjectDocuments ||
          canManageAssuranceDocuments
        );

    }


    const addRequirementButton =
      getElement(
        "addRequirementButton"
      );


    if (
      addRequirementButton
    ) {

      addRequirementButton.hidden =
        !(
          canManageProjectDocuments ||
          canManageAssuranceDocuments
        );

    }


    renderReviewRoleOptions(
      "addDocumentReviewRole"
    );


    renderReviewRoleOptions(
      "newRevisionReviewRole"
    );


    renderReviewRoleOptions(
      "requirementReviewRole"
    );


    renderScopeOptions(
      "requirementScope"
    );


    renderScopeOptions(
      "addDocumentScope"
    );


    renderPhaseOptions(
      "requirementPhase"
    );


    renderPhaseOptions(
      "addDocumentPhase"
    );


    await loadDocuments();


  } catch (error) {

    console.error(
      "NORMEX Documents initialisation error:",
      error
    );

  }

}


/* =========================================================
   START
========================================================= */

bindEvents();

waitForWorkspace();