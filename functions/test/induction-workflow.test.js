"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { getApps, initializeApp } = require("firebase-admin/app");

if (!getApps().length) initializeApp({ projectId: "demo-normex-induction" });

const {
  normaliseWorkflowSettings,
  safeCertificate,
  settingsWithAliases,
  translateSettingsInput,
  validateSettingsInput
} = require("../induction.js")._test;

test("friendly administration settings translate to internal workflow fields", () => {
  const translated = translateSettingsInput({
    questionsPerAssessment: 10,
    maximumAttempts: 5,
    retryCooldownSeconds: 0,
    completionToleranceSeconds: 3,
    questionCount: 20
  });
  assert.equal(translated.questionCount, 10);
  assert.equal(translated.maxAttempts, 5);
  assert.equal(translated.cooldownSeconds, 0);
  assert.equal(translated.videoUnlockSeconds, 3);
  assert.equal("questionsPerAssessment" in translated, false);
});

test("workflow settings support the approved integer ranges and aliases", () => {
  const settings = normaliseWorkflowSettings({
    questionCount: 100,
    passMarkPercent: 90,
    maxAttempts: 20,
    cooldownSeconds: 0,
    videoUnlockSeconds: 0,
    validityMonths: 120
  });
  const response = settingsWithAliases(settings);
  assert.equal(response.questionsPerAssessment, 100);
  assert.equal(response.maximumAttempts, 20);
  assert.equal(response.retryCooldownSeconds, 0);
  assert.equal(response.completionToleranceSeconds, 0);
  assert.equal(response.validityMonths, 120);
});

test("invalid administration settings are rejected instead of silently defaulted", () => {
  assert.throws(
    () => validateSettingsInput({ questionCount: 10.5 }),
    error => error.code === "invalid-argument" && error.details?.reason === "INVALID_INDUCTION_SETTING"
  );
  assert.throws(
    () => validateSettingsInput({ videoUnlockSeconds: 31 }),
    error => error.code === "invalid-argument"
  );
});

test("safe certificates remain the public data boundary", () => {
  const certificate = safeCertificate({
    inductionNumber: "COLEMANS-00001",
    workerName: "Ciprian Trusca",
    contractor: "Colemans",
    email: "private@example.com",
    phone: "private",
    dateOfBirth: "private",
    linkedUserUid: "private",
    personId: "private",
    adminHistory: [{ note: "private" }],
    publicSearchTokens: ["T:CIP"]
  });
  assert.equal(certificate.inductionNumber, "COLEMANS-00001");
  for (const unsafe of ["email", "phone", "dateOfBirth", "linkedUserUid", "personId", "adminHistory", "publicSearchTokens"]) {
    assert.equal(Object.hasOwn(certificate, unsafe), false);
  }
});
