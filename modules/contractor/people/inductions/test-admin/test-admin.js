import {
  callInduction,
  errorMessage,
  escapeHtml,
  inductionNav,
  setNotice,
  waitForProfile
} from "../induction-core.js";

const elements = {
  notice: document.querySelector("#notice"),
  pageNav: document.querySelector("#pageNav"),
  settingsForm: document.querySelector("#settingsForm"),
  passMark: document.querySelector("#passMark"),
  validity: document.querySelector("#validity"),
  attempts: document.querySelector("#attempts"),
  cooldown: document.querySelector("#cooldown"),
  count: document.querySelector("#count"),
  heroBankStatus: document.querySelector("#heroBankStatus"),
  bankTotal: document.querySelector("#bankTotal"),
  bankSections: document.querySelector("#bankSections"),
  bankAssessmentCount: document.querySelector("#bankAssessmentCount"),
  bankVersion: document.querySelector("#bankVersion"),
  bankReadiness: document.querySelector("#bankReadiness"),
  questionRows: document.querySelector("#questionRows"),
  questionEmpty: document.querySelector("#questionEmpty"),
  questionSearch: document.querySelector("#questionSearch"),
  sectionFilter: document.querySelector("#sectionFilter"),
  saveBank: document.querySelector("#saveBank"),
  addQuestion: document.querySelector("#addQuestion"),
  openImport: document.querySelector("#openImport"),
  downloadTemplate: document.querySelector("#downloadTemplate"),
  importDialog: document.querySelector("#importDialog"),
  bankFile: document.querySelector("#bankFile"),
  bankFileName: document.querySelector("#bankFileName"),
  bankPaste: document.querySelector("#bankPaste"),
  importSummary: document.querySelector("#importSummary"),
  parseImport: document.querySelector("#parseImport"),
  questionDialog: document.querySelector("#questionDialog"),
  questionForm: document.querySelector("#questionForm"),
  questionDialogTitle: document.querySelector("#questionDialogTitle"),
  questionIndex: document.querySelector("#questionIndex"),
  questionSection: document.querySelector("#questionSection"),
  questionCategory: document.querySelector("#questionCategory"),
  questionText: document.querySelector("#questionText"),
  questionOptions: document.querySelector("#questionOptions"),
  correctAnswer: document.querySelector("#correctAnswer")
};

if (elements.pageNav) elements.pageNav.innerHTML = inductionNav("test");

const state = {
  settings: null,
  bank: { categoryPlan: {}, questionSections: [] },
  flat: [],
  fileText: "",
  dirty: false
};

initialise();

async function initialise() {
  setNotice(elements.notice, "Loading assessment setup...");
  try {
    await waitForProfile();
    const data = await callInduction("GET_ADMIN_QUESTION_BANK");
    state.settings = data.settings || {};
    state.bank = normaliseBank(data.settings?.questionBank);
    populateSettings();
    wireEvents();
    renderAll();
    setNotice(elements.notice, "");
  } catch (error) {
    setNotice(elements.notice, errorMessage(error), "error");
    if (elements.settingsForm) elements.settingsForm.hidden = true;
  }
}

function populateSettings() {
  const settings = state.settings || {};
  elements.passMark.value = String(settings.passMarkPercent ?? 80);
  elements.validity.value = String(settings.validityMonths ?? 12);
  elements.attempts.value = String(settings.maximumAttempts ?? settings.maxAttempts ?? 3);
  elements.cooldown.value = String(settings.retryCooldownSeconds ?? settings.cooldownSeconds ?? 60);
  elements.count.value = String(settings.questionsPerAssessment ?? settings.questionCount ?? 20);
}

function wireEvents() {
  elements.settingsForm?.addEventListener("submit", saveRules);
  elements.saveBank?.addEventListener("click", publishBank);
  elements.addQuestion?.addEventListener("click", () => openQuestionEditor());
  elements.openImport?.addEventListener("click", openImportDialog);
  elements.downloadTemplate?.addEventListener("click", downloadTemplate);
  elements.questionSearch?.addEventListener("input", renderQuestionList);
  elements.sectionFilter?.addEventListener("change", renderQuestionList);
  elements.questionRows?.addEventListener("click", handleQuestionAction);
  elements.questionForm?.addEventListener("submit", applyQuestion);
  elements.bankFile?.addEventListener("change", readBankFile);
  elements.parseImport?.addEventListener("click", parseImportIntoDraft);

  document.querySelectorAll("[data-close-import]").forEach(button => {
    button.addEventListener("click", () => elements.importDialog?.close());
  });
  document.querySelectorAll("[data-close-question]").forEach(button => {
    button.addEventListener("click", () => elements.questionDialog?.close());
  });
}

async function saveRules(event) {
  event.preventDefault();
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    const settings = {
      questionsPerAssessment: integerValue(elements.count, "Questions per assessment", 1, 100),
      passMarkPercent: integerValue(elements.passMark, "Pass mark", 1, 100),
      maximumAttempts: integerValue(elements.attempts, "Maximum attempts", 1, 20),
      retryCooldownSeconds: integerValue(elements.cooldown, "Retry cooldown", 0, 86400),
      validityMonths: integerValue(elements.validity, "Certificate validity", 1, 120)
    };
    const result = await callInduction("SAVE_SETTINGS", { settings });
    state.settings = { ...state.settings, ...(result.settings || settings) };
    renderAll();
    setNotice(elements.notice, "Assessment rules saved.", "success");
  } catch (error) {
    setNotice(elements.notice, error.message || errorMessage(error), "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function publishBank() {
  const validation = validateBank(state.bank);
  const required = Number(elements.count?.value || state.settings?.questionCount || 20);
  if (validation.valid.length < required) {
    setNotice(elements.notice, `The bank has ${validation.valid.length} valid questions but the assessment requires ${required}.`, "error");
    return;
  }
  if (validation.errors.length) {
    setNotice(elements.notice, validation.errors[0], "error");
    return;
  }

  elements.saveBank.disabled = true;
  setNotice(elements.notice, "Publishing question bank...");
  try {
    const version = makeBankVersion();
    const result = await callInduction("SAVE_QUESTION_BANK", {
      questionBank: state.bank,
      questionBankVersion: version
    });
    state.settings.questionBankVersion = result.questionBankVersion;
    state.settings.questionBankConfigured = true;
    state.dirty = false;
    renderAll();
    setNotice(elements.notice, `${result.questionCount} questions published as ${result.questionBankVersion}.`, "success");
  } catch (error) {
    setNotice(elements.notice, errorMessage(error), "error");
  } finally {
    elements.saveBank.disabled = false;
  }
}

function renderAll() {
  rebuildFlat();
  renderMetrics();
  renderFilters();
  renderQuestionList();
  renderReadiness();
}

function rebuildFlat() {
  state.flat = [];
  for (const [sectionIndex, section] of (state.bank.questionSections || []).entries()) {
    for (const [questionIndex, question] of (section.questions || []).entries()) {
      state.flat.push({ sectionIndex, questionIndex, section, question });
    }
  }
}

function renderMetrics() {
  const sections = state.bank.questionSections?.filter(section => section.questions?.length) || [];
  const required = Number(elements.count?.value || state.settings?.questionsPerAssessment || state.settings?.questionCount || 20);
  elements.bankTotal.textContent = String(state.flat.length);
  elements.bankSections.textContent = String(sections.length);
  elements.bankAssessmentCount.textContent = String(required);
  elements.bankVersion.textContent = state.settings?.questionBankVersion || "Not published";
  const configured = Boolean(state.settings?.questionBankConfigured || state.flat.length);
  elements.heroBankStatus.textContent = configured ? `${state.flat.length} questions` : "Not configured";
}

function renderFilters() {
  const current = elements.sectionFilter.value;
  const titles = [...new Set(state.flat.map(item => item.section.title).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  elements.sectionFilter.innerHTML = `<option value="">All sections</option>${titles.map(title => `<option value="${escapeHtml(title)}">${escapeHtml(title)}</option>`).join("")}`;
  if (titles.includes(current)) elements.sectionFilter.value = current;
}

function renderQuestionList() {
  const search = String(elements.questionSearch?.value || "").trim().toLowerCase();
  const section = elements.sectionFilter?.value || "";
  const filtered = state.flat.filter(item => {
    if (section && item.section.title !== section) return false;
    if (!search) return true;
    return `${item.section.title} ${item.question.question} ${(item.question.options || []).join(" ")}`.toLowerCase().includes(search);
  });

  elements.questionRows.innerHTML = filtered.map(item => {
    const globalIndex = state.flat.indexOf(item);
    const optionCount = item.question.options?.length || 0;
    return `
      <article class="assessment-question-row">
        <div class="assessment-question-row__section">
          <span>Section</span>
          <strong>${escapeHtml(item.section.title || "General")}</strong>
        </div>
        <div class="assessment-question-row__body">
          <strong>${escapeHtml(item.question.question)}</strong>
          <span>${optionCount} options · Correct: ${escapeHtml(item.question.correctAnswer)}</span>
        </div>
        <div class="assessment-question-row__actions">
          <button class="button" type="button" data-edit="${globalIndex}">Edit</button>
          <button class="button" type="button" data-remove="${globalIndex}">Remove</button>
        </div>
      </article>`;
  }).join("");

  elements.questionEmpty.hidden = filtered.length > 0;
}

function renderReadiness() {
  const validation = validateBank(state.bank);
  const required = Number(elements.count?.value || state.settings?.questionCount || 20);
  const enough = validation.valid.length >= required;
  elements.bankReadiness.className = `assessment-bank-readiness ${enough && !validation.errors.length ? "is-ready" : "is-not-ready"}`;
  if (!state.flat.length) {
    elements.bankReadiness.textContent = "No organisation question bank is published yet. Import or add questions before workers can start the assessment.";
  } else if (!enough) {
    elements.bankReadiness.textContent = `Bank not ready: ${validation.valid.length} valid questions available, ${required} required for each assessment.`;
  } else if (validation.errors.length) {
    elements.bankReadiness.textContent = `Bank needs attention: ${validation.errors[0]}`;
  } else {
    elements.bankReadiness.textContent = `${validation.valid.length} valid questions available. The bank is ready for a ${required}-question assessment${state.dirty ? " but has unpublished changes" : ""}.`;
  }
}

function handleQuestionAction(event) {
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-remove]");
  if (edit) openQuestionEditor(Number(edit.dataset.edit));
  if (remove) removeQuestion(Number(remove.dataset.remove));
}

function openQuestionEditor(index = null) {
  elements.questionForm.reset();
  if (index === null || !state.flat[index]) {
    elements.questionIndex.value = "new";
    elements.questionDialogTitle.textContent = "Add question";
    elements.questionSection.value = "General";
    elements.questionCategory.value = "general";
  } else {
    const item = state.flat[index];
    elements.questionIndex.value = String(index);
    elements.questionDialogTitle.textContent = "Edit question";
    elements.questionSection.value = item.section.title || "General";
    elements.questionCategory.value = item.question.category || item.section.id || "general";
    elements.questionText.value = item.question.question || "";
    elements.questionOptions.value = (item.question.options || []).join("\n");
    elements.correctAnswer.value = item.question.correctAnswer || "";
  }
  elements.questionDialog.showModal();
}

function applyQuestion(event) {
  event.preventDefault();
  const options = uniqueLines(elements.questionOptions.value);
  const correctAnswer = elements.correctAnswer.value.trim();
  const questionText = elements.questionText.value.trim();
  const sectionTitle = elements.questionSection.value.trim() || "General";
  const category = slug(elements.questionCategory.value || sectionTitle);

  if (!questionText) return setNotice(elements.notice, "Enter the question text.", "error");
  if (options.length < 2 || options.length > 6) return setNotice(elements.notice, "Use between 2 and 6 answer options.", "error");
  if (!options.includes(correctAnswer)) return setNotice(elements.notice, "The correct answer must exactly match one of the answer options.", "error");

  const indexValue = elements.questionIndex.value;
  const question = {
    id: indexValue === "new" ? uniqueQuestionId(questionText) : state.flat[Number(indexValue)].question.id,
    category,
    question: questionText,
    options,
    correctAnswer
  };

  if (indexValue === "new") {
    const section = ensureSection(sectionTitle, category);
    section.questions.push(question);
  } else {
    const old = state.flat[Number(indexValue)];
    const oldSection = state.bank.questionSections[old.sectionIndex];
    oldSection.questions.splice(old.questionIndex, 1);
    cleanupEmptySections();
    ensureSection(sectionTitle, category).questions.push(question);
  }

  state.dirty = true;
  elements.questionDialog.close();
  renderAll();
  setNotice(elements.notice, "Question added to the draft bank. Publish the bank when you are ready.", "success");
}

function removeQuestion(index) {
  const item = state.flat[index];
  if (!item) return;
  if (!confirm(`Remove this question from the draft bank?\n\n${item.question.question}`)) return;
  state.bank.questionSections[item.sectionIndex].questions.splice(item.questionIndex, 1);
  cleanupEmptySections();
  state.dirty = true;
  renderAll();
}

function openImportDialog() {
  elements.bankFile.value = "";
  elements.bankFileName.textContent = "No file selected";
  elements.bankPaste.value = "";
  elements.importSummary.hidden = true;
  elements.importSummary.className = "assessment-import-summary";
  state.fileText = "";
  elements.importDialog.showModal();
}

async function readBankFile() {
  const file = elements.bankFile.files?.[0];
  state.fileText = "";
  elements.bankFileName.textContent = file?.name || "No file selected";
  if (!file) return;
  try {
    state.fileText = await file.text();
    elements.importSummary.hidden = false;
    elements.importSummary.className = "assessment-import-summary";
    elements.importSummary.textContent = `${file.name} loaded. Select Validate and add to draft.`;
  } catch {
    elements.importSummary.hidden = false;
    elements.importSummary.className = "assessment-import-summary is-error";
    elements.importSummary.textContent = "The selected file could not be read.";
  }
}

function parseImportIntoDraft() {
  const raw = (elements.bankPaste.value.trim() || state.fileText.trim());
  if (!raw) return showImportError("Paste question-bank text or choose a CSV/text file first.");
  try {
    const parsed = looksLikeCsv(raw) ? parseCsvBank(raw) : parseTextBank(raw);
    const validation = validateBank(parsed);
    if (!validation.valid.length) return showImportError(validation.errors[0] || "No valid questions were found.");
    if (validation.errors.length) return showImportError(`${validation.valid.length} valid questions found, but the import also contains an error: ${validation.errors[0]}`);

    const mode = document.querySelector('input[name="importMode"]:checked')?.value || "replace";
    state.bank = mode === "append" ? mergeBanks(state.bank, parsed) : parsed;
    state.dirty = true;
    elements.importSummary.hidden = false;
    elements.importSummary.className = "assessment-import-summary";
    elements.importSummary.textContent = `${validation.valid.length} questions validated successfully and added to the draft bank.`;
    renderAll();
    setTimeout(() => elements.importDialog.close(), 450);
  } catch (error) {
    showImportError(error.message || "The question bank could not be parsed.");
  }
}

function showImportError(message) {
  elements.importSummary.hidden = false;
  elements.importSummary.className = "assessment-import-summary is-error";
  elements.importSummary.textContent = message;
}

function parseTextBank(raw) {
  const sections = new Map();
  let currentSection = "General";
  const blocks = raw.replace(/\r/g, "").split(/\n\s*\n+/).map(block => block.trim()).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const sectionLine = lines.find(line => /^SECTION\s*:/i.test(line));
    if (sectionLine) currentSection = valueAfterColon(sectionLine) || currentSection;
    const questionLine = lines.find(line => /^QUESTION\s*:/i.test(line));
    if (!questionLine) continue;
    const questionText = valueAfterColon(questionLine);
    const answers = [];
    const labels = new Map();
    for (const line of lines) {
      const match = line.match(/^([A-F])\s*:\s*(.+)$/i);
      if (!match) continue;
      const label = match[1].toUpperCase();
      const text = match[2].trim();
      if (text) { answers.push(text); labels.set(label, text); }
    }
    const answerLine = lines.find(line => /^ANSWER\s*:/i.test(line));
    const answerToken = answerLine ? valueAfterColon(answerLine).trim() : "";
    const correctAnswer = labels.get(answerToken.toUpperCase()) || answerToken;
    addParsedQuestion(sections, currentSection, questionText, answers, correctAnswer);
  }
  return sectionsToBank(sections);
}

function parseCsvBank(raw) {
  const rows = parseCsv(raw);
  if (rows.length < 2) throw new Error("The CSV file does not contain any question rows.");
  const header = rows[0].map(value => slug(value));
  const lookup = name => header.indexOf(slug(name));
  const questionIndex = lookup("question");
  if (questionIndex < 0) throw new Error("CSV template must contain a 'question' column.");

  const sections = new Map();
  for (const row of rows.slice(1)) {
    if (!row.some(value => String(value).trim())) continue;
    const section = valueAt(row, lookup("section")) || "General";
    const question = valueAt(row, questionIndex);
    const optionColumns = ["option_a","option_b","option_c","option_d","option_e","option_f"];
    const options = optionColumns.map(name => valueAt(row, lookup(name))).filter(Boolean);
    const token = valueAt(row, lookup("correct_answer"));
    const labelMap = new Map(options.map((option, index) => [String.fromCharCode(65 + index), option]));
    const correctAnswer = labelMap.get(String(token).toUpperCase()) || token;
    addParsedQuestion(sections, section, question, options, correctAnswer);
  }
  return sectionsToBank(sections);
}

function addParsedQuestion(sections, sectionTitle, questionText, options, correctAnswer) {
  if (!questionText) return;
  const sectionKey = slug(sectionTitle || "General");
  if (!sections.has(sectionKey)) sections.set(sectionKey, { id: sectionKey, title: sectionTitle || "General", questions: [] });
  sections.get(sectionKey).questions.push({
    id: uniqueQuestionId(questionText),
    category: sectionKey || "general",
    question: questionText.trim(),
    options: [...new Set(options.map(value => value.trim()).filter(Boolean))],
    correctAnswer: String(correctAnswer || "").trim()
  });
}

function sectionsToBank(sections) {
  return { categoryPlan: {}, questionSections: [...sections.values()] };
}

function validateBank(bank) {
  const valid = [];
  const errors = [];
  const ids = new Set();
  const questions = new Set();
  for (const section of bank?.questionSections || []) {
    for (const question of section.questions || []) {
      const text = String(question.question || "").trim();
      const options = Array.isArray(question.options) ? [...new Set(question.options.map(value => String(value).trim()).filter(Boolean))] : [];
      const answer = String(question.correctAnswer || "").trim();
      if (!text) { errors.push(`A question in ${section.title || "General"} has no question text.`); continue; }
      if (options.length < 2 || options.length > 6) { errors.push(`"${text}" must have between 2 and 6 answer options.`); continue; }
      if (!options.includes(answer)) { errors.push(`"${text}" has a correct answer that does not match an option.`); continue; }
      const fingerprint = text.toLowerCase();
      if (questions.has(fingerprint)) { errors.push(`Duplicate question: "${text}".`); continue; }
      questions.add(fingerprint);
      if (!question.id || ids.has(question.id)) question.id = uniqueQuestionId(text, ids);
      ids.add(question.id);
      valid.push(question);
    }
  }
  return { valid, errors };
}

function mergeBanks(left, right) {
  const merged = normaliseBank(structuredClone(left));
  for (const section of right.questionSections || []) {
    let target = merged.questionSections.find(item => slug(item.title) === slug(section.title));
    if (!target) { target = { id: section.id || slug(section.title), title: section.title, questions: [] }; merged.questionSections.push(target); }
    target.questions.push(...section.questions);
  }
  return merged;
}

function ensureSection(title, category) {
  const key = slug(title);
  let section = state.bank.questionSections.find(item => slug(item.title) === key);
  if (!section) {
    section = { id: key || category || "general", title, questions: [] };
    state.bank.questionSections.push(section);
  }
  return section;
}

function cleanupEmptySections() {
  state.bank.questionSections = (state.bank.questionSections || []).filter(section => section.questions?.length);
}

function normaliseBank(bank) {
  const safe = bank && typeof bank === "object" ? structuredClone(bank) : {};
  if (!safe.categoryPlan || typeof safe.categoryPlan !== "object") safe.categoryPlan = {};
  if (!Array.isArray(safe.questionSections)) safe.questionSections = [];
  safe.questionSections = safe.questionSections.map(section => ({
    id: section.id || slug(section.title || "general"),
    title: section.title || "General",
    questions: Array.isArray(section.questions) ? section.questions.map(question => ({
      id: question.id || uniqueQuestionId(question.question || "question"),
      category: question.category || slug(section.title || "general"),
      question: question.question || "",
      options: Array.isArray(question.options) ? question.options : [],
      correctAnswer: question.correctAnswer || ""
    })) : []
  }));
  return safe;
}

function downloadTemplate() {
  const csv = [
    ["section","category","question","option_a","option_b","option_c","option_d","correct_answer"],
    ["Fire safety","fire","What should you do if you discover a fire?","Raise the alarm and evacuate","Finish the task first","Wait for your supervisor","Ignore it","A"]
  ].map(row => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "normex-question-bank-template.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  row.push(field);
  if (row.some(value => value.length)) rows.push(row);
  return rows;
}

function looksLikeCsv(raw) {
  const first = raw.trim().split(/\r?\n/, 1)[0].toLowerCase();
  return first.includes("question") && first.includes(",");
}

function valueAt(row, index) { return index >= 0 ? String(row[index] ?? "").trim() : ""; }
function valueAfterColon(line) { return line.slice(line.indexOf(":") + 1).trim(); }
function uniqueLines(value) { return [...new Set(String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean))]; }
function slug(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "general"; }
function uniqueQuestionId(text, existing = new Set(state.flat.map(item => item.question.id))) {
  const base = slug(text).slice(0, 50) || "question";
  let id = base, suffix = 2;
  while (existing.has(id)) id = `${base}_${suffix++}`;
  return id;
}
function integerValue(element, label, min, max) {
  const value = Number(element?.value);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  return value;
}
function makeBankVersion() {
  const date = new Date();
  const pad = value => String(value).padStart(2, "0");
  return `QB-${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
function csvEscape(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
