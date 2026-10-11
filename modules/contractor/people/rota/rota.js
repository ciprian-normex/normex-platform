/* =========================================================
   NORMEX PEOPLE
   WEEKLY ROTA CONTROLLER
========================================================= */

import {
  ROTA_POSITION_TYPES,
  getRotaState,
  replaceRotaState,
  setWeekStart,
  movePersonToPosition,
  removePersonFromDate,
  discardDraftChanges,
  markPublished
} from "./rota-state.js";


import {
  loadRotaWorkspace,
  publishRota,
  loadPreviousPublishedWeek
} from "./rota-data.js";


import {
  renderDayHeaders,
  renderPeopleList,
  renderBoard,
  renderBoardSummary,
  renderRotaStatus,
  renderTradeOptions,
  formatWeekRange,
  toDateKey
} from "./rota-ui.js";


let actor =
  null;


/* =========================================================
   INITIALISE
========================================================= */

function initialiseRota() {

  bindControls();


  if (
    window.NORMEX_CURRENT_USER
  ) {

    handleWorkspaceReady();

    return;

  }


  window.addEventListener(
    "normex:workspace-ready",
    handleWorkspaceReady,
    {
      once: true
    }
  );

}


/* =========================================================
   WORKSPACE READY
========================================================= */

async function handleWorkspaceReady() {

  actor =
    window.NORMEX_CURRENT_USER;


  setWeekStart(
    getMonday(
      new Date()
    )
  );


  await loadCurrentWeek();

}


/* =========================================================
   LOAD
========================================================= */

async function loadCurrentWeek() {

  const state =
    getRotaState();


  updateWeekUI();


  replaceRotaState({
    loading:
      true,

    error:
      null
  });


  try {

    const result =
      await loadRotaWorkspace({
        actor,
        weekStart:
          state.weekStart,

        scope:
          state.scope
      });


    replaceRotaState({
      people:
        result.people ||
        [],

      projects:
        result.projects ||
        [],

      publishedEntries:
        result.publishedEntries ||
        [],

      draftEntries:
        (
          result.publishedEntries ||
          []
        ).map(
          (
            entry
          ) => ({
            ...entry
          })
        ),

      publishedVersionId:
        result.publishedVersionId ||
        null,

      publishedAt:
        result.publishedAt ||
        null,

      loading:
        false,

      dirty:
        false,

      error:
        null
    });


    renderScopeOptions(
      result.availableScopes ||
      []
    );


    renderAll();

  } catch (
    error
  ) {

    console.error(
      "[NORMEX Rota] Load failed",
      error
    );


    replaceRotaState({
      loading:
        false,

      error:
        error
    });


    renderAll();

  }

}


/* =========================================================
   RENDER
========================================================= */

function renderAll() {

  const state =
    getRotaState();


  renderDayHeaders(
    state.weekStart
  );


  renderTradeOptions(
    state.people
  );


  renderFilteredPeople();


  renderBoard({
    onMovePerson:
      handleMovePerson,

    onRemovePerson:
      handleRemovePerson
  });


  renderRotaStatus();


  renderBoardSummary();


  updateWeekUI();


  updateCopyButton();

}


/* =========================================================
   MOVE / REMOVE
========================================================= */

function handleMovePerson({
  personId,
  dateKey,
  positionType,
  projectId
}) {

  movePersonToPosition({
    personId,
    dateKey,
    positionType,
    projectId
  });


  /*
   * This implements the locked product rule:
   *
   * one person
   * one primary planned position
   * per date.
   *
   * A move automatically removes the previous position
   * for that same person/date.
   */


  renderBoard({
    onMovePerson:
      handleMovePerson,

    onRemovePerson:
      handleRemovePerson
  });


  renderRotaStatus();

}


function handleRemovePerson({
  personId,
  dateKey
}) {

  removePersonFromDate({
    personId,
    dateKey
  });


  renderBoard({
    onMovePerson:
      handleMovePerson,

    onRemovePerson:
      handleRemovePerson
  });


  renderRotaStatus();

}


/* =========================================================
   FILTERS
========================================================= */

function renderFilteredPeople() {

  const state =
    getRotaState();


  renderPeopleList({
    people:
      state.people,

    search:
      document.getElementById(
        "rotaPeopleSearch"
      )?.value ||
      "",

    trade:
      document.getElementById(
        "rotaTradeFilter"
      )?.value ||
      "",

    employmentType:
      document.getElementById(
        "rotaEmploymentFilter"
      )?.value ||
      ""
  });

}


/* =========================================================
   WEEK NAVIGATION
========================================================= */

async function changeWeek(
  offset
) {

  const state =
    getRotaState();


  if (
    state.dirty
  ) {

    const confirmed =
      window.confirm(
        "You have unpublished rota changes. Leave this week and discard them?"
      );


    if (
      !confirmed
    ) {

      return;

    }

  }


  const next =
    new Date(
      state.weekStart
    );


  next.setDate(
    next.getDate() +
    (
      offset *
      7
    )
  );


  setWeekStart(
    next
  );


  await loadCurrentWeek();

}


async function goToCurrentWeek() {

  const state =
    getRotaState();


  if (
    state.dirty
  ) {

    const confirmed =
      window.confirm(
        "You have unpublished rota changes. Return to this week and discard them?"
      );


    if (
      !confirmed
    ) {

      return;

    }

  }


  setWeekStart(
    getMonday(
      new Date()
    )
  );


  await loadCurrentWeek();

}


/* =========================================================
   DISCARD
========================================================= */

function discardChanges() {

  const state =
    getRotaState();


  if (
    !state.dirty
  ) {

    return;

  }


  const confirmed =
    window.confirm(
      "Discard all unpublished changes for this week?"
    );


  if (
    !confirmed
  ) {

    return;

  }


  discardDraftChanges();


  renderAll();

}


/* =========================================================
   PUBLISH
========================================================= */

async function handlePublish() {

  const state =
    getRotaState();


  if (
    !state.dirty
  ) {

    return;

  }


  const confirmed =
    window.confirm(
      `Publish the rota for ${formatWeekRange(state.weekStart)}?`
    );


  if (
    !confirmed
  ) {

    return;

  }


  const button =
    document.getElementById(
      "rotaPublish"
    );


  if (
    button
  ) {

    button.disabled =
      true;


    button.textContent =
      "Publishing...";

  }


  try {

    const result =
      await publishRota({
        actor,
        weekStart:
          state.weekStart,

        entries:
          state.draftEntries,

        previousVersionId:
          state.publishedVersionId
      });


    markPublished({
      entries:
        result.entries ||
        state.draftEntries,

      versionId:
        result.versionId ||
        null,

      publishedAt:
        result.publishedAt ||
        new Date()
    });


    renderAll();

  } catch (
    error
  ) {

    console.error(
      "[NORMEX Rota] Publish failed",
      error
    );


    window.alert(
      error?.message ||
      "The rota could not be published."
    );

  } finally {

    if (
      button
    ) {

      button.textContent =
        "Publish Rota";

    }


    renderRotaStatus();

  }

}


/* =========================================================
   COPY PREVIOUS WEEK
========================================================= */

async function handleCopyPreviousWeek() {

  const state =
    getRotaState();


  const confirmed =
    window.confirm(
      "Copy the previous published week into this week's draft?"
    );


  if (
    !confirmed
  ) {

    return;

  }


  try {

    const result =
      await loadPreviousPublishedWeek({
        actor,
        weekStart:
          state.weekStart
      });


    const shifted =
      (
        result.entries ||
        []
      ).map(
        (
          entry
        ) => {

          const date =
            new Date(
              `${entry.dateKey}T12:00:00`
            );


          date.setDate(
            date.getDate() +
            7
          );


          return {
            ...entry,

            dateKey:
              toDateKey(
                date
              )
          };

        }
      );


    replaceRotaState({
      draftEntries:
        shifted,

      dirty:
        true
    });


    renderAll();

  } catch (
    error
  ) {

    console.error(
      "[NORMEX Rota] Copy previous week failed",
      error
    );


    window.alert(
      error?.message ||
      "The previous rota could not be copied."
    );

  }

}


/* =========================================================
   SCOPE
========================================================= */

async function changeScope() {

  const select =
    document.getElementById(
      "rotaScopeSelect"
    );


  const state =
    getRotaState();


  if (
    !select ||
    select.value ===
      state.scope
  ) {

    return;

  }


  if (
    state.dirty
  ) {

    const confirmed =
      window.confirm(
        "Changing rota scope will discard unpublished changes. Continue?"
      );


    if (
      !confirmed
    ) {

      select.value =
        state.scope;

      return;

    }

  }


  replaceRotaState({
    scope:
      select.value
  });


  await loadCurrentWeek();

}


/* =========================================================
   UI
========================================================= */

function updateWeekUI() {

  const state =
    getRotaState();


  const label =
    document.getElementById(
      "rotaWeekLabel"
    );


  if (
    label &&
    state.weekStart
  ) {

    label.textContent =
      formatWeekRange(
        state.weekStart
      );

  }


  const context =
    document.getElementById(
      "rotaWeekContext"
    );


  if (
    context
  ) {

    context.textContent =
      describeWeek(
        state.weekStart
      );

  }

}


function renderScopeOptions(
  scopes
) {

  const select =
    document.getElementById(
      "rotaScopeSelect"
    );


  if (
    !select
  ) {

    return;

  }


  const state =
    getRotaState();


  select.replaceChildren();


  (
    scopes.length
      ? scopes
      : [
          {
            value: "VISIBLE",
            label: "My visible projects"
          }
        ]
  ).forEach(
    (
      scope
    ) => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        scope.value;


      option.textContent =
        scope.label;


      select.append(
        option
      );

    }
  );


  select.value =
    state.scope;

}


function updateCopyButton() {

  const button =
    document.getElementById(
      "rotaCopyPrevious"
    );


  if (
    button
  ) {

    button.disabled =
      false;

  }

}


/* =========================================================
   CONTROL BINDINGS
========================================================= */

function bindControls() {

  document
    .getElementById(
      "rotaPreviousWeek"
    )
    ?.addEventListener(
      "click",
      () =>
        changeWeek(-1)
    );


  document
    .getElementById(
      "rotaNextWeek"
    )
    ?.addEventListener(
      "click",
      () =>
        changeWeek(1)
    );


  document
    .getElementById(
      "rotaToday"
    )
    ?.addEventListener(
      "click",
      goToCurrentWeek
    );


  document
    .getElementById(
      "rotaDiscardChanges"
    )
    ?.addEventListener(
      "click",
      discardChanges
    );


  document
    .getElementById(
      "rotaPublish"
    )
    ?.addEventListener(
      "click",
      handlePublish
    );


  document
    .getElementById(
      "rotaCopyPrevious"
    )
    ?.addEventListener(
      "click",
      handleCopyPreviousWeek
    );


  document
    .getElementById(
      "rotaScopeSelect"
    )
    ?.addEventListener(
      "change",
      changeScope
    );


  [
    "rotaPeopleSearch",
    "rotaTradeFilter",
    "rotaEmploymentFilter"
  ].forEach(
    (
      id
    ) => {

      const element =
        document.getElementById(
          id
        );


      element?.addEventListener(
        id ===
        "rotaPeopleSearch"
          ? "input"
          : "change",
        renderFilteredPeople
      );

    }
  );

}


/* =========================================================
   DATE HELPERS
========================================================= */

function getMonday(
  value
) {

  const date =
    new Date(
      value
    );


  date.setHours(
    12,
    0,
    0,
    0
  );


  const day =
    date.getDay();


  const difference =
    day === 0
      ? -6
      : 1 - day;


  date.setDate(
    date.getDate() +
    difference
  );


  return date;

}


function describeWeek(
  weekStart
) {

  if (
    !weekStart
  ) {

    return "Week";

  }


  const current =
    getMonday(
      new Date()
    );


  const selected =
    getMonday(
      weekStart
    );


  const difference =
    Math.round(
      (
        selected -
        current
      ) /
      (
        7 *
        24 *
        60 *
        60 *
        1000
      )
    );


  if (
    difference ===
    0
  ) {

    return "Current week";

  }


  if (
    difference ===
    1
  ) {

    return "Next week";

  }


  if (
    difference ===
    -1
  ) {

    return "Previous week";

  }


  return difference > 1
    ? `${difference} weeks ahead`
    : `${Math.abs(difference)} weeks ago`;

}


/* =========================================================
   START
========================================================= */

initialiseRota();