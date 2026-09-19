# NORMEX Schema Patterns

## Purpose

This document defines the patterns that new NORMEX modules must follow.

The current collection list is not a limitation.

New collections may be introduced whenever the business model requires them.

They must follow these patterns.

---

# 1. Canonical Data First

Before building a dashboard or page, define:

What record exists?

What does it represent?

Where is its canonical source?

Who owns it?

Who may access it?

Does it require history?

Does it require documents?

Then build the UI.

---

# 2. Common Identity Fields

Organisation-owned records should use:

organisationId

Project-owned records should additionally use:

projectId

Scope-specific records should additionally use:

scopeId

Phase-specific records may use:

phaseId

Do not invent alternative names such as:

orgId
companyId
projId
project_id

---

# 3. Common Audit Fields

Mutable operational records should normally contain:

createdByUid
createdAt

updatedByUid
updatedAt

Where useful for historical display, a name snapshot may additionally be stored:

createdByName
updatedByName

UID remains the actual identity.

---

# 4. Do Not Use Names as Relationships

Bad:

projectManager: "John Smith"

Better:

projectManagerUid: "abc123"

Optional display snapshot:

projectManagerName: "John Smith"

The UID remains authoritative.

---

# 5. Avoid Large Embedded Arrays

Do not place entire operational registers inside the project document.

Avoid:

allScopes[]
allQuotes[]
allDocuments[]
allPeople[]
allPlant[]

Use canonical collections.

The project document should contain current pointers and summary state only.

---

# 6. Top-Level Collections

Use top-level collections when cross-project reporting is important.

Examples:

projectPhases
projectScopes
commercialRecords
documents

Likely future examples:

rams
actions
inspections
permits
incidents
risks

This supports organisation-wide queries.

---

# 7. Subcollections

Use subcollections where records are strongly bound to one parent and rarely need independent organisation-wide querying.

Current examples:

projects/{projectId}/members
projects/{projectId}/activity

Do not use subcollections automatically simply because a record belongs to a project.

---

# 8. History

If someone may later ask:

"What was this record at that time?"

do not destroy the only previous state.

Use one of:

revision records
phase records
activity history
status history
superseded records

depending on the workflow.

---

# 9. Documents

Do not store binary files in Firestore.

Use:

documents/{documentId}

for metadata.

Use Cloud Storage for the file.

A business record may reference:

primaryDocumentId

Do not duplicate the same file across multiple modules.

---

# 10. Status Values

Status values should be uppercase machine values.

Examples:

LIVE
PRE_CONSTRUCTION
ON_HOLD
COMPLETE
ARCHIVED

UI text may display:

Live
Pre-Construction
On Hold
Complete
Archived

Do not use inconsistent status vocabulary unless the concepts genuinely differ.

---

# 11. Deletion

Normal operational records should use lifecycle state rather than deletion.

Examples:

archived
cancelled
superseded
closed

Hard delete should normally remain Platform Administration only.

---

# 12. New Collection Checklist

Before adding a collection answer:

1. What does the record represent?

2. Is it organisation-level or project-level?

3. Does it need projectId?

4. Does it need scopeId?

5. Does it need phaseId?

6. Does it need cross-project reporting?

7. Should it be top-level or a subcollection?

8. Does it require attachments?

9. Does it require revisions?

10. Does it require immutable history?

11. Who can read it?

12. Who can create it?

13. Who can update it?

14. Can it ever be deleted?

15. Does commercial confidentiality apply?

16. Does assurance confidentiality apply?

17. Which architecture document needs updating?

18. Which Firestore rules need updating?

19. Which Storage rules need updating?

20. Which activity events should it create?

Do not start the UI implementation until these questions are resolved.

---

# 13. New Module Process

Preferred order:

1. define the business record
2. define schema
3. update architecture documentation
4. update Firestore rules
5. update Storage rules if required
6. build data entry workflow
7. test writes
8. test access levels
9. build presentation page
10. connect summaries/dashboard
11. add reporting

---

# 14. Presentation Is Derived

Pages may combine multiple canonical records.

Example:

Project Details may show:

projects
projectPhases
projectScopes
commercialRecords
documents
project activity

This does not mean Project Details owns those records.

---

# 15. Extend, Do Not Break

New modules should extend existing architecture rather than repurpose unrelated fields.

If a new concept is genuinely different, create the correct record for it.

Do not force unrelated information into an existing collection merely to avoid creating a new one.