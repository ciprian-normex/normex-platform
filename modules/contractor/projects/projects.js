import {
  db
} from "/js/firebase.js";

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


let currentProfile = null;

let allProjects = [];

let activePortfolioFilter = null;


/* =========================================================
   ELEMENT HELPERS
========================================================= */

function getElement(id) {
  return document.getElementById(id);
}


function setText(id, value) {
  const element = getElement(id);

  if (!element) return;

  element.textContent = value;
}


/* =========================================================
   WORKSPACE READY
========================================================= */

function waitForWorkspace() {
  if (window.NORMEX_CURRENT_USER) {
    initialiseProjects(
      window.NORMEX_CURRENT_USER
    );

    return;
  }

  window.addEventListener(
    "normex:workspace-ready",
    (event) => {
      initialiseProjects(
        event.detail.profile
      );
    },
    {
      once: true
    }
  );
}


/* =========================================================
   ACCESS
========================================================= */

function canCreateProject(profile) {
  const level =
    Number(profile?.accessLevel || 0);

  return (
    level >= 3 ||
    level >= 99
  );
}


/* =========================================================
   PROJECT LOAD
========================================================= */

async function loadProjects() {
  const organisationId =
    currentProfile.organisationId;

  const projectsQuery = query(
    collection(
      db,
      "projects"
    ),
    where(
      "organisationId",
      "==",
      organisationId
    )
  );

  const snapshot =
    await getDocs(projectsQuery);

  allProjects =
    snapshot.docs
      .map((documentSnapshot) => {
        return {
          id:
            documentSnapshot.id,

          ...documentSnapshot.data()
        };
      })
      .sort(sortProjects);

  updatePortfolioKPIs();

  applyFilters();
}


/* =========================================================
   SORTING
========================================================= */

function sortProjects(a, b) {
  const priority = {
    LIVE: 1,
    PRE_CONSTRUCTION: 2,
    ON_HOLD: 3,
    COMPLETE: 4,
    ARCHIVED: 5
  };

  const aPriority =
    priority[a.status] || 99;

  const bPriority =
    priority[b.status] || 99;

  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }

  return String(a.name || "")
    .localeCompare(
      String(b.name || "")
    );
}


/* =========================================================
   PORTFOLIO KPIs
========================================================= */

function updatePortfolioKPIs() {
  const activeProjects =
    allProjects.filter(
      (project) =>
        project.archived !== true
    );

  const live =
    activeProjects.filter(
      (project) =>
        project.status === "LIVE"
    ).length;

  const preConstruction =
    activeProjects.filter(
      (project) =>
        project.status ===
        "PRE_CONSTRUCTION"
    ).length;

  const requiringAttention =
    activeProjects.filter(
      projectNeedsAttention
    ).length;

  const readinessValues =
    activeProjects
      .map((project) =>
        Number(
          project.readinessStatus?.percentage
        )
      )
      .filter((value) =>
        Number.isFinite(value)
      );

  const averageReadiness =
    readinessValues.length
      ? Math.round(
          readinessValues.reduce(
            (total, value) =>
              total + value,
            0
          ) /
          readinessValues.length
        )
      : null;


  setText(
    "kpiLiveProjects",
    String(live)
  );

  setText(
    "kpiPreConstruction",
    String(preConstruction)
  );

  setText(
    "kpiAttention",
    String(requiringAttention)
  );

  setText(
    "kpiReadiness",
    averageReadiness === null
      ? "—"
      : `${averageReadiness}%`
  );

  setText(
    "kpiPortfolioStatus",
    getPortfolioPosition(
      activeProjects
    )
  );
}


function projectNeedsAttention(project) {
  if (
    project.assuranceStatus
      ?.requiresAttention === true
  ) {
    return true;
  }

  if (
    project.programmeStatus
      ?.position === "AT_RISK"
  ) {
    return true;
  }

  if (
    project.commercialStatus
      ?.position === "AT_RISK"
  ) {
    return true;
  }

  if (
    project.readinessStatus
      ?.blocked === true
  ) {
    return true;
  }

  return false;
}


function getPortfolioPosition(projects) {
  if (!projects.length) {
    return "—";
  }

  const attentionCount =
    projects.filter(
      projectNeedsAttention
    ).length;

  if (attentionCount === 0) {
    return "Controlled";
  }

  if (
    attentionCount <=
    Math.max(
      1,
      Math.floor(
        projects.length * 0.25
      )
    )
  ) {
    return "Watch";
  }

  return "Attention";
}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {
  const search =
    getElement("projectSearch")
      ?.value
      .trim()
      .toLowerCase() || "";

  const status =
    getElement(
      "projectStatusFilter"
    )?.value || "ALL";


const filtered =
  allProjects.filter(
    (project) => {

      const matchesStatus =
        status === "ALL" ||
        getProjectFilterStatus(
          project
        ) === status;


      const matchesPortfolio =
        projectMatchesPortfolioFilter(
          project
        );


        const searchable = [
          project.name,
          project.projectCode,
          project.clientName,
          project.siteName,
          project.currentPhase
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const matchesSearch =
          !search ||
          searchable.includes(search);


        return (
  matchesStatus &&
  matchesSearch &&
  matchesPortfolio
);
      }
    );


  renderProjects(filtered);
}


function getProjectFilterStatus(
  project
) {
  if (project.archived === true) {
    return "ARCHIVED";
  }

  return project.status || "";
}



/* =========================================================
   PORTFOLIO CARD FILTERS
========================================================= */

function getPortfolioFilterCards() {
  return {
    LIVE:
      getElement("kpiLiveProjects")
        ?.closest(".projects-kpi"),

    PRE_CONSTRUCTION:
      getElement("kpiPreConstruction")
        ?.closest(".projects-kpi"),

    ATTENTION:
      getElement("kpiAttention")
        ?.closest(".projects-kpi"),

    READINESS:
      getElement("kpiReadiness")
        ?.closest(".projects-kpi"),

    PORTFOLIO:
      getElement("kpiPortfolioStatus")
        ?.closest(".projects-kpi")
  };
}


function projectMatchesPortfolioFilter(
  project
) {
  if (!activePortfolioFilter) {
    return true;
  }


  if (
    activePortfolioFilter === "LIVE"
  ) {
    return (
      project.archived !== true &&
      project.status === "LIVE"
    );
  }


  if (
    activePortfolioFilter ===
    "PRE_CONSTRUCTION"
  ) {
    return (
      project.archived !== true &&
      project.status ===
        "PRE_CONSTRUCTION"
    );
  }


  if (
    activePortfolioFilter ===
    "ATTENTION"
  ) {
    return (
      project.archived !== true &&
      projectNeedsAttention(project)
    );
  }


  if (
    activePortfolioFilter ===
    "READINESS"
  ) {
    const readiness =
      Number(
        project.readinessStatus
          ?.percentage
      );

    return (
      project.archived !== true &&
      Number.isFinite(readiness)
    );
  }


  if (
    activePortfolioFilter ===
    "PORTFOLIO"
  ) {
    return (
      project.archived !== true
    );
  }


  return true;
}


function setPortfolioFilter(filterId) {
  if (
    activePortfolioFilter === filterId
  ) {
    activePortfolioFilter = null;
  } else {
    activePortfolioFilter = filterId;
  }


  updatePortfolioFilterState();

  applyFilters();
}


function updatePortfolioFilterState() {
  const cards =
    getPortfolioFilterCards();


  Object.entries(cards).forEach(
    ([filterId, card]) => {
      if (!card) return;


      const selected =
        activePortfolioFilter ===
        filterId;


      card.classList.toggle(
        "is-filter-active",
        selected
      );


      card.setAttribute(
        "aria-pressed",
        selected
          ? "true"
          : "false"
      );
    }
  );
}


function bindPortfolioFilters() {
  const cards =
    getPortfolioFilterCards();


  Object.entries(cards).forEach(
    ([filterId, card]) => {
      if (!card) return;


      card.setAttribute(
        "role",
        "button"
      );

      card.setAttribute(
        "tabindex",
        "0"
      );

      card.setAttribute(
        "aria-pressed",
        "false"
      );


      card.addEventListener(
        "click",
        () => {
          setPortfolioFilter(
            filterId
          );
        }
      );


      card.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();

            setPortfolioFilter(
              filterId
            );
          }
        }
      );
    }
  );
}

/* =========================================================
   RENDER
========================================================= */

function renderProjects(projects) {
  const loading =
    getElement("projectsLoading");

  const empty =
    getElement("projectsEmpty");

  const noResults =
    getElement("projectsNoResults");

  const grid =
    getElement("projectCardGrid");


  if (loading) {
    loading.hidden = true;
  }


  setText(
    "projectResultCount",
    `${projects.length} ${
      projects.length === 1
        ? "project"
        : "projects"
    }`
  );


  if (!allProjects.length) {
    if (grid) {
      grid.hidden = true;
      grid.innerHTML = "";
    }

    if (empty) {
      empty.hidden = false;
    }

    if (noResults) {
      noResults.hidden = true;
    }

    return;
  }


  if (!projects.length) {
    if (grid) {
      grid.hidden = true;
      grid.innerHTML = "";
    }

    if (empty) {
      empty.hidden = true;
    }

    if (noResults) {
      noResults.hidden = false;
    }

    return;
  }


  if (empty) {
    empty.hidden = true;
  }

  if (noResults) {
    noResults.hidden = true;
  }


  grid.innerHTML = "";

  projects.forEach((project) => {
    grid.appendChild(
      createProjectCard(project)
    );
  });

  grid.hidden = false;
}


/* =========================================================
   PROJECT CARD
========================================================= */

function createProjectCard(project) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "project-card";


  const readiness =
    getReadinessPercentage(
      project
    );


  const clientSite =
    [
      project.clientName,
      project.siteName
    ]
      .filter(Boolean)
      .join(" · ") ||
    "Project details not yet complete";


  const status =
    getStatusPresentation(
      project
    );


  const manager =
    project.projectManagerName ||
    "Not assigned";


  const phase =
    project.currentPhase ||
    "Not set";


  const programme =
    formatPosition(
      project.programmeStatus
        ?.position
    );


  const assurance =
    getAssurancePosition(
      project
    );


  const commercial =
    formatPosition(
      project.commercialStatus
        ?.position
    );


  card.innerHTML = `
    <div class="project-card__readiness-line">
      <div
        class="project-card__readiness-fill"
        style="width:${readiness ?? 0}%"
      ></div>
    </div>

    <div class="project-card__body">

      <header class="project-card__header">

        <div class="project-card__identity">

          <span class="project-card__code">
            ${escapeHtml(
              project.projectCode ||
              "PROJECT"
            )}
          </span>

          <h4 class="project-card__name">
            ${escapeHtml(
              project.name ||
              "Untitled Project"
            )}
          </h4>

          <p class="project-card__meta">
            ${escapeHtml(clientSite)}
          </p>

        </div>

        <span
          class="
            project-status
            ${status.className}
          "
        >
          ${status.label}
        </span>

      </header>


      <div class="project-card__position">

        ${createPositionItem(
          "Readiness",
          readiness === null
            ? "—"
            : `${readiness}%`
        )}

        ${createPositionItem(
          "Programme",
          programme
        )}

        ${createPositionItem(
          "Assurance",
          assurance
        )}

        ${createPositionItem(
          "Commercial",
          commercial
        )}

      </div>


      <footer class="project-card__footer">

        <div class="project-card__detail">

          <span>
            Project Manager
          </span>

          <strong>
            ${escapeHtml(manager)}
          </strong>

        </div>


        <div class="project-card__detail">

          <span>
            Current Phase
          </span>

          <strong>
            ${escapeHtml(phase)}
          </strong>

        </div>


        <a
          class="project-card__open"
          href="/modules/contractor/projects/project/?id=${encodeURIComponent(
            project.id
          )}"
        >
          Open Project →
        </a>

      </footer>

    </div>
  `;


  return card;
}


function createPositionItem(
  label,
  value
) {
  return `
    <div class="project-position-item">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value)}
      </strong>

    </div>
  `;
}


/* =========================================================
   PRESENTATION HELPERS
========================================================= */

function getReadinessPercentage(
  project
) {
  const value =
    Number(
      project.readinessStatus
        ?.percentage
    );

  return Number.isFinite(value)
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(value)
        )
      )
    : null;
}


function getAssurancePosition(
  project
) {
  const openActions =
    Number(
      project.assuranceStatus
        ?.openActions
    );

  if (
    Number.isFinite(openActions)
  ) {
    return `${openActions} ${
      openActions === 1
        ? "Action"
        : "Actions"
    }`;
  }

  return formatPosition(
    project.assuranceStatus
      ?.position
  );
}


function formatPosition(value) {
  if (!value) {
    return "—";
  }

  const map = {
    POSITIVE: "Positive",
    CONTROLLED: "Controlled",
    ON_PLAN: "On Plan",
    AT_RISK: "At Risk",
    ATTENTION: "Attention",
    BLOCKED: "Blocked",
    COMPLETE: "Complete",
    GOOD: "Good"
  };

  return (
    map[value] ||
    value
      .toLowerCase()
      .split("_")
      .map(
        (part) =>
          part.charAt(0)
            .toUpperCase() +
          part.slice(1)
      )
      .join(" ")
  );
}


function getStatusPresentation(
  project
) {
  if (project.archived === true) {
    return {
      label: "Archived",
      className: ""
    };
  }

  const status =
    project.status;

  const map = {
    LIVE: {
      label: "Live",
      className:
        "project-status--live"
    },

    PRE_CONSTRUCTION: {
      label: "Pre-Construction",
      className:
        "project-status--pre"
    },

    ON_HOLD: {
      label: "On Hold",
      className:
        "project-status--hold"
    },

    COMPLETE: {
      label: "Complete",
      className:
        "project-status--complete"
    }
  };

  return (
    map[status] || {
      label:
        formatPosition(status),
      className: ""
    }
  );
}


/* =========================================================
   MODAL
========================================================= */

function openProjectModal() {
  const modal =
    getElement("newProjectModal");

  if (!modal) return;

  modal.hidden = false;

  document.body.style.overflow =
    "hidden";

  window.setTimeout(
    () => {
      getElement(
        "projectName"
      )?.focus();
    },
    50
  );
}


function closeProjectModal() {
  const modal =
    getElement("newProjectModal");

  if (!modal) return;

  modal.hidden = true;

  document.body.style.overflow = "";

  clearProjectFormError();
}


/* =========================================================
   CREATE PROJECT
========================================================= */

async function createProject(event) {
  event.preventDefault();

  clearProjectFormError();


  const form =
    event.currentTarget;

  const submitButton =
    getElement(
      "saveProjectButton"
    );


  const formData =
    new FormData(form);


  const roles =
    formData
      .getAll(
        "rolesOnProject"
      )
      .map(String);


  const name =
    String(
      formData.get("name") || ""
    ).trim();


  const projectCode =
    String(
      formData.get(
        "projectCode"
      ) || ""
    ).trim();


  if (!name || !projectCode) {
    showProjectFormError(
      "Project name and project code are required."
    );

    return;
  }


  if (!roles.length) {
    showProjectFormError(
      "Select at least one Colemans role on the project."
    );

    return;
  }


  submitButton.disabled = true;
  submitButton.textContent =
    "Creating...";


  try {
    const projectDocument = {
      organisationId:
        currentProfile.organisationId,

      organisationName:
        currentProfile.organisationName ||
        "Colemans",

      projectCode,

      name,

      description:
        normaliseOptionalString(
          formData.get(
            "description"
          )
        ),

      projectType:
        "CONSTRUCTION",

      status:
        String(
          formData.get("status") ||
          "PRE_CONSTRUCTION"
        ),

      clientOrganisationId:
        null,

      clientName:
        normaliseOptionalString(
          formData.get(
            "clientName"
          )
        ),

      primarySiteId:
        null,

      siteName:
        normaliseOptionalString(
          formData.get(
            "siteName"
          )
        ),

      rolesOnProject:
        roles,

      startDate:
        normaliseDateValue(
          formData.get(
            "startDate"
          )
        ),

      targetFinishDate:
        normaliseDateValue(
          formData.get(
            "targetFinishDate"
          )
        ),

      actualFinishDate:
        null,

      currentPhase:
        normaliseOptionalString(
          formData.get(
            "currentPhase"
          )
        ),

      projectManagerUid:
        null,

      projectManagerName:
        null,

      projectDirectorUid:
        null,

      readinessStatus: {
        percentage: null,
        blocked: false
      },

      programmeStatus: {
        position: null
      },

      assuranceStatus: {
        position: null,
        openActions: 0,
        requiresAttention: false
      },

      commercialStatus: {
        position: null
      },

      archived:
        false,

      archivedAt:
        null,

      archivedByUid:
        null,

      createdByUid:
        currentProfile.uid,

      createdAt:
        serverTimestamp(),

      updatedByUid:
        currentProfile.uid,

      updatedAt:
        serverTimestamp()
    };


    await addDoc(
      collection(
        db,
        "projects"
      ),
      projectDocument
    );


    form.reset();

    const contractorCheckbox =
      form.querySelector(
        'input[value="CONTRACTOR"]'
      );

    if (contractorCheckbox) {
      contractorCheckbox.checked =
        true;
    }


    closeProjectModal();

    await loadProjects();


  } catch (error) {
    console.error(
      "NORMEX project creation error:",
      error
    );

    showProjectFormError(
      "The project could not be created. Please try again."
    );

  } finally {
    submitButton.disabled = false;

    submitButton.textContent =
      "Create Project";
  }
}


function normaliseOptionalString(
  value
) {
  const cleaned =
    String(value || "")
      .trim();

  return cleaned || null;
}


function normaliseDateValue(
  value
) {
  const cleaned =
    String(value || "")
      .trim();

  return cleaned || null;
}


function showProjectFormError(
  message
) {
  const element =
    getElement(
      "newProjectError"
    );

  if (!element) return;

  element.textContent =
    message;

  element.hidden =
    false;
}


function clearProjectFormError() {
  const element =
    getElement(
      "newProjectError"
    );

  if (!element) return;

  element.textContent = "";
  element.hidden = true;
}


/* =========================================================
   HTML SAFETY
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   EVENTS
========================================================= */

function bindProjectsEvents() {
  getElement(
    "projectSearch"
  )?.addEventListener(
    "input",
    applyFilters
  );


  getElement(
    "projectStatusFilter"
  )?.addEventListener(
    "change",
    applyFilters
  );


 getElement(
  "clearProjectFilters"
)?.addEventListener(
  "click",
  () => {
    getElement(
      "projectSearch"
    ).value = "";

    getElement(
      "projectStatusFilter"
    ).value = "ALL";

    activePortfolioFilter = null;

    updatePortfolioFilterState();

    applyFilters();
  }
);
  


  getElement(
    "newProjectButton"
  )?.addEventListener(
    "click",
    openProjectModal
  );


  getElement(
    "closeProjectModal"
  )?.addEventListener(
    "click",
    closeProjectModal
  );


  getElement(
    "cancelProjectButton"
  )?.addEventListener(
    "click",
    closeProjectModal
  );


  getElement(
    "newProjectBackdrop"
  )?.addEventListener(
    "click",
    closeProjectModal
  );


  getElement(
    "newProjectForm"
  )?.addEventListener(
    "submit",
    createProject
  );


  window.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !getElement(
          "newProjectModal"
        )?.hidden
      ) {
        closeProjectModal();
      }
    }
  );
}


/* =========================================================
   INITIALISE
========================================================= */

async function initialiseProjects(
  profile
) {
  currentProfile = profile;


  const newProjectButton =
    getElement(
      "newProjectButton"
    );


  if (
    newProjectButton &&
    canCreateProject(profile)
  ) {
    newProjectButton.hidden =
      false;
  }


  try {
    await loadProjects();
  } catch (error) {
    console.error(
      "NORMEX project load error:",
      error
    );

    const loading =
      getElement(
        "projectsLoading"
      );

    if (loading) {
      loading.innerHTML = `
        <div class="projects-state__mark">
          !
        </div>

        <strong>
          Projects could not be loaded
        </strong>

        <p>
          Check the project access rules and try again.
        </p>
      `;
    }
  }
}


bindProjectsEvents();
waitForWorkspace();
waitForWorkspace();