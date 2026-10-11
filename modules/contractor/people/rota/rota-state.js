/* =========================================================
   NORMEX PEOPLE
   ROTA STATE
========================================================= */


export const ROTA_POSITION_TYPES =
  Object.freeze({
    WORK: "WORK",
    HOLIDAY: "HOLIDAY",
    UNAVAILABLE: "UNAVAILABLE"
  });


const state = {

  weekStart:
    null,

  people:
    [],

  projects:
    [],

  publishedEntries:
    [],

  draftEntries:
    [],

  publishedAt:
    null,

  publishedVersionId:
    null,

  dirty:
    false,

  loading:
    true,

  error:
    null,

  scope:
    "VISIBLE"

};


/* =========================================================
   STATE ACCESS
========================================================= */

export function getRotaState() {

  return state;

}


export function replaceRotaState(
  nextState = {}
) {

  Object.assign(
    state,
    nextState
  );

}


/* =========================================================
   WEEK
========================================================= */

export function setWeekStart(
  value
) {

  state.weekStart =
    value;

}


/* =========================================================
   DATA
========================================================= */

export function setPeople(
  people
) {

  state.people =
    Array.isArray(people)
      ? people
      : [];

}


export function setProjects(
  projects
) {

  state.projects =
    Array.isArray(projects)
      ? projects
      : [];

}


export function setPublishedEntries(
  entries,
  {
    versionId = null,
    publishedAt = null
  } = {}
) {

  state.publishedEntries =
    cloneEntries(
      entries
    );


  state.draftEntries =
    cloneEntries(
      entries
    );


  state.publishedVersionId =
    versionId;


  state.publishedAt =
    publishedAt;


  state.dirty =
    false;

}


export function setDraftEntries(
  entries
) {

  state.draftEntries =
    cloneEntries(
      entries
    );


  state.dirty =
    true;

}


/* =========================================================
   DRAFT OPERATIONS
========================================================= */

export function movePersonToPosition({
  personId,
  dateKey,
  positionType,
  projectId = null
}) {

  const cleanPersonId =
    String(
      personId ||
      ""
    ).trim();


  const cleanDateKey =
    String(
      dateKey ||
      ""
    ).trim();


  if (
    !cleanPersonId ||
    !cleanDateKey
  ) {

    return false;

  }


  /*
   * One person / one primary rota position / one date.
   *
   * Moving somebody therefore replaces their previous
   * draft position for that date.
   */

  state.draftEntries =
    state.draftEntries.filter(
      (
        entry
      ) =>
        !(
          entry.personId ===
            cleanPersonId &&
          entry.dateKey ===
            cleanDateKey
        )
    );


  state.draftEntries.push({
    personId:
      cleanPersonId,

    dateKey:
      cleanDateKey,

    positionType:
      positionType,

    projectId:
      positionType ===
      ROTA_POSITION_TYPES.WORK
        ? projectId || null
        : null
  });


  state.dirty =
    true;


  return true;

}


export function removePersonFromDate({
  personId,
  dateKey
}) {

  const before =
    state.draftEntries.length;


  state.draftEntries =
    state.draftEntries.filter(
      (
        entry
      ) =>
        !(
          entry.personId ===
            personId &&
          entry.dateKey ===
            dateKey
        )
    );


  if (
    state.draftEntries.length !==
    before
  ) {

    state.dirty =
      true;

    return true;

  }


  return false;

}


export function discardDraftChanges() {

  state.draftEntries =
    cloneEntries(
      state.publishedEntries
    );


  state.dirty =
    false;

}


/* =========================================================
   QUERY
========================================================= */

export function getEntryForPersonDate(
  personId,
  dateKey
) {

  return (
    state.draftEntries.find(
      (
        entry
      ) =>
        entry.personId ===
          personId &&
        entry.dateKey ===
          dateKey
    ) ||
    null
  );

}


export function getEntriesForCell({
  dateKey,
  positionType,
  projectId = null
}) {

  return state.draftEntries.filter(
    (
      entry
    ) => {

      if (
        entry.dateKey !==
        dateKey
      ) {

        return false;

      }


      if (
        entry.positionType !==
        positionType
      ) {

        return false;

      }


      if (
        positionType ===
        ROTA_POSITION_TYPES.WORK
      ) {

        return (
          entry.projectId ===
          projectId
        );

      }


      return true;

    }
  );

}


/* =========================================================
   STATUS
========================================================= */

export function markDraftSaved() {

  /*
   * Saving a server-side draft later does NOT mean
   * publishing it.
   *
   * We intentionally keep dirty true until UX/product
   * decides how persisted draft state should be represented.
   */

}


export function markPublished({
  entries,
  versionId = null,
  publishedAt = new Date()
}) {

  setPublishedEntries(
    entries,
    {
      versionId,
      publishedAt
    }
  );

}


/* =========================================================
   HELPERS
========================================================= */

function cloneEntries(
  entries
) {

  if (
    !Array.isArray(entries)
  ) {

    return [];

  }


  return entries.map(
    (
      entry
    ) => ({
      ...entry
    })
  );

}