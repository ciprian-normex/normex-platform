import {
  callInduction,
  errorMessage,
  escapeHtml,
  formatDate,
  inductionNav,
  setNotice,
  waitForProfile
} from "../induction-core.js";


/* =========================================================
   NORMEX PEOPLE
   INDUCTION TRACKER
========================================================= */

const EXPIRING_DAYS =
  30;


const elements = {
  pageNav:
    document.querySelector(
      "#pageNav"
    ),

  notice:
    document.querySelector(
      "#notice"
    ),

  scope:
    document.querySelector(
      "#trackerScope"
    ),

  refresh:
    document.querySelector(
      "#refreshTrackerButton"
    ),

  kpiTotal:
    document.querySelector(
      "#kpiTotal"
    ),

  kpiValid:
    document.querySelector(
      "#kpiValid"
    ),

  kpiExpiry:
    document.querySelector(
      "#kpiExpiry"
    ),

  kpiAction:
    document.querySelector(
      "#kpiAction"
    ),

  attentionCount:
    document.querySelector(
      "#attentionCount"
    ),

  attentionList:
    document.querySelector(
      "#attentionList"
    ),

  visibleCount:
    document.querySelector(
      "#visibleCount"
    ),

  search:
    document.querySelector(
      "#searchFilter"
    ),

  status:
    document.querySelector(
      "#statusFilter"
    ),

  employment:
    document.querySelector(
      "#employmentFilter"
    ),

  company:
    document.querySelector(
      "#companyFilter"
    ),

  fromDate:
    document.querySelector(
      "#fromDateFilter"
    ),

  toDate:
    document.querySelector(
      "#toDateFilter"
    ),

  clearFilters:
    document.querySelector(
      "#clearFiltersButton"
    ),

  rows:
    document.querySelector(
      "#trackerRows"
    ),

  modal:
    document.querySelector(
      "#manageModal"
    ),

  modalTitle:
    document.querySelector(
      "#manageModalTitle"
    ),

  modalSubtitle:
    document.querySelector(
      "#manageModalSubtitle"
    ),

  modalNotice:
    document.querySelector(
      "#manageReadOnlyNotice"
    ),

  closeModal:
    document.querySelector(
      "#closeManageModalButton"
    ),

  managePerson:
    document.querySelector(
      "#managePerson"
    ),

  manageNumber:
    document.querySelector(
      "#manageInductionNumber"
    ),

  manageCompleted:
    document.querySelector(
      "#manageCompleted"
    ),

  manageExpiry:
    document.querySelector(
      "#manageExpiry"
    ),

  manageAttempts:
    document.querySelector(
      "#manageAttempts"
    ),

  manageReinduction:
    document.querySelector(
      "#manageReinduction"
    ),

  manageControls:
    document.querySelector(
      "#manageRecordControls"
    ),

  manageStatus:
    document.querySelector(
      "#manageStatus"
    ),

  manageNote:
    document.querySelector(
      "#manageNote"
    ),

  resetAttempts:
    document.querySelector(
      "#resetAttemptsButton"
    ),

  activateReinduction:
    document.querySelector(
      "#activateReinductionButton"
    ),

  certificateLink:
    document.querySelector(
      "#manageCertificateLink"
    ),

  saveManagement:
    document.querySelector(
      "#saveManagementButton"
    )
};


const state = {
  profile:
    null,

  canManage:
    false,

  legacyUnscopedVisible:
    false,

  records:
    [],

  people:
    [],

  requests:
    [],

  items:
    [],

  filtered:
    [],

  active:
    null,

  loading:
    false
};


if (elements.pageNav) {
  elements.pageNav.innerHTML =
    inductionNav(
      "tracker"
    );
}


initialise();


/* =========================================================
   INITIALISE
========================================================= */

async function initialise() {
  try {
    state.profile =
      await waitForProfile();


    wireEvents();


    await loadTracker();

  } catch (error) {
    console.error(
      "[NORMEX Induction Tracker] Initialisation failed",
      error
    );


    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );


    renderUnavailable();
  }
}


/* =========================================================
   LOAD
========================================================= */

async function loadTracker() {
  if (state.loading) {
    return;
  }


  state.loading =
    true;


  setRefreshState(
    true
  );


  setNotice(
    elements.notice,
    "Loading induction tracker..."
  );


  try {
    const data =
      await callInduction(
        "LIST_TRACKER"
      );


    state.records =
      Array.isArray(data?.records)
        ? data.records
        : [];


    state.people =
      Array.isArray(data?.people)
        ? data.people
        : [];


    state.requests =
      Array.isArray(data?.requests)
        ? data.requests
        : [];


    state.canManage =
      data?.canManage === true;


    state.legacyUnscopedVisible =
      data?.legacyUnscopedVisible === true;


    state.items =
      buildItems();


    renderScope();
    populateFilters();
    renderMetrics();
    renderAttention();
    applyFilters();


    setNotice(
      elements.notice,
      ""
    );

  } catch (error) {
    console.error(
      "[NORMEX Induction Tracker] Load failed",
      error
    );


    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );


    renderUnavailable();

  } finally {
    state.loading =
      false;


    setRefreshState(
      false
    );
  }
}


/* =========================================================
   NORMALISE WORKFORCE ITEMS
========================================================= */

function buildItems() {
  const requestsByPerson =
    new Map();


  for (
    const request
    of state.requests
  ) {
    if (!request?.personId) {
      continue;
    }


    const previous =
      requestsByPerson.get(
        request.personId
      );


    if (
      !previous ||
      String(
        request.updatedAt ||
        ""
      ) >
      String(
        previous.updatedAt ||
        ""
      )
    ) {
      requestsByPerson.set(
        request.personId,
        request
      );
    }
  }


  return state.people
    .filter(
      person =>
        person?.active !==
        false
    )
    .map(
      person => {
        const record =
          person.induction ||
          null;


        const request =
          requestsByPerson.get(
            person.personId
          ) ||
          null;


        return {
          personId:
            clean(
              person.personId
            ),

          name:
            clean(
              person.displayName
            ) ||
            "Unnamed person",

          employmentType:
            clean(
              person.employmentType
            ),

          role:
            clean(
              person.primaryTrade
            ),

          record,

          request,

          number:
            clean(
              record?.inductionNumber
            ),

          company:
            clean(
              record?.contractor
            ),

          completedAt:
            clean(
              record?.completedAt ||
              record?.issuedAt
            ),

          expiresAt:
            clean(
              record?.expiresAt
            ),

          attempts:
            Number(
              request?.attemptsUsed ??
              record?.attemptsUsed ??
              0
            ),

          state:
            calculateState(
              record,
              request
            )
        };
      }
    );
}


/* =========================================================
   STATUS
========================================================= */

function calculateState(
  record,
  request
) {
  const requestStatus =
    upper(
      request?.status
    );


  if (
    requestStatus ===
    "FAILED"
  ) {
    return "FAILED";
  }


  if (
    requestStatus ===
    "PENDING_MANAGER_APPROVAL"
  ) {
    return "PENDING";
  }


  const raw =
    upper(
      record?.status
    );


  if (
    raw === "SUSPENDED" ||
    raw === "INVALID" ||
    raw === "REINDUCTION_ACTIVE"
  ) {
    return raw;
  }


  if (!record) {
    return "OUTSTANDING";
  }


  const expiry =
    parseDate(
      record.expiresAt
    );


  if (expiry) {
    const now =
      startOfToday();


    if (
      expiry.getTime() <
      now.getTime()
    ) {
      return "EXPIRED";
    }


    const threshold =
      new Date(
        now
      );


    threshold.setDate(
      threshold.getDate() +
      EXPIRING_DAYS
    );


    if (
      expiry.getTime() <=
      threshold.getTime()
    ) {
      return "EXPIRING";
    }
  }


  if (
    raw === "EXPIRED"
  ) {
    return "EXPIRED";
  }


  return raw ||
    "VALID";
}


/* =========================================================
   SCOPE
========================================================= */

function renderScope() {
  if (!elements.scope) {
    return;
  }


  if (
    state.legacyUnscopedVisible
  ) {
    elements.scope.textContent =
      "Platform scope";
  } else {
    elements.scope.textContent =
      "Organisation scope";
  }
}


/* =========================================================
   KPI
========================================================= */

function renderMetrics() {
  const activeItems =
    state.items;


  const valid =
    activeItems.filter(
      item =>
        item.state ===
        "VALID"
    ).length;


  const expiry =
    activeItems.filter(
      item =>
        item.state ===
          "EXPIRING" ||
        item.state ===
          "EXPIRED"
    ).length;


  const attention =
    activeItems.filter(
      item =>
        needsAttention(
          item
        )
    ).length;


  setText(
    elements.kpiTotal,
    activeItems.length
  );


  setText(
    elements.kpiValid,
    valid
  );


  setText(
    elements.kpiExpiry,
    expiry
  );


  setText(
    elements.kpiAction,
    attention
  );
}


/* =========================================================
   ATTENTION
========================================================= */

function needsAttention(item) {
  return [
    "FAILED",
    "PENDING",
    "EXPIRED",
    "SUSPENDED",
    "INVALID"
  ].includes(
    item.state
  );
}


function renderAttention() {
  const items =
    state.items
      .filter(
        needsAttention
      )
      .sort(
        attentionSort
      );


  setText(
    elements.attentionCount,
    items.length
  );


  if (!items.length) {
    elements.attentionList.innerHTML =
      `
        <div class="tracker-attention-empty">
          No induction records currently require management action.
        </div>
      `;

    return;
  }


  elements.attentionList.innerHTML =
    items
      .map(
        item => {
          const copy =
            attentionCopy(
              item
            );


          return `
            <article class="tracker-attention-item ${copy.critical ? "is-critical" : ""}">

              <span class="tracker-attention-item__icon">
                ${escapeHtml(copy.icon)}
              </span>

              <div>

                <strong>
                  ${escapeHtml(item.name)}
                </strong>

                <p>
                  ${escapeHtml(copy.message)}
                </p>

              </div>

              <button
                type="button"
                data-manage-person="${escapeHtml(item.personId)}"
              >
                Review
              </button>

            </article>
          `;
        }
      )
      .join("");
}


function attentionCopy(item) {
  switch (
    item.state
  ) {
    case "FAILED":
      return {
        icon:
          "!",

        critical:
          true,

        message:
          `Assessment attempts exhausted or failed. ${item.attempts} attempt${item.attempts === 1 ? "" : "s"} recorded.`
      };


    case "PENDING":
      return {
        icon:
          "↻",

        critical:
          false,

        message:
          `Reinduction request is awaiting management approval${item.number ? ` for ${item.number}` : ""}.`
      };


    case "EXPIRED":
      return {
        icon:
          "!",

        critical:
          true,

        message:
          `Induction ${item.number || "record"} expired ${formatDate(item.expiresAt)}.`
      };


    case "SUSPENDED":
      return {
        icon:
          "!",

        critical:
          true,

        message:
          `Induction ${item.number || "record"} is suspended.`
      };


    case "INVALID":
      return {
        icon:
          "!",

        critical:
          true,

        message:
          `Induction ${item.number || "record"} is marked invalid.`
      };


    default:
      return {
        icon:
          "i",

        critical:
          false,

        message:
          "Review the induction record."
      };
  }
}


function attentionSort(
  left,
  right
) {
  const priority = {
    FAILED:
      1,

    SUSPENDED:
      2,

    INVALID:
      3,

    EXPIRED:
      4,

    PENDING:
      5
  };


  return (
    priority[left.state] -
    priority[right.state]
  );
}


/* =========================================================
   FILTER OPTIONS
========================================================= */

function populateFilters() {
  populateSelect(
    elements.employment,
    uniqueSorted(
      state.items.map(
        item =>
          item.employmentType
      )
    ),
    "All employment types"
  );


  populateSelect(
    elements.company,
    uniqueSorted(
      state.items.map(
        item =>
          item.company
      )
    ),
    "All companies"
  );
}


function populateSelect(
  element,
  values,
  firstLabel
) {
  if (!element) {
    return;
  }


  const current =
    element.value;


  element.innerHTML =
    `
      <option value="">
        ${escapeHtml(firstLabel)}
      </option>
      ${values
        .map(
          value =>
            `
              <option value="${escapeHtml(value)}">
                ${escapeHtml(value)}
              </option>
            `
        )
        .join("")}
    `;


  if (
    values.includes(
      current
    )
  ) {
    element.value =
      current;
  }
}


/* =========================================================
   FILTER
========================================================= */

function applyFilters() {
  const term =
    clean(
      elements.search?.value
    ).toLowerCase();


  const wantedStatus =
    upper(
      elements.status?.value
    );


  const wantedEmployment =
    clean(
      elements.employment?.value
    );


  const wantedCompany =
    clean(
      elements.company?.value
    );


  const from =
    elements.fromDate?.value ||
    "";


  const to =
    elements.toDate?.value ||
    "";


  state.filtered =
    state.items.filter(
      item => {
        if (
          wantedStatus &&
          item.state !==
          wantedStatus
        ) {
          return false;
        }


        if (
          wantedEmployment &&
          item.employmentType !==
          wantedEmployment
        ) {
          return false;
        }


        if (
          wantedCompany &&
          item.company !==
          wantedCompany
        ) {
          return false;
        }


        if (
          from &&
          (
            !item.completedAt ||
            item.completedAt.slice(
              0,
              10
            ) <
            from
          )
        ) {
          return false;
        }


        if (
          to &&
          (
            !item.completedAt ||
            item.completedAt.slice(
              0,
              10
            ) >
            to
          )
        ) {
          return false;
        }


        if (term) {
          const haystack =
            [
              item.name,
              item.role,
              item.employmentType,
              item.company,
              item.number,
              item.state
            ]
              .join(" ")
              .toLowerCase();


          if (
            !haystack.includes(
              term
            )
          ) {
            return false;
          }
        }


        return true;
      }
    );


  renderRows();


  setText(
    elements.visibleCount,
    `${state.filtered.length} ${state.filtered.length === 1 ? "person" : "people"}`
  );
}


/* =========================================================
   TABLE
========================================================= */

function renderRows() {
  if (!state.filtered.length) {
    elements.rows.innerHTML =
      `
        <tr>
          <td
            colspan="8"
            class="tracker-empty"
          >
            No people match the current filters.
          </td>
        </tr>
      `;

    return;
  }


  elements.rows.innerHTML =
    state.filtered
      .map(
        item => {
          const certificate =
            item.number
              ? `
                  <a
                    class="tracker-certificate-link"
                    href="../certificate/?id=${encodeURIComponent(item.number)}"
                    target="_blank"
                    rel="noopener"
                  >
                    Certificate
                  </a>
                `
              : "";


          const manage =
            `
              <button
                class="tracker-row-button"
                type="button"
                data-manage-person="${escapeHtml(item.personId)}"
              >
                ${state.canManage ? "Manage" : "Details"}
              </button>
            `;


          return `
            <tr>

              <td>

                <div class="tracker-person">

                  <a
                    href="/modules/contractor/people/person/?id=${encodeURIComponent(item.personId)}"
                  >
                    ${escapeHtml(item.name)}
                  </a>

                  <span>
                    ${escapeHtml(item.personId)}
                  </span>

                </div>

              </td>


              <td>

                <div class="tracker-cell-stack">

                  <strong>
                    ${escapeHtml(item.role || "—")}
                  </strong>

                  <span>
                    ${escapeHtml(item.employmentType || "—")}
                  </span>

                </div>

              </td>


              <td>
                <span class="tracker-status tracker-status--${escapeHtml(item.state.toLowerCase())}">
                  ${escapeHtml(statusLabel(item.state))}
                </span>
              </td>


              <td>

                <div class="tracker-cell-stack">

                  <strong>
                    ${escapeHtml(item.number || "—")}
                  </strong>

                  <span>
                    ${escapeHtml(item.company || "—")}
                  </span>

                </div>

              </td>


              <td>
                ${escapeHtml(formatDate(item.completedAt))}
              </td>


              <td>
                ${escapeHtml(formatDate(item.expiresAt))}
              </td>


              <td>
                ${escapeHtml(String(item.attempts || 0))}
              </td>


              <td>

                <div class="tracker-row-actions">

                  ${manage}

                  ${certificate}

                </div>

              </td>

            </tr>
          `;
        }
      )
      .join("");
}


/* =========================================================
   MODAL
========================================================= */

function openModal(
  personId
) {
  const item =
    state.items.find(
      candidate =>
        candidate.personId ===
        personId
    );


  if (!item) {
    return;
  }


  state.active =
    item;


  setText(
    elements.modalTitle,
    item.name
  );


  setText(
    elements.modalSubtitle,
    item.state ===
      "OUTSTANDING"
      ? "No completed induction record"
      : `${statusLabel(item.state)} · ${item.number || "No induction number"}`
  );


  setText(
    elements.managePerson,
    item.name
  );


  setText(
    elements.manageNumber,
    item.number ||
    "—"
  );


  setText(
    elements.manageCompleted,
    formatDate(
      item.completedAt
    )
  );


  setText(
    elements.manageExpiry,
    formatDate(
      item.expiresAt
    )
  );


  setText(
    elements.manageAttempts,
    item.request
      ? String(
          item.attempts
        )
      : "—"
  );


  setText(
    elements.manageReinduction,
    item.record?.reinductionAllowed
      ? "Allowed"
      : item.request?.status ===
          "PENDING_MANAGER_APPROVAL"
        ? "Approval requested"
        : "Not active"
  );


  const recordStatus =
    upper(
      item.record?.status
    );


  if (
    recordStatus &&
    [
      "VALID",
      "SUSPENDED",
      "INVALID",
      "REINDUCTION_ACTIVE"
    ].includes(
      recordStatus
    )
  ) {
    elements.manageStatus.value =
      recordStatus;
  } else {
    elements.manageStatus.value =
      "VALID";
  }


  elements.manageNote.value =
    "";


  const hasRecord =
    Boolean(
      item.number
    );


  const hasRequest =
    Boolean(
      item.request
    );


  elements.manageControls.hidden =
    !hasRecord;


  elements.manageStatus.disabled =
    !state.canManage ||
    !hasRecord;


  elements.manageNote.disabled =
    !state.canManage ||
    !hasRecord;


  elements.saveManagement.disabled =
    !state.canManage ||
    !hasRecord;


  elements.activateReinduction.disabled =
    !state.canManage ||
    !hasRecord;


  elements.resetAttempts.disabled =
    !state.canManage ||
    !hasRequest;


  if (hasRecord) {
    elements.certificateLink.hidden =
      false;


    elements.certificateLink.href =
      `../certificate/?id=${encodeURIComponent(item.number)}`;
  } else {
    elements.certificateLink.hidden =
      true;
  }


  if (!state.canManage) {
    elements.modalNotice.hidden =
      false;


    elements.modalNotice.textContent =
      "You can review this induction record, but your current access does not allow management changes.";
  } else if (!hasRecord) {
    elements.modalNotice.hidden =
      false;


    elements.modalNotice.textContent =
      "This person does not yet have a completed induction record. Assessment request controls remain available where applicable.";
  } else {
    elements.modalNotice.hidden =
      true;


    elements.modalNotice.textContent =
      "";
  }


  elements.modal.hidden =
    false;


  document.body.style.overflow =
    "hidden";
}


function closeModal() {
  elements.modal.hidden =
    true;


  state.active =
    null;


  document.body.style.overflow =
    "";
}


/* =========================================================
   ADMIN ACTIONS
========================================================= */

async function saveManagement() {
  const item =
    state.active;


  if (
    !item ||
    !item.number ||
    !state.canManage
  ) {
    return;
  }


  setModalBusy(
    true
  );


  try {
    await callInduction(
      "ADMIN_UPDATE",
      {
        inductionNumber:
          item.number,

        adminAction:
          "ADMIN_UPDATE",

        status:
          elements.manageStatus.value,

        note:
          elements.manageNote.value
      }
    );


    setNotice(
      elements.notice,
      "Induction record updated.",
      "success"
    );


    closeModal();


    await loadTracker();

  } catch (error) {
    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );

  } finally {
    setModalBusy(
      false
    );
  }
}


async function activateReinduction() {
  const item =
    state.active;


  if (
    !item ||
    !item.number ||
    !state.canManage
  ) {
    return;
  }


  setModalBusy(
    true
  );


  try {
    await callInduction(
      "ADMIN_UPDATE",
      {
        inductionNumber:
          item.number,

        adminAction:
          "REINDUCTION_ACTIVATED",

        status:
          "REINDUCTION_ACTIVE",

        note:
          clean(
            elements.manageNote.value
          ) ||
          "Reinduction activated from workforce induction tracker."
      }
    );


    setNotice(
      elements.notice,
      "Reinduction activated.",
      "success"
    );


    closeModal();


    await loadTracker();

  } catch (error) {
    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );

  } finally {
    setModalBusy(
      false
    );
  }
}


async function resetAttempts() {
  const item =
    state.active;


  if (
    !item ||
    !state.canManage
  ) {
    return;
  }


  setModalBusy(
    true
  );


  try {
    await callInduction(
      "ADMIN_UPDATE",
      {
        personId:
          item.personId,

        adminAction:
          "RESET_ATTEMPTS"
      }
    );


    setNotice(
      elements.notice,
      "Assessment attempts reset.",
      "success"
    );


    closeModal();


    await loadTracker();

  } catch (error) {
    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );

  } finally {
    setModalBusy(
      false
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

function wireEvents() {
  elements.refresh
    ?.addEventListener(
      "click",
      loadTracker
    );


  [
    elements.search,
    elements.status,
    elements.employment,
    elements.company,
    elements.fromDate,
    elements.toDate
  ]
    .forEach(
      element => {
        element?.addEventListener(
          "input",
          applyFilters
        );


        element?.addEventListener(
          "change",
          applyFilters
        );
      }
    );


  elements.clearFilters
    ?.addEventListener(
      "click",
      clearFilters
    );


  elements.rows
    ?.addEventListener(
      "click",
      handleManageClick
    );


  elements.attentionList
    ?.addEventListener(
      "click",
      handleManageClick
    );


  elements.closeModal
    ?.addEventListener(
      "click",
      closeModal
    );


  elements.modal
    ?.addEventListener(
      "click",
      event => {
        if (
          event.target.dataset
            ?.closeModal ===
          "true"
        ) {
          closeModal();
        }
      }
    );


  elements.saveManagement
    ?.addEventListener(
      "click",
      saveManagement
    );


  elements.activateReinduction
    ?.addEventListener(
      "click",
      activateReinduction
    );


  elements.resetAttempts
    ?.addEventListener(
      "click",
      resetAttempts
    );


  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
          "Escape" &&
        !elements.modal.hidden
      ) {
        closeModal();
      }
    }
  );
}


function handleManageClick(
  event
) {
  const button =
    event.target.closest(
      "[data-manage-person]"
    );


  if (!button) {
    return;
  }


  openModal(
    button.dataset.managePerson
  );
}


function clearFilters() {
  elements.search.value =
    "";

  elements.status.value =
    "";

  elements.employment.value =
    "";

  elements.company.value =
    "";

  elements.fromDate.value =
    "";

  elements.toDate.value =
    "";


  applyFilters();
}


/* =========================================================
   UI STATE
========================================================= */

function setRefreshState(
  loading
) {
  if (!elements.refresh) {
    return;
  }


  elements.refresh.disabled =
    Boolean(loading);


  elements.refresh.textContent =
    loading
      ? "Refreshing..."
      : "Refresh";
}


function setModalBusy(
  busy
) {
  [
    elements.saveManagement,
    elements.activateReinduction,
    elements.resetAttempts
  ]
    .forEach(
      button => {
        if (button) {
          button.disabled =
            Boolean(busy);
        }
      }
    );
}


function renderUnavailable() {
  elements.rows.innerHTML =
    `
      <tr>
        <td
          colspan="8"
          class="tracker-empty"
        >
          Induction tracker data is unavailable.
        </td>
      </tr>
    `;


  elements.attentionList.innerHTML =
    `
      <div class="tracker-attention-empty">
        Attention data is unavailable.
      </div>
    `;
}


/* =========================================================
   HELPERS
========================================================= */

function statusLabel(
  status
) {
  const labels = {
    VALID:
      "Valid",

    EXPIRING:
      "Expiring",

    EXPIRED:
      "Expired",

    OUTSTANDING:
      "Outstanding",

    FAILED:
      "Failed",

    PENDING:
      "Pending approval",

    SUSPENDED:
      "Suspended",

    INVALID:
      "Invalid",

    REINDUCTION_ACTIVE:
      "Reinduction active"
  };


  return labels[status] ||
    status ||
    "Unknown";
}


function uniqueSorted(
  values
) {
  return Array.from(
    new Set(
      values
        .map(
          clean
        )
        .filter(
          Boolean
        )
    )
  ).sort(
    (left, right) =>
      left.localeCompare(
        right
      )
  );
}


function clean(value) {
  return String(
    value ??
    ""
  ).trim();
}


function upper(value) {
  return clean(
    value
  ).toUpperCase();
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


function startOfToday() {
  const date =
    new Date();


  date.setHours(
    0,
    0,
    0,
    0
  );


  return date;
}


function setText(
  element,
  value
) {
  if (element) {
    element.textContent =
      String(
        value ??
        "—"
      );
  }
}
