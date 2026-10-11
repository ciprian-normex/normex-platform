import {
  escapeHtml,
  formatDate,
  getCertificate,
  publicError,
  searchCertificates
} from "../public-core.js";


/* =========================================================
   NORMEX
   PUBLIC INDUCTION SEARCH / VERIFICATION
========================================================= */

const MAX_RESULTS =
  25;


const form =
  document.querySelector(
    "#verifyForm"
  );


const input =
  document.querySelector(
    "#certificateId"
  );


const button =
  document.querySelector(
    "#verifyButton"
  );


const notice =
  document.querySelector(
    "#notice"
  );


const statusPanel =
  document.querySelector(
    "#verifyStatusPanel"
  );


const statusIcon =
  document.querySelector(
    "#verifyStatusIcon"
  );


const statusKicker =
  document.querySelector(
    "#verifyStatusKicker"
  );


const statusTitle =
  document.querySelector(
    "#verifyStatusTitle"
  );


const statusMessage =
  document.querySelector(
    "#verifyStatusMessage"
  );


const singleResult =
  document.querySelector(
    "#verifySingleResult"
  );


const searchResults =
  document.querySelector(
    "#verifySearchResults"
  );


const resultCards =
  document.querySelector(
    "#resultCards"
  );


const resultCount =
  document.querySelector(
    "#resultCountText"
  );


const anotherButton =
  document.querySelector(
    "#verifyAnotherBtn"
  );


const viewCertificateButton =
  document.querySelector(
    "#viewCertificateBtn"
  );


const requested =
  new URLSearchParams(
    location.search
  ).get("id") ||
  "";


initialise();


function initialise() {
  wireEvents();

  if (requested) {
    input.value =
      requested;

    verifyExact(
      requested
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

function wireEvents() {
  form?.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      runSearch(
        input.value
      );
    }
  );


  anotherButton?.addEventListener(
    "click",
    () => {
      clearResults();

      input.value =
        "";

      setStatus(
        "is-ready",
        "i",
        "Ready",
        "Search the induction register",
        "Enter an induction number, worker name or organisation above."
      );

      input.focus();
    }
  );


  resultCards?.addEventListener(
    "click",
    event => {
      const target =
        event.target.closest(
          "[data-induction-number]"
        );


      if (!target) {
        return;
      }


      verifyExact(
        target.dataset.inductionNumber
      );
    }
  );
}


/* =========================================================
   SEARCH
========================================================= */

async function runSearch(value) {
  const query =
    clean(value);


  clearNotice();
  clearResults();


  if (!query) {
    showNotice(
      "Enter an induction number, worker name or organisation.",
      "warn"
    );

    return;
  }


  if (
    !/^\d+$/.test(query) &&
    query.length < 2
  ) {
    showNotice(
      "Enter at least 2 characters when searching by name or organisation.",
      "warn"
    );

    return;
  }


  setLoading(
    true
  );


  setStatus(
    "is-ready",
    "…",
    "Searching",
    "Searching induction records",
    "Please wait while NORMEX checks the public induction register."
  );


  try {
    const data =
      await searchCertificates(
        query
      );


    const records =
      Array.isArray(
        data?.results
      )
        ? data.results.slice(
            0,
            MAX_RESULTS
          )
        : [];


    if (!records.length) {
      setStatus(
        "is-multiple",
        "?",
        "No match",
        "No induction records found",
        "Try another name, organisation or induction number."
      );

      showNotice(
        `No induction records matched "${query}".`,
        "warn"
      );

      return;
    }


    if (
      records.length === 1
    ) {
      renderSingle(
        records[0]
      );

      return;
    }


    renderMultiple(
      records,
      query
    );

  } catch (error) {
    console.error(
      "[NORMEX public induction search]",
      error
    );


    setStatus(
      "is-blocked",
      "!",
      "Unavailable",
      "Search could not be completed",
      publicError(error)
    );


    showNotice(
      publicError(error),
      "error"
    );

  } finally {
    setLoading(
      false
    );
  }
}


/* =========================================================
   EXACT VERIFY

   QR codes use this path.
========================================================= */

async function verifyExact(
  inductionNumber
) {
  const id =
    clean(
      inductionNumber
    ).toUpperCase();


  if (!id) {
    return;
  }


  clearNotice();
  clearResults();


  input.value =
    id;


  setLoading(
    true
  );


  setStatus(
    "is-ready",
    "…",
    "Checking",
    "Checking induction record",
    "Please wait while NORMEX confirms the current live status."
  );


  try {
    const data =
      await getCertificate(
        id
      );


    if (
      !data?.found ||
      !data?.certificate
    ) {
      setStatus(
        "is-multiple",
        "?",
        "Not found",
        "Induction record not found",
        "No induction record was found for that exact reference."
      );

      return;
    }


    renderSingle(
      data.certificate
    );

  } catch (error) {
    console.error(
      "[NORMEX exact induction verification]",
      error
    );


    setStatus(
      "is-blocked",
      "!",
      "Unavailable",
      "Verification could not be completed",
      publicError(error)
    );


    showNotice(
      publicError(error),
      "error"
    );

  } finally {
    setLoading(
      false
    );
  }
}


/* =========================================================
   SINGLE RESULT
========================================================= */

function renderSingle(record) {
  const state =
    recordState(
      record
    );


  const organisation =
    organisationName(
      record
    );


  singleResult.hidden =
    false;


  searchResults.hidden =
    true;


  setText(
    "#verifyInductionNumber",
    record.inductionNumber ||
    "—"
  );


  setText(
    "#verifyWorkerName",
    record.workerName ||
    "—"
  );


  setText(
    "#verifyCompany",
    organisation
  );


  setText(
    "#verifyRole",
    record.role ||
    "Not recorded"
  );


  setText(
    "#verifyCertificateType",
    record.certificateType ||
    "Induction Completion"
  );


  setText(
    "#verifyCompleted",
    formatDate(
      record.completedAt ||
      record.issuedAt
    )
  );


  setText(
    "#verifyExpiry",
    formatDate(
      record.expiresAt
    )
  );


  setText(
    "#verifySource",
    record.imported
      ? "Legacy induction record"
      : "NORMEX live induction"
  );


  setText(
    "#verifyRecordContext",
    `${organisation} · ${record.certificateType || "Induction Completion"}`
  );


  const recordStatus =
    document.querySelector(
      "#verifyRecordStatus"
    );


  if (recordStatus) {
    recordStatus.textContent =
      state.label;

    recordStatus.className =
      `verify-record-status ${state.cssClass}`.trim();
  }


  if (
    viewCertificateButton &&
    record.inductionNumber
  ) {
    viewCertificateButton.href =
      `../certificate/?id=${encodeURIComponent(record.inductionNumber)}`;
  }


  setStatus(
    state.panelClass,
    state.icon,
    state.label,
    state.title,
    state.message
  );
}


/* =========================================================
   MULTIPLE RESULTS
========================================================= */

function renderMultiple(
  records,
  query
) {
  singleResult.hidden =
    true;


  searchResults.hidden =
    false;


  resultCount.textContent =
    `${records.length} record${records.length === 1 ? "" : "s"} found`;


  setStatus(
    "is-multiple",
    String(
      records.length
    ),
    "Multiple matches",
    "Select the correct induction",
    `More than one induction record matched "${query}".`
  );


  resultCards.innerHTML =
    records
      .map(
        record => {
          const state =
            recordState(
              record
            );


          const organisation =
            organisationName(
              record
            );


          return `
            <article class="verify-result-card ${escapeHtml(state.cardClass)}">

              <div>

                <span class="verify-result-card__status">
                  ${escapeHtml(state.label)}
                </span>

                <h3>
                  ${escapeHtml(record.workerName || "—")}
                </h3>

                <p>
                  ${escapeHtml(record.inductionNumber || "—")}
                  ·
                  ${escapeHtml(organisation)}
                </p>

                <div class="verify-result-card__meta">

                  <span>
                    Completed ${escapeHtml(formatDate(record.completedAt || record.issuedAt))}
                  </span>

                  <span>
                    Valid until ${escapeHtml(formatDate(record.expiresAt))}
                  </span>

                  <span>
                    ${escapeHtml(record.certificateType || "Induction Completion")}
                  </span>

                </div>

              </div>


              <button
                class="verify-result-card__button"
                type="button"
                data-induction-number="${escapeHtml(record.inductionNumber || "")}"
              >
                Check record
              </button>

            </article>
          `;
        }
      )
      .join("");
}


/* =========================================================
   STATUS
========================================================= */

function recordState(record) {
  const raw =
    clean(
      record.status ||
      "VALID"
    ).toUpperCase();


  const expiry =
    parseDate(
      record.expiresAt
    );


  const expired =
    expiry &&
    expiry.getTime() <
      endOfToday().getTime();


  if (
    expired ||
    raw === "EXPIRED"
  ) {
    return {
      label:
        "EXPIRED",

      icon:
        "!",

      title:
        "Induction has expired",

      message:
        "This induction is no longer current and should not be accepted as valid.",

      panelClass:
        "is-expired",

      cssClass:
        "is-expired",

      cardClass:
        "is-expired"
    };
  }


  if (
    raw === "BLOCKED" ||
    raw === "SUSPENDED" ||
    raw === "INVALID"
  ) {
    return {
      label:
        "NOT VALID",

      icon:
        "!",

      title:
        "Induction is not valid",

      message:
        "This induction must not be accepted as a current record.",

      panelClass:
        "is-blocked",

      cssClass:
        "is-blocked",

      cardClass:
        "is-blocked"
    };
  }


  return {
    label:
      "VALID",

    icon:
      "✓",

    title:
      "Induction is current",

    message:
      "This induction record is currently valid.",

    panelClass:
      "is-valid",

    cssClass:
      "",

    cardClass:
      "is-valid"
  };
}


/* =========================================================
   UI HELPERS
========================================================= */

function setStatus(
  className,
  icon,
  kicker,
  title,
  message
) {
  statusPanel.className =
    `verify-status-panel ${className}`;


  statusIcon.textContent =
    icon;


  statusKicker.textContent =
    kicker;


  statusTitle.textContent =
    title;


  statusMessage.textContent =
    message;
}


function clearResults() {
  singleResult.hidden =
    true;


  searchResults.hidden =
    true;


  resultCards.innerHTML =
    "";
}


function showNotice(
  message,
  type
) {
  notice.hidden =
    false;


  notice.className =
    `verify-notice verify-notice--${type}`;


  notice.textContent =
    message;
}


function clearNotice() {
  notice.hidden =
    true;

  notice.textContent =
    "";
}


function setLoading(loading) {
  button.disabled =
    Boolean(loading);


  button.textContent =
    loading
      ? "Searching..."
      : "Search";
}


function setText(
  selector,
  value
) {
  const element =
    document.querySelector(
      selector
    );


  if (element) {
    element.textContent =
      String(
        value ??
        "—"
      );
  }
}


/* =========================================================
   DATA HELPERS
========================================================= */

function organisationName(record) {
  return clean(
    record.organisationName ||
    record.contractor ||
    record.company ||
    "Organisation"
  );
}


function clean(value) {
  return String(
    value ??
    ""
  ).trim();
}


function parseDate(value) {
  if (!value) {
    return null;
  }


  const date =
    new Date(value);


  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


function endOfToday() {
  const today =
    new Date();


  today.setHours(
    23,
    59,
    59,
    999
  );


  return today;
}
