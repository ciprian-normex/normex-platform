/* =========================================================
   NORMEX PEOPLE
   PERSON WORKSPACE

   UI SKELETON ONLY

   No Firestore integration in this version.
========================================================= */


const PERSON_TABS =
  new Set([
    "overview",
    "profile",
    "qualifications",
    "inductions"
  ]);


let activePersonTab =
  "overview";


let displayedWeekOffset =
  0;


/* =========================================================
   HELPERS
========================================================= */

function getElement(
  id
) {

  return document.getElementById(
    id
  );

}


function getPersonIdFromUrl() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  return (
    params.get(
      "personId"
    ) ||
    params.get(
      "id"
    ) ||
    ""
  ).trim();

}


function getInitialTab() {

  const value =
    window.location.hash
      .replace(
        "#",
        ""
      )
      .trim()
      .toLowerCase();


  if (
    PERSON_TABS.has(
      value
    )
  ) {

    return value;

  }


  return "overview";

}


/* =========================================================
   PERSON SUBMENU
========================================================= */

function setActivePersonTab(
  tabName,
  {
    updateHash =
      true
  } = {}
) {

  if (
    !PERSON_TABS.has(
      tabName
    )
  ) {

    return;

  }


  activePersonTab =
    tabName;


  document.querySelectorAll(
    "[data-person-tab]"
  ).forEach(
    (
      button
    ) => {

      const selected =
        button.dataset.personTab ===
        tabName;


      button.classList.toggle(
        "is-active",
        selected
      );


      button.setAttribute(
        "aria-selected",
        String(
          selected
        )
      );

    }
  );


  document.querySelectorAll(
    "[data-person-panel]"
  ).forEach(
    (
      panel
    ) => {

      const selected =
        panel.dataset.personPanel ===
        tabName;


      panel.hidden =
        !selected;


      panel.classList.toggle(
        "is-active",
        selected
      );

    }
  );


  if (
    updateHash
  ) {

    history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${tabName}`
    );

  }

}


function bindPersonTabs() {

  document.querySelectorAll(
    "[data-person-tab]"
  ).forEach(
    (
      button
    ) => {

      button.addEventListener(
        "click",
        () => {

          setActivePersonTab(
            button.dataset.personTab
          );

        }
      );

    }
  );


  document.querySelectorAll(
    "[data-jump-tab]"
  ).forEach(
    (
      button
    ) => {

      button.addEventListener(
        "click",
        () => {

          setActivePersonTab(
            button.dataset.jumpTab
          );

        }
      );

    }
  );


  window.addEventListener(
    "hashchange",
    () => {

      setActivePersonTab(
        getInitialTab(),
        {
          updateHash:
            false
        }
      );

    }
  );

}


/* =========================================================
   ROTA WEEK NAVIGATION
========================================================= */

function changeDisplayedWeek(
  offset
) {

  displayedWeekOffset +=
    offset;


  updateWeekLabel();


  /*
   * Codex integration pass:
   *
   * Load / derive the person's published rota for the
   * selected week and render Monday-Sunday.
   *
   * Do not expose unpublished management draft rota here.
   */

}


function resetDisplayedWeek() {

  displayedWeekOffset =
    0;


  updateWeekLabel();

}


function updateWeekLabel() {

  const label =
    getElement(
      "personRotaWeekLabel"
    );


  if (
    !label
  ) {

    return;

  }


  if (
    displayedWeekOffset ===
    0
  ) {

    label.textContent =
      "Current week";

    return;

  }


  if (
    displayedWeekOffset ===
    -1
  ) {

    label.textContent =
      "Previous week";

    return;

  }


  if (
    displayedWeekOffset ===
    1
  ) {

    label.textContent =
      "Next week";

    return;

  }


  label.textContent =
    displayedWeekOffset < 0
      ? `${Math.abs(displayedWeekOffset)} weeks ago`
      : `${displayedWeekOffset} weeks ahead`;

}


function bindRotaControls() {

  getElement(
    "personPreviousWeekButton"
  )?.addEventListener(
    "click",
    () => {

      changeDisplayedWeek(
        -1
      );

    }
  );


  getElement(
    "personCurrentWeekButton"
  )?.addEventListener(
    "click",
    () => {

      resetDisplayedWeek();

    }
  );


  getElement(
    "personNextWeekButton"
  )?.addEventListener(
    "click",
    () => {

      changeDisplayedWeek(
        1
      );

    }
  );

}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function bindPageNavigation() {

  getElement(
    "personBackButton"
  )?.addEventListener(
    "click",
    () => {

      if (
        window.history.length >
        1
      ) {

        window.history.back();

        return;

      }


      window.location.href =
        "/modules/contractor/people/";

    }
  );


  getElement(
    "inductionOpenTrackerButton"
  )?.addEventListener(
    "click",
    () => {

      window.location.href =
        "/modules/contractor/people/inductions/tracker/";

    }
  );

}


/* =========================================================
   WORKSPACE READY
========================================================= */

function handleWorkspaceReady() {

  const actor =
    window.NORMEX_CURRENT_USER;


  const personId =
    getPersonIdFromUrl();


  const status =
    getElement(
      "personSystemStatus"
    );


  if (
    !personId
  ) {

    if (
      status
    ) {

      status.textContent =
        "No person selected";

    }


    return;

  }


  if (
    status
  ) {

    status.textContent =
      "Person integration pending";

  }


  /*
   * CODEX INTEGRATION PASS
   * =======================================================
   *
   * Resolve and load the canonical person using personId.
   *
   * Then load / derive:
   *
   * PERSON HEADER
   * - name
   * - employment type
   * - active/inactive state
   * - primary trade
   * - position
   *
   * READINESS
   * - core induction state
   * - current approved qualifications
   * - training position
   * - published rota position
   * - overall professional readiness
   *
   * ROTA
   * - published weekly rota only
   * - current, past and future weeks
   * - Monday-Sunday
   * - project / holiday / unavailable
   *
   * NEEDS ATTENTION
   * - genuine actions only
   * - default horizon: 30 days
   * - expiring qualifications/cards
   * - induction expiry
   * - pending evidence/review
   * - due training
   *
   * UPCOMING
   * - future rota
   * - future expiry
   * - planned training
   * - induction dates where applicable
   *
   * PROFILE
   * - normal operational profile
   * - restricted personal fields only where authorised
   *
   * QUALIFICATIONS & TRAINING
   * - qualifications
   * - cards
   * - machinery tickets
   * - competence records
   * - completed/planned training
   *
   * INDUCTIONS
   * - core company induction first
   * - additional/site/project inductions afterwards
   *
   * Do not recreate account authority management here.
   * Do not expose private data without permission.
   * Do not display draft rota to the worker/person view.
   */


  console.info(
    "[NORMEX People] Person workspace ready",
    {
      personId,
      actorUid:
        actor?.uid ||
        null
    }
  );

}


/* =========================================================
   INITIALISE
========================================================= */

function initialisePersonWorkspace() {

  bindPersonTabs();

  bindRotaControls();

  bindPageNavigation();


  setActivePersonTab(
    getInitialTab(),
    {
      updateHash:
        false
    }
  );


  updateWeekLabel();


  if (
    window.NORMEX_CURRENT_USER
  ) {

    handleWorkspaceReady();

  } else {

    window.addEventListener(
      "normex:workspace-ready",
      handleWorkspaceReady,
      {
        once:
          true
      }
    );

  }

}


initialisePersonWorkspace();