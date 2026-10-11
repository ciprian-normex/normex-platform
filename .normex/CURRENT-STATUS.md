# NORMEX Current Status

## Active domain

Plant

## Stable for this phase

- Plant Overview
- Fleet
- Plant navigation
- Canonical Plant hire calculations
- Plant architecture direction
- Plant access-model foundation

Do not redesign Overview or Fleet unless a later workflow exposes a real requirement.

## Current work

Asset operational workflows. Asset Edit is implemented locally and is the active write workflow pending normal review/hand-off.

Plant Requests now has a local end-to-end MVP integration: project-scoped intake, drafts/submission, multi-item review, derived parent status, attention/register views and canonical maintenance, movement, assignment and hire handoffs. Focused model and Firestore request tests pass. Authenticated browser verification remains pending because no browser session was available during the integration pass.

Plant Availability now has a local read-only end-to-end MVP integration: organisation-wide manager scope, project-scoped normal-user reads, a shared derived availability model, functional planning horizons, summaries, outlook, ready-to-allocate view, register filters and asset drawer. Dependency failures remain explicit instead of becoming false availability. Focused model tests pass; authenticated desktop/mobile browser verification remains pending because no browser session was available during the integration pass.

Organisation Admin now has a local end-to-end account-administration implementation backed by a Firebase callable function: invitation, canonical profile and minimal People creation, strict below-own-level authority management, duplicate-account handling, edit, resend, deactivate/reactivate, authenticated invitation activation and backend audit. The callable has an explicit local/Firebase Hosting CORS allowlist and safe client error mapping. Focused backend and Firestore security tests pass. The current Firestore rules were deployed with the People Rota authority release on 2026-10-10; Functions and Hosting remain undeployed. The project Cloud Functions API is currently disabled/uninitialised, so `manageUserAccount` does not yet exist in the cloud and authenticated browser verification remains pending.

People Inductions now has a local end-to-end Core Company Induction implementation migrated from the legacy module. It reuses `inductions`, `inductionRequests`, `inductionSettings` and `counters/inductions`; adds tenant/person linkage to new writes; and provides the protected worker journey, tracker, video and question administration, certificate register, plus public exact-ID certificate and verification routes. Assessment generation/scoring is server-side, direct Firestore client access is denied, and Storage uploads are tenant/permission scoped. Function/model and Firestore emulator security tests pass. The current Firestore rules were deployed with the People Rota authority release on 2026-10-10; Functions, Hosting, Storage rules and production data changes remain undeployed. Authenticated browser and full callable/Storage runtime verification remain pending because no browser session was available.

People Rota now has one authoritative deployed Firestore rules section for `peopleRotaWeeks`, `peopleRotaVersions` and `peopleRotaEntries`. ACTIVE same-organisation users can read published Rota data, ACTIVE level 3+ users and level 99 can publish within their own organisation, BUILDING versions may only promote to PUBLISHED, and entries remain immutable. Twenty focused emulator tests pass. Manual browser publication/reload verification remains pending.

## Immediate objective

Complete the Plant module and all Plant submenu workspaces to a useful MVP level.

## Testing mode

UI/layout: lightweight. Writes/business logic: targeted. Security: properly tested. Full hardening is deferred until Plant and the wider MVP are substantially complete.

## Deferred

- Final Plant ID migration, if still required
- Storage evidence hardening
- Server-side pagination
- Broader security hardening
- Legacy authority cleanup
