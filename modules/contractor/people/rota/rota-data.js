/* =========================================================
   NORMEX PEOPLE
   ROTA DATA ADAPTER

   Canonical persisted rota model:

   peopleRotaWeeks
   peopleRotaVersions
   peopleRotaEntries
========================================================= */


import {
  db
} from "/js/firebase.js";


import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const COLLECTIONS =
  Object.freeze({

    PEOPLE:
      "people",

    PROJECTS:
      "projects",

    WEEKS:
      "peopleRotaWeeks",

    VERSIONS:
      "peopleRotaVersions",

    ENTRIES:
      "peopleRotaEntries"

  });


/* =========================================================
   LOAD WORKSPACE
========================================================= */

export async function loadRotaWorkspace({
  actor,
  weekStart,
  scope
}) {

  requireActor(
    actor
  );


  const organisationId =
    cleanString(
      actor.organisationId
    );


  const weekStartKey =
    toDateKey(
      weekStart
    );


  const weekId =
    buildWeekId(
      organisationId,
      weekStartKey
    );


  const [
    peopleResult,
    projectsResult,
    rotaResult
  ] =
    await Promise.allSettled([

      loadOrganisationPeople(
        organisationId
      ),

      loadOrganisationProjects(
        organisationId
      ),

      loadPublishedWeek({
        organisationId,
        weekId
      })

    ]);


  if (
    peopleResult.status ===
    "rejected"
  ) {

    console.error(
      "[NORMEX Rota] People load failed",
      peopleResult.reason
    );

  }


  if (
    projectsResult.status ===
    "rejected"
  ) {

    console.error(
      "[NORMEX Rota] Projects load failed",
      projectsResult.reason
    );

  }


  if (
    rotaResult.status ===
    "rejected"
  ) {

    console.error(
      "[NORMEX Rota] Published rota load failed",
      rotaResult.reason
    );

  }


  const people =
    peopleResult.status ===
    "fulfilled"
      ? peopleResult.value
      : [];


  const projects =
    projectsResult.status ===
    "fulfilled"
      ? projectsResult.value
      : [];


  const published =
    rotaResult.status ===
    "fulfilled"
      ? rotaResult.value
      : emptyPublishedWeek();


  return {

    people,

    projects,


    publishedEntries:
      published.entries,


    publishedVersionId:
      published.versionId,


    publishedAt:
      published.publishedAt,


    publishedVersionNumber:
      published.versionNumber,


    availableScopes:
      buildAvailableScopes(
        actor
      ),


    sourceStatus: {

      people:
        peopleResult.status ===
        "fulfilled"
          ? "LOADED"
          : "UNAVAILABLE",

      projects:
        projectsResult.status ===
        "fulfilled"
          ? "LOADED"
          : "UNAVAILABLE",

      rota:
        rotaResult.status ===
        "fulfilled"
          ? "LOADED"
          : "UNAVAILABLE"

    },


    truthState:
      deriveTruthState({
        peopleResult,
        projectsResult,
        rotaResult,
        people,
        projects
      })

  };

}


/* =========================================================
   PEOPLE
========================================================= */

async function loadOrganisationPeople(
  organisationId
) {

  const peopleQuery =
    query(

      collection(
        db,
        COLLECTIONS.PEOPLE
      ),

      where(
        "organisationId",
        "==",
        organisationId
      )

    );


  const snapshot =
    await getDocs(
      peopleQuery
    );


  return snapshot.docs

    .map(
      documentSnapshot =>
        normalisePerson({
          id:
            documentSnapshot.id,

          ...documentSnapshot.data()
        })
    )

    .filter(
      isActivePerson
    )

    .sort(
      sortPeople
    );

}


/* =========================================================
   PROJECTS
========================================================= */

async function loadOrganisationProjects(
  organisationId
) {

  const projectsQuery =
    query(

      collection(
        db,
        COLLECTIONS.PROJECTS
      ),

      where(
        "organisationId",
        "==",
        organisationId
      )

    );


  const snapshot =
    await getDocs(
      projectsQuery
    );


  return snapshot.docs

    .map(
      documentSnapshot =>
        normaliseProject({
          id:
            documentSnapshot.id,

          ...documentSnapshot.data()
        })
    )

    .filter(
      isRotaProject
    )

    .sort(
      sortProjects
    );

}


/* =========================================================
   LOAD PUBLISHED WEEK
========================================================= */

async function loadPublishedWeek({
  organisationId,
  weekId
}) {

  const weekReference =
    doc(
      db,
      COLLECTIONS.WEEKS,
      weekId
    );


  const weekSnapshot =
    await getDoc(
      weekReference
    );


  if (
    !weekSnapshot.exists()
  ) {

    return emptyPublishedWeek();

  }


  const week =
    weekSnapshot.data();


  if (
    cleanString(
      week.organisationId
    ) !==
    organisationId
  ) {

    throw new Error(
      "Rota week organisation mismatch."
    );

  }


  const publishedVersionId =
    cleanString(
      week.publishedVersionId
    );


  if (
    !publishedVersionId
  ) {

    return emptyPublishedWeek();

  }


  const versionReference =
    doc(
      db,
      COLLECTIONS.VERSIONS,
      publishedVersionId
    );


  const versionSnapshot =
    await getDoc(
      versionReference
    );


  if (
    !versionSnapshot.exists()
  ) {

    throw new Error(
      "The published rota version could not be found."
    );

  }


  const version =
    versionSnapshot.data();


  if (
    cleanString(
      version.organisationId
    ) !==
      organisationId ||

    cleanString(
      version.weekId
    ) !==
      weekId ||

    cleanString(
      version.status
    ) !==
      "PUBLISHED"
  ) {

    throw new Error(
      "The published rota version is invalid."
    );

  }


  const entriesQuery =
    query(

      collection(
        db,
        COLLECTIONS.ENTRIES
      ),

      where(
        "organisationId",
        "==",
        organisationId
      ),

      where(
        "versionId",
        "==",
        publishedVersionId
      )

    );


  const entriesSnapshot =
    await getDocs(
      entriesQuery
    );


  const entries =
    entriesSnapshot.docs

      .map(
        snapshot =>
          normaliseRotaEntry({
            id:
              snapshot.id,

            ...snapshot.data()
          })
      )

      .filter(Boolean);


  return {

    entries,

    versionId:
      publishedVersionId,

    versionNumber:
      Number(
        version.versionNumber ||
        1
      ),

    publishedAt:
      normaliseDate(
        version.publishedAt ||
        week.publishedAt
      )

  };

}


/* =========================================================
   PUBLISH ROTA
========================================================= */

export async function publishRota({
  actor,
  weekStart,
  entries,
  previousVersionId
}) {

  requireActor(
    actor
  );


  const organisationId =
    cleanString(
      actor.organisationId
    );


  const weekStartKey =
    toDateKey(
      weekStart
    );


  const weekId =
    buildWeekId(
      organisationId,
      weekStartKey
    );


  const cleanEntries =
    validateDraftEntries({
      organisationId,
      weekStartKey,
      entries
    });


  /*
   * Read current week pointer immediately before publishing.
   *
   * This provides basic optimistic concurrency protection:
   * if somebody else published after this browser loaded,
   * we refuse to silently overwrite their version.
   */

  const weekReference =
    doc(
      db,
      COLLECTIONS.WEEKS,
      weekId
    );


  const existingWeekSnapshot =
    await getDoc(
      weekReference
    );


  const existingWeek =
    existingWeekSnapshot.exists()
      ? existingWeekSnapshot.data()
      : null;


  const currentPublishedVersionId =
    cleanString(
      existingWeek?.publishedVersionId
    ) ||
    null;


  if (
    currentPublishedVersionId !==
    (
      previousVersionId ||
      null
    )
  ) {

    throw new Error(
      "This rota has been published by another user since you opened it. Reload the week before publishing your changes."
    );

  }


  const previousVersionNumber =
    Number(
      existingWeek?.publishedVersionNumber ||
      0
    );


  const versionNumber =
    previousVersionNumber +
    1;


  const versionReference =
    doc(
      collection(
        db,
        COLLECTIONS.VERSIONS
      )
    );


  const versionId =
    versionReference.id;


  /*
   * Version starts BUILDING.
   *
   * Entries may exceed a single Firestore batch in a large
   * workforce. A BUILDING version is never shown to users.
   *
   * Only after all entries are successfully written do we
   * switch the version to PUBLISHED and update the week
   * pointer.
   */

  const versionCreateBatch =
    writeBatch(
      db
    );


  versionCreateBatch.set(
    versionReference,
    {

      organisationId,

      weekId,

      weekStart:
        weekStartKey,

      versionNumber,

      previousVersionId:
        currentPublishedVersionId,

      status:
        "BUILDING",

      entryCount:
        cleanEntries.length,

      createdByUid:
        actor.uid,

      createdByName:
        cleanString(
          actor.displayName
        ) ||
        cleanString(
          actor.name
        ) ||
        "NORMEX User",

      createdAt:
        serverTimestamp(),

      updatedByUid:
        actor.uid,

      updatedAt:
        serverTimestamp()

    }
  );


  await versionCreateBatch.commit();


  /*
   * Firestore write batches support a finite operation count.
   *
   * Keep enough headroom for future metadata operations.
   */

  const CHUNK_SIZE =
    400;


  for (
    let offset = 0;
    offset < cleanEntries.length;
    offset += CHUNK_SIZE
  ) {

    const chunk =
      cleanEntries.slice(
        offset,
        offset +
        CHUNK_SIZE
      );


    const batch =
      writeBatch(
        db
      );


    chunk.forEach(
      entry =>
        batch.set(

          doc(
            collection(
              db,
              COLLECTIONS.ENTRIES
            )
          ),

          {

            organisationId,

            weekId,

            versionId,

            weekStart:
              weekStartKey,

            personId:
              entry.personId,

            dateKey:
              entry.dateKey,

            positionType:
              entry.positionType,

            projectId:
              entry.projectId,

            createdByUid:
              actor.uid,

            createdAt:
              serverTimestamp()

          }

        )
    );


    await batch.commit();

  }


  /*
   * Finalise publication.
   *
   * Until this succeeds the previous published version stays
   * authoritative.
   */

  const finalBatch =
    writeBatch(
      db
    );


  finalBatch.update(
    versionReference,
    {

      status:
        "PUBLISHED",

      publishedByUid:
        actor.uid,

      publishedByName:
        cleanString(
          actor.displayName
        ) ||
        cleanString(
          actor.name
        ) ||
        "NORMEX User",

      publishedAt:
        serverTimestamp(),

      updatedByUid:
        actor.uid,

      updatedAt:
        serverTimestamp()

    }
  );


  finalBatch.set(
    weekReference,
    {

      organisationId,

      weekStart:
        weekStartKey,

      publishedVersionId:
        versionId,

      publishedVersionNumber:
        versionNumber,

      publishedByUid:
        actor.uid,

      publishedByName:
        cleanString(
          actor.displayName
        ) ||
        cleanString(
          actor.name
        ) ||
        "NORMEX User",

      publishedAt:
        serverTimestamp(),

      previousPublishedVersionId:
        currentPublishedVersionId,

      updatedByUid:
        actor.uid,

      updatedAt:
        serverTimestamp()

    },
    {
      merge:
        true
    }
  );


  await finalBatch.commit();


  /*
   * Use client time immediately for UI.
   *
   * A reload resolves the authoritative server timestamp.
   */

  return {

    entries:
      cleanEntries,

    versionId,

    versionNumber,

    publishedAt:
      new Date()

  };

}


/* =========================================================
   PREVIOUS PUBLISHED WEEK
========================================================= */

export async function loadPreviousPublishedWeek({
  actor,
  weekStart
}) {

  requireActor(
    actor
  );


  const previousMonday =
    new Date(
      weekStart
    );


  previousMonday.setDate(
    previousMonday.getDate() -
    7
  );


  const organisationId =
    cleanString(
      actor.organisationId
    );


  const previousWeekStart =
    toDateKey(
      previousMonday
    );


  const previousWeekId =
    buildWeekId(
      organisationId,
      previousWeekStart
    );


  const previous =
    await loadPublishedWeek({

      organisationId,

      weekId:
        previousWeekId

    });


  return {

    entries:
      previous.entries,

    versionId:
      previous.versionId,

    truthState:
      previous.versionId
        ? "LOADED_WITH_DATA"
        : "LOADED_EMPTY"

  };

}


/* =========================================================
   VALIDATE DRAFT
========================================================= */

function validateDraftEntries({
  organisationId,
  weekStartKey,
  entries
}) {

  if (
    !Array.isArray(entries)
  ) {

    throw new Error(
      "Invalid rota entries."
    );

  }


  const allowedPositionTypes =
    new Set([
      "WORK",
      "HOLIDAY",
      "UNAVAILABLE"
    ]);


  const uniquePersonDates =
    new Set();


  const weekStart =
    dateFromKey(
      weekStartKey
    );


  const weekEnd =
    new Date(
      weekStart
    );


  weekEnd.setDate(
    weekEnd.getDate() +
    6
  );


  return entries.map(
    raw => {

      const personId =
        cleanString(
          raw.personId
        );


      const dateKey =
        cleanString(
          raw.dateKey
        );


      const positionType =
        cleanString(
          raw.positionType
        ).toUpperCase();


      const projectId =
        cleanString(
          raw.projectId
        ) ||
        null;


      if (
        !personId
      ) {

        throw new Error(
          "A rota entry is missing its person."
        );

      }


      if (
        !allowedPositionTypes.has(
          positionType
        )
      ) {

        throw new Error(
          "A rota entry contains an invalid planned position."
        );

      }


      const date =
        dateFromKey(
          dateKey
        );


      if (
        !date ||
        date <
          weekStart ||
        date >
          weekEnd
      ) {

        throw new Error(
          "A rota entry falls outside the selected week."
        );

      }


      if (
        positionType ===
          "WORK" &&
        !projectId
      ) {

        throw new Error(
          "A working rota entry must identify a project."
        );

      }


      if (
        positionType !==
          "WORK" &&
        projectId
      ) {

        throw new Error(
          "Holiday and unavailable positions must not contain a project."
        );

      }


      const uniquenessKey =
        `${personId}__${dateKey}`;


      if (
        uniquePersonDates.has(
          uniquenessKey
        )
      ) {

        throw new Error(
          "A person cannot have more than one planned position on the same date."
        );

      }


      uniquePersonDates.add(
        uniquenessKey
      );


      return {

        organisationId,

        personId,

        dateKey,

        positionType,

        projectId

      };

    }
  );

}


/* =========================================================
   PERSON NORMALISATION
========================================================= */

function normalisePerson(
  raw
) {

  const firstName =
    cleanString(
      raw.firstName
    );


  const lastName =
    cleanString(
      raw.lastName ||
      raw.surname
    );


  const displayName =
    cleanString(
      raw.displayName
    ) ||
    [
      firstName,
      lastName
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed person";


  const primaryTrade =
    cleanString(
      raw.primaryTrade
    ) ||
    cleanString(
      raw.primaryRole
    ) ||
    cleanString(
      raw.position
    ) ||
    "Role not recorded";


  return {

    id:
      cleanString(
        raw.personId
      ) ||
      cleanString(
        raw.id
      ),

    documentId:
      cleanString(
        raw.id
      ),

    linkedUserUid:
      cleanString(
        raw.linkedUserUid
      ) ||
      null,

    displayName,

    firstName,

    lastName,

    primaryTrade,

    employmentType:
      normaliseEmploymentType(
        raw.employmentType
      ),

    employmentStatus:
      cleanString(
        raw.employmentStatus
      ).toUpperCase() ||
      cleanString(
        raw.status
      ).toUpperCase() ||
      null,

    active:
      raw.active !==
      false,

    tradeColour:
      getTradeColour(
        primaryTrade
      )

  };

}


function isActivePerson(
  person
) {

  if (
    person.active ===
    false
  ) {

    return false;

  }


  const status =
    cleanString(
      person.employmentStatus
    ).toUpperCase();


  return (
    !status ||
    status ===
    "ACTIVE"
  );

}


function sortPeople(
  a,
  b
) {

  return a.displayName.localeCompare(
    b.displayName,
    "en-GB",
    {
      sensitivity:
        "base"
    }
  );

}


/* =========================================================
   PROJECT NORMALISATION
========================================================= */

function normaliseProject(
  raw
) {

  return {

    id:
      cleanString(
        raw.id
      ),

    name:
      cleanString(
        raw.name
      ) ||
      cleanString(
        raw.projectCode
      ) ||
      "Unnamed project",

    reference:
      cleanString(
        raw.projectCode
      ),

    client:
      cleanString(
        raw.clientName
      ),

    site:
      cleanString(
        raw.siteName
      ),

    status:
      cleanString(
        raw.status
      ).toUpperCase(),

    archived:
      raw.archived ===
      true,

    projectManagerUid:
      cleanString(
        raw.projectManagerUid
      ) ||
      null,

    projectManagerName:
      cleanString(
        raw.projectManagerName
      ) ||
      null

  };

}


function isRotaProject(
  project
) {

  if (
    project.archived
  ) {

    return false;

  }


  return [
    "LIVE",
    "PRE_CONSTRUCTION",
    "ON_HOLD"
  ].includes(
    project.status
  );

}


function sortProjects(
  a,
  b
) {

  const priority = {

    LIVE:
      1,

    PRE_CONSTRUCTION:
      2,

    ON_HOLD:
      3

  };


  const difference =
    (
      priority[a.status] ||
      99
    ) -
    (
      priority[b.status] ||
      99
    );


  if (
    difference
  ) {

    return difference;

  }


  return a.name.localeCompare(
    b.name,
    "en-GB",
    {
      sensitivity:
        "base"
    }
  );

}


/* =========================================================
   ENTRY NORMALISATION
========================================================= */

function normaliseRotaEntry(
  raw
) {

  const personId =
    cleanString(
      raw.personId
    );


  const dateKey =
    cleanString(
      raw.dateKey
    );


  const positionType =
    cleanString(
      raw.positionType
    ).toUpperCase();


  if (
    !personId ||
    !dateKey ||
    ![
      "WORK",
      "HOLIDAY",
      "UNAVAILABLE"
    ].includes(
      positionType
    )
  ) {

    return null;

  }


  return {

    id:
      cleanString(
        raw.id
      ),

    personId,

    dateKey,

    positionType,

    projectId:
      positionType ===
      "WORK"
        ? cleanString(
            raw.projectId
          ) ||
          null
        : null

  };

}


/* =========================================================
   SCOPE OPTIONS
========================================================= */

function buildAvailableScopes(
  actor
) {

  const scopes =
    [
      {
        value:
          "VISIBLE",

        label:
          "My visible projects"
      }
    ];


  const level =
    Number(
      actor?.accessLevel ||
      0
    );


  if (
    level >=
      5 ||
    level ===
      99
  ) {

    scopes.push({
      value:
        "ORGANISATION",

      label:
        "Organisation-wide"
    });

  }


  return scopes;

}


/* =========================================================
   TRUTH STATE
========================================================= */

function deriveTruthState({
  peopleResult,
  projectsResult,
  rotaResult,
  people,
  projects
}) {

  if (
    peopleResult.status !==
      "fulfilled" ||
    projectsResult.status !==
      "fulfilled" ||
    rotaResult.status !==
      "fulfilled"
  ) {

    return "UNAVAILABLE";

  }


  if (
    !people.length &&
    !projects.length
  ) {

    return "LOADED_EMPTY";

  }


  return "LOADED_WITH_DATA";

}


/* =========================================================
   EMPLOYMENT
========================================================= */

function normaliseEmploymentType(
  value
) {

  const type =
    cleanString(
      value
    ).toUpperCase();


  return [
    "EMPLOYEE",
    "AGENCY",
    "SUBCONTRACTOR"
  ].includes(type)
    ? type
    : "EMPLOYEE";

}


/* =========================================================
   TRADE COLOUR
========================================================= */

function getTradeColour(
  trade
) {

  const palette =
    [
      "#6f927c",
      "#748c9b",
      "#9a8569",
      "#7f7b98",
      "#8b966f",
      "#9a7770"
    ];


  const value =
    cleanString(
      trade
    );


  let hash =
    0;


  for (
    let index = 0;
    index <
    value.length;
    index += 1
  ) {

    hash =
      (
        (
          hash *
          31
        ) +
        value.charCodeAt(index)
      ) >>>
      0;

  }


  return palette[
    hash %
    palette.length
  ];

}


/* =========================================================
   HELPERS
========================================================= */

function requireActor(
  actor
) {

  if (
    !actor?.uid ||
    !cleanString(
      actor.organisationId
    )
  ) {

    throw new Error(
      "The current user or organisation could not be resolved."
    );

  }

}


function buildWeekId(
  organisationId,
  weekStartKey
) {

  return `${safeId(organisationId)}__${weekStartKey}`;

}


function safeId(
  value
) {

  return cleanString(
    value
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );

}


function toDateKey(
  value
) {

  const date =
    value instanceof Date
      ? new Date(value)
      : new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    throw new Error(
      "Invalid rota week date."
    );

  }


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() +
      1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


function dateFromKey(
  value
) {

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      cleanString(
        value
      )
    );


  if (
    !match
  ) {

    return null;

  }


  const date =
    new Date(
      Number(match[1]),
      Number(match[2]) -
        1,
      Number(match[3]),
      12,
      0,
      0,
      0
    );


  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;

}


function normaliseDate(
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


function emptyPublishedWeek() {

  return {

    entries:
      [],

    versionId:
      null,

    versionNumber:
      0,

    publishedAt:
      null

  };

}


function cleanString(
  value
) {

  return String(
    value ??
    ""
  ).trim();

}