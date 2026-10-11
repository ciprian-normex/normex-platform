import {
  callInduction,
  canManage,
  errorMessage,
  escapeHtml,
  formatDate,
  inductionNav,
  setNotice,
  waitForProfile
} from "./induction-core.js";


const nav =
  document.querySelector(
    "#pageNav"
  );


const notice =
  document.querySelector(
    "#notice"
  );


const metrics =
  document.querySelector(
    "#metrics"
  );


const currentPack =
  document.querySelector(
    "#currentPack"
  );


const recentActivity =
  document.querySelector(
    "#recentActivity"
  );


const attentionBreakdown =
  document.querySelector(
    "#attentionBreakdown"
  );


nav.innerHTML =
  inductionNav(
    "overview"
  );


/* =========================================================
   INITIALISE
========================================================= */

try {

  const profile =
    await waitForProfile();


  if (
    canManage(
      profile
    )
  ) {

    await loadManagementOverview();

  } else {

    renderWorkerOverview();

  }

} catch (
  error
) {

  setNotice(
    notice,
    errorMessage(
      error
    ),
    "error"
  );


  renderUnavailable();

}


/* =========================================================
   MANAGEMENT OVERVIEW
========================================================= */

async function loadManagementOverview() {

  const [
    trackerResult,
    settingsResult
  ] =
    await Promise.allSettled([

      callInduction(
        "LIST_TRACKER"
      ),

      callInduction(
        "GET_ADMIN_SETTINGS"
      )

    ]);


  if (
    trackerResult.status ===
    "fulfilled"
  ) {

    renderTrackerPosition(
      trackerResult.value
    );

  } else {

    console.error(
      "[NORMEX Inductions] Tracker overview failed",
      trackerResult.reason
    );


    renderTrackerUnavailable();

  }


  if (
    settingsResult.status ===
    "fulfilled"
  ) {

    renderCurrentPack(
      settingsResult.value?.settings ||
      {}
    );

  } else {

    console.error(
      "[NORMEX Inductions] Settings overview failed",
      settingsResult.reason
    );


    renderPackUnavailable();

  }

}


/* =========================================================
   TRACKER POSITION
========================================================= */

function renderTrackerPosition(
  data
) {

  const records =
    Array.isArray(
      data?.records
    )
      ? data.records
      : [];


  const people =
    Array.isArray(
      data?.people
    )
      ? data.people.filter(
          person =>
            person.active !==
            false
        )
      : [];


  const requests =
    Array.isArray(
      data?.requests
    )
      ? data.requests
      : [];


  const latestRecords =
    latestRecordPerPerson(
      records
    );


  const now =
    new Date();


  const sevenDaysAgo =
    new Date(
      now
    );


  sevenDaysAgo.setDate(
    sevenDaysAgo.getDate() -
    7
  );


  const thirtyDaysAhead =
    new Date(
      now
    );


  thirtyDaysAhead.setDate(
    thirtyDaysAhead.getDate() +
    30
  );


  const inducted =
    latestRecords.filter(
      record =>
        [
          "VALID",
          "EXPIRING"
        ].includes(
          normaliseStatus(
            record.status
          )
        )
    ).length;


  const completedLastSevenDays =
    latestRecords.filter(
      record =>
        isWithinRange(
          record.completedAt,
          sevenDaysAgo,
          now
        )
    ).length;


  const expiringNextThirtyDays =
    latestRecords.filter(
      record =>
        isFutureDateWithin(
          record.expiresAt,
          now,
          thirtyDaysAhead
        )
    ).length;


  const expired =
    latestRecords.filter(
      record =>
        normaliseStatus(
          record.status
        ) ===
        "EXPIRED"
    ).length;


  const outstandingPeople =
    people.filter(
      person =>
        !person.induction
    ).length;


  const openRequests =
    requests.filter(
      request =>
        ![
          "COMPLETED",
          "CANCELLED"
        ].includes(
          normaliseStatus(
            request.status
          )
        )
    );


  const failedOrIncomplete =
    openRequests.filter(
      request =>
        [
          "FAILED",
          "IN_PROGRESS",
          "PENDING_MANAGER_APPROVAL",
          "COOLDOWN"
        ].includes(
          normaliseStatus(
            request.status
          )
        )
    ).length;


  const needsAttention =
    outstandingPeople +
    expired +
    failedOrIncomplete;


  metrics.innerHTML =
    [

      metricMarkup({
        value:
          inducted,

        label:
          "People inducted",

        note:
          "Current Core Company Induction"
      }),


      metricMarkup({
        value:
          completedLastSevenDays,

        label:
          "Completed last 7 days",

        note:
          "New and renewed inductions"
      }),


      metricMarkup({
        value:
          expiringNextThirtyDays,

        label:
          "Expiring next 30 days",

        note:
          "Certificates approaching expiry"
      }),


      metricMarkup({
        value:
          needsAttention,

        label:
          "Needs attention",

        note:
          "Outstanding, expired or incomplete"
      })

    ].join("");


  renderRecentActivity(
    latestRecords
  );


  renderAttention({
    outstanding:
      outstandingPeople,

    expiring:
      expiringNextThirtyDays,

    expired,

    incomplete:
      failedOrIncomplete
  });

}


/* =========================================================
   CURRENT PACK
========================================================= */

function renderCurrentPack(
  settings
) {

  const configured =
    settings?.configured ===
    true;


  const videoTitle =
    String(
      settings?.videoTitle ||
      ""
    ).trim() ||
    "Core Company Induction";


  const videoVersion =
    String(
      settings?.videoVersion ||
      ""
    ).trim() ||
    "Not recorded";


  const passMark =
    Number(
      settings?.passMarkPercent ||
      80
    );


  const validity =
    Number(
      settings?.validityMonths ||
      12
    );


  const questionCount =
    Number(
      settings?.questionCount ||
      20
    );


  currentPack.innerHTML = `

    <div class="induction-pack__primary">

      <span class="induction-pack__status ${
        configured
          ? "is-live"
          : "is-warning"
      }">
        ${
          configured
            ? "Current"
            : "Not configured"
        }
      </span>

      <strong>
        ${escapeHtml(videoTitle)}
      </strong>

      <span>
        Core Company Induction
      </span>

    </div>


    <div class="induction-pack__details">


      <div>

        <span>
          Video version
        </span>

        <strong>
          ${escapeHtml(videoVersion)}
        </strong>

      </div>


      <div>

        <span>
          Pass mark
        </span>

        <strong>
          ${passMark}%
        </strong>

      </div>


      <div>

        <span>
          Validity
        </span>

        <strong>
          ${validity} months
        </strong>

      </div>


      <div>

        <span>
          Questions
        </span>

        <strong>
          ${questionCount}
        </strong>

      </div>


    </div>

  `;

}


/* =========================================================
   RECENT ACTIVITY
========================================================= */

function renderRecentActivity(
  records
) {

  const recent =
    [...records]

      .filter(
        record =>
          record.completedAt
      )

      .sort(
        (
          a,
          b
        ) =>
          dateValue(
            b.completedAt
          ) -
          dateValue(
            a.completedAt
          )
      )

      .slice(
        0,
        5
      );


  if (
    !recent.length
  ) {

    recentActivity.innerHTML = `

      <div class="induction-dashboard-empty">

        <strong>
          No recent completions
        </strong>

        <span>
          Completed inductions will appear here.
        </span>

      </div>

    `;


    return;

  }


  recentActivity.innerHTML =
    recent.map(
      record => {

        const status =
          normaliseStatus(
            record.status
          );


        return `

          <div class="induction-activity-row">

            <div class="induction-activity-row__person">

              <strong>
                ${escapeHtml(record.workerName || "Unnamed person")}
              </strong>

              <span>
                ${escapeHtml(record.role || record.primaryTrade || "Role not recorded")}
              </span>

            </div>


            <div class="induction-activity-row__meta">

              <span class="status ${statusClass(status)}">
                ${escapeHtml(statusLabel(status))}
              </span>

              <span>
                ${escapeHtml(formatDate(record.completedAt))}
              </span>

            </div>

          </div>

        `;

      }
    )
    .join("");

}


/* =========================================================
   ATTENTION
========================================================= */

function renderAttention({
  outstanding,
  expiring,
  expired,
  incomplete
}) {

  attentionBreakdown.innerHTML =
    [

      attentionMarkup({
        value:
          outstanding,

        label:
          "Outstanding",

        note:
          "Active people without a current induction",

        tone:
          outstanding
            ? "warning"
            : "clear"
      }),


      attentionMarkup({
        value:
          expiring,

        label:
          "Expiring",

        note:
          "Certificates due within 30 days",

        tone:
          expiring
            ? "warning"
            : "clear"
      }),


      attentionMarkup({
        value:
          expired,

        label:
          "Expired",

        note:
          "Inductions no longer current",

        tone:
          expired
            ? "danger"
            : "clear"
      }),


      attentionMarkup({
        value:
          incomplete,

        label:
          "Incomplete",

        note:
          "Open or failed induction journeys",

        tone:
          incomplete
            ? "warning"
            : "clear"
      })

    ].join("");

}


/* =========================================================
   WORKER VIEW
========================================================= */

function renderWorkerOverview() {

  metrics.innerHTML = `

    <div class="metric">

      <strong>
        Core
      </strong>

      <span>
        Company induction
      </span>

      <small>
        Open My induction to review your current status
      </small>

    </div>

  `;


  currentPack.innerHTML = `

    <div class="induction-dashboard-empty">

      <strong>
        Core Company Induction
      </strong>

      <span>
        Open My induction to continue or review your induction journey.
      </span>

    </div>

  `;


  recentActivity.innerHTML = "";


  attentionBreakdown.innerHTML = "";

}


/* =========================================================
   UNAVAILABLE STATES
========================================================= */

function renderTrackerUnavailable() {

  metrics.innerHTML =
    unavailableMetricMarkup(
      "Workforce induction data unavailable"
    );


  recentActivity.innerHTML = `

    <div class="induction-dashboard-empty">

      <strong>
        Recent activity unavailable
      </strong>

      <span>
        Induction records could not be loaded.
      </span>

    </div>

  `;


  attentionBreakdown.innerHTML = `

    <div class="induction-dashboard-empty">

      <strong>
        Attention position unavailable
      </strong>

      <span>
        Workforce induction status could not be loaded.
      </span>

    </div>

  `;

}


function renderPackUnavailable() {

  currentPack.innerHTML = `

    <div class="induction-dashboard-empty">

      <strong>
        Induction pack unavailable
      </strong>

      <span>
        The current induction settings could not be loaded.
      </span>

    </div>

  `;

}


function renderUnavailable() {

  renderTrackerUnavailable();

  renderPackUnavailable();

}


/* =========================================================
   RECORD HELPERS
========================================================= */

function latestRecordPerPerson(
  records
) {

  const map =
    new Map();


  for (
    const record of records
  ) {

    const key =
      String(
        record.personId ||
        record.linkedUserUid ||
        record.inductionNumber ||
        ""
      ).trim();


    if (
      !key
    ) {

      continue;

    }


    const previous =
      map.get(
        key
      );


    if (
      !previous ||
      dateValue(
        record.completedAt
      ) >
      dateValue(
        previous.completedAt
      )
    ) {

      map.set(
        key,
        record
      );

    }

  }


  return [
    ...map.values()
  ];

}


/* =========================================================
   DATE HELPERS
========================================================= */

function dateValue(
  value
) {

  if (
    !value
  ) {

    return 0;

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


function isWithinRange(
  value,
  from,
  to
) {

  const timestamp =
    dateValue(
      value
    );


  if (
    !timestamp
  ) {

    return false;

  }


  return (
    timestamp >=
      from.getTime() &&
    timestamp <=
      to.getTime()
  );

}


function isFutureDateWithin(
  value,
  from,
  to
) {

  const timestamp =
    dateValue(
      value
    );


  if (
    !timestamp
  ) {

    return false;

  }


  return (
    timestamp >=
      from.getTime() &&
    timestamp <=
      to.getTime()
  );

}


/* =========================================================
   STATUS HELPERS
========================================================= */

function normaliseStatus(
  value
) {

  return String(
    value ||
    ""
  )
    .trim()
    .toUpperCase();

}


function statusLabel(
  status
) {

  return status
    .toLowerCase()
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      character =>
        character.toUpperCase()
    ) ||
    "Unknown";

}


function statusClass(
  status
) {

  if (
    [
      "EXPIRED",
      "INVALID",
      "SUSPENDED",
      "FAILED"
    ].includes(
      status
    )
  ) {

    return "status--expired";

  }


  if (
    [
      "EXPIRING",
      "IN_PROGRESS",
      "PENDING_MANAGER_APPROVAL"
    ].includes(
      status
    )
  ) {

    return "status--expiring";

  }


  return "";

}


/* =========================================================
   MARKUP HELPERS
========================================================= */

function metricMarkup({
  value,
  label,
  note
}) {

  return `

    <div class="metric">

      <span class="metric__label">
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value)}
      </strong>

      <small>
        ${escapeHtml(note)}
      </small>

    </div>

  `;

}


function unavailableMetricMarkup(
  message
) {

  return `

    <div class="metric metric--unavailable">

      <span class="metric__label">
        Workforce induction
      </span>

      <strong>
        —
      </strong>

      <small>
        ${escapeHtml(message)}
      </small>

    </div>

  `;

}


function attentionMarkup({
  value,
  label,
  note,
  tone
}) {

  return `

    <div class="induction-attention-item induction-attention-item--${tone}">

      <strong>
        ${escapeHtml(value)}
      </strong>

      <div>

        <span>
          ${escapeHtml(label)}
        </span>

        <small>
          ${escapeHtml(note)}
        </small>

      </div>

    </div>

  `;

}