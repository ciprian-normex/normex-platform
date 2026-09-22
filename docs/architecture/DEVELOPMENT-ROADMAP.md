# NORMEX Development Roadmap

> Short-term active execution status is maintained in `/.normex/ROADMAP.md`.

## 1. Status and authoritative files

**Approved architecture direction; implementation pending separate approval.** Decision date: 2026-09-19. Product owner: repository owner.

The accepted architecture review is the baseline assessment, not a claim of implemented behaviour. This update authorises documentation only: no application/rule changes, deployment or data migration.

All authoritative documents remain in /docs/architecture/:

- [NORMEX-VISION.md](NORMEX-VISION.md): product direction.
- [AGENTS.MD](AGENTS.MD): working instructions.
- This roadmap: approved decisions, delivery order and gates.
- [ROLE-ACCESS-MODEL.md](ROLE-ACCESS-MODEL.md) and [SECURITY-MODEL.md](SECURITY-MODEL.md): access contracts.
- [NORMEX_PLANT_ARCHITECTURE_V1.md](NORMEX_PLANT_ARCHITECTURE_V1.md): Plant requirements.
- [DOCUMENT-MODEL.md](DOCUMENT-MODEL.md): evidence model.
- [PROJECT-DATA-MODEL.md](PROJECT-DATA-MODEL.md) and [SCHEMA-PATTERNS.md](SCHEMA-PATTERNS.md): canonical data patterns.
- [CHANGE-LOG.md](CHANGE-LOG.md): historical decisions, including explicitly superseded entries.

## 2. Approved architecture decisions

| ID | Decision | Status |
|---|---|---|
| AD-01 | Option A: tenant-prefixed internal Plant key; clean tenant-local business ID | Approved; inventory/compatibility required before implementation |
| AD-02 | Permission possession does not confer delegation; fixed grant matrix initially | Approved; detailed grant entries pending |
| AD-03 | Restricted Plant costs only for Plant / Transport Manager, Organisation Manager, Platform Admin or explicit relevant Commercial/Plant cost permission | Approved; exact permission mapping pending |
| AD-04 | Availability and sensitive absence details require distinct access | Approved; detailed access matrix pending |
| AD-05 | Maximum individual evidence upload: 50 MB | Approved architecture; enforcement pending |
| AD-06 | Eight loading states; missing/failed information never implies health | Approved; implementation pending |
| AD-07 | Asset-management lifecycle first; Requests follows | Approved sequence |
| AD-08 | Phase 0 limited to seven foundations; unrelated redevelopment does not block Plant | Approved scope |

No framework migration, configurable role builder or automatic legacy-data migration is included.

## 3. Phase 0 - Platform Foundation

| Workstream | Bounded outcome | Acceptance |
|---|---|---|
| Profile escalation | Protect platform authority, tenant ownership and active-account checks | Tenant administrators cannot promote themselves/others to platform authority or transfer tenants |
| Safe delegation | Fixed organisation/project grant matrix covering levels, roles and permissions | Legitimate grants succeed; unrelated specialist grants fail |
| Tenant context | Resolve organisation from authenticated identity and authorised configuration | Two tenants remain isolated; missing context is explicit; no silent Colemans fallback |
| Plant identifiers | Inventory existing keys/references; compatibility and allocation contract | Two tenants can each have HRE-0001; concurrency and absent-document bootstrap tested |
| Loading states | Apply first to Plant and affected existing People/Documents loaders | Denied/failed data never becomes empty success or health |
| Existing Firestore workflows | Scoped access for people, peopleCapabilities, peopleAssignments, peopleAbsences and documentRequirements | Intended roles succeed; tenant/reference/field validation and absence privacy enforced |
| Controlled evidence / Storage | Upload, revision, access and recovery architecture | Authorised evidence works; cross-tenant access and overwriting controlled revisions fail |

The collection is documentRequirements (plural). Match UI controls and queries to backend permissions; do not broaden access to make existing queries pass. Availability readers must not need private absence details.

Phase 0 excludes unrelated Project, Programme, Commercial, Operations, Reports and Admin redevelopment. Independent foundation workstreams need not serially delay Fleet once its own gates pass.

## 4. Plant identity contract - AD-01

Approved example:

~~~text
plantAssets/colemans__HRE-0001
organisationId: colemans
plantId: HRE-0001
plantReference: HRE-0001
~~~

The visible Plant ID remains HRE-0001. The prefix is internal. organisationId is stable, not the editable company name. Database key, organisation and business ID must agree and be protected on update.

Related deterministic keys follow the same principle, for example plantHireRecords/colemans__HIRE-HRE-0001-001, with clean business references. High-volume events need collision-safe identity; timestamps alone are not assumed unique.

Before identity implementation:

1. Inventory assets, counters, related keys, document links and URLs.
2. Define compatibility for random and unprefixed legacy keys.
3. Define explicit database-reference fields and document entityId semantics; plantId alone is not globally unique.
4. Define safe counter bootstrap, concurrent allocation and relation validation.
5. Approve migration separately. Do not rename, delete or rewrite existing records automatically.

Option A is approved. Exact reference-field names and a legacy migration are not approved implementations.

## 5. Loading-state contract - AD-06

| State | Meaning | Behaviour |
|---|---|---|
| LOADING | Current request pending | Suppress conclusions |
| LOADED_WITH_DATA | Authorised data loaded | Assess actual records; loading success is not safety |
| LOADED_EMPTY | Authorised query succeeded with no matches | Show no records; interpret missing evidence by domain |
| NOT_APPLICABLE | Explicit applicability decision excludes a control | Retain reason; never infer from failure/emptiness |
| NOT_ASSESSED | Relevant but no valid assessment | Never show green |
| PERMISSION_DENIED | Access not authorised | Show restricted/access failure without disclosing private information |
| UNAVAILABLE | Known temporary inability to establish current information | Offer retry; label retained data stale |
| ERROR | Unexpected failure, malformed data or processing error | Show failure and recovery guidance |

Keep loading state separate from business assessment. NOT_APPLICABLE and NOT_ASSESSED belong to assessed controls, not invented loader results. Each result carries scope, state, valid data when available, completeness, last successful load, freshness and reason/retry information.

**Platform-wide rule: missing, denied, unavailable or failed information must never become a healthy / safe / £0 / no-defect state.**

- Failed reads never return success-shaped empty arrays.
- Empty inspections mean no evidence, not passed inspection.
- Zero defects requires a successful sufficiently complete query.
- Healthy aggregates require all applicable mandatory inputs; known blockers stay visible if another input fails.
- Stale data is labelled and cannot silently support fresh readiness; clear incompatible data on tenant/user changes.
- Restricted financial information is a separate result and need not invalidate a complete operational assessment.

## 6. Authority / delegation contract - AD-02

Possessing a permission does not authorise granting it. Numeric level alone does not grant unrelated specialist capability.

| Actor | Approved delegation boundary |
|---|---|
| Platform Administration | Only actor that may create/assign Level 99, assign platform roles, change user organisation or administer across tenants |
| Organisation Manager | Approved users/roles within own organisation under the fixed grant matrix; no platform grants or tenant transfers |
| Project management | Authorised project functions; no implicit grants of Commercial, Assurance or Plant-management powers |
| Other capability holders | No delegation authority merely from possession |

Enumerate grantable combinations and protected fields before enforcement. Role-code changes are authorisation changes too. Test self-promotion, promotion of others, inactive actors, platform-profile modification, tenant transfer and multi-write escalation. A configurable role builder is deferred.

## 7. Cost visibility and People privacy - AD-03/04

Operational Plant data may be visible to relevant authorised project/operational roles. Restricted hire rates, supplier prices, repair costs, transport costs and exposure are visible only to:

- Plant / Transport Manager.
- Organisation Manager.
- Platform Admin.
- Users explicitly granted relevant Commercial/Plant cost permissions.

Site Managers and H&S users do not automatically receive financial access. Generic Plant-view, project or transport capabilities must not silently become cost grants. Plant cost viewing does not confer wider project Commercial or Assurance management. Exact permission mapping remains to be defined.

Restricted costs must not be placed in broadly readable operational documents or activity payloads. UI hiding is not security.

People permissions distinguish available/unavailable/assigned/project-clash information from sensitive absence reasons/details. Define scoped permissions and the operational data projection before enabling existing workflows.

## 8. Evidence / Storage direction - AD-05

Approved maximum individual evidence upload: **50 MB**. This replaces the 25 MB documentation / 100 MB application inconsistency. No application or Storage enforcement has changed. Confirm one exact byte threshold for both before implementation.

Firestore holds metadata; Storage holds files. Project evidence remains project-scoped; Plant evidence must support unassigned organisation-owned assets. Exact Plant paths and entity references follow the identity compatibility design; no path migration is authorised.

- Match Storage paths to authorised metadata ownership, entity and access category.
- Enforce size/type policy in UI and Storage; existing documented types remain PDF/JPEG/PNG.
- Separate upload, review and restricted-cost viewing authority.
- New revision means new object and metadata; preserve controlled history.
- Keep accepted evidence current until replacement upload/finalisation succeeds.
- Define pending/failed upload recovery, retries, finalisation verification and abandoned-upload handling.
- An arbitrary client-written completion flag is not sufficient proof of valid evidence.

Current checked-in storage.rules denies all client access. This is target architecture, not a statement that uploads work today.

## 9. Phase 1 - Plant Core Workflows

Approved asset-first order:

| Step | Workflow | Acceptance focus |
|---|---|---|
| 1 | Harden Fleet creation | Tenant-safe keys, concurrency, ordinary-role access, atomic asset/initial hire creation |
| 2 | Asset edit | Immutable identity and meaningful change history |
| 3 | Hire / rate updates and history | Effective-dated changes, prior terms retained, restricted costs |
| 4 | Minimal Plant evidence capability | Secure uploads, revision preservation and failure recovery |
| 5 | Location confirmation | Append-only confirmations; traceable current cache |
| 6 | Project assignment | Authorised commitment and dates, distinct from physical location |
| 7 | Movements | Planned versus completed movement; appropriate completion updates location |
| 8 | Defects | Safety/isolation, impact, owner and history |
| 9 | Repair / return to service | Authorised evidence-based release; other active restrictions remain |
| 10 | Plant Issues | Technical/non-technical blockers, owners and milestones |
| 11 | Release / off-hire / collection | Separate project release, supplier confirmation and physical collection |
| 12 | Plant Requests | Demand/fulfilment feeds the proven lifecycle |

Define minimal supplier identity and optional request linkage early. Requests can precede asset selection and involve multiple assets, although their UI follows the core lifecycle.

Acceptance scenario: create hired asset -> edit -> change rate with history -> attach evidence -> confirm location -> assign -> deliver -> defect -> repair/authorise return -> issue where appropriate -> release -> confirm off-hire -> collect. Then prove a Request feeds the lifecycle without duplicate canonical records.

Inspections belong in dedicated operational forms, not manual Asset-page creation. Introduce bounded inspection support before dependent safety claims without waiting for complete Operations/Assurance modules.

## 10. Phases 2-9

| Phase | Outcome | Exit criteria / dependencies |
|---|---|---|
| 2 - Plant Control / Intelligence | Availability, exposure, maintenance/compliance controls, inspection integration, supplier controls and actionable Overview | Build missing canonical inputs before summaries; evidence supports ready/compliant claims |
| 3 - Project Readiness Integration | Plant requirements, allocation, mobilisation and blockers | Explain Plant readiness and missing domain coverage; full readiness evolves with later domains |
| 4 - People / Rotas / Attendance | Competence evidence, allocation, shifts, clock events and attendance corrections | Compare planned work with actual attendance; preserve privacy |
| 5 - Operations | Coordination, deliveries, logistics, progress and daily reporting | Consume existing domain information rather than duplicate entry |
| 6 - Assurance | Canonical RAMS, permits, inspections, observations, incidents, NCRs and actions | Business records own state; documents are evidence; review/escalation enforced |
| 7 - Commercial | Canonical registers, variations, commitments, budgets and forecasts | Restricted commercial control integrates delivery without replacing accounting |
| 8 - Reports / Organisation Intelligence | Reports, closeout, history and trends | Authorised traceable outputs from canonical records |
| 9 - Admin / Multi-Tenant Productisation | Tenant onboarding, admin UI, branding/modules, support and integrations | Repeatable tenant onboarding/support; core tenant security already exists |

These phases are priorities, not permission to defer prerequisites. Basic isolation belongs in Phase 0, Plant evidence in Phase 1, and minimal inspections precede safety claims. Maintenance/compliance record creation must precede their dashboards. Phase 3 initially integrates Plant readiness, not every future domain.

## 11. Dependencies, release gates and validation

| Gate | Required before |
|---|---|
| Profile/delegation safeguards and tenant context | Extending persistent Plant workflows |
| Existing-record inventory and approved compatibility/reference contract | New Plant key allocation/reference implementation |
| Loading states and workflow-specific permission tests | Each Plant increment release |
| Safe project selection, ownership and readable project data | Assignment, project-linked Movements and Requests |
| Restricted cost boundaries | Writing/displaying costs to mixed operational audiences |
| Controlled Storage and reliable revision finalisation | Evidence-dependent workflows |
| Valid inspection/compliance inputs | Ready, safe or compliant assessments |

Full Project/Commercial collection migration is not a prerequisite. If Plant project access would expose confidential fields, make the narrow data/access correction before broadening access; do not require a full Commercial rebuild.

Existing People/documentRequirements access remains in Phase 0, but independent Fleet work may proceed after its own gates. Unsecured workflows remain explicitly unavailable, not falsely healthy.

Validate two tenants, Platform Admin, intended managers, lower operational roles and inactive users. Include concurrency, cross-tenant references, denied/empty/failed reads, cost privacy, upload failure and retained history. Level 99 success alone is insufficient.

## 12. Deferred work

- Broad refactors/file splitting or framework changes.
- Full legacy Project Scope/Commercial migration, Programme and lifecycle redevelopment.
- People/rota/attendance expansion beyond existing-workflow security.
- Dashboards before canonical inputs, advanced supplier analytics and AI.
- Configurable role builder and full Admin/productisation UI.
- Record migration until inventory, compatibility design and separate approval.

## 13. Next task - direction approved; coding not yet authorised

Prepare the detailed fixed grant matrix, then obtain implementation approval for the bounded profile/delegation security fix. Intended scope: necessary firestore.rules edits and an isolated emulator test harness. No Storage/application workflow changes, live-data migration or deployment in that task.

Acceptance: approved same-tenant administration succeeds; platform self/other promotion, tenant transfer, inactive-administrator writes and unauthorised specialist grants fail. Cover role-based escalation, platform-profile protection and malicious multi-write batches. Preserve own-profile reads and deliberate platform administration.

After that approval and applicable foundation gates, the first Plant coding task is Harden Fleet creation. Documentation approval is not coding approval.

## 14. Change history

| Date | Change |
|---|---|
| 2026-09-19 | Recorded owner-approved AD-01 to AD-08, bounded foundation, asset-first sequence, Phases 2-9 and release gates. No application/rule/data changes authorised or performed. |

## 15. Active product-build direction (approved 2026-09-20)

The owner has clarified the current phase: build and use the Plant workspace, submenu pages and functional workflows. Apply the permanent **Overview -> Domain page -> Record / Asset page** responsibility contract in [NORMEX_PLANT_ARCHITECTURE_V1.md](NORMEX_PLANT_ARCHITECTURE_V1.md), section 22. Overview aggregates and routes; domain pages own detailed control; records/assets own full information, authorised actions, evidence and history.

The older "Next task" entry in section 13 records its original foundation-task context. It does not prohibit subsequent explicitly approved UI work or require unrelated foundation work to delay local product design. Existing security, data-integrity and release gates remain applicable to affected persistent workflows.

Current bounded increment: document page responsibilities; finish Overview category toggle filtering, grouped expandable asset attention, restrained urgency treatment and known financial exception emphasis. Then stop Overview work. Recommend Fleet next because it is the current creation/register workflow and the foundation for Asset, Availability and the remaining domain drill-downs. Requests, Movements, Defects, Maintenance, Compliance and Suppliers remain product priorities; unavailable pages must not masquerade as working workflows.

### Verification proportional to the change

During active UI/design iteration: **BUILD -> VIEW -> ADJUST -> USE**.

For layout, CSS, composition, charts, cards, tables, labels, navigation, responsive layout, empty states and visual hierarchy, use syntax checks, browser-console/runtime checks, broken local link/import checks, obvious overflow/responsive checks and manual visual inspection. Do not automatically expand large automated suites, repeatedly run the whole Plant suite, or build dozens of fixtures for minor presentation changes.

Proper automated testing remains required for changes to security rules, tenant isolation, permissions, canonical writes, migrations, hire/financial calculations, ID allocation, uploads/storage, defect/maintenance transitions, assignment/movement state changes, return-to-service and shared business rules. Select tests relevant to the actual core-logic change; the UI iteration policy does not waive security or data integrity.

When a page/workflow is functionally stable: **TEST -> HARDEN -> COMMIT -> DEPLOY**, with separate authorisation for deployment. Add/refine stable workflow coverage then. Current work does not authorise deployment, live-data edits, rules changes or bypassing backend confidentiality.
