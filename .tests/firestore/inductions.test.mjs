import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";

const projectId = "demo-normex-inductions";
let env;
const denied = promise => assert.rejects(promise, error => error.code === "permission-denied");

before(async () => {
  const rules = await readFile(new URL("./firestore.generated.rules", import.meta.url), "utf8");
  env = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8089, rules } });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const batch = writeBatch(context.firestore());
    batch.set(doc(context.firestore(), "users/manager"), { organisationId: "alpha", status: "ACTIVE", roleCode: "ORGANISATION_MANAGER", accessLevel: 6, permissions: { canManageAssurance: true } });
    batch.set(doc(context.firestore(), "inductions/NORMEX-00001"), { organisationId: "alpha", workerName: "Worker", status: "VALID" });
    batch.set(doc(context.firestore(), "inductionSettings/alpha"), { organisationId: "alpha", passMarkPercent: 80 });
    await batch.commit();
  });
});

test("induction records and settings cannot be read directly by browser clients", async () => {
  const db = env.authenticatedContext("manager").firestore();
  await denied(getDoc(doc(db, "inductions/NORMEX-00001")));
  await denied(getDoc(doc(db, "inductionSettings/alpha")));
});

test("induction workflow documents cannot be written directly", async () => {
  const db = env.authenticatedContext("manager").firestore();
  await denied(setDoc(doc(db, "inductionRequests/CORE_COMPANY_manager"), { status: "COMPLETED" }));
  await denied(setDoc(doc(db, "inductions/NORMEX-99999"), { organisationId: "alpha", status: "VALID" }));
});

test("public certificate discovery is unavailable through Firestore", async () => {
  const db = env.unauthenticatedContext().firestore();
  await denied(getDoc(doc(db, "inductions/NORMEX-00001")));
});
