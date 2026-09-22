# NORMEX Role and Access Model

## Purpose

NORMEX uses four separate concepts for access control:

1. Access Level
2. Role Code
3. Permissions
4. Project Membership

These concepts must not be treated as interchangeable.

---

# Core Principle

Access Level = authority band

Role Code = organisational / operational function

Permissions = actual capabilities

Project Membership = where project-specific capability applies

A higher numerical access level must not automatically grant access to unrelated functional domains.

Example:

A Health & Safety Manager may have broad organisation-wide assurance visibility but must not automatically inherit commercial access.

A Plant / Transport Manager may have organisation-wide plant access but must not automatically gain project commercial control.

---

# Authority Bands

## Level 0

WORKER

Typical position:

Operative / Worker

Typical access:

- personal records
- assigned project information required for work
- permitted forms / inspections / acknowledgements
- own competency information where appropriate

---

## Level 1

SUPERVISOR

Typical access:

- assigned teams
- task / activity information
- permitted daily operational input
- basic project information
- raise actions / observations where permitted

---

## Level 2

SITE_MANAGER

Typical access:

- assigned project operational control
- daily project updates
- labour and plant position
- progress updates
- scope progress
- operational constraints
- actions
- project assurance interaction where permitted

Commercial financial access is not automatic.

---

## Level 3

PROJECT_MANAGER

Typical access:

- full management of assigned projects
- project setup
- scope management
- programme management
- governance
- project team
- project documents
- commercial access where permission is granted
- review site management inputs

Project Managers should normally be assigned to specific projects.

---

## Level 4

SENIOR_PROJECT_MANAGER

Typical access:

- multiple assigned projects
- senior project oversight
- programme review
- project management functions
- project commercial access where permitted
- PM performance / portfolio review

Organisation-wide access is not automatic unless explicitly granted.

---

## Level 4.5

HEALTH_SAFETY

Typical access:

- assurance visibility across permitted projects
- RAMS
- inspections
- actions
- observations
- incidents
- NCRs
- permits
- temporary works visibility
- safety reporting

Commercial financial access is not automatic.

---

## Level 4.6

SENIOR_HEALTH_SAFETY

Typical access:

- organisation-wide assurance leadership
- assurance standards
- assurance configuration where permitted
- escalation / closure of major assurance matters
- cross-project safety trends
- assurance reporting

Commercial financial access is not automatic.

---

## Level 5

CONTRACTS_MANAGER

Typical access:

- multiple / all projects depending organisation configuration
- programme oversight
- commercial oversight
- project appointments
- major project change
- project creation where permitted
- portfolio position

---

## Level 5.5

PLANT_TRANSPORT_MANAGER

Typical access:

- organisation-wide plant
- transport
- allocation
- plant availability
- plant compliance
- LOLER / PUWER
- defects
- transport planning
- project plant requirements

General project Commercial access is not automatic. Restricted Plant cost viewing is approved for this functional role; see the contract below.

---

## Level 6

ORGANISATION_MANAGER

Typical access:

- organisation-wide project visibility
- organisation administration
- projects
- people
- plant
- assurance
- commercial
- reports
- user administration where permitted
- project creation / archive

---

## Level 99

PLATFORM_ADMIN

NORMEX platform administration and platform override.

---

# Role Codes

Initial role codes:

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

The role list is extensible.

Do not create unnecessary decimal authority levels simply because a new job title appears.

Map real company job titles to the closest functional role and use permissions for differences.

---

# User Record

Recommended user structure:

users/{uid}

Example:

{
  displayName: "Example User",
  email: "example@example.com",

  organisationId: "colemans",

  accessLevel: 3,
  roleCode: "PROJECT_MANAGER",

  status: "ACTIVE",

  permissions: {
    canViewAllProjects: false,
    canCreateProjects: false,

    canManageOrganisation: false,
    canManageUsers: false,

    canManageAssurance: false,

    canViewCommercial: true,
    canManageCommercial: true,

    canManagePlant: false,
    canManageTransport: false
  }
}

---

# Permissions

Initial organisation-level permission vocabulary:

canViewAllProjects

canCreateProjects

canManageOrganisation

canManageUsers

canManageAssurance

canViewCommercial

canManageCommercial

canManagePlant

canManageTransport

This list may grow when genuine new functional domains are introduced.

Permissions must describe capabilities.

Do not use vague fields such as:

admin
specialAccess
fullAccess

unless the concept genuinely exists.

---

# Project Membership

Path:

projects/{projectId}/members/{uid}

Project membership defines where project-specific responsibilities apply.

Recommended structure:

{
  uid: "...",

  active: true,

  roleCode: "PROJECT_MANAGER",

  assignedFrom: ...,
  assignedUntil: ...,

  canManageProject: true,

  canUpdateOperations: true,
  canManageScopeProgress: true,

  canManageAssurance: false,

  canViewCommercial: true,
  canManageCommercial: true
}

Project membership permissions supplement the user's organisation-level permissions.

---

# Permission Examples

## Site Manager

Access Level:

2

Role Code:

SITE_MANAGER

Typical project membership:

canManageProject: false
canUpdateOperations: true
canManageScopeProgress: true
canManageAssurance: false
canViewCommercial: false
canManageCommercial: false

---

## Project Manager

Access Level:

3

Role Code:

PROJECT_MANAGER

Typical membership:

canManageProject: true
canUpdateOperations: true
canManageScopeProgress: true
canViewCommercial: true
canManageCommercial: true

---

## Health & Safety

Access Level:

4.5

Role Code:

HEALTH_SAFETY

Organisation permissions may include:

canViewAllProjects: true
canManageAssurance: true
canViewCommercial: false
canManageCommercial: false

---

## Plant / Transport Manager

Access Level:

5.5

Role Code:

PLANT_TRANSPORT_MANAGER

Organisation permissions may include:

canViewAllProjects: true
canManagePlant: true
canManageTransport: true
canViewCommercial: false
canManageCommercial: false

---

## Organisation Manager

Access Level:

6

Role Code:

ORGANISATION_MANAGER

Typical organisation permissions:

canViewAllProjects: true
canCreateProjects: true
canManageOrganisation: true
canManageUsers: true
canManageAssurance: true
canViewCommercial: true
canManageCommercial: true
canManagePlant: true
canManageTransport: true

---

# Security Principle

Access Level must not be used alone for domain access.

Bad:

currentLevel() >= 3 means commercial access

Reason:

HEALTH_SAFETY = 4.5 would incorrectly inherit commercial access.

Correct:

commercial access requires an explicit commercial permission or relevant project membership permission.

---

# Platform Administration

Level 99 remains an explicit platform override.

This is the only deliberate broad numerical override.

---

# Future Expansion

New organisational roles may be introduced without restructuring the entire authority model.

Preferred process:

1. determine functional role
2. select appropriate authority band
3. assign roleCode
4. define necessary permissions
5. define project membership requirements
6. update security architecture
7. update security rules
8. update Admin user-management UI

# Approved Delegation, Plant Costs and People Privacy (2026-09-19)

Possessing a permission does not authorise granting it. Use a fixed grant matrix initially, not a configurable role builder. Detailed grant combinations for the bounded profile/membership fix are recorded below.

Only Platform Administration may create/assign Level 99, assign platform-level roles, change a user organisation or administer across tenants. Organisation Manager may administer approved users/roles within their organisation, but cannot grant platform authority or transfer tenants. Project management cannot implicitly grant Commercial, Assurance or Plant-management powers. Treat role-code changes as authorisation changes as well as permission-map edits.

Restricted Plant costs (hire rates, supplier prices, repair/transport costs and exposure) are visible to Plant / Transport Manager, Organisation Manager, Platform Admin or explicitly authorised relevant Commercial/Plant cost users. Site Managers and H&S users do not receive costs automatically. This does not grant general project Commercial or Assurance management.

People availability/assignment/clash information is distinct from sensitive absence reasons/details. Exact permission vocabulary and the scoped matrix remain implementation-design work.

Cost/People privacy remain target contracts. The bounded authority implementation status is recorded below. See [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md).

# Canonical Authority Enforcement - Bounded Phase 0 (2026-09-19)

Implementation status: local rules and isolated tests added; no deployment or live
migration. Emulator execution is blocked by missing Java; security assertions are
not yet verified.

Canonical authority fields are organisationId, status, accessLevel, roleCode and
permissions. Role identifies function; explicit permissions grant capability;
membership defines project scope. Existing membership authority is accepted only
when its UID and role match the current canonical profile; stale grants are inert. A matching numeric band is a validation
requirement, not inheritance of unrelated domain capabilities.

Platform Admin requires ACTIVE, accessLevel 99 and roleCode PLATFORM_ADMIN.
Organisation Manager delegation requires ACTIVE, accessLevel 6,
roleCode ORGANISATION_MANAGER, canManageUsers true and canManageOrganisation true.
Both use a valid canonical profile. Invalid role/level pairs confer no authority.

Only Platform Admin can assign either administrative role, grant either
administrative permission, transfer organisation, modify administrative profiles
or delete user profiles. Tenant administration targets other eligible operational
users in the same organisation; it cannot change the actor's own authority.

## Fixed tenant grant ceilings

These are optional maximum grants, never automatic defaults. Omitted known
permission flags mean false; supplied flags must be booleans. Unknown permissions
are rejected. Platform Admin may explicitly authorise known-capability exceptions;
tenant administration cannot create an exception outside this table.

| Target role | Level | Grantable organisation permissions | Grantable project permissions |
|---|---:|---|---|
| WORKER | 0 | None | Ordinary membership |
| SUPERVISOR | 1 | None | canUpdateOperations, canManageScopeProgress |
| SITE_MANAGER | 2 | None | canUpdateOperations, canManageScopeProgress |
| PROJECT_MANAGER | 3 | None | canUpdateOperations, canManageScopeProgress, canManageProject, canViewCommercial, canManageCommercial |
| SENIOR_PROJECT_MANAGER | 4 | canViewAllProjects | Same project ceiling as PROJECT_MANAGER |
| HEALTH_SAFETY | 4.5 | None | canManageAssurance |
| SENIOR_HEALTH_SAFETY | 4.6 | canViewAllProjects, canManageAssurance | canManageAssurance |
| CONTRACTS_MANAGER | 5 | canViewAllProjects, canCreateProjects, canViewCommercial, canManageCommercial | Same project ceiling as PROJECT_MANAGER |
| PLANT_TRANSPORT_MANAGER | 5.5 | canViewAllProjects, canViewPlant, canRequestPlant, canManagePlant, canManageTransport | Ordinary membership; Plant management remains organisation-scoped |

Commercial management grants require Commercial viewing. Plant request/manage/
transport grants require explicit Plant viewing. Role changes must remove
incompatible permissions. Normal project roles cannot receive organisation-wide
Plant permissions from tenant administrators. HEALTH_SAFETY does not receive
organisation-wide Assurance from this grant matrix.

Project managers with existing scoped canManageProject may administer ordinary
membership, including eligible operations/progress flags. They cannot grant
canManageProject or specialist capabilities. Both previous and proposed membership
must be ordinary, preventing specialist reactivation, replacement and deletion/
recreation. Ordinary membership excludes specialist/admin roles and management/
Commercial/Assurance flags; its role must match the target user's canonical role.

Membership has an explicit field allowlist; unknown authority-like fields,
permissions maps, Plant-management flags and role overrides are rejected.
Target user, project and actor must have consistent tenant scope. Platform
administration also validates membership shape and target/project tenant ownership.

Tenant membership writes require an existing active eligible target profile.
Target authority must remain unchanged within the batch; combined role changes
and membership grants are intentionally split into separate operations.
Actor authority is read from existing canonical data and cannot be changed by
another write in a tenant-authorised batch.

## Profile updates and migration boundary

Active users may change only their own nonempty displayName (maximum 120
characters). Tenant administrators may update eligible users' displayName,
ACTIVE/INACTIVE status, allowed role/level/permission combinations and update
metadata. Identity, organisation and legacy fields are immutable to tenant actors.
Deactivation replaces tenant profile deletion.

New profiles use canonical fields. Existing role and workspaceAccess can remain
unchanged temporarily but are never Firestore authority fallbacks.
No canAccessContractorWorkspace permission is introduced.

Current frontend dependencies remain in js/auth.js, shared shell.js/roles.js,
Plant fleet.js/asset.js, and Project details.js; Documents consumes roles.js.
They require a separate coordinated frontend/data cutover. Inventory canonical
fields, conflicts, role-only profiles, status and permissions before deployment.
Existing numeric-only Platform Admins must be canonicalised first. Inventory
memberships for missing UID/role fields and stale role grants before deployment. No live
records were inspected or migrated in this task.

Existing Plant visibility/request numeric shortcuts and role-based Plant helper
behaviour remain outside this bounded write-delegation fix. They must not be
mistaken for completed project-scoped Plant access.

Test instructions: [isolated Firestore suite](../../.tests/firestore/README.md).
