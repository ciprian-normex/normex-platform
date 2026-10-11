"use strict";

const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const {
  DEFAULTS, MAX_PUBLIC_SEARCH_RESULTS, addMonths, buildPublicSearchTokens,
  certificateMatchesSearch, clean, displayStatus, flattenQuestionBank,
  inductionSequenceFromNumber, limitPublicSearchResults, nextInductionNumber,
  normaliseInductionNumber, normaliseInductionPrefix, normalisePublicSearchQuery,
  normaliseSettings, publicQuestions, scoreAnswers, selectQuestions, todayISO, upper
} = require("./induction-model.js");

const db = getFirestore();
const ORIGINS = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5000",
  "http://localhost:5000",
  "https://normex-platform.web.app",
  "https://normex-platform.firebaseapp.com"
];
const CORE_TYPE = "CORE_COMPANY";
const EMPTY_QUESTION_BANK = Object.freeze({ categoryPlan: {}, questionSections: [] });
const nowIso = () => new Date().toISOString();
const requestIdFor = uid => `CORE_COMPANY_${uid}`;
const settingsRefFor = organisationId => db.doc(`inductionSettings/${organisationId}`);
const LEGACY_PUBLIC_SEARCH_SCAN_LIMIT = 500;

function callableError(code, message, reason) {
  return new HttpsError(code, message, reason ? { reason } : undefined);
}

async function profileFor(uid) {
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw callableError("permission-denied", "A canonical NORMEX account is required.", "PROFILE_MISSING");
  const profile = { uid: snapshot.id, ...snapshot.data() };
  if (profile.status !== "ACTIVE" || !clean(profile.organisationId)) {
    throw callableError("permission-denied", "An active organisation account is required.", "ACCOUNT_INACTIVE");
  }
  return profile;
}

async function organisationFor(organisationIdValue) {
  const organisationId = clean(organisationIdValue, 128);
  const snapshot = await db.doc(`organisations/${organisationId}`).get();
  const organisation = snapshot.exists ? snapshot.data() : {};
  const prefix = normaliseInductionPrefix(
    organisation.inductionPrefix || organisation.shortName || organisation.name || organisationId
  );
  if (!prefix) {
    throw callableError(
      "failed-precondition",
      "The organisation needs a valid induction prefix before certificates can be issued.",
      "INDUCTION_PREFIX_MISSING"
    );
  }
  return { ...organisation, organisationId, prefix };
}

const isPlatform = profile => Number(profile?.accessLevel) >= 99 && upper(profile?.roleCode || profile?.role) === "PLATFORM_ADMIN";
const canViewManagement = profile => isPlatform(profile) || profile?.permissions?.canManageAssurance === true;
const canManage = profile => isPlatform(profile) || profile?.permissions?.canManageAssurance === true || (upper(profile?.roleCode || profile?.role) === "ORGANISATION_MANAGER" && profile?.permissions?.canManageOrganisation === true);
const assertViewManagement = profile => { if (!canViewManagement(profile)) throw callableError("permission-denied", "Induction management access is required.", "INDUCTION_VIEW_DENIED"); };
const assertManage = profile => { if (!canManage(profile)) throw callableError("permission-denied", "Induction management permission is required.", "INDUCTION_MANAGE_DENIED"); };

function personFromSnapshot(snapshot) {
  return snapshot.exists ? { ...snapshot.data(), personId: snapshot.id } : null;
}

function personBelongsToProfile(person, profile) {
  return Boolean(person && clean(person.organisationId, 128) === clean(profile.organisationId, 128));
}

async function repairProfilePersonId(profile, personId) {
  if (clean(profile.personId, 128) === personId) return;
  await db.doc(`users/${profile.uid}`).update({
    personId,
    updatedAt: nowIso(),
    updatedByUid: profile.uid,
    updatedByName: clean(profile.displayName || profile.email, 180)
  });
  profile.personId = personId;
}

async function createLegacyPerson(profile) {
  if (profile.status !== "ACTIVE" || !profile.uid || !clean(profile.organisationId, 128)) {
    throw callableError("permission-denied", "An active canonical organisation account is required.", "LEGACY_PERSON_REPAIR_DENIED");
  }

  const personRef = db.doc(`people/${profile.uid}`);
  const userRef = db.doc(`users/${profile.uid}`);
  const createdAt = nowIso();
  const firstName = clean(profile.firstName, 80);
  const lastName = clean(profile.lastName || profile.surname, 80);
  const displayName = clean(profile.displayName || `${firstName} ${lastName}`, 180);
  const actorName = clean(profile.displayName || profile.email, 180);
  const person = {
    personId: profile.uid,
    linkedUserUid: profile.uid,
    organisationId: clean(profile.organisationId, 128),
    firstName,
    lastName,
    displayName,
    email: clean(profile.email, 320),
    phone: clean(profile.phone, 60) || null,
    employmentType: clean(profile.employmentType, 60) || null,
    primaryRole: clean(profile.primaryRole || profile.position, 160) || null,
    primaryTrade: clean(profile.primaryTrade, 160) || null,
    active: true,
    employmentStatus: "ACTIVE",
    status: "ACTIVE",
    createdAt,
    createdByUid: profile.uid,
    createdByName: actorName,
    updatedAt: createdAt,
    updatedByUid: profile.uid
  };
  const batch = db.batch();
  batch.create(personRef, person);
  batch.update(userRef, {
    personId: profile.uid,
    updatedAt: createdAt,
    updatedByUid: profile.uid,
    updatedByName: actorName
  });

  try {
    await batch.commit();
  } catch (error) {
    if (error?.code === 6 || error?.code === "already-exists") {
      const existing = personFromSnapshot(await personRef.get());
      if (personBelongsToProfile(existing, profile)) {
        await repairProfilePersonId(profile, existing.personId);
        return existing;
      }
    }
    throw error;
  }

  profile.personId = profile.uid;
  return person;
}

async function personFor(profile, { createIfMissing = false } = {}) {
  const canonicalPersonId = clean(profile.personId, 128);
  if (canonicalPersonId) {
    const canonical = personFromSnapshot(await db.doc(`people/${canonicalPersonId}`).get());
    if (personBelongsToProfile(canonical, profile)) return canonical;
  }

  const legacySnapshot = await db.doc(`people/${profile.uid}`).get();
  const legacy = personFromSnapshot(legacySnapshot);
  if (personBelongsToProfile(legacy, profile)) {
    await repairProfilePersonId(profile, legacy.personId);
    return legacy;
  }

  const linked = await db.collection("people")
    .where("linkedUserUid", "==", profile.uid)
    .where("organisationId", "==", profile.organisationId)
    .limit(3)
    .get();
  if (linked.size > 1) {
    throw callableError("failed-precondition", "More than one People record is linked to this account.", "MULTIPLE_PERSON_RECORDS");
  }
  if (!linked.empty) {
    const person = personFromSnapshot(linked.docs[0]);
    await repairProfilePersonId(profile, person.personId);
    return person;
  }

  if (!createIfMissing) return null;
  if (legacySnapshot.exists) {
    throw callableError("failed-precondition", "The legacy People document belongs to another organisation.", "PERSON_ID_CONFLICT");
  }
  return createLegacyPerson(profile);
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function normaliseWorkflowSettings(raw = {}) {
  const base = normaliseSettings(raw);
  return {
    ...base,
    questionCount: boundedInteger(raw.questionCount, DEFAULTS.questionCount, 1, 100),
    passMarkPercent: boundedInteger(raw.passMarkPercent, DEFAULTS.passMarkPercent, 1, 100),
    maxAttempts: boundedInteger(raw.maxAttempts, DEFAULTS.maxAttempts, 1, 20),
    cooldownSeconds: boundedInteger(raw.cooldownSeconds, DEFAULTS.cooldownSeconds, 0, 86400),
    videoUnlockSeconds: boundedInteger(raw.videoUnlockSeconds, DEFAULTS.videoUnlockSeconds, 0, 30),
    validityMonths: boundedInteger(raw.validityMonths, DEFAULTS.validityMonths, 1, 120)
  };
}

function settingsWithAliases(settings) {
  return {
    ...settings,
    questionsPerAssessment: settings.questionCount,
    maximumAttempts: settings.maxAttempts,
    retryCooldownSeconds: settings.cooldownSeconds,
    completionToleranceSeconds: settings.videoUnlockSeconds
  };
}

async function loadSettings(organisationId, includeQuestionBank = false) {
  const scoped = await settingsRefFor(organisationId).get();
  let raw = scoped.exists ? scoped.data() : null;
  let source = "ORGANISATION";
  if (!raw) {
    const legacy = await db.doc("inductionSettings/live").get();
    raw = legacy.exists ? legacy.data() : {};
    source = legacy.exists ? "LEGACY_LIVE_FALLBACK" : "DEFAULTS";
  }
  const settings = settingsWithAliases(normaliseWorkflowSettings(raw || {}));
  settings.source = source;
  settings.configured = Boolean(raw && raw.videoUrl);
  settings.questionBankVersion = clean(raw?.questionBankVersion, 100);
  settings.questionBankConfigured = Boolean(raw?.questionBank && flattenQuestionBank(raw.questionBank).length);
  if (includeQuestionBank) settings.questionBank = raw?.questionBank || EMPTY_QUESTION_BANK;
  return settings;
}

async function currentCoreRecord(profile, person) {
  const base = db.collection("inductions");
  const byUid = await base.where("organisationId", "==", profile.organisationId).where("linkedUserUid", "==", profile.uid).limit(5).get();
  let records = byUid.docs.map(document => ({ docId: document.id, ...document.data() }));
  if (!records.length && person?.personId) {
    const byPerson = await base.where("organisationId", "==", profile.organisationId).where("personId", "==", person.personId).limit(5).get();
    records = byPerson.docs.map(document => ({ docId: document.id, ...document.data() }));
  }
  return records
    .filter(record => !record.inductionType || record.inductionType === CORE_TYPE)
    .sort((a, b) => String(b.completedAt || b.issuedAt || "").localeCompare(String(a.completedAt || a.issuedAt || "")))[0] || null;
}

function safeCertificate(record) {
  if (!record) return null;
  return {
    inductionNumber: clean(record.inductionNumber || record.docId, 80),
    inductionType: clean(record.inductionType || CORE_TYPE, 80),
    workerName: clean(record.workerName || record.fullName || record.name, 180),
    contractor: clean(record.contractor || record.company, 180),
    role: clean(record.role || record.primaryTrade || record.trade, 180),
    status: displayStatus(record),
    issuedAt: clean(record.issuedAt || record.completedAt, 40),
    completedAt: clean(record.completedAt || record.issuedAt, 40),
    expiresAt: clean(record.expiresAt || record.validUntil, 40),
    certificateType: clean(record.certificateType || "Core Company Induction", 120),
    videoVersion: clean(record.videoVersion, 80),
    imported: record.imported === true
  };
}

async function statusFor(profile) {
  const person = await personFor(profile);
  const [record, settings, request] = await Promise.all([
    currentCoreRecord(profile, person),
    loadSettings(profile.organisationId),
    db.doc(`inductionRequests/${requestIdFor(profile.uid)}`).get()
  ]);
  return {
    ok: true,
    profile: {
      displayName: clean(profile.displayName || `${profile.firstName || ""} ${profile.surname || ""}`, 180),
      email: clean(profile.email, 320),
      phone: clean(person?.phone || profile.phone, 60),
      primaryTrade: clean(person?.primaryTrade || person?.primaryRole || profile.position, 160),
      employmentType: clean(person?.employmentType || profile.employmentType, 60),
      personId: person?.personId || null,
      hasPeopleRecord: Boolean(person)
    },
    settings,
    certificate: safeCertificate(record),
    request: request.exists ? {
      requestId: request.id,
      status: clean(request.data().status, 80),
      videoVersion: clean(request.data().videoVersion, 80),
      videoConfirmedAt: clean(request.data().videoConfirmedAt, 60),
      attemptsUsed: Number(request.data().attemptsUsed || 0),
      cooldownUntil: clean(request.data().cooldownUntil, 60)
    } : null
  };
}

async function begin(profile, data) {
  const person = await personFor(profile, { createIfMissing: true });
  if (!person) throw callableError("failed-precondition", "A linked People record is required before starting induction.", "PERSON_RECORD_MISSING");
  const settings = await loadSettings(profile.organisationId);
  if (!settings.videoUrl) throw callableError("failed-precondition", "The Core Company Induction video is not configured.", "VIDEO_NOT_CONFIGURED");
  const existing = await currentCoreRecord(profile, person);
  const existingStatus = existing ? displayStatus(existing) : "NONE";
  if (existingStatus === "VALID" && existing?.reinductionAllowed !== true) {
    return { ok: true, outcome: "ALREADY_VALID", certificate: safeCertificate(existing) };
  }
  if (existing && existingStatus === "EXPIRED" && existing.reinductionAllowed !== true) {
    await db.doc(`inductionRequests/${requestIdFor(profile.uid)}`).set({
      requestType: "REINDUCTION_REQUESTED", inductionType: CORE_TYPE,
      organisationId: profile.organisationId, personId: person.personId,
      linkedUserUid: profile.uid, linkedInductionNumber: existing.inductionNumber || existing.docId,
      workerName: clean(profile.displayName || person.displayName, 180), status: "PENDING_MANAGER_APPROVAL",
      updatedAt: nowIso(), createdAt: nowIso()
    }, { merge: true });
    return { ok: true, outcome: "AWAITING_REINDUCTION_APPROVAL", certificate: safeCertificate(existing) };
  }
  const requestRef = db.doc(`inductionRequests/${requestIdFor(profile.uid)}`);
  const snapshot = await requestRef.get();
  const previous = snapshot.exists ? snapshot.data() : {};
  const phone = clean(data.phone || person.phone || profile.phone, 60);
  const primaryTrade = clean(data.primaryTrade || person.primaryTrade || person.primaryRole || profile.position, 160);
  await requestRef.set({
    requestType: existing ? "REINDUCTION" : "CORE_COMPANY_INDUCTION",
    inductionType: CORE_TYPE, organisationId: profile.organisationId,
    personId: person.personId, linkedUserUid: profile.uid,
    linkedInductionNumber: existing?.inductionNumber || existing?.docId || "",
    workerName: clean(profile.displayName || person.displayName, 180),
    emailEntered: clean(profile.email, 320), phoneEntered: phone, primaryTrade,
    employmentType: clean(person.employmentType || profile.employmentType, 60),
    status: "IN_PROGRESS", videoVersion: settings.videoVersion,
    attemptsUsed: Number(previous.attemptsUsed || 0),
    startedAt: previous.startedAt || nowIso(), updatedAt: nowIso(),
    createdAt: previous.createdAt || nowIso(),
    videoConfirmedAt: FieldValue.delete(), testQuestionIds: FieldValue.delete(), testOptions: FieldValue.delete()
  }, { merge: true });
  if (phone || primaryTrade) {
    await db.doc(`people/${person.personId}`).set({ phone: phone || null, primaryTrade: primaryTrade || null, updatedAt: nowIso(), updatedByUid: profile.uid }, { merge: true });
  }
  return { ok: true, outcome: "STARTED", requestId: requestRef.id, settings };
}

async function requireOwnRequest(profile) {
  const reference = db.doc(`inductionRequests/${requestIdFor(profile.uid)}`);
  const snapshot = await reference.get();
  if (!snapshot.exists || snapshot.data().organisationId !== profile.organisationId || snapshot.data().status !== "IN_PROGRESS") {
    throw callableError("failed-precondition", "Start the Core Company Induction before continuing.", "INDUCTION_NOT_STARTED");
  }
  return { reference, data: snapshot.data() };
}

async function confirmVideo(profile, data) {
  const request = await requireOwnRequest(profile);
  const settings = await loadSettings(profile.organisationId);
  if (clean(data.requestId, 128) !== request.reference.id || request.data.linkedUserUid !== profile.uid) {
    throw callableError("failed-precondition", "The active induction request does not belong to this account.", "INDUCTION_REQUEST_MISMATCH");
  }
  if (request.data.inductionType && request.data.inductionType !== CORE_TYPE) {
    throw callableError("failed-precondition", "The active request is not a Core Company Induction.", "INDUCTION_TYPE_MISMATCH");
  }
  if (!settings.videoUrl || !settings.videoVersion) {
    throw callableError("failed-precondition", "The Core Company Induction video is not published.", "VIDEO_NOT_CONFIGURED");
  }
  if (clean(data.videoVersion, 80) !== settings.videoVersion || clean(request.data.videoVersion, 80) !== settings.videoVersion) {
    throw callableError("failed-precondition", "The induction video changed. Reload and watch the current version.", "VIDEO_VERSION_CHANGED");
  }
  const durationSeconds = Number(data.durationSeconds);
  const watchedSeconds = Number(data.watchedSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw callableError("invalid-argument", "A valid video duration is required.", "INVALID_VIDEO_DURATION");
  }
  if (!Number.isFinite(watchedSeconds) || watchedSeconds < 0) {
    throw callableError("invalid-argument", "Valid watched video coverage is required.", "INVALID_WATCHED_SECONDS");
  }
  const tolerance = settings.videoUnlockSeconds;
  const requiredWatchedSeconds = Math.max(0, durationSeconds - tolerance);
  if (watchedSeconds < requiredWatchedSeconds) {
    throw callableError("failed-precondition", "Watch the complete induction video before continuing.", "VIDEO_INCOMPLETE");
  }
  const confirmedAt = nowIso();
  await request.reference.update({
    videoConfirmedAt: confirmedAt,
    videoVersion: settings.videoVersion,
    videoDurationSeconds: Math.round(durationSeconds),
    videoWatchedSeconds: Math.round(watchedSeconds),
    videoCompletionToleranceSeconds: tolerance,
    updatedAt: confirmedAt
  });
  return { ok: true, outcome: "VIDEO_CONFIRMED", videoVersion: settings.videoVersion };
}

async function activeBank(organisationId) {
  const settings = await loadSettings(organisationId, true);
  const bank = settings.questionBank || EMPTY_QUESTION_BANK;
  const available = flattenQuestionBank(bank).length;
  if (!settings.questionBankConfigured || available < settings.questionCount) {
    throw callableError(
      "failed-precondition",
      `The organisation question bank is not ready. ${available} valid questions are available and ${settings.questionCount} are required.`,
      "QUESTION_BANK_NOT_CONFIGURED"
    );
  }
  return { settings, bank };
}

async function getTest(profile) {
  const request = await requireOwnRequest(profile);
  if (!request.data.videoConfirmedAt) throw callableError("failed-precondition", "Complete the induction video before starting the assessment.", "VIDEO_NOT_CONFIRMED");
  const { settings, bank } = await activeBank(profile.organisationId);
  const attemptsUsed = Number(request.data.attemptsUsed || 0);
  if (attemptsUsed >= settings.maxAttempts) throw callableError("failed-precondition", "All assessment attempts have been used. Contact an induction manager.", "ATTEMPTS_EXHAUSTED");
  const cooldownUntil = Date.parse(request.data.cooldownUntil || "");
  if (Number.isFinite(cooldownUntil) && cooldownUntil > Date.now()) {
    throw callableError("resource-exhausted", "The assessment retry cooldown is still active.", "ASSESSMENT_COOLDOWN");
  }
  let selected = [];
  if (Array.isArray(request.data.testQuestionSnapshot) && request.data.testQuestionSnapshot.length === settings.questionCount) {
    selected = request.data.testQuestionSnapshot;
  }
  if (selected.length !== settings.questionCount) {
    selected = selectQuestions(bank, settings.questionCount);
    await request.reference.update({
      testQuestionIds: selected.map(question => question.id),
      testOptions: Object.fromEntries(selected.map(question => [question.id, question.options])),
      testQuestionSnapshot: selected,
      questionBankVersion: settings.questionBankVersion,
      testCreatedAt: nowIso(),
      updatedAt: nowIso(),
      cooldownUntil: FieldValue.delete()
    });
  }
  return {
    ok: true,
    questions: publicQuestions(selected),
    meta: { attemptsUsed, maxAttempts: settings.maxAttempts, passMarkPercent: settings.passMarkPercent }
  };
}

async function issueCertificate(profile, request, result, settings) {
  const person = await personFor(profile);
  const existing = await currentCoreRecord(profile, person);
  const isReinduction = Boolean(existing && existing.reinductionAllowed === true);
  const organisation = await organisationFor(profile.organisationId);
  const counterRef = db.doc(`inductionCounters/${profile.organisationId}`);
  return db.runTransaction(async transaction => {
    let inductionNumber = clean(existing?.inductionNumber || existing?.docId, 80);
    let issuance = null;
    let recordRef = inductionNumber ? db.doc(`inductions/${inductionNumber}`) : null;
    if (!isReinduction) {
      const counter = await transaction.get(counterRef);
      try {
        issuance = nextInductionNumber(organisation.prefix, counter.data());
      } catch (error) {
        throw callableError("failed-precondition", error.message, error.reason);
      }
      inductionNumber = issuance.inductionNumber;
      recordRef = db.doc(`inductions/${inductionNumber}`);
      const collision = await transaction.get(recordRef);
      if (collision.exists) {
        throw callableError(
          "already-exists",
          "The next organisation induction number is already in use. Contact a platform administrator.",
          "INDUCTION_NUMBER_COLLISION"
        );
      }
      transaction.set(counterRef, {
        organisationId: profile.organisationId,
        prefix: organisation.prefix,
        lastIssuedNumber: issuance.sequence,
        lastIssuedInductionNumber: inductionNumber,
        updatedAt: nowIso()
      }, { merge: true });
    }
    const issuedAt = todayISO();
    const workerName = clean(profile.displayName || person.displayName, 180);
    const contractor = clean(person.employerName || profile.organisationName || organisation.name || profile.organisationId, 180);
    const inductionSequenceNumber = issuance?.sequence || inductionSequenceFromNumber(inductionNumber);
    const historyEntry = {
      type: isReinduction ? "REINDUCTION" : "INITIAL_INDUCTION",
      completedAt: issuedAt, validFrom: issuedAt,
      validUntil: addMonths(issuedAt, settings.validityMonths),
      testScorePercent: result.scorePercent, videoVersion: settings.videoVersion,
      createdAt: nowIso()
    };
    const record = {
      inductionNumber, inductionType: CORE_TYPE,
      organisationId: profile.organisationId, personId: person.personId,
      linkedUserUid: profile.uid,
      workerName, fullName: workerName, contractor,
      role: clean(request.primaryTrade || person.primaryTrade || person.primaryRole || profile.position, 160),
      status: "VALID", certificateType: "Core Company Induction",
      certificateScope: "Core Company", completedAt: issuedAt, issuedAt,
      expiresAt: addMonths(issuedAt, settings.validityMonths),
      testPassed: true, testScorePercent: result.scorePercent,
      testCorrectAnswers: result.correctAnswers, testTotalQuestions: result.totalQuestions,
      attemptsUsed: Number(request.attemptsUsed || 0) + 1,
      passMarkPercent: settings.passMarkPercent,
      videoVersion: settings.videoVersion,
      questionBankVersion: settings.questionBankVersion,
      inductionSequenceNumber,
      publicSearchTokens: buildPublicSearchTokens({
        workerName,
        contractor,
        organisationName: organisation.name || profile.organisationName,
        inductionNumber,
        sequence: inductionSequenceNumber
      }),
      source: "normex-people-induction", imported: false,
      reinductionAllowed: false, reinductionUsed: isReinduction,
      updatedAt: nowIso(), createdAt: existing?.createdAt || nowIso(),
      inductionHistory: FieldValue.arrayUnion(historyEntry)
    };
    transaction.set(recordRef, record, { merge: true });
    transaction.set(request.reference, {
      status: "COMPLETED", result, completedAt: nowIso(),
      linkedInductionNumber: inductionNumber, attemptsUsed: record.attemptsUsed,
      testQuestionIds: FieldValue.delete(), testOptions: FieldValue.delete(),
      testQuestionSnapshot: FieldValue.delete(), updatedAt: nowIso()
    }, { merge: true });
    transaction.set(db.doc(`people/${person.personId}`), {
      inductionSummary: { type: CORE_TYPE, status: "VALID", inductionNumber, completedAt: issuedAt, expiresAt: record.expiresAt },
      updatedAt: nowIso(), updatedByUid: profile.uid
    }, { merge: true });
    return safeCertificate(record);
  });
}

async function submitTest(profile, data) {
  const request = await requireOwnRequest(profile);
  const { settings, bank } = await activeBank(profile.organisationId);
  const attemptsUsed = Number(request.data.attemptsUsed || 0);
  if (attemptsUsed >= settings.maxAttempts) throw callableError("failed-precondition", "All assessment attempts have been used.", "ATTEMPTS_EXHAUSTED");
  let selected = Array.isArray(request.data.testQuestionSnapshot) ? request.data.testQuestionSnapshot : [];
  if (selected.length !== settings.questionCount) {
    const all = flattenQuestionBank(bank);
    selected = (request.data.testQuestionIds || []).map(id => all.find(question => question.id === id)).filter(Boolean);
  }
  if (selected.length !== settings.questionCount) throw callableError("failed-precondition", "The assessment version is no longer available. Start a fresh assessment.", "QUESTION_VERSION_CHANGED");
  let result;
  try { result = scoreAnswers(selected, data.answers, settings.passMarkPercent); }
  catch (error) { throw callableError("invalid-argument", error.message, error.reason); }
  const nextAttempts = attemptsUsed + 1;
  if (!result.passed) {
    const exhausted = nextAttempts >= settings.maxAttempts;
    const cooldownUntil = new Date(Date.now() + settings.cooldownSeconds * 1000).toISOString();
    await request.reference.update({
      attemptsUsed: nextAttempts, lastResult: result,
      status: exhausted ? "FAILED" : "IN_PROGRESS",
      cooldownUntil: exhausted ? FieldValue.delete() : cooldownUntil,
      testQuestionIds: FieldValue.delete(), testOptions: FieldValue.delete(),
      testQuestionSnapshot: FieldValue.delete(), updatedAt: nowIso()
    });
    return { ok: true, outcome: exhausted ? "FAILED_LOCKED" : "FAILED_RETRY", result, attemptsUsed: nextAttempts, maxAttempts: settings.maxAttempts, cooldownUntil: exhausted ? null : cooldownUntil };
  }
  const certificate = await issueCertificate(profile, { ...request.data, reference: request.reference }, result, settings);
  return { ok: true, outcome: "PASSED", result, certificate };
}

function managementRecord(document) {
  const data = document.data ? document.data() : document;
  return {
    ...safeCertificate({ docId: document.id, ...data }),
    docId: document.id,
    personId: clean(data.personId, 128),
    linkedUserUid: clean(data.linkedUserUid, 128),
    employmentType: clean(data.employmentType, 60),
    primaryTrade: clean(data.role || data.primaryTrade, 160),
    reinductionAllowed: data.reinductionAllowed === true,
    source: clean(data.source, 100), organisationId: clean(data.organisationId, 128)
  };
}

async function listTracker(profile) {
  assertViewManagement(profile);
  const inductionQuery = isPlatform(profile)
    ? db.collection("inductions").limit(1000)
    : db.collection("inductions").where("organisationId", "==", profile.organisationId).limit(1000);
  const peopleQuery = db.collection("people").where("organisationId", "==", profile.organisationId).limit(1000);
  const [inductionSnapshot, peopleSnapshot, requestSnapshot] = await Promise.all([
    inductionQuery.get(), peopleQuery.get(),
    db.collection("inductionRequests").where("organisationId", "==", profile.organisationId).limit(500).get()
  ]);
  const records = inductionSnapshot.docs.map(managementRecord);
  const latestByPerson = new Map();
  for (const record of records) {
    if (!record.personId) continue;
    const previous = latestByPerson.get(record.personId);
    if (!previous || String(record.completedAt).localeCompare(String(previous.completedAt)) > 0) latestByPerson.set(record.personId, record);
  }
  const people = peopleSnapshot.docs.map(document => {
    const person = document.data();
    const record = latestByPerson.get(document.id) || null;
    return {
      personId: document.id,
      displayName: clean(person.displayName || `${person.firstName || ""} ${person.lastName || ""}`, 180),
      employmentType: clean(person.employmentType, 60),
      primaryTrade: clean(person.primaryTrade || person.primaryRole, 160),
      active: person.active !== false,
      induction: record
    };
  });
  const requests = requestSnapshot.docs.map(document => ({
    requestId: document.id, status: clean(document.data().status, 80),
    requestType: clean(document.data().requestType, 100),
    workerName: clean(document.data().workerName, 180),
    personId: clean(document.data().personId, 128),
    linkedInductionNumber: clean(document.data().linkedInductionNumber, 80),
    attemptsUsed: Number(document.data().attemptsUsed || 0),
    updatedAt: clean(document.data().updatedAt, 60)
  }));
  return { ok: true, records, people, requests, canManage: canManage(profile), legacyUnscopedVisible: isPlatform(profile) };
}

async function adminUpdate(profile, data) {
  assertManage(profile);
  const action = upper(data.adminAction || "ADMIN_UPDATE");
  if (action === "RESET_ATTEMPTS") {
    const personId = clean(data.personId, 128);
    if (!personId) throw callableError("invalid-argument", "A person is required to reset attempts.");
    const matches = await db.collection("inductionRequests")
      .where("organisationId", "==", profile.organisationId)
      .where("personId", "==", personId)
      .limit(5)
      .get();
    if (matches.empty) throw callableError("not-found", "The induction request was not found.");
    const batch = db.batch();
    for (const document of matches.docs) {
      batch.set(document.ref, {
        status: "IN_PROGRESS", attemptsUsed: 0,
        cooldownUntil: FieldValue.delete(), testQuestionIds: FieldValue.delete(),
        testOptions: FieldValue.delete(), testQuestionSnapshot: FieldValue.delete(), updatedAt: nowIso(),
        attemptsResetByUid: profile.uid, attemptsResetAt: nowIso()
      }, { merge: true });
    }
    await batch.commit();
    return { ok: true, outcome: "RESET_ATTEMPTS" };
  }
  const id = normaliseInductionNumber(data.inductionNumber);
  if (!id) throw callableError("invalid-argument", "A valid induction number is required.");
  const reference = db.doc(`inductions/${id}`);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw callableError("not-found", "The induction record was not found.");
  const record = snapshot.data();
  if (!isPlatform(profile) && record.organisationId !== profile.organisationId) throw callableError("permission-denied", "The induction belongs to another organisation.", "WRONG_ORGANISATION");
  const allowedStatuses = new Set(["VALID", "SUSPENDED", "INVALID", "REINDUCTION_ACTIVE"]);
  const status = upper(data.status || record.status);
  if (!allowedStatuses.has(status)) throw callableError("invalid-argument", "Select a supported induction status.");
  const history = {
    action, status, note: clean(data.note, 1000), createdAt: nowIso(),
    updatedByUid: profile.uid, updatedBy: clean(profile.displayName || profile.email, 180)
  };
  const update = {
    status, notes: history.note, lastAdminAction: action,
    lastAdminUpdatedAt: history.createdAt, updatedAt: history.createdAt,
    adminHistory: FieldValue.arrayUnion(history)
  };
  if (action === "REINDUCTION_ACTIVATED") {
    Object.assign(update, { status: "REINDUCTION_ACTIVE", reinductionAllowed: true, reinductionUsed: false, reinductionActivatedAt: history.createdAt, reinductionActivatedByUid: profile.uid });
  }
  await reference.set(update, { merge: true });
  return { ok: true, outcome: action };
}

async function adminSettings(profile, includeBank = false) {
  assertManage(profile);
  return { ok: true, settings: await loadSettings(profile.organisationId, includeBank) };
}

const SETTING_LIMITS = {
  questionCount: [1, 100],
  passMarkPercent: [1, 100],
  maxAttempts: [1, 20],
  cooldownSeconds: [0, 86400],
  videoUnlockSeconds: [0, 30],
  validityMonths: [1, 120]
};

function translateSettingsInput(input = {}) {
  const translated = { ...input };
  const aliases = {
    questionsPerAssessment: "questionCount",
    maximumAttempts: "maxAttempts",
    retryCooldownSeconds: "cooldownSeconds",
    completionToleranceSeconds: "videoUnlockSeconds"
  };
  for (const [friendly, internal] of Object.entries(aliases)) {
    if (Object.prototype.hasOwnProperty.call(input, friendly)) translated[internal] = input[friendly];
    delete translated[friendly];
  }
  return translated;
}

function validateSettingsInput(input) {
  for (const [field, [minimum, maximum]] of Object.entries(SETTING_LIMITS)) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const value = Number(input[field]);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw callableError("invalid-argument", `${field} must be a whole number from ${minimum} to ${maximum}.`, "INVALID_INDUCTION_SETTING");
    }
    input[field] = value;
  }
  return input;
}

async function saveSettings(profile, data) {
  assertManage(profile);
  const current = await loadSettings(profile.organisationId);
  const incoming = validateSettingsInput(translateSettingsInput(data.settings || {}));
  const next = normaliseWorkflowSettings({ ...current, ...incoming });
  if (next.videoUrl && !/^https:\/\//i.test(next.videoUrl)) throw callableError("invalid-argument", "The active video URL must use HTTPS.");
  if (next.storagePath && !next.storagePath.startsWith(`inductionVideos/${profile.organisationId}/`)) throw callableError("invalid-argument", "The video storage path is outside this organisation.");
  const publishedAt = nowIso();
  const publishedBy = clean(profile.displayName || profile.email, 180);
  await settingsRefFor(profile.organisationId).set({
    ...next, organisationId: profile.organisationId, active: true,
    publishedAt, publishedByUid: profile.uid, publishedBy,
    updatedAt: publishedAt, updatedByUid: profile.uid, updatedBy: publishedBy
  }, { merge: true });
  return { ok: true, outcome: "SETTINGS_SAVED", settings: settingsWithAliases(next) };
}

async function saveQuestionBank(profile, data) {
  assertManage(profile);
  const bank = data.questionBank;
  const questions = flattenQuestionBank(bank);
  const settings = await loadSettings(profile.organisationId);
  const minimumQuestions = settings.questionCount || DEFAULTS.questionCount;
  if (questions.length < minimumQuestions) throw callableError("invalid-argument", `At least ${minimumQuestions} valid questions are required.`);
  const questionBankVersion = clean(data.questionBankVersion || `v${Date.now()}`, 100);
  await settingsRefFor(profile.organisationId).set({
    questionBank: bank, questionBankVersion,
    organisationId: profile.organisationId,
    questionBankUpdatedAt: nowIso(), questionBankUpdatedByUid: profile.uid,
    updatedAt: nowIso(), updatedByUid: profile.uid
  }, { merge: true });
  return { ok: true, outcome: "QUESTION_BANK_SAVED", questionCount: questions.length, questionBankVersion };
}

async function handleManage(request) {
  if (!request.auth?.uid) throw callableError("unauthenticated", "Sign in is required.");
  const profile = await profileFor(request.auth.uid);
  const data = request.data || {};
  const action = upper(data.action);
  if (action === "STATUS") return statusFor(profile);
  if (action === "BEGIN") return begin(profile, data);
  if (action === "CONFIRM_VIDEO") return confirmVideo(profile, data);
  if (action === "GET_TEST") return getTest(profile);
  if (action === "SUBMIT_TEST") return submitTest(profile, data);
  if (action === "LIST_TRACKER" || action === "LIST_CERTIFICATES") return listTracker(profile);
  if (action === "ADMIN_UPDATE") return adminUpdate(profile, data);
  if (action === "GET_ADMIN_SETTINGS") return adminSettings(profile, false);
  if (action === "SAVE_SETTINGS") return saveSettings(profile, data);
  if (action === "GET_ADMIN_QUESTION_BANK") return adminSettings(profile, true);
  if (action === "SAVE_QUESTION_BANK") return saveQuestionBank(profile, data);
  throw callableError("invalid-argument", "Unknown induction action.");
}

async function handleVerify(request) {
  if (request.data?.searchQuery !== undefined) return searchCertificates(request.data.searchQuery);
  const inductionNumber = normaliseInductionNumber(request.data?.inductionNumber);
  if (!inductionNumber) throw callableError("invalid-argument", "Enter a valid induction number.");
  const snapshot = await db.doc(`inductions/${inductionNumber}`).get();
  if (!snapshot.exists) return { ok: true, found: false, inductionNumber };
  return { ok: true, found: true, certificate: safeCertificate({ docId: snapshot.id, ...snapshot.data() }) };
}

async function searchCertificates(searchQuery) {
  let query;
  try {
    query = normalisePublicSearchQuery(searchQuery);
  } catch (error) {
    throw callableError("invalid-argument", error.message, error.reason);
  }

  const exactNumber = normaliseInductionNumber(searchQuery);
  if (exactNumber) {
    const exact = await db.doc(`inductions/${exactNumber}`).get();
    if (exact.exists) {
      return { ok: true, mode: "SEARCH", query: query.displayQuery, results: [safeCertificate({ docId: exact.id, ...exact.data() })] };
    }
  }

  const indexed = await db.collection("inductions")
    .where("publicSearchTokens", "array-contains", query.token)
    .limit(MAX_PUBLIC_SEARCH_RESULTS)
    .get();
  let results = indexed.docs.map(document => safeCertificate({ docId: document.id, ...document.data() }));

  if (!results.length) {
    const legacy = await db.collection("inductions").limit(LEGACY_PUBLIC_SEARCH_SCAN_LIMIT).get();
    results = legacy.docs
      .map(document => safeCertificate({ docId: document.id, ...document.data() }))
      .filter(certificate => certificateMatchesSearch(certificate, query));
  }

  results.sort((left, right) => left.inductionNumber.localeCompare(right.inductionNumber));
  return { ok: true, mode: "SEARCH", query: query.displayQuery, results: limitPublicSearchResults(results) };
}

exports.manageInductionWorkflow = onCall({ cors: ORIGINS, maxInstances: 10 }, async request => {
  try { return await handleManage(request); }
  catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Induction workflow failed", error);
    throw callableError("internal", "The induction service could not complete this action.");
  }
});

exports.verifyInductionCertificate = onCall({ cors: ORIGINS, maxInstances: 10 }, async request => {
  try { return await handleVerify(request); }
  catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Certificate verification failed", error);
    throw callableError("internal", "Certificate verification is temporarily unavailable.");
  }
});

exports._test = {
  canManage,
  canViewManagement,
  searchCertificates,
  normaliseWorkflowSettings,
  safeCertificate,
  settingsWithAliases,
  translateSettingsInput,
  validateSettingsInput
};
