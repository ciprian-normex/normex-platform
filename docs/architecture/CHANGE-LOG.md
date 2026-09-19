# NORMEX Architecture Change Log

This file records deliberate architecture changes.

It is not a general coding changelog.

---

## 2026-09-19 - Bounded Firestore Rule-Efficiency Refactor

Separated actor identity and record-read authorisation from write shape and
delegation validation. Reused resolved actor/project/target maps and changed-field
sets; retained deep validation for profile creation, authority/status changes and
membership grants. Self display-name updates avoid the delegation matrix.
The approved canonical authority model, tenant grant matrix, specialist boundaries
and batch protections remain unchanged.

Retained all 104 existing security tests and added eight focused regressions.
Negative assertions reject explicit rule-engine failures, with an additional
emulator-diagnostic check. The root production rules were copied and compiled by
the isolated emulator: **112 tests ran, 112 passed, 0 failed**. No expression-limit
or document-access-limit errors remained in the completed run.

Representative coverage includes reads/queries, profile administration, membership
grants, scoped Commercial access and a successful five-target membership batch.
Profile/membership creation and authority updates remain the most expensive sampled
individual operations. Coverage aggregates multiple evaluator phases, so no precise
remaining budget is claimed. Local ignored diagnostic artifacts and their limits
are described in `.tests/firestore/README.md`.

Only firestore.rules, the authority test file, its README and this log were changed
for this refactor. No application, Plant, Storage, production Firebase configuration
or live-data changes; no deployment. Ready for deployment review, subject to the
existing canonical-data migration and frontend compatibility gates. Earlier test
status entries below are historical and superseded by this verification.

---

## 2026-09-19 - Bounded Canonical Authority Security Implementation

Implemented local canonical profile/delegation and membership write validation
in firestore.rules. Platform Admin requires ACTIVE / 99 / PLATFORM_ADMIN;
Organisation Manager requires ACTIVE / 6 / ORGANISATION_MANAGER and both
administration permissions. Tenant grants follow the explicit role-related ceiling
recorded in ROLE-ACCESS-MODEL.md. Legacy role fallback is removed from Firestore.
Membership authority must match the current canonical profile UID and role.

Added the isolated .tests/firestore harness for all 14 original cases, seven
additional cases, grant ceilings, scope, legacy aliases and atomic-write attacks.
Dependency installation, JavaScript syntax and SDK imports were checked.
The emulator command failed before tests with spawn java ENOENT: JDK 21+ is
required. Firestore compilation and security assertions are not yet verified.

No application, Plant JavaScript, Storage rules, production Firebase configuration,
vision or live data changes; no deployment. Canonical account migration and
coordinated legacy frontend cutover remain deployment prerequisites. Existing
Plant numeric visibility/request shortcuts remain separate work.

---

## 2026-09-19 - Approved Foundation and Plant Delivery Decisions

Recorded AD-01 to AD-08 in [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md): Option A, safe fixed delegation, Plant cost restrictions, absence privacy, 50 MB evidence, eight loading states, asset-first delivery and bounded Phase 0.

Corrected AGENTS.MD vision paths and reconciled Plant/access/security/document specifications. No application/rule changes, deployment or record migration. Coding requires separate approval.

Historical notes below are retained as history. The old 25 MB limit is superseded by 50 MB. The earlier Storage-rebuild statement is not evidence of current enforcement: checked-in storage.rules denies all client access.

---

## 2026-09-07

### Architecture Foundation Locked

Established canonical project data architecture.

## 2026-09-07 - Role and Permission Model Revised

### Authority Model

Replaced the earlier simplified authority hierarchy with a functional organisation model.

New authority bands:

- Level 0 - Worker
- Level 1 - Supervisor
- Level 2 - Site Manager
- Level 3 - Project Manager
- Level 4 - Senior Project Manager
- Level 4.5 - Health & Safety
- Level 4.6 - Senior Health & Safety
- Level 5 - Contracts Manager
- Level 5.5 - Plant / Transport Manager
- Level 6 - Organisation Manager
- Level 99 - Platform Administration

### Access Philosophy

Access is now explicitly separated into:

accessLevel = authority band

roleCode = functional role

permissions = functional capability

project membership = project scope of authority

### Security Correction

Numeric level must not automatically grant unrelated functional domains.

Examples:

Health & Safety does not automatically inherit Commercial access.

Plant / Transport Management does not automatically inherit Commercial access.

Commercial, Assurance, Plant, Transport and future specialist domains will use explicit permissions.

### Initial Organisation Permission Vocabulary

Added:

canViewAllProjects
canCreateProjects
canManageOrganisation
canManageUsers
canManageAssurance
canViewCommercial
canManageCommercial
canManagePlant
canManageTransport

### Initial Project Membership Permission Vocabulary

Added / confirmed:

canManageProject
canUpdateOperations
canManageScopeProgress
canManageAssurance
canViewCommercial
canManageCommercial

### Platform Administration

Level 99 remains the explicit platform-wide override.

### Superseded Authority Model (historical)

The following earlier hierarchy is superseded by the functional authority model above and must not guide implementation.

Previously recorded:

- Level 1 - Operational
- Level 2 - Project / Site Management
- Level 2.5 - Safety / Assurance Management
- Level 3 - Organisation Management
- Level 99 - Platform Administration

Project-specific permission flags remain available through project membership.

---

### Canonical Collections

Confirmed:

projects

projectPhases

projectScopes

commercialRecords

documents

---

### Project Subcollections

Confirmed:

projects/{projectId}/members

projects/{projectId}/activity

---

### Project Phase Model

Project phase history moved conceptually away from a single overwritten text value.

Canonical phase history:

projectPhases/{phaseId}

Project may retain:

currentPhaseId
currentPhaseName

as current-position pointers.

---

### Scope Model

Canonical project scope collection introduced:

projectScopes/{scopeId}

Scopes may later connect to:

documents
people
plant
RAMS
programme
commercial
assurance

---

### Commercial Model

Canonical commercial register introduced:

commercialRecords/{recordId}

Initial record types:

QUOTATION
RFQ
SUPPLIER_RFQ
VARIATION_QUOTE
VARIATION
PURCHASE_ORDER
OTHER

Commercial access remains separate from general project access.

---

### Canonical Document Model

Introduced:

documents/{documentId}

Firestore stores document metadata.

Cloud Storage stores binary files.

Initial categories:

PROJECT
SCOPE
COMMERCIAL
ASSURANCE
DRAWING
PROGRAMME
GENERAL

---

### Cloud Storage

Canonical path:

organisations/{organisationId}/projects/{projectId}/documents/{category}/{documentId}/{fileName}

Initial supported file types:

PDF
JPG
JPEG
PNG

Initial maximum size:

25 MB

Existing evidence files should not normally be overwritten.

New revision = new document record and new Storage object.

---

### Security

Firestore rules rebuilt around canonical architecture.

Storage rules rebuilt around canonical document storage.

Default deny remains in force.

UI visibility is not treated as security.

Hard delete remains strongly restricted.

---

### Development Direction

Previous dashboard-first development approach abandoned.

New sequence:

canonical data
security
data-entry workflow
history
documents
presentation
dashboard
reporting

First workflow to build against the locked architecture:

Add Scope
→ projectScopes
→ optional document
→ documents
→ Storage
→ project activity
