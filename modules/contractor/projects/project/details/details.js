import {
  db
} from "/js/firebase.js";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  renderProjectNav
} from "/modules/contractor/projects/shared/project-nav.js";


let currentProfile = null;
let currentProject = null;
let currentProjectId = null;

let editAllowed = false;
let commercialAllowed = false;


/* =========================================================
   HELPERS
========================================================= */

function getElement(id) {
  return document.getElementById(id);
}


function setText(
  id,
  value
) {
  const element =
    getElement(id);

  if (!element) return;

  element.textContent =
    value ?? "—";
}


function getProjectId() {
  return new URLSearchParams(
    window.location.search
  ).get("id");
}


function cleanString(value) {
  return String(
    value ?? ""
  ).trim();
}


function nullableString(value) {
  const cleaned =
    cleanString(value);

  return cleaned || null;
}


function nullableNumber(value) {
  const cleaned =
    cleanString(value);

  if (!cleaned) {
    return null;
  }

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? number
    : null;
}


/* =========================================================
   WORKSPACE
========================================================= */

function waitForWorkspace() {

  if (
    window.NORMEX_CURRENT_USER
  ) {
    initialiseDetails(
      window.NORMEX_CURRENT_USER
    );

    return;
  }


  window.addEventListener(
    "normex:workspace-ready",
    (event) => {
      initialiseDetails(
        event.detail.profile
      );
    },
    {
      once: true
    }
  );
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


  if (!snapshot.exists()) {
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

  const level =
    Number(
      currentProfile.accessLevel || 0
    );


  if (level >= 99) {
    editAllowed = true;
    commercialAllowed = true;
    return;
  }


  if (level >= 3) {
    editAllowed = true;
    commercialAllowed = true;
    return;
  }


  commercialAllowed = false;


  if (level < 2) {
    editAllowed = false;
    return;
  }


  try {

    const membership =
      await getDoc(
        doc(
          db,
          "projects",
          currentProjectId,
          "members",
          currentProfile.uid
        )
      );


    editAllowed =
      membership.exists() &&
      membership.data().active === true &&
      membership.data().canManageProject === true;


    commercialAllowed =
      membership.exists() &&
      membership.data().active === true &&
      membership.data().canManageCommercial === true;


  } catch (error) {

    console.warn(
      "Project membership lookup failed:",
      error
    );

    editAllowed = false;
    commercialAllowed = false;
  }

}


/* =========================================================
   USER RESOLUTION
========================================================= */

async function resolveUser(
  uid
) {

  if (!uid) {
    return null;
  }


  try {

    const snapshot =
      await getDoc(
        doc(
          db,
          "users",
          uid
        )
      );


    if (!snapshot.exists()) {
      return null;
    }


    return snapshot.data();

  } catch (error) {

    console.warn(
      "Could not resolve user:",
      uid,
      error
    );

    return null;
  }

}


/* =========================================================
   RENDER PROJECT
========================================================= */

async function renderProject() {

  const project =
    currentProject;


  document.title =
    `${project.name || "Project"} | Details | NORMEX`;


  setText(
    "projectSubnavName",
    project.name
  );


  setText(
    "detailProjectCodeDisplay",
    project.projectCode
  );


  setText(
    "detailProjectNameDisplay",
    project.name
  );


  setText(
    "detailProjectMetaDisplay",
    [
      project.clientName,
      project.siteName
    ]
      .filter(Boolean)
      .join(" · ") || "—"
  );


  setText(
    "detailProjectTypeDisplay",
    formatPosition(
      project.projectType
    )
  );


  setText(
    "detailCurrentPhaseDisplay",
    project.currentPhase ||
      "Not set"
  );


  setText(
    "detailStartDateDisplay",
    formatDate(
      project.startDate
    )
  );


  setText(
    "detailTargetFinishDisplay",
    formatDate(
      project.targetFinishDate
    )
  );


  renderStatus(
    project.status,
    project.archived
  );


  renderRoles(
    project.rolesOnProject || []
  );


  renderContractSetup();

  renderGovernance();

  renderKeyInformation();

  await renderAuditIndicator();

}


/* =========================================================
   STATUS
========================================================= */

function renderStatus(
  status,
  archived
) {

  const element =
    getElement(
      "detailProjectStatusDisplay"
    );


  element.className =
    "details-status";


  if (archived === true) {
    element.textContent =
      "Archived";

    return;
  }


  const states = {

    LIVE: [
      "Live",
      "is-live"
    ],

    PRE_CONSTRUCTION: [
      "Pre-Construction",
      "is-pre"
    ],

    ON_HOLD: [
      "On Hold",
      "is-hold"
    ],

    COMPLETE: [
      "Complete",
      ""
    ]

  };


  const state =
    states[status] || [
      formatPosition(status),
      ""
    ];


  element.textContent =
    state[0];


  if (state[1]) {
    element.classList.add(
      state[1]
    );
  }

}


/* =========================================================
   ROLES
========================================================= */

function renderRoles(
  roles
) {

  const root =
    getElement(
      "detailRolesDisplay"
    );


  root.innerHTML = "";


  if (!roles.length) {
    root.textContent =
      "Not recorded";

    return;
  }


  roles.forEach(
    (role) => {

      const chip =
        document.createElement(
          "span"
        );

      chip.className =
        "details-role-chip";

      chip.textContent =
        formatPosition(role);

      root.appendChild(chip);

    }
  );

}


/* =========================================================
   CONTRACT
========================================================= */

function renderContractSetup() {

  const content =
    getElement(
      "commercialSetupContent"
    );

  const restricted =
    getElement(
      "commercialRestrictedState"
    );


  if (!commercialAllowed) {

    content.hidden = true;
    restricted.hidden = false;

    return;
  }


  content.hidden = false;
  restricted.hidden = true;


  const currency =
    currentProject.currency ||
    "GBP";


  setText(
    "detailContractRefDisplay",
    currentProject.contractRef ||
      "—"
  );


  setText(
    "detailOriginalQuoteRefDisplay",
    currentProject.originalQuoteRef ||
      "—"
  );


  setText(
    "detailContractAwardDisplay",
    formatDate(
      currentProject.contractAwardDate
    )
  );


  setText(
    "detailOriginalValueDisplay",
    formatMoney(
      currentProject.originalContractValue,
      currency
    )
  );


  setText(
    "detailCurrentValueDisplay",
    formatMoney(
      currentProject.currentContractValue,
      currency
    )
  );


  setText(
    "detailPaymentTermsDisplay",
    currentProject.paymentTerms ||
      "—"
  );


  setText(
    "detailRetentionDisplay",
    Number.isFinite(
      Number(
        currentProject.retentionPercentage
      )
    )
      ? `${currentProject.retentionPercentage}%`
      : "—"
  );

}


/* =========================================================
   GOVERNANCE
========================================================= */

function renderGovernance() {

  const fields = {

    detailProjectDirectorDisplay:
      currentProject.projectDirectorName,

    detailProjectManagerDisplay:
      currentProject.projectManagerName,

    detailSiteManagerDisplay:
      currentProject.siteManagerName,

    detailSafetyLeadDisplay:
      currentProject.safetyLeadName,

    detailCommercialLeadDisplay:
      currentProject.commercialLeadName,

    detailPlannerDisplay:
      currentProject.plannerName,

    detailTwcDisplay:
      currentProject.twcName,

    detailDesignLeadDisplay:
      currentProject.designLeadName

  };


  Object.entries(fields)
    .forEach(
      ([id, value]) => {

        setText(
          id,
          value ||
          "Not assigned"
        );

      }
    );

}


/* =========================================================
   KEY INFORMATION
========================================================= */

function renderKeyInformation() {

  setText(
    "detailClientReferenceDisplay",
    currentProject.clientReference ||
      "—"
  );


  setText(
    "detailWorkOrderDisplay",
    currentProject.workOrderReference ||
      "—"
  );


  setText(
    "detailPrincipalContractorDisplay",
    currentProject.principalContractorName ||
      "—"
  );


  setText(
    "detailPrincipalDesignerDisplay",
    currentProject.principalDesignerName ||
      "—"
  );


  setText(
    "detailWorkingHoursDisplay",
    currentProject.workingHours ||
      "—"
  );


  setText(
    "detailProjectAddressDisplay",
    currentProject.projectAddress ||
      "—"
  );


  setText(
    "detailSiteAccessDisplay",
    currentProject.siteAccessNotes ||
      "—"
  );


  setText(
    "detailDescriptionDisplay",
    currentProject.description ||
      "—"
  );

}


/* =========================================================
   AUDIT INDICATOR
========================================================= */

async function renderAuditIndicator() {

  const uid =
    currentProject.updatedByUid ||
    currentProject.createdByUid;


  const user =
    await resolveUser(uid);


  const name =
    user?.displayName ||
    currentProject.updatedByName ||
    currentProject.createdByName ||
    "Unknown user";


  const date =
    timestampToDate(
      currentProject.updatedAt
    ) ||
    timestampToDate(
      currentProject.createdAt
    );


  if (!date) {

    setText(
      "projectAuditSummary",
      `Last updated by ${name}`
    );

    setText(
      "projectAuditTooltip",
      name
    );

    return;
  }


  setText(
    "projectAuditSummary",
    `Updated ${formatShortDate(date)}`
  );


  setText(
    "projectAuditTooltip",
    [
      `Updated by ${name}`,
      formatUserRole(user),
      formatFullDate(date)
    ]
      .filter(Boolean)
      .join("\n")
  );

}


/* =========================================================
   SCOPE REGISTER
========================================================= */

async function loadScopes() {

  const root =
    getElement(
      "scopeRegister"
    );


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "projects",
          currentProjectId,
          "scopes"
        )
      );


    const scopes =
      snapshot.docs
        .map(
          (item) => ({
            id: item.id,
            ...item.data()
          })
        )
        .sort(
          (a, b) =>
            String(
              a.scopeCode || ""
            )
              .localeCompare(
                String(
                  b.scopeCode || ""
                )
              )
        );


    if (!scopes.length) {

      root.innerHTML = `
        <div class="details-empty-state">
          No project scopes recorded yet.
        </div>
      `;

      return;
    }


    root.innerHTML = `
      <table class="details-table">

        <thead>

          <tr>
            <th>Ref</th>
            <th>Scope</th>
            <th>Status</th>
            <th>Start</th>
            <th>Target Finish</th>
          </tr>

        </thead>

        <tbody>

          ${scopes
            .map(
              (scope) => `
                <tr>

                  <td>
                    ${escapeHtml(
                      scope.scopeCode ||
                      "—"
                    )}
                  </td>

                  <td>
                    <strong>
                      ${escapeHtml(
                        scope.name ||
                        "Untitled Scope"
                      )}
                    </strong>
                  </td>

                  <td>
                    ${renderChip(
                      scope.status
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      formatDate(
                        scope.startDate
                      )
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      formatDate(
                        scope.targetFinishDate
                      )
                    )}
                  </td>

                </tr>
              `
            )
            .join("")}

        </tbody>

      </table>
    `;


  } catch (error) {

    console.error(
      "Scope register load error:",
      error
    );


    root.innerHTML = `
      <div class="details-empty-state">
        Scope register could not be loaded.
      </div>
    `;

  }

}


/* =========================================================
   COMMERCIAL REGISTER
========================================================= */

async function loadCommercialRecords() {

  const panel =
    getElement(
      "commercialRegisterPanel"
    );


  if (!commercialAllowed) {
    panel.hidden = true;
    return;
  }


  panel.hidden = false;


  const root =
    getElement(
      "commercialRecordRegister"
    );


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "projects",
          currentProjectId,
          "commercialRecords"
        )
      );


    const records =
      snapshot.docs
        .map(
          (item) => ({
            id: item.id,
            ...item.data()
          })
        )
        .sort(
          (a, b) =>
            String(
              b.recordDate || ""
            )
              .localeCompare(
                String(
                  a.recordDate || ""
                )
              )
        );


    if (!records.length) {

      root.innerHTML = `
        <div class="details-empty-state">
          No quotations or RFQs recorded yet.
        </div>
      `;

      return;
    }


    root.innerHTML = `
      <table class="details-table">

        <thead>

          <tr>
            <th>Ref</th>
            <th>Type</th>
            <th>Description</th>
            <th>Client / Supplier</th>
            <th>Value</th>
            <th>Status</th>
          </tr>

        </thead>

        <tbody>

          ${records
            .map(
              (record) => `
                <tr>

                  <td>
                    ${escapeHtml(
                      record.reference ||
                      "—"
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      formatPosition(
                        record.type
                      )
                    )}
                  </td>

                  <td>
                    <strong>
                      ${escapeHtml(
                        record.description ||
                        "—"
                      )}
                    </strong>
                  </td>

                  <td>
                    ${escapeHtml(
                      record.counterparty ||
                      "—"
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      formatMoney(
                        record.value,
                        currentProject.currency ||
                        "GBP"
                      )
                    )}
                  </td>

                  <td>
                    ${renderChip(
                      record.status
                    )}
                  </td>

                </tr>
              `
            )
            .join("")}

        </tbody>

      </table>
    `;


  } catch (error) {

    console.error(
      "Commercial register load error:",
      error
    );


    root.innerHTML = `
      <div class="details-empty-state">
        Commercial register could not be loaded.
      </div>
    `;

  }

}


/* =========================================================
   HISTORY
========================================================= */

async function loadHistory() {

  const root =
    getElement(
      "projectHistory"
    );


  try {

    const historyQuery =
      query(
        collection(
          db,
          "projects",
          currentProjectId,
          "activity"
        ),
        orderBy(
          "createdAt",
          "desc"
        ),
        limit(10)
      );


    const snapshot =
      await getDocs(
        historyQuery
      );


    const records =
      snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );


    if (!records.length) {

      root.innerHTML = `
        <div class="details-empty-state">
          Project history will appear as changes are recorded.
        </div>
      `;

      return;
    }


    root.innerHTML =
      records
        .map(
          (record) => {

            const date =
              timestampToDate(
                record.createdAt
              );


            return `
              <div class="details-history__item">

                <div class="details-history__date">
                  ${escapeHtml(
                    date
                      ? formatFullDate(date)
                      : "Pending"
                  )}
                </div>

                <div class="details-history__event">

                  <strong>
                    ${escapeHtml(
                      getHistoryTitle(
                        record
                      )
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      record.summary ||
                      getHistorySummary(
                        record
                      )
                    )}
                  </span>

                </div>

                <div class="details-history__user">
                  ${escapeHtml(
                    record.createdByName ||
                    "NORMEX User"
                  )}
                </div>

              </div>
            `;

          }
        )
        .join("");


  } catch (error) {

    console.error(
      "Project history load error:",
      error
    );


    root.innerHTML = `
      <div class="details-empty-state">
        Project history could not be loaded.
      </div>
    `;

  }

}


/* =========================================================
   PROJECT EDIT MODAL
========================================================= */

function openEditModal() {

  populateEditForm();


  const modal =
    getElement(
      "editProjectModal"
    );


  modal.hidden = false;

  document.body.style.overflow =
    "hidden";

}


function closeEditModal() {

  getElement(
    "editProjectModal"
  ).hidden = true;


  document.body.style.overflow =
    "";

}


/* =========================================================
   POPULATE EDIT
========================================================= */

function populateEditForm() {

  const project =
    currentProject;


  setInput(
    "editName",
    project.name
  );

  setInput(
    "editProjectCode",
    project.projectCode
  );

  setInput(
    "editProjectType",
    project.projectType ||
    "DEMOLITION"
  );

  setInput(
    "editClientName",
    project.clientName
  );

  setInput(
    "editSiteName",
    project.siteName
  );

  setInput(
    "editStatus",
    project.status ||
    "PRE_CONSTRUCTION"
  );

  setInput(
    "editCurrentPhase",
    project.currentPhase
  );

  setInput(
    "editStartDate",
    normaliseDateInput(
      project.startDate
    )
  );

  setInput(
    "editTargetFinish",
    normaliseDateInput(
      project.targetFinishDate
    )
  );

  setInput(
    "editActualFinish",
    normaliseDateInput(
      project.actualFinishDate
    )
  );

  setInput(
    "editContractRef",
    project.contractRef
  );

  setInput(
    "editOriginalQuoteRef",
    project.originalQuoteRef
  );

  setInput(
    "editContractAwardDate",
    normaliseDateInput(
      project.contractAwardDate
    )
  );

  setInput(
    "editCurrency",
    project.currency ||
    "GBP"
  );

  setInput(
    "editOriginalContractValue",
    project.originalContractValue
  );

  setInput(
    "editCurrentContractValue",
    project.currentContractValue
  );

  setInput(
    "editPaymentTerms",
    project.paymentTerms
  );

  setInput(
    "editRetention",
    project.retentionPercentage
  );

  setInput(
    "editClientReference",
    project.clientReference
  );

  setInput(
    "editWorkOrderReference",
    project.workOrderReference
  );

  setInput(
    "editPrincipalContractor",
    project.principalContractorName
  );

  setInput(
    "editPrincipalDesigner",
    project.principalDesignerName
  );

  setInput(
    "editWorkingHours",
    project.workingHours
  );

  setInput(
    "editProjectAddress",
    project.projectAddress
  );

  setInput(
    "editSiteAccessNotes",
    project.siteAccessNotes
  );

  setInput(
    "editDescription",
    project.description
  );


  document
    .querySelectorAll(
      '#editProjectForm input[name="rolesOnProject"]'
    )
    .forEach(
      (checkbox) => {

        checkbox.checked =
          (
            project.rolesOnProject ||
            []
          )
            .includes(
              checkbox.value
            );

      }
    );

}


/* =========================================================
   SAVE PROJECT
========================================================= */

async function saveProject(
  event
) {

  event.preventDefault();


  const form =
    new FormData(
      event.currentTarget
    );


  const next = {

    name:
      cleanString(
        form.get("name")
      ),

    projectCode:
      cleanString(
        form.get("projectCode")
      ),

    projectType:
      cleanString(
        form.get("projectType")
      ),

    clientName:
      nullableString(
        form.get("clientName")
      ),

    siteName:
      nullableString(
        form.get("siteName")
      ),

    status:
      cleanString(
        form.get("status")
      ),

    currentPhase:
      nullableString(
        form.get("currentPhase")
      ),

    startDate:
      nullableString(
        form.get("startDate")
      ),

    targetFinishDate:
      nullableString(
        form.get("targetFinishDate")
      ),

    actualFinishDate:
      nullableString(
        form.get("actualFinishDate")
      ),

    rolesOnProject:
      form
        .getAll(
          "rolesOnProject"
        )
        .map(String),

    contractRef:
      nullableString(
        form.get("contractRef")
      ),

    originalQuoteRef:
      nullableString(
        form.get("originalQuoteRef")
      ),

    contractAwardDate:
      nullableString(
        form.get("contractAwardDate")
      ),

    currency:
      cleanString(
        form.get("currency")
      ) || "GBP",

    originalContractValue:
      nullableNumber(
        form.get(
          "originalContractValue"
        )
      ),

    currentContractValue:
      nullableNumber(
        form.get(
          "currentContractValue"
        )
      ),

    paymentTerms:
      nullableString(
        form.get("paymentTerms")
      ),

    retentionPercentage:
      nullableNumber(
        form.get(
          "retentionPercentage"
        )
      ),

    clientReference:
      nullableString(
        form.get("clientReference")
      ),

    workOrderReference:
      nullableString(
        form.get(
          "workOrderReference"
        )
      ),

    principalContractorName:
      nullableString(
        form.get(
          "principalContractorName"
        )
      ),

    principalDesignerName:
      nullableString(
        form.get(
          "principalDesignerName"
        )
      ),

    workingHours:
      nullableString(
        form.get("workingHours")
      ),

    projectAddress:
      nullableString(
        form.get("projectAddress")
      ),

    siteAccessNotes:
      nullableString(
        form.get("siteAccessNotes")
      ),

    description:
      nullableString(
        form.get("description")
      )

  };


  if (
    !next.name ||
    !next.projectCode
  ) {
    showFormError(
      "editProjectError",
      "Project name and project code are required."
    );

    return;
  }


  if (
    !next.rolesOnProject.length
  ) {
    showFormError(
      "editProjectError",
      "Select at least one Colemans role."
    );

    return;
  }


  const changedFields =
    getChangedFields(
      currentProject,
      next
    );


  if (!changedFields.length) {
    closeEditModal();
    return;
  }


  const button =
    getElement(
      "saveProjectButton"
    );


  button.disabled = true;
  button.textContent =
    "Saving...";


  try {

    const userName =
      currentProfile.displayName ||
      currentProfile.email ||
      "NORMEX User";


    await updateDoc(
      doc(
        db,
        "projects",
        currentProjectId
      ),
      {
        ...next,

        updatedByUid:
          currentProfile.uid,

        updatedByName:
          userName,

        updatedAt:
          serverTimestamp()
      }
    );


    const changes =
      buildChanges(
        currentProject,
        next,
        changedFields
      );


    await addDoc(
      collection(
        db,
        "projects",
        currentProjectId,
        "activity"
      ),
      {
        organisationId:
          currentProject.organisationId,

        projectId:
          currentProjectId,

        type:
          "PROJECT_DETAILS_UPDATED",

        summary:
          `${changedFields.length} project ${
            changedFields.length === 1
              ? "field"
              : "fields"
          } updated`,

        changedFields,

        changes,

        createdByUid:
          currentProfile.uid,

        createdByName:
          userName,

        createdAt:
          serverTimestamp()
      }
    );


    if (
      changedFields.includes(
        "currentPhase"
      )
    ) {

      await addDoc(
        collection(
          db,
          "projects",
          currentProjectId,
          "activity"
        ),
        {
          organisationId:
            currentProject.organisationId,

          projectId:
            currentProjectId,

          type:
            "PROJECT_PHASE_CHANGED",

          summary:
            `${currentProject.currentPhase || "Not set"} → ${next.currentPhase || "Not set"}`,

          previousPhase:
            currentProject.currentPhase ||
            null,

          newPhase:
            next.currentPhase ||
            null,

          createdByUid:
            currentProfile.uid,

          createdByName:
            userName,

          createdAt:
            serverTimestamp()
        }
      );

    }


    currentProject =
      await loadProject();


    closeEditModal();


    await renderProject();

    await loadHistory();


  } catch (error) {

    console.error(
      "Project update error:",
      error
    );


    showFormError(
      "editProjectError",
      "The project could not be updated."
    );


  } finally {

    button.disabled = false;
    button.textContent =
      "Save Changes";

  }

}


/* =========================================================
   ADD SCOPE
========================================================= */

async function saveScope(
  event
) {

  event.preventDefault();


  const form =
    new FormData(
      event.currentTarget
    );


  const record = {

    organisationId:
      currentProject.organisationId,

    projectId:
      currentProjectId,

    scopeCode:
      cleanString(
        form.get("scopeCode")
      ),

    name:
      cleanString(
        form.get("name")
      ),

    status:
      cleanString(
        form.get("status")
      ) || "PLANNED",

    startDate:
      nullableString(
        form.get("startDate")
      ),

    targetFinishDate:
      nullableString(
        form.get("targetFinishDate")
      ),

    description:
      nullableString(
        form.get("description")
      ),

    createdByUid:
      currentProfile.uid,

    createdByName:
      currentProfile.displayName ||
      currentProfile.email ||
      "NORMEX User",

    createdAt:
      serverTimestamp(),

    updatedByUid:
      currentProfile.uid,

    updatedAt:
      serverTimestamp()

  };


  if (
    !record.scopeCode ||
    !record.name
  ) {
    showFormError(
      "scopeError",
      "Scope code and scope name are required."
    );

    return;
  }


  try {

    await addDoc(
      collection(
        db,
        "projects",
        currentProjectId,
        "scopes"
      ),
      record
    );


    await addDoc(
      collection(
        db,
        "projects",
        currentProjectId,
        "activity"
      ),
      {
        organisationId:
          currentProject.organisationId,

        projectId:
          currentProjectId,

        type:
          "PROJECT_SCOPE_CREATED",

        summary:
          `${record.scopeCode} · ${record.name}`,

        createdByUid:
          currentProfile.uid,

        createdByName:
          record.createdByName,

        createdAt:
          serverTimestamp()
      }
    );


    event.currentTarget.reset();


    closeModal(
      "scopeModal"
    );


    await loadScopes();

    await loadHistory();


  } catch (error) {

    console.error(
      "Scope creation error:",
      error
    );


    showFormError(
      "scopeError",
      "The scope could not be created."
    );

  }

}


/* =========================================================
   ADD COMMERCIAL RECORD
========================================================= */

async function saveCommercialRecord(
  event
) {

  event.preventDefault();


  const form =
    new FormData(
      event.currentTarget
    );


  const record = {

    organisationId:
      currentProject.organisationId,

    projectId:
      currentProjectId,

    type:
      cleanString(
        form.get("type")
      ),

    reference:
      cleanString(
        form.get("reference")
      ),

    description:
      cleanString(
        form.get("description")
      ),

    counterparty:
      nullableString(
        form.get("counterparty")
      ),

    value:
      nullableNumber(
        form.get("value")
      ),

    status:
      cleanString(
        form.get("status")
      ),

    recordDate:
      nullableString(
        form.get("recordDate")
      ),

    createdByUid:
      currentProfile.uid,

    createdByName:
      currentProfile.displayName ||
      currentProfile.email ||
      "NORMEX User",

    createdAt:
      serverTimestamp(),

    updatedByUid:
      currentProfile.uid,

    updatedAt:
      serverTimestamp()

  };


  if (
    !record.reference ||
    !record.description
  ) {

    showFormError(
      "commercialError",
      "Reference and description are required."
    );

    return;
  }


  try {

    await addDoc(
      collection(
        db,
        "projects",
        currentProjectId,
        "commercialRecords"
      ),
      record
    );


    await addDoc(
      collection(
        db,
        "projects",
        currentProjectId,
        "activity"
      ),
      {
        organisationId:
          currentProject.organisationId,

        projectId:
          currentProjectId,

        type:
          "COMMERCIAL_RECORD_CREATED",

        summary:
          `${record.reference} · ${record.description}`,

        createdByUid:
          currentProfile.uid,

        createdByName:
          record.createdByName,

        createdAt:
          serverTimestamp()
      }
    );


    event.currentTarget.reset();


    closeModal(
      "commercialModal"
    );


    await loadCommercialRecords();

    await loadHistory();


  } catch (error) {

    console.error(
      "Commercial record creation error:",
      error
    );


    showFormError(
      "commercialError",
      "The commercial record could not be created."
    );

  }

}


/* =========================================================
   CHANGE HISTORY
========================================================= */

function getChangedFields(
  previous,
  next
) {

  return Object
    .keys(next)
    .filter(
      (key) =>
        JSON.stringify(
          previous[key] ?? null
        ) !==
        JSON.stringify(
          next[key] ?? null
        )
    );

}


function buildChanges(
  previous,
  next,
  fields
) {

  const changes = {};


  fields.forEach(
    (field) => {

      changes[field] = {
        from:
          previous[field] ?? null,

        to:
          next[field] ?? null
      };

    }
  );


  return changes;
}


/* =========================================================
   HISTORY PRESENTATION
========================================================= */

function getHistoryTitle(
  record
) {

  const titles = {

    PROJECT_DETAILS_UPDATED:
      "Project details updated",

    PROJECT_PHASE_CHANGED:
      "Project phase changed",

    PROJECT_SCOPE_CREATED:
      "Scope added",

    COMMERCIAL_RECORD_CREATED:
      "Commercial record added",

    PROJECT_CREATED:
      "Project created"

  };


  return (
    titles[record.type] ||
    formatPosition(
      record.type
    )
  );

}


function getHistorySummary(
  record
) {

  if (
    record.type ===
    "PROJECT_PHASE_CHANGED"
  ) {

    return `${record.previousPhase || "Not set"} → ${record.newPhase || "Not set"}`;

  }


  if (
    Array.isArray(
      record.changedFields
    )
  ) {

    return record.changedFields
      .map(
        formatPosition
      )
      .join(", ");

  }


  return "";

}


/* =========================================================
   FORMATTERS
========================================================= */

function formatPosition(
  value
) {

  if (!value) {
    return "—";
  }


  return String(value)
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0)
          .toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}


function formatMoney(
  value,
  currency = "GBP"
) {

  const number =
    Number(value);


  if (!Number.isFinite(number)) {
    return "—";
  }


  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }
  ).format(number);
}


function formatDate(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    timestampToDate(value) ||
    new Date(
      `${value}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  ).format(date);
}


function timestampToDate(
  value
) {

  if (!value) {
    return null;
  }


  if (
    typeof value.toDate ===
    "function"
  ) {
    return value.toDate();
  }


  if (
    value instanceof Date
  ) {
    return value;
  }


  const parsed =
    new Date(value);


  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}


function formatShortDate(
  date
) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  ).format(date);
}


function formatFullDate(
  date
) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}


function normaliseDateInput(
  value
) {

  if (!value) {
    return "";
  }


  if (
    typeof value ===
    "string"
  ) {
    return value.slice(
      0,
      10
    );
  }


  const date =
    timestampToDate(value);


  if (!date) {
    return "";
  }


  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0")
  ].join("-");
}


function formatUserRole(
  user
) {

  if (!user) {
    return "";
  }


  if (
    Number(
      user.accessLevel
    ) >= 99
  ) {
    return "Platform Administration";
  }


  if (user.role) {
    return formatPosition(
      user.role
    );
  }


  return user.accessLevel
    ? `Level ${user.accessLevel}`
    : "";
}


function renderChip(
  value
) {

  const formatted =
    formatPosition(value);


  let className =
    "details-chip";


  if (
    [
      "LIVE",
      "ACCEPTED",
      "COMPLETE",
      "RETURNED"
    ].includes(value)
  ) {
    className +=
      " is-good";
  }


  if (
    [
      "PRE_START",
      "AWAITING_APPROVAL",
      "ON_HOLD"
    ].includes(value)
  ) {
    className +=
      " is-warning";
  }


  if (
    [
      "REJECTED"
    ].includes(value)
  ) {
    className +=
      " is-danger";
  }


  return `
    <span class="${className}">
      ${escapeHtml(formatted)}
    </span>
  `;
}


/* =========================================================
   FORM HELPERS
========================================================= */

function setInput(
  id,
  value
) {

  const element =
    getElement(id);

  if (!element) return;

  element.value =
    value ?? "";
}


function showFormError(
  id,
  message
) {

  const element =
    getElement(id);

  if (!element) return;


  element.textContent =
    message;

  element.hidden =
    false;
}


function closeModal(
  id
) {

  const modal =
    getElement(id);

  if (modal) {
    modal.hidden = true;
  }


  document.body.style.overflow =
    "";

}


function openModal(
  id
) {

  const modal =
    getElement(id);

  if (modal) {
    modal.hidden = false;
  }


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   HTML SAFETY
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
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
    "editProjectButton"
  )?.addEventListener(
    "click",
    openEditModal
  );


  getElement(
    "closeEditProjectModal"
  )?.addEventListener(
    "click",
    closeEditModal
  );


  getElement(
    "cancelEditProject"
  )?.addEventListener(
    "click",
    closeEditModal
  );


  getElement(
    "editProjectBackdrop"
  )?.addEventListener(
    "click",
    closeEditModal
  );


  getElement(
    "editProjectForm"
  )?.addEventListener(
    "submit",
    saveProject
  );


  getElement(
    "addScopeButton"
  )?.addEventListener(
    "click",
    () =>
      openModal(
        "scopeModal"
      )
  );


  getElement(
    "closeScopeModal"
  )?.addEventListener(
    "click",
    () =>
      closeModal(
        "scopeModal"
      )
  );


  getElement(
    "cancelScopeButton"
  )?.addEventListener(
    "click",
    () =>
      closeModal(
        "scopeModal"
      )
  );


  getElement(
    "scopeBackdrop"
  )?.addEventListener(
    "click",
    () =>
      closeModal(
        "scopeModal"
      )
  );


  getElement(
    "scopeForm"
  )?.addEventListener(
    "submit",
    saveScope
  );


  getElement(
    "addCommercialRecordButton"
  )?.addEventListener(
    "click",
    () =>
      openModal(
        "commercialModal"
      )
  );


  getElement(
    "closeCommercialModal"
  )?.addEventListener(
    "click",
    () =>
      closeModal(
        "commercialModal"
      )
  );


  getElement(
    "cancelCommercialButton"
  )?.addEventListener(
    "click",
    () =>
      closeModal(
        "commercialModal"
      )
  );


  getElement(
    "commercialBackdrop"
  )?.addEventListener(
    "click",
    () =>
      closeModal(
        "commercialModal"
      )
  );


  getElement(
    "commercialRecordForm"
  )?.addEventListener(
    "submit",
    saveCommercialRecord
  );

}


/* =========================================================
   INITIALISE
========================================================= */

async function initialiseDetails(
  profile
) {

  currentProfile =
    profile;


  currentProjectId =
    getProjectId();


  if (!currentProjectId) {
    return;
  }


  try {

    currentProject =
      await loadProject();


    if (!currentProject) {
      return;
    }


    renderProjectNav();


    await determineAccess();


    getElement(
      "editProjectButton"
    ).hidden =
      !editAllowed;


    getElement(
      "addScopeButton"
    ).hidden =
      !editAllowed;


    getElement(
      "addCommercialRecordButton"
    ).hidden =
      !commercialAllowed;


    await renderProject();

    await Promise.all([
      loadScopes(),
      loadCommercialRecords(),
      loadHistory()
    ]);


  } catch (error) {

    console.error(
      "Project Details initialisation error:",
      error
    );

  }

}


/* =========================================================
   START
========================================================= */

bindEvents();
waitForWorkspace();