"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  addMonths, buildPublicSearchTokens, certificateMatchesSearch, displayStatus,
  formatInductionNumber, limitPublicSearchResults, nextInductionNumber,
  normaliseInductionNumber, normaliseInductionPrefix, normalisePublicSearchQuery,
  normaliseSettings, publicQuestions, scoreAnswers, selectQuestions
} = require("../induction-model.js");

const bank = {
  categoryPlan: { safety: 1 },
  questionSections: [{ id: "core", title: "Core", questions: [
    { id: "q1", category: "safety", question: "One?", options: ["A", "B"], correctAnswer: "A" },
    { id: "q2", category: "safety", question: "Two?", options: ["C", "D"], correctAnswer: "D" }
  ] }]
};

test("settings preserve legacy defaults and reject unsafe ranges", () => {
  assert.deepEqual(normaliseSettings({ passMarkPercent: 0, validityMonths: 99 }).passMarkPercent, 80);
  assert.equal(normaliseSettings({ passMarkPercent: 85 }).passMarkPercent, 85);
});

test("selected worker questions never expose correct answers", () => {
  const selected = selectQuestions(bank, 2, () => 0.5);
  assert.equal(selected.length, 2);
  assert.equal("correctAnswer" in publicQuestions(selected)[0], false);
});

test("assessment scoring remains server-side and honours configured pass mark", () => {
  const selected = selectQuestions(bank, 2, () => 0.5);
  const answers = Object.fromEntries(selected.map(question => [question.id, question.correctAnswer]));
  assert.equal(scoreAnswers(selected, answers, 80).passed, true);
  assert.throws(() => scoreAnswers(selected, {}, 80), error => error.reason === "INCOMPLETE_TEST");
});

test("certificate helpers preserve numbering, expiry and status", () => {
  assert.equal(normaliseInductionNumber("normex 12"), "NORMEX-00012");
  assert.equal(normaliseInductionNumber("COLEMANS-00001"), "COLEMANS-00001");
  assert.equal(normaliseInductionNumber("certificate NORMEX-00001"), "");
  assert.equal(addMonths("2026-01-15", 12), "2027-01-15");
  assert.equal(displayStatus({ status: "VALID", expiresAt: "2025-01-01" }, new Date("2026-01-01T12:00:00Z")), "EXPIRED");
});

test("organisation induction prefixes are normalised and bounded", () => {
  assert.equal(normaliseInductionPrefix("Turner & Sons Ltd"), "TURNERSONSLTD");
  assert.equal(normaliseInductionPrefix("abcdefghijklmnopqrstuv"), "ABCDEFGHIJKLMNOPQRST");
  assert.equal(formatInductionNumber("QSC Safety", 42), "QSCSAFETY-00042");
});

test("organisation induction counters issue independent sequences", () => {
  const colemansFirst = nextInductionNumber("Colemans");
  const colemansSecond = nextInductionNumber("Colemans", { lastIssuedNumber: colemansFirst.sequence });
  const qscFirst = nextInductionNumber("QSC");

  assert.deepEqual(colemansFirst, { sequence: 1, inductionNumber: "COLEMANS-00001" });
  assert.deepEqual(colemansSecond, { sequence: 2, inductionNumber: "COLEMANS-00002" });
  assert.deepEqual(qscFirst, { sequence: 1, inductionNumber: "QSC-00001" });
});

test("invalid persisted counters fail instead of restarting at one", () => {
  assert.throws(
    () => nextInductionNumber("Colemans", { lastIssuedNumber: "not-a-number" }),
    error => error.reason === "INVALID_INDUCTION_COUNTER"
  );
});

test("public search tokens support safe name, organisation and numeric prefix search", () => {
  const tokens = buildPublicSearchTokens({
    workerName: "Ciprian Trusca",
    contractor: "Colemans",
    inductionNumber: "COLEMANS-00001",
    sequence: 1
  });
  assert.equal(tokens.includes("T:CIP"), true);
  assert.equal(tokens.includes("T:TRU"), true);
  assert.equal(tokens.includes("T:COLE"), true);
  assert.equal(tokens.includes("N:1"), true);
  assert.equal(tokens.includes("N:01"), true);
  assert.equal(tokens.includes("N:001"), true);
  assert.equal(tokens.includes("N:0001"), true);
  assert.equal(tokens.includes("N:00001"), true);
});

test("legacy certificate matching supports numeric, name and company prefixes", () => {
  const certificate = { inductionNumber: "NORMEX-00001", workerName: "Ciprian Trusca", contractor: "Colemans" };
  assert.equal(certificateMatchesSearch(certificate, normalisePublicSearchQuery("1")), true);
  assert.equal(certificateMatchesSearch(certificate, normalisePublicSearchQuery("cip")), true);
  assert.equal(certificateMatchesSearch(certificate, normalisePublicSearchQuery("tru")), true);
  assert.equal(certificateMatchesSearch(certificate, normalisePublicSearchQuery("Cole")), true);
});

test("public search validation rejects short text and oversized queries", () => {
  assert.throws(() => normalisePublicSearchQuery("c"), error => error.reason === "SEARCH_QUERY_TOO_SHORT");
  assert.throws(() => normalisePublicSearchQuery("x".repeat(101)), error => error.reason === "SEARCH_QUERY_TOO_LONG");
  assert.equal(normalisePublicSearchQuery("1").token, "N:1");
});

test("public search results are capped at 25", () => {
  assert.equal(limitPublicSearchResults(Array.from({ length: 30 }, (_, index) => index)).length, 25);
});
