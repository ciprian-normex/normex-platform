# NORMEX Plant Domain Architecture v1

**Status:** Locked working specification  
**Purpose:** Define exactly what the NORMEX Plant domain must control before further UI development  
**Scope:** Organisation-wide plant, hire, transport, defects, maintenance, compliance, availability, project impact and financial exposure

---

## 1. Core purpose

The Plant domain is not primarily an equipment register.

Its purpose is to answer, continuously:

1. What plant do we have?
2. Where is every asset physically located?
3. Is it in use, idle, available, reserved, in transit, under repair or off road?
4. What is each asset costing the business now?
5. Which hired assets are costing money without productive use?
6. Which projects are being delayed or stopped because of plant?
7. What repairs, parts, replacements, movements or sourcing actions are outstanding?
8. What is the next milestone for every serious plant issue?
9. Is each asset safe, inspected, maintained and compliant?
10. What is the complete history of each asset?
11. When does a hire period, assignment, service, certificate or project need end?
12. Is the current recorded location and deployment information still trustworthy?

The Plant / Transport Manager should be able to open NORMEX and understand the operational and financial plant position without manually checking multiple systems.

---

## 2. Top-level Plant navigation

Primary navigation:

- Overview
- Requests
- Fleet
- Availability
- Movements
- Defects
- Maintenance
- Compliance
- Suppliers

Secondary/direct pages:

- Asset workspace
- Hire Control

Hire remains important, but hired plant is still part of Fleet. Hire Control is a specialised financial and contractual view of hired / leased assets rather than a separate plant universe.

---

## 3. Plant Overview

The Overview is the Plant / Transport Manager control page.

It must prioritise:

### 3.1 Financial position

Examples:

- Active hire cost per day / week / month
- Idle hire exposure
- Breakdown / repair cost
- Transport committed cost
- Estimated downtime cost
- Current open plant cost exposure
- Hire periods ending soon
- Hire periods continuing beyond project need
- Projects requiring extensions beyond current hire dates

### 3.2 Project impact

The Overview must aggregate plant impact by project.

Example:

**JLR B Block**
- Plant assigned: 8
- Operational: 5
- Off road: 2
- Awaiting replacement: 1
- Estimated lost time: 18h
- Open plant cost exposure: £5,600

The page should answer which project is currently suffering most from plant issues.

### 3.3 Project stoppers

Examples:

- Required plant unavailable
- Critical plant off road
- Replacement not sourced
- Transport not arranged
- Required part delayed
- Abnormal-load / route approval outstanding
- Hire extension unresolved

### 3.4 Open plant issues and milestones

Each serious problem must have:

- issue
- linked plant if applicable
- linked project
- impact
- programme impact
- financial impact
- current position
- responsible person
- supplier
- next milestone
- next milestone date
- estimated return / resolution date
- last update

Example:

**Bobcat hydraulic failure**
- Project: JLR B Block
- Impact: reduced production
- Status: AWAITING_PART
- Next milestone: replacement pump delivery
- Due: 03 Oct
- Estimated return: 05 Oct

This requires a canonical `plantIssues` workflow.

---

## 4. Requests

Requests are the demand entering the Plant function.

Minimum request types:

- PLANT
- REPAIR
- TRANSPORT
- MATERIAL_TRANSPORT
- REPLACEMENT
- COLLECTION
- OTHER

### 4.1 Plant request

Capture:

- project
- requester
- plant type / required capability
- quantity
- specification
- required from
- required until
- reason
- criticality
- what happens if unavailable
- attachments / specification
- transport requirements

### 4.2 Repair request

Capture:

- asset
- project
- fault
- photos
- part number if known
- safe to use?
- isolated?
- project impact
- required response
- requested by
- requested date / time

### 4.3 Transport request

Capture:

- plant or material
- collection address
- delivery address
- project
- site contact
- booking / reference
- required date / time
- access instructions
- vehicle / transporter requirements
- route restrictions
- abnormal-load requirements
- height / width / weight limits
- delivery window
- offload arrangements
- banksman requirements
- other site access controls

Level 2+ should be able to raise appropriate requests.

Plant / Transport management controls fulfil, source, reject, clarify or partially fulfil.

---

## 5. Fleet

Fleet is the organisation-wide asset portfolio.

It must be visually and operationally split between:

### 5.1 Hired / leased plant

Priority because cost leaves the business immediately.

For each asset, surface:

- Plant ID
- type
- make / model
- supplier
- current project
- current location
- current operational state
- hire rate
- hire start
- expected off-hire
- idle state
- idle duration
- estimated idle cost
- compliance position
- open defects
- next movement
- last inspection

### 5.2 Owned plant

Surface:

- Plant ID
- type
- make / model
- current project
- current location
- current operational state
- utilisation
- maintenance due
- service position
- compliance
- open defects
- idle duration
- next movement

### 5.3 Fleet by type

Examples:

- Excavators
- High Reach Excavators
- Telehandlers
- Forklifts
- MEWPs
- Scissor Lifts
- Boom Lifts
- Dumpers
- Crushers
- Screening Plant
- Generators
- Attachments
- Other

Category cards should show:

- total
- deployed
- available
- off road
- hired / owned count where useful

### 5.4 Full Fleet Register

Retain a searchable register for administration and reporting, but it is secondary to the visual fleet view.

---

## 6. Asset identity and naming

Each asset receives a permanent NORMEX Plant ID.

Examples:

- HRE-0001
- EXC-0001
- TEL-0001
- FLT-0001
- MEW-0001

The Plant ID must never change.

### 6.1 Firestore document IDs - approved Option A

Approved 2026-09-19; implementation pending. Use internal database key plantAssets/colemans__HRE-0001 with organisationId colemans, plantId HRE-0001 and plantReference HRE-0001.

The visible Plant reference remains HRE-0001. Related deterministic keys follow the same principle, for example plantHireRecords/colemans__HIRE-HRE-0001-001, plantAssignments/colemans__ASN-HRE-0001-001 and plantMovements/colemans__MOV-HRE-0001-001. Defect, maintenance and issue keys follow the same tenant-safe principle; business references remain clean. High-volume inspection keys also require collision-safe event identity.

Inventory existing keys, counters, related references, document links and URLs before implementation. Define legacy compatibility and explicit database-reference fields. Do not migrate existing records yet. See [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md), section 4.

---

## 7. Asset workspace

The asset workspace is the complete history and current truth for one machine.

Example:

```text
HRE-0001
Hitachi ZX490
High Reach Excavator
```

### 7.1 Top asset identity

Always show:

- Plant ID
- make / model
- plant type
- current state
- current location
- current project
- ownership
- supplier
- current use
- next movement

### 7.2 Overview

The Overview should answer what is happening with this asset now.

Include:

- operational state
- current project
- current location
- current assignment
- last inspection
- open defects
- compliance position
- next service
- next movement
- active issue / milestone
- hire or ownership position

### 7.3 Financial position

Financial information should be high priority.

For hired plant:

- rate
- rate unit
- hire start
- expected off-hire
- current hire duration
- estimated current exposure
- delivery cost
- collection cost
- damage waiver
- idle days
- estimated idle exposure
- repair cost
- downtime cost where available

For owned plant:

- repair spend
- maintenance spend
- transport spend
- downtime
- lifecycle cost later

### 7.4 Location & Deployment

Assignments and movements are separate canonical records but should be presented together to the user as one coherent history.

The user should see:

- where the asset was
- where it moved from / to
- why it moved
- which project it served
- when it arrived
- when it left
- future commitments
- location confirmations

Example timeline:

```text
01 Aug - On hire at supplier depot
02 Aug - Moved to JLR Castle Bromwich
02 Aug - Assigned to B Block ASRS Strip Out
14 Sep - Location confirmed, still required
30 Sep - Planned release
01 Oct - Planned movement to Solihull
```

### 7.5 Inspection History

Inspection types may include:

- PRE_USE
- ON_HIRE
- OFF_HIRE
- FORMAL
- POST_REPAIR
- RETURN_TO_SERVICE
- CONDITION

Inspections remain permanently linked to the asset.

On-hire and off-hire condition records should support photographs.

This provides evidence if suppliers later raise damage charges.

### 7.6 Defect & Repair History

Track:

- fault
- defect type
- severity
- safe to use?
- isolation status
- reported by
- project
- engineer
- supplier
- parts
- part numbers
- repair status
- repair cost
- replacement plant cost
- transport cost
- downtime start
- downtime end
- total downtime
- root cause
- corrective action
- return-to-service evidence

Defect data should later support reliability analysis by model / supplier / asset type.

### 7.7 Maintenance History

Mainly important for owned plant, but also relevant to hired plant.

Track:

- maintenance type
- service interval
- meter / engine hours
- last service
- next service
- planned duration
- responsible party
- supplier / engineer
- parts
- cost
- evidence
- completed date
- return to service

### 7.8 Compliance

Compliance is a derived control position, not another document store.

Its job is to answer:

> Can this machine legitimately remain in service?

Possible relevant evidence:

- LOLER
- PUWER
- MOT
- insurance
- thorough examination
- conformity evidence
- manufacturer / statutory requirements

Derived status:

- COMPLIANT
- ATTENTION_SOON
- HOLD
- NOT_APPLICABLE where relevant

Actual files remain in Documents.

### 7.9 Documents

Documents are the evidence file for the asset.

Possible groups:

**Compliance**
- LOLER
- PUWER
- MOT
- insurance

**Hire**
- hire contract
- on-hire documents
- off-hire confirmation

**Condition**
- on-hire photos
- off-hire photos

**Repair**
- engineer reports
- parts receipts
- repair invoices

**Transport**
- delivery notes
- collection notes

**Commercial**
- invoices
- damage charges

**Manuals**
- operator manual
- manufacturer documentation

### 7.10 Hire / Cost history

One asset may have multiple hire periods over its lifetime.

Keep each hire record historically.

---

## 8. Location truth and stale-data control

NORMEX must not quietly display stale location information forever.

If an asset has remained recorded at the same project / location for a defined period, for example 30 days, NORMEX should ask for confirmation.

Example:

> HRE-0001 has been recorded at JLR Castle Bromwich for 30 days. Is this still correct?

Actions:

- YES, STILL HERE
- MOVE / REASSIGN
- NO LONGER REQUIRED

Confirmation creates a history event:

```text
14 Sep 2026
Location confirmed by <user>
Still required at JLR Castle Bromwich
Next review 14 Oct
```

This gives location data a confidence level.

---

## 9. Availability

Availability compares:

1. Project need
2. Plant assignment / commitment
3. Hire commitment
4. Operational condition

It should identify situations such as:

### Hire longer than project need

```text
Project requires until: 30 Sep
Hire booked until: 31 Oct
Potential unnecessary hire: 31 days
Estimated exposure: £7,750
```

### Project longer than hire

```text
Project requires until: 30 Nov
Hire ends: 30 Sep
Action: extension required
```

### Owned idle plant

```text
Available since: 01 Aug
Idle: 44 days
Future allocation: none
```

### Hired idle plant

```text
On hire
No productive assignment
Idle since: 10 Sep
Current idle exposure: £1,250
```

Availability should therefore be financial as well as operational.

---

## 10. Movements

Movements own physical transport history.

Track:

- plant
- from location
- to location
- project
- movement type
- planned date
- planned time
- actual date / time
- transport supplier
- driver
- vehicle registration
- transport cost
- booking reference
- status
- restrictions
- abnormal-load information
- route controls
- escort requirements
- access information
- delivery window
- offload requirements
- banksman controls

Movement statuses may include:

- PLANNED
- TRANSPORT_REQUESTED
- BOOKED
- READY_FOR_COLLECTION
- IN_TRANSIT
- DELIVERED
- CANCELLED

Movements are the physical location evidence used together with assignments.

---

## 11. Defects

Defects are the technical failure records.

Possible statuses:

- REPORTED
- TRIAGED
- AWAITING_ENGINEER
- AWAITING_PARTS
- REPAIR_IN_PROGRESS
- READY_FOR_TEST
- RETURNED_TO_SERVICE
- CLOSED

A defect can create or link to a Plant Issue when the problem has project / financial significance.

If `plantSafeToUse = false`, the asset should derive an OFF_ROAD control state throughout NORMEX.

---

## 12. Plant Issues

`plantIssues` is the operational exception-management layer.

It exists because not every plant problem is a defect.

Examples:

- required 50t excavator cannot be sourced
- machine awaiting a part for three weeks
- replacement not available
- transport blocked by permit
- hired machine idle but still costing money
- hire extension unresolved
- serious supplier delay

A Plant Issue should contain:

- organisationId
- projectId
- plantId if relevant
- requestId if relevant
- defectId if relevant
- movementId if relevant
- supplierId if relevant
- title
- description
- issue type
- impact level
- programme impact
- financial impact
- current position
- status
- responsible user
- next milestone
- next milestone date
- estimated resolution date
- created date
- updated date
- history / activity

Suggested statuses:

- OPEN
- SOURCING
- AWAITING_QUOTE
- AWAITING_PART
- AWAITING_ENGINEER
- AWAITING_APPROVAL
- REPAIR_IN_PROGRESS
- REPLACEMENT_ARRANGED
- RESOLVED
- CLOSED

The Overview should be largely driven by open Plant Issues.

---

## 13. Hire records

Hire information must not live only inside `plantAssets`.

Use `plantHireRecords` so one asset can retain multiple hire periods.

Track:

- plantId
- supplierId / supplier
- supplier asset reference
- hire contract reference
- hire start
- expected off-hire
- off-hire requested
- off-hire confirmed
- rate
- rate unit
- minimum hire period
- delivery charge
- collection charge
- damage waiver
- fuel basis
- supplier contact
- status

Possible rate units:

- DAY
- WEEK
- MONTH

Possible statuses:

- PLANNED
- ACTIVE
- OFF_HIRE_REQUESTED
- OFF_HIRED
- CANCELLED

---

## 14. Suppliers

Supplier records should eventually cover:

- hire suppliers
- repair suppliers
- transport suppliers
- parts suppliers

Track:

- supplier ID
- company
- account reference
- contact name
- phone
- email
- emergency contact
- service types
- transport capability
- notes
- active status

Future analytics may include:

- breakdown frequency by supplier
- replacement response time
- transport reliability
- average repair turnaround
- total spend
- damage disputes
- hire performance

---

## 15. Canonical Firestore collections

Primary Plant collections:

```text
plantAssets/{assetKey}
plantHireRecords/{hireId}
plantAssignments/{assignmentId}
plantMovements/{movementId}
plantRequests/{requestId}
plantIssues/{issueId}
plantInspections/{inspectionId}
plantDefects/{defectId}
plantMaintenance/{maintenanceId}
plantSuppliers/{supplierId}
documents/{documentId}
```

Possible later collections:

```text
plantMeterReadings
fuelRecords
logisticsRequests
resourceRequirements
plantActivity
```

---

## 16. Common audit fields

Where relevant:

```text
organisationId
projectId
plantId
createdByUid
createdByName
createdAt
updatedByUid
updatedAt
```

Names are display values only. IDs remain authoritative.

Organisation isolation is mandatory.

---

## 17. Derived vs canonical information

Do not duplicate truth unnecessarily.

### Canonical examples

- asset identity → `plantAssets`
- hire terms → `plantHireRecords`
- project deployment → `plantAssignments`
- physical movement → `plantMovements`
- defect lifecycle → `plantDefects`
- inspection evidence → `plantInspections`
- maintenance → `plantMaintenance`
- operational blocker → `plantIssues`
- file evidence → `documents`

### Derived examples

- current location
- idle
- in use
- availability
- next movement
- current hire exposure
- idle hire exposure
- compliance state
- project plant impact
- downtime totals
- repeat defect patterns

Cached fields can exist on `plantAssets` for fast display, but historical canonical records remain authoritative.

---

## 18. Alert philosophy

NORMEX should not turn neutral facts into alarms.

### HIGH / ACTION REQUIRED

Examples:

- project cannot continue because required plant is unavailable
- safety-critical defect
- deployed plant compliance expired
- machine unsafe to use
- replacement required
- transport not arranged and required date imminent
- plant double-booked
- inspection failed
- hire unresolved beyond required action date

### WATCH

Examples:

- certificate expires soon
- service approaching
- hired plant idle
- assignment ending
- hire period ending
- collection not confirmed
- location not reconfirmed
- transport restriction unresolved

### INFORMATION

Neutral operational facts belong in their relevant page and should not automatically create an alert.

---

## 19. Approved implementation order

The asset-management lifecycle comes first. See [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md) for foundation/release gates.

1. Harden Fleet creation
2. Asset edit
3. Hire / rate updates and history
4. Minimal Plant evidence capability
5. Location confirmation
6. Project assignment
7. Movements
8. Defects
9. Repair / return to service
10. Plant Issues
11. Release / off-hire / collection
12. Plant Requests

Requests feed the established lifecycle after it is reliable. Phase 2 control/intelligence consumes canonical inputs. Unrelated domain redevelopment must not block Plant.

## 20. First end-to-end workflow to prove the model

Create a hired asset, edit details, change its rate with history, attach evidence, confirm location, assign and deliver it. Report a defect, record repair and authorised return to service, link an issue where appropriate, then release, confirm off-hire and collect.

Verify ordinary-role permissions, retained history, restricted costs and honest unavailable/not-assessed states. Afterwards prove Requests feed this workflow without duplicate canonical records. Inspections remain operational forms, not manual Asset-page creation.

Restricted costs are visible only to Plant / Transport Manager, Organisation Manager, Platform Admin or explicitly authorised relevant Commercial/Plant cost users. Operational access does not imply financial access. Evidence limit: 50 MB per individual file (approved architecture; enforcement pending).

---

## 21. Locked product principle

The Plant domain should never become just a list of machines.

Its value comes from combining:

**asset + location + utilisation + project need + hire commitment + defects + maintenance + evidence + movement + financial impact + next action**

The core management question is:

> Do we have the right plant, compliant, available, transported and ready at the right project at the right time, and what is costing us money or threatening delivery unnecessarily?

## 22. Permanent page-responsibility hierarchy (approved 2026-09-20)

**Overview -> Domain page -> Record / Asset page** is the permanent Plant design principle.

- **Overview:** organisation-level summary, exceptions, financial pressure and navigation. It aggregates trustworthy loaded information and routes management to action.
- **Domain page:** the detailed control workspace for one Plant domain, with its own queue, filters and workflow controls.
- **Record / Asset page:** full information, authorised actions and editing, evidence and history for one record or asset.

The detailed capabilities listed earlier in this document are domain targets, not an instruction to reproduce them all on Overview. A summary cannot replace a canonical workflow. Assigned does not mean physically deployed. Missing evidence never establishes safety, readiness or compliance.

### Page responsibility contract

| Page | Primary management question | Information shown | Intended authorised actions | Intentionally not shown | Relationship to Overview and drill-down |
|---|---|---|---|---|---|
| Overview | What requires management attention across Plant? | Aggregate position, asset-centred exceptions, known financial pressure, project grouping and upcoming events | Filter/toggle loaded summaries, expand concerns, open the relevant working workspace, refresh | Full asset records, certificate matrices, detailed repair/service histories, duplicate data-entry workflows | Entry point: summary -> domain filtered to the concern -> record/asset -> action -> return and refresh |
| Fleet | What assets do we have and what is their current recorded position? | Searchable portfolio, ownership, type, state, assignment/location, explicit restrictions and authorised hire position | Create assets through the existing workflow, filter/search, open Asset; authorised edits through Asset | Full evidence matrices, complete event histories or an organisation action dashboard repeated inside the register | Overview position -> Fleet filter -> Asset -> update -> return |
| Requests | What Plant demand needs clarification, sourcing or fulfilment? | Demand, requester/project, required capability, dates, priority, fulfilment and linked records | Raise, clarify, source, approve/reject where authorised, partially fulfil and link to the established asset/assignment/movement lifecycle | Duplicate Fleet creation, fabricated stock/availability or replacement financial ledgers | Overview demand exception -> request queue -> request record -> fulfilment -> linked asset/workflow |
| Availability | What can be allocated, when, and what blocks its use? | Recorded operational restrictions, current/future assignments, overlapping commitments, idle position, location confidence and authorised hire implications | Filter by need/date/project, inspect conflicts, route to authorised assignment, release or movement actions | Unsupported ready/safe conclusions, physical deployment inferred from assignment, detailed repair histories | Overview available/idle/conflict -> Availability -> commitment/Asset -> resolve through the owning workflow |
| Movements | What must move, when, and what is preventing collection or delivery? | Planned/booked/in-transit movements, route/access controls, collection/delivery dates, owners and recorded completion | Plan/book transport, update progress, confirm collection/delivery with history and evidence where required | Assignment treated as proof of delivery, detailed defect/compliance histories, unauthorised transport costs | Overview upcoming/transport exception -> Movements filter -> movement record -> update -> Asset location/history |
| Defects | What Plant is defective/restricted, what is the repair position, and what action is required? | Open faults, recorded severity/isolation, engineer/parts position, responsible person, repair milestone and authorised costs | Triage, assign repair, update diagnosis/parts/progress, record evidence and route to authorised return-to-service | Automatically removing restrictions on closure, maintenance history unrelated to the fault, full portfolio duplication | Overview restriction -> Defects queue -> defect record/Asset -> repair and authorised return-to-service |
| Maintenance | What servicing is required, planned, overdue or completed? | Established service baseline, meter/interval evidence, due dates, bookings, owners and completion position | Establish/update an authorised schedule, plan/book service, record completion and evidence, apply authorised state transitions | Treating absent schedules as no maintenance due, unrelated defect histories or compliance certification | Overview due-service exception -> Maintenance queue -> service record/Asset -> complete and verify |
| Compliance | Can each asset legally/operationally remain in service, and what evidence supports that position? | Requirement/applicability and certificate/evidence matrix, assessments, explicit holds, verified dates and evidence gaps | Review requirements/evidence, route uploads through controlled Documents, record authorised assessments and hold decisions | Compliance inferred from missing records, a duplicate binary document store, invented expiry or legal conclusions | Overview count/status/explicit hold only -> Compliance matrix -> requirement/evidence/Asset -> assess and act |
| Suppliers | Who can supply, repair or transport Plant, and how do we contact them? | Supplier identity, services, contacts, active status and linked records; authorised financial data only | Maintain supplier details, select for owning workflows, inspect linked activity | Unsupported performance scores, a duplicate hire ledger, confidential prices for restricted roles | Overview supplier-related concern -> relevant domain record -> supplier details and linked activity |
| Asset | What is the complete current truth and history of this machine? | Permanent identity, assignment/location history, hire periods, defects, maintenance, inspections, evidence, issues and authorised costs | Authorised editing and lifecycle actions, evidence access, location confirmation, linked assignment/movement/repair/off-hire workflows | Organisation-wide dashboards, duplicate canonical event records, manual inspection creation outside its owning workflow | Domain record -> Asset -> act on the owning record -> retain history -> return to domain/Overview |

These are intended responsibilities, not claims that every page or action is implemented. Scope and permissions must be checked before each workflow is built. The Compliance matrix belongs to Compliance; Overview currently consumes explicit holds only and does not derive certificate expiry.

### Bounded Overview interaction and attention contract

- Fleet Position segment and legend clicks use the same toggle: select a category, click again for All Fleet, or select another category. Visually and accessibly identify the selected category. Filter existing lower tables; never create a duplicate asset section.
- Attention is one expandable management row per identified asset. Summarise overall urgency, primary issue, known impact, active concern count and next action. Retain unrelated/unlinked concerns separately rather than merging them into a fictitious asset.
- Expanded content shows individual concerns, recorded context/dates and actions with one asset identity. Preserve known blockers when another source fails.
- Blue means confirmation/data action. Amber means approaching/due soon. Dark amber means present commercial/operational pressure. Red requires an explicit restriction or supported material impact; uncertainty alone is never red.
- Combined overdue active hire, established non-assignment and missing location confirmation may justify red commercial-control urgency only with a known positive current commitment. This is not a statement of proven financial loss.
- Rank by known urgency, then known weekly commitment where cost access permits. Do not invent savings, lost production, avoidable-cost history or idle durations.
- Overdue off-hire financial emphasis means **current weekly commitment on hires past expected off-hire**. It is not a new estimate of charges since the planning date. Canonical hire calculations remain unchanged. Withhold totals when required inputs are incomplete or unknown.
- Operational Control Review must use a real domain page when implemented. Until then, use a clearly bounded expansion/filter of loaded Overview records or label the action unavailable. Never link to an empty page as though a workflow exists.

After these refinements, stop Overview iteration and prioritise detailed domain work. Fleet is the recommended next workspace: it is the existing creation/register route and provides the asset identity and drill-down foundation used by the remaining domains. Security-sensitive writes retain their release gates.
