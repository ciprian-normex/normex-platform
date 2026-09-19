# NORMEX Project Data Model

## Purpose

NORMEX stores canonical operational records first.

Dashboards, pages, reports and summaries consume those records.

The user interface must not dictate the underlying database structure.

---

# Core Principles

1. IDs are the source of identity.
2. Names are display values only.
3. Project records contain current identity and summary state.
4. Historical evidence must not be destroyed by overwriting.
5. Records that need cross-project reporting should normally use top-level collections.
6. Binary files are stored in Cloud Storage, not Firestore.
7. Firestore stores structured metadata and references.
8. Security rules and data structure must evolve together.
9. Operational records should normally be archived, superseded or closed rather than deleted.
10. New modules must follow the architecture patterns in this folder.

---
# Access Model

NORMEX separates:

- authority band
- functional role
- functional permissions
- project membership

The full definition is maintained in:

ROLE-ACCESS-MODEL.md
SECURITY-MODEL.md

Current authority bands:

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

Numeric authority level does not automatically grant unrelated functional domains.

Commercial, Assurance, Plant, Transport and future specialist domains use explicit permissions.


# Core Project

Collection:

projects/{projectId}

Purpose:

Stores project identity, current position and summary pointers.

Typical fields:

organisationId
projectCode
name
description
projectType
status

clientOrganisationId
clientName

primarySiteId
siteName

rolesOnProject

startDate
targetFinishDate
actualFinishDate

currentPhaseId
currentPhaseName

projectManagerUid
projectDirectorUid

readinessStatus
programmeStatus
assuranceStatus
commercialStatus

archived
archivedAt
archivedByUid

createdByUid
createdAt

updatedByUid
updatedAt

---

# Project Members

Collection:

projects/{projectId}/members/{uid}

Purpose:

Controls project assignment and project-specific permissions.

Typical fields:

uid
active
role

assignedFrom
assignedUntil

canManageProject
canManageAssurance
canViewCommercial
canManageCommercial

createdByUid
createdAt
updatedByUid
updatedAt

---

# Project Activity

Collection:

projects/{projectId}/activity/{activityId}

Purpose:

Immutable project audit trail.

Examples:

PROJECT_CREATED
PROJECT_UPDATED
PROJECT_PHASE_CHANGED
PROJECT_SCOPE_CREATED
PROJECT_SCOPE_UPDATED
DOCUMENT_UPLOADED
DOCUMENT_SUPERSEDED
COMMERCIAL_RECORD_CREATED
COMMERCIAL_RECORD_UPDATED
RAMS_SUBMITTED
RAMS_REVISED
RAMS_ACCEPTED

Activity records should not normally be updated or deleted.

---

# Project Phases

Collection:

projectPhases/{phaseId}

Purpose:

Permanent phase history.

Typical fields:

organisationId
projectId

name
sequence
status

plannedStart
plannedFinish

actualStart
actualFinish

createdByUid
createdByName
createdAt

updatedByUid
updatedAt

The project document may store:

currentPhaseId
currentPhaseName

as convenient current-position pointers.

The phase collection remains the historical source of truth.

---

# Project Scopes

Collection:

projectScopes/{scopeId}

Purpose:

Canonical project scope / work package records.

Typical fields:

organisationId
projectId

scopeCode
name
description
status

phaseId

plannedStart
targetFinishDate
actualStart
actualFinish

responsibleManagerUid

primaryDocumentId

archived
archivedAt

createdByUid
createdByName
createdAt

updatedByUid
updatedAt

Scopes may later link to:

people
plant
RAMS
documents
programme
commercial records
actions
inspections
permits
temporary works
risks
change events

---

# Commercial Records

Collection:

commercialRecords/{recordId}

Types include:

QUOTATION
RFQ
SUPPLIER_RFQ
VARIATION_QUOTE
VARIATION
PURCHASE_ORDER
OTHER

Typical fields:

organisationId
projectId
scopeId

type
reference
description

counterpartyName

value
currency

status
recordDate

primaryDocumentId

supersededByRecordId

createdByUid
createdByName
createdAt

updatedByUid
updatedAt

Commercial access is controlled separately from ordinary project visibility.

---

# Canonical Documents

Collection:

documents/{documentId}

Purpose:

Single project document metadata register.

Firestore stores metadata.

Cloud Storage stores the actual file.

Typical fields:

organisationId
projectId
scopeId

category
documentType

title
reference
revision

status

sourceRecordType
sourceRecordId

storagePath
fileName
mimeType
fileSize

uploadedByUid
uploadedByName
uploadedAt

supersedesDocumentId
supersededByDocumentId

isCurrent

---

# Document Categories

Initial categories:

PROJECT
SCOPE
COMMERCIAL
ASSURANCE
DRAWING
PROGRAMME
GENERAL

This list may be extended later when a genuine new document domain is introduced.

---

# Current Presentation Pages

Project pages consume canonical data.

Examples:

Project Overview
Project Details
Readiness
Scope
Resources
Documents
Programme
Commercial

These are presentation and workflow layers.

They are not the canonical source of the underlying records.

---

# Future Collections

The current architecture is intentionally extensible.

Likely future top-level collections include:

rams
ramsRevisions
actions
inspections
permits
temporaryWorks
incidents
observations
ncrs
risks
changeEvents
plantRecords
peopleRecords
programmeActivities
environmentalRecords
stakeholderRecords
communications

These collections are not automatically approved simply because they appear in this list.

Each must go through the schema introduction process defined in SCHEMA-PATTERNS.md.