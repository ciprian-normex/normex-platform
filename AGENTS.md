# NORMEX Active Build Contract

## Normal task context

For normal implementation work, read this file, `.normex/CURRENT-STATUS.md`, the relevant local `AGENTS.md`, and the relevant `.normex` domain file. Read `.normex/ROADMAP.md` when sequencing matters. Read only the application files involved and shared dependencies that are genuinely needed.

Do not inspect the whole repository or reread `docs/architecture/` by default. Use deep architecture documents only for architecture, unclear canonical data, permissions, security, conflicting documents, or major cross-module decisions.

## Implementation mode

Read -> build -> open/check -> adjust -> report. Start clear work without a long planning essay. Stop only for a genuine blocker.

Keep normal tasks bounded to one workflow or page and its local files. Do not refactor unrelated modules, reorganise folders, rename unrelated files, introduce frameworks, or do speculative cleanup.

## Active build phase

NORMEX is building a useful, modern MVP. Prioritise useful workflows, clear page purpose, information hierarchy, professional UI, navigation, and correct core data interaction before deeper hardening.

For UI/layout work, use syntax and import checks, browser console and runtime checks, and desktop/mobile visual review where relevant. Avoid large fixture matrices, repeated full suites, and exhaustive transient-layout tests.

Use targeted testing for Firestore rules, tenant isolation, permissions, canonical writes, calculations, IDs, migrations, storage/uploads, destructive actions, critical transitions, and shared rules. A new write workflow needs important write-path and ownership checks.

## Product and application principles

Keep vanilla HTML/CSS/ES modules and Firebase. Preserve organisation multi-tenancy, canonical business records, module-local code, controlled financial visibility, and truthful unknown/error states. No framework migration without explicit approval.

Build calm, premium industrial operating software: clear hierarchy, useful density, obvious workflows, progressive disclosure and meaningful data views. Avoid card spam, decorative charts, repetitive content and generic administrative pages.

## Reporting

Report files changed, functionality added, deliberately deferred work, lightweight verification, and genuine blockers. Repository Markdown is project memory; conversation history is not.

## Approved UI ownership

When HTML/CSS are marked approved, treat their markup, styling, hierarchy and copy as product constraints. Do not redesign them or replace approved controls. Prefer JavaScript that populates and controls existing DOM, adding only minimal hooks when required. Codex owns integration, reads/writes, handlers, transitions, calculations, permissions, filtering and chart data; visual redesign requires explicit approval.
