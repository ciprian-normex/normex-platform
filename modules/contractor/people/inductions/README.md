# People Inductions

The Core Company Induction is a tenant-scoped People workflow. It reuses the legacy collections and preserves the proven video, assessment, certificate, tracker and reinduction behaviour while replacing the old compat SDK and Normacheck shell.

## Routes

- `/modules/contractor/people/inductions/` — protected overview
- `/modules/contractor/people/inductions/start/` — protected worker start
- `/modules/contractor/people/inductions/start/video.html` — protected video
- `/modules/contractor/people/inductions/start/test.html` — protected assessment
- `/modules/contractor/people/inductions/start/result.html` — protected result
- `/modules/contractor/people/inductions/tracker/` — protected management tracker
- `/modules/contractor/people/inductions/video-admin/` — protected video configuration
- `/modules/contractor/people/inductions/test-admin/` — protected test configuration
- `/modules/contractor/people/inductions/verification/` — protected certificate register
- `/modules/contractor/people/inductions/certificate/?id=NORMEX-00001` — public certificate
- `/modules/contractor/people/inductions/verify/?id=NORMEX-00001` — public exact-ID verification

## Data compatibility

Core records remain in `inductions`, `inductionRequests`, and `inductionSettings`. New certificate numbers use the atomic organisation counter `inductionCounters/{organisationId}` and an organisation-derived prefix; historical `NORMEX-*` records remain unchanged. New records add `organisationId`, `personId`, `linkedUserUid`, `inductionType: CORE_COMPANY`, a numeric sequence and bounded server-owned public search tokens. Organisation settings use `inductionSettings/{organisationId}` and fall back read-only to legacy `inductionSettings/live` until each tenant is configured.

Legacy induction rows without `organisationId` are not attributed to a tenant. They remain visible only in the Platform Administration tracker response and require an explicit migration decision. No production data is migrated by this implementation.

## Security boundary

Worker and manager operations use the `manageInductionWorkflow` callable in `europe-west2`. Question selection and scoring are server-side; ordinary workers never receive correct answers. The public `verifyInductionCertificate` callable supports exact certificate lookup and bounded name, company and sequence search, returning only `safeCertificate()` fields. New records use indexed prefix tokens; when no indexed result exists, compatibility search scans at most 500 legacy induction documents and still returns no more than 25 safe results. Browser access to all induction Firestore collections is denied.

Video files are stored beneath `inductionVideos/{organisationId}/...`. Storage writes require an active matching-tenant profile with `canManageAssurance`, or Platform Administration. Only video MIME types below 500 MB are accepted.

## Deferred migration utility

The legacy `import-existing.html` is deliberately not exposed. Legacy import needs a restricted, reviewed migration utility that assigns `organisationId` and stable person linkage explicitly; silently assigning old global records to a tenant would be unsafe.

The Personal Workspace onboarding gate is also deferred. The induction record and `people.inductionSummary` now support it, but the current platform has no canonical restricted-workspace auth state and this task does not invent one.
