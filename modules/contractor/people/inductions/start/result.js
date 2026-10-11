import {
  escapeHtml,
  formatDate,
  inductionNav,
  sessionGet,
  waitForProfile
} from "../induction-core.js";

const profile = await waitForProfile();

document.querySelector("#pageNav").innerHTML = inductionNav("start");

const data = sessionGet("result");
const element = document.querySelector("#result");
const certificateText = document.querySelector("#journeyCertificateText");
const certificateStep = document.querySelector("#journeyCertificateStep");
const guidanceTitle = document.querySelector("#resultGuidanceTitle");
const guidanceText = document.querySelector("#resultGuidanceText");

if (!data) {
  renderUnavailable();
} else if (data.outcome === "PASSED") {
  renderPassed(data);
} else if (data.outcome === "FAILED_RETRY") {
  renderFailedRetry(data);
} else {
  renderFailedLocked(data);
}

function renderUnavailable() {
  certificateStep?.classList.remove("is-current");
  certificateStep?.querySelector(".induction-journey-step__orbit")?.remove();
  certificateText.textContent = "No assessment result is available in this browser session.";
  guidanceTitle.textContent = "Result unavailable";
  guidanceText.textContent = "Return to My induction to continue from your current recorded step.";

  element.innerHTML = `
    <div class="induction-result-state">
      <section class="induction-result-banner is-failed">
        <div class="induction-result-icon">!</div>
        <p class="induction-result-kicker">Result unavailable</p>
        <h2>No assessment result found</h2>
        <p>This browser does not currently hold an assessment result to display.</p>
      </section>

      <div class="induction-result-actions">
        <a class="button button--primary" href="./">Return to my induction</a>
      </div>
    </div>`;
}

function renderPassed(payload) {
  const result = payload.result || {};
  const certificate = payload.certificate || {};

  setCertificateComplete("Your verified induction certificate has been issued.");
  guidanceTitle.textContent = "Induction complete";
  guidanceText.textContent = "Your certificate is now the controlled record of your completed Core Company Induction.";

  element.innerHTML = `
    <div class="induction-result-state">
      <section class="induction-result-banner">
        <div class="induction-result-icon">✓</div>
        <p class="induction-result-kicker">Passed</p>
        <h2>Induction assessment passed</h2>
        <p>You achieved <strong>${safeNumber(result.scorePercent)}%</strong> against a pass mark of <strong>${safeNumber(result.passMarkPercent)}%</strong>. Your Core Company Induction is complete.</p>
      </section>

      <section class="induction-result-summary" aria-label="Assessment result summary">
        <div><span>Score</span><strong>${safeNumber(result.scorePercent)}%</strong></div>
        <div><span>Pass mark</span><strong>${safeNumber(result.passMarkPercent)}%</strong></div>
        <div><span>Correct answers</span><strong>${safeNumber(result.correctAnswers)} / ${safeNumber(result.totalQuestions)}</strong></div>
        <div><span>Status</span><strong>Passed</strong></div>
      </section>

      <section class="induction-result-record" aria-label="Issued induction record">
        <div><span>Certificate</span><strong>${escapeHtml(certificate.inductionNumber || "—")}</strong></div>
        <div><span>Valid until</span><strong>${formatDate(certificate.expiresAt)}</strong></div>
        <div><span>Inductee</span><strong>${escapeHtml(certificate.workerName || profile?.displayName || "—")}</strong></div>
        <div><span>Role / trade</span><strong>${escapeHtml(certificate.role || profile?.position || "—")}</strong></div>
      </section>

      <div class="induction-result-next">
        <strong>What happens next</strong>
        <span>Open your certificate to view the controlled induction number, validity dates and QR verification record.</span>
      </div>

      <div class="induction-result-actions">
        <a class="button button--primary" href="../certificate/?id=${encodeURIComponent(certificate.inductionNumber || "")}">View certificate</a>
        <a class="button" href="../">Induction overview</a>
      </div>
    </div>`;
}

function renderFailedRetry(payload) {
  const result = payload.result || {};
  const retryAt = formatRetryTime(payload.cooldownUntil);

  setCertificateBlocked("A certificate is issued only after the assessment is passed.");
  guidanceTitle.textContent = "Another attempt is available";
  guidanceText.textContent = retryAt
    ? `Your next assessment can begin after ${retryAt}.`
    : "Return to the assessment when the retry period has ended.";

  element.innerHTML = `
    <div class="induction-result-state">
      <section class="induction-result-banner is-failed">
        <div class="induction-result-icon">!</div>
        <p class="induction-result-kicker">Not passed</p>
        <h2>Assessment not passed</h2>
        <p>You achieved <strong>${safeNumber(result.scorePercent)}%</strong>. The required pass mark is <strong>${safeNumber(result.passMarkPercent)}%</strong>.</p>
      </section>

      <section class="induction-result-summary" aria-label="Assessment result summary">
        <div><span>Score</span><strong>${safeNumber(result.scorePercent)}%</strong></div>
        <div><span>Pass mark</span><strong>${safeNumber(result.passMarkPercent)}%</strong></div>
        <div><span>Correct answers</span><strong>${safeNumber(result.correctAnswers)} / ${safeNumber(result.totalQuestions)}</strong></div>
        <div><span>Attempts used</span><strong>${safeNumber(payload.attemptsUsed)} / ${safeNumber(payload.maxAttempts)}</strong></div>
      </section>

      <div class="induction-result-next">
        <strong>Next attempt</strong>
        <span>${retryAt ? `You can start another assessment after ${escapeHtml(retryAt)}.` : "A further attempt is available after the configured retry period."}</span>
      </div>

      <div class="induction-result-actions">
        <a class="button button--primary" href="./test.html">Return to assessment</a>
        <a class="button" href="../">Induction overview</a>
      </div>
    </div>`;
}

function renderFailedLocked(payload) {
  const result = payload.result || {};

  setCertificateBlocked("A certificate cannot be issued because all assessment attempts have been used.");
  guidanceTitle.textContent = "Manager action required";
  guidanceText.textContent = "Your available attempts have been used. Speak to an induction manager before trying again.";

  element.innerHTML = `
    <div class="induction-result-state">
      <section class="induction-result-banner is-failed">
        <div class="induction-result-icon">!</div>
        <p class="induction-result-kicker">Not passed</p>
        <h2>Assessment attempts exhausted</h2>
        <p>You achieved <strong>${safeNumber(result.scorePercent)}%</strong> against a required pass mark of <strong>${safeNumber(result.passMarkPercent)}%</strong>. An induction manager must review your next step.</p>
      </section>

      <section class="induction-result-summary" aria-label="Assessment result summary">
        <div><span>Score</span><strong>${safeNumber(result.scorePercent)}%</strong></div>
        <div><span>Pass mark</span><strong>${safeNumber(result.passMarkPercent)}%</strong></div>
        <div><span>Correct answers</span><strong>${safeNumber(result.correctAnswers)} / ${safeNumber(result.totalQuestions)}</strong></div>
        <div><span>Attempts used</span><strong>${safeNumber(payload.attemptsUsed)} / ${safeNumber(payload.maxAttempts)}</strong></div>
      </section>

      <div class="induction-result-next">
        <strong>Manager review</strong>
        <span>No further assessment attempt can start until the induction workflow is reset or reauthorised by an induction manager.</span>
      </div>

      <div class="induction-result-actions">
        <a class="button button--primary" href="../">Induction overview</a>
      </div>
    </div>`;
}

function setCertificateComplete(message) {
  certificateStep?.classList.remove("is-current");
  certificateStep?.classList.add("is-complete");
  certificateStep?.querySelector(".induction-journey-step__orbit")?.remove();
  const marker = certificateStep?.querySelector(".induction-journey-step__number");
  if (marker) marker.textContent = "✓";
  certificateText.textContent = message;
}

function setCertificateBlocked(message) {
  certificateStep?.classList.remove("is-current", "is-complete");
  certificateStep?.querySelector(".induction-journey-step__orbit")?.remove();
  const marker = certificateStep?.querySelector(".induction-journey-step__number");
  if (marker) marker.textContent = "4";
  certificateText.textContent = message;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatRetryTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
