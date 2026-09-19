# NORMEX Architecture Change Log

This file records deliberate architecture changes.

It is not a general coding changelog.

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

### Authority Model

Confirmed:

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