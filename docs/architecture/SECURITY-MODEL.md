# NORMEX Security Model

## Purpose

Security is part of the NORMEX architecture.

Frontend visibility is user experience only.

Firestore Rules and Storage Rules are the actual security boundary.

---

# Access Architecture

NORMEX uses four separate access concepts:

Access Level
Role Code
Permissions
Project Membership

See:

ROLE-ACCESS-MODEL.md

---

# Access Level

Access Level represents authority band.

Current bands:

0 - Worker
1 - Supervisor
2 - Site Manager
3 - Project Manager
4 - Senior Project Manager
4.5 - Health & Safety
4.6 - Senior Health & Safety
5 - Contracts Manager
5.5 - Plant / Transport Manager
6 - Organisation Manager
99 - Platform Administration

Access Level must not automatically grant unrelated functional domains.

---

# Role Code

Role Code identifies functional responsibility.

Examples:

WORKER
SUPERVISOR
SITE_MANAGER
PROJECT_MANAGER
SENIOR_PROJECT_MANAGER
HEALTH_SAFETY
SENIOR_HEALTH_SAFETY
CONTRACTS_MANAGER
PLANT_TRANSPORT_MANAGER
ORGANISATION_MANAGER
PLATFORM_ADMIN

Role Code is not itself sufficient authorization.

---

# Permissions

Permissions grant functional capability.

Initial organisation-level permissions:

canViewAllProjects
canCreateProjects
canManageOrganisation
canManageUsers
canManageAssurance
canViewCommercial
canManageCommercial
canManagePlant
canManageTransport

New permissions may be introduced when genuine new domains require them.

---

# Project Membership

Project-specific access is controlled through:

projects/{projectId}/members/{uid}

Possible project permissions include:

canManageProject
canUpdateOperations
canManageScopeProgress
canManageAssurance
canViewCommercial
canManageCommercial

This list may grow as new project workflows are introduced.

---

# Organisation Isolation

Every organisation-owned record must include:

organisationId

Users must not access another organisation's data unless they are Platform Administration.

Names must not be used as security identity.

Use organisationId.

---

# Project Isolation

Project-owned top-level records must include:

organisationId
projectId

Access may be granted through:

organisation-wide permission

or:

active project membership

depending on the domain.

---

# Project Visibility

A user may read a project when one of the following applies:

Platform Administration

or:

active user
same organisation
and either:

canViewAllProjects

or:

active project membership

The numerical access level alone must not provide organisation-wide project visibility.

---

# Project Management

Project management requires:

Platform Administration

or:

active project membership with:

canManageProject = true

or an explicitly authorised organisation-level project-management capability introduced in future.

Organisation management may also receive broad project authority through explicit permissions.

---

# Commercial Security

Commercial access is independent from general project visibility.

Reading commercial data requires:

canViewCommercial

or:

canManageCommercial

at the appropriate organisation or project scope.

Managing commercial data requires:

canManageCommercial

A Health & Safety role must not gain commercial access merely because its access level is numerically above a Project Manager.

A Plant / Transport Manager must not gain commercial access merely because its access level is numerically high.

---

# Assurance Security

Assurance management requires:

organisation permission:

canManageAssurance

or:

project membership permission:

canManageAssurance

This allows safety professionals to operate across multiple projects without receiving unrelated authority.

---

# Plant and Transport Security

Future plant and transport modules should use:

canManagePlant
canManageTransport

and project assignment where appropriate.

Plant authority must not automatically provide general project Commercial or Assurance management. Restricted Plant cost viewing has the separate approved scope below.

---

# Organisation Administration

Organisation administration requires explicit permission:

canManageOrganisation

User administration requires:

canManageUsers

Project creation requires:

canCreateProjects

Do not infer these permissions solely from numeric level.

---

# Platform Administration

Level 99 is the deliberate platform-wide override.

Platform Administration may operate across organisations and domains.

---

# Default Deny

Firestore and Storage remain deny-by-default.

New collections must not receive broad access merely to speed up development.

---

# Hard Deletes

Normal operational records should generally use lifecycle state:

ACTIVE
CLOSED
ARCHIVED
CANCELLED
SUPERSEDED

Hard deletion remains strongly restricted.

---

# Audit

Audit/activity records should normally be immutable.

Do not silently rewrite or delete audit history.

---

# Storage

Canonical path:

organisations/{organisationId}/projects/{projectId}/documents/{category}/{documentId}/{fileName}

Cloud Storage authorization must follow the same functional permission model as Firestore.

Commercial files require commercial access.

Assurance files require appropriate project read access for viewing and assurance/project authority for upload.

Files are private by default.

---

# User Interface

UI hiding is not security.

Example:

A Site Manager may not see a Commercial navigation item.

Firestore and Storage rules must still independently reject unauthorised commercial access.

---

# Architecture Changes

Whenever a new permission domain is introduced:

1. define the business capability
2. add permission vocabulary
3. document scope
4. update Firestore rules
5. update Storage rules if required
6. update Admin role configuration
7. test positive and negative access cases

# Approved Delegation, Plant Costs and People Privacy (2026-09-19)

Possessing a permission does not authorise granting it. Use a fixed grant matrix initially, not a configurable role builder. Detailed grant combinations must be defined before enforcement.

Only Platform Administration may create/assign Level 99, assign platform-level roles, change a user organisation or administer across tenants. Organisation Manager may administer approved users/roles within their organisation, but cannot grant platform authority or transfer tenants. Project management cannot implicitly grant Commercial, Assurance or Plant-management powers. Treat role-code changes as authorisation changes as well as permission-map edits.

Restricted Plant costs (hire rates, supplier prices, repair/transport costs and exposure) are visible to Plant / Transport Manager, Organisation Manager, Platform Admin or explicitly authorised relevant Commercial/Plant cost users. Site Managers and H&S users do not receive costs automatically. This does not grant general project Commercial or Assurance management.

People availability/assignment/clash information is distinct from sensitive absence reasons/details. Exact permission vocabulary and the scoped matrix remain implementation-design work.

These are approved target contracts; current code/rules have not changed. See [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md).

# Controlled Evidence Direction

Approved maximum individual upload: 50 MB; enforcement pending. Match Storage paths to authorised metadata ownership/category, use new objects per revision, separate upload/review/cost viewing and retain accepted evidence until replacement upload/finalisation succeeds. Define recovery and finalisation verification before implementation.

The project path above remains the project-evidence direction. Unassigned Plant assets also need organisation/entity-scoped evidence; exact paths/references remain to be specified. Checked-in storage.rules currently denies all client access; this document does not describe deployed permissions.
