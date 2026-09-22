# NORMEX Document Model

## Purpose

NORMEX uses one canonical document architecture.

Business modules own records.

The Documents module aggregates and presents their files.

Files must not be duplicated merely because they appear in multiple parts of the platform.

---

# Firestore

Collection:

documents/{documentId}

Firestore stores document metadata only.

The binary file is stored in Cloud Storage.

---

# Storage

Canonical path:

organisations/{organisationId}/projects/{projectId}/documents/{category}/{documentId}/{fileName}

Example:

organisations/colemans/projects/PROJECT123/documents/commercial/DOC123/Q-2243.pdf

---

# Required Document Metadata

Typical Firestore fields:

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

# Initial Categories

PROJECT
SCOPE
COMMERCIAL
ASSURANCE
DRAWING
PROGRAMME
GENERAL

Categories may be extended later.

New categories require:

architecture review
Firestore rule review
Storage rule review
UI treatment review

---

# Business Record Ownership

Documents remain linked to the business record that owns them.

Example:

commercialRecords/{recordId}

contains:

primaryDocumentId

That document metadata record contains:

sourceRecordType: COMMERCIAL_RECORD
sourceRecordId: recordId

The same PDF can then be displayed from:

Commercial
Project Details
Documents
Scope
Reports

without uploading the file multiple times.

---

# Scope Documents

A scope may reference:

primaryDocumentId

Supporting scope documents may additionally be linked through document records where:

sourceRecordType: PROJECT_SCOPE
sourceRecordId: scopeId

---

# Commercial Documents

Examples:

Quotation
RFQ
Supplier RFQ
Variation Quote
Variation
Purchase Order

The commercial record remains the business object.

The document is the evidence attached to that business object.

---

# Revision Principle

Never overwrite Revision 1 with Revision 2.

Example:

Document A

reference: Q-2243
revision: 1
isCurrent: false
supersededByDocumentId: Document B

Document B

reference: Q-2243
revision: 2
isCurrent: true
supersedesDocumentId: Document A

Both remain available.

---

# File Replacement

Existing Storage objects should not normally be overwritten.

New revision:

new documentId
new Storage object
new metadata record

Old revision remains available.

---

# Initial Supported Types

application/pdf

image/jpeg

image/png

Other formats may be introduced later after deliberate review.

Likely future formats may include:

DOCX
XLSX
DWG
DXF

These should not be introduced merely because Storage can technically accept them.

---

# Approved Maximum Individual File Size

50 MB per file, approved 2026-09-19.

This supersedes the earlier 25 MB documentation and 100 MB application limit. Enforcement is pending; agree one exact byte threshold for UI and Storage. No application or security rules are changed by this decision.

---

# Document Register

The Documents module should eventually aggregate records by:

project
scope
category
document type
reference
revision
status
source record
uploaded user
upload date

It should not maintain a second independent copy of the document metadata.

# Controlled Plant Evidence and Upload Lifecycle

The project path above remains valid for project evidence. Plant evidence must support organisation-owned assets without project assignment. Use entityType PLANT and explicitly defined asset-reference semantics; resolve entityId/business-ID/database-key relationships before implementation under Option A.

Each revision has new metadata and a new Storage object. Preserve the accepted revision until replacement upload/finalisation succeeds. Pending/failed uploads are not valid evidence. Define retry, finalisation verification and abandoned-upload handling. Upload, review and restricted-cost viewing are distinct permissions.

Checked-in Storage rules deny all client access. These are approved requirements, not implemented access. See [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md).
