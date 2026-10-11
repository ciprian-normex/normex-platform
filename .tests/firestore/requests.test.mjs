import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const projectId = "demo-normex-security";
let environment;

const profile = (overrides = {}) => ({
  organisationId: "org-a",
  status: "ACTIVE",
  accessLevel: 2,
  roleCode: "SITE_MANAGER",
  permissions: { canRequestPlant: true },
  ...overrides
});

const requestRecord = (uid, overrides = {}) => ({
  organisationId: "org-a",
  requestType: "SERVICE_REPAIR",
  projectId: "project-a",
  projectName: "Project A",
  priority: "HIGH",
  safetyCritical: false,
  status: "DRAFT",
  requirement: "Repair hydraulic leak",
  items: [{ itemId: "item-1", actionType: "REPAIR", description: "Repair hydraulic leak", priority: "HIGH", status: "DRAFT" }],
  createdByUid: uid,
  createdAt: "2026-09-27T08:00:00.000Z",
  updatedByUid: uid,
  updatedAt: "2026-09-27T08:00:00.000Z",
  ...overrides
});

before(async () => {
  const rules = await readFile(new URL("./firestore.generated.rules", import.meta.url), "utf8");
  environment = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8089, rules } });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "site-user"), profile());
    await setDoc(doc(db, "users", "outsider"), profile());
    await setDoc(doc(db, "users", "plant-manager"), profile({ accessLevel: 5.5, roleCode: "PLANT_TRANSPORT_MANAGER", permissions: { canViewAllProjects: true, canManagePlant: true, canManageTransport: true } }));
    await setDoc(doc(db, "projects", "project-a"), { organisationId: "org-a", name: "Project A" });
    await setDoc(doc(db, "projects", "project-b"), { organisationId: "org-a", name: "Project B" });
    await setDoc(doc(db, "projects", "project-a", "members", "site-user"), { uid: "site-user", active: true });
  });
});

after(async () => environment?.cleanup());

test("project member can save and submit a request draft", async () => {
  const db = environment.authenticatedContext("site-user").firestore();
  const reference = doc(db, "plantRequests", "request-a");
  await assertSucceeds(setDoc(reference, requestRecord("site-user")));
  await assertSucceeds(updateDoc(reference, { status: "SUBMITTED", items: [{ itemId: "item-1", actionType: "REPAIR", description: "Repair hydraulic leak", priority: "HIGH", status: "SUBMITTED" }], updatedAt: "2026-09-27T09:00:00.000Z" }));
  assert.equal((await getDoc(reference)).data().status, "SUBMITTED");
});

test("requester cannot raise demand against an inaccessible project", async () => {
  const db = environment.authenticatedContext("outsider").firestore();
  await assertFails(setDoc(doc(db, "plantRequests", "request-b"), requestRecord("outsider", { projectId: "project-b", projectName: "Project B" })));
});

test("requester cannot approve an item but Plant management can", async () => {
  await environment.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "plantRequests", "request-c"), requestRecord("site-user", { status: "SUBMITTED", items: [{ itemId: "item-1", actionType: "REPAIR", description: "Repair hydraulic leak", priority: "HIGH", status: "SUBMITTED" }] })));
  const siteDb = environment.authenticatedContext("site-user").firestore();
  await assertFails(updateDoc(doc(siteDb, "plantRequests", "request-c"), { status: "APPROVED", items: [{ itemId: "item-1", actionType: "REPAIR", description: "Repair hydraulic leak", priority: "HIGH", status: "APPROVED" }] }));
  const managerDb = environment.authenticatedContext("plant-manager").firestore();
  await assertSucceeds(updateDoc(doc(managerDb, "plantRequests", "request-c"), { status: "APPROVED", items: [{ itemId: "item-1", actionType: "REPAIR", description: "Repair hydraulic leak", priority: "HIGH", status: "APPROVED" }], updatedByUid: "plant-manager", updatedAt: "2026-09-27T09:00:00.000Z" }));
});

test("legacy request types and cross-tenant requests are denied", async () => {
  const db = environment.authenticatedContext("site-user").firestore();
  await assertFails(setDoc(doc(db, "plantRequests", "legacy"), requestRecord("site-user", { requestType: "REPAIR" })));
  await assertFails(setDoc(doc(db, "plantRequests", "foreign"), requestRecord("site-user", { organisationId: "org-b" })));
});
