"use strict";

const DEFAULTS = Object.freeze({
  passMarkPercent: 80,
  validityMonths: 12,
  videoUnlockSeconds: 5,
  maxAttempts: 3,
  cooldownSeconds: 60,
  questionCount: 20
});
const MAX_PUBLIC_SEARCH_RESULTS = 25;
const MAX_PUBLIC_SEARCH_TOKENS = 120;
const MAX_PUBLIC_SEARCH_QUERY_LENGTH = 100;

const clean = (value, max = 300) => String(value ?? "").trim().slice(0, max);
const upper = value => clean(value).toUpperCase();
const clampNumber = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
};

function normaliseSettings(raw = {}) {
  return {
    passMarkPercent: clampNumber(raw.passMarkPercent, DEFAULTS.passMarkPercent, 1, 100),
    validityMonths: clampNumber(raw.validityMonths, DEFAULTS.validityMonths, 1, 60),
    videoUnlockSeconds: clampNumber(raw.videoUnlockSeconds, DEFAULTS.videoUnlockSeconds, 1, 60),
    maxAttempts: clampNumber(raw.maxAttempts, DEFAULTS.maxAttempts, 1, 10),
    cooldownSeconds: clampNumber(raw.cooldownSeconds, DEFAULTS.cooldownSeconds, 10, 86400),
    questionCount: clampNumber(raw.questionCount, DEFAULTS.questionCount, 1, 50),
    videoTitle: clean(raw.videoTitle, 160),
    videoVersion: clean(raw.videoVersion, 80),
    videoUrl: clean(raw.videoUrl, 2000),
    storagePath: clean(raw.storagePath, 500),
    ruleNotes: clean(raw.ruleNotes, 1000)
  };
}

function todayISO(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addMonths(dateValue, months) {
  const date = new Date(`${dateValue}T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + Number(months || 0));
  return date.toISOString().slice(0, 10);
}

function displayStatus(record, now = new Date()) {
  const status = upper(record?.status || "VALID");
  if (status === "VALID" && clean(record?.expiresAt, 20) < todayISO(now)) return "EXPIRED";
  return status || "UNKNOWN";
}

function flattenQuestionBank(bank) {
  return (Array.isArray(bank?.questionSections) ? bank.questionSections : [])
    .flatMap(section => (Array.isArray(section.questions) ? section.questions : []).map(question => ({
      id: clean(question.id, 100),
      category: clean(question.category, 100),
      sectionId: clean(section.id, 100),
      sectionTitle: clean(section.title, 160),
      question: clean(question.question, 1000),
      options: Array.isArray(question.options) ? question.options.map(option => clean(option, 500)).filter(Boolean) : [],
      correctAnswer: clean(question.correctAnswer, 500)
    })))
    .filter(question => question.id && question.question && question.options.length >= 2 && question.options.includes(question.correctAnswer));
}

function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function selectQuestions(bank, count = DEFAULTS.questionCount, random = Math.random) {
  const all = flattenQuestionBank(bank);
  const byId = new Map(all.map(question => [question.id, question]));
  const selected = [];
  for (const [category, wanted] of Object.entries(bank?.categoryPlan || {})) {
    const pool = all.filter(question => question.category === category);
    selected.push(...shuffle(pool, random).slice(0, Math.max(0, Number(wanted) || 0)));
  }
  const unique = [...new Map(selected.map(question => [question.id, question])).values()];
  if (unique.length < count) {
    unique.push(...shuffle(all.filter(question => !unique.some(item => item.id === question.id)), random).slice(0, count - unique.length));
  }
  return shuffle(unique, random).slice(0, count).map(question => ({
    ...byId.get(question.id),
    options: shuffle(question.options, random)
  }));
}

function publicQuestions(questions) {
  return questions.map(({ correctAnswer, ...question }) => question);
}

function scoreAnswers(selectedQuestions, answers, passMarkPercent) {
  const answerMap = answers && typeof answers === "object" ? answers : {};
  const totalQuestions = selectedQuestions.length;
  const answered = selectedQuestions.filter(question => clean(answerMap[question.id], 500)).length;
  if (!totalQuestions || answered !== totalQuestions) {
    const error = new Error("Every question must be answered.");
    error.reason = "INCOMPLETE_TEST";
    throw error;
  }
  const correctAnswers = selectedQuestions.filter(question => clean(answerMap[question.id], 500) === question.correctAnswer).length;
  const scorePercent = Math.round((correctAnswers / totalQuestions) * 100);
  return {
    totalQuestions,
    correctAnswers,
    incorrectAnswers: totalQuestions - correctAnswers,
    scorePercent,
    passMarkPercent,
    passed: scorePercent >= passMarkPercent
  };
}

function normaliseInductionPrefix(value) {
  return upper(value).replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

function formatInductionNumber(prefix, sequence) {
  const normalisedPrefix = normaliseInductionPrefix(prefix);
  const number = Number(sequence);
  if (!normalisedPrefix || !Number.isSafeInteger(number) || number < 1 || number > 999999999) {
    const error = new Error("A valid induction prefix and sequence are required.");
    error.reason = "INVALID_INDUCTION_NUMBER";
    throw error;
  }
  return `${normalisedPrefix}-${String(number).padStart(5, "0")}`;
}

function nextInductionNumber(prefix, counter = {}) {
  const hasPrevious = counter.lastIssuedNumber !== undefined && counter.lastIssuedNumber !== null;
  const previous = hasPrevious ? Number(counter.lastIssuedNumber) : 0;
  if (!Number.isSafeInteger(previous) || previous < 0 || previous >= 999999999) {
    const error = new Error("The organisation induction counter is invalid.");
    error.reason = "INVALID_INDUCTION_COUNTER";
    throw error;
  }
  const sequence = previous + 1;
  return { sequence, inductionNumber: formatInductionNumber(prefix, sequence) };
}

function normaliseInductionNumber(value) {
  const match = upper(value).match(/^([A-Z0-9]{1,20})[-\s](\d{1,9})$/);
  if (!match || Number(match[2]) < 1) return "";
  return formatInductionNumber(match[1], Number(match[2]));
}

function normaliseSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function inductionSequenceFromNumber(value) {
  const match = upper(value).match(/^[A-Z0-9]{1,20}-(\d{1,9})$/);
  const sequence = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

function numericSearchTokens(sequence) {
  const number = Number(sequence);
  if (!Number.isSafeInteger(number) || number < 1 || number > 999999999) return [];
  const base = String(number);
  const tokens = [];
  for (let width = base.length; width <= Math.max(5, base.length); width += 1) {
    tokens.push(`N:${base.padStart(width, "0")}`);
  }
  return tokens;
}

function textPrefixTokens(value) {
  const normalised = normaliseSearchText(value);
  if (!normalised) return [];
  const words = normalised.split(" ").filter(Boolean);
  const compact = words.join("");
  const candidates = [...new Set([...words, compact])];
  const tokens = [];
  for (const candidate of candidates) {
    const maximum = Math.min(candidate.length, 30);
    for (let length = 2; length <= maximum; length += 1) tokens.push(`T:${candidate.slice(0, length)}`);
  }
  return tokens.slice(0, 28);
}

function buildPublicSearchTokens({ workerName, contractor, organisationName, inductionNumber, sequence } = {}) {
  const prefix = upper(inductionNumber).split("-")[0];
  const tokens = new Set([
    ...numericSearchTokens(sequence || inductionSequenceFromNumber(inductionNumber)),
    ...textPrefixTokens(workerName),
    ...textPrefixTokens(contractor),
    ...textPrefixTokens(organisationName),
    ...textPrefixTokens(prefix)
  ]);
  return [...tokens].slice(0, MAX_PUBLIC_SEARCH_TOKENS);
}

function normalisePublicSearchQuery(value) {
  const displayValue = String(value ?? "").trim();
  if (!displayValue) {
    const error = new Error("Enter a search term.");
    error.reason = "SEARCH_QUERY_REQUIRED";
    throw error;
  }
  if (displayValue.length > MAX_PUBLIC_SEARCH_QUERY_LENGTH) {
    const error = new Error(`Search terms must be ${MAX_PUBLIC_SEARCH_QUERY_LENGTH} characters or fewer.`);
    error.reason = "SEARCH_QUERY_TOO_LONG";
    throw error;
  }
  if (/^\d+$/.test(displayValue)) {
    const sequence = Number(displayValue);
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999999999) {
      const error = new Error("Enter a valid induction sequence number.");
      error.reason = "SEARCH_QUERY_INVALID";
      throw error;
    }
    return { displayQuery: displayValue, numeric: true, sequence, token: `N:${displayValue}` };
  }
  const normalised = normaliseSearchText(displayValue);
  const compact = normalised.replace(/\s/g, "");
  if (compact.length < 2) {
    const error = new Error("Text searches require at least 2 letters or numbers.");
    error.reason = "SEARCH_QUERY_TOO_SHORT";
    throw error;
  }
  return { displayQuery: normalised, numeric: false, token: `T:${compact}` };
}

function certificateMatchesSearch(certificate, query) {
  if (query.numeric) return inductionSequenceFromNumber(certificate?.inductionNumber) === query.sequence;
  const searchable = [certificate?.workerName, certificate?.contractor, upper(certificate?.inductionNumber).split("-")[0]];
  const wanted = query.displayQuery.replace(/\s/g, "");
  return searchable.some(value => {
    const normalised = normaliseSearchText(value);
    const candidates = [...normalised.split(" "), normalised.replace(/\s/g, "")].filter(Boolean);
    return candidates.some(candidate => candidate.startsWith(wanted));
  });
}

function limitPublicSearchResults(records) {
  return (Array.isArray(records) ? records : []).slice(0, MAX_PUBLIC_SEARCH_RESULTS);
}

module.exports = {
  DEFAULTS,
  MAX_PUBLIC_SEARCH_RESULTS,
  addMonths,
  buildPublicSearchTokens,
  certificateMatchesSearch,
  clean,
  displayStatus,
  flattenQuestionBank,
  formatInductionNumber,
  inductionSequenceFromNumber,
  limitPublicSearchResults,
  normaliseInductionNumber,
  normaliseInductionPrefix,
  normalisePublicSearchQuery,
  normaliseSearchText,
  normaliseSettings,
  nextInductionNumber,
  publicQuestions,
  scoreAnswers,
  selectQuestions,
  todayISO,
  upper
};
