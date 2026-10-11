"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { defineString } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { logger, setGlobalOptions } = require("firebase-functions/v2");
const {
  EMPLOYMENT_TYPES, assertStatusTransition, assertTargetManageable, assignableRoles,
  canAdministerUsers, existingAccountOutcome, roleForAssignment
} = require("./authority.js");

initializeApp();
setGlobalOptions({ region: "europe-west2", maxInstances: 10 });

const NORMEX_WEB_API_KEY =
  defineString("NORMEX_WEB_API_KEY");
const MANAGE_USER_ACCOUNT_ORIGINS = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://normex-platform.web.app",
  "https://normex-platform.firebaseapp.com"
];
const db = getFirestore();
const auth = getAuth();
const clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);
const normalEmail = value => clean(value, 320).toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicAccount = (uid, profile) => ({ uid, status: profile.status, displayName: profile.displayName, email: profile.email, personId: profile.personId || uid });

function fail(error, fallback = "Account administration failed.") {
  if (error instanceof HttpsError) throw error;
  const reason = error?.reason || error?.code || "INTERNAL";
  if (["PERMISSION_DENIED", "SELF_MANAGEMENT_DENIED", "WRONG_ORGANISATION", "TARGET_NOT_BELOW_ACTOR", "AUTHORITY_NOT_BELOW_ACTOR"].includes(reason)) throw new HttpsError("permission-denied", error.message, { reason });
  if (["INVALID_AUTHORITY", "TARGET_UNAVAILABLE"].includes(reason)) throw new HttpsError("failed-precondition", error.message, { reason });
  logger.error(fallback, error);
  throw new HttpsError("internal", fallback);
}

async function actorProfile(uid) {
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError("permission-denied", "An active canonical account is required.");
  return { uid: snapshot.id, ...snapshot.data() };
}

async function targetProfile(uid) {
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw Object.assign(new Error("The target account is unavailable."), { reason: "TARGET_UNAVAILABLE" });
  return { uid: snapshot.id, ...snapshot.data() };
}

function identity(data) {
  const firstName = clean(data.firstName, 80), surname = clean(data.surname, 80);
  if (!firstName || !surname) throw new HttpsError("invalid-argument", "First name and surname are required.");
  const employmentType = clean(data.employmentType, 40).toUpperCase();
  if (!EMPLOYMENT_TYPES.has(employmentType)) throw new HttpsError("invalid-argument", "Select a valid employment type.");
  return { firstName, surname, lastName: surname, displayName: `${firstName} ${surname}`, employmentType, position: clean(data.position, 120) || null, phone: clean(data.phone, 50) || null };
}

function audit(batch, action, actor, targetUid, targetName, before = null, after = null, detail = null) {
  const ref = db.collection("adminAuditEvents").doc();
  batch.set(ref, { action, organisationId: actor.organisationId, actorUid: actor.uid, actorName: actor.displayName || actor.email || "Administrator", targetUid, targetName: targetName || null, before, after, detail, createdAt: FieldValue.serverTimestamp() });
}

async function sendInvitationEmail(email) {
  const apiKey = NORMEX_WEB_API_KEY.value();

if (!apiKey) {
  throw new Error("NORMEX_WEB_API_KEY is not configured.");
}
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestType: "PASSWORD_RESET", email })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || `Invitation email failed (${response.status}).`);
  }
}

async function invite(actor, data) {
  if (!canAdministerUsers(actor)) throw Object.assign(new Error("User administration permission is required."), { reason: "PERMISSION_DENIED" });
  const person = identity(data), email = normalEmail(data.email), role = roleForAssignment(actor, data.roleCode || "WORKER");
  if (!validEmail(email)) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  try {
    const existingAuth = await auth.getUserByEmail(email);
    const existing = await db.doc(`users/${existingAuth.uid}`).get();
    if (!existing.exists) throw new HttpsError("failed-precondition", "An Auth identity exists without an account profile. Platform recovery is required.", { reason: "ORPHAN_AUTH_IDENTITY" });
    const profile = existing.data();
    if (!actor.organisationId || (actor.roleCode !== "PLATFORM_ADMIN" && profile.organisationId !== actor.organisationId)) throw Object.assign(new Error("The email belongs to another organisation."), { reason: "WRONG_ORGANISATION" });
    const outcome = existingAccountOutcome(profile.status);
    return { ok: true, outcome, account: publicAccount(existingAuth.uid, profile) };
  } catch (error) {
    if (error instanceof HttpsError || error?.reason) throw error;
    if (error?.code !== "auth/user-not-found") throw error;
  }

  let created;
  try {
    created = await auth.createUser({ email, displayName: person.displayName, emailVerified: false, disabled: false });
    const userRef = db.doc(`users/${created.uid}`), peopleRef = db.doc(`people/${created.uid}`), batch = db.batch();
    const profile = {
      organisationId: actor.organisationId, status: "INVITED", accessLevel: role.accessLevel, roleCode: role.roleCode,
      permissions: role.permissions, workspaceAccess: { contractor: true }, firstName: person.firstName, surname: person.surname,
      displayName: person.displayName, email, phone: person.phone, employmentType: person.employmentType, position: person.position,
      personId: created.uid, invitationStatus: "PENDING", invitedByUid: actor.uid, invitedByName: actor.displayName || actor.email || null,
      invitedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedByUid: actor.uid
    };
    batch.create(userRef, profile);
    batch.create(peopleRef, {
      organisationId: actor.organisationId, linkedUserUid: created.uid, personId: created.uid, firstName: person.firstName,
      lastName: person.lastName, displayName: person.displayName, email, phone: person.phone, employmentType: person.employmentType,
      primaryRole: person.position, employmentStatus: "ACTIVE", status: "ACTIVE", active: true,
      createdByUid: actor.uid, createdByName: actor.displayName || actor.email || null, createdAt: FieldValue.serverTimestamp(), updatedByUid: actor.uid, updatedAt: FieldValue.serverTimestamp()
    });
    audit(batch, "USER_INVITED", actor, created.uid, person.displayName, null, { status: "INVITED", roleCode: role.roleCode, employmentType: person.employmentType });
    await batch.commit();
  } catch (error) {
    if (created?.uid) {
      try {
        await auth.deleteUser(created.uid);
      } catch (rollback) {
        logger.error("Invite rollback failed", { uid: created.uid, rollback, originalError: error });
        throw new HttpsError("internal", "The Auth identity was created, but account records and automated rollback did not complete. Platform recovery is required.", { reason: "ORPHAN_AUTH_IDENTITY" });
      }
    }
    throw error;
  }

 try {

  await sendInvitationEmail(email);

} catch (error) {

  await db
    .doc(`users/${created.uid}`)
    .update({
      invitationLastSendStatus: "FAILED",
      invitationLastSendError: clean(
        error?.message || "Invitation delivery failed",
        200
      ),
      updatedAt: FieldValue.serverTimestamp()
    })
    .catch(() => {});


  logger.error(
    "Invitation created but email delivery failed",
    {
      uid: created.uid,
      email,
      errorMessage:
        error?.message || null,
      errorName:
        error?.name || null,
      errorStack:
        error?.stack || null
    }
  );


  throw new HttpsError(
    "unavailable",
    "The account was created, but the invitation email could not be sent. Use Resend Invitation.",
    {
      reason: "INVITATION_EMAIL_FAILED",
      uid: created.uid
    }
  );

}
  const saved = (await db.doc(`users/${created.uid}`).get()).data();
  return { ok: true, outcome: "INVITED", account: publicAccount(created.uid, saved) };
}

async function update(actor, actorUid, data) {
  const uid = clean(data.uid, 128), target = await targetProfile(uid);
  assertTargetManageable(actor, actorUid, target, uid);
  const person = identity(data), role = roleForAssignment(actor, data.roleCode || target.roleCode);
  const authBefore = await auth.getUser(uid);
  await auth.updateUser(uid, { displayName: person.displayName });
  const batch = db.batch();
  batch.update(db.doc(`users/${uid}`), { firstName: person.firstName, surname: person.surname, displayName: person.displayName, phone: person.phone, employmentType: person.employmentType, position: person.position, roleCode: role.roleCode, accessLevel: role.accessLevel, permissions: role.permissions, updatedAt: FieldValue.serverTimestamp(), updatedByUid: actorUid, updatedByName: actor.displayName || actor.email || null });
  batch.set(db.doc(`people/${target.personId || uid}`), { organisationId: target.organisationId, linkedUserUid: uid, personId: target.personId || uid, firstName: person.firstName, lastName: person.lastName, displayName: person.displayName, email: target.email, phone: person.phone, employmentType: person.employmentType, primaryRole: person.position, updatedAt: FieldValue.serverTimestamp(), updatedByUid: actorUid }, { merge: true });
  audit(batch, target.roleCode === role.roleCode ? "USER_ACCOUNT_UPDATED" : "USER_AUTHORITY_CHANGED", actor, uid, person.displayName, { roleCode: target.roleCode, employmentType: target.employmentType }, { roleCode: role.roleCode, employmentType: person.employmentType });
  try {
    await batch.commit();
  } catch (error) {
    try {
      await auth.updateUser(uid, { displayName: authBefore.displayName || null });
    } catch (rollback) {
      logger.error("Account update rollback failed", { uid, rollback, originalError: error });
      throw new HttpsError("internal", "Account records could not be updated and the Auth display-name rollback did not complete. Platform recovery is required.", { reason: "AUTH_ROLLBACK_FAILED" });
    }
    throw error;
  }
  return { ok: true, outcome: "UPDATED", account: publicAccount(uid, { ...target, ...person, roleCode: role.roleCode }) };
}

async function setStatus(actor, actorUid, data, status) {
  const uid = clean(data.uid, 128), target = await targetProfile(uid);
  assertTargetManageable(actor, actorUid, target, uid);
  try { assertStatusTransition(target.status, status); } catch (error) { throw new HttpsError("failed-precondition", error.message, { reason: error.reason }); }
  const disabled = status === "INACTIVE";
  const authBefore = await auth.getUser(uid);
  await auth.updateUser(uid, { disabled });
  const batch = db.batch(), action = disabled ? "USER_DEACTIVATED" : "USER_REACTIVATED";
  batch.update(db.doc(`users/${uid}`), { status, updatedAt: FieldValue.serverTimestamp(), updatedByUid: actorUid, updatedByName: actor.displayName || actor.email || null });
  batch.set(db.doc(`people/${target.personId || uid}`), { accountStatus: status, updatedAt: FieldValue.serverTimestamp(), updatedByUid: actorUid }, { merge: true });
  audit(batch, action, actor, uid, target.displayName, { status: target.status }, { status });
  try {
    await batch.commit();
  } catch (error) {
    try {
      await auth.updateUser(uid, { disabled: authBefore.disabled });
    } catch (rollback) {
      logger.error("Account status rollback failed", { uid, rollback, originalError: error });
      throw new HttpsError("internal", "Account status records could not be updated and the Auth rollback did not complete. Platform recovery is required.", { reason: "AUTH_ROLLBACK_FAILED" });
    }
    throw error;
  }
  return { ok: true, outcome: status };
}

async function resend(actor, actorUid, data) {
  const uid = clean(data.uid, 128), target = await targetProfile(uid);
  assertTargetManageable(actor, actorUid, target, uid);
  if (target.status !== "INVITED") throw new HttpsError("failed-precondition", "Only pending invitations can be resent.");
  const last = target.invitationLastSentAt?.toMillis?.() || 0;
  if (Date.now() - last < 60000) throw new HttpsError("resource-exhausted", "Please wait before resending this invitation.");
  await sendInvitationEmail(target.email);
  const batch = db.batch();
  batch.update(db.doc(`users/${uid}`), { invitationLastSentAt: FieldValue.serverTimestamp(), invitationLastSendStatus: "SENT", invitationLastSendError: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(), updatedByUid: actorUid });
  audit(batch, "INVITATION_RESENT", actor, uid, target.displayName, null, null);
  try {
    await batch.commit();
  } catch (error) {
    logger.error("Invitation resent but delivery state/audit could not be recorded", { uid, error });
    throw new HttpsError("internal", "The invitation email was sent, but its delivery status could not be recorded. Check the account before resending.", { reason: "INVITATION_STATE_WRITE_FAILED" });
  }
  return { ok: true, outcome: "RESENT" };
}

async function activateSelf(uid) {
  const profile = await targetProfile(uid);
  if (profile.status === "ACTIVE") return { ok: true, outcome: "ALREADY_ACTIVE" };
  if (profile.status !== "INVITED") throw new HttpsError("failed-precondition", "This account is not awaiting activation.");
  const authUser = await auth.getUser(uid);
  if (authUser.disabled || !authUser.metadata?.lastSignInTime) throw new HttpsError("failed-precondition", "Complete account setup and sign in before activation.");
  const batch = db.batch();
  batch.update(db.doc(`users/${uid}`), { status: "ACTIVE", invitationStatus: "COMPLETED", invitationCompletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedByUid: uid });
  batch.set(db.doc(`people/${profile.personId || uid}`), { accountStatus: "ACTIVE", updatedAt: FieldValue.serverTimestamp(), updatedByUid: uid }, { merge: true });
  audit(batch, "USER_ACTIVATED", { ...profile, uid }, uid, profile.displayName, { status: "INVITED" }, { status: "ACTIVE" });
  await batch.commit();
  return { ok: true, outcome: "ACTIVE" };
}

exports.manageUserAccount = onCall({ cors: MANAGE_USER_ACCOUNT_ORIGINS }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in is required.");
  const action = clean(request.data?.action, 40).toUpperCase();
  try {
    if (action === "ACTIVATE_SELF") return await activateSelf(request.auth.uid);
    const actor = await actorProfile(request.auth.uid);
    if (action === "OPTIONS") {
      if (!canAdministerUsers(actor)) throw Object.assign(new Error("User administration permission is required."), { reason: "PERMISSION_DENIED" });
      return { ok: true, roles: assignableRoles(actor).map(({ roleCode, label }) => ({ roleCode, label })) };
    }
    if (action === "INVITE") return await invite(actor, request.data || {});
    if (action === "UPDATE") return await update(actor, request.auth.uid, request.data || {});
    if (action === "DEACTIVATE") return await setStatus(actor, request.auth.uid, request.data || {}, "INACTIVE");
    if (action === "REACTIVATE") return await setStatus(actor, request.auth.uid, request.data || {}, "ACTIVE");
    if (action === "RESEND") return await resend(actor, request.auth.uid, request.data || {});
    throw new HttpsError("invalid-argument", "Unknown account action.");
  } catch (error) { return fail(error); }
});

const inductionFunctions = require("./induction.js");
exports.manageInductionWorkflow = inductionFunctions.manageInductionWorkflow;
exports.verifyInductionCertificate = inductionFunctions.verifyInductionCertificate;
