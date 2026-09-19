
---

# 2. `/AGENTS.md`

```markdown
# NORMEX Development Instructions

## 1. Mandatory product context

Before making architectural, workflow, UI, database, security or permission decisions, read:

`/docs/product/NORMEX-VISION.md`

That document defines what NORMEX is intended to become and is the product source of truth.

Do not reinterpret NORMEX as only:

- a safety system
- a forms platform
- a plant system
- a document portal
- an attendance system
- a project dashboard

NORMEX is a multi-tenant contractor organisation and project operating platform.

---

# 2. Before coding

For any substantial task, do not immediately edit code.

First:

1. inspect the relevant files
2. inspect related dependencies
3. understand the current workflow
4. understand the existing data model
5. inspect relevant Firestore rules
6. inspect Storage rules if files are involved
7. understand access requirements
8. identify existing or legacy logic
9. identify risks
10. propose a plan

If the user requested inspection or planning only, do not modify files.

Wait for approval before large structural changes unless explicitly instructed to proceed.

---

# 3. Repository inspection

Before changing an unfamiliar domain, inspect the domain properly.

Relevant areas may include:

```text
/
firebase.json
.firebaserc
firestore.rules
storage.rules
firestore.indexes.json
.gitignore

/js/

/modules/contractor/shared/
/modules/contractor/projects/
/modules/contractor/operations/
/modules/contractor/people/
/modules/contractor/plant/
/modules/contractor/assurance/
/modules/contractor/commercial/
/modules/contractor/reports/
/modules/contractor/admin/
/modules/contractor/support/

/docs/

Do not assume architecture from filenames alone.

Read the actual implementation.

4. Current technology

Current NORMEX technology includes:

Firebase Authentication
Cloud Firestore
Firebase Storage
Firebase Hosting
HTML
CSS
vanilla JavaScript
JavaScript ES modules

Do not introduce:

React
Vue
Angular
TypeScript
a build framework
another backend

unless there is an explicitly approved architectural decision to do so.

Do not perform a framework migration as part of unrelated feature work.

5. Multi-tenant security

NORMEX is multi-tenant.

Organisation isolation is mandatory.

Every organisation-owned record should be protected so users cannot access another organisation's data unless explicitly authorised.

Never rely only on:

hidden buttons
hidden pages
navigation visibility
client-side checks

Firestore and Storage rules are the real security boundary.

Default deny should remain the security philosophy.

Do not weaken rules simply to remove a console error.

6. Access model

NORMEX access is not based only on numeric level.

Use:

authority level
functional role
permissions
project membership
organisation
record ownership where relevant

Current authority direction:

0     Worker
1     Supervisor
2     Site Manager
3     Project Manager
4     Senior Project Manager
4.5   Health & Safety
4.6   Senior Health & Safety
5     Contracts Manager
5.5   Plant / Transport Manager
6     Organisation Manager
99    Platform Administration

The number is an authority band.

It does not automatically grant unrelated specialist permissions.

Examples:

A Senior H&S user should not automatically see commercial margin.

A Commercial user should not automatically close safety incidents.

A Contracts Manager should not automatically manage Plant.

A Site Manager should not automatically edit organisation-level master data.

Relevant permissions may include:

canViewPlant
canRequestPlant
canManagePlant
canManageTransport

canViewCommercial
canManageCommercial

canManageAssurance
canManageUsers
canManageOrganisation
canViewAllProjects
canCreateProjects

Use explicit permission and role logic where appropriate.

Level 99 remains the deliberate platform override.

7. Canonical data principle

Build canonical data first.

Preferred development sequence:

BUSINESS REQUIREMENT
↓
WORKFLOW
↓
CANONICAL DATA MODEL
↓
ACCESS / SECURITY
↓
INPUT WORKFLOW
↓
HISTORY / EVIDENCE
↓
DERIVED INFORMATION
↓
DASHBOARD
↓
REPORTING

Do not create dashboards first and then invent fields to populate them.

8. Canonical versus derived information

Canonical records should represent actual business events or objects.

Examples:

project
scope
person qualification
rota assignment
clock-in
plant asset
plant hire
plant assignment
plant movement
plant inspection
plant defect
maintenance record
commercial variation
document metadata

Derived information may include:

project readiness
person readiness
rota gap
attendance shortage
current plant location
plant idle state
hire exposure
programme risk
project control state

Where cached values exist for performance or display, canonical history remains authoritative.

9. Audit history

Do not silently overwrite meaningful business history.

Important changes should preserve:

previous value
new value
user
date/time
reason where relevant

Examples:

hire rate changes
plant location changes
project assignments
rota changes
commercial approvals
defect lifecycle
maintenance lifecycle
off-hire changes
programme changes
variation status
project issues

NORMEX should eventually be able to answer:

What changed?

When?

Who changed it?

Why?

10. Firestore record conventions

Organisation-owned records should normally include:

organisationId
createdByUid
createdByName
createdAt
updatedByUid
updatedAt

Where relevant also include:

projectId
plantId
scopeId
phaseId
personId

IDs are authoritative.

Names are display snapshots.

Avoid using names as relational identifiers.

11. Readable business IDs

Where practical, important operational records should use human-readable identifiers.

Plant examples:

HRE-0001
EXC-0001
TEL-0001
MEW-0001

Related examples:

HIRE-HRE-0001-001
ASN-HRE-0001-001
MOV-HRE-0001-001
DEF-HRE-0001-001
MNT-HRE-0001-001
ISSUE-HRE-0001-001

High-volume records may use readable time-based IDs such as:

INS-HRE-0001-20260914-064238

Do not change permanent business identifiers after creation unless the architecture explicitly allows it.

12. Current Plant architecture

The Plant domain currently uses or plans to use:

plantAssets/{plantId}
plantHireRecords/{hireId}
plantAssignments/{assignmentId}
plantMovements/{movementId}
plantRequests/{requestId}
plantIssues/{issueId}
plantInspections/{inspectionId}
plantDefects/{defectId}
plantMaintenance/{maintenanceId}
plantSuppliers/{supplierId}
documents/{documentId}

Plant is not a simple register.

It must eventually control:

fleet
owned plant
hired plant
availability
allocation
location
hire
transport
defects
repairs
downtime
maintenance
inspections
compliance
suppliers
documents
financial exposure
project impact

Before changing Plant functionality, read the Plant sections of:

/docs/product/NORMEX-VISION.md

13. Plant inspection architecture

Do not add manual inspection creation to the Plant Asset page unless explicitly requested.

Inspections should normally be completed through operational inspection forms.

Those forms should create canonical:

plantInspections

records linked using the permanent Plant ID.

The Plant Asset workspace consumes that history.

If an inspection records a fault, the inspection workflow may create a:

plantDefects

record.

If the asset is unsafe to use, the workflow may update its operational state to:

OFF_ROAD

where appropriate.

14. Documents

Documents are evidence.

Firestore stores metadata.

Firebase Storage stores the binary file.

Do not treat documents as the business object itself.

Plant example:

Plant Asset
↓
LOLER requirement
↓
Compliance state
↓
Certificate

People example:

Person
↓
Qualification
↓
Competence status
↓
Certificate/card

Project example:

Project
↓
RAMS record
↓
Review/approval state
↓
PDF

Do not overwrite controlled historic revisions.

Create new revisions where appropriate.

Plant documents should normally support:

entityType: "PLANT"
entityId: plantId
15. Module file structure

Keep module-specific files local to the module.

Preferred:

/modules/contractor/plant/fleet/
    index.html
    fleet.css
    fleet.js

Not:

/css/fleet.css
/js/fleet.js

unless those files are genuinely shared across multiple modules.

Only cross-module code should live in shared folders.

16. Shared files

Before changing a shared file, determine:

which modules use it
what assumptions those modules make
whether the change could cause regressions

Avoid turning shared files into large collections of unrelated domain-specific functions.

Prefer locality-first architecture.

17. UI philosophy

NORMEX should look like serious industrial operational software.

Preferred style:

premium dark green / neutral theme
white workspace surfaces
rounded panels
restrained typography
generous spacing
strong hierarchy
horizontal navigation
compact status cards
calm visual language
limited use of warning colours

Avoid:

generic Bootstrap appearance
excessive gradients
excessive icons
colourful SaaS gimmicks
giant heroes on operational pages
repeated explanatory text
meaningless dashboard cards
visual clutter

Each page should answer a business or operational question.

Do not create UI only because a database collection exists.

18. Dashboard philosophy

Dashboards should prioritise decision-making.

Attention Required means:

an actionable exception requiring intervention

It should not contain neutral information.

Good examples:

plant unavailable for mobilisation
rota gap
RAMS approval outstanding
hired plant idle
critical defect
overdue action
project clock-in shortage
commercial approval required

Bad examples:

project exists
plant is deployed
worker has qualification
document uploaded

Neutral information belongs in its domain view.

19. Existing user experience direction

Protected workspace pages should avoid unnecessary hero copy.

Prefer:

title
concise operational context
meaningful control state
working content

Do not add marketing-style text inside operational pages.

20. Rotas and attendance

Rotas and attendance are separate but connected concepts.

Rota:

what was planned

Clock-ins / attendance:

what actually happened

Reports:

what the operational outcome was

Do not collapse these into one field or one record type.

Future architecture should allow:

ROTA
↓
CLOCK-IN
↓
ATTENDANCE
↓
REPORTING
21. Reports

Reports should be outputs derived from canonical system data where possible.

Avoid forcing users to type information again if NORMEX already knows it.

Examples:

A daily report should eventually be able to consume:

planned rota
clock-ins
workforce
plant
project progress
defects
delays
assurance information

A weekly report should aggregate existing information rather than recreate it manually.

22. Coding style

Prefer:

explicit readable JavaScript
descriptive function names
clear section comments in large files
small understandable helpers
predictable data flow

Avoid:

unnecessary cleverness
premature abstraction
giant global utilities
deeply nested unexplained logic
duplicate functions
obsolete commented-out code
excessive console logging

Finished production code should keep console output minimal.

23. Editing large files

Before editing a large file:

inspect the complete file
identify existing functions
identify imports
identify dependencies
search for duplicated logic
inspect related CSS/HTML where relevant
inspect Firestore/Storage rules if data access is involved

Do not paste replacements based on assumptions about what the file contains.

24. Full replacement preference

When implementing major changes, prefer coherent full-file replacements where practical.

If a JavaScript file is too large to present or edit safely in one block:

split it into clearly numbered sequential parts
preserve exact order
avoid duplicate sections
verify function duplication afterward

Before considering the task complete, check that large assembled files do not contain duplicate declarations.

25. Backward compatibility

There is some prototype/test data created before the current architecture was fully defined.

Do not automatically migrate or delete old test records unless needed.

Where reasonable, new code may tolerate older record shapes while all new records follow the canonical model.

Do not design the new architecture around legacy test data.

26. Empty states

An empty collection does not mean a positive state.

Examples:

If inspection access failed, do not show:

0 inspections, everything fine

If Firestore permission prevents loading defects, do not show:

0 defects

Differentiate:

no records
not applicable
unavailable
permission denied
not yet assessed

Do not convert missing information into false assurance.

27. Security errors

If Firestore or Storage returns:

Missing or insufficient permissions

do not immediately weaken the rule.

First determine:

collection
user role
intended access
organisation
project context
operation type
whether the query structure matches the rule

Then change security deliberately.

28. Testing

After changes, check:

browser console
syntax errors
runtime errors
missing imports
Firestore permissions
Storage permissions
empty-state behaviour
current test records
new records
organisation isolation
access-level behaviour

Where practical, test:

Level 99
intended management role
lower read-only/request role

Do not consider a page finished only because it looks correct as Level 99.

29. Git workflow

The repository is tracked in Git.

Before major work:

git status

Prefer small logical commits.

Examples:

feat: add plant request workflow
fix: correct plant document permissions
docs: add platform architecture
refactor: consolidate plant access helpers

Do not commit:

service-account credentials
private keys
secrets
local sensitive configuration

Do not weaken .gitignore protections without understanding the reason.

30. Scope control for coding tasks

Do not modify unrelated modules during a bounded task.

If a task requires changes outside its apparent module:

explain why
identify the file
identify the dependency
include it in the proposed plan

Avoid opportunistic refactoring unless approved.

31. Planning standard

For substantial work, provide a short implementation plan including:

goal
current state
files affected
data model impact
access/security impact
UI impact
dependencies
testing plan
risks

Then proceed only when approval has been given, unless the user explicitly asked to implement immediately.

32. Working with the repository owner

The repository owner understands the construction and operational requirements deeply but is still learning software development.

Explain important technical actions clearly.

Do not assume advanced knowledge of:

Git
Firebase
Firestore
Storage
JavaScript
architecture

For risky terminal commands:

explain what the command does
explain what success should look like
warn about destructive effects if any

Prefer clear sequential instructions.

Do not make the user reconstruct complex missing steps.

33. Product decisions

The repository owner is the product decision-maker.

Codex should:

inspect
analyse
recommend
explain trade-offs
identify risks

But it should not silently redefine the product.

If the current implementation conflicts with:

/docs/product/NORMEX-VISION.md

identify the conflict and propose a correction.

Do not rewrite the product direction without approval.

34. Architecture documentation

Architecture documents should become source-of-truth references.

Expected documentation may include:

/docs/product/NORMEX-VISION.md

/docs/architecture/
    PLATFORM-ARCHITECTURE.md
    DATA-MODEL.md
    ROLE-ACCESS-MODEL.md
    PLANT-ARCHITECTURE.md
    DEVELOPMENT-ROADMAP.md

Before creating a new architecture file, inspect existing documentation to avoid duplicates or contradictions.

35. Current development priority

The current development priority is the NORMEX Plant domain.

Before making major additional Plant changes:

inspect the full Plant folder
inspect shared Plant files
inspect Firestore rules
inspect Storage rules
inspect Firebase configuration
inspect relevant Projects integration
inspect relevant Operations integration
inspect inspection workflows
inspect existing Plant architecture documentation
identify legacy or incomplete Plant code
compare current implementation with NORMEX-VISION.md
produce a staged plan

Do not assume the current UI represents the final Plant architecture.

36. Current Plant implementation direction

The current Plant navigation direction is:

Overview
Requests
Fleet
Availability
Movements
Defects
Maintenance
Compliance
Suppliers

Secondary/direct views may include:

Plant Asset
Hire Control

The purpose of Plant Overview is:

financial exposure
project impact
plant blockers
open issues
milestones
immediate actions

Fleet is not merely a table.

It should distinguish:

hired / leased
owned
type
operational state
current project
current location
hire exposure
idle plant
off-road plant

The Asset workspace should provide the complete current and historical plant truth.

37. Current People direction

People should eventually support:

profile
role
competence
qualifications
skills
availability
project allocation
rotas
attendance relationship
project readiness

Do not reduce People to a qualifications table.

38. Current Operations direction

Operations should eventually connect:

daily work
shift activity
attendance
clock-ins
workforce
plant
logistics
deliveries
daily reports
site controls
progress
tomorrow's requirements

Operations should represent actual execution.

39. Current Reports direction

Reports should use existing data wherever possible.

Do not create duplicate data-entry workflows merely for reporting.

Reports should eventually support project and organisation outputs including:

readiness
project status
programme
workforce
rota
attendance
clock-ins
plant
assurance
commercial
closeout
40. Final working principle

Always prefer:

UNDERSTAND
↓
MODEL
↓
SECURE
↓
BUILD
↓
TEST
↓
COMMIT

over:

SEE FEATURE
↓
CODE QUICKLY
↓
PATCH
↓
ADD MORE

The goal is not just to make NORMEX work today.

The goal is to build a maintainable, secure and commercially credible multi-tenant platform that can support real contractor organisations and multiple simultaneous projects.

