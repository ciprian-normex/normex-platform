# NORMEX Platform Vision

## 1. Product identity

NORMEX is intended to become a multi-tenant organisation and project operating platform for construction, demolition, engineering, industrial and contractor businesses.

It is not simply:

- a health and safety system
- a forms platform
- a RAMS register
- a plant register
- a document repository
- a project dashboard
- a rota system
- an attendance system
- a timesheet system

Those are individual capabilities.

The real purpose of NORMEX is to connect the operational parts of a contractor's business so management can understand whether projects and the organisation are genuinely under control.

The central questions NORMEX should help answer are:

- Can we start?
- Are we ready?
- Are we safe and compliant?
- Do we have the right people?
- Do we have the right plant and resources?
- Are the rotas covered?
- Who was expected to work?
- Who actually clocked in?
- Are we on programme?
- Are we on cost?
- What is blocking delivery?
- What needs action today?
- Who owns each problem?
- What is the programme impact?
- What is the financial impact?
- What evidence supports the current position?
- What happened on previous projects?
- What should we learn for the next one?

The long-term product proposition is:

> NORMEX gives contractors one operating workspace for projects, people, plant, operations, assurance, programme and commercial control.

A manager should be able to open NORMEX and quickly understand:

> Can we start?

> Are we under control?

> What is wrong?

> Who owns it?

> What is it costing us?

> What decision needs to be made?

---

# 2. Organisation-first architecture

NORMEX is built around an organisation.

An organisation owns its:

- users
- projects
- people
- plant
- suppliers
- operations
- commercial information
- assurance information
- reports
- configuration
- branding
- enabled modules

Conceptually:

```text
NORMEX
│
└── ORGANISATION
    │
    ├── Home
    ├── Projects
    ├── Operations
    ├── People
    ├── Plant
    ├── Assurance
    ├── Commercial
    ├── Reports
    ├── Admin
    └── Support Tickets


    Projects are the main operational context, but Projects should not physically own all business information.

Examples:

A qualification belongs to a person.

A LOLER certificate belongs to a plant asset.

A plant hire record belongs to Plant.

A quotation belongs to Commercial.

An inspection belongs to the process that created it.

A document is evidence attached to a business object.

The project references and consumes those records.

This principle is important:

Projects orchestrate the business, but the underlying domains retain ownership of their canonical information.

3. Multi-tenant SaaS model

NORMEX should operate as one common software product supporting many separate organisations.

Example:

NORMEX PLATFORM
│
├── Organisation A
│   ├── branding
│   ├── users
│   ├── projects
│   ├── plant
│   ├── people
│   └── data
│
├── Organisation B
│   ├── branding
│   ├── users
│   ├── projects
│   └── data
│
└── Organisation C
    ├── branding
    ├── users
    └── data

Each tenant must have strong data isolation.

A user from one organisation must never be able to access another organisation's private data unless a specific controlled sharing mechanism has explicitly granted access.

Organisation isolation must be enforced by backend security rules, not only by hiding UI elements.

4. Support different organisation sizes

NORMEX should not assume every customer is a large Principal Contractor.

A small contractor may need only:

projects
people
rotas
clock-ins
basic assurance
documents
basic commercial records
reports

A medium contractor may need:

multiple projects
project readiness
workforce planning
competence management
plant
transport
assurance
programme
commercial
attendance
reports

A larger contractor may need:

multi-project portfolio control
project readiness
detailed workforce planning
plant and transport
hire cost control
programme
assurance
commercial
supplier management
resource planning
requisitions
cross-project reporting
organisation intelligence
external sharing

A major organisation may additionally need:

multiple business units
regional management
project portfolios
approval hierarchies
client visibility
integrations
deeper analytics

The platform should therefore be modular.

Not every organisation needs every feature enabled.

The same NORMEX core should support different operational depth without creating separate products.

5. Tenant branding and workspace identity

Each organisation should be able to have its own workspace identity.

Possible organisation configuration:

organisation name
logo
primary colour
secondary colour
workspace theme
terminology
enabled modules
organisation-specific settings

Colemans branding is currently being used as the pilot theme.

Branding must remain presentation only.

The underlying application should remain organisation-agnostic.

The long-term product should not contain Colemans-specific business logic.

6. Projects are the operational centre

Projects should exist throughout their lifecycle, not only after work begins.

A possible project lifecycle is:

OPPORTUNITY
↓
RFQ / TENDER
↓
AWARDED
↓
PRE-CONSTRUCTION
↓
MOBILISATION
↓
LIVE
↓
ON HOLD
↓
COMPLETION
↓
CLOSEOUT
↓
ARCHIVED

A project may contain:

client
site
project team
project roles
scope
phases
work packages
programme
people requirements
plant requirements
assurance requirements
commercial position
operational activity
documents
changes
actions
decisions
reports
closeout information
7. Project roles and contractor duties

NORMEX must not assume that an organisation always performs one CDM role.

An organisation may be:

Principal Contractor
Contractor
specialist subcontractor
multiple roles on the same project

Projects should therefore support:

rolesOnProject[]

rather than hard-coding one organisation role.

The workspace can then adapt relevant controls based on:

organisation role
project scope
project stage
user role
contractual duties
statutory duties
client requirements

CDM role should influence workflows but should not fragment the product into separate unrelated systems.

8. Project readiness

Project Readiness is one of the defining NORMEX capabilities.

Before mobilisation, NORMEX should answer:

Can this project actually start?

Readiness should derive from real domain information.

People
required workforce
available workforce
supervisors
competency
qualifications
training
project induction
site requirements
rota coverage
Plant
required plant
allocation
availability
compliance
transport
defects
maintenance
hire availability
Assurance
RAMS
CPP where applicable
permits
inspections
legal requirements
client requirements
required evidence
Programme
planned mobilisation
dependencies
work sequence
predecessor activities
resource availability
Commercial
accepted quotation
approved scope
purchase requirements
supplier commitments
approved expenditure
Resources
PPE
specialist equipment
tools
materials
consumables

NORMEX should derive a position such as:

READY
AT RISK
BLOCKED

and explain why.

Example:

PROJECT READINESS

BLOCKED

Critical blockers

• RAMS approval outstanding
• High reach excavator unavailable
• Supervisor qualification expires before mobilisation

Warnings

• Permit request not submitted
• Insurance expires in 21 days

The system must explain the position rather than showing only a coloured status.

9. Scope control

Original project scope should remain historically visible.

Scope records may include:

scope description
quantity
location
package
responsible team
planned start
planned finish
status
project phase
evidence
progress

NORMEX should make it possible to distinguish:

original contractual scope

from:

additional requested work

This distinction becomes important for programme and commercial control.

10. Change and variation control

Changes should not disappear into emails or verbal conversations.

A project change should be capable of recording:

requested change
requester
date
original scope relationship
reason
commercial impact
programme impact
labour impact
plant impact
approval position
quotation
supporting evidence
final decision

Example:

Original completion:
30 October

Additional demolition:
Requested by Client Engineer

Programme impact:
+5 working days

Approved revised completion:
6 November

NORMEX should then understand that the project is not simply five days late.

The approved programme has changed.

11. Programme

Programme should become a real control function.

A project may have several programme perspectives:

client programme
contractual programme
internal delivery programme
current forecast

Example:

Internal estimate       3 weeks
Committed programme     4 weeks
Client allowance        5 weeks
Current forecast        3 weeks + 2 days

Visibility must be controlled.

Internal programme intelligence is not automatically information that should be shared with a client.

Programme should eventually connect to:

actual progress
scope
workforce
plant availability
delays
variations
dependencies
project issues
12. Operations

Operations represents the daily running of work.

This domain should eventually support:

daily site coordination
shift activity
work areas
progress updates
workforce position
plant position
deliveries
logistics
briefings
daily reports
site controls
attendance
operational observations
temporary restrictions
upcoming requirements

Operations is where planning becomes actual site activity.

13. Rotas

Rotas should become a proper operational capability, not a spreadsheet attached to the system.

NORMEX should support organisation and project rotas.

A rota should help answer:

who should be working?
on what project?
on what shift?
in what role?
under which supervisor?
what hours are expected?
are there gaps?
are there clashes?
is somebody booked on two projects?
do we have enough competent people for the shift?

Possible rota information:

person
project
project area
role
shift
scheduled start
scheduled finish
supervisor
status
notes

The People and Projects domains should consume rota information.

Example:

B Block Monday Shift

Required:
8 operatives

Rota:
7 confirmed

Gap:
1 excavator operator

Rota gaps should contribute to project readiness and operational attention.

14. Attendance and clock-ins

Attendance should connect planned work with actual attendance.

NORMEX should support:

clock in
clock out
attendance kiosk
QR access where appropriate
keypad/PIN workflows where appropriate
project attendance
site attendance
work area grouping
live roll call
emergency roll call
late / absent visibility
actual hours where appropriate

The long-term organisation model should connect:

ROTA
what was planned

↓

CLOCK-IN
who actually arrived

↓

ATTENDANCE
who is currently present

↓

REPORT
what actually happened

Example:

Planned workforce:
28

Clocked in:
24

Missing:
4

Shift position:
AT RISK

Attendance should not automatically become payroll.

It may later support timesheets or payroll integrations.

15. Timesheets and working hours

Where enabled, NORMEX may support:

expected shift hours
clock-in hours
submitted hours
approved hours
project allocation
overtime
weekend working
exceptions

But NORMEX should not attempt to become a full payroll engine.

Its role is to establish reliable operational and project labour information.

Payroll/accounting systems can consume approved data through future integrations.

16. People

People must be more than a competency register.

Each person should have a meaningful organisational profile.

Identity
name
contact information
employer
employment/subcontract relationship
trade
organisational role
status
Competence
qualifications
tickets
training
experience
expiry
restrictions
Availability
rota
project allocation
holiday
absence
availability
mobilisation conflicts
Project readiness

NORMEX should answer questions such as:

We need six people on Monday.

Two must be excavator operators.

One must be a supervisor.

One must hold First Aid.

Do we actually have them?

History

The organisation should retain useful project history:

projects worked
roles
competency
briefings
inductions
training
attendance where appropriate
17. Operative experience

Level 0 / operative users should not be shown a management ERP-style workspace.

Their interface should be simple.

Possible experience:

My Work
My Rota
Clock In / Out
My Qualifications
My Project
Forms
Requests
My Account

They may need to:

view upcoming rota
see project/site allocation
clock in/out
complete inspection forms
report defects
report observations
upload evidence
request PPE/tools
see relevant documents/briefings
review qualifications
complete project onboarding

Complex management information should remain outside their interface.

18. Organisation onboarding

NORMEX should separate organisation identity from project onboarding.

Organisation onboarding

Example:

Account invited
↓
Password setup
↓
Personal profile
↓
Employment/trade details
↓
Qualifications
↓
Organisation requirements
↓
Account active

The person now exists in the organisation.

Project onboarding

When allocated to a project:

Project assignment
↓
Project induction
↓
Site requirements
↓
Relevant briefing
↓
Required evidence
↓
Project-ready

This avoids repeatedly treating the same worker as a completely new person for every site.

19. Plant

Plant should operate as a proper Plant / Transport control system.

Its primary management question is:

Do we have the right plant, compliant, available, transported and ready at the right project at the right time, and what is costing us money unnecessarily?

Plant must support:

owned fleet
hired fleet
leased/cross-hired fleet
asset identity
availability
allocation
hire
location
transport
defects
repairs
downtime
maintenance
inspections
compliance
suppliers
documents
project impact
financial exposure

Plant IDs should be permanent and readable.

Examples:

HRE-0001
EXC-0001
TEL-0001
MEW-0001
20. Plant financial control

Plant is not only an asset register.

Hired plant immediately creates financial exposure.

NORMEX should eventually show:

active hire cost
weekly hire commitment
idle hire exposure
delivery cost
collection cost
repair cost
replacement cost
transport cost
downtime
expected off-hire
project need versus hire period

Example:

Project needs asset until:
30 September

Hire continues until:
31 October

Potential unnecessary hire:
31 days

Estimated exposure:
£7,750

That is a meaningful management alert.

21. Plant asset workspace

A Plant Asset page should represent the complete current and historical truth for one machine.

It should help answer:

what is this asset?
who owns it?
who supplied it?
where is it?
what project is it assigned to?
is it in use?
is it idle?
is it off road?
what is it costing?
when is it due off hire?
what inspections have been completed?
what defects exist?
what repairs have been completed?
what maintenance is due?
what compliance evidence exists?
what documents are linked?
what is the next action?

The asset page should support live operational updates including:

Edit Asset
Update Hire / Price
Update Location / Deployment
Report Defect
Update Repair
Upload Document
Add / Update Plant Issue

The permanent Plant ID must remain immutable.

22. Plant issues and milestones

Plant requires an exception-management layer.

Not every Plant problem is a defect.

Examples:

required excavator cannot be sourced
replacement unavailable
machine broken down
part delayed
transport unavailable
abnormal-load approval outstanding
hired machine idle
off-hire unresolved

Each Plant Issue should support:

issue
project
plant
impact
programme impact
financial impact
current position
responsible person
supplier
next milestone
milestone date
estimated resolution
status
history

This feeds the Plant Overview.

23. Plant location

Plant location must not be a permanent free-text field with no history.

NORMEX should understand:

current location
current project
current assignment
last confirmed location
planned movement
completed movement
release
reassignment

Current location may be cached on the asset for fast display.

Movement and assignment records remain the authoritative history.

NORMEX should eventually prompt for periodic confirmation where location information may become stale.

Example:

HRE-0001 has been recorded at JLR Castle Bromwich for 30 days.

Is this still correct?

YES, STILL HERE
MOVE / REASSIGN
NO LONGER REQUIRED

This creates data confidence rather than silently displaying stale information.

24. Plant inspections

Inspection completion should normally happen through dedicated operational inspection forms, not manually from the Plant Asset page.

An inspection should reference the permanent Plant ID.

Example:

plantInspections/
INS-HRE-0001-20260914-064238

The Asset page then automatically displays inspection history.

Inspection forms may create defects when faults are recorded.

If an asset is unsafe to use, the workflow should be able to derive or update:

OFF_ROAD

across the platform.

Inspection types may eventually include:

PRE_USE
ON_HIRE
OFF_HIRE
FORMAL
POST_REPAIR
RETURN_TO_SERVICE
CONDITION

On-hire and off-hire condition records should support photographic evidence.

25. Plant defects and repairs

Defects must connect technical failure with operational impact.

A defect should be capable of recording:

asset
project
location
fault
category
severity
safe to use
isolated
reported by
reported date/time
engineer
supplier
diagnosis
parts required
part numbers
repair status
repair cost
transport cost
replacement plant cost
downtime
return-to-service evidence
closure

Possible defect statuses:

REPORTED
TRIAGED
AWAITING_ENGINEER
AWAITING_PARTS
REPAIR_IN_PROGRESS
READY_FOR_TEST
RETURNED_TO_SERVICE
CLOSED

A significant defect may also create or link to a Plant Issue.

26. Plant maintenance

Maintenance is especially important for owned plant but may also apply to hired plant.

NORMEX should eventually support:

service intervals
engine hours
meter readings
last service
next service
planned maintenance
completed maintenance
engineer
supplier
parts
cost
downtime
evidence
return to service

The system should eventually identify when planned service may clash with a future assignment.

27. Plant hire

Hire must retain history.

A plant asset may have multiple hire periods.

A hire record may contain:

supplier
supplier plant reference
hire contract reference
hire start
expected off-hire
off-hire requested
off-hire confirmed
rate
rate unit
minimum hire period
delivery charge
collection charge
damage waiver
fuel basis
contact information
status

Price information is live and can change.

NORMEX should preserve meaningful rate history rather than silently losing previous commercial information.

28. Plant availability

Availability should compare:

project need
assignment
hire period
operational state

Examples:

Hire longer than project need
Project requires until:
30 Sep

Hire continues until:
31 Oct

Potential unnecessary hire:
31 days
Project need longer than hire
Project requires until:
30 Nov

Hire ends:
30 Sep

Action:
Hire extension required
Hired idle plant
On hire

No productive assignment

Idle since:
10 Sep

Current cost exposure:
£1,250

Availability must be financially meaningful, not just a calendar.

29. Plant suppliers

Supplier records should support:

company
account reference
contact
emergency contact
hire capability
repair capability
transport capability
parts capability
notes
status

Later, NORMEX may derive supplier performance:

breakdown frequency
replacement response time
repair turnaround
delivery reliability
cost
dispute history
30. Assurance

Assurance should unify business processes such as:

RAMS
CPP
permits
inspections
observations
incidents
NCRs
corrective actions
competence assurance
plant compliance
project assurance
legal/client requirements

The key architectural principle is:

The document is evidence of the business object, not the business object itself.

Example:

PLANT ASSET
↓
LOLER requirement
↓
Compliance state
↓
Certificate PDF

not:

Document folder
↓
Random LOLER PDF

The same principle applies to people and projects.

31. Safety escalation

Not every safety or assurance issue requires the same response.

Records should eventually support:

severity
category
visibility
responsible person
due date
escalation route
corrective action
closure
evidence

Minor issues may remain local.

Major risks may escalate to:

Project Manager
H&S
Contracts Manager
Director
Principal Contractor
Client

depending on configuration and contractual responsibility.

32. Commercial

Commercial should provide project commercial control without trying to replace accounting software.

NORMEX Commercial may include:

RFQs
supplier quotations
client quotations
project tender
budgets
committed costs
approved spend
purchase orders
requisitions
variations
additional works
actual costs
forecast final cost
margin
commercial closeout

Commercial information must be permission-controlled.

Being able to see a project does not automatically mean being allowed to see:

profit
margin
supplier rates
negotiation notes
internal estimates

NORMEX should not attempt to rebuild:

Sage
Xero
VAT accounting
bank reconciliation
payroll

Those systems can integrate later.

33. Requisitions and requests

NORMEX should eventually provide controlled request workflows for:

Plant
transport
repairs
PPE
tools
materials
uniforms
signage
fuel
consumables
equipment

Generic pattern:

REQUEST
↓
REVIEW
↓
APPROVE / REJECT
↓
ORDER / SOURCE
↓
DELIVER
↓
ALLOCATE COST
↓
CLOSE

This improves accountability and project costing.

34. Tools and equipment

Tools should be configurable by business need.

Not every screwdriver requires an individual asset record.

Possible categories:

Individually tracked
breakers
welding equipment
specialist tools
lasers
generators
Quantity tracked
grinders
drills
impact guns
Consumable / untracked
basic hand tools
tape
low-value items

Important information includes:

quantity
availability
allocation
condition
repair
cost
utilisation
35. Materials

Materials may become an optional module.

This is more important for some trades than others.

Possible capability:

requirement
supplier
quantity
order
lead time
delivery
project allocation
consumption
wastage
batch
cost

The module should be optional rather than forced on organisations that do not need it.

36. Reports

Reports should be generated from NORMEX data rather than repeatedly rebuilt manually in spreadsheets.

Project reports

Possible outputs:

project status
readiness
weekly progress
programme
commercial position
assurance
workforce
attendance
clock-ins
rota fulfilment
plant
incidents
actions
changes
blockers
closeout
Organisation reports

Possible outputs:

active projects
project performance
workforce utilisation
labour availability
rota gaps
attendance patterns
competency expiry
safety trends
plant utilisation
idle hire exposure
supplier performance
commercial performance
programme performance

Reports should support role-appropriate visibility.

The system should eventually allow users to create report packs from selected authorised information.

37. Daily and weekly reporting

Operations should be capable of building structured daily information.

Example:

Daily Site Report

Planned workforce
Actual clock-ins
Work completed
Areas worked
Plant used
Deliveries
Issues
Safety observations
Delays
Client instructions
Photos
Tomorrow's plan

Much of this should eventually be derived from data already inside NORMEX rather than manually typed again.

Weekly reporting can then aggregate:

workforce
attendance
programme
plant
commercial changes
assurance
blockers
next-week requirements

The objective is to stop repeatedly recreating the same information.

38. Home / organisation control

The organisation Home page should answer:

What requires management attention across the company?

It should not simply display every number available.

Potential organisation-level information:

live projects
projects blocked
mobilisation risks
serious safety items
programme risk
major commercial changes
workforce gaps
rota gaps
attendance shortages
plant blockers
idle hired plant
qualification expiry
unresolved requests
key upcoming milestones

The emphasis is decision priority.

39. Project dashboards

A project Overview should be calm and decision-focused.

Possible high-level areas:

Project Control State
Readiness
Programme
Commercial
Assurance
People
Plant
Operations
Actions / Blockers
Changes
Upcoming
Recent Activity

Avoid dashboards with dozens of decorative cards.

Every widget should answer a useful management question.

40. Attention Required

Attention Required should contain real actionable exceptions.

Not neutral information.

Good examples:

excavator unavailable for Monday mobilisation
RAMS awaiting approval
operator competency expires before planned shift
hired plant idle for five days
project clock-in count below required workforce
variation awaiting client approval
serious defect unresolved
transport booking missing

Bad examples:

project exists
worker has a qualification
plant is currently deployed
document was uploaded

Neutral facts belong in the normal domain page.

41. External access

NORMEX may later allow controlled visibility for:

clients
Principal Contractors
consultants
suppliers
subcontractors

This should be controlled sharing, not unrestricted workspace access.

A client may be allowed to see:

progress
agreed programme
approved change
agreed milestones
relevant assurance status
workforce totals
selected reports

They should not automatically see:

profit
internal estimates
supplier rates
employee private information
management notes
internal programme assumptions

The organisation controls what is shared externally.

42. Organisational intelligence

The long-term value of NORMEX increases as project history accumulates.

The platform should eventually identify patterns across:

projects
workforce
attendance
safety
plant
suppliers
programme
commercial performance

Examples:

Supplier A
Lower hire rate
Higher breakdown frequency
Long repair response

or:

Demolition projects of type X
Average labour estimate underestimated by 11%

or:

Repeated WAH observations
Concentrated during mobilisation phase

NORMEX should surface reliable patterns.

Humans decide their meaning and action.

The system should not make simplistic accusations.

43. Organisational memory

One of NORMEX's most important long-term benefits is retaining operational knowledge.

Instead of:

Ask Dave.

Sarah normally knows.

Steve did that project last time.

NORMEX should retain:

what happened
when
who decided
why
cost
programme impact
supplier
evidence
outcome
lessons

Knowledge remains in the organisation even when individuals leave.

44. Project closeout

Project completion should produce structured closeout intelligence.

Programme
planned duration
actual duration
delays
approved extensions
milestones
Labour
planned workforce
actual workforce
attendance
utilisation
Plant
planned plant
actual plant
hire exposure
downtime
breakdowns
Commercial
original value
variations
final value
cost
margin
outstanding items
Assurance
incidents
observations
NCRs
closeout actions
Delivery
snagging
handover
client feedback
Lessons
what worked
what failed
what should change next time

This creates a learning organisation rather than isolated project files.

45. Access architecture

NORMEX must not use a simplistic:

higher access number = access to everything below

model.

Access should derive from several dimensions.

Authority level

How much organisational authority the user has.

Functional role

What job/function they perform.

Examples:

Worker
Supervisor
Site Manager
Project Manager
Senior Project Manager
Health & Safety
Contracts Manager
Plant / Transport Manager
Organisation Manager
Platform Administrator
Permissions

Examples:

canViewPlant
canRequestPlant
canManagePlant
canManageTransport

canViewCommercial
canManageCommercial

canManageAssurance
canManageUsers
canManageOrganisation
Project membership

A person's project capability may apply only to particular projects.

A Senior H&S user should not automatically see project profit.

A Commercial Manager should not automatically close safety incidents.

A Site Manager should not automatically alter organisation-level Plant records.

Functional separation matters.

46. Current authority model

Current direction:

0     Worker
1     Supervisor
2     Site Manager
3     Project Manager
4     Senior Project Manager
4.5   Health & Safety
4.6   Senior Health & Safety
5     Contracts Manager
5.5   Plant / Transport Manager
6     Organisation Manager
99    Platform Administration

The numeric value is an authority band.

It is not sufficient on its own to define capability.

47. Security principles

The platform is multi-tenant.

Security must therefore be fundamental.

Important principles:

organisation isolation
backend enforcement
default deny
project membership where appropriate
capability-based access
commercial segregation
H&S segregation
Plant management segregation
external sharing explicitly controlled
Storage secured consistently with Firestore

UI visibility is user experience.

Firestore and Storage rules are the real security boundary.

48. Canonical data first

Canonical data should be created before dashboards.

Preferred sequence:

CANONICAL DATA
↓
SECURITY
↓
INPUT WORKFLOW
↓
HISTORY / EVIDENCE
↓
DERIVED POSITION
↓
DASHBOARD
↓
REPORT
↓
INTELLIGENCE

Avoid building dashboards first and then inventing data to populate them.

49. Canonical versus derived data

Examples:

Canonical
person qualification
person absence
rota assignment
clock-in event
plant hire record
plant assignment
plant movement
plant defect
plant inspection
project scope
commercial variation
document metadata
Derived
person ready for project
rota gap
attendance shortage
plant available
plant idle
current plant location
project readiness
hire exposure
programme risk
project control state

Dashboards should derive from canonical records.

50. Documents and evidence

NORMEX should have a central document service underneath the product.

Possible metadata:

documentId
organisationId
projectId
entityType
entityId
documentType
category
revision
status
issuedDate
expiryDate
storagePath
uploadedBy
uploadedAt

Binary files belong in Firebase Storage.

Users should normally encounter evidence in context.

Examples:

People
→ Qualification
→ CSCS evidence

Plant
→ LOLER
→ Certificate

Project
→ Assurance
→ RAMS

Commercial
→ Quotation
→ PDF

The Documents infrastructure can be central without forcing users into a giant document folder.

51. Audit history

Important business changes should preserve history.

Do not silently overwrite meaningful information.

Examples:

hire price changes
project assignments
plant movements
defects
repair status
off-hire
qualification status
change requests
programme changes
commercial approvals
issue milestones
rota changes
attendance corrections

NORMEX should be able to answer:

What changed?

When?

Who changed it?

Why?

52. Notifications and escalation

NORMEX should eventually support meaningful notifications.

Examples:

qualification expiring
rota uncovered
worker absent
critical plant defect
hired machine idle
permit not approved
programme milestone at risk
commercial approval required
overdue corrective action

Avoid excessive notification noise.

Notifications should correspond to action or material risk.

53. Support Tickets

Support should remain part of the workspace.

Users should be able to report:

system issue
incorrect data
access issue
feature request
technical problem

Support should retain:

organisation
user
page/module
issue
priority
screenshots/evidence
status
response
resolution

This becomes important when NORMEX supports multiple paying tenants.

54. Admin

Organisation Admin should eventually support:

organisation profile
branding
users
roles
permissions
enabled modules
project templates
plant catalogues
competence types
assurance requirements
report configuration
notification settings
integrations
organisation terminology

Platform Admin remains separate from tenant administration.

55. Visual product philosophy

NORMEX should feel like serious industrial operating software.

Current design direction should remain:

premium dark green / neutral palette
rounded white workspace surfaces
restrained typography
generous spacing
strong information hierarchy
horizontal navigation
compact meaningful status cards
calm visual language
limited colour
attention colour only when action is required

Avoid:

colourful SaaS gimmicks
giant marketing heroes inside operational pages
dashboards filled with meaningless widgets
excessive icons
long unnecessary explanatory paragraphs
repeated information
visual noise

Operational screens should prioritise clarity.

56. Navigation

Current organisation navigation direction:

Home
Projects
Operations
People
Plant
Assurance
Commercial
Reports
Admin
Support Tickets

This should remain stable unless a strong product reason justifies changing it.

Programme should initially live primarily through Projects and organisation reporting rather than automatically becoming another global top-navigation item.

57. Product behaviour

NORMEX pages should answer questions.

Fleet
What plant exists?
What is hired?
What is owned?
What is costing money?
What is idle?
What is off road?
What is needed elsewhere?
People
Who do we have?
Who is competent?
Who is available?
Who is working?
Who is missing?
What expires soon?
Operations
What is happening today?
Who is on site?
What was planned?
What actually happened?
What is blocking tomorrow?
Projects
Are we ready?
Are we on programme?
Are we on cost?
What has changed?
What needs a decision?
Reports
What happened?
What changed?
Where are the risks?
What evidence supports the answer?

Avoid building pages merely because a database collection exists.

58. Development philosophy

NORMEX development should follow:

BUSINESS REQUIREMENT
↓
WORKFLOW
↓
CANONICAL DATA MODEL
↓
ACCESS / PERMISSIONS
↓
UI DESIGN
↓
IMPLEMENTATION
↓
TESTING
↓
COMMIT
↓
DEPLOY

Do not develop using:

IDEA
↓
RANDOM UI
↓
RANDOM FIRESTORE FIELDS
↓
NEXT FEATURE

Architecture should be deliberate.

59. Modular architecture

Module-specific HTML, CSS and JavaScript should normally remain together.

Example:

/modules/contractor/plant/fleet/
    index.html
    fleet.css
    fleet.js

Only genuinely shared cross-module functionality belongs in shared folders.

This prevents a future codebase where one module depends on dozens of unrelated global files.

60. Technology direction

Current platform technology:

Firebase Authentication
Cloud Firestore
Firebase Storage
Firebase Hosting
HTML
CSS
JavaScript ES modules

Do not introduce a major framework simply because it is fashionable.

If the existing architecture becomes genuinely unsuitable, evaluate migration separately and intentionally.

A framework migration should be an architectural decision, not incidental feature work.

61. Integration philosophy

NORMEX should integrate with specialist systems rather than attempt to replace every business product.

Potential future integrations may include:

accounting
payroll
telematics
identity systems
access control
email
calendars
document signing
external client systems

NORMEX remains the operational control layer.

62. AI direction

AI may eventually assist with:

report drafting
trend identification
document analysis
project summaries
lessons learned
anomaly identification
searching organisational history

But AI must not become a substitute for reliable canonical data.

The system should first know:

what happened
when
where
who
cost
status
evidence

Then AI can help interpret and communicate it.

63. Commercial product principle

NORMEX should provide useful value to a contractor before requiring a massive digital transformation.

A commercially strong core could include:

Projects
Readiness
People
Rotas
Attendance / Clock-ins
Plant
Assurance
Operations
Commercial
Reports

Additional modules can deepen as organisations mature.

The platform should grow with the tenant.

64. Core market position

NORMEX should not primarily be marketed as:

Health and Safety software

because that is too narrow.

It should not merely be:

Construction management software

because that is too generic.

The intended product position is closer to:

Contractor Operations & Project Control

or:

An operating system for contractor businesses.

A simple product promise is:

Know if the project can start. Know if it is under control. Know why it isn't.

65. Long-term platform model

Conceptually:

                           NORMEX
                              │
                       ORGANISATION
                              │
       ┌──────────────┬───────┴───────┬──────────────┐
       │              │               │              │
    PROJECTS        PEOPLE          PLANT        COMMERCIAL
       │              │               │              │
       ├──────┬───────┴──────┬────────┴──────┬──────┤
       │      │              │               │      │
   ASSURANCE ROTAS      ATTENDANCE       RESOURCES PROGRAMME
       │      │              │               │      │
       └──────┴───────┬──────┴───────────────┴──────┘
                      │
                  OPERATIONS
                      │
                   REPORTS
                      │
             ORGANISATIONAL
                INTELLIGENCE

Projects remain where these organisational capabilities converge into real delivery.

66. Target user experience

The strongest version of NORMEX should allow a:

Site Manager
Project Manager
Plant Manager
Safety Manager
Contracts Manager
Organisation Manager
Director

to open the platform and quickly understand the part of the business they are responsible for.

Within approximately 30 seconds, the right user should be able to answer:

What is happening?
Are we ready?
Are we properly resourced?
Who is actually here?
Are the rotas covered?
What plant is available?
What is costing money?
What is unsafe?
What is late?
What changed?
What requires approval?
Who owns the problem?
What happens next?

That is the standard NORMEX should aim for.

67. Final product principle

NORMEX should create one reliable operational truth from information that would otherwise be spread between:

spreadsheets
emails
WhatsApp
paper
whiteboards
forms
individual knowledge
separate apps

The system's value is not having more data.

Its value is connecting that data so the organisation can act on it.

NORMEX succeeds when it creates:

CONTROL

EVIDENCE

ACCOUNTABILITY

VISIBILITY

ORGANISATIONAL MEMORY

across multiple projects without making the software harder to use than the problem it replaces.