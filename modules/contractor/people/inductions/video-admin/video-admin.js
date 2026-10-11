import {
  callInduction,
  canManage,
  errorMessage,
  formatDate,
  inductionNav,
  setNotice,
  storage,
  waitForProfile
} from "../induction-core.js";


import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";


/* =========================================================
   NORMEX PEOPLE
   INDUCTION PACK ADMINISTRATION
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const MAX_VIDEO_SIZE_BYTES =
  500 * 1024 * 1024;


const DEFAULT_SETTINGS = {
  videoTitle:
    "Core Company Induction",

  videoVersion:
    "",

  questionsPerAssessment:
    20,

  passMarkPercent:
    80,

  maximumAttempts:
    3,

  retryCooldownSeconds:
    60,

  completionToleranceSeconds:
    5,

  validityMonths:
    12
};


/* =========================================================
   DOM
========================================================= */

const elements = {
  pageNav:
    document.querySelector("#pageNav"),

  notice:
    document.querySelector("#notice"),

  heroPackStatus:
    document.querySelector("#heroPackStatus"),

  currentPackBadge:
    document.querySelector("#currentPackBadge"),

  currentVideoPreview:
    document.querySelector("#currentVideoPreview"),

  currentVideoEmpty:
    document.querySelector("#currentVideoEmpty"),

  currentVideoTitle:
    document.querySelector("#currentVideoTitle"),

  currentVideoVersion:
    document.querySelector("#currentVideoVersion"),

  currentQuestionCount:
    document.querySelector("#currentQuestionCount"),

  currentPassMark:
    document.querySelector("#currentPassMark"),

  currentValidity:
    document.querySelector("#currentValidity"),

  currentPublishedAt:
    document.querySelector("#currentPublishedAt"),

  form:
    document.querySelector("#inductionPackForm"),

  videoTitleInput:
    document.querySelector("#videoTitleInput"),

  videoVersionInput:
    document.querySelector("#videoVersionInput"),

  videoFileInput:
    document.querySelector("#videoFileInput"),

  videoDropZone:
    document.querySelector("#videoDropZone"),

  videoFileName:
    document.querySelector("#videoFileName"),

  videoFileHelp:
    document.querySelector("#videoFileHelp"),

  selectedVideoMeta:
    document.querySelector("#selectedVideoMeta"),

  selectedVideoName:
    document.querySelector("#selectedVideoName"),

  selectedVideoSize:
    document.querySelector("#selectedVideoSize"),

  selectedVideoType:
    document.querySelector("#selectedVideoType"),

  questionsPerAssessment:
    document.querySelector(
      "#questionsPerAssessmentInput"
    ),

  passMarkPercent:
    document.querySelector(
      "#passMarkPercentInput"
    ),

  maximumAttempts:
    document.querySelector(
      "#maximumAttemptsInput"
    ),

  retryCooldownSeconds:
    document.querySelector(
      "#retryCooldownSecondsInput"
    ),

  completionToleranceSeconds:
    document.querySelector(
      "#completionToleranceInput"
    ),

  validityMonths:
    document.querySelector(
      "#validityMonthsInput"
    ),

  publishButton:
    document.querySelector(
      "#publishInductionPackButton"
    )
};


/* =========================================================
   STATE
========================================================= */

const state = {
  profile:
    null,

  settings:
    null,

  selectedFile:
    null,

  previewObjectUrl:
    null,

  saving:
    false
};


/* =========================================================
   NAV
========================================================= */

if (elements.pageNav) {
  elements.pageNav.innerHTML =
    inductionNav("video");
}


/* =========================================================
   START
========================================================= */

initialise();


async function initialise() {
  disableForm(true);

  setNotice(
    elements.notice,
    "Loading induction pack..."
  );


  try {
    state.profile =
      await waitForProfile();


    if (!canManage(state.profile)) {
      throw makePermissionError(
        "You do not have permission to manage induction packs."
      );
    }


    wireEvents();


    await loadSettings();


    setNotice(
      elements.notice,
      ""
    );


    disableForm(false);

  } catch (error) {
    console.error(
      "[NORMEX Induction Admin] Initialisation failed",
      error
    );


    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );


    disableForm(true);
  }
}


/* =========================================================
   EVENTS
========================================================= */

function wireEvents() {
  elements.form
    ?.addEventListener(
      "submit",
      handlePublish
    );


  elements.videoFileInput
    ?.addEventListener(
      "change",
      event => {
        const file =
          event.target.files?.[0] ||
          null;


        selectVideoFile(file);
      }
    );


  elements.videoDropZone
    ?.addEventListener(
      "dragover",
      event => {
        event.preventDefault();

        elements.videoDropZone
          ?.classList.add(
            "is-dragging"
          );
      }
    );


  elements.videoDropZone
    ?.addEventListener(
      "dragleave",
      () => {
        elements.videoDropZone
          ?.classList.remove(
            "is-dragging"
          );
      }
    );


  elements.videoDropZone
    ?.addEventListener(
      "drop",
      event => {
        event.preventDefault();


        elements.videoDropZone
          ?.classList.remove(
            "is-dragging"
          );


        const file =
          event.dataTransfer
            ?.files?.[0] ||
          null;


        if (!file) {
          return;
        }


        /*
         * DataTransfer is used so the actual file input
         * remains consistent with the dropped file.
         */
        try {
          const transfer =
            new DataTransfer();


          transfer.items.add(file);


          elements.videoFileInput.files =
            transfer.files;

        } catch {
          /*
           * Some browsers may not allow replacing the
           * FileList. state.selectedFile remains authoritative.
           */
        }


        selectVideoFile(file);
      }
    );
}


/* =========================================================
   LOAD CURRENT SETTINGS
========================================================= */

async function loadSettings() {
  const result =
    await callInduction(
      "GET_ADMIN_SETTINGS"
    );


  const settings =
    normaliseSettings(
      result?.settings
    );


  state.settings =
    settings;


  renderCurrentPack(
    settings
  );


  populateForm(
    settings
  );
}


/* =========================================================
   NORMALISE
========================================================= */

function normaliseSettings(raw) {
  const source =
    raw &&
    typeof raw === "object"
      ? raw
      : {};


  return {
    ...DEFAULT_SETTINGS,
    ...source,

    questionsPerAssessment:
      validNumber(
        source.questionsPerAssessment,
        DEFAULT_SETTINGS.questionsPerAssessment
      ),

    passMarkPercent:
      validNumber(
        source.passMarkPercent,
        DEFAULT_SETTINGS.passMarkPercent
      ),

    maximumAttempts:
      validNumber(
        source.maximumAttempts,
        DEFAULT_SETTINGS.maximumAttempts
      ),

    retryCooldownSeconds:
      validNumber(
        source.retryCooldownSeconds,
        DEFAULT_SETTINGS.retryCooldownSeconds
      ),

    completionToleranceSeconds:
      validNumber(
        source.completionToleranceSeconds ??
          source.videoUnlockSeconds,
        DEFAULT_SETTINGS.completionToleranceSeconds
      ),

    validityMonths:
      validNumber(
        source.validityMonths,
        DEFAULT_SETTINGS.validityMonths
      )
  };
}


/* =========================================================
   RENDER CURRENT PACK
========================================================= */

async function renderCurrentPack(settings) {
  const configured =
    hasPublishedPack(settings);


  setText(
    elements.heroPackStatus,
    configured
      ? settings.videoVersion ||
          "Published"
      : "Not configured"
  );


  setText(
    elements.currentPackBadge,
    configured
      ? "Published"
      : "Not configured"
  );


  elements.currentPackBadge
    ?.classList.toggle(
      "video-admin-status--live",
      configured
    );


  setText(
    elements.currentVideoTitle,
    configured
      ? settings.videoTitle ||
          "Core Company Induction"
      : "Not configured"
  );


  setText(
    elements.currentVideoVersion,
    configured
      ? settings.videoVersion ||
          "—"
      : "—"
  );


  setText(
    elements.currentQuestionCount,
    configured
      ? String(
          settings.questionsPerAssessment
        )
      : "—"
  );


  setText(
    elements.currentPassMark,
    configured
      ? `${settings.passMarkPercent}%`
      : "—"
  );


  setText(
    elements.currentValidity,
    configured
      ? formatValidity(
          settings.validityMonths
        )
      : "—"
  );


  setText(
    elements.currentPublishedAt,
    configured
      ? formatPublishedDate(settings)
      : "—"
  );


  await renderCurrentVideoPreview(
    settings
  );
}


/* =========================================================
   CURRENT VIDEO PREVIEW
========================================================= */

async function renderCurrentVideoPreview(
  settings
) {
  const container =
    elements.currentVideoPreview;


  if (!container) {
    return;
  }


  clearPreviewObjectUrl();


  let videoUrl =
    clean(
      settings?.videoUrl
    );


  /*
   * Prefer the existing URL when returned by the callable.
   * If the backend stores only a Storage path, obtain the URL
   * through Firebase Storage.
   */
  if (
    !videoUrl &&
    settings?.storagePath
  ) {
    try {
      videoUrl =
        await getDownloadURL(
          ref(
            storage,
            settings.storagePath
          )
        );

    } catch (error) {
      console.warn(
        "[NORMEX Induction Admin] Current video URL could not be resolved",
        error
      );
    }
  }


  if (!videoUrl) {
    renderEmptyVideoPreview();

    return;
  }


  container.innerHTML = "";


  const video =
    document.createElement(
      "video"
    );


  video.controls =
    true;

  video.preload =
    "metadata";

  video.playsInline =
    true;

  video.controlsList =
    "nodownload";


  video.src =
    videoUrl;


  container.appendChild(
    video
  );
}


function renderEmptyVideoPreview() {
  const container =
    elements.currentVideoPreview;


  if (!container) {
    return;
  }


  container.innerHTML = `
    <div class="video-admin-preview__empty">

      <span class="video-admin-preview__play">
        ▶
      </span>

      <strong>
        No induction video published
      </strong>

      <span>
        Publish the first induction pack below.
      </span>

    </div>
  `;
}


/* =========================================================
   POPULATE FORM
========================================================= */

function populateForm(settings) {
  setInputValue(
    elements.videoTitleInput,
    settings.videoTitle ||
      DEFAULT_SETTINGS.videoTitle
  );


  /*
   * Version is deliberately not automatically copied after
   * a published pack exists.
   *
   * Publishing changes should have a deliberate new revision.
   */
  setInputValue(
    elements.videoVersionInput,
    hasPublishedPack(settings)
      ? ""
      : settings.videoVersion || ""
  );


  setInputValue(
    elements.questionsPerAssessment,
    settings.questionsPerAssessment
  );


  setInputValue(
    elements.passMarkPercent,
    settings.passMarkPercent
  );


  setInputValue(
    elements.maximumAttempts,
    settings.maximumAttempts
  );


  setInputValue(
    elements.retryCooldownSeconds,
    settings.retryCooldownSeconds
  );


  setInputValue(
    elements.completionToleranceSeconds,
    settings.completionToleranceSeconds
  );


  setInputValue(
    elements.validityMonths,
    settings.validityMonths
  );
}


/* =========================================================
   FILE SELECTION
========================================================= */

function selectVideoFile(file) {
  clearFileNotice();


  if (!file) {
    state.selectedFile =
      null;


    renderSelectedFile(
      null
    );


    return;
  }


  try {
    validateVideoFile(file);

  } catch (error) {
    state.selectedFile =
      null;


    if (elements.videoFileInput) {
      elements.videoFileInput.value =
        "";
    }


    renderSelectedFile(
      null
    );


    setNotice(
      elements.notice,
      error.message,
      "error"
    );


    return;
  }


  state.selectedFile =
    file;


  renderSelectedFile(
    file
  );
}


function validateVideoFile(file) {
  if (!file) {
    return;
  }


  if (
    !String(
      file.type || ""
    ).startsWith("video/")
  ) {
    throw new Error(
      "Please select a valid video file."
    );
  }


  if (
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    throw new Error(
      "The selected video file is empty or invalid."
    );
  }


  if (
    file.size >
    MAX_VIDEO_SIZE_BYTES
  ) {
    throw new Error(
      `The video is ${formatBytes(file.size)}. The maximum permitted size is 500 MB.`
    );
  }
}


function renderSelectedFile(file) {
  if (!file) {
    if (elements.videoFileName) {
      elements.videoFileName.textContent =
        "Choose induction video";
    }


    if (elements.videoFileHelp) {
      elements.videoFileHelp.textContent =
        "Video files up to 500 MB";
    }


    if (elements.selectedVideoMeta) {
      elements.selectedVideoMeta.hidden =
        true;
    }


    return;
  }


  setText(
    elements.videoFileName,
    file.name
  );


  setText(
    elements.videoFileHelp,
    "Ready to publish with this induction pack"
  );


  setText(
    elements.selectedVideoName,
    file.name
  );


  setText(
    elements.selectedVideoSize,
    formatBytes(file.size)
  );


  setText(
    elements.selectedVideoType,
    file.type ||
      "Video"
  );


  if (elements.selectedVideoMeta) {
    elements.selectedVideoMeta.hidden =
      false;
  }
}


/* =========================================================
   PUBLISH
========================================================= */

async function handlePublish(event) {
  event.preventDefault();


  if (state.saving) {
    return;
  }


  clearFileNotice();


  let payload;


  try {
    payload =
      readAndValidateForm();

  } catch (error) {
    setNotice(
      elements.notice,
      error.message,
      "error"
    );

    return;
  }


  /*
   * First ever induction pack requires a video.
   *
   * Later revisions may retain the current video while
   * changing assessment or certificate controls.
   */
  if (
    !state.selectedFile &&
    !hasExistingVideo(state.settings)
  ) {
    setNotice(
      elements.notice,
      "Select an induction video before publishing the first induction pack.",
      "error"
    );

    return;
  }


  state.saving =
    true;


  setPublishingState(
    true
  );


  let uploadedStoragePath =
    null;


  let settingsPublished =
    false;


  try {
    let videoDetails =
      existingVideoDetails(
        state.settings
      );


    if (state.selectedFile) {
      videoDetails =
        await uploadVideo(
          state.selectedFile,
          payload
        );


      uploadedStoragePath =
        videoDetails.storagePath;
    }


    setPublishMessage(
      "Publishing induction pack..."
    );


    /*
     * Backward compatibility:
     *
     * videoUnlockSeconds is temporarily sent alongside the
     * canonical completionToleranceSeconds because the older
     * induction implementation used that field name.
     *
     * Once functions/induction.js is migrated, the legacy
     * alias can be removed.
     */
    const settingsPayload = {
      ...payload,

      ...videoDetails,

      completionToleranceSeconds:
        payload.completionToleranceSeconds,

      videoUnlockSeconds:
        payload.completionToleranceSeconds
    };


    const result =
      await callInduction(
        "SAVE_SETTINGS",
        {
          settings:
            settingsPayload
        }
      );


    settingsPublished =
      true;


    state.settings =
      normaliseSettings(
        result?.settings ||
        settingsPayload
      );


    /*
     * Preserve server-returned fields when the callable
     * returns only a partial settings object.
     */
    state.settings = {
      ...normaliseSettings(
        settingsPayload
      ),

      ...state.settings
    };


    await renderCurrentPack(
      state.settings
    );


    populateForm(
      state.settings
    );


    clearSelectedFile();


    setNotice(
      elements.notice,
      "Induction pack published successfully.",
      "success"
    );

  } catch (error) {
    console.error(
      "[NORMEX Induction Admin] Publish failed",
      error
    );


    /*
     * If Storage succeeded but Firestore publication failed,
     * remove the unused upload where permissions allow it.
     *
     * We never delete an object after the server has confirmed
     * publication.
     */
    if (
      uploadedStoragePath &&
      !settingsPublished
    ) {
      await removeUnusedUpload(
        uploadedStoragePath
      );
    }


    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );

  } finally {
    state.saving =
      false;


    setPublishingState(
      false
    );
  }
}


/* =========================================================
   READ FORM
========================================================= */

function readAndValidateForm() {
  const title =
    clean(
      elements.videoTitleInput
        ?.value
    );


  const version =
    clean(
      elements.videoVersionInput
        ?.value
    );


  if (!title) {
    throw new Error(
      "Enter a video title."
    );
  }


  if (!version) {
    throw new Error(
      "Enter a version for this induction pack."
    );
  }


  const questionsPerAssessment =
    integerField(
      elements.questionsPerAssessment,
      "Questions per assessment",
      1,
      100
    );


  const passMarkPercent =
    integerField(
      elements.passMarkPercent,
      "Pass mark",
      1,
      100
    );


  const maximumAttempts =
    integerField(
      elements.maximumAttempts,
      "Maximum attempts",
      1,
      20
    );


  const retryCooldownSeconds =
    integerField(
      elements.retryCooldownSeconds,
      "Retry cooldown",
      0,
      86400
    );


  const completionToleranceSeconds =
    integerField(
      elements.completionToleranceSeconds,
      "Video end tolerance",
      0,
      30
    );


  const validityMonths =
    integerField(
      elements.validityMonths,
      "Certificate validity",
      1,
      120
    );


  return {
    videoTitle:
      title,

    videoVersion:
      version,

    questionsPerAssessment,

    passMarkPercent,

    maximumAttempts,

    retryCooldownSeconds,

    completionToleranceSeconds,

    validityMonths
  };
}


/* =========================================================
   UPLOAD VIDEO
========================================================= */

async function uploadVideo(
  file,
  pack
) {
  validateVideoFile(file);


  const organisationId =
    clean(
      state.profile
        ?.organisationId
    );


  if (!organisationId) {
    throw new Error(
      "The signed-in account does not have an organisation."
    );
  }


  const filename =
    safeFileName(
      file.name
    );


  const storagePath =
    [
      "inductionVideos",
      organisationId,
      `${Date.now()}-${filename}`
    ].join("/");


  const reference =
    ref(
      storage,
      storagePath
    );


  const uploadTask =
    uploadBytesResumable(
      reference,
      file,
      {
        contentType:
          file.type,

        customMetadata: {
          organisationId,

          videoTitle:
            pack.videoTitle,

          videoVersion:
            pack.videoVersion
        }
      }
    );


  setPublishMessage(
    "Uploading induction video 0%..."
  );


  await new Promise(
    (resolve, reject) => {
      uploadTask.on(
        "state_changed",

        snapshot => {
          const total =
            snapshot.totalBytes;


          const transferred =
            snapshot.bytesTransferred;


          const percent =
            total > 0
              ? Math.round(
                  (
                    transferred /
                    total
                  ) *
                  100
                )
              : 0;


          setPublishMessage(
            `Uploading induction video ${percent}%...`
          );
        },

        reject,

        resolve
      );
    }
  );


  const videoUrl =
    await getDownloadURL(
      reference
    );


  return {
    videoUrl,

    storagePath,

    videoFileName:
      file.name,

    videoMimeType:
      file.type,

    videoFileSize:
      file.size,

    sourceType:
      "firebase-storage"
  };
}


/* =========================================================
   DELETE UNUSED UPLOAD
========================================================= */

async function removeUnusedUpload(
  storagePath
) {
  try {
    await deleteObject(
      ref(
        storage,
        storagePath
      )
    );

  } catch (error) {
    /*
     * Publication has already failed.
     *
     * Cleanup failure must be logged but must not hide the
     * original publishing error from the manager.
     */
    console.warn(
      "[NORMEX Induction Admin] Unused upload cleanup failed",
      {
        storagePath,
        error
      }
    );
  }
}


/* =========================================================
   EXISTING VIDEO
========================================================= */

function existingVideoDetails(settings) {
  return {
    videoUrl:
      clean(
        settings?.videoUrl
      ) || null,

    storagePath:
      clean(
        settings?.storagePath
      ) || null,

    videoFileName:
      clean(
        settings?.videoFileName
      ) || null,

    videoMimeType:
      clean(
        settings?.videoMimeType
      ) || null,

    videoFileSize:
      numberOrNull(
        settings?.videoFileSize
      ),

    sourceType:
      clean(
        settings?.sourceType
      ) ||
      (
        settings?.storagePath
          ? "firebase-storage"
          : null
      )
  };
}


function hasExistingVideo(settings) {
  return Boolean(
    clean(settings?.videoUrl) ||
    clean(settings?.storagePath)
  );
}


function hasPublishedPack(settings) {
  return Boolean(
    settings &&
    (
      hasExistingVideo(settings) ||
      clean(settings.videoVersion)
    )
  );
}


/* =========================================================
   BUTTON STATE
========================================================= */

function setPublishingState(
  saving
) {
  disableForm(
    saving
  );


  if (!elements.publishButton) {
    return;
  }


  elements.publishButton.disabled =
    saving;


  if (!saving) {
    elements.publishButton.innerHTML =
      `Publish induction pack
       <span aria-hidden="true">→</span>`;
  }
}


function setPublishMessage(message) {
  if (elements.publishButton) {
    elements.publishButton.textContent =
      message;
  }


  setNotice(
    elements.notice,
    message
  );
}


/* =========================================================
   FORM ENABLE / DISABLE
========================================================= */

function disableForm(disabled) {
  if (!elements.form) {
    return;
  }


  const controls =
    elements.form.querySelectorAll(
      "input, button"
    );


  controls.forEach(
    control => {
      control.disabled =
        Boolean(disabled);
    }
  );
}


/* =========================================================
   FILE RESET
========================================================= */

function clearSelectedFile() {
  state.selectedFile =
    null;


  if (elements.videoFileInput) {
    elements.videoFileInput.value =
      "";
  }


  renderSelectedFile(
    null
  );
}


function clearFileNotice() {
  if (
    elements.notice &&
    !state.saving
  ) {
    setNotice(
      elements.notice,
      ""
    );
  }
}


/* =========================================================
   HELPERS
========================================================= */

function integerField(
  element,
  label,
  minimum,
  maximum
) {
  const number =
    Number(
      element?.value
    );


  if (
    !Number.isInteger(number) ||
    number < minimum ||
    number > maximum
  ) {
    throw new Error(
      `${label} must be a whole number between ${minimum} and ${maximum}.`
    );
  }


  return number;
}


function validNumber(
  value,
  fallback
) {
  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : fallback;
}


function numberOrNull(value) {
  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : null;
}


function safeFileName(value) {
  const filename =
    clean(value)
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        ""
      );


  return filename ||
    "induction-video";
}


function clean(value) {
  return String(
    value ??
    ""
  ).trim();
}


function setText(
  element,
  value
) {
  if (element) {
    element.textContent =
      String(
        value ??
        ""
      );
  }
}


function setInputValue(
  element,
  value
) {
  if (element) {
    element.value =
      String(
        value ??
        ""
      );
  }
}


function formatBytes(bytes) {
  const number =
    Number(bytes);


  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "0 MB";
  }


  const mb =
    number /
    (
      1024 *
      1024
    );


  if (mb >= 1) {
    return `${mb.toFixed(
      mb >= 100
        ? 0
        : 1
    )} MB`;
  }


  return `${(
    number /
    1024
  ).toFixed(0)} KB`;
}


function formatValidity(months) {
  const number =
    Number(months);


  if (!Number.isFinite(number)) {
    return "—";
  }


  return number === 1
    ? "1 month"
    : `${number} months`;
}


function formatPublishedDate(settings) {
  const value =
    settings?.publishedAt ||
    settings?.updatedAt ||
    settings?.createdAt;


  return value
    ? formatDate(
        timestampValue(value)
      )
    : "—";
}


/*
 * Firestore timestamps returned through callable functions
 * can arrive in a few shapes depending on serialization.
 */
function timestampValue(value) {
  if (!value) {
    return null;
  }


  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return value;
  }


  if (
    typeof value.toDate ===
    "function"
  ) {
    return value.toDate();
  }


  const seconds =
    value.seconds ??
    value._seconds;


  if (
    Number.isFinite(
      Number(seconds)
    )
  ) {
    return (
      Number(seconds) *
      1000
    );
  }


  return value;
}


function makePermissionError(message) {
  const error =
    new Error(message);


  error.code =
    "functions/permission-denied";


  return error;
}


/* =========================================================
   CLEANUP
========================================================= */

function clearPreviewObjectUrl() {
  if (!state.previewObjectUrl) {
    return;
  }


  URL.revokeObjectURL(
    state.previewObjectUrl
  );


  state.previewObjectUrl =
    null;
}