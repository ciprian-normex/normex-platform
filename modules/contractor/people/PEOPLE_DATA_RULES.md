# NORMEX PEOPLE - DATA & OWNERSHIP RULES

## Identity
Admin/Auth owns account identity.
People must reference the same user/person identity, not duplicate it.

## Projects
Projects come from the canonical Projects domain.
Rota/Resource Planning reference project IDs and may keep display-name snapshots.
Do not create a separate People project master.

## Person operational record
Expected eventual operational fields may include:
- uid/personId
- organisationId
- name
- employmentType
- position
- primaryTrade
- operational status
- induction summary
- qualification/competence summary
- current allocation summary

Inspect the live repository schema before implementation.

## Private data
DOB, home address and emergency/next-of-kin data require restricted access.

## Rota
A rota allocation represents a planned person/date/project or planned non-project state.

V1:
`WORK`, `HOLIDAY`, `UNAVAILABLE`

One primary planned allocation per person/date.

Moving a person on the same date replaces the previous draft allocation.

## Demand
Labour demand belongs to Resource Planning and references canonical projects.
It must not mutate person or project identity.

## Evidence
Qualifications, competence, training and induction evidence should preserve provenance, dates, expiry, uploader/verifier and history.
Self-upload does not equal verified.
