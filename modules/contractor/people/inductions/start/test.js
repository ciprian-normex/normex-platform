import {
  callInduction,
  errorMessage,
  escapeHtml,
  inductionNav,
  sessionSet,
  setNotice,
  waitForProfile
} from "../induction-core.js";

const elements = {
  notice: document.querySelector("#notice"),
  pageNav: document.querySelector("#pageNav"),
  form: document.querySelector("#testForm"),
  questions: document.querySelector("#questions"),
  answeredCount: document.querySelector("#answeredCount"),
  testQuestionCount: document.querySelector("#testQuestionCount"),
  testPassMark: document.querySelector("#testPassMark"),
  testAttempt: document.querySelector("#testAttempt"),
  testAnsweredSummary: document.querySelector("#testAnsweredSummary"),
  progressLabel: document.querySelector("#progressLabel"),
  answerProgress: document.querySelector("#answerProgress"),
  submit: document.querySelector("#submitAssessment")
};

if (elements.pageNav) {
  elements.pageNav.innerHTML = inductionNav("start");
}

let assessment = null;

initialise();

async function initialise() {
  setNotice(elements.notice, "Loading your assessment...");

  try {
    await waitForProfile();
    assessment = await callInduction("GET_TEST");
    renderAssessment();
    wireEvents();
    setNotice(elements.notice, "");
  } catch (error) {
    setNotice(elements.notice, errorMessage(error), "error");
    if (elements.form) elements.form.hidden = true;
  }
}

function renderAssessment() {
  const questions = assessment?.questions || [];
  const meta = assessment?.meta || {};
  const currentAttempt = Number(meta.attemptsUsed || 0) + 1;
  const maxAttempts = Number(meta.maxAttempts || 0);
  const passMark = Number(meta.passMarkPercent || 0);

  elements.testQuestionCount.textContent = String(questions.length);
  elements.testPassMark.textContent = `${passMark}%`;
  elements.testAttempt.textContent = `${currentAttempt} / ${maxAttempts}`;

  elements.questions.innerHTML = questions.map((question, index) => `
    <fieldset class="question" data-question-id="${escapeHtml(question.id)}">
      <legend><span class="question-number">Q${index + 1}.</span>${escapeHtml(question.question)}</legend>
      <div class="option-list">
        ${(question.options || []).map((option, optionIndex) => {
          const letter = String.fromCharCode(65 + optionIndex);
          return `
            <label class="option">
              <input type="radio" name="${escapeHtml(question.id)}" value="${escapeHtml(option)}" required />
              <span class="option__letter" aria-hidden="true">${letter}</span>
              <span class="option__text">${escapeHtml(option)}</span>
            </label>`;
        }).join("")}
      </div>
    </fieldset>`).join("");

  updateProgress();
}

function wireEvents() {
  elements.form?.addEventListener("change", event => {
    const fieldset = event.target?.closest?.(".question");
    fieldset?.classList.remove("is-unanswered");
    updateProgress();
  });

  elements.form?.addEventListener("submit", submitAssessment);
}

function getAnswerState() {
  const questions = assessment?.questions || [];
  const formData = new FormData(elements.form);
  const answered = questions.filter(question => formData.get(question.id)).length;
  return { questions, formData, answered };
}

function updateProgress() {
  const { questions, answered } = getAnswerState();
  if (!questions.length) return;

  const percent = Math.round((answered / questions.length) * 100);
  const summary = `${answered} / ${questions.length}`;

  elements.answeredCount.textContent = summary;
  elements.testAnsweredSummary.textContent = summary;
  elements.progressLabel.textContent = `${percent}% complete`;
  elements.answerProgress.style.width = `${percent}%`;
}

async function submitAssessment(event) {
  event.preventDefault();

  const { questions, formData } = getAnswerState();
  const answers = Object.fromEntries(
    questions.map(question => [question.id, formData.get(question.id)])
  );

  const unanswered = questions.filter(question => !answers[question.id]);

  document.querySelectorAll(".question.is-unanswered").forEach(element => {
    element.classList.remove("is-unanswered");
  });

  if (unanswered.length) {
    unanswered.forEach(question => {
      document
        .querySelector(`[data-question-id="${CSS.escape(question.id)}"]`)
        ?.classList.add("is-unanswered");
    });

    setNotice(
      elements.notice,
      `You still have ${unanswered.length} unanswered question${unanswered.length === 1 ? "" : "s"}. Complete every question before submitting.`,
      "warn"
    );

    document
      .querySelector(`[data-question-id="${CSS.escape(unanswered[0].id)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

    return;
  }

  elements.submit.disabled = true;
  setNotice(elements.notice, "Checking your assessment...");

  try {
    const result = await callInduction("SUBMIT_TEST", { answers });
    sessionSet("result", result);

    /*
     * Every completed attempt now goes to the dedicated result
     * page. PASS / RETRY / LOCKED presentation belongs there.
     */
    location.href = "./result.html";
  } catch (error) {
    setNotice(elements.notice, errorMessage(error), "error");
    elements.submit.disabled = false;
  }
}
