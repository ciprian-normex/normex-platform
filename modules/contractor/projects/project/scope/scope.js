import {
  auth,
  db,
  storage
} from "/js/firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

import {
  renderProjectNav
} from "/modules/contractor/projects/shared/project-nav.js";


/* =========================================================
   STATE
========================================================= */

let currentProfile = null;
let currentProject = null;
let currentProjectId = null;

let canEditScopeDefinition = false;
let canUpdateScopeProgress = false;

let allScopes = [];

let scopeDocuments = new Map();
let scopeDocumentsByScope = new Map();

let selectedScopeForEdit = null;
let selectedScopeForCompletion = null;
let selectedScopeForDocuments = null;


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_FILE_SIZE =
  25 * 1024 * 1024;


const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];


/* =========================================================
   BASIC HELPERS
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


  if (!element) {
    return;
  }


  element.textContent =
    value ?? "";

}


function setInput(
  id,
  value
) {

  const element =
    getElement(id);


  if (!element) {
    return;
  }


  element.value =
    value ?? "";

}


function cleanString(value) {

  return String(
    value ?? ""
  ).trim();

}


function nullableString(value) {

  const cleaned =
    cleanString(value);


  return cleaned || null;

}


function currentUid() {

  return (
    auth.currentUser?.uid ||
    currentProfile?.uid ||
    null
  );

}


function currentUserName() {

  return (
    currentProfile?.displayName ||
    auth.currentUser?.displayName ||
    currentProfile?.email ||
    auth.currentUser?.email ||
    "NORMEX User"
  );

}


/* =========================================================
   URL
========================================================= */

function getProjectId() {

  return new URLSearchParams(
    window.location.search
  ).get("id");

}


/* =========================================================
   WORKSPACE READY
========================================================= */

function waitForWorkspace() {

  if (
    window.NORMEX_CURRENT_USER
  ) {

    initialiseScopePage(
      window.NORMEX_CURRENT_USER
    );

    return;

  }


  window.addEventListener(
    "normex:workspace-ready",
    (event) => {

      initialiseScopePage(
        event.detail.profile
      );

    },
    {
      once: true
    }
  );

}


/* =========================================================
   PROJECT
========================================================= */

async function loadProject() {

  const snapshot =
    await getDoc(
      doc(
        db,
        "projects",
        currentProjectId
      )
    );


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
   ACCESS
========================================================= */

async function determineScopeAccess() {

  const uid =
    currentUid();


  canEditScopeDefinition =
    false;

  canUpdateScopeProgress =
    false;


  if (!uid) {

    return;

  }


  if (
    Number(
      currentProfile?.accessLevel
    ) >= 99
  ) {

    canEditScopeDefinition =
      true;

    canUpdateScopeProgress =
      true;

    return;

  }


  const permissions =
    currentProfile?.permissions ||
    {};


  if (
    permissions
      .canManageOrganisation === true
  ) {

    canEditScopeDefinition =
      true;

    canUpdateScopeProgress =
      true;

  }


  try {

    const membershipSnapshot =
      await getDoc(
        doc(
          db,
          "projects",
          currentProjectId,
          "members",
          uid
        )
      );


    if (
      !membershipSnapshot.exists()
    ) {

      return;

    }


    const membership =
      membershipSnapshot.data();


    if (
      membership.active !== true
    ) {

      return;

    }


    if (
      membership.canManageProject === true
    ) {

      canEditScopeDefinition =
        true;

      canUpdateScopeProgress =
        true;

    }


    if (
      membership.canManageScopeProgress === true
    ) {

      canUpdateScopeProgress =
        true;

    }


  } catch (error) {

    console.warn(
      "NORMEX scope permission lookup failed:",
      error
    );

  }

}


/* =========================================================
   LOAD SCOPES
========================================================= */

async function loadScopes() {

  const scopeQuery =
    query(
      collection(
        db,
        "projectScopes"
      ),
      where(
        "projectId",
        "==",
        currentProjectId
      )
    );


  const snapshot =
    await getDocs(
      scopeQuery
    );


  allScopes =
    snapshot.docs
      .map(
        (item) => ({

          id:
            item.id,

          ...item.data()

        })
      )
      .filter(
        (scope) =>

          scope.organisationId ===
            currentProject.organisationId &&

          scope.archived !== true
      )
      .sort(
        compareScopes
      );


  await loadScopeDocuments();


  renderSummary();

  applyFilters();

}


/* =========================================================
   SORT
========================================================= */

function compareScopes(
  a,
  b
) {

  const aComplete =
    a.status === "COMPLETE";

  const bComplete =
    b.status === "COMPLETE";


  if (
    aComplete !== bComplete
  ) {

    return aComplete
      ? 1
      : -1;

  }


  return String(
    a.scopeCode || ""
  ).localeCompare(
    String(
      b.scopeCode || ""
    ),
    undefined,
    {
      numeric: true
    }
  );

}


/* =========================================================
   LOAD CANONICAL SCOPE DOCUMENTS
========================================================= */

async function loadScopeDocuments() {

  scopeDocuments =
    new Map();


  scopeDocumentsByScope =
    new Map();


  try {

    /*
     * Query only SCOPE documents.
     *
     * This is important because commercial documents may
     * have different permissions.
     */

    const documentQuery =
      query(
        collection(
          db,
          "documents"
        ),
        where(
          "projectId",
          "==",
          currentProjectId
        ),
        where(
          "category",
          "==",
          "SCOPE"
        )
      );


    const snapshot =
      await getDocs(
        documentQuery
      );


    const documents =
      snapshot.docs
        .map(
          (item) => ({

            id:
              item.id,

            ...item.data()

          })
        )
        .filter(
          (documentRecord) =>

            documentRecord.organisationId ===
              currentProject.organisationId &&

            documentRecord.sourceRecordType ===
              "PROJECT_SCOPE"
        );


    documents.forEach(
      (documentRecord) => {

        scopeDocuments.set(
          documentRecord.id,
          documentRecord
        );


        const scopeId =
          documentRecord.sourceRecordId ||
          documentRecord.scopeId;


        if (!scopeId) {

          return;

        }


        if (
          !scopeDocumentsByScope.has(
            scopeId
          )
        ) {

          scopeDocumentsByScope.set(
            scopeId,
            []
          );

        }


        scopeDocumentsByScope
          .get(scopeId)
          .push(
            documentRecord
          );

      }
    );


    scopeDocumentsByScope.forEach(
      (documentsForScope) => {

        documentsForScope.sort(
          (a, b) =>

            timestampToMilliseconds(
              b.uploadedAt
            ) -

            timestampToMilliseconds(
              a.uploadedAt
            )
        );

      }
    );


  } catch (error) {

    console.error(
      "NORMEX scope document register load error:",
      error
    );

  }

}


/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

  setText(
    "scopeTotalCount",
    allScopes.length
  );


  setText(
    "scopeLiveCount",
    allScopes.filter(
      (scope) =>
        scope.status === "LIVE"
    ).length
  );


  setText(
    "scopePreStartCount",
    allScopes.filter(
      (scope) =>
        scope.status === "PRE_START"
    ).length
  );


  setText(
    "scopeCompleteCount",
    allScopes.filter(
      (scope) =>
        scope.status === "COMPLETE"
    ).length
  );


  setText(
    "scopeEvidenceCount",
    allScopes.filter(
      (scope) => {

        const documents =
          scopeDocumentsByScope.get(
            scope.id
          ) || [];


        return documents.some(
          (documentRecord) =>
            documentRecord.uploadStatus ===
              "COMPLETE"
        );

      }
    ).length
  );

}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

  const search =
    cleanString(
      getElement(
        "scopeSearchInput"
      )?.value
    ).toLowerCase();


  const status =
    cleanString(
      getElement(
        "scopeStatusFilter"
      )?.value
    );


  const filtered =
    allScopes.filter(
      (scope) => {

        const searchable =
          [
            scope.scopeCode,
            scope.name,
            scope.description
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        const matchesSearch =
          !search ||
          searchable.includes(
            search
          );


        const matchesStatus =
          !status ||
          scope.status === status;


        return (
          matchesSearch &&
          matchesStatus
        );

      }
    );


  renderRegister(
    filtered
  );

}


/* =========================================================
   REGISTER
========================================================= */

function renderRegister(
  scopes
) {

  const root =
    getElement(
      "scopeRegister"
    );


  if (!root) {

    return;

  }


  if (!scopes.length) {

    root.innerHTML = `
      <div class="scope-empty">
        No scopes match the current project view.
      </div>
    `;

    return;

  }


  root.innerHTML = `
    <table class="scope-table">

      <thead>

        <tr>

          <th>
            Ref
          </th>

          <th>
            Scope
          </th>

          <th>
            Status
          </th>

          <th>
            Planned Start
          </th>

          <th>
            Target Finish
          </th>

          <th>
            Evidence
          </th>

          <th>
            Completion
          </th>

          <th></th>

        </tr>

      </thead>


      <tbody>

        ${scopes
          .map(
            renderScopeRow
          )
          .join("")}

      </tbody>

    </table>
  `;


  bindRenderedRowEvents();

}


/* =========================================================
   SCOPE ROW
========================================================= */

function renderScopeRow(
  scope
) {

  const documentsForScope =
    scopeDocumentsByScope.get(
      scope.id
    ) || [];


  const completeDocuments =
    documentsForScope.filter(
      (documentRecord) =>
        documentRecord.uploadStatus ===
          "COMPLETE"
    );


  const documentCount =
    completeDocuments.length;


  const completed =
    scope.status ===
      "COMPLETE";


  return `
    <tr class="${
      completed
        ? "is-completed"
        : ""
    }">

      <td>

        <span class="scope-table__code">
          ${escapeHtml(
            scope.scopeCode ||
            "—"
          )}
        </span>

      </td>


      <td class="scope-table__name">

        <strong>
          ${escapeHtml(
            scope.name ||
            "Untitled Scope"
          )}
        </strong>

        <span>
          ${escapeHtml(
            scope.description ||
            "No description recorded"
          )}
        </span>

      </td>


      <td>
        ${renderStatusChip(
          scope.status
        )}
      </td>


      <td>
        ${escapeHtml(
          formatDate(
            scope.plannedStart
          )
        )}
      </td>


      <td>
        ${escapeHtml(
          formatDate(
            scope.targetFinishDate
          )
        )}
      </td>


      <td>
        ${renderScopeDocumentCount(
          documentCount
        )}
      </td>


      <td>
        ${renderCompletion(
          scope
        )}
      </td>


      <td>

        <div class="scope-row-actions">

          <button
            class="scope-small-action"
            type="button"
            data-scope-documents="${escapeHtml(
              scope.id
            )}"
          >
            ${
              documentCount > 0
                ? "Documents"
                : "Add Document"
            }
          </button>


          ${
            !completed &&
            canEditScopeDefinition
              ? `
                <button
                  class="scope-small-action"
                  type="button"
                  data-edit-scope="${escapeHtml(
                    scope.id
                  )}"
                >
                  Edit
                </button>
              `
              : ""
          }


          ${
            !completed &&
            canUpdateScopeProgress
              ? `
                <button
                  class="scope-complete-action"
                  type="button"
                  data-complete-scope="${escapeHtml(
                    scope.id
                  )}"
                >
                  Complete
                </button>
              `
              : ""
          }

        </div>

      </td>

    </tr>
  `;

}


/* =========================================================
   ROW EVENTS
========================================================= */

function bindRenderedRowEvents() {

  document
    .querySelectorAll(
      "[data-scope-documents]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openScopeDocuments(
              button.dataset
                .scopeDocuments
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-edit-scope]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openEditScope(
              button.dataset
                .editScope
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-complete-scope]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openCompleteScope(
              button.dataset
                .completeScope
            );

          }
        );

      }
    );

}


/* =========================================================
   DOCUMENT COUNT
========================================================= */

function renderScopeDocumentCount(
  count
) {

  if (!count) {

    return "—";

  }


  return `
    <span class="scope-document-count">

      <span class="scope-document-count__dot"></span>

      ${count}
      ${
        count === 1
          ? "Document"
          : "Documents"
      }

    </span>
  `;

}


/* =========================================================
   COMPLETION
========================================================= */

function renderCompletion(
  scope
) {

  if (
    scope.status !==
      "COMPLETE"
  ) {

    return "—";

  }


  const variance =
    calculateFinishVariance(
      scope.targetFinishDate,
      scope.actualFinish
    );


  return `
    <div class="scope-completion">

      <span class="scope-completion__date">
        ${escapeHtml(
          formatDate(
            scope.actualFinish
          )
        )}
      </span>

      ${
        variance
          ? `
            <span
              class="
                scope-completion__variance
                ${variance.className}
              "
            >
              ${escapeHtml(
                variance.label
              )}
            </span>
          `
          : ""
      }

    </div>
  `;

}


/* =========================================================
   STATUS
========================================================= */

function renderStatusChip(
  status
) {

  const state =
    status ||
    "PLANNED";


  let className =
    "scope-chip";


  if (
    state === "LIVE"
  ) {

    className +=
      " is-live";

  }


  if (
    state === "COMPLETE"
  ) {

    className +=
      " is-complete";

  }


  if (
    state === "PRE_START"
  ) {

    className +=
      " is-pre";

  }


  if (
    state === "ON_HOLD"
  ) {

    className +=
      " is-hold";

  }


  return `
    <span class="${className}">
      ${escapeHtml(
        formatStatus(
          state
        )
      )}
    </span>
  `;

}


/* =========================================================
   VIEW DOCUMENT
========================================================= */

async function viewDocument(
  documentId
) {

  const documentRecord =
    scopeDocuments.get(
      documentId
    );


  if (
    !documentRecord?.storagePath
  ) {

    return;

  }


  try {

    const downloadUrl =
      await getDownloadURL(
        ref(
          storage,
          documentRecord.storagePath
        )
      );


    window.open(
      downloadUrl,
      "_blank",
      "noopener,noreferrer"
    );


  } catch (error) {

    console.error(
      "NORMEX document open error:",
      error
    );


    window.alert(
      "The document could not be opened."
    );

  }

}


/* =========================================================
   SCOPE DOCUMENTS MODAL
========================================================= */

function openScopeDocuments(
  scopeId
) {

  const scope =
    allScopes.find(
      (item) =>
        item.id === scopeId
    );


  if (!scope) {

    return;

  }


  selectedScopeForDocuments =
    scope;


  setText(
    "scopeDocumentsSubtitle",
    `${scope.scopeCode} · ${scope.name}`
  );


  renderScopeDocumentsModal();


  const uploadSection =
    getElement(
      "scopeDocumentUploadSection"
    );


  if (uploadSection) {

    /*
     * For now supporting evidence upload remains available
     * to full scope managers.
     */

    uploadSection.hidden =
      !canEditScopeDefinition;

  }


  const modal =
    getElement(
      "scopeDocumentsModal"
    );


  if (modal) {

    modal.hidden =
      false;

  }


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE DOCUMENTS MODAL
========================================================= */

function closeScopeDocuments() {

  selectedScopeForDocuments =
    null;


  const modal =
    getElement(
      "scopeDocumentsModal"
    );


  if (modal) {

    modal.hidden =
      true;

  }


  document.body.style.overflow =
    "";


  resetAdditionalDocumentForm();

}


/* =========================================================
   RENDER DOCUMENT LIST
========================================================= */

function renderScopeDocumentsModal() {

  const root =
    getElement(
      "scopeDocumentsList"
    );


  if (
    !root ||
    !selectedScopeForDocuments
  ) {

    return;

  }


  const documents =
    scopeDocumentsByScope.get(
      selectedScopeForDocuments.id
    ) || [];


  if (!documents.length) {

    root.innerHTML = `
      <div class="scope-empty">
        No documents are currently attached to this scope.
      </div>
    `;

    return;

  }


  root.innerHTML =
    documents
      .map(
        (documentRecord) => {

          const complete =
            documentRecord.uploadStatus ===
              "COMPLETE";


          return `
            <article class="scope-document-row">

              <div class="scope-document-row__main">

                <span class="scope-document-row__type">
                  ${escapeHtml(
                    formatDocumentType(
                      documentRecord.documentType
                    )
                  )}
                </span>


                <strong class="scope-document-row__title">
                  ${escapeHtml(
                    documentRecord.title ||
                    documentRecord.fileName ||
                    "Document"
                  )}
                </strong>


                <div class="scope-document-row__meta">

                  ${
                    documentRecord.reference
                      ? `
                        <span>
                          Ref:
                          ${escapeHtml(
                            documentRecord.reference
                          )}
                        </span>
                      `
                      : ""
                  }


                  ${
                    documentRecord.revision
                      ? `
                        <span>
                          Rev
                          ${escapeHtml(
                            documentRecord.revision
                          )}
                        </span>
                      `
                      : ""
                  }


                  <span>
                    ${escapeHtml(
                      formatFirestoreDate(
                        documentRecord.uploadedAt
                      )
                    )}
                  </span>


                  <span>
                    ${escapeHtml(
                      documentRecord.uploadedByName ||
                      "NORMEX User"
                    )}
                  </span>


                  ${
                    !complete
                      ? `
                        <span>
                          Upload Pending
                        </span>
                      `
                      : ""
                  }

                </div>

              </div>


              <div class="scope-document-row__actions">

                ${
                  complete
                    ? `
                      <button
                        class="scope-small-action"
                        type="button"
                        data-modal-view-document="${escapeHtml(
                          documentRecord.id
                        )}"
                      >
                        View
                      </button>
                    `
                    : ""
                }

              </div>

            </article>
          `;

        }
      )
      .join("");


  root
    .querySelectorAll(
      "[data-modal-view-document]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            viewDocument(
              button.dataset
                .modalViewDocument
            );

          }
        );

      }
    );

}


/* =========================================================
   ADDITIONAL DOCUMENT SELECTION
========================================================= */

function handleAdditionalDocumentSelection() {

  const file =
    getElement(
      "scopeAdditionalFile"
    )?.files?.[0];


  if (!file) {

    setText(
      "scopeAdditionalFileTitle",
      "Select PDF or image"
    );


    setText(
      "scopeAdditionalFileMeta",
      "PDF, JPG or PNG · Maximum 25 MB"
    );


    return;

  }


  setText(
    "scopeAdditionalFileTitle",
    file.name
  );


  setText(
    "scopeAdditionalFileMeta",
    `${formatFileSize(
      file.size
    )} · ${formatMimeType(
      file.type
    )}`
  );


  const titleInput =
    getElement(
      "scopeDocumentTitleInput"
    );


  if (
    titleInput &&
    !cleanString(
      titleInput.value
    )
  ) {

    titleInput.value =
      removeFileExtension(
        file.name
      );

  }

}


/* =========================================================
   ADDITIONAL DOCUMENT UPLOAD
========================================================= */

async function uploadAdditionalScopeDocument(
  event
) {

  event.preventDefault();


  if (
    !selectedScopeForDocuments ||
    !canEditScopeDefinition
  ) {

    return;

  }


  hideScopeDocumentError();


  const form =
    new FormData(
      event.currentTarget
    );


  const file =
    getElement(
      "scopeAdditionalFile"
    )?.files?.[0];


  if (!file) {

    showScopeDocumentError(
      "Select a document to upload."
    );

    return;

  }


  const fileError =
    validateFile(
      file
    );


  if (fileError) {

    showScopeDocumentError(
      fileError
    );

    return;

  }


  const documentType =
    cleanString(
      form.get(
        "documentType"
      )
    ) ||
    "SCOPE_DOCUMENT";


  const reference =
    nullableString(
      form.get(
        "reference"
      )
    );


  const title =
    nullableString(
      form.get(
        "title"
      )
    ) ||
    removeFileExtension(
      file.name
    );


  const scopeId =
    selectedScopeForDocuments.id;


  const scopeCode =
    selectedScopeForDocuments.scopeCode;


  const documentReference =
    doc(
      collection(
        db,
        "documents"
      )
    );


  const storagePath =
    buildStoragePath(
      documentReference.id,
      file.name
    );


  const uid =
    currentUid();


  const button =
    getElement(
      "uploadScopeDocumentButton"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Uploading...";

  }


  showAdditionalUploadProgress();


  try {

    /*
     * Step 1:
     * create canonical Firestore document metadata.
     */

    const createBatch =
      writeBatch(db);


    createBatch.set(
      documentReference,
      {

        organisationId:
          currentProject.organisationId,

        projectId:
          currentProjectId,

        scopeId,

        category:
          "SCOPE",

        documentType,

        title,

        reference,

        revision:
          "1",

        status:
          "PENDING_UPLOAD",

        sourceRecordType:
          "PROJECT_SCOPE",

        sourceRecordId:
          scopeId,

        storagePath,

        fileName:
          file.name,

        mimeType:
          file.type,

        fileSize:
          file.size,

        uploadedByUid:
          uid,

        uploadedByName:
          currentUserName(),

        uploadedAt:
          serverTimestamp(),

        supersedesDocumentId:
          null,

        supersededByDocumentId:
          null,

        isCurrent:
          true,

        uploadStatus:
          "PENDING"

      }
    );


    await createBatch.commit();


    /*
     * Step 2:
     * upload actual file to Storage.
     */

    await uploadAdditionalScopeFile(
      file,
      documentReference.id,
      storagePath
    );


    /*
     * Step 3:
     * mark canonical metadata complete.
     */

    const completionBatch =
      writeBatch(db);


    completionBatch.update(
      documentReference,
      {

        status:
          "CURRENT",

        uploadStatus:
          "COMPLETE",

        updatedByUid:
          uid,

        updatedAt:
          serverTimestamp()

      }
    );


    /*
     * Keep first successful document as the convenient
     * primaryDocumentId if the scope does not already have one.
     */

    if (
      !selectedScopeForDocuments.primaryDocumentId
    ) {

      completionBatch.update(
        doc(
          db,
          "projectScopes",
          scopeId
        ),
        {

          primaryDocumentId:
            documentReference.id,

          updatedByUid:
            uid,

          updatedAt:
            serverTimestamp()

        }
      );

    }


    createActivityInBatch(
      completionBatch,
      {

        type:
          "DOCUMENT_UPLOADED",

        sourceRecordId:
          scopeId,

        documentId:
          documentReference.id,

        documentType,

        summary:
          `${scopeCode} · ${title}`

      }
    );


    await completionBatch.commit();


    /*
     * Refresh canonical project data and reopen the same
     * scope document register.
     */

    await loadScopes();


    selectedScopeForDocuments =
      allScopes.find(
        (scope) =>
          scope.id === scopeId
      ) ||
      null;


    if (
      selectedScopeForDocuments
    ) {

      setText(
        "scopeDocumentsSubtitle",
        `${selectedScopeForDocuments.scopeCode} · ${selectedScopeForDocuments.name}`
      );


      renderScopeDocumentsModal();

    }


    resetAdditionalDocumentForm();


  } catch (error) {

    console.error(
      "NORMEX additional scope document upload error:",
      error
    );


    showScopeDocumentError(
      "The document could not be uploaded."
    );


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Add Document";

    }

  }

}


/* =========================================================
   STORAGE UPLOAD - ADDITIONAL DOCUMENT
========================================================= */

function uploadAdditionalScopeFile(
  file,
  documentId,
  storagePath
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const uploadTask =
        uploadBytesResumable(
          ref(
            storage,
            storagePath
          ),
          file,
          {

            contentType:
              file.type,

            customMetadata: {

              organisationId:
                currentProject.organisationId,

              projectId:
                currentProjectId,

              documentId,

              category:
                "scope",

              uploadedByUid:
                currentUid()

            }

          }
        );


      uploadTask.on(
        "state_changed",

        (snapshot) => {

          const percentage =
            snapshot.totalBytes
              ? Math.round(
                  (
                    snapshot.bytesTransferred /
                    snapshot.totalBytes
                  ) * 100
                )
              : 0;


          updateAdditionalUploadProgress(
            percentage
          );

        },

        reject,

        resolve
      );

    }
  );

}


/* =========================================================
   CREATE SCOPE MODAL
========================================================= */

function openScopeModal() {

  resetScopeForm();


  const modal =
    getElement(
      "scopeModal"
    );


  if (modal) {

    modal.hidden =
      false;

  }


  document.body.style.overflow =
    "hidden";

}


function closeScopeModal() {

  const modal =
    getElement(
      "scopeModal"
    );


  if (modal) {

    modal.hidden =
      true;

  }


  document.body.style.overflow =
    "";


  resetScopeForm();

}



/* =========================================================
   CREATE SCOPE
========================================================= */

async function createScope(
  event
) {

  event.preventDefault();


  hideCreateError();


  if (
    !canEditScopeDefinition
  ) {

    showCreateError(
      "You do not have permission to create project scopes."
    );

    return;

  }


  const form =
    new FormData(
      event.currentTarget
    );


  const data = {

    scopeCode:
      cleanString(
        form.get(
          "scopeCode"
        )
      ),

    name:
      cleanString(
        form.get(
          "name"
        )
      ),

    status:
      cleanString(
        form.get(
          "status"
        )
      ) ||
      "PLANNED",

    plannedStart:
      nullableString(
        form.get(
          "plannedStart"
        )
      ),

    targetFinishDate:
      nullableString(
        form.get(
          "targetFinishDate"
        )
      ),

    description:
      nullableString(
        form.get(
          "description"
        )
      )

  };


  if (
    !data.scopeCode ||
    !data.name
  ) {

    showCreateError(
      "Scope code and scope name are required."
    );

    return;

  }


  if (
    data.plannedStart &&
    data.targetFinishDate &&
    data.targetFinishDate <
      data.plannedStart
  ) {

    showCreateError(
      "Target finish cannot be before planned start."
    );

    return;

  }


  const file =
    getElement(
      "scopeFile"
    )?.files?.[0] ||
    null;


  const fileError =
    validateFile(
      file
    );


  if (fileError) {

    showCreateError(
      fileError
    );

    return;

  }


  const uid =
    currentUid();


  const scopeReference =
    doc(
      collection(
        db,
        "projectScopes"
      )
    );


  const documentReference =
    file
      ? doc(
          collection(
            db,
            "documents"
          )
        )
      : null;


  const storagePath =
    file &&
    documentReference
      ? buildStoragePath(
          documentReference.id,
          file.name
        )
      : null;


  const button =
    getElement(
      "saveScopeButton"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Creating...";

  }


  try {

    /*
     * Create scope + optional document metadata + activity
     * in one Firestore batch.
     */

    const batch =
      writeBatch(db);


    batch.set(
      scopeReference,
      {

        organisationId:
          currentProject.organisationId,

        projectId:
          currentProjectId,

        phaseId:
          currentProject.currentPhaseId ||
          null,

        scopeCode:
          data.scopeCode,

        name:
          data.name,

        description:
          data.description,

        status:
          data.status,

        plannedStart:
          data.plannedStart,

        targetFinishDate:
          data.targetFinishDate,

        actualStart:
          null,

        actualFinish:
          null,

        responsibleManagerUid:
          null,

        primaryDocumentId:
          documentReference?.id ||
          null,

        archived:
          false,

        archivedAt:
          null,

        createdByUid:
          uid,

        createdByName:
          currentUserName(),

        createdAt:
          serverTimestamp(),

        updatedByUid:
          uid,

        updatedAt:
          serverTimestamp()

      }
    );


    if (
      documentReference &&
      file
    ) {

      batch.set(
        documentReference,
        {

          organisationId:
            currentProject.organisationId,

          projectId:
            currentProjectId,

          scopeId:
            scopeReference.id,

          category:
            "SCOPE",

          documentType:
            "SCOPE_DOCUMENT",

          title:
            data.name,

          reference:
            data.scopeCode,

          revision:
            "1",

          status:
            "PENDING_UPLOAD",

          sourceRecordType:
            "PROJECT_SCOPE",

          sourceRecordId:
            scopeReference.id,

          storagePath,

          fileName:
            file.name,

          mimeType:
            file.type,

          fileSize:
            file.size,

          uploadedByUid:
            uid,

          uploadedByName:
            currentUserName(),

          uploadedAt:
            serverTimestamp(),

          supersedesDocumentId:
            null,

          supersededByDocumentId:
            null,

          isCurrent:
            true,

          uploadStatus:
            "PENDING"

        }
      );

    }


    createActivityInBatch(
      batch,
      {

        type:
          "PROJECT_SCOPE_CREATED",

        sourceRecordId:
          scopeReference.id,

        summary:
          `${data.scopeCode} · ${data.name}`

      }
    );


    await batch.commit();


    /*
     * Upload optional initial scope document.
     */

    if (
      documentReference &&
      file &&
      storagePath
    ) {

      if (button) {

        button.textContent =
          "Uploading...";

      }


      showUploadProgress();


      await uploadScopeFile(
        file,
        documentReference.id,
        storagePath
      );


      const completionBatch =
        writeBatch(db);


      completionBatch.update(
        documentReference,
        {

          status:
            "CURRENT",

          uploadStatus:
            "COMPLETE",

          updatedByUid:
            uid,

          updatedAt:
            serverTimestamp()

        }
      );


      createActivityInBatch(
        completionBatch,
        {

          type:
            "DOCUMENT_UPLOADED",

          sourceRecordId:
            scopeReference.id,

          documentId:
            documentReference.id,

          documentType:
            "SCOPE_DOCUMENT",

          summary:
            file.name

        }
      );


      await completionBatch.commit();

    }


    closeScopeModal();


    await loadScopes();


  } catch (error) {

    console.error(
      "NORMEX scope creation error:",
      error
    );


    showCreateError(
      "The scope could not be created."
    );


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Create Scope";

    }

  }

}


/* =========================================================
   EDIT SCOPE
========================================================= */

function openEditScope(
  scopeId
) {

  const scope =
    allScopes.find(
      (item) =>
        item.id === scopeId
    );


  if (
    !scope ||
    scope.status === "COMPLETE"
  ) {

    return;

  }


  selectedScopeForEdit =
    scope;


  setInput(
    "editScopeCode",
    scope.scopeCode
  );


  setInput(
    "editScopeName",
    scope.name
  );


  setInput(
    "editScopeStatus",
    scope.status ||
    "PLANNED"
  );


  setInput(
    "editScopePlannedStart",
    scope.plannedStart
  );


  setInput(
    "editScopeTargetFinish",
    scope.targetFinishDate
  );


  setInput(
    "editScopeDescription",
    scope.description
  );


  const error =
    getElement(
      "editScopeError"
    );


  if (error) {

    error.hidden =
      true;

  }


  const modal =
    getElement(
      "editScopeModal"
    );


  if (modal) {

    modal.hidden =
      false;

  }


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE EDIT
========================================================= */

function closeEditScope() {

  selectedScopeForEdit =
    null;


  const modal =
    getElement(
      "editScopeModal"
    );


  if (modal) {

    modal.hidden =
      true;

  }


  document.body.style.overflow =
    "";

}


/* =========================================================
   SAVE EDIT
========================================================= */

async function saveScopeEdit(
  event
) {

  event.preventDefault();


  if (
    !selectedScopeForEdit ||
    !canEditScopeDefinition
  ) {

    return;

  }


  hideEditError();


  const form =
    new FormData(
      event.currentTarget
    );


  const next = {

    scopeCode:
      cleanString(
        form.get(
          "scopeCode"
        )
      ),

    name:
      cleanString(
        form.get(
          "name"
        )
      ),

    status:
      cleanString(
        form.get(
          "status"
        )
      ),

    plannedStart:
      nullableString(
        form.get(
          "plannedStart"
        )
      ),

    targetFinishDate:
      nullableString(
        form.get(
          "targetFinishDate"
        )
      ),

    description:
      nullableString(
        form.get(
          "description"
        )
      )

  };


  if (
    !next.scopeCode ||
    !next.name
  ) {

    showEditError(
      "Scope code and scope name are required."
    );

    return;

  }


  if (
    next.plannedStart &&
    next.targetFinishDate &&
    next.targetFinishDate <
      next.plannedStart
  ) {

    showEditError(
      "Target finish cannot be before planned start."
    );

    return;

  }


  const changedFields =
    getChangedFields(
      selectedScopeForEdit,
      next
    );


  if (!changedFields.length) {

    closeEditScope();

    return;

  }


  const button =
    getElement(
      "saveEditScope"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Saving...";

  }


  try {

    const batch =
      writeBatch(db);


    batch.update(
      doc(
        db,
        "projectScopes",
        selectedScopeForEdit.id
      ),
      {

        ...next,

        updatedByUid:
          currentUid(),

        updatedAt:
          serverTimestamp()

      }
    );


    createActivityInBatch(
      batch,
      {

        type:
          "PROJECT_SCOPE_UPDATED",

        sourceRecordId:
          selectedScopeForEdit.id,

        changedFields,

        changes:
          buildChanges(
            selectedScopeForEdit,
            next,
            changedFields
          ),

        summary:
          `${selectedScopeForEdit.scopeCode} · ${selectedScopeForEdit.name}`

      }
    );


    await batch.commit();


    closeEditScope();


    await loadScopes();


  } catch (error) {

    console.error(
      "NORMEX scope edit error:",
      error
    );


    showEditError(
      "The scope could not be updated."
    );


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Save Changes";

    }

  }

}


/* =========================================================
   COMPLETE SCOPE
========================================================= */

function openCompleteScope(
  scopeId
) {

  const scope =
    allScopes.find(
      (item) =>
        item.id === scopeId
    );


  if (
    !scope ||
    scope.status === "COMPLETE"
  ) {

    return;

  }


  selectedScopeForCompletion =
    scope;


  const actualFinish =
    getTodayDateString();


  const variance =
    calculateFinishVariance(
      scope.targetFinishDate,
      actualFinish
    );


  setText(
    "completeScopeName",
    `${scope.scopeCode} · ${scope.name}`
  );


  setText(
    "completeScopeTarget",
    formatDate(
      scope.targetFinishDate
    )
  );


  setText(
    "completeScopeDate",
    formatDate(
      actualFinish
    )
  );


  setText(
    "completeScopeVariance",
    variance?.label ||
    "No target finish recorded"
  );


  const error =
    getElement(
      "completeScopeError"
    );


  if (error) {

    error.hidden =
      true;

  }


  const modal =
    getElement(
      "completeScopeModal"
    );


  if (modal) {

    modal.hidden =
      false;

  }


  document.body.style.overflow =
    "hidden";

}


/* =========================================================
   CLOSE COMPLETE
========================================================= */

function closeCompleteScope() {

  selectedScopeForCompletion =
    null;


  const modal =
    getElement(
      "completeScopeModal"
    );


  if (modal) {

    modal.hidden =
      true;

  }


  document.body.style.overflow =
    "";

}


/* =========================================================
   CONFIRM COMPLETE
========================================================= */

async function completeSelectedScope() {

  const scope =
    selectedScopeForCompletion;


  if (
    !scope ||
    !canUpdateScopeProgress
  ) {

    return;

  }


  const actualFinish =
    getTodayDateString();


  const variance =
    calculateFinishVariance(
      scope.targetFinishDate,
      actualFinish
    );


  const button =
    getElement(
      "confirmCompleteScope"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Completing...";

  }


  try {

    const batch =
      writeBatch(db);


    batch.update(
      doc(
        db,
        "projectScopes",
        scope.id
      ),
      {

        status:
          "COMPLETE",

        actualFinish,

        updatedByUid:
          currentUid(),

        updatedAt:
          serverTimestamp()

      }
    );


    createActivityInBatch(
      batch,
      {

        type:
          "PROJECT_SCOPE_COMPLETED",

        sourceRecordId:
          scope.id,

        scopeCode:
          scope.scopeCode,

        scopeName:
          scope.name,

        targetFinishDate:
          scope.targetFinishDate ||
          null,

        actualFinish,

        varianceDays:
          variance?.days ??
          null,

        varianceLabel:
          variance?.label ||
          null,

        summary:
          variance
            ? `${scope.scopeCode} · ${scope.name} · ${variance.label}`
            : `${scope.scopeCode} · ${scope.name} completed`

      }
    );


    await batch.commit();


    closeCompleteScope();


    await loadScopes();


  } catch (error) {

    console.error(
      "NORMEX scope completion error:",
      error
    );


    const errorElement =
      getElement(
        "completeScopeError"
      );


    if (errorElement) {

      errorElement.textContent =
        "The scope could not be completed.";

      errorElement.hidden =
        false;

    }


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Confirm Complete";

    }

  }

}


/* =========================================================
   ACTIVITY
========================================================= */

function createActivityInBatch(
  batch,
  extraData
) {

  const activityReference =
    doc(
      collection(
        db,
        "projects",
        currentProjectId,
        "activity"
      )
    );


  batch.set(
    activityReference,
    {

      organisationId:
        currentProject.organisationId,

      projectId:
        currentProjectId,

      sourceRecordType:
        "PROJECT_SCOPE",

      createdByUid:
        currentUid(),

      createdByName:
        currentUserName(),

      createdAt:
        serverTimestamp(),

      ...extraData

    }
  );

}


/* =========================================================
   CHANGE TRACKING
========================================================= */

function getChangedFields(
  previous,
  next
) {

  return Object
    .keys(next)
    .filter(
      (key) =>

        JSON.stringify(
          previous[key] ?? null
        ) !==

        JSON.stringify(
          next[key] ?? null
        )
    );

}


function buildChanges(
  previous,
  next,
  changedFields
) {

  const changes = {};


  changedFields.forEach(
    (field) => {

      changes[field] = {

        from:
          previous[field] ??
          null,

        to:
          next[field] ??
          null

      };

    }
  );


  return changes;

}


/* =========================================================
   INITIAL CREATE FILE SELECTION
========================================================= */

function handleFileSelection() {

  const file =
    getElement(
      "scopeFile"
    )?.files?.[0];


  if (!file) {

    setText(
      "scopeFileTitle",
      "Attach PDF or image"
    );


    setText(
      "scopeFileMeta",
      "PDF, JPG or PNG · Maximum 25 MB"
    );


    return;

  }


  setText(
    "scopeFileTitle",
    file.name
  );


  setText(
    "scopeFileMeta",
    `${formatFileSize(
      file.size
    )} · ${formatMimeType(
      file.type
    )}`
  );

}


/* =========================================================
   STORAGE UPLOAD - INITIAL DOCUMENT
========================================================= */

function uploadScopeFile(
  file,
  documentId,
  storagePath
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const uploadTask =
        uploadBytesResumable(
          ref(
            storage,
            storagePath
          ),
          file,
          {

            contentType:
              file.type,

            customMetadata: {

              organisationId:
                currentProject.organisationId,

              projectId:
                currentProjectId,

              documentId,

              category:
                "scope",

              uploadedByUid:
                currentUid()

            }

          }
        );


      uploadTask.on(
        "state_changed",

        (snapshot) => {

          const percentage =
            snapshot.totalBytes
              ? Math.round(
                  (
                    snapshot.bytesTransferred /
                    snapshot.totalBytes
                  ) * 100
                )
              : 0;


          updateUploadProgress(
            percentage
          );

        },

        reject,

        resolve
      );

    }
  );

}


/* =========================================================
   STORAGE PATH
========================================================= */

function buildStoragePath(
  documentId,
  fileName
) {

  return [
    "organisations",
    currentProject.organisationId,
    "projects",
    currentProjectId,
    "documents",
    "scope",
    documentId,
    sanitiseFileName(
      fileName
    )
  ].join("/");

}


/* =========================================================
   FILE VALIDATION
========================================================= */

function validateFile(
  file
) {

  if (!file) {

    return null;

  }


  if (
    !ALLOWED_FILE_TYPES.includes(
      file.type
    )
  ) {

    return (
      "Only PDF, JPG and PNG files can be uploaded."
    );

  }


  if (
    file.size >
      MAX_FILE_SIZE
  ) {

    return (
      "The selected file is larger than the 25 MB limit."
    );

  }


  return null;

}


/* =========================================================
   COMPLETION VARIANCE
========================================================= */

function calculateFinishVariance(
  targetFinishDate,
  actualFinishDate
) {

  if (
    !targetFinishDate ||
    !actualFinishDate
  ) {

    return null;

  }


  const target =
    parseLocalDate(
      targetFinishDate
    );


  const actual =
    parseLocalDate(
      actualFinishDate
    );


  if (
    !target ||
    !actual
  ) {

    return null;

  }


  const millisecondsPerDay =
    86400000;


  const days =
    Math.round(
      (
        target.getTime() -
        actual.getTime()
      ) /
      millisecondsPerDay
    );


  if (days > 0) {

    return {

      days,

      label:
        formatVarianceLabel(
          days,
          "early"
        ),

      className:
        "is-early"

    };

  }


  if (days < 0) {

    return {

      days,

      label:
        formatVarianceLabel(
          Math.abs(days),
          "late"
        ),

      className:
        "is-late"

    };

  }


  return {

    days: 0,

    label:
      "Completed on target",

    className:
      "is-on-time"

  };

}


/* =========================================================
   DATE HELPERS
========================================================= */

function getTodayDateString() {

  const now =
    new Date();


  return [
    now.getFullYear(),

    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    )
  ].join("-");

}


function parseLocalDate(
  value
) {

  if (!value) {

    return null;

  }


  const parts =
    String(value)
      .slice(
        0,
        10
      )
      .split("-")
      .map(Number);


  if (
    parts.length !== 3 ||
    parts.some(
      (item) =>
        !Number.isFinite(item)
    )
  ) {

    return null;

  }


  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
  );

}


function formatDate(
  value
) {

  if (!value) {

    return "—";

  }


  const date =
    parseLocalDate(
      value
    );


  if (!date) {

    return "—";

  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric"

    }
  ).format(
    date
  );

}


/* =========================================================
   FIRESTORE TIMESTAMP
========================================================= */

function timestampToMilliseconds(
  value
) {

  if (!value) {

    return 0;

  }


  if (
    typeof value.toMillis ===
      "function"
  ) {

    return value.toMillis();

  }


  if (
    typeof value.toDate ===
      "function"
  ) {

    return value
      .toDate()
      .getTime();

  }


  const date =
    new Date(value);


  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();

}


function formatFirestoreDate(
  value
) {

  const milliseconds =
    timestampToMilliseconds(
      value
    );


  if (!milliseconds) {

    return "Pending";

  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric"

    }
  ).format(
    new Date(
      milliseconds
    )
  );

}


/* =========================================================
   FORMATTERS
========================================================= */

function formatVarianceLabel(
  days,
  position
) {

  if (
    days >= 14 &&
    days % 7 === 0
  ) {

    const weeks =
      days / 7;


    return `${weeks} ${
      weeks === 1
        ? "week"
        : "weeks"
    } ${position}`;

  }


  return `${days} ${
    days === 1
      ? "day"
      : "days"
  } ${position}`;

}


function formatStatus(
  value
) {

  return String(
    value ||
    ""
  )
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


function formatDocumentType(
  value
) {

  const labels = {

    SCOPE_DOCUMENT:
      "Scope Document",

    CLIENT_INSTRUCTION:
      "Client Instruction",

    DRAWING:
      "Drawing",

    SKETCH:
      "Sketch",

    PHOTOGRAPH:
      "Photograph",

    SUPPORTING_DETAIL:
      "Supporting Detail",

    OTHER:
      "Other"

  };


  return (
    labels[value] ||
    formatStatus(value)
  );

}


function formatFileSize(
  bytes
) {

  if (
    bytes <
      1024 * 1024
  ) {

    return `${Math.round(
      bytes / 1024
    )} KB`;

  }


  return `${(
    bytes /
    (
      1024 *
      1024
    )
  ).toFixed(1)} MB`;

}


function formatMimeType(
  type
) {

  const labels = {

    "application/pdf":
      "PDF",

    "image/jpeg":
      "JPG",

    "image/png":
      "PNG"

  };


  return (
    labels[type] ||
    "File"
  );

}


function removeFileExtension(
  fileName
) {

  return String(
    fileName ||
    ""
  ).replace(
    /\.[^/.]+$/,
    ""
  );

}


/* =========================================================
   INITIAL UPLOAD PROGRESS
========================================================= */

function showUploadProgress() {

  const progress =
    getElement(
      "scopeUploadProgress"
    );


  if (progress) {

    progress.hidden =
      false;

  }


  updateUploadProgress(
    0
  );

}


function updateUploadProgress(
  percentage
) {

  const bar =
    getElement(
      "scopeUploadProgressBar"
    );


  if (bar) {

    bar.style.width =
      `${percentage}%`;

  }


  setText(
    "scopeUploadProgressText",
    percentage >= 100
      ? "Upload complete"
      : `Uploading ${percentage}%`
  );

}


/* =========================================================
   ADDITIONAL UPLOAD PROGRESS
========================================================= */

function showAdditionalUploadProgress() {

  const progress =
    getElement(
      "scopeAdditionalUploadProgress"
    );


  if (progress) {

    progress.hidden =
      false;

  }


  updateAdditionalUploadProgress(
    0
  );

}


function updateAdditionalUploadProgress(
  percentage
) {

  const bar =
    getElement(
      "scopeAdditionalUploadProgressBar"
    );


  if (bar) {

    bar.style.width =
      `${percentage}%`;

  }


  setText(
    "scopeAdditionalUploadProgressText",
    percentage >= 100
      ? "Upload complete"
      : `Uploading ${percentage}%`
  );

}


/* =========================================================
   CREATE FORM ERRORS
========================================================= */

function hideCreateError() {

  const element =
    getElement(
      "scopeFormError"
    );


  if (element) {

    element.hidden =
      true;

  }

}


function showCreateError(
  message
) {

  const element =
    getElement(
      "scopeFormError"
    );


  if (!element) {

    return;

  }


  element.textContent =
    message;

  element.hidden =
    false;

}


/* =========================================================
   EDIT FORM ERRORS
========================================================= */

function hideEditError() {

  const element =
    getElement(
      "editScopeError"
    );


  if (element) {

    element.hidden =
      true;

  }

}


function showEditError(
  message
) {

  const element =
    getElement(
      "editScopeError"
    );


  if (!element) {

    return;

  }


  element.textContent =
    message;

  element.hidden =
    false;

}


/* =========================================================
   DOCUMENT FORM ERRORS
========================================================= */

function hideScopeDocumentError() {

  const element =
    getElement(
      "scopeDocumentError"
    );


  if (element) {

    element.hidden =
      true;

  }

}


function showScopeDocumentError(
  message
) {

  const element =
    getElement(
      "scopeDocumentError"
    );


  if (!element) {

    return;

  }


  element.textContent =
    message;

  element.hidden =
    false;

}


/* =========================================================
   RESET CREATE FORM
========================================================= */

function resetScopeForm() {

  getElement(
    "scopeForm"
  )?.reset();


  setText(
    "scopeFileTitle",
    "Attach PDF or image"
  );


  setText(
    "scopeFileMeta",
    "PDF, JPG or PNG · Maximum 25 MB"
  );


  const progress =
    getElement(
      "scopeUploadProgress"
    );


  if (progress) {

    progress.hidden =
      true;

  }


  updateUploadProgress(
    0
  );


  hideCreateError();

}


/* =========================================================
   RESET ADDITIONAL DOCUMENT FORM
========================================================= */

function resetAdditionalDocumentForm() {

  getElement(
    "scopeDocumentForm"
  )?.reset();


  setText(
    "scopeAdditionalFileTitle",
    "Select PDF or image"
  );


  setText(
    "scopeAdditionalFileMeta",
    "PDF, JPG or PNG · Maximum 25 MB"
  );


  const progress =
    getElement(
      "scopeAdditionalUploadProgress"
    );


  if (progress) {

    progress.hidden =
      true;

  }


  updateAdditionalUploadProgress(
    0
  );


  hideScopeDocumentError();

}


/* =========================================================
   SAFE FILE NAME
========================================================= */

function sanitiseFileName(
  fileName
) {

  return String(
    fileName ||
    "document"
  )
    .trim()
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  getElement(
    "addScopeButton"
  )?.addEventListener(
    "click",
    openScopeModal
  );


  getElement(
    "closeScopeModal"
  )?.addEventListener(
    "click",
    closeScopeModal
  );


  getElement(
    "cancelScopeButton"
  )?.addEventListener(
    "click",
    closeScopeModal
  );


  getElement(
    "scopeModalBackdrop"
  )?.addEventListener(
    "click",
    closeScopeModal
  );


  getElement(
    "scopeForm"
  )?.addEventListener(
    "submit",
    createScope
  );


  getElement(
    "scopeFile"
  )?.addEventListener(
    "change",
    handleFileSelection
  );


  getElement(
    "scopeSearchInput"
  )?.addEventListener(
    "input",
    applyFilters
  );


  getElement(
    "scopeStatusFilter"
  )?.addEventListener(
    "change",
    applyFilters
  );


  getElement(
    "closeEditScopeModal"
  )?.addEventListener(
    "click",
    closeEditScope
  );


  getElement(
    "cancelEditScope"
  )?.addEventListener(
    "click",
    closeEditScope
  );


  getElement(
    "editScopeBackdrop"
  )?.addEventListener(
    "click",
    closeEditScope
  );


  getElement(
    "editScopeForm"
  )?.addEventListener(
    "submit",
    saveScopeEdit
  );


  getElement(
    "closeCompleteScopeModal"
  )?.addEventListener(
    "click",
    closeCompleteScope
  );


  getElement(
    "cancelCompleteScope"
  )?.addEventListener(
    "click",
    closeCompleteScope
  );


  getElement(
    "completeScopeBackdrop"
  )?.addEventListener(
    "click",
    closeCompleteScope
  );


  getElement(
    "confirmCompleteScope"
  )?.addEventListener(
    "click",
    completeSelectedScope
  );


  getElement(
    "closeScopeDocumentsModal"
  )?.addEventListener(
    "click",
    closeScopeDocuments
  );


  getElement(
    "scopeDocumentsBackdrop"
  )?.addEventListener(
    "click",
    closeScopeDocuments
  );


  getElement(
    "scopeAdditionalFile"
  )?.addEventListener(
    "change",
    handleAdditionalDocumentSelection
  );


  getElement(
    "scopeDocumentForm"
  )?.addEventListener(
    "submit",
    uploadAdditionalScopeDocument
  );

}


/* =========================================================
   INITIALISE
========================================================= */

async function initialiseScopePage(
  profile
) {

  currentProfile =
    profile;


  currentProjectId =
    getProjectId();


  if (!currentProjectId) {

    console.error(
      "NORMEX Scope: no project ID supplied."
    );

    return;

  }


  try {

    currentProject =
      await loadProject();


    if (!currentProject) {

      console.error(
        "NORMEX Scope: project not found."
      );

      return;

    }


    if (
      Number(
        currentProfile.accessLevel
      ) < 99 &&

      currentProject.organisationId !==
        currentProfile.organisationId
    ) {

      console.error(
        "NORMEX Scope: organisation mismatch."
      );

      return;

    }


    renderProjectNav();


    setText(
      "projectSubnavName",
      currentProject.name ||
      "Project"
    );


    await determineScopeAccess();


    const addButton =
      getElement(
        "addScopeButton"
      );


    if (addButton) {

      addButton.hidden =
        !canEditScopeDefinition;

    }


    await loadScopes();


  } catch (error) {

    console.error(
      "NORMEX Scope initialisation error:",
      error
    );

  }

}


/* =========================================================
   START
========================================================= */

bindEvents();

waitForWorkspace();