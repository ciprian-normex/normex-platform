/* =========================================================
   NORMEX PEOPLE
   ROTA UI
========================================================= */

import {
  ROTA_POSITION_TYPES,
  getRotaState,
  getEntriesForCell
} from "./rota-state.js";


const DAY_NAMES =
  [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun"
  ];


/* =========================================================
   DATE HELPERS
========================================================= */

export function getWeekDates(
  weekStart
) {

  const dates =
    [];


  for (
    let index = 0;
    index < 7;
    index += 1
  ) {

    const date =
      new Date(
        weekStart
      );


    date.setDate(
      date.getDate() +
      index
    );


    dates.push(
      date
    );

  }


  return dates;

}


export function toDateKey(
  value
) {

  const date =
    new Date(
      value
    );


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


export function formatWeekRange(
  weekStart
) {

  const dates =
    getWeekDates(
      weekStart
    );


  const start =
    dates[0];


  const end =
    dates[6];


  const startText =
    start.toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "short"
      }
    );


  const endText =
    end.toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );


  return `${startText} - ${endText}`;

}


/* =========================================================
   DAY HEADERS
========================================================= */

export function renderDayHeaders(
  weekStart
) {

  const dates =
    getWeekDates(
      weekStart
    );


  dates.forEach(
    (
      date,
      index
    ) => {

      const element =
        document.getElementById(
          `rotaDayHeader${index}`
        );


      if (
        !element
      ) {

        return;

      }


      const dayLabel =
        element.querySelector(
          "span"
        );


      const dateLabel =
        element.querySelector(
          "strong"
        );


      if (
        dayLabel
      ) {

        dayLabel.textContent =
          DAY_NAMES[index];

      }


      if (
        dateLabel
      ) {

        dateLabel.textContent =
          date.toLocaleDateString(
            "en-GB",
            {
              day: "2-digit",
              month: "short"
            }
          );

      }

    }
  );

}


/* =========================================================
   WORKFORCE
========================================================= */

export function renderPeopleList({
  people,
  search = "",
  trade = "",
  employmentType = ""
}) {

  const container =
    document.getElementById(
      "rotaPeopleList"
    );


  if (
    !container
  ) {

    return;

  }


  const query =
    String(
      search ||
      ""
    )
      .trim()
      .toLowerCase();


  const filtered =
    people.filter(
      (
        person
      ) => {

        const matchesSearch =
          !query ||
          [
            person.displayName,
            person.primaryTrade
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);


        const matchesTrade =
          !trade ||
          person.primaryTrade ===
            trade;


        const matchesEmployment =
          !employmentType ||
          person.employmentType ===
            employmentType;


        return (
          matchesSearch &&
          matchesTrade &&
          matchesEmployment
        );

      }
    );


  container.replaceChildren();


  updateText(
    "rotaVisiblePeopleCount",
    String(
      filtered.length
    )
  );


  if (
    !filtered.length
  ) {

    container.append(
      createEmptyState(
        "No matching people",
        "Adjust the filters or search."
      )
    );

    return;

  }


  filtered.forEach(
    (
      person
    ) => {

      container.append(
        createPersonCard(
          person
        )
      );

    }
  );

}


/* =========================================================
   BOARD
========================================================= */

export function renderBoard({
  onMovePerson,
  onRemovePerson
}) {

  renderSpecialRows({
    onMovePerson,
    onRemovePerson
  });


  renderProjectRows({
    onMovePerson,
    onRemovePerson
  });


  renderBoardSummary();

}


/* =========================================================
   SPECIAL ROWS
========================================================= */

function renderSpecialRows({
  onMovePerson,
  onRemovePerson
}) {

  const container =
    document.getElementById(
      "rotaSpecialRows"
    );


  if (
    !container
  ) {

    return;

  }


  container.replaceChildren();


  container.append(
    createBoardRow({
      label:
        "Holiday",

      meta:
        "Planned leave",

      positionType:
        ROTA_POSITION_TYPES.HOLIDAY,

      cssClass:
        "rota-board-row--holiday",

      onMovePerson,
      onRemovePerson
    })
  );


  container.append(
    createBoardRow({
      label:
        "Unavailable",

      meta:
        "Known unavailable",

      positionType:
        ROTA_POSITION_TYPES.UNAVAILABLE,

      cssClass:
        "rota-board-row--unavailable",

      onMovePerson,
      onRemovePerson
    })
  );

}


/* =========================================================
   PROJECT ROWS
========================================================= */

function renderProjectRows({
  onMovePerson,
  onRemovePerson
}) {

  const container =
    document.getElementById(
      "rotaProjectRows"
    );


  if (
    !container
  ) {

    return;

  }


  const state =
    getRotaState();


  container.replaceChildren();


  if (
    !state.projects.length
  ) {

    container.append(
      createEmptyState(
        "No project rows available",
        "Projects within the current rota scope will appear here."
      )
    );

    return;

  }


  state.projects.forEach(
    (
      project
    ) => {

      container.append(
        createBoardRow({
          label:
            project.name ||
            "Unnamed project",

          meta:
            project.reference ||
            project.client ||
            "",

          positionType:
            ROTA_POSITION_TYPES.WORK,

          projectId:
            project.id,

          cssClass:
            "",

          onMovePerson,
          onRemovePerson
        })
      );

    }
  );

}


/* =========================================================
   BOARD ROW CREATOR
========================================================= */

function createBoardRow({
  label,
  meta,
  positionType,
  projectId = null,
  cssClass = "",
  onMovePerson,
  onRemovePerson
}) {

  const state =
    getRotaState();


  const row =
    document.createElement(
      "div"
    );


  row.className =
    [
      "rota-board-row",
      positionType !==
      ROTA_POSITION_TYPES.WORK
        ? "rota-board-row--special"
        : "",
      cssClass
    ]
      .filter(Boolean)
      .join(" ");


  const projectCell =
    document.createElement(
      "div"
    );


  projectCell.className =
    "rota-board-project-cell";


  const name =
    document.createElement(
      "strong"
    );


  name.textContent =
    label;


  const description =
    document.createElement(
      "span"
    );


  description.textContent =
    meta ||
    "";


  projectCell.append(
    name,
    description
  );


  row.append(
    projectCell
  );


  getWeekDates(
    state.weekStart
  ).forEach(
    (
      date
    ) => {

      const dateKey =
        toDateKey(
          date
        );


      row.append(
        createDropCell({
          dateKey,
          positionType,
          projectId,
          onMovePerson,
          onRemovePerson
        })
      );

    }
  );


  return row;

}


/* =========================================================
   DROP CELL
========================================================= */

function createDropCell({
  dateKey,
  positionType,
  projectId,
  onMovePerson,
  onRemovePerson
}) {

  const cell =
    document.createElement(
      "div"
    );


  cell.className =
    "rota-drop-cell";


  cell.dataset.dateKey =
    dateKey;


  cell.dataset.positionType =
    positionType;


  if (
    projectId
  ) {

    cell.dataset.projectId =
      projectId;

  }


  cell.addEventListener(
    "dragover",
    (
      event
    ) => {

      event.preventDefault();


      cell.classList.add(
        "is-drag-over"
      );

    }
  );


  cell.addEventListener(
    "dragleave",
    () => {

      cell.classList.remove(
        "is-drag-over"
      );

    }
  );


  cell.addEventListener(
    "drop",
    (
      event
    ) => {

      event.preventDefault();


      cell.classList.remove(
        "is-drag-over"
      );


      const personId =
        event.dataTransfer.getData(
          "text/plain"
        );


      if (
        !personId
      ) {

        return;

      }


      onMovePerson?.({
        personId,
        dateKey,
        positionType,
        projectId
      });

    }
  );


  const entries =
    getEntriesForCell({
      dateKey,
      positionType,
      projectId
    });


  entries.forEach(
    (
      entry
    ) => {

      cell.append(
        createAssignmentChip({
          entry,
          onRemovePerson
        })
      );

    }
  );


  return cell;

}


/* =========================================================
   PERSON CARD
========================================================= */

function createPersonCard(
  person
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "rota-person-card";


  card.draggable =
    true;


  card.dataset.personId =
    person.id;


  card.style.setProperty(
    "--person-trade-colour",
    person.tradeColour ||
    "#789787"
  );


  card.addEventListener(
    "dragstart",
    (
      event
    ) => {

      event.dataTransfer.setData(
        "text/plain",
        person.id
      );


      event.dataTransfer.effectAllowed =
        "move";

    }
  );


  const avatar =
    document.createElement(
      "div"
    );


  avatar.className =
    "rota-person-card__avatar";


  avatar.textContent =
    initials(
      person.displayName
    );


  const details =
    document.createElement(
      "div"
    );


  details.className =
    "rota-person-card__details";


  const name =
    document.createElement(
      "strong"
    );


  name.textContent =
    person.displayName ||
    "Unnamed person";


  const trade =
    document.createElement(
      "span"
    );


  trade.textContent =
    person.primaryTrade ||
    "Trade not recorded";


  details.append(
    name,
    trade
  );


  card.append(
    avatar,
    details
  );


  return card;

}


/* =========================================================
   ASSIGNMENT CHIP
========================================================= */

function createAssignmentChip({
  entry,
  onRemovePerson
}) {

  const state =
    getRotaState();


  const person =
    state.people.find(
      (
        candidate
      ) =>
        candidate.id ===
        entry.personId
    );


  const chip =
    document.createElement(
      "div"
    );


  chip.className =
    "rota-assignment";


  chip.draggable =
    true;


  chip.style.setProperty(
    "--person-trade-colour",
    person?.tradeColour ||
    "#789787"
  );


  chip.addEventListener(
    "dragstart",
    (
      event
    ) => {

      event.dataTransfer.setData(
        "text/plain",
        entry.personId
      );


      event.dataTransfer.effectAllowed =
        "move";

    }
  );


  const name =
    document.createElement(
      "strong"
    );


  name.textContent =
    person?.displayName ||
    "Person";


  const remove =
    document.createElement(
      "button"
    );


  remove.className =
    "rota-assignment__remove";


  remove.type =
    "button";


  remove.setAttribute(
    "aria-label",
    `Remove ${name.textContent} from this day`
  );


  remove.textContent =
    "×";


  remove.addEventListener(
    "click",
    (
      event
    ) => {

      event.stopPropagation();


      onRemovePerson?.({
        personId:
          entry.personId,

        dateKey:
          entry.dateKey
      });

    }
  );


  chip.append(
    name,
    remove
  );


  return chip;

}


/* =========================================================
   SUMMARY
========================================================= */

export function renderBoardSummary() {

  const state =
    getRotaState();


  const plannedPeople =
    new Set(
      state.draftEntries.map(
        (
          entry
        ) =>
          entry.personId
      )
    );


  const holidayPeople =
    new Set(
      state.draftEntries
        .filter(
          (
            entry
          ) =>
            entry.positionType ===
            ROTA_POSITION_TYPES.HOLIDAY
        )
        .map(
          (
            entry
          ) =>
            entry.personId
        )
    );


  const unavailablePeople =
    new Set(
      state.draftEntries
        .filter(
          (
            entry
          ) =>
            entry.positionType ===
            ROTA_POSITION_TYPES.UNAVAILABLE
        )
        .map(
          (
            entry
          ) =>
            entry.personId
        )
    );


  updateText(
    "rotaPeoplePlanned",
    String(
      plannedPeople.size
    )
  );


  updateText(
    "rotaPeopleUnscheduled",
    String(
      Math.max(
        0,
        state.people.length -
        plannedPeople.size
      )
    )
  );


  updateText(
    "rotaHolidayCount",
    String(
      holidayPeople.size
    )
  );


  updateText(
    "rotaUnavailableCount",
    String(
      unavailablePeople.size
    )
  );


  updateText(
    "rotaProjectCount",
    String(
      state.projects.length
    )
  );

}


/* =========================================================
   GENERAL UI
========================================================= */

export function renderRotaStatus() {

  const state =
    getRotaState();


  const unsaved =
    document.getElementById(
      "rotaUnsavedIndicator"
    );


  if (
    unsaved
  ) {

    unsaved.hidden =
      !state.dirty;

  }


  const publish =
    document.getElementById(
      "rotaPublish"
    );


if (
  publish
) {

  publish.disabled =
    !state.dirty;

  publish.title =
    state.dirty
      ? "Publish the current rota changes."
      : "No unpublished changes.";

}


  const discard =
    document.getElementById(
      "rotaDiscardChanges"
    );


  if (
    discard
  ) {

    discard.disabled =
      !state.dirty;

  }


  updateText(
    "rotaHeroStatus",
    state.dirty
      ? "Draft changes"
      : state.publishedVersionId
        ? "Published"
        : "Not published"
  );


  updateText(
    "rotaPublishedStatus",
    state.publishedVersionId
      ? "Published"
      : "No published rota"
  );


  updateText(
    "rotaPublishedAt",
    state.publishedAt
      ? formatDateTime(
          state.publishedAt
        )
      : "—"
  );

}


/* =========================================================
   FILTER OPTIONS
========================================================= */

export function renderTradeOptions(
  people
) {

  const select =
    document.getElementById(
      "rotaTradeFilter"
    );


  if (
    !select
  ) {

    return;

  }


  const current =
    select.value;


  const trades =
    [
      ...new Set(
        people
          .map(
            (
              person
            ) =>
              person.primaryTrade
          )
          .filter(Boolean)
      )
    ]
      .sort(
        (
          a,
          b
        ) =>
          a.localeCompare(b)
      );


  select.replaceChildren();


  const all =
    document.createElement(
      "option"
    );


  all.value =
    "";


  all.textContent =
    "All trades";


  select.append(
    all
  );


  trades.forEach(
    (
      trade
    ) => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        trade;


      option.textContent =
        trade;


      select.append(
        option
      );

    }
  );


  select.value =
    trades.includes(current)
      ? current
      : "";

}


/* =========================================================
   HELPERS
========================================================= */

function initials(
  name
) {

  return String(
    name ||
    ""
  )
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (
        part
      ) =>
        part[0] ||
        ""
    )
    .join("")
    .toUpperCase() ||
    "—";

}


function updateText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (
    element
  ) {

    element.textContent =
      value;

  }

}


function createEmptyState(
  title,
  message
) {

  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    "rota-empty-state";


  const heading =
    document.createElement(
      "strong"
    );


  heading.textContent =
    title;


  const text =
    document.createElement(
      "span"
    );


  text.textContent =
    message;


  wrapper.append(
    heading,
    text
  );


  return wrapper;

}


function formatDateTime(
  value
) {

  const date =
    value instanceof Date
      ? value
      : new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }


  return date.toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}