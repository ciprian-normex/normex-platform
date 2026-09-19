# Firestore authority security tests

Status: isolated harness configured for the root production rules. Not deployed.

Before every npm test run, prepare-rules.mjs refreshes firestore.generated.rules
from ../../firestore.rules. Both the Firebase CLI and test SDK use that local copy.
The suite also checks that it exactly matches the root file before loading rules;
a missing or stale copy fails the run. The generated file is ignored by Git and
must never be maintained manually. The root file is the only rules source.

This isolated Node test package does not
use the application Firebase configuration, live records, an Admin SDK or a real
project ID. The Firebase CLI may check its public version configuration and download
the emulator binary. Only the local Firestore emulator is started.

## Prerequisites and execution

- Node.js 22 or later and npm.
- JDK 21 or later; java -version must work in the same terminal.
- Network access for npm dependencies and the emulator's initial download.

From the repository root in PowerShell:

~~~powershell
java -version
npm.cmd --prefix .tests/firestore ci --ignore-scripts --no-audit --no-fund
npm.cmd --prefix .tests/firestore run check
npm.cmd --prefix .tests/firestore test
~~~

The command selects demo-normex-security explicitly and binds Firestore to
127.0.0.1:8089. It refuses to run tests without that emulator host.
It does not deploy, migrate or use live credentials for test assertions.
The hidden directory is excluded by the existing Hosting configuration.

Tests run serially, reset synthetic fixtures between cases, and clean up SDK
contexts. Rules-disabled access is used only to seed emulator fixtures.
Negative assertions require permission-denied and reject explicit expression-limit,
document-access-limit, internal rule, type/property and setup errors. The suite also
checks emulator diagnostics for explicit rule-engine failures. Firebase can include
the generic wording "evaluation error" during partial evaluation of an otherwise
ordinary policy denial; that wording alone is not treated as an engine failure.
Explicit engine failures must never count as successful security denials.

## Coverage

All original 14 cases plus unknown authority fields, legacy aliases, workspace
escalation, creation of Organisation Managers, administrative permission grants,
and positive operational-role grants. Additional cases cover:

- Every approved tenant role ceiling and representative forbidden cross-domain grants.
- Canonical role/level mismatches, missing delegation flags and inactive administrators.
- Full replacement, deletion, malformed fields and dot-path permission updates.
- Explicit project Commercial grants and real scoped Commercial reads/writes.
- UID/role/tenant consistency, stale-role membership authority, inactive targets and absent profiles.
- Specialist reactivation, deletion/recreation and multi-write escalation.
- Atomic rejection, permitted multi-member batches, self displayName and existing reads.
- Platform administration and default deny.

A target profile's authority must be unchanged within a tenant membership batch.
Create/change the profile first, then assign membership in a separate operation.
This restriction prevents ambiguity about which role authorises a membership grant.
No current frontend membership writer depends on combined profile/membership writes.

## Verification

2026-09-19: after the bounded rule-efficiency refactor, root rules were refreshed,
compiled and tested by the emulator: **112 tests, 112 passed, 0 failed**. All 104
existing tests and their security expectations were retained. No expression-limit
or document-access-limit errors were found in the completed run.

Eight added tests cover authorised reads/queries, approved profile administration,
ordinary membership writes, scoped Commercial access, five-member batches and
atomic attack rejection, malformed actors, denial-helper error detection and
non-boolean permission values. Read checks now use resolved actor/scope maps;
deep shape and delegation validation remains on authority-changing writes.

The earlier harness-only run (77 passed / 27 failed) exposed the expression-limit
defect and is superseded by this result; the grant matrix was not redesigned.

The suite automatically records local, Git-ignored diagnostic artifacts:

- `rule-coverage.log`: final emulator rule coverage.
- `evaluation-samples.log`: before/after coverage for representative operations.
- `evaluation-summary.log`: coverage-node evaluation deltas for those operations.
- `firestore-debug.log`: emulator diagnostics, checked for explicit engine failures.

Profile creation, membership creation and authority updates are the most expensive
sampled individual paths. Ordinary reads and display-name updates use substantially
less validation. A five-target membership batch succeeds and a malicious batch is
rejected atomically. No document-access limit was reached in these cases.

Coverage deltas include multiple evaluator phases and are **not per-request budget
counters**. They cannot establish a precise remaining expression/access budget or
prove that arbitrary larger batches are safe. The simpler paths and successful
representative cases provide practical headroom evidence within the tested scope;
future write/batch expansion needs its own limit checks.

Run npm test for the current security results. Syntax checks alone do not validate
Firestore compilation or rule behaviour. A rule failure must be investigated
without weakening production rules to obtain a passing test.

## Production gates

Before any separately approved deployment: pass this suite; inventory and migrate
canonical user authority and membership UID/role consistency; coordinate removal of legacy frontend workspace/role
dependencies. New canonical-only profiles cannot yet enter the unchanged workspace
without its legacy workspaceAccess gate.

Existing Plant visibility/request level shortcuts were not changed by this task.
The fixed tenant grant ceiling does not grant broad Plant permissions to project
roles, but it is not a completed project-scoped Plant visibility implementation.
