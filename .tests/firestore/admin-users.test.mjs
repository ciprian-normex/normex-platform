import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

const projectId = "demo-normex-security", host = "127.0.0.1", port = 8089;
let env;
const profile = (roleCode = "WORKER", extra = {}) => ({ organisationId: "alpha", status: "ACTIVE", roleCode, accessLevel: roleCode === "ORGANISATION_MANAGER" ? 6 : 0, permissions: roleCode === "ORGANISATION_MANAGER" ? { canManageUsers: true, canManageOrganisation: true } : {}, displayName: "Example", ...extra });
const client = uid => env.authenticatedContext(uid).firestore();
const denied = promise => assert.rejects(promise, error => error.code === "permission-denied");

before(async () => {
  const rules = await readFile(new URL("./firestore.generated.rules", import.meta.url), "utf8");
  env = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const batch = writeBatch(context.firestore());
    batch.set(doc(context.firestore(), "users/org"), profile("ORGANISATION_MANAGER"));
    batch.set(doc(context.firestore(), "users/worker"), profile());
    batch.set(doc(context.firestore(), "users/foreign"), profile("WORKER", { organisationId: "beta" }));
    batch.set(doc(context.firestore(), "people/worker"), { organisationId: "alpha", linkedUserUid: "worker", displayName: "Worker" });
    batch.set(doc(context.firestore(), "people/foreign"), { organisationId: "beta", linkedUserUid: "foreign", displayName: "Foreign" });
    await batch.commit();
  });
});

test("authorised manager can read the tenant account directory", async () => {
  const snapshot = await assertSucceeds(getDocs(query(collection(client("org"), "users"), where("organisationId", "==", "alpha"))));
  assert.equal(snapshot.size, 2);
});
test("direct client lifecycle and authority writes are denied", async () => {
  const db = client("org");
  await denied(updateDoc(doc(db, "users", "worker"), { status: "INACTIVE" }));
  await denied(updateDoc(doc(db, "users", "worker"), { roleCode: "SITE_MANAGER", accessLevel: 2 }));
  await denied(setDoc(doc(db, "users", "new"), profile()));
});
test("self authority and status changes are denied while safe contact edit remains", async () => {
  const db = client("worker"), ref = doc(db, "users", "worker");
  await denied(updateDoc(ref, { status: "INACTIVE" }));
  await denied(updateDoc(ref, { accessLevel: 6, roleCode: "ORGANISATION_MANAGER" }));
  await assertSucceeds(updateDoc(ref, { displayName: "Updated name" }));
});
test("People handoff is tenant-scoped and limited to account managers", async () => {
  await assertSucceeds(getDoc(doc(client("org"), "people", "worker")));
  await denied(getDoc(doc(client("org"), "people", "foreign")));
  await denied(getDoc(doc(client("worker"), "people", "worker")));
});
