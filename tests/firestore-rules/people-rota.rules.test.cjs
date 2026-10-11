"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { after, before, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require("@firebase/rules-unit-testing");
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} = require("firebase/firestore");

const PROJECT_ID = "normex-platform";
const ORG_ID = "colemans";
const OTHER_ORG_ID = "other-org";
const WEEK_START = "2026-10-12";
const WEEK_ID = `${ORG_ID}__${WEEK_START}`;

let testEnv;

function profile(accessLevel, organisationId = ORG_ID) {
  return {
    status: "ACTIVE",
    accessLevel,
    organisationId
  };
}

function versionData(uid, overrides = {}) {
  return {
    organisationId: ORG_ID,
    weekId: WEEK_ID,
    weekStart: WEEK_START,
    versionNumber: 1,
    previousVersionId: null,
    status: "BUILDING",
    entryCount: 1,
    createdByUid: uid,
    createdByName: "Rules Test Manager",
    createdAt: serverTimestamp(),
    updatedByUid: uid,
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

function entryData(uid, versionId, overrides = {}) {
  return {
    organisationId: ORG_ID,
    weekId: WEEK_ID,
    versionId,
    weekStart: WEEK_START,
    personId: "person-1",
    dateKey: WEEK_START,
    positionType: "WORK",
    projectId: "project-1",
    createdByUid: uid,
    createdAt: serverTimestamp(),
    ...overrides
  };
}

function publishedVersionData(uid, versionNumber, overrides = {}) {
  return {
    ...versionData(uid, {
      versionNumber,
      status: "PUBLISHED",
      publishedByUid: uid,
      publishedByName: "Rules Test Manager",
      publishedAt: serverTimestamp(),
      ...overrides
    })
  };
}

function weekData(uid, versionId, versionNumber, previousVersionId = null) {
  return {
    organisationId: ORG_ID,
    weekStart: WEEK_START,
    publishedVersionId: versionId,
    publishedVersionNumber: versionNumber,
    publishedByUid: uid,
    publishedByName: "Rules Test Manager",
    publishedAt: serverTimestamp(),
    previousPublishedVersionId: previousVersionId,
    updatedByUid: uid,
    updatedAt: serverTimestamp()
  };
}

async function seedDocuments(documents) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [documentPath, data] of Object.entries(documents)) {
      await setDoc(doc(db, documentPath), data);
    }
  });
}

function dbFor(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

before(async () => {
  const rules = fs.readFileSync(
    path.resolve(__dirname, "../../firestore.rules"),
    "utf8"
  );
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDocuments({
    "users/manager": profile(3),
    "users/viewer": profile(2),
    "users/cross-manager": profile(3, OTHER_ORG_ID),
    "users/platform-admin": profile(99)
  });
});

after(async () => {
  await testEnv.cleanup();
});

test("ACTIVE Level 3 same-org can create a BUILDING version", async () => {
  const db = dbFor("manager");
  await assertSucceeds(
    setDoc(doc(db, "peopleRotaVersions/version-1"), versionData("manager"))
  );
});

test("ACTIVE same-org user can read an initially missing week pointer", async () => {
  const db = dbFor("viewer");
  const snapshot = await assertSucceeds(
    getDoc(doc(db, `peopleRotaWeeks/${WEEK_ID}`))
  );
  assert.equal(snapshot.exists(), false);
});

test("ACTIVE Level 3 same-org can create a valid WORK entry", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": versionData("manager")
  });
  const db = dbFor("manager");
  await assertSucceeds(
    setDoc(
      doc(db, "peopleRotaEntries/entry-work"),
      entryData("manager", "version-1")
    )
  );
});

test("ACTIVE Level 3 same-org can create a HOLIDAY entry with null project", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": versionData("manager")
  });
  const db = dbFor("manager");
  await assertSucceeds(
    setDoc(
      doc(db, "peopleRotaEntries/entry-holiday"),
      entryData("manager", "version-1", {
        positionType: "HOLIDAY",
        projectId: null
      })
    )
  );
});

test("ACTIVE Level 3 same-org can promote BUILDING to PUBLISHED", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": versionData("manager")
  });
  const db = dbFor("manager");
  await assertSucceeds(
    updateDoc(doc(db, "peopleRotaVersions/version-1"), {
      status: "PUBLISHED",
      publishedByUid: "manager",
      publishedByName: "Rules Test Manager",
      publishedAt: serverTimestamp(),
      updatedByUid: "manager",
      updatedAt: serverTimestamp()
    })
  );
});

test("ACTIVE Level 3 same-org can create and advance the week pointer", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": publishedVersionData("manager", 1),
    "peopleRotaVersions/version-2": publishedVersionData("manager", 2, {
      previousVersionId: "version-1"
    })
  });
  const db = dbFor("manager");
  const weekRef = doc(db, `peopleRotaWeeks/${WEEK_ID}`);
  await assertSucceeds(setDoc(weekRef, weekData("manager", "version-1", 1)));
  await assertSucceeds(
    setDoc(weekRef, weekData("manager", "version-2", 2, "version-1"), {
      merge: true
    })
  );
});

test("Level 2 cannot publish", async () => {
  const db = dbFor("viewer");
  await assertFails(
    setDoc(doc(db, "peopleRotaVersions/version-1"), versionData("viewer"))
  );
});

test("cross-org Level 3 cannot publish", async () => {
  const db = dbFor("cross-manager");
  await assertFails(
    setDoc(
      doc(db, "peopleRotaVersions/version-1"),
      versionData("cross-manager")
    )
  );
});

test("published entry update is denied", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": publishedVersionData("manager", 1),
    "peopleRotaEntries/entry-1": entryData("manager", "version-1")
  });
  const db = dbFor("manager");
  await assertFails(
    updateDoc(doc(db, "peopleRotaEntries/entry-1"), { personId: "person-2" })
  );
});

test("published entry delete is denied", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": publishedVersionData("manager", 1),
    "peopleRotaEntries/entry-1": entryData("manager", "version-1")
  });
  const db = dbFor("manager");
  await assertFails(deleteDoc(doc(db, "peopleRotaEntries/entry-1")));
});

test("version identity fields cannot change during promotion", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": versionData("manager")
  });
  const db = dbFor("manager");
  await assertFails(
    updateDoc(doc(db, "peopleRotaVersions/version-1"), {
      weekStart: "2026-10-19",
      status: "PUBLISHED",
      publishedByUid: "manager",
      publishedByName: "Rules Test Manager",
      publishedAt: serverTimestamp(),
      updatedByUid: "manager",
      updatedAt: serverTimestamp()
    })
  );
});

test("Platform Admin can perform the valid publish sequence", async () => {
  const uid = "platform-admin";
  const db = dbFor(uid);
  const versionRef = doc(db, "peopleRotaVersions/admin-version-1");
  await assertSucceeds(setDoc(versionRef, versionData(uid)));
  await assertSucceeds(
    setDoc(
      doc(db, "peopleRotaEntries/admin-entry-1"),
      entryData(uid, "admin-version-1")
    )
  );

  const batch = writeBatch(db);
  batch.update(versionRef, {
    status: "PUBLISHED",
    publishedByUid: uid,
    publishedByName: "Rules Test Manager",
    publishedAt: serverTimestamp(),
    updatedByUid: uid,
    updatedAt: serverTimestamp()
  });
  batch.set(
    doc(db, `peopleRotaWeeks/${WEEK_ID}`),
    weekData(uid, "admin-version-1", 1),
    { merge: true }
  );
  await assertSucceeds(batch.commit());
});

test("same-org published Rota query succeeds and cross-org query is denied", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": publishedVersionData("manager", 1),
    "peopleRotaVersions/other-version": publishedVersionData("cross-manager", 1, {
      organisationId: OTHER_ORG_ID,
      weekId: `${OTHER_ORG_ID}__${WEEK_START}`
    }),
    "peopleRotaEntries/entry-1": entryData("manager", "version-1"),
    "peopleRotaEntries/entry-other": {
      ...entryData("cross-manager", "other-version", {
        organisationId: OTHER_ORG_ID,
        weekId: `${OTHER_ORG_ID}__${WEEK_START}`
      })
    }
  });
  const db = dbFor("manager");
  const entries = collection(db, "peopleRotaEntries");
  const sameOrg = await assertSucceeds(
    getDocs(
      query(
        entries,
        where("organisationId", "==", ORG_ID),
        where("versionId", "==", "version-1")
      )
    )
  );
  assert.equal(sameOrg.size, 1);
  await assertFails(
    getDocs(
      query(
        entries,
        where("organisationId", "==", OTHER_ORG_ID),
        where("versionId", "==", "other-version")
      )
    )
  );
});

test("unauthenticated Rota reads are denied", async () => {
  await seedDocuments({
    [`peopleRotaWeeks/${WEEK_ID}`]: weekData("manager", "version-1", 1)
  });
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, `peopleRotaWeeks/${WEEK_ID}`)));
});

test("string accessLevel 99 is not accepted as Platform Admin authority", async () => {
  await seedDocuments({
    "users/string-admin": profile("99")
  });
  const db = dbFor("string-admin");
  await assertFails(
    setDoc(
      doc(db, "peopleRotaVersions/string-admin-version"),
      versionData("string-admin")
    )
  );
});

test("version schema pollution is denied", async () => {
  const db = dbFor("manager");
  await assertFails(
    setDoc(
      doc(db, "peopleRotaVersions/polluted-version"),
      versionData("manager", { unexpectedAuthority: true })
    )
  );
});

test("invalid entry position and project combinations are denied", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": versionData("manager")
  });
  const db = dbFor("manager");
  await assertFails(
    setDoc(
      doc(db, "peopleRotaEntries/work-without-project"),
      entryData("manager", "version-1", { projectId: null })
    )
  );
  await assertFails(
    setDoc(
      doc(db, "peopleRotaEntries/holiday-with-project"),
      entryData("manager", "version-1", { positionType: "HOLIDAY" })
    )
  );
});

test("entries cannot be added to a PUBLISHED version", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-1": publishedVersionData("manager", 1)
  });
  const db = dbFor("manager");
  await assertFails(
    setDoc(
      doc(db, "peopleRotaEntries/late-entry"),
      entryData("manager", "version-1")
    )
  );
});

test("normal same-org users can read PUBLISHED but not BUILDING versions", async () => {
  await seedDocuments({
    "peopleRotaVersions/published": publishedVersionData("manager", 1),
    "peopleRotaVersions/building": versionData("manager")
  });
  const db = dbFor("viewer");
  await assertSucceeds(getDoc(doc(db, "peopleRotaVersions/published")));
  await assertFails(getDoc(doc(db, "peopleRotaVersions/building")));
});

test("week pointer cannot target mismatched published version metadata", async () => {
  await seedDocuments({
    "peopleRotaVersions/version-2": publishedVersionData("manager", 2, {
      previousVersionId: "version-1"
    })
  });
  const db = dbFor("manager");
  await assertFails(
    setDoc(
      doc(db, `peopleRotaWeeks/${WEEK_ID}`),
      weekData("manager", "version-2", 1)
    )
  );
});
