import {
  db
} from "/js/firebase.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  renderProjectNav
} from "/modules/contractor/projects/shared/project-nav.js";


let currentProfile = null;

let currentProject = null;


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
  const params =
    new URLSearchParams(
      window.location.search
    );

  return params.get("id");
}


/* =========================================================
   WORKSPACE
========================================================= */

function waitForWorkspace() {
  if (
    window.NORMEX_CURRENT_USER
  ) {
    initialiseProject(
      window.NORMEX_CURRENT_USER
    );

    return;
  }


  window.addEventListener(
    "normex:workspace-ready",
    (event) => {
      initialiseProject(
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

async function loadProject(
  projectId
) {
  const reference =
    doc(
      db,
      "projects",
      projectId
    );


  const snapshot =
    await getDoc(reference);


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
   VALIDATE PROJECT
========================================================= */

function projectBelongsToUser(
  project,
  profile
) {
  if (
    Number(
      profile.accessLevel
    ) >= 99
  ) {
    return true;
  }


  return (
    project.organisationId ===
    profile.organisationId
  );
}


/* =========================================================
   RENDER PROJECT
========================================================= */

function renderProject(
  project
) {
  document.title =
    `${project.name || "Project"} | Colemans | NORMEX`;


  setText(
    "projectSubnavName",
    project.name ||
      "Project"
  );


  setText(
    "projectName",
    project.name ||
      "Untitled Project"
  );


  setText(
    "projectMeta",
    getProjectMeta(project)
  );


  setText(
    "projectCode",
    project.projectCode ||
      "—"
  );


  setText(
    "projectPhase",
    project.currentPhase ||
      "Not set"
  );


  setText(
    "projectPhaseLarge",
    project.currentPhase ||
      "Not set"
  );


  setText(
    "projectManager",
    project.projectManagerName ||
      "Not assigned"
  );


  setText(
    "projectFinish",
    formatDate(
      project.targetFinishDate
    )
  );


  setText(
    "projectReadiness",
    formatReadiness(project)
  );


  setText(
    "projectProgramme",
    formatPosition(
      project.programmeStatus
        ?.position
    )
  );


  setText(
    "projectAssurance",
    formatAssurance(project)
  );


  setText(
    "projectCommercial",
    formatPosition(
      project.commercialStatus
        ?.position
    )
  );


  updateStatus(
    project.status,
    project.archived
  );


  updateAttention(
    project
  );


  updateProjectLinks(
    project.id
  );
}


/* =========================================================
   PROJECT META
========================================================= */

function getProjectMeta(
  project
) {
  const parts = [
    project.clientName,
    project.siteName
  ]
    .filter(Boolean);


  if (!parts.length) {
    return "Project details not yet complete.";
  }


  return parts.join(
    " · "
  );
}


/* =========================================================
   STATUS
========================================================= */

function updateStatus(
  status,
  archived
) {
  const element =
    getElement(
      "projectStatus"
    );


  if (!element) return;


  element.className =
    "project-hero__status";


  if (archived === true) {
    element.textContent =
      "Archived";

    return;
  }


  const states = {
    LIVE: {
      label: "Live",
      className:
        "is-live"
    },

    PRE_CONSTRUCTION: {
      label:
        "Pre-Construction",
      className:
        "is-pre"
    },

    ON_HOLD: {
      label:
        "On Hold",
      className:
        "is-hold"
    },

    COMPLETE: {
      label:
        "Complete",
      className:
        "is-complete"
    }
  };


  const state =
    states[status] || {
      label:
        formatPosition(
          status
        ),

      className: ""
    };


  element.textContent =
    state.label;


  if (state.className) {
    element.classList.add(
      state.className
    );
  }
}


/* =========================================================
   READINESS
========================================================= */

function formatReadiness(
  project
) {
  const value =
    Number(
      project.readinessStatus
        ?.percentage
    );


  if (!Number.isFinite(value)) {
    return "—";
  }


  return (
    `${Math.max(
      0,
      Math.min(
        100,
        Math.round(value)
      )
    )}%`
  );
}


/* =========================================================
   ASSURANCE
========================================================= */

function formatAssurance(
  project
) {
  const actions =
    Number(
      project.assuranceStatus
        ?.openActions
    );


  if (
    Number.isFinite(actions)
  ) {
    return (
      `${actions} ${
        actions === 1
          ? "Action"
          : "Actions"
      }`
    );
  }


  return formatPosition(
    project.assuranceStatus
      ?.position
  );
}


/* =========================================================
   ATTENTION
========================================================= */

function updateAttention(
  project
) {
  let count = 0;


  const assuranceActions =
    Number(
      project.assuranceStatus
        ?.openActions
    );


  if (
    Number.isFinite(
      assuranceActions
    )
  ) {
    count +=
      assuranceActions;
  }


  if (
    project.programmeStatus
      ?.position === "AT_RISK"
  ) {
    count += 1;
  }


  if (
    project.commercialStatus
      ?.position === "AT_RISK"
  ) {
    count += 1;
  }


  if (
    project.readinessStatus
      ?.blocked === true
  ) {
    count += 1;
  }


  setText(
    "projectAttentionCount",
    String(count)
  );


  const state =
    getElement(
      "projectAttentionState"
    );


  if (
    !state ||
    count === 0
  ) {
    return;
  }


  state.innerHTML = `
    <div class="project-empty-state__mark">
      !
    </div>

    <strong>
      ${count} ${
        count === 1
          ? "item requires"
          : "items require"
      } attention
    </strong>

    <p>
      Detailed project actions will appear here as the assurance and programme modules are connected.
    </p>
  `;
}


/* =========================================================
   PROJECT LINKS
========================================================= */

function updateProjectLinks(
  projectId
) {
  document
    .querySelectorAll(
      "[data-project-section]"
    )
    .forEach(
      (link) => {

        const section =
          link.dataset
            .projectSection;


        link.href =
          `/modules/contractor/projects/project/${section}/?id=${encodeURIComponent(
            projectId
          )}`;
      }
    );
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


  const states = {
    POSITIVE:
      "Positive",

    CONTROLLED:
      "Controlled",

    ON_PLAN:
      "On Plan",

    AT_RISK:
      "At Risk",

    ATTENTION:
      "Attention",

    BLOCKED:
      "Blocked",

    COMPLETE:
      "Complete",

    GOOD:
      "Good"
  };


  if (states[value]) {
    return states[value];
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


function formatDate(
  value
) {
  if (!value) {
    return "Not set";
  }


  const date =
    new Date(
      `${value}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
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


/* =========================================================
   ERROR
========================================================= */

function showProjectError(
  message
) {
  const main =
    document.querySelector(
      ".workspace-main .workspace-container"
    );


  if (!main) return;


  main.innerHTML = `
    <section class="project-load-error">

      <strong>
        Project unavailable
      </strong>

      <p>
        ${message}
      </p>

      <a href="/modules/contractor/projects/">
        Return to Projects
      </a>

    </section>
  `;
}


/* =========================================================
   INITIALISE
========================================================= */

async function initialiseProject(
  profile
) {
  currentProfile =
    profile;


  const projectId =
    getProjectId();


  if (!projectId) {
    showProjectError(
      "No project was selected."
    );

    return;
  }


  try {
    const project =
      await loadProject(
        projectId
      );


    if (!project) {
      showProjectError(
        "The requested project could not be found."
      );

      return;
    }


    if (
      !projectBelongsToUser(
        project,
        profile
      )
    ) {
      showProjectError(
        "You do not have access to this project."
      );

      return;
    }


    currentProject =
      project;


    renderProjectNav();

    renderProject(
      project
    );


    window.NORMEX_CURRENT_PROJECT =
      project;


    window.dispatchEvent(
      new CustomEvent(
        "normex:project-ready",
        {
          detail: {
            project
          }
        }
      )
    );


  } catch (error) {
    console.error(
      "NORMEX project workspace error:",
      error
    );


    showProjectError(
      "The project could not be loaded."
    );
  }
}


waitForWorkspace();