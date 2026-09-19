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


/* =========================================================
   NORMEX
   PROJECT INFORMATION POSITION

   PURPOSE
   ---------------------------------------------------------
   Read-only intelligence layer for:

   - Project Start
   - Current Phase
   - Next Phase
   - Project Handover

   This controller DOES NOT write to Firestore.
   It does not own document upload or review workflow.
========================================================= */


/* =========================================================
   STATE
========================================================= */

let currentProfile = null;

let currentProjectId = null;

let currentProject = null;

let projectPhases = [];

let projectScopes = [];

let documents = [];

let documentRequirements = [];

let documentFamilies = [];


/* =========================================================
   CONSTANTS
========================================================= */

const ACTIVE_PHASE_STATUSES = [
  "LIVE",
  "CURRENT",
  "ACTIVE",
  "IN_PROGRESS",
  "STARTED"
];


const COMPLETE_PHASE_STATUSES = [
  "COMPLETE",
  "COMPLETED",
  "CLOSED",
  "ARCHIVED"
];


const COMPLETE_SCOPE_STATUSES = [
  "COMPLETE",
  "COMPLETED",
  "CLOSED",
  "ARCHIVED"
];


/*
 * Core NORMEX project-start knowledge.
 *
 * These are standard information controls that NORMEX
 * understands without a PM manually creating each one.
 */

const PROJECT_START_BASELINE = [

  {
    code: "PCI",

    label:
      "Pre-Construction Information",

    documentTypes: [
      "PRE_CONSTRUCTION_INFORMATION"
    ],

    criticality:
      "CRITICAL",

    blocking:
      true,

    applicability:
      "ALWAYS"
  },


  {
    code: "CPP",

    label:
      "Construction Phase Plan",

    documentTypes: [
      "CONSTRUCTION_PHASE_PLAN"
    ],

    criticality:
      "CRITICAL",

    blocking:
      true,

    applicability:
      "ALWAYS"
  },


  {
    code: "EMERGENCY",

    label:
      "Emergency Arrangements",

    documentTypes: [
      "EMERGENCY_ARRANGEMENTS"
    ],

    titleKeywords: [
      "emergency arrangement",
      "emergency plan",
      "emergency procedure"
    ],

    criticality:
      "CRITICAL",

    blocking:
      true,

    applicability:
      "ALWAYS"
  },


  {
    code: "ORGANISATION",

    label:
      "Project Organisation / Responsibilities",

    documentTypes: [
      "PROJECT_ORGANOGRAM",
      "PROJECT_APPOINTMENT"
    ],

    titleKeywords: [
      "organogram",
      "organisation chart",
      "project team",
      "responsibilities",
      "appointments"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "ALWAYS"
  },


  {
    code: "LOGISTICS",

    label:
      "Logistics / Traffic Management",

    documentTypes: [
      "LOGISTICS_PLAN",
      "TRAFFIC_MANAGEMENT_PLAN"
    ],

    titleKeywords: [
      "logistics",
      "traffic management",
      "traffic plan",
      "vehicle movement",
      "site traffic"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "WHEN_RELEVANT"
  },


  {
    code: "ENVIRONMENT",

    label:
      "Environmental / Waste Arrangements",

    documentTypes: [
      "ENVIRONMENTAL_PLAN",
      "WASTE_MANAGEMENT_PLAN"
    ],

    titleKeywords: [
      "environmental plan",
      "waste management",
      "waste plan"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "WHEN_RELEVANT"
  }

];


/*
 * Typical information controls for an active phase.
 *
 * These become intelligent/conditional rather than
 * automatically blocking every project.
 */

const PHASE_BASELINE = [

  {
    code: "RAMS",

    label:
      "RAMS",

    documentTypes: [
      "RAMS"
    ],

    titleKeywords: [
      "rams",
      "risk assessment",
      "method statement"
    ],

    criticality:
      "CRITICAL",

    blocking:
      true,

    applicability:
      "ACTIVE_WORK"
  },


  {
    code: "CURRENT_DRAWINGS",

    label:
      "Current Drawings / Technical Information",

    documentTypes: [
      "DRAWING",
      "MARKED_UP_DRAWING",
      "DESIGN",
      "TECHNICAL_SUBMISSION",
      "SPECIFICATION"
    ],

    titleKeywords: [
      "drawing",
      "design",
      "technical",
      "specification"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "WHEN_RELEVANT"
  },


  {
    code: "TEMPORARY_WORKS",

    label:
      "Temporary Works Information",

    documentTypes: [
      "TEMPORARY_WORKS_DESIGN",
      "TEMPORARY_WORKS_CHECK"
    ],

    titleKeywords: [
      "temporary works",
      "temporary work",
      "propping",
      "prop design",
      "falsework",
      "support design"
    ],

    triggerKeywords: [
      "temporary works",
      "temporary work",
      "propping",
      "props",
      "temporary support",
      "falsework",
      "support frame"
    ],

    criticality:
      "CRITICAL",

    blocking:
      true,

    applicability:
      "KEYWORD_TRIGGER"
  },


  {
    code: "LIFT_PLAN",

    label:
      "Lift Plan",

    documentTypes: [
      "LIFT_PLAN"
    ],

    titleKeywords: [
      "lift plan",
      "lifting plan",
      "crane lift"
    ],

    triggerKeywords: [
      "crane",
      "lifting",
      "lift ",
      "hiab",
      "hoist",
      "lifting operation"
    ],

    criticality:
      "CRITICAL",

    blocking:
      true,

    applicability:
      "KEYWORD_TRIGGER"
  },


  {
    code: "ISOLATION",

    label:
      "Isolation Information",

    documentTypes: [
      "ISOLATION_CERTIFICATE"
    ],

    titleKeywords: [
      "isolation",
      "isolation certificate",
      "electrical isolation"
    ],

    triggerKeywords: [
      "isolation",
      "disconnect",
      "disconnection",
      "electrical",
      "services isolation"
    ],

    criticality:
      "CRITICAL",

    blocking:
      true,

    applicability:
      "KEYWORD_TRIGGER"
  },


  {
    code: "COSHH",

    label:
      "COSHH Information",

    documentTypes: [
      "COSHH"
    ],

    titleKeywords: [
      "coshh",
      "hazardous substance"
    ],

    triggerKeywords: [
      "chemical",
      "resin",
      "paint",
      "solvent",
      "adhesive",
      "sealant",
      "fuel",
      "coshh"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "KEYWORD_TRIGGER"
  }

];


/*
 * Handover intelligence.
 *
 * Several of these can be satisfied by title keywords
 * until dedicated structured modules are built.
 */

const HANDOVER_BASELINE = [

  {
    code: "AS_BUILT",

    label:
      "As-Built Information",

    documentTypes: [
      "AS_BUILT_DRAWING"
    ],

    titleKeywords: [
      "as built",
      "as-built"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "ALWAYS"
  },


  {
    code: "COMPLETION_PHOTOS",

    label:
      "Completion Photographs",

    documentTypes: [
      "PHOTOGRAPH"
    ],

    titleKeywords: [
      "completion photo",
      "completion photograph",
      "completed works",
      "final photo",
      "handover photo"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "ALWAYS"
  },


  {
    code: "RESIDUAL_RISKS",

    label:
      "Residual Risks",

    titleKeywords: [
      "residual risk",
      "residual risks",
      "remaining risk",
      "remaining risks"
    ],

    criticality:
      "CRITICAL",

    blocking:
      true,

    applicability:
      "ALWAYS"
  },


  {
    code: "WASTE_EVIDENCE",

    label:
      "Waste / Disposal Evidence",

    documentTypes: [
      "WASTE_MANAGEMENT_PLAN"
    ],

    titleKeywords: [
      "waste transfer",
      "waste disposal",
      "disposal certificate",
      "waste evidence",
      "waste record"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "WHEN_RELEVANT"
  },


  {
    code: "CERTIFICATES",

    label:
      "Certificates / Test Records",

    titleKeywords: [
      "certificate",
      "test record",
      "commissioning",
      "inspection certificate"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "WHEN_RELEVANT"
  },


  {
    code: "FINAL_INFORMATION",

    label:
      "Final Project Information",

    titleKeywords: [
      "handover",
      "final information",
      "completion pack",
      "project completion"
    ],

    criticality:
      "REQUIRED",

    blocking:
      false,

    applicability:
      "ALWAYS"
  }

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


  if (
    element
  ) {

    element.textContent =
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

    initialise(
      window.NORMEX_CURRENT_USER
    );

    return;

  }


  window.addEventListener(

    "normex:workspace-ready",

    (event) => {

      initialise(
        event.detail.profile
      );

    },

    {
      once: true
    }

  );

}


/* =========================================================
   INITIALISE
========================================================= */

async function initialise(
  profile
) {

  currentProfile =
    profile;


  currentProjectId =
    getProjectId();


  if (
    !currentProjectId
  ) {

    return;

  }


  try {

    await loadProject();


    if (
      !currentProject
    ) {

      renderUnavailablePosition(
        "Project not found"
      );

      return;

    }


    if (
      Number(
        currentProfile?.accessLevel
      ) < 99 &&
      currentProject.organisationId !==
        currentProfile.organisationId
    ) {

      renderUnavailablePosition(
        "Project access unavailable"
      );

      return;

    }


    await Promise.all(
      [
        loadProjectPhases(),
        loadProjectScopes(),
        loadDocuments(),
        loadDocumentRequirements()
      ]
    );


    buildDocumentFamilies();


    renderProjectInformationPosition();


  } catch (error) {

    console.error(
      "NORMEX project information position failed:",
      error
    );


    renderUnavailablePosition(
      "Information position unavailable"
    );

  }

}


/* =========================================================
   LOAD PROJECT
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


  currentProject =
    snapshot.exists()
      ? {
          id:
            snapshot.id,

          ...snapshot.data()
        }
      : null;

}


/* =========================================================
   LOAD PHASES
========================================================= */

async function loadProjectPhases() {

  projectPhases =
    [];


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
        );


  } catch (error) {

    console.warn(
      "NORMEX information position phases unavailable:",
      error
    );

  }

}


/* =========================================================
   LOAD SCOPES
========================================================= */

async function loadProjectScopes() {

  projectScopes =
    [];


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


    projectScopes =
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
      "NORMEX information position scopes unavailable:",
      error
    );

  }

}


/* =========================================================
   LOAD DOCUMENTS
========================================================= */

async function loadDocuments() {

  documents =
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
              `NORMEX information position could not read ${category}:`,
              error
            );


            return [];

          }

        }
      )
    );


  documents =
    results
      .flat()
      .filter(
        (item) =>
          item.organisationId ===
            currentProject.organisationId
      );

}


/* =========================================================
   LOAD PROJECT-SPECIFIC REQUIREMENTS
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
      "NORMEX project-specific requirements unavailable:",
      error
    );

  }

}


/* =========================================================
   DOCUMENT FAMILIES
========================================================= */

function buildDocumentFamilies() {

  const familyMap =
    new Map();


  documents.forEach(
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
      );

}


/* =========================================================
   ENRICH FAMILY
========================================================= */

function enrichFamily(
  family
) {

  const revisions =
    family.revisions
      .slice()
      .sort(
        compareRevisionNewest
      );


  const latest =
    revisions[0] ||
    null;


  const current =
    revisions.find(
      (item) =>
        item.isCurrent ===
          true &&
        item.uploadStatus ===
          "COMPLETE"
    )
    ||
    null;


  const pending =
    revisions.find(
      (item) =>
        item.reviewRequired ===
          true &&
        [
          "PENDING",
          "UNDER_REVIEW"
        ].includes(
          item.reviewStatus
        ) &&
        item.uploadStatus ===
          "COMPLETE"
    )
    ||
    null;


  return {

    id:
      family.id,

    revisions,

    latest,

    current,

    pending,

    category:
      latest?.category ||
      current?.category ||
      null,

    documentType:
      latest?.documentType ||
      current?.documentType ||
      null,

    title:
      latest?.title ||
      current?.title ||
      latest?.fileName ||
      current?.fileName ||
      "Document",

    scopeId:
      latest?.scopeId ||
      current?.scopeId ||
      null,

    phaseId:
      latest?.phaseId ||
      current?.phaseId ||
      null

  };

}


/* =========================================================
   REVISION SORT
========================================================= */

function compareRevisionNewest(
  a,
  b
) {

  const aTime =
    toMilliseconds(
      a.uploadedAt ||
      a.updatedAt
    );


  const bTime =
    toMilliseconds(
      b.uploadedAt ||
      b.updatedAt
    );


  if (
    bTime !==
      aTime
  ) {

    return (
      bTime -
      aTime
    );

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
   PHASE SELECTION
========================================================= */

function resolveCurrentPhase() {

  if (
    !projectPhases.length
  ) {

    return null;

  }


  /*
   * 1. Explicit project pointer.
   */

  if (
    currentProject.currentPhaseId
  ) {

    const explicit =
      projectPhases.find(
        (phase) =>
          phase.id ===
            currentProject.currentPhaseId
      );


    if (
      explicit
    ) {

      return explicit;

    }

  }


  /*
   * 2. Explicit phase state.
   */

  const statusPhase =
    projectPhases.find(
      (phase) =>
        ACTIVE_PHASE_STATUSES.includes(
          cleanString(
            phase.status
          ).toUpperCase()
        )
    );


  if (
    statusPhase
  ) {

    return statusPhase;

  }


  /*
   * 3. Planned date window.
   */

  const today =
    startOfToday();


  const datePhase =
    projectPhases.find(
      (phase) => {

        const start =
          getPhaseStartDate(
            phase
          );


        const finish =
          getPhaseFinishDate(
            phase
          );


        if (
          !start ||
          !finish
        ) {

          return false;

        }


        return (
          start <=
            today &&
          finish >=
            today
        );

      }
    );


  if (
    datePhase
  ) {

    return datePhase;

  }


  /*
   * 4. Most recently started incomplete phase.
   */

  const commenced =
    projectPhases
      .filter(
        (phase) =>
          !isPhaseComplete(
            phase
          )
      )
      .filter(
        (phase) => {

          const start =
            getPhaseStartDate(
              phase
            );


          return (
            start &&
            start <=
              today
          );

        }
      )
      .sort(
        (a, b) =>
          getDateMilliseconds(
            getPhaseStartDate(
              b
            )
          )
          -
          getDateMilliseconds(
            getPhaseStartDate(
              a
            )
          )
      );


  return commenced[0] ||
    null;

}


/* =========================================================
   NEXT PHASE
========================================================= */

function resolveNextPhase(
  currentPhase
) {

  const today =
    startOfToday();


  const candidates =
    projectPhases
      .filter(
        (phase) =>
          !isPhaseComplete(
            phase
          )
      )
      .filter(
        (phase) =>
          !currentPhase ||
          phase.id !==
            currentPhase.id
      )
      .filter(
        (phase) => {

          const start =
            getPhaseStartDate(
              phase
            );


          return (
            start &&
            start >
              today
          );

        }
      )
      .sort(
        (a, b) =>
          getDateMilliseconds(
            getPhaseStartDate(
              a
            )
          )
          -
          getDateMilliseconds(
            getPhaseStartDate(
              b
            )
          )
      );


  if (
    candidates.length
  ) {

    return candidates[0];

  }


  /*
   * Fallback where dates have not been entered yet.
   */

  const ordered =
    projectPhases
      .filter(
        (phase) =>
          !isPhaseComplete(
            phase
          )
      )
      .sort(
        comparePhaseSequence
      );


  if (
    currentPhase
  ) {

    const currentIndex =
      ordered.findIndex(
        (phase) =>
          phase.id ===
            currentPhase.id
      );


    if (
      currentIndex >= 0
    ) {

      return ordered[
        currentIndex + 1
      ] ||
      null;

    }

  }


  return ordered[0] ||
    null;

}


/* =========================================================
   PROJECT START POSITION
========================================================= */

function buildProjectStartPosition() {

  const controls =
    [];


  PROJECT_START_BASELINE.forEach(
    (rule) => {

      const applicable =
        isRuleApplicable(
          rule,
          {
            contextType:
              "PROJECT_START"
          }
        );


      if (
        !applicable
      ) {

        return;

      }


      controls.push(
        assessRule(
          rule,
          {
            contextType:
              "PROJECT_START"
          }
        )
      );

    }
  );


  addManualRequirements(
    controls,
    documentRequirements.filter(
      (requirement) =>
        requirement.gateType ===
          "PROJECT_START" &&
        requirement.requirementState !==
          "NOT_REQUIRED"
    )
  );


  return buildPosition(
    "PROJECT_START",
    "Project Start",
    controls
  );

}


/* =========================================================
   PHASE POSITION
========================================================= */

function buildPhasePosition(
  phase,
  mode
) {

  if (
    !phase
  ) {

    return {

      key:
        mode,

      title:
        mode === "CURRENT_PHASE"
          ? "No current phase"
          : "No next phase configured",

      controls:
        [],

      total:
        0,

      satisfied:
        0,

      blockers:
        0,

      actions:
        0,

      status:
        "NO_DATA",

      issueLabels:
        []

    };

  }


  const controls =
    [];


  PHASE_BASELINE.forEach(
    (rule) => {

      const applicable =
        isRuleApplicable(
          rule,
          {
            contextType:
              mode,

            phase
          }
        );


      if (
        !applicable
      ) {

        return;

      }


      controls.push(
        assessRule(
          rule,
          {
            contextType:
              mode,

            phase
          }
        )
      );

    }
  );


  const manualRequirements =
    documentRequirements.filter(
      (requirement) =>
        requirement.requirementState !==
          "NOT_REQUIRED" &&
        requirement.phaseId ===
          phase.id
    );


  addManualRequirements(
    controls,
    manualRequirements
  );


  return buildPosition(
    mode,
    getPhaseName(
      phase
    ),
    controls
  );

}


/* =========================================================
   HANDOVER POSITION
========================================================= */

function buildHandoverPosition() {

  const controls =
    [];


  HANDOVER_BASELINE.forEach(
    (rule) => {

      const applicable =
        isRuleApplicable(
          rule,
          {
            contextType:
              "PROJECT_HANDOVER"
          }
        );


      if (
        !applicable
      ) {

        return;

      }


      controls.push(
        assessRule(
          rule,
          {
            contextType:
              "PROJECT_HANDOVER"
          }
        )
      );

    }
  );


  addManualRequirements(
    controls,
    documentRequirements.filter(
      (requirement) =>
        requirement.gateType ===
          "PROJECT_HANDOVER" &&
        requirement.requirementState !==
          "NOT_REQUIRED"
    )
  );


  return buildPosition(
    "PROJECT_HANDOVER",
    "Handover Information",
    controls
  );

}


/* =========================================================
   RULE APPLICABILITY
========================================================= */

function isRuleApplicable(
  rule,
  context
) {

  if (
    rule.applicability ===
      "ALWAYS"
  ) {

    return true;

  }


  if (
    rule.applicability ===
      "ACTIVE_WORK"
  ) {

    /*
     * RAMS is considered applicable where there is
     * active/planned scope associated with the phase,
     * or at project level where scopes exist.
     */

    if (
      context.phase
    ) {

      return (
        getScopesForPhase(
          context.phase
        ).length >
        0
      );

    }


    return (
      projectScopes.length >
      0
    );

  }


  if (
    rule.applicability ===
      "KEYWORD_TRIGGER"
  ) {

    return contextHasTrigger(
      context,
      rule.triggerKeywords ||
      []
    )
    ||
    hasMatchingManualRequirement(
      rule,
      context
    )
    ||
    hasMatchingDocument(
      rule,
      context
    );

  }


  if (
    rule.applicability ===
      "WHEN_RELEVANT"
  ) {

    return (
      hasMatchingManualRequirement(
        rule,
        context
      )
      ||
      hasMatchingDocument(
        rule,
        context
      )
      ||
      contextHasTrigger(
        context,
        rule.titleKeywords ||
        []
      )
    );

  }


  return true;

}


/* =========================================================
   ASSESS RULE
========================================================= */

function assessRule(
  rule,
  context
) {

  const family =
    findMatchingFamily(
      rule,
      context
    );


  let status =
    "MISSING";


  if (
    family?.current
  ) {

    status =
      "SATISFIED";

  } else if (
    family?.pending
  ) {

    status =
      "UNDER_REVIEW";

  }


  return {

    code:
      rule.code,

    label:
      rule.label,

    criticality:
      rule.criticality ||
      "REQUIRED",

    blocking:
      rule.blocking ===
        true,

    status,

    source:
      "NORMEX_BASELINE",

    familyId:
      family?.id ||
      null

  };

}


/* =========================================================
   ADD MANUAL REQUIREMENTS
========================================================= */

function addManualRequirements(
  controls,
  requirements
) {

  requirements.forEach(
    (requirement) => {

      /*
       * Avoid displaying the same control twice where
       * an explicit project requirement overlaps a
       * NORMEX baseline control.
       */

      const duplicate =
        controls.find(
          (control) =>
            requirementMatchesControl(
              requirement,
              control
            )
        );


      if (
        duplicate
      ) {

        /*
         * Explicit project requirement can strengthen
         * the baseline rule.
         */

        if (
          requirement.blocksProgress ===
            true
        ) {

          duplicate.blocking =
            true;

        }


        if (
          requirement.criticality ===
            "CRITICAL"
        ) {

          duplicate.criticality =
            "CRITICAL";

        }


        return;

      }


      controls.push(
        assessManualRequirement(
          requirement
        )
      );

    }
  );

}


/* =========================================================
   ASSESS MANUAL REQUIREMENT
========================================================= */

function assessManualRequirement(
  requirement
) {

  const family =
    findFamilyForRequirement(
      requirement
    );


  let status =
    "MISSING";


  if (
    family?.current
  ) {

    status =
      "SATISFIED";

  } else if (
    family?.pending
  ) {

    status =
      "UNDER_REVIEW";

  }


  return {

    code:
      requirement.id,

    label:
      requirement.title ||
      formatDocumentType(
        requirement.documentType
      ),

    criticality:
      requirement.criticality ||
      "REQUIRED",

    blocking:
      requirement.blocksProgress ===
        true,

    status,

    source:
      "PROJECT_REQUIREMENT",

    familyId:
      family?.id ||
      null

  };

}


/* =========================================================
   BUILD POSITION
========================================================= */

function buildPosition(
  key,
  title,
  controls
) {

  const total =
    controls.length;


  const satisfied =
    controls.filter(
      (control) =>
        control.status ===
          "SATISFIED"
    ).length;


  const blockers =
    controls.filter(
      (control) =>
        control.blocking ===
          true &&
        control.status !==
          "SATISFIED"
    ).length;


  const actions =
    controls.filter(
      (control) =>
        control.status !==
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
    actions >
      0
  ) {

    status =
      "ACTION";

  } else if (
    total ===
      0
  ) {

    status =
      "NO_DATA";

  }


  const issueLabels =
    controls
      .filter(
        (control) =>
          control.status !==
            "SATISFIED"
      )
      .sort(
        compareControlPriority
      )
      .slice(
        0,
        3
      )
      .map(
        (control) =>
          `${control.label}${
            control.status ===
              "UNDER_REVIEW"
              ? " (review)"
              : ""
          }`
      );


  return {

    key,

    title,

    controls,

    total,

    satisfied,

    blockers,

    actions,

    status,

    issueLabels

  };

}


/* =========================================================
   CONTROL PRIORITY
========================================================= */

function compareControlPriority(
  a,
  b
) {

  const blockDifference =
    Number(
      b.blocking ===
        true
    )
    -
    Number(
      a.blocking ===
        true
    );


  if (
    blockDifference !==
      0
  ) {

    return blockDifference;

  }


  const priority = {

    CRITICAL:
      0,

    REQUIRED:
      1,

    SUPPORTING:
      2

  };


  return (
    priority[
      a.criticality
    ] ??
    99
  )
  -
  (
    priority[
      b.criticality
    ] ??
    99
  );

}


/* =========================================================
   FIND MATCHING FAMILY
========================================================= */

function findMatchingFamily(
  rule,
  context
) {

  const candidates =
    documentFamilies.filter(
      (family) =>
        familyMatchesContext(
          family,
          context
        )
    );


  return candidates.find(
    (family) =>
      familyMatchesRule(
        family,
        rule
      )
  )
  ||
  null;

}


/* =========================================================
   FAMILY MATCHES RULE
========================================================= */

function familyMatchesRule(
  family,
  rule
) {

  const documentType =
    cleanString(
      family.documentType
    ).toUpperCase();


  if (
    rule.documentTypes
      ?.includes(
        documentType
      )
  ) {

    return true;

  }


  const text =
    [
      family.title,
      family.latest?.fileName,
      family.current?.fileName
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      )
      .toLowerCase();


  return (
    rule.titleKeywords ||
    []
  ).some(
    (keyword) =>
      text.includes(
        keyword.toLowerCase()
      )
  );

}


/* =========================================================
   FAMILY MATCHES CONTEXT
========================================================= */

function familyMatchesContext(
  family,
  context
) {

  if (
    !context.phase
  ) {

    return true;

  }


  /*
   * Exact phase link wins.
   */

  if (
    family.phaseId
  ) {

    return (
      family.phaseId ===
        context.phase.id
    );

  }


  /*
   * Scope-linked document can also belong to phase.
   */

  if (
    family.scopeId
  ) {

    const scope =
      projectScopes.find(
        (item) =>
          item.id ===
            family.scopeId
      );


    if (
      scope?.phaseId
    ) {

      return (
        scope.phaseId ===
          context.phase.id
      );

    }

  }


  /*
   * Project-level controlled documents such as RAMS may
   * legitimately cover the phase if no tighter linkage
   * exists yet.
   */

  return true;

}


/* =========================================================
   MATCH MANUAL REQUIREMENT
========================================================= */

function hasMatchingManualRequirement(
  rule,
  context
) {

  return documentRequirements.some(
    (requirement) => {

      if (
        requirement.requirementState ===
          "NOT_REQUIRED"
      ) {

        return false;

      }


      if (
        context.phase &&
        requirement.phaseId &&
        requirement.phaseId !==
          context.phase.id
      ) {

        return false;

      }


      if (
        rule.documentTypes
          ?.includes(
            requirement.documentType
          )
      ) {

        return true;

      }


      const title =
        cleanString(
          requirement.title
        ).toLowerCase();


      return (
        rule.titleKeywords ||
        []
      ).some(
        (keyword) =>
          title.includes(
            keyword.toLowerCase()
          )
      );

    }
  );

}


/* =========================================================
   MATCH EXISTING DOCUMENT
========================================================= */

function hasMatchingDocument(
  rule,
  context
) {

  return Boolean(
    findMatchingFamily(
      rule,
      context
    )
  );

}


/* =========================================================
   CONTEXT TRIGGER
========================================================= */

function contextHasTrigger(
  context,
  keywords
) {

  if (
    !keywords.length
  ) {

    return false;

  }


  const text =
    buildContextText(
      context
    );


  return keywords.some(
    (keyword) =>
      text.includes(
        keyword.toLowerCase()
      )
  );

}


/* =========================================================
   CONTEXT TEXT
========================================================= */

function buildContextText(
  context
) {

  const parts =
    [];


  parts.push(
    currentProject.name,
    currentProject.description,
    currentProject.scope,
    currentProject.currentPhaseName
  );


  if (
    context.phase
  ) {

    parts.push(
      context.phase.name,
      context.phase.title,
      context.phase.description,
      context.phase.scope
    );


    getScopesForPhase(
      context.phase
    ).forEach(
      (scope) => {

        parts.push(
          scope.scopeCode,
          scope.name,
          scope.title,
          scope.description,
          scope.notes
        );

      }
    );

  } else {

    projectScopes.forEach(
      (scope) => {

        parts.push(
          scope.scopeCode,
          scope.name,
          scope.title,
          scope.description,
          scope.notes
        );

      }
    );

  }


  return parts
    .filter(
      Boolean
    )
    .join(
      " "
    )
    .toLowerCase();

}


/* =========================================================
   SCOPES FOR PHASE
========================================================= */

function getScopesForPhase(
  phase
) {

  if (
    !phase
  ) {

    return [];

  }


  const linked =
    projectScopes.filter(
      (scope) =>
        scope.phaseId ===
          phase.id
    );


  if (
    linked.length
  ) {

    return linked;

  }


  /*
   * Fallback where scopes pre-date phase linkage.
   *
   * For current phase, incomplete scopes are treated as
   * potentially active.
   */

  return projectScopes.filter(
    (scope) =>
      !COMPLETE_SCOPE_STATUSES.includes(
        cleanString(
          scope.status
        ).toUpperCase()
      )
  );

}


/* =========================================================
   FIND FAMILY FOR EXPLICIT REQUIREMENT
========================================================= */

function findFamilyForRequirement(
  requirement
) {

  if (
    requirement.documentFamilyId
  ) {

    const exact =
      documentFamilies.find(
        (family) =>
          family.id ===
            requirement.documentFamilyId
      );


    if (
      exact
    ) {

      return exact;

    }

  }


  return documentFamilies.find(
    (family) => {

      if (
        family.documentType !==
          requirement.documentType
      ) {

        return false;

      }


      if (
        requirement.phaseId &&
        family.phaseId &&
        family.phaseId !==
          requirement.phaseId
      ) {

        return false;

      }


      if (
        requirement.scopeId &&
        family.scopeId &&
        family.scopeId !==
          requirement.scopeId
      ) {

        return false;

      }


      return true;

    }
  )
  ||
  null;

}


/* =========================================================
   REQUIREMENT MATCHES EXISTING CONTROL
========================================================= */

function requirementMatchesControl(
  requirement,
  control
) {

  const requirementTitle =
    cleanString(
      requirement.title
    ).toLowerCase();


  const controlTitle =
    cleanString(
      control.label
    ).toLowerCase();


  if (
    requirementTitle &&
    controlTitle &&
    (
      requirementTitle.includes(
        controlTitle
      )
      ||
      controlTitle.includes(
        requirementTitle
      )
    )
  ) {

    return true;

  }


  const type =
    cleanString(
      requirement.documentType
    ).toUpperCase();


  const commonMappings = {

    PRE_CONSTRUCTION_INFORMATION:
      "PCI",

    CONSTRUCTION_PHASE_PLAN:
      "CPP",

    EMERGENCY_ARRANGEMENTS:
      "EMERGENCY",

    PROJECT_ORGANOGRAM:
      "ORGANISATION",

    LOGISTICS_PLAN:
      "LOGISTICS",

    TRAFFIC_MANAGEMENT_PLAN:
      "LOGISTICS",

    ENVIRONMENTAL_PLAN:
      "ENVIRONMENT",

    WASTE_MANAGEMENT_PLAN:
      "ENVIRONMENT",

    RAMS:
      "RAMS",

    LIFT_PLAN:
      "LIFT_PLAN",

    TEMPORARY_WORKS_DESIGN:
      "TEMPORARY_WORKS",

    TEMPORARY_WORKS_CHECK:
      "TEMPORARY_WORKS",

    ISOLATION_CERTIFICATE:
      "ISOLATION",

    COSHH:
      "COSHH",

    AS_BUILT_DRAWING:
      "AS_BUILT"

  };


  return (
    commonMappings[
      type
    ] ===
      control.code
  );

}


/* =========================================================
   RENDER POSITION
========================================================= */

function renderProjectInformationPosition() {

  const grid =
    getElement(
      "projectInformationPositionGrid"
    );


  if (
    !grid
  ) {

    return;

  }


  const currentPhase =
    resolveCurrentPhase();


  const nextPhase =
    resolveNextPhase(
      currentPhase
    );


  const positions = [

    buildProjectStartPosition(),

    buildPhasePosition(
      currentPhase,
      "CURRENT_PHASE"
    ),

    buildPhasePosition(
      nextPhase,
      "NEXT_PHASE"
    ),

    buildHandoverPosition()

  ];


  grid.innerHTML =
    positions
      .map(
        renderPositionCard
      )
      .join("");


  const blocking =
    positions.reduce(
      (
        total,
        position
      ) =>
        total +
        position.blockers,
      0
    );


  const actions =
    positions.reduce(
      (
        total,
        position
      ) =>
        total +
        position.actions,
      0
    );


  if (
    blocking >
      0
  ) {

    setText(
      "projectInformationPositionLabel",
      `${blocking} blocking ${
        blocking === 1
          ? "issue"
          : "issues"
      }`
    );

  } else if (
    actions >
      0
  ) {

    setText(
      "projectInformationPositionLabel",
      `${actions} information ${
        actions === 1
          ? "action"
          : "actions"
      }`
    );

  } else {

    setText(
      "projectInformationPositionLabel",
      "Information position clear"
    );

  }

}


/* =========================================================
   RENDER CARD
========================================================= */

function renderPositionCard(
  position
) {

  let className =
    "documents-gate-card";


  if (
    position.status ===
      "READY"
  ) {

    className +=
      " is-ready";

  }


  if (
    position.status ===
      "ACTION"
  ) {

    className +=
      " is-warning";

  }


  if (
    position.status ===
      "BLOCKED"
  ) {

    className +=
      " is-blocked";

  }


  const eyebrow =
    getPositionEyebrow(
      position.key
    );


  const status =
    getPositionStatusLabel(
      position.status
    );


  const meta =
    buildPositionMeta(
      position
    );


  return `

    <article class="${className}">

      <span class="documents-gate-card__eyebrow">

        ${escapeHtml(
          eyebrow
        )}

      </span>


      <h4>

        ${escapeHtml(
          position.title
        )}

      </h4>


      <span class="documents-gate-card__status">

        ${escapeHtml(
          status
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
   POSITION META
========================================================= */

function buildPositionMeta(
  position
) {

  if (
    position.status ===
      "NO_DATA"
  ) {

    return position.key ===
      "CURRENT_PHASE"
      ? "No current phase identified from status or programme dates"
      : position.key ===
          "NEXT_PHASE"
          ? "No future phase identified from programme dates"
          : "No applicable information controls identified";

  }


  const summary =
    `${position.satisfied} / ${position.total} satisfied`;


  if (
    !position.actions
  ) {

    return summary;

  }


  const issues =
    position.issueLabels.join(
      ", "
    );


  if (
    position.blockers >
      0
  ) {

    return `${summary} · ${position.blockers} blocking · Missing: ${issues}`;

  }


  return `${summary} · Outstanding: ${issues}`;

}


/* =========================================================
   POSITION EYEBROW
========================================================= */

function getPositionEyebrow(
  key
) {

  const labels = {

    PROJECT_START:
      "Project Start",

    CURRENT_PHASE:
      "Current Phase",

    NEXT_PHASE:
      "Next Phase",

    PROJECT_HANDOVER:
      "Project Handover"

  };


  return (
    labels[
      key
    ] ||
    "Project Information"
  );

}


/* =========================================================
   POSITION STATUS LABEL
========================================================= */

function getPositionStatusLabel(
  status
) {

  const labels = {

    READY:
      "READY",

    ACTION:
      "ACTION REQUIRED",

    BLOCKED:
      "NOT READY",

    NO_DATA:
      "NOT YET ASSESSED"

  };


  return (
    labels[
      status
    ] ||
    "ASSESSING"
  );

}


/* =========================================================
   UNAVAILABLE POSITION
========================================================= */

function renderUnavailablePosition(
  message
) {

  const grid =
    getElement(
      "projectInformationPositionGrid"
    );


  if (
    grid
  ) {

    grid.innerHTML = `

      <div class="documents-empty documents-empty--compact">

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }


  setText(
    "projectInformationPositionLabel",
    message
  );

}


/* =========================================================
   PHASE HELPERS
========================================================= */

function isPhaseComplete(
  phase
) {

  return COMPLETE_PHASE_STATUSES.includes(
    cleanString(
      phase.status
    ).toUpperCase()
  );

}


function comparePhaseSequence(
  a,
  b
) {

  const aSequence =
    Number(
      a.sequence ??
      a.order ??
      a.phaseOrder ??
      9999
    );


  const bSequence =
    Number(
      b.sequence ??
      b.order ??
      b.phaseOrder ??
      9999
    );


  return (
    aSequence -
    bSequence
  );

}


function getPhaseName(
  phase
) {

  return (
    phase.name ||
    phase.title ||
    phase.phaseName ||
    "Project Phase"
  );

}


/* =========================================================
   PHASE DATE HELPERS
========================================================= */

function getPhaseStartDate(
  phase
) {

  return parseFlexibleDate(
    phase.plannedStart ||
    phase.plannedStartDate ||
    phase.startDate ||
    phase.start ||
    phase.actualStart ||
    null
  );

}


function getPhaseFinishDate(
  phase
) {

  return parseFlexibleDate(
    phase.plannedFinish ||
    phase.plannedFinishDate ||
    phase.finishDate ||
    phase.endDate ||
    phase.finish ||
    phase.actualFinish ||
    null
  );

}


function parseFlexibleDate(
  value
) {

  if (
    !value
  ) {

    return null;

  }


  if (
    typeof value.toDate ===
      "function"
  ) {

    return startOfDate(
      value.toDate()
    );

  }


  if (
    value instanceof Date
  ) {

    return startOfDate(
      value
    );

  }


  const parsed =
    new Date(
      value
    );


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {

    return null;

  }


  return startOfDate(
    parsed
  );

}


function startOfToday() {

  return startOfDate(
    new Date()
  );

}


function startOfDate(
  value
) {

  const date =
    new Date(
      value
    );


  date.setHours(
    0,
    0,
    0,
    0
  );


  return date;

}


function getDateMilliseconds(
  value
) {

  return value
    ? value.getTime()
    : 0;

}


/* =========================================================
   TIMESTAMP
========================================================= */

function toMilliseconds(
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
   DOCUMENT TYPE FORMATTER
========================================================= */

function formatDocumentType(
  value
) {

  return String(
    value ||
    "Document"
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
   ESCAPE HTML
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
   START
========================================================= */

waitForWorkspace();