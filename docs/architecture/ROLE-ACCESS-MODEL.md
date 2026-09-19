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

Commercial access is not automatic.

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