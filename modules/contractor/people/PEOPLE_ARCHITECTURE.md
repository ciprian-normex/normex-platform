# NORMEX PEOPLE ARCHITECTURE - LOCKED BASELINE

> Codex: read this file before changing anything inside `modules/contractor/people/`.

People is the organisation's **operational workforce system**, not an HR filing cabinet.

## Questions People must answer

1. Who do we have?
2. What work needs people?
3. Who is available?
4. Where should people go?
5. Are they ready and competent to work?
6. Who is unavailable, and why?
7. What needs management attention?
8. What changed, and later, what actually happened compared with the plan?

## Approved management-side structure

```text
People
├── Overview                         // build last
├── Resource Planning
│   ├── Workforce Position
│   ├── Project Allocation
│   ├── Workforce Availability
│   ├── Labour Demand
│   └── Workforce Forecast
├── My Team
│   ├── Team
│   └── Rota
├── Inductions
│   ├── Start Induction
│   ├── Induction Tracker
│   ├── Video Admin
│   ├── Test / Questions Admin
│   └── Verification / Certificates
└── Person Workspace
    ├── Overview
    ├── Profile
    ├── Qualifications
    ├── Competence
    ├── Training
    ├── Inductions
    └── History
```

`Person Workspace` is the canonical management view of one person. It does not have to be a top-nav item.

## Personal Workspace is separate

Worker-facing self-service will be built separately under a future `modules/contractor/my/` area.

Expected worker experience:

```text
My Workspace
├── Home
├── My Profile
├── My Rota
├── My Qualifications
└── My Inductions
```

Management People and worker My Workspace use the same canonical data but have different permissions and UX.

## Admin vs People

Admin owns:
- account invitation/creation
- account lifecycle `INVITED`, `ACTIVE`, `INACTIVE`
- basic identity
- employment type
- internal authority

People owns/consumes:
- operational workforce profile
- primary trade
- inductions
- qualifications
- competence
- training
- rota/allocation
- workforce availability
- team visibility

Employment types:
`EMPLOYEE`, `AGENCY`, `SUBCONTRACTOR`

## Person model

A person has one useful primary trade for identification/filtering, but may hold many qualifications, competencies and machinery tickets.

Example:
Tom Smith
Primary trade: Burner
Capabilities: Burner, Slinger, Banksman, MEWP

Do not force a daily role into the rota.

## Resource Planning

Resource Planning is broader than a workforce directory.

It answers:
- how many active people do we have?
- where are they deployed?
- who is available?
- who is on holiday/unavailable?
- which projects are under/over-resourced?
- what workforce does upcoming work require?
- can the organisation cover upcoming demand?

### Labour Demand

Future project demand is an approved concept.

Example:
CB next week
Required: 18
Allocated: 15
Gap: 3

V1 does not need trade-by-trade demand unless later requested.

## My Team

Primary operational audience:
- Site Supervisors
- Site Managers
- authorised Project Managers

Project Managers may edit where authorised, but day-to-day control is expected mainly with site supervision/management.

My Team answers:
- who is in my team?
- who is coming this week?
- is everybody inducted?
- are there qualification/training warnings?
- can I open the relevant Person Workspace?
- what is the team rota?

## Rota

Approved UX:
- projects are horizontal rows
- days are columns
- people remain in a workforce source/sidebar
- person cards can be colour coded by primary trade
- trade text remains visible

One person may have only one primary planned rota position per date.

Dragging Tom from Monday/CB to Monday/Solihull **moves** the draft allocation. No duplicate remains.

V1 planned allocation types:
`WORK`, `HOLIDAY`, `UNAVAILABLE`

Do not confuse planned rota with actual attendance such as sick/no-show.

### Draft / Publish

Rota changes are edited as `DRAFT`.
Workers continue seeing the latest `PUBLISHED` rota.
Only Publish makes changes operationally visible.
Prefer preserving published version history.

## Inductions

Induction is a managed workflow, not merely a certificate field.

Subfunctions:
- Start Induction
- Induction Tracker
- Video Admin
- Test / Questions Admin
- Verification / Certificates

The first compulsory onboarding induction is **Core Company Induction** only.

It is not tied to project/site/client/work area.

Expected onboarding:
Admin invite → account setup → core induction check → induction only → video → assessment → pass → certificate → induction record → normal personal workspace unlocked.

Reuse the existing standalone induction logic/files where appropriate instead of rebuilding blindly.

Do not ask the user to re-enter known account information.

## Qualifications / competence / training

These belong against the Person Workspace rather than being separate top-level organisation menus.

A worker may self-upload evidence later, but self-upload is not automatically trusted.

Useful evidence lifecycle:
`UPLOADED`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `EXPIRED`

Record source such as `SELF_UPLOAD` or `MANAGER_UPLOAD` and verifier information.

## Private personal data

DOB, home address and emergency/next-of-kin details require more restricted access than normal operational workforce data.

Do not expose them broadly in Workforce or ordinary supervisor views.

## People Overview

Build last.

It should answer:
**What workforce issues need management attention now?**

Potential future attention:
- induction outstanding
- qualification expiring
- pending qualification review
- people unallocated
- project workforce gap
- holiday affecting allocation
- future readiness warning

## Planned vs actual

Never overwrite the published plan with actual attendance.

Future:
Planned = JLR CB
Actual = Sick

Those are separate truths.

## Implementation discipline

Before changing any People page:
1. Read all top-level markdown files in `/people`.
2. Inspect current contractor shell/navigation/auth.
3. Inspect canonical user/person/project schemas.
4. Reuse tenant/permission logic.
5. Do not invent duplicate collections casually.
6. Keep page-specific HTML/CSS/JS inside its folder.
7. Do not hard-code demo production data.
8. Preserve organisation isolation.
9. Use truthful loading/error/permission states.
10. Browser/runtime test functional integrations.

Each page is built separately:
product rules → HTML/CSS → small UI JS → bounded Codex integration → runtime test → stabilise → next page.
