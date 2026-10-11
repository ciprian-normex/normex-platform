# People Rota Firestore rules audit

## Scope

- `firestore.rules`
- `modules/contractor/people/rota/rota-data.js`
- `modules/contractor/people/rota/rota.js`
- `modules/contractor/people/rota/rota-state.js`
- `modules/contractor/shared/js/shell.js`
- `js/firebase.js`

Target database: `(default)`, Standard edition, Firestore Native mode, `europe-west2`.

## Current failure

The currently released production ruleset contains two apparent match blocks
for each Rota collection, but both duplicate generations occur after the sole
`match /databases/{database}/documents` block has already closed. They therefore
do not match Firestore document paths. The recursive default deny inside the
database/documents block remains authoritative.

Consequently, `publishRota()` fails at its first operation,
`getDoc(peopleRotaWeeks/{organisationId}__{weekStart})`, before it can create a
BUILDING version. The local working copy had already lost both misplaced blocks
and likewise had no effective Rota match before this fix.

The live `Ciprian Trusca` profile was checked through the Firestore API and is
valid for the existing helper predicates: `status: "ACTIVE"`, numeric
`accessLevel: 99`, and `organisationId: "colemans"`. The profile is not the
cause of this failure.

## Queries and direct reads

- `people`: list filtered by `organisationId == actor.organisationId`.
- `projects`: list filtered by `organisationId == actor.organisationId`.
- `peopleRotaWeeks/{weekId}`: direct get; document organisation is checked after read.
- `peopleRotaVersions/{versionId}`: direct get; organisation/week/status are checked after read.
- `peopleRotaEntries`: list filtered by both `organisationId` and `versionId`.

Rota list queries therefore include the tenant predicate required by the new
same-organisation read rules.

## Publish writes

1. Create a strict BUILDING version.
2. Create immutable entries linked to that BUILDING version.
3. Promote only that version from BUILDING to PUBLISHED.
4. Create or advance the week publication pointer in the same final batch.

All Rota creates use the authenticated actor UID, server timestamps, and the
actor's organisation. Version identity and entry documents remain immutable.

## Security attack expectations

- Unauthenticated access: denied.
- Level 0/1/2 writes: denied.
- Cross-organisation writes: denied, including level 99 writes.
- Version arbitrary update or identity mutation: denied.
- Entry update/delete: denied.
- Orphan entry or entry targeting a non-BUILDING version: denied.
- Week pointer to a non-PUBLISHED, cross-tenant, or mismatched version: denied.
- Extra fields, missing fields, invalid types, oversized strings, and invalid
  position/project combinations: denied by strict validators.
