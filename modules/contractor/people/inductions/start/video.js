import {
  callInduction,
  errorMessage,
  inductionNav,
  setNotice,
  waitForProfile
} from "../induction-core.js";


/* =========================================================
   NORMEX PEOPLE
   CORE COMPANY INDUCTION
   VIDEO CONTROLLER
========================================================= */


/* =========================================================
   DOM
========================================================= */

const elements = {
  pageNav:
    document.querySelector("#pageNav"),

  notice:
    document.querySelector("#notice"),

  video:
    document.querySelector("#inductionVideo"),

  videoLoading:
    document.querySelector("#videoLoading"),

  videoUnavailable:
    document.querySelector("#videoUnavailable"),

  videoTitle:
    document.querySelector("#videoTitle"),

  videoDescription:
    document.querySelector("#videoDescription"),

  videoVersion:
    document.querySelector("#videoVersion"),

  videoProgressLabel:
    document.querySelector("#videoProgressLabel"),

  videoProgressBar:
    document.querySelector("#videoProgressBar"),

  videoProgressMessage:
    document.querySelector("#videoProgressMessage"),

  videoCompletionState:
    document.querySelector("#videoCompletionState"),

  continueButton:
    document.querySelector("#continueToAssessment")
};


/* =========================================================
   CONFIG
========================================================= */

/*
 * Small gaps can occur naturally between browser-generated
 * played ranges.
 *
 * This only joins tiny gaps when calculating watched coverage.
 * It does NOT allow large skipped sections to count.
 */
const PLAYED_RANGE_GAP_TOLERANCE_SECONDS = 1.25;


/*
 * Don't mark the video complete until the unwatched remainder
 * is within the configured server tolerance.
 */
const DEFAULT_COMPLETION_TOLERANCE_SECONDS = 5;


/*
 * Used only to remember where the person was watching if they
 * accidentally reload this page.
 *
 * This position is NOT trusted as proof of completion.
 */
const RESUME_STORAGE_PREFIX =
  "normex-induction-video-position";


/* =========================================================
   STATE
========================================================= */

const state = {
  profile:
    null,

  context:
    null,

  durationSeconds:
    0,

  watchedSeconds:
    0,

  watchedPercent:
    0,

  completed:
    false,

  completionSaving:
    false,

  videoReady:
    false,

  initialised:
    false
};


/* =========================================================
   NAVIGATION
========================================================= */

if (elements.pageNav) {
  elements.pageNav.innerHTML =
    inductionNav("my");
}


/* =========================================================
   START
========================================================= */

initialise();


async function initialise() {
  if (state.initialised) {
    return;
  }

  state.initialised = true;

  try {
    state.profile =
      await waitForProfile();


    state.context =
      await loadVideoContext({
        profile:
          state.profile
      });


    renderVideoContext(
      state.context
    );


    if (!state.context?.videoUrl) {
      showVideoUnavailable(
        "No induction video is currently available. Please speak to your manager before continuing."
      );

      return;
    }


    initialiseVideo(
      state.context
    );

  } catch (error) {
    console.error(
      "[NORMEX Induction] Video initialisation failed",
      error
    );


    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );


    showVideoUnavailable(
      "The induction video could not be loaded. Please speak to your manager before continuing."
    );
  }
}


/* =========================================================
   CONTEXT
========================================================= */

function renderVideoContext(context = {}) {
  if (elements.videoTitle) {
    elements.videoTitle.textContent =
      cleanText(
        context.videoTitle,
        "Core Company Induction"
      );
  }


  if (elements.videoDescription) {
    elements.videoDescription.textContent =
      cleanText(
        context.description,
        "This video covers the information you need before starting work. Watch it in full and the assessment will unlock automatically."
      );
  }


  if (elements.videoVersion) {
    elements.videoVersion.textContent =
      cleanText(
        context.videoVersion,
        "Current"
      );
  }


  if (context.videoCompleted === true) {
    state.completed =
      true;

    markCompleteUI();
  }
}


/* =========================================================
   VIDEO SETUP
========================================================= */

function initialiseVideo(context) {
  const video =
    elements.video;


  if (!video) {
    throw new Error(
      "Induction video element is missing."
    );
  }


  video.src =
    context.videoUrl;


  video.hidden =
    false;


  hideElement(
    elements.videoLoading
  );


  video.addEventListener(
    "loadedmetadata",
    handleLoadedMetadata
  );


  video.addEventListener(
    "durationchange",
    handleDurationChange
  );


  video.addEventListener(
    "timeupdate",
    handlePlaybackProgress
  );


  video.addEventListener(
    "progress",
    handlePlaybackProgress
  );


  video.addEventListener(
    "seeked",
    handlePlaybackProgress
  );


  video.addEventListener(
    "ended",
    handleVideoEnded
  );


  video.addEventListener(
    "play",
    handleVideoPlay
  );


  video.addEventListener(
    "pause",
    handleVideoPause
  );


  video.addEventListener(
    "error",
    handleVideoError
  );


  window.addEventListener(
    "beforeunload",
    saveResumePosition
  );
}


/* =========================================================
   VIDEO EVENTS
========================================================= */

function handleLoadedMetadata() {
  const video =
    elements.video;


  if (!video) {
    return;
  }


  state.videoReady =
    true;


  state.durationSeconds =
    validDuration(
      video.duration
    );


  restoreResumePosition();


  updatePlaybackPosition();

  updateProgressUI();
}


function handleDurationChange() {
  const video =
    elements.video;


  if (!video) {
    return;
  }


  state.durationSeconds =
    validDuration(
      video.duration
    );


  updatePlaybackPosition();

  updateProgressUI();
}


function handlePlaybackProgress() {
  if (
    !elements.video ||
    state.completed
  ) {
    return;
  }


  updatePlaybackPosition();

  saveResumePosition();

  updateProgressUI();

  checkForCompletion();
}


function handleVideoEnded() {
  /*
   * Reaching the end is not automatically proof that the
   * whole induction was watched.
   *
   * The watched ranges are checked first.
   */
  updatePlaybackPosition();

  updateProgressUI();

  checkForCompletion();
}


function handleVideoPlay() {
  if (
    elements.videoProgressMessage &&
    !state.completed
  ) {
    elements.videoProgressMessage.textContent =
      progressMessage(
        state.watchedPercent,
        true
      );
  }
}


function handleVideoPause() {
  saveResumePosition();

  if (
    elements.videoProgressMessage &&
    !state.completed
  ) {
    elements.videoProgressMessage.textContent =
      progressMessage(
        state.watchedPercent,
        false
      );
  }
}


function handleVideoError() {
  console.error(
    "[NORMEX Induction] Browser could not play the configured video",
    elements.video?.error
  );


  showVideoUnavailable(
    "This induction video could not be played. Please speak to your manager before continuing."
  );
}


/* =========================================================
   PLAYED COVERAGE
========================================================= */

/*
 * HTMLMediaElement.played contains the portions of the media
 * that the browser confirms have actually been played.
 *
 * If someone seeks from 01:00 to 14:00, the skipped section
 * does not magically appear in these ranges.
 */

function updatePlaybackPosition() {
  const video =
    elements.video;


  if (
    !video ||
    !state.durationSeconds
  ) {
    state.watchedSeconds =
      0;

    state.watchedPercent =
      0;

    return;
  }


  const ranges =
    readPlayedRanges(
      video.played
    );


  const mergedRanges =
    mergePlayedRanges(
      ranges,
      PLAYED_RANGE_GAP_TOLERANCE_SECONDS
    );


  state.watchedSeconds =
    calculateRangeDuration(
      mergedRanges
    );


  state.watchedSeconds =
    Math.min(
      state.watchedSeconds,
      state.durationSeconds
    );


  state.watchedPercent =
    Math.min(
      100,
      Math.round(
        (
          state.watchedSeconds /
          state.durationSeconds
        ) *
        100
      )
    );
}


function readPlayedRanges(timeRanges) {
  const ranges = [];


  if (!timeRanges) {
    return ranges;
  }


  for (
    let index = 0;
    index < timeRanges.length;
    index += 1
  ) {
    const start =
      Number(
        timeRanges.start(index)
      );


    const end =
      Number(
        timeRanges.end(index)
      );


    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end > start
    ) {
      ranges.push({
        start,
        end
      });
    }
  }


  return ranges;
}


function mergePlayedRanges(
  ranges,
  toleranceSeconds
) {
  if (!ranges.length) {
    return [];
  }


  const sorted =
    [...ranges].sort(
      (a, b) =>
        a.start -
        b.start
    );


  const merged = [
    {
      start:
        sorted[0].start,

      end:
        sorted[0].end
    }
  ];


  for (
    let index = 1;
    index < sorted.length;
    index += 1
  ) {
    const current =
      sorted[index];


    const previous =
      merged[
        merged.length - 1
      ];


    const gap =
      current.start -
      previous.end;


    if (
      gap <=
      toleranceSeconds
    ) {
      previous.end =
        Math.max(
          previous.end,
          current.end
        );
    } else {
      merged.push({
        start:
          current.start,

        end:
          current.end
      });
    }
  }


  return merged;
}


function calculateRangeDuration(ranges) {
  return ranges.reduce(
    (total, range) => {
      return total +
        Math.max(
          0,
          range.end -
          range.start
        );
    },
    0
  );
}


/* =========================================================
   PROGRESS UI
========================================================= */

function updateProgressUI() {
  if (state.completed) {
    return;
  }


  const percent =
    state.watchedPercent;


  if (elements.videoProgressLabel) {
    elements.videoProgressLabel.textContent =
      `${percent}% watched`;
  }


  if (elements.videoProgressBar) {
    elements.videoProgressBar.style.width =
      `${percent}%`;
  }


  if (elements.videoProgressMessage) {
    elements.videoProgressMessage.textContent =
      progressMessage(
        percent,
        elements.video?.paused ===
        false
      );
  }
}


function progressMessage(
  percent,
  isPlaying
) {
  if (percent <= 0) {
    return "Watch the full video to unlock the assessment.";
  }


  if (percent < 25) {
    return isPlaying
      ? "Your progress is being recorded as you watch."
      : "Continue when you're ready.";
  }


  if (percent < 75) {
    return isPlaying
      ? "Keep going. You can pause or replay any section if needed."
      : "Your watched progress is safe while you stay on this page.";
  }


  if (percent < 95) {
    return isPlaying
      ? "Nearly there. Finish the remaining sections to unlock the assessment."
      : "You're nearly finished. Continue when you're ready.";
  }


  return "Finish the remaining part of the video to continue.";
}


/* =========================================================
   COMPLETION
========================================================= */

function checkForCompletion() {
  if (
    !state.durationSeconds ||
    state.completed ||
    state.completionSaving
  ) {
    return;
  }


  const tolerance =
    completionTolerance();


  const requiredWatchedSeconds =
    Math.max(
      0,
      state.durationSeconds -
      tolerance
    );


  const watchedEnough =
    state.watchedSeconds >=
    requiredWatchedSeconds;


  if (watchedEnough) {
    completeVideo();
  }
}


function completionTolerance() {
  const configured =
    Number(
      state.context
        ?.completionToleranceSeconds
    );


  if (
    Number.isFinite(configured) &&
    configured >= 0
  ) {
    return configured;
  }


  return DEFAULT_COMPLETION_TOLERANCE_SECONDS;
}


/* =========================================================
   SAVE COMPLETION
========================================================= */

async function completeVideo() {
  if (
    state.completed ||
    state.completionSaving
  ) {
    return;
  }


  state.completionSaving =
    true;


  setCompletionSavingUI();


  try {
    await saveVideoCompletion({
      requestId:
        state.context?.requestId,

      videoVersion:
        state.context?.videoVersion,

      durationSeconds:
        state.durationSeconds,

      watchedSeconds:
        state.watchedSeconds
    });


    state.completed =
      true;


    clearResumePosition();

    markCompleteUI();

  } catch (error) {
    console.error(
      "[NORMEX Induction] Video completion confirmation failed",
      error
    );


    setNotice(
      elements.notice,
      errorMessage(error),
      "error"
    );


    if (elements.videoProgressMessage) {
      elements.videoProgressMessage.textContent =
        "You have finished the video, but NORMEX could not confirm completion. Please try again.";
    }

  } finally {
    state.completionSaving =
      false;
  }
}


function setCompletionSavingUI() {
  if (elements.videoProgressMessage) {
    elements.videoProgressMessage.textContent =
      "Confirming completion...";
  }


  if (elements.videoCompletionState) {
    elements.videoCompletionState.textContent =
      "Confirming";
  }


  if (elements.continueButton) {
    elements.continueButton.disabled =
      true;
  }
}


/* =========================================================
   COMPLETE STATE
========================================================= */

function markCompleteUI() {
  state.completed =
    true;


  state.watchedPercent =
    100;


  if (elements.videoProgressLabel) {
    elements.videoProgressLabel.textContent =
      "100% watched";
  }


  if (elements.videoProgressBar) {
    elements.videoProgressBar.style.width =
      "100%";
  }


  if (elements.videoCompletionState) {
    elements.videoCompletionState.textContent =
      "Complete";


    elements.videoCompletionState.classList.add(
      "is-complete"
    );
  }


  if (elements.videoProgressMessage) {
    elements.videoProgressMessage.textContent =
      "Video complete. Your assessment is now ready.";
  }


  if (elements.continueButton) {
    elements.continueButton.disabled =
      false;


    elements.continueButton.removeAttribute(
      "aria-disabled"
    );
  }
}


/* =========================================================
   CONTINUE
========================================================= */

elements.continueButton
  ?.addEventListener(
    "click",
    () => {
      if (!state.completed) {
        return;
      }


      window.location.href =
        "./test.html";
    }
  );


/* =========================================================
   VIDEO UNAVAILABLE
========================================================= */

function showVideoUnavailable(message) {
  hideElement(
    elements.videoLoading
  );


  if (elements.video) {
    elements.video.pause();

    elements.video.hidden =
      true;
  }


  if (elements.videoUnavailable) {
    const messageElement =
      elements.videoUnavailable
        .querySelector(
          "span:last-child"
        );


    if (messageElement) {
      messageElement.textContent =
        message;
    }


    elements.videoUnavailable.hidden =
      false;
  }


  if (elements.videoProgressLabel) {
    elements.videoProgressLabel.textContent =
      "0% watched";
  }


  if (elements.videoProgressBar) {
    elements.videoProgressBar.style.width =
      "0%";
  }


  if (elements.videoCompletionState) {
    elements.videoCompletionState.textContent =
      "Unavailable";


    elements.videoCompletionState.classList.remove(
      "is-complete"
    );
  }


  if (elements.videoProgressMessage) {
    elements.videoProgressMessage.textContent =
      "The induction cannot continue until a video is available.";
  }


  if (elements.continueButton) {
    elements.continueButton.disabled =
      true;


    elements.continueButton.setAttribute(
      "aria-disabled",
      "true"
    );
  }
}


/* =========================================================
   RESUME POSITION

   UX only.

   This never proves that the person watched the content.
========================================================= */

function resumeStorageKey() {
  const requestId =
    cleanText(
      state.context?.requestId,
      "pending"
    );


  const version =
    cleanText(
      state.context?.videoVersion,
      "current"
    );


  return [
    RESUME_STORAGE_PREFIX,
    requestId,
    version
  ].join(":");
}


function saveResumePosition() {
  const video =
    elements.video;


  if (
    !video ||
    !state.context?.videoUrl ||
    state.completed
  ) {
    return;
  }


  const currentTime =
    Number(
      video.currentTime
    );


  if (
    !Number.isFinite(currentTime) ||
    currentTime <= 0
  ) {
    return;
  }


  try {
    sessionStorage.setItem(
      resumeStorageKey(),
      String(currentTime)
    );
  } catch {
    /*
     * Resume position is optional UX only.
     * Failure should never interrupt induction.
     */
  }
}


function restoreResumePosition() {
  const video =
    elements.video;


  if (
    !video ||
    state.completed
  ) {
    return;
  }


  try {
    const stored =
      Number(
        sessionStorage.getItem(
          resumeStorageKey()
        )
      );


    if (
      !Number.isFinite(stored) ||
      stored <= 0 ||
      stored >=
        state.durationSeconds -
        2
    ) {
      return;
    }


    video.currentTime =
      stored;

  } catch {
    /*
     * Optional convenience only.
     */
  }
}


function clearResumePosition() {
  try {
    sessionStorage.removeItem(
      resumeStorageKey()
    );
  } catch {
    /*
     * Nothing to do.
     */
  }
}


/* =========================================================
   HELPERS
========================================================= */

function validDuration(value) {
  const number =
    Number(value);


  return (
    Number.isFinite(number) &&
    number > 0
  )
    ? number
    : 0;
}


function cleanText(
  value,
  fallback = ""
) {
  const text =
    String(
      value ??
      ""
    ).trim();


  return text ||
    fallback;
}


function hideElement(element) {
  if (element) {
    element.hidden =
      true;
  }
}


/* =========================================================
   DATA ADAPTER
========================================================= */

/*
 * IMPORTANT
 *
 * These two functions are the boundary between this finished
 * browser controller and the induction backend.
 *
 * Do not write directly from this page to:
 *
 * - inductionSettings
 * - inductionRequests
 * - inductions
 *
 * The server-side workflow remains authoritative.
 */


/* =========================================================
   LOAD VIDEO CONTEXT
========================================================= */

async function loadVideoContext({
  profile
}) {
  void profile;
  const data = await callInduction("STATUS");
  const settings = data?.settings;
  const request = data?.request;

  if (!settings) {
    throw new Error("The current induction settings are unavailable.");
  }
  if (!settings.videoUrl) {
    throw new Error("The Core Company Induction video is not published.");
  }
  if (!request || !request.requestId) {
    throw new Error("Start the Core Company Induction before opening the video.");
  }
  if (request.status !== "IN_PROGRESS") {
    throw new Error("This induction request is not currently in progress.");
  }

  const configuredTolerance = Number(
    settings.completionToleranceSeconds ??
    settings.videoUnlockSeconds ??
    DEFAULT_COMPLETION_TOLERANCE_SECONDS
  );

  return {
    requestId: request.requestId,
    videoTitle: settings.videoTitle || "Core Company Induction",
    videoVersion: settings.videoVersion,
    videoUrl: settings.videoUrl,
    description: settings.ruleNotes || "This video covers the information you need before starting work. Watch it in full and the assessment will unlock automatically.",
    completionToleranceSeconds: Number.isFinite(configuredTolerance) && configuredTolerance >= 0
      ? configuredTolerance
      : DEFAULT_COMPLETION_TOLERANCE_SECONDS,
    videoCompleted: Boolean(request.videoConfirmedAt)
  };
}


/* =========================================================
   SAVE VIDEO COMPLETION
========================================================= */

async function saveVideoCompletion({
  requestId,
  videoVersion,
  durationSeconds,
  watchedSeconds
}) {
  const duration = Math.round(Number(durationSeconds));
  const watched = Math.round(Number(watchedSeconds));
  if (!Number.isFinite(duration) || duration < 0 || !Number.isFinite(watched) || watched < 0) {
    throw new Error("The browser could not calculate valid video coverage.");
  }
  const result = await callInduction("CONFIRM_VIDEO", {
    requestId,
    videoVersion,
    durationSeconds: duration,
    watchedSeconds: watched
  });
  if (result?.outcome !== "VIDEO_CONFIRMED") {
    throw new Error("NORMEX did not confirm video completion.");
  }
  return result;
}
