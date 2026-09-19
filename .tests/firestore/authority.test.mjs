import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import {
  initializeTestEnvironment, assertSucceeds
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, deleteField,
  collection, getDocs, query, where, Timestamp
} from "firebase/firestore";

const projectId = "demo-normex-security";
const emulatorHost = "127.0.0.1:8089";
let env;
const evaluationSamples = [];
const engineFailure = /maximum of \d+ expressions|evaluation.limit|too many.*(?:calls|access)|maximum.*(?:access calls|document access)|error evaluating|internal (?:rules )?error|Null value|Property .* is undefined|Function .* not found|Type error|IllegalStateException|undefined (?:property|function)|null value error/i;

async function coverage() {
  const response = await fetch(`http://${emulatorHost}/emulator/v1/projects/${projectId}:ruleCoverage`);
  assert.equal(response.status, 200, "Emulator coverage endpoint must succeed");
  return response.json();
}

async function measured(name, operation) {
  const beforeCoverage = await coverage();
  await operation();
  evaluationSamples.push({ name, before: beforeCoverage, after: await coverage() });
}

function reportedEvaluations(report) {
  const expressions = new Map();
  function visit(node) {
    const position = node.sourcePosition;
    expressions.set(`${position.currentOffset}:${position.endOffset}`,
      (node.values || []).reduce((total, value) => total + value.count, 0));
    for (const child of node.children || []) visit(child);
  }
  report.report.forEach(visit);
  return [...expressions.values()].reduce((total, count) => total + count, 0);
}

// No production fallback, saved login, Admin SDK, or live data.
before(async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, emulatorHost,
    "Run through npm test; the suite requires the isolated local emulator.");
  const [rules, rootRules] = await Promise.all([
    readFile(new URL("./firestore.generated.rules", import.meta.url), "utf8"),
    readFile(new URL("../../firestore.rules", import.meta.url), "utf8")
  ]);
  assert.equal(rules, rootRules,
    "Generated rules differ from root firestore.rules. Rerun npm test.");
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1", port: 8089,
      rules
    }
  });
});
after(async () => {
  try {
    if (env) {
      await writeFile(new URL("./rule-coverage.log", import.meta.url), JSON.stringify(await coverage(), null, 2));
      await writeFile(new URL("./evaluation-samples.log", import.meta.url), JSON.stringify(evaluationSamples, null, 2));
      await writeFile(new URL("./evaluation-summary.log", import.meta.url), JSON.stringify({
        note: "Coverage-node deltas include multiple evaluator phases; these are not per-request budget counters or an exact safety margin.",
        operations: evaluationSamples.map(sample => ({
          name: sample.name,
          reportedExpressionEvaluations: reportedEvaluations(sample.after) - reportedEvaluations(sample.before)
        }))
      }, null, 2));
      // Catch explicit engine failures even when a client message omits detail.
      const diagnostics = await readFile(new URL("./firestore-debug.log", import.meta.url), "utf8");
      assert.doesNotMatch(diagnostics, engineFailure,
        "Emulator diagnostics contain an engine/resource-limit failure");
    }
  } finally {
    await env?.cleanup();
  }
});

const roles = {
  WORKER: 0, SUPERVISOR: 1, SITE_MANAGER: 2, PROJECT_MANAGER: 3,
  SENIOR_PROJECT_MANAGER: 4, HEALTH_SAFETY: 4.5, SENIOR_HEALTH_SAFETY: 4.6,
  CONTRACTS_MANAGER: 5, PLANT_TRANSPORT_MANAGER: 5.5,
  ORGANISATION_MANAGER: 6, PLATFORM_ADMIN: 99
};
const administration = { canManageUsers: true, canManageOrganisation: true };
function profile(roleCode = "WORKER", extra = {}) {
  return {
    organisationId: "alpha", status: "ACTIVE", roleCode,
    accessLevel: roles[roleCode], permissions: {},
    displayName: "Example User", ...extra
  };
}
function member(uid, roleCode = "WORKER", extra = {}) {
  return { uid, roleCode, active: true, ...extra };
}
function client(uid) { return env.authenticatedContext(uid).firestore(); }
function user(db, uid) { return doc(db, "users", uid); }
function membership(db, uid, project = "project-a") {
  return doc(db, "projects", project, "members", uid);
}
async function denied(operation) {
  // Reject explicit engine/resource failures. The emulator also labels unresolved
  // first-phase checks "evaluation error" alongside a final false policy result;
  // that generic marker alone is not evidence of an internal engine failure.
  await assert.rejects(operation, error =>
    error.code === "permission-denied" && !engineFailure.test(error.message));
}
async function seed(entries) {
  await env.withSecurityRulesDisabled(async context => {
    const batch = writeBatch(context.firestore());
    for (const [path, data] of Object.entries(entries)) {
      batch.set(doc(context.firestore(), path), data);
    }
    await batch.commit();
  });
}
beforeEach(async () => {
  await env.clearFirestore();
  await seed({
    "users/worker": profile(),
    "users/other": profile(),
    "users/supervisor": profile("SUPERVISOR"),
    "users/site": profile("SITE_MANAGER"),
    "users/pm": profile("PROJECT_MANAGER"),
    "users/pm2": profile("PROJECT_MANAGER"),
    "users/senior": profile("SENIOR_PROJECT_MANAGER"),
    "users/hs": profile("HEALTH_SAFETY"),
    "users/senior-hs": profile("SENIOR_HEALTH_SAFETY"),
    "users/contracts": profile("CONTRACTS_MANAGER"),
    "users/plant": profile("PLANT_TRANSPORT_MANAGER"),
    "users/org": profile("ORGANISATION_MANAGER", { permissions: administration }),
    "users/peer-org": profile("ORGANISATION_MANAGER", { permissions: administration }),
    "users/admin": profile("PLATFORM_ADMIN"),
    "users/admin2": profile("PLATFORM_ADMIN"),
    "users/inactive": profile("ORGANISATION_MANAGER", {
      permissions: administration, status: "INACTIVE"
    }),
    "users/foreign": profile("WORKER", { organisationId: "beta" }),
    "projects/project-a": { organisationId: "alpha", createdByUid: "admin", createdAt: Timestamp.fromMillis(1) },
    "projects/project-b": { organisationId: "beta", createdByUid: "admin", createdAt: Timestamp.fromMillis(1) },
    "projects/project-unassigned": { organisationId: "alpha" },
    "projects/project-a/members/pm": member("pm", "PROJECT_MANAGER", { canManageProject: true }),
    "projects/project-a/members/worker": member("worker"),
    "projects/project-a/members/site": member("site", "SITE_MANAGER", { canUpdateOperations: true }),
    "projects/project-a/members/hs": member("hs", "HEALTH_SAFETY", { canManageAssurance: true }),
    "commercialRecords/probe": { organisationId: "alpha", projectId: "project-a" }
  });
});

test("01 ordinary user cannot promote self", async () => {
  await denied(updateDoc(user(client("worker"), "worker"), { accessLevel: 99, roleCode: "PLATFORM_ADMIN" }));
});
test("02 tenant admin cannot promote self", async () => {
  await denied(updateDoc(user(client("org"), "org"), { accessLevel: 99, roleCode: "PLATFORM_ADMIN" }));
});
test("03 tenant admin cannot promote another user", async () => {
  await denied(updateDoc(user(client("org"), "other"), { accessLevel: 99, roleCode: "PLATFORM_ADMIN" }));
});
test("04 tenant admin cannot transfer a user", async () => {
  await denied(updateDoc(user(client("org"), "other"), { organisationId: "beta" }));
});
test("05 tenant admin cannot modify or delete a Platform Admin", async () => {
  await denied(updateDoc(user(client("org"), "admin"), { displayName: "Hijacked" }));
  await denied(deleteDoc(user(client("org"), "admin")));
});
test("06 inactive administrator cannot write profiles or memberships", async () => {
  const db = client("inactive");
  await denied(updateDoc(user(db, "other"), { status: "INACTIVE" }));
  await denied(setDoc(membership(db, "other"), member("other")));
});
test("07 cross-tenant profile write denied", async () => {
  await denied(updateDoc(user(client("org"), "foreign"), { displayName: "Hijacked" }));
});
test("08 approved same-tenant administration succeeds", async () => {
  const db = client("org");
  await assertSucceeds(setDoc(user(db, "new-user"), profile("SUPERVISOR")));
  await assertSucceeds(updateDoc(user(db, "other"), { roleCode: "SITE_MANAGER", accessLevel: 2 }));
  await assertSucceeds(updateDoc(user(db, "other"), { status: "INACTIVE" }));
  await assertSucceeds(updateDoc(user(db, "other"), { status: "ACTIVE", displayName: "Restored" }));
});
for (const [number, field] of [
  ["09", "canManageCommercial"], ["10", "canManageAssurance"], ["11", "canManagePlant"]
]) {
  test(number + " project manager cannot grant self " + field, async () => {
    await denied(updateDoc(membership(client("pm"), "pm"), { [field]: true }));
    await denied(setDoc(membership(client("pm"), "pm2"),
      member("pm2", "PROJECT_MANAGER", { [field]: true })));
  });
}
test("12 approved ordinary membership changes succeed", async () => {
  const db = client("pm");
  await assertSucceeds(setDoc(membership(db, "other"), member("other")));
  await assertSucceeds(updateDoc(membership(db, "site"), {
    canManageScopeProgress: true, assignedUntil: Timestamp.fromMillis(1000)
  }));
  await assertSucceeds(updateDoc(membership(db, "other"), { active: false }));
  await assertSucceeds(updateDoc(membership(db, "other"), { active: true }));
  await assertSucceeds(deleteDoc(membership(db, "other")));
});
test("13 malicious profile batch rejected atomically", async () => {
  const db = client("org");
  const batch = writeBatch(db);
  batch.update(user(db, "org"), { roleCode: "PLATFORM_ADMIN", accessLevel: 99 });
  batch.update(user(db, "foreign"), { displayName: "Hijacked" });
  await denied(batch.commit());
  assert.equal((await getDoc(user(client("admin"), "org"))).data().accessLevel, 6);
  assert.equal((await getDoc(user(client("admin"), "foreign"))).data().displayName, "Example User");
});
test("13b membership escalation batch does not grant specialist access", async () => {
  const db = client("pm");
  const batch = writeBatch(db);
  batch.update(membership(db, "pm"), { canViewCommercial: true, canManageCommercial: true });
  batch.set(doc(db, "commercialRecords", "attack"), { organisationId: "alpha", projectId: "project-a", type: "OTHER", createdByUid: "pm" });
  await denied(batch.commit());
  assert.equal((await getDoc(membership(client("admin"), "pm"))).data().canManageCommercial, undefined);
});
test("14 deliberate canonical Platform Admin administration succeeds", async () => {
  const db = client("admin");
  await assertSucceeds(setDoc(user(db, "new-platform"), profile("PLATFORM_ADMIN")));
  await assertSucceeds(setDoc(user(db, "new-org"), profile("ORGANISATION_MANAGER", { permissions: administration })));
  await assertSucceeds(updateDoc(user(db, "other"), { organisationId: "beta" }));
  await assertSucceeds(updateDoc(user(db, "admin2"), { displayName: "Platform colleague" }));
  await assertSucceeds(updateDoc(user(db, "foreign"), { displayName: "Authorised" }));
  await assertSucceeds(deleteDoc(user(db, "other")));
});

for (const field of ["role", "workspaceAccess", "isAdmin", "permissions", "canManageUsers", "canManageOrganisation", "canManagePlant", "canManageTransport", "canAccessContractorWorkspace", "accessLevel"]) {
  test("unknown membership authority field rejected: " + field, async () => {
    await denied(setDoc(membership(client("org"), "other"),
      member("other", "WORKER", { [field]: field === "role" ? "PLATFORM_ADMIN" : true })));
  });
}
for (const patch of [
  { role: "PLATFORM_ADMIN" }, { workspaceAccess: { contractor: true } },
  { "permissions.isAdmin": true }, { "permissions.canAccessContractorWorkspace": true }
]) {
  test("tenant cannot inject authority alias " + JSON.stringify(patch), async () => {
    await denied(updateDoc(user(client("org"), "other"), patch));
  });
}
test("legacy-only role grants no backend administration", async () => {
  const legacy = profile("ORGANISATION_MANAGER", { role: "ORGANISATION_MANAGER", permissions: administration });
  delete legacy.roleCode;
  await seed({ "users/legacy": legacy });
  await denied(updateDoc(user(client("legacy"), "other"), { displayName: "Hijacked" }));
});
test("workspaceAccess alone grants no backend authority", async () => {
  await seed({ "users/worker": profile("WORKER", { workspaceAccess: { contractor: true } }) });
  await denied(updateDoc(user(client("worker"), "other"), { status: "INACTIVE" }));
});
test("unchanged legacy frontend fields may coexist with safe canonical updates", async () => {
  await seed({ "users/other": profile("WORKER", { role: "WORKER", workspaceAccess: { contractor: true } }) });
  await assertSucceeds(updateDoc(user(client("other"), "other"), { displayName: "Personal edit" }));
  await assertSucceeds(updateDoc(user(client("org"), "other"), { status: "INACTIVE" }));
});
test("Organisation Manager cannot create or assign another Organisation Manager", async () => {
  const db = client("org");
  await denied(setDoc(user(db, "new-org"), profile("ORGANISATION_MANAGER")));
  await denied(updateDoc(user(db, "other"), { roleCode: "ORGANISATION_MANAGER", accessLevel: 6 }));
  await denied(updateDoc(user(db, "peer-org"), { status: "INACTIVE" }));
});
for (const field of ["canManageUsers", "canManageOrganisation"]) {
  test("Organisation Manager cannot grant " + field, async () => {
    await denied(updateDoc(user(client("org"), "other"), { ["permissions." + field]: true }));
  });
}
test("possession of canManageUsers does not confer delegation", async () => {
  await seed({ "users/worker": profile("WORKER", { permissions: { canManageUsers: true } }) });
  await denied(updateDoc(user(client("worker"), "other"), { status: "INACTIVE" }));
});
for (const patch of [
  { organisationId: "beta" }, { status: "INACTIVE" }, { accessLevel: 99 },
  { roleCode: "PLATFORM_ADMIN" }, { permissions: { canManagePlant: true } },
  { role: "PLATFORM_ADMIN" }, { workspaceAccess: { contractor: true } },
  { permissions: deleteField() }, { roleCode: deleteField() }
]) {
  test("self-profile protected field: " + Object.keys(patch)[0] + JSON.stringify(patch), async () => {
    await denied(updateDoc(user(client("worker"), "worker"), patch));
  });
}
test("safe self update and own-profile read succeed", async () => {
  const db = client("worker");
  await assertSucceeds(getDoc(user(db, "worker")));
  await assertSucceeds(updateDoc(user(db, "worker"), { displayName: "Updated name" }));
  await denied(updateDoc(user(db, "worker"), { displayName: "" }));
  await denied(updateDoc(user(db, "worker"), { displayName: 123 }));
  await denied(updateDoc(user(db, "worker"), { displayName: "x".repeat(121) }));
});
test("tenant cannot delete a profile or replace self with an elevated profile", async () => {
  await denied(deleteDoc(user(client("org"), "other")));
  await denied(setDoc(user(client("worker"), "worker"), profile("PLATFORM_ADMIN")));
});
for (const [level, role] of [[99, "WORKER"], [6, "PLATFORM_ADMIN"], [100, "PLATFORM_ADMIN"], [5, "ORGANISATION_MANAGER"]]) {
  test("invalid canonical role/level never grants administration: " + level + "/" + role, async () => {
    await seed({ "users/invalid": profile(role, { accessLevel: level, permissions: administration }) });
    await denied(updateDoc(user(client("invalid"), "other"), { status: "INACTIVE" }));
    await denied(setDoc(membership(client("invalid"), "other"), member("other")));
  });
}
test("inactive Platform Admin cannot administer", async () => {
  await seed({ "users/admin": profile("PLATFORM_ADMIN", { status: "INACTIVE" }) });
  await denied(updateDoc(user(client("admin"), "other"), { displayName: "Hijacked" }));
});
for (const missing of ["canManageUsers", "canManageOrganisation"]) {
  test("Organisation Manager requires both permissions: missing " + missing, async () => {
    const permissions = { ...administration };
    delete permissions[missing];
    await seed({ "users/org": profile("ORGANISATION_MANAGER", { permissions }) });
    await denied(updateDoc(user(client("org"), "other"), { status: "INACTIVE" }));
    await denied(setDoc(membership(client("org"), "other"), member("other")));
  });
}

// Independent policy examples: ceilings are opt-in; roles have no auto-grant.
const tenantGrants = [
  ["WORKER", {}], ["SUPERVISOR", {}], ["SITE_MANAGER", {}],
  ["PROJECT_MANAGER", {}],
  ["SENIOR_PROJECT_MANAGER", { canViewAllProjects: true }],
  ["HEALTH_SAFETY", {}],
  ["SENIOR_HEALTH_SAFETY", { canViewAllProjects: true, canManageAssurance: true }],
  ["CONTRACTS_MANAGER", { canViewAllProjects: true, canCreateProjects: true, canViewCommercial: true, canManageCommercial: true }],
  ["PLANT_TRANSPORT_MANAGER", { canViewAllProjects: true, canViewPlant: true, canRequestPlant: true, canManagePlant: true, canManageTransport: true }]
];
for (const [role, permissions] of tenantGrants) {
  test("approved tenant ceiling succeeds for " + role, async () => {
    await assertSucceeds(setDoc(user(client("org"), "grantee"), profile(role, { permissions })));
    await assertSucceeds(updateDoc(user(client("org"), "other"), { roleCode: role, accessLevel: roles[role], permissions }));
  });
}
for (const [role, permissions] of [
  ["SUPERVISOR", { canViewPlant: true }], ["SITE_MANAGER", { canViewPlant: true }],
  ["PROJECT_MANAGER", { canViewPlant: true }], ["PROJECT_MANAGER", { canViewAllProjects: true }],
  ["PROJECT_MANAGER", { canViewCommercial: true }], ["HEALTH_SAFETY", { canManageAssurance: true }],
  ["HEALTH_SAFETY", { canViewAllProjects: true }], ["PLANT_TRANSPORT_MANAGER", { canManageAssurance: true }],
  ["CONTRACTS_MANAGER", { canManagePlant: true, canViewPlant: true }],
  ["CONTRACTS_MANAGER", { canManageCommercial: true }],
  ["PLANT_TRANSPORT_MANAGER", { canManagePlant: true }],
  ["WORKER", { canViewAllProjects: "true" }]
]) {
  test("out-of-ceiling/invalid tenant grant denied: " + role + JSON.stringify(permissions), async () => {
    await denied(setDoc(user(client("org"), "grantee"), profile(role, { permissions })));
  });
}
test("role change must remove incompatible prior permissions", async () => {
  await seed({ "users/other": profile("CONTRACTS_MANAGER", { permissions: { canViewCommercial: true } }) });
  await denied(updateDoc(user(client("org"), "other"), { roleCode: "SITE_MANAGER", accessLevel: 2 }));
  await assertSucceeds(updateDoc(user(client("org"), "other"), { roleCode: "SITE_MANAGER", accessLevel: 2, permissions: {} }));
});
test("role identity alone grants neither Commercial nor project management", async () => {
  await assertSucceeds(setDoc(membership(client("org"), "pm2"), member("pm2", "PROJECT_MANAGER")));
  await denied(getDoc(doc(client("pm2"), "commercialRecords", "probe")));
  await denied(setDoc(membership(client("pm2"), "other"), member("other")));
});
test("explicit project Commercial grant works only within its project", async () => {
  await assertSucceeds(setDoc(membership(client("org"), "pm2"),
    member("pm2", "PROJECT_MANAGER", { canViewCommercial: true, canManageCommercial: true })));
  await assertSucceeds(getDoc(doc(client("pm2"), "commercialRecords", "probe")));
  await seed({ "commercialRecords/other-project": { organisationId: "alpha", projectId: "project-unassigned" } });
  await denied(getDoc(doc(client("pm2"), "commercialRecords", "other-project")));
});
test("Organisation Manager can explicitly appoint a scoped project manager", async () => {
  await assertSucceeds(setDoc(membership(client("org"), "pm2"),
    member("pm2", "PROJECT_MANAGER", { canManageProject: true })));
  await assertSucceeds(setDoc(membership(client("pm2"), "other"), member("other")));
  await denied(setDoc(membership(client("pm2"), "other", "project-unassigned"), member("other")));
});
for (const [uid, roleCode, grants] of [
  ["supervisor", "SUPERVISOR", { canUpdateOperations: true, canManageScopeProgress: true }],
  ["senior", "SENIOR_PROJECT_MANAGER", { canManageProject: true, canViewCommercial: true }],
  ["contracts", "CONTRACTS_MANAGER", { canManageProject: true, canViewCommercial: true, canManageCommercial: true }],
  ["hs", "HEALTH_SAFETY", { canManageAssurance: true }],
  ["senior-hs", "SENIOR_HEALTH_SAFETY", { canManageAssurance: true }],
  ["plant", "PLANT_TRANSPORT_MANAGER", {}]
]) {
  test("explicit eligible membership grant succeeds: " + roleCode, async () => {
    await assertSucceeds(setDoc(membership(client("org"), uid), member(uid, roleCode, grants)));
  });
}
test("membership identity, role and tenant must agree", async () => {
  const db = client("org");
  await denied(setDoc(membership(db, "other"), member("worker")));
  await denied(setDoc(membership(db, "other"), member("other", "PROJECT_MANAGER")));
  await denied(setDoc(membership(db, "foreign"), member("foreign")));
  await denied(setDoc(membership(db, "other", "project-b"), member("other")));
  await denied(setDoc(membership(db, "missing"), member("missing")));
});
test("project manager cannot appoint another manager or change specialist memberships", async () => {
  const db = client("pm");
  await denied(setDoc(membership(db, "pm2"), member("pm2", "PROJECT_MANAGER", { canManageProject: true })));
  await denied(updateDoc(membership(db, "hs"), { assignedUntil: Timestamp.fromMillis(2000) }));
  await denied(deleteDoc(membership(db, "hs")));
  await denied(setDoc(membership(db, "hs"), member("hs", "HEALTH_SAFETY")));
});
test("specialist membership cannot be reactivated or recreated by project manager", async () => {
  await seed({ "projects/project-a/members/pm2":
    member("pm2", "PROJECT_MANAGER", { active: false, canViewCommercial: true }) });
  const db = client("pm");
  await denied(updateDoc(membership(db, "pm2"), { active: true }));
  await denied(deleteDoc(membership(db, "pm2")));
  const batch = writeBatch(db);
  batch.delete(membership(db, "pm2"));
  batch.set(membership(db, "pm2"), member("pm2", "PROJECT_MANAGER", { canViewCommercial: true }));
  await denied(batch.commit());
  assert.equal((await getDoc(membership(client("admin"), "pm2"))).data().active, false);
});
test("ordinary deletion/recreation cannot add specialist authority", async () => {
  const db = client("pm");
  await assertSucceeds(setDoc(membership(db, "pm2"), member("pm2", "PROJECT_MANAGER")));
  await assertSucceeds(deleteDoc(membership(db, "pm2")));
  await denied(setDoc(membership(db, "pm2"), member("pm2", "PROJECT_MANAGER", { canViewCommercial: true })));
});
test("membership batch cannot use a newly assigned target role", async () => {
  const db = client("org");
  const batch = writeBatch(db);
  batch.update(user(db, "other"), { roleCode: "HEALTH_SAFETY", accessLevel: 4.5 });
  batch.set(membership(db, "other"), member("other", "HEALTH_SAFETY", { canManageAssurance: true }));
  await denied(batch.commit());
});
test("ordinary multi-member batch succeeds", async () => {
  const db = client("pm");
  const batch = writeBatch(db);
  batch.set(membership(db, "other"), member("other"));
  batch.update(membership(db, "site"), { canManageScopeProgress: true });
  await assertSucceeds(batch.commit());
});
test("unauthenticated writes and unmatched collections remain denied", async () => {
  const db = env.unauthenticatedContext().firestore();
  await denied(setDoc(user(db, "attacker"), profile("PLATFORM_ADMIN")));
  await denied(setDoc(membership(db, "worker"), member("worker")));
  await denied(setDoc(doc(client("admin"), "notAnApprovedCollection", "record"), {}));
});
test("existing intended reads remain available", async () => {
  await assertSucceeds(getDoc(user(client("worker"), "worker")));
  await assertSucceeds(getDoc(user(client("org"), "other")));
  await assertSucceeds(getDocs(query(collection(client("org"), "users"), where("organisationId", "==", "alpha"))));
  await assertSucceeds(getDoc(doc(client("pm"), "projects", "project-a")));
});


test("Platform Admin membership writes still reject unknown authority keys", async () => {
  const db = client("admin");
  await assertSucceeds(setDoc(membership(db, "pm2"),
    member("pm2", "PROJECT_MANAGER", { canViewCommercial: true })));
  await denied(setDoc(membership(db, "other"),
    member("other", "WORKER", { isAdmin: true })));
});
test("explicit Commercial grant enables a real scoped write", async () => {
  await assertSucceeds(setDoc(membership(client("org"), "pm2"),
    member("pm2", "PROJECT_MANAGER", { canViewCommercial: true, canManageCommercial: true })));
  const data = { organisationId: "alpha", projectId: "project-a", type: "OTHER", createdByUid: "pm2" };
  await assertSucceeds(setDoc(doc(client("pm2"), "commercialRecords", "permitted"), data));
  await denied(setDoc(doc(client("pm2"), "commercialRecords", "out-of-scope"),
    { ...data, projectId: "project-unassigned" }));
});
test("legacy role cannot give a canonical Worker Plant authority", async () => {
  await seed({ "users/worker": profile("WORKER", { role: "PLANT_TRANSPORT_MANAGER" }) });
  await denied(setDoc(doc(client("worker"), "plantSuppliers", "attack"),
    { organisationId: "alpha", createdByUid: "worker" }));
});
test("deleting legacy fields is not a tenant/self migration shortcut", async () => {
  await seed({ "users/other": profile("WORKER", { role: "WORKER", workspaceAccess: { contractor: true } }) });
  await denied(updateDoc(user(client("other"), "other"), { role: deleteField() }));
  await denied(updateDoc(user(client("org"), "other"), { workspaceAccess: deleteField() }));
});
test("tenant cannot create a cross-tenant or legacy-shaped profile", async () => {
  const db = client("org");
  await denied(setDoc(user(db, "new-user"), profile("WORKER", { organisationId: "beta" })));
  await denied(setDoc(user(db, "new-user"), profile("WORKER", { role: "PLATFORM_ADMIN" })));
  await denied(setDoc(user(db, "new-user"), profile("WORKER", { workspaceAccess: { contractor: true } })));
});
test("project manager cannot manage membership outside their project", async () => {
  await denied(setDoc(membership(client("pm"), "other", "project-unassigned"), member("other")));
  await denied(setDoc(membership(client("pm"), "foreign", "project-b"), member("foreign")));
});
test("inactive target cannot be reactivated through membership", async () => {
  await seed({ "users/other": profile("WORKER", { status: "INACTIVE" }),
    "projects/project-a/members/other": member("other", "WORKER", { active: false }) });
  await denied(updateDoc(membership(client("pm"), "other"), { active: true }));
});

test("stale membership cannot preserve Commercial authority after a profile role change", async () => {
  await seed({ "projects/project-a/members/pm2":
    member("pm2", "PROJECT_MANAGER", { canViewCommercial: true, canManageCommercial: true }) });
  await assertSucceeds(getDoc(doc(client("pm2"), "commercialRecords", "probe")));
  await assertSucceeds(updateDoc(user(client("org"), "pm2"), {
    roleCode: "WORKER", accessLevel: 0, permissions: {}
  }));
  await denied(getDoc(doc(client("pm2"), "commercialRecords", "probe")));
});
test("membership UID mismatch cannot grant project authority", async () => {
  await seed({ "projects/project-a/members/pm":
    member("someone-else", "PROJECT_MANAGER", { canManageProject: true }) });
  await denied(setDoc(membership(client("pm"), "other"), member("other")));
});
test("tenant administrator cannot give themselves specialist authority", async () => {
  await denied(updateDoc(user(client("org"), "org"), { "permissions.canManagePlant": true }));
});
test("Platform Admin may deliberately administer another tenant membership", async () => {
  await assertSucceeds(setDoc(membership(client("admin"), "foreign", "project-b"), member("foreign")));
});


// Focused efficiency regressions. All original 104 expectations above remain.
test("efficiency: normal scoped profile/project reads and user query", async () => {
  await measured("profile read - Organisation Manager", () =>
    assertSucceeds(getDoc(user(client("org"), "other"))));
  await measured("profile query - Organisation Manager", () =>
    assertSucceeds(getDocs(query(collection(client("org"), "users"), where("organisationId", "==", "alpha")))));
  await measured("project read - Project Manager", () =>
    assertSucceeds(getDoc(doc(client("pm"), "projects", "project-a"))));
});
test("efficiency: profile creation, role grant, reactivation and safe self edit", async () => {
  const db = client("org");
  await measured("profile create - tenant operational grant", () =>
    assertSucceeds(setDoc(user(db, "new-profile"), profile("SUPERVISOR"))));
  await measured("profile update - tenant role and permissions", () =>
    assertSucceeds(updateDoc(user(db, "other"), {
      roleCode: "SENIOR_HEALTH_SAFETY", accessLevel: 4.6,
      permissions: { canManageAssurance: true, canViewAllProjects: true }
    })));
  await assertSucceeds(updateDoc(user(db, "other"), { status: "INACTIVE" }));
  await measured("profile update - reactivation", () =>
    assertSucceeds(updateDoc(user(db, "other"), { status: "ACTIVE" })));
  await measured("profile update - self displayName", () =>
    assertSucceeds(updateDoc(user(client("worker"), "worker"), { displayName: "A safe edit" })));
});
test("efficiency: ordinary membership create and update", async () => {
  const db = client("pm");
  await measured("membership create - Project Manager", () =>
    assertSucceeds(setDoc(membership(db, "other"), member("other"))));
  await measured("membership update - Project Manager", () =>
    assertSucceeds(updateDoc(membership(db, "site"), { canManageScopeProgress: true })));
});
test("efficiency: scoped specialist grant and Commercial reads/query", async () => {
  await measured("membership grant - Organisation Manager", () =>
    assertSucceeds(setDoc(membership(client("org"), "pm2"),
      member("pm2", "PROJECT_MANAGER", { canViewCommercial: true, canManageCommercial: true }))));
  await measured("Commercial read - scoped membership", () =>
    assertSucceeds(getDoc(doc(client("pm2"), "commercialRecords", "probe"))));
  await measured("Commercial query - scoped membership", () =>
    assertSucceeds(getDocs(query(collection(client("pm2"), "commercialRecords"), where("projectId", "==", "project-a")))));
  await denied(getDoc(doc(client("pm2"), "projects", "project-b")));
});
test("efficiency: five-member batch preserves scope and grant boundaries", async () => {
  await seed(Object.fromEntries(Array.from({ length: 5 }, (_, i) => ["users/batch-" + i, profile()])));
  const db = client("pm");
  await measured("membership create batch - five targets", async () => {
    const batch = writeBatch(db);
    for (let i = 0; i < 5; i++) batch.set(membership(db, "batch-" + i), member("batch-" + i));
    await assertSucceeds(batch.commit());
  });
  const attack = writeBatch(db);
  attack.update(membership(db, "batch-0"), { active: false });
  attack.update(membership(db, "batch-1"), { canManageAssurance: true });
  await denied(attack.commit());
  assert.equal((await getDoc(membership(client("admin"), "batch-0"))).data().active, true);
});
test("efficiency: malformed authority stays denied without engine errors", async () => {
  await seed({
    "users/bad-role": profile("WORKER", { accessLevel: 99 }),
    "users/bad-map": profile("WORKER", { permissions: "not-a-map" }),
    "users/no-org": profile("WORKER", { organisationId: "" })
  });
  for (const uid of ["bad-role", "bad-map", "no-org", "no-profile"]) {
    await denied(getDoc(doc(client(uid), "commercialRecords", "probe")));
    await denied(updateDoc(user(client(uid), "other"), { displayName: "Unauthorised" }));
  }
});

test("denial diagnostics: engine and setup failures cannot pass as policy denials", async () => {
  for (const [code, message] of [
    ["permission-denied", "maximum of 1000 expressions to evaluate has been reached"],
    ["permission-denied", "Internal rules error"],
    ["permission-denied", "maximum document access calls exceeded"],
    ["permission-denied", "Property organisationId is undefined"],
    ["unavailable", "emulator disconnected"]
  ]) {
    await assert.rejects(denied(Promise.reject(Object.assign(new Error(message), { code }))));
  }
});
test("permission shape: non-boolean numeric and nested values stay rejected", async () => {
  for (const value of [1, 0, null, [], {}]) {
    await denied(setDoc(user(client("org"), "invalid-permission"),
      profile("CONTRACTS_MANAGER", { permissions: { canViewCommercial: value } })));
  }
});
