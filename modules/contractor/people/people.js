    import {
    auth,
    db
    } from "/js/firebase.js";

    import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    where,
    writeBatch
    } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

    import {
    PEOPLE_CAPABILITIES,
    getCapabilityLabel
    } from "/modules/contractor/people/shared/capability-catalogue.js";


    /* =========================================================
    STATE
    ========================================================= */

    let currentProfile = null;
    let organisationId = null;

    let people = [];
    let capabilities = [];
    let assignments = [];
    let absences = [];
    let projects = [];

    let selectedPerson = null;

    let activeContextProjectId = "";

    let availabilityMonthCursor =
    todayDate();

    let collapsedCalendarProjects =
    new Set();

    /* =========================================================
    INDEXES
    ========================================================= */

    let peopleById = new Map();
    let projectsById = new Map();

    let capabilitiesByPerson =
    new Map();

    let assignmentsByPerson =
    new Map();

    let absencesByPerson =
    new Map();


    /* =========================================================
    BASIC HELPERS
    ========================================================= */

    function getElement(id) {

    return document.getElementById(
        id
    );

    }


    function setText(
    id,
    value
    ) {

    const element =
        getElement(
        id
        );


    if (element) {

        element.textContent =
        value ?? "";

    }

    }


    function cleanString(
    value
    ) {

    return String(
        value ?? ""
    ).trim();

    }


    function nullableString(
    value
    ) {

    const cleaned =
        cleanString(
        value
        );


    return cleaned ||
        null;

    }


    function currentUid() {

    return (
        auth.currentUser?.uid ||
        currentProfile?.uid ||
        null
    );

    }


    function currentUserName() {

    return (
        currentProfile?.displayName ||
        auth.currentUser?.displayName ||
        currentProfile?.email ||
        auth.currentUser?.email ||
        "NORMEX User"
    );

    }


    /* =========================================================
    WORKSPACE
    ========================================================= */

    function waitForWorkspace() {

    if (
        window.NORMEX_CURRENT_USER
    ) {

        initialisePeople(
        window.NORMEX_CURRENT_USER
        );

        return;

    }


    window.addEventListener(
        "normex:workspace-ready",
        (event) => {

        initialisePeople(
            event.detail.profile
        );

        },
        {
        once: true
        }
    );

    }


    /* =========================================================
    INITIALISE
    ========================================================= */

    async function initialisePeople(
    profile
    ) {

    currentProfile =
        profile;


    organisationId =
        currentProfile?.organisationId ||
        null;


    if (
        !organisationId
    ) {

        console.error(
        "NORMEX People: organisation missing."
        );

        return;

    }


    bindEvents();


    await loadEverything();

    }


    /* =========================================================
    LOAD EVERYTHING
    ========================================================= */

    async function loadEverything() {

    try {

        await Promise.all([
        loadPeople(),
        loadCapabilities(),
        loadAssignments(),
        loadAbsences(),
        loadProjects()
        ]);


        buildIndexes();


        renderEverything();


    } catch (error) {

        console.error(
        "NORMEX People failed to load:",
        error
        );

    }

    }


    /* =========================================================
    LOAD PEOPLE
    ========================================================= */

    async function loadPeople() {

    try {

        const snapshot =
        await getDocs(
            query(
            collection(
                db,
                "people"
            ),
            where(
                "organisationId",
                "==",
                organisationId
            )
            )
        );


        people =
        snapshot.docs.map(
            (item) => ({
            id:
                item.id,

            ...item.data()
            })
        );


    } catch (error) {

        console.warn(
        "NORMEX People records unavailable:",
        error
        );


        people =
        [];

    }

    }


    /* =========================================================
    LOAD CAPABILITIES
    ========================================================= */

    async function loadCapabilities() {

    try {

        const snapshot =
        await getDocs(
            query(
            collection(
                db,
                "peopleCapabilities"
            ),
            where(
                "organisationId",
                "==",
                organisationId
            )
            )
        );


        capabilities =
        snapshot.docs.map(
            (item) => ({
            id:
                item.id,

            ...item.data()
            })
        );


    } catch (error) {

        console.warn(
        "NORMEX People capabilities unavailable:",
        error
        );


        capabilities =
        [];

    }

    }


    /* =========================================================
    LOAD ASSIGNMENTS
    ========================================================= */

    async function loadAssignments() {

    try {

        const snapshot =
        await getDocs(
            query(
            collection(
                db,
                "peopleAssignments"
            ),
            where(
                "organisationId",
                "==",
                organisationId
            )
            )
        );


        assignments =
        snapshot.docs.map(
            (item) => ({
            id:
                item.id,

            ...item.data()
            })
        );


    } catch (error) {

        console.warn(
        "NORMEX People assignments unavailable:",
        error
        );


        assignments =
        [];

    }

    }


    /* =========================================================
    LOAD ABSENCES
    ========================================================= */

    async function loadAbsences() {

    try {

        const snapshot =
        await getDocs(
            query(
            collection(
                db,
                "peopleAbsences"
            ),
            where(
                "organisationId",
                "==",
                organisationId
            )
            )
        );


        absences =
        snapshot.docs.map(
            (item) => ({
            id:
                item.id,

            ...item.data()
            })
        );


    } catch (error) {

        console.warn(
        "NORMEX People absences unavailable:",
        error
        );


        absences =
        [];

    }

    }


    /* =========================================================
    LOAD PROJECTS
    ========================================================= */

    async function loadProjects() {

    try {

        const snapshot =
        await getDocs(
            query(
            collection(
                db,
                "projects"
            ),
            where(
                "organisationId",
                "==",
                organisationId
            )
            )
        );


        projects =
        snapshot.docs.map(
            (item) => ({
            id:
                item.id,

            ...item.data()
            })
        );


    } catch (error) {

        console.warn(
        "NORMEX People projects unavailable:",
        error
        );


        projects =
        [];

    }

    }


    /* =========================================================
    INDEXES
    ========================================================= */

    function buildIndexes() {

    peopleById =
        new Map(
        people.map(
            (person) => [
            person.id,
            person
            ]
        )
        );


    projectsById =
        new Map(
        projects.map(
            (project) => [
            project.id,
            project
            ]
        )
        );


    capabilitiesByPerson =
        groupByPerson(
        capabilities
        );


    assignmentsByPerson =
        groupByPerson(
        assignments
        );


    absencesByPerson =
        groupByPerson(
        absences
        );

    }


    /* =========================================================
    GROUP RECORDS
    ========================================================= */

    function groupByPerson(
    records
    ) {

    const result =
        new Map();


    records.forEach(
        (record) => {

        if (
            !record.personId
        ) {

            return;

        }


        if (
            !result.has(
            record.personId
            )
        ) {

            result.set(
            record.personId,
            []
            );

        }


        result
            .get(
            record.personId
            )
            .push(
            record
            );

        }
    );


    return result;

    }


    /* =========================================================
    DATA ACCESS
    ========================================================= */

    function getPersonCapabilities(
    personId
    ) {

    return (
        capabilitiesByPerson.get(
        personId
        ) ||
        []
    ).filter(
        (record) =>
        record.active !==
            false
    );

    }


    function getPersonAssignments(
    personId
    ) {

    return (
        assignmentsByPerson.get(
        personId
        ) ||
        []
    ).filter(
        (record) =>
        record.status !==
            "ENDED"
    );

    }


    function getPersonAbsences(
    personId
    ) {

    return (
        absencesByPerson.get(
        personId
        ) ||
        []
    );

    }


    function getProjectName(
    projectId
    ) {

    if (
        !projectId
    ) {

        return "Not deployed";

    }


    return (
        projectsById
        .get(
            projectId
        )
        ?.name
        ||
        "Project"
    );

    }


    /* =========================================================
    CURRENT ASSIGNMENT
    ========================================================= */

    function getCurrentAssignment(
    personId
    ) {

    const today =
        todayDate();


    return getPersonAssignments(
        personId
    )
        .filter(
        (assignment) =>
            assignmentContainsDate(
            assignment,
            today
            )
        )
        .sort(
        compareAssignmentStarts
        )[0]
        ||
        null;

    }


    /* =========================================================
    NEXT ASSIGNMENT
    ========================================================= */

    function getNextAssignment(
    personId
    ) {

    const today =
        todayDate();


    return getPersonAssignments(
        personId
    )
        .filter(
        (assignment) => {

            const start =
            parseDate(
                assignment.assignedFrom
            );


            return (
            start &&
            start >
                today
            );

        }
        )
        .sort(
        compareAssignmentStarts
        )[0]
        ||
        null;

    }


    /* =========================================================
    CURRENT ABSENCE
    ========================================================= */

    function getCurrentAbsence(
    personId
    ) {

    return getAbsenceOnDate(
        personId,
        todayDate()
    );

    }


    /* =========================================================
    PERSON POSITION
    ========================================================= */

    function getPersonAvailability(
    person
    ) {

    if (
        person.employmentStatus ===
        "LEFT"
    ) {

        return "UNAVAILABLE";

    }


    if (
        getCurrentAbsence(
        person.id
        )
    ) {

        return "UNAVAILABLE";

    }


    if (
        getCurrentAssignment(
        person.id
        )
    ) {

        return "DEPLOYED";

    }


    return "AVAILABLE";

    }


    /* =========================================================
    NEXT AVAILABILITY
    ========================================================= */

    function getNextAvailability(
    person
    ) {

    const today =
        todayDate();


    const absence =
        getCurrentAbsence(
        person.id
        );


    if (
        absence
    ) {

        const end =
        parseDate(
            absence.endDate
        );


        return {

        type:
            "ABSENCE_END",

        date:
            end
            ? addDays(
                end,
                1
                )
            : null,

        label:
            end
            ? `Available ${formatDate(
                addDays(
                    end,
                    1
                )
                )}`
            : "Unavailable"

        };

    }


    const current =
        getCurrentAssignment(
        person.id
        );


    const next =
        getNextAssignment(
        person.id
        );


    if (
        current
    ) {

        const finish =
        parseDate(
            current.assignedUntil
        );


        if (
        !finish
        ) {

        return {

            type:
            "ONGOING",

            date:
            null,

            label:
            "No release date"

        };

        }


        const availableDate =
        addDays(
            finish,
            1
        );


        const nextStart =
        parseDate(
            next?.assignedFrom
        );


        if (
        next &&
        nextStart &&
        nextStart <=
            availableDate
        ) {

        return {

            type:
            "COMMITTED",

            date:
            nextStart,

            label:
            `Next: ${getProjectName(
                next.projectId
            )} · ${formatDate(
                nextStart
            )}`

        };

        }


        return {

        type:
            "RELEASE",

        date:
            availableDate,

        label:
            `Available ${formatDate(
            availableDate
            )}`

        };

    }


    if (
        next
    ) {

        const nextStart =
        parseDate(
            next.assignedFrom
        );


        return {

        type:
            "AVAILABLE_NOW",

        date:
            today,

        label:
            nextStart
            ? `Available now · committed ${formatDate(
                nextStart
                )}`
            : "Available now"

        };

    }


    return {

        type:
        "AVAILABLE_NOW",

        date:
        today,

        label:
        "Available now"

    };

    }


    /* =========================================================
    UPCOMING AVAILABILITY
    ========================================================= */

    function getUpcomingAvailability(
    days = 30
    ) {

    const today =
        todayDate();


    const limit =
        addDays(
        today,
        days
        );


    return people
        .filter(
        (person) =>
            person.employmentStatus !==
            "LEFT"
        )
        .map(
        (person) => {

            const current =
            getCurrentAssignment(
                person.id
            );


            if (
            !current
            ) {

            return null;

            }


            const finish =
            parseDate(
                current.assignedUntil
            );


            if (
            !finish ||
            finish <
                today ||
            finish >
                limit
            ) {

            return null;

            }


            return {

            person,

            currentAssignment:
                current,

            currentProjectId:
                current.projectId,

            finishDate:
                finish,

            nextAssignment:
                getNextAssignment(
                person.id
                ),

            availability:
                getNextAvailability(
                person
                )

            };

        }
        )
        .filter(
        Boolean
        )
        .sort(
        (a, b) =>
            a.finishDate -
            b.finishDate
        );

    }


    /* =========================================================
    ASSIGNMENT HELPERS
    ========================================================= */

    function compareAssignmentStarts(
    a,
    b
    ) {

    return (
        dateMilliseconds(
        parseDate(
            a.assignedFrom
        )
        )
        -
        dateMilliseconds(
        parseDate(
            b.assignedFrom
        )
        )
    );

    }


    function assignmentContainsDate(
    assignment,
    date
    ) {

    return dateWithin(
        date,
        parseDate(
        assignment.assignedFrom
        ),
        parseDate(
        assignment.assignedUntil
        )
    );

    }


    function getAssignmentOnDate(
    personId,
    date,
    projectId = null
    ) {

    return getPersonAssignments(
        personId
    ).find(
        (assignment) =>

        (
            !projectId ||
            assignment.projectId ===
            projectId
        )

        &&

        assignmentContainsDate(
            assignment,
            date
        )
    )
    ||
    null;

    }


    /* =========================================================
    ABSENCE ON DATE
    ========================================================= */

    function getAbsenceOnDate(
    personId,
    date
    ) {

    return getPersonAbsences(
        personId
    ).find(
        (absence) =>
        dateWithin(
            date,
            parseDate(
            absence.startDate
            ),
            parseDate(
            absence.endDate
            )
        )
    )
    ||
    null;

    }


    /* =========================================================
    CAPABILITY HELPERS
    ========================================================= */

    function isCapabilityExpired(
    capability
    ) {

    const expiry =
        parseDate(
        capability.expiryDate
        );


    return Boolean(
        expiry &&
        expiry <
        todayDate()
    );

    }


    function capabilityExpiresSoon(
    capability
    ) {

    const expiry =
        parseDate(
        capability.expiryDate
        );


    if (
        !expiry
    ) {

        return false;

    }


    const today =
        todayDate();


    const limit =
        addDays(
        today,
        30
        );


    return (
        expiry >=
        today &&
        expiry <=
        limit
    );

    }


    /* =========================================================
    DATE HELPERS
    ========================================================= */

    function todayDate() {

    const date =
        new Date();


    date.setHours(
        0,
        0,
        0,
        0
    );


    return date;

    }


    function parseDate(
    value
    ) {

    if (
        !value
    ) {

        return null;

    }


    if (
        value instanceof Date
    ) {

        const date =
        new Date(
            value
        );


        date.setHours(
        0,
        0,
        0,
        0
        );


        return date;

    }


    if (
        typeof value?.toDate ===
        "function"
    ) {

        const date =
        value.toDate();


        date.setHours(
        0,
        0,
        0,
        0
        );


        return date;

    }


    const date =
        new Date(
        `${value}T00:00:00`
        );


    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;

    }


    function startOfMonth(
    value
    ) {

    const date =
        new Date(
        value
        );


    return new Date(
        date.getFullYear(),
        date.getMonth(),
        1
    );

    }


    function addDays(
    date,
    days
    ) {

    const result =
        new Date(
        date
        );


    result.setDate(
        result.getDate() +
        days
    );


    return result;

    }


    function addMonths(
    date,
    months
    ) {

    return new Date(
        date.getFullYear(),
        date.getMonth() +
        months,
        1
    );

    }


    function daysInMonth(
    date
    ) {

    return new Date(
        date.getFullYear(),
        date.getMonth() +
        1,
        0
    ).getDate();

    }


    function dateMilliseconds(
    date
    ) {

    return date
        ? date.getTime()
        : 0;

    }


    function dateWithin(
    date,
    start,
    end
    ) {

    const effectiveStart =
        start ||
        new Date(
        1900,
        0,
        1
        );


    const effectiveEnd =
        end ||
        new Date(
        2999,
        11,
        31
        );


    return (
        date >=
        effectiveStart &&
        date <=
        effectiveEnd
    );

    }


    function sameDate(
    a,
    b
    ) {

    return (
        a.getFullYear() ===
        b.getFullYear() &&
        a.getMonth() ===
        b.getMonth() &&
        a.getDate() ===
        b.getDate()
    );

    }


    function isWeekend(
    date
    ) {

    return (
        date.getDay() ===
        0 ||
        date.getDay() ===
        6
    );

    }

    /* =========================================================
    MAIN RENDER
    ========================================================= */

    function renderEverything() {

    renderContextControl();

    renderWorkforceMetrics();

    renderWorkforceOutlook();

    renderUpcomingAvailability();

    renderAvailabilityCalendar();

    renderAttention();

    renderCapabilityCoverage();

    renderProjectWorkforce();

    renderProjectFilter();

    applyPeopleFilters();

    }


    /* =========================================================
    CONTEXT
    ========================================================= */

    function renderContextControl() {

    const select =
        getElement(
        "peopleContextProject"
        );


    if (
        !select
    ) {

        return;

    }


    const previousValue =
        activeContextProjectId;


    select.innerHTML = `

        <option value="">
        Organisation View
        </option>

        ${projects
        .slice()
        .sort(
            (a, b) =>
            String(
                a.name ||
                ""
            ).localeCompare(
                String(
                b.name ||
                ""
                )
            )
        )
        .map(
            (project) => `

            <option
                value="${escapeHtml(
                project.id
                )}"
            >
                ${escapeHtml(
                project.name ||
                "Project"
                )}
            </option>

            `
        )
        .join("")}

    `;


    select.value =
        previousValue;


    if (
        activeContextProjectId
    ) {

        setText(
        "peopleViewTitle",
        getProjectName(
            activeContextProjectId
        )
        );


        setText(
        "peopleViewSubtitle",
        "Workforce assigned to this project"
        );

    } else {

        setText(
        "peopleViewTitle",
        "Organisation Position"
        );


        setText(
        "peopleViewSubtitle",
        "Current workforce position across the organisation"
        );

    }

    }


    /* =========================================================
    PEOPLE FOR CURRENT VIEW
    ========================================================= */

    function getContextPeople() {

    const activePeople =
        people.filter(
        (person) =>
            person.employmentStatus !==
            "LEFT"
        );


    if (
        !activeContextProjectId
    ) {

        return activePeople;

    }


    return activePeople.filter(
        (person) =>
        getPersonAssignments(
            person.id
        ).some(
            (assignment) =>
            assignment.projectId ===
                activeContextProjectId
        )
    );

    }


    /* =========================================================
    WORKFORCE METRICS
    ========================================================= */

    function renderWorkforceMetrics() {

    const root =
        getElement(
        "workforceMetrics"
        );


    if (
        !root
    ) {

        return;

    }


    const records =
        getContextPeople();


    const deployed =
        records.filter(
        (person) =>
            getPersonAvailability(
            person
            ) ===
            "DEPLOYED"
        ).length;


    const available =
        records.filter(
        (person) =>
            getPersonAvailability(
            person
            ) ===
            "AVAILABLE"
        ).length;


    const unavailable =
        records.filter(
        (person) =>
            getPersonAvailability(
            person
            ) ===
            "UNAVAILABLE"
        ).length;


    const personIds =
        new Set(
        records.map(
            (person) =>
            person.id
        )
        );


    const competenceAlerts =
        capabilities.filter(
        (capability) =>
            personIds.has(
            capability.personId
            ) &&
            (
            isCapabilityExpired(
                capability
            ) ||
            capabilityExpiresSoon(
                capability
            )
            )
        ).length;


    const releasingSoon =
        getUpcomingAvailability(
        30
        ).filter(
        (record) =>
            personIds.has(
            record.person.id
            )
        ).length;


    const cards = [

        {
        label:
            "Active",

        value:
            records.length,

        note:
            "Current workforce"
        },

        {
        label:
            "Deployed",

        value:
            deployed,

        note:
            "Working on assignments"
        },

        {
        label:
            "Available",

        value:
            available,

        note:
            "Available now"
        },

        {
        label:
            "Off",

        value:
            unavailable,

        note:
            "Leave, sickness or training",

        alert:
            unavailable >
            0
        },

        {
        label:
            "Competence Alerts",

        value:
            competenceAlerts,

        note:
            "Expired or expiring evidence",

        alert:
            competenceAlerts >
            0
        },

        {
        label:
            "Releasing Soon",

        value:
            releasingSoon,

        note:
            "Assignments ending within 30 days"
        }

    ];


    root.innerHTML =
        cards
        .map(
            (card) => `

            <article
                class="
                people-metric
                ${
                    card.alert
                    ? "is-alert"
                    : ""
                }
                "
            >

                <span>
                ${escapeHtml(
                    card.label
                )}
                </span>

                <strong>
                ${card.value}
                </strong>

                <small>
                ${escapeHtml(
                    card.note
                )}
                </small>

            </article>

            `
        )
        .join("");


    const attentionCount =
        buildAttentionItems().length;


    setText(
        "workforcePositionLabel",
        attentionCount
        ? `${attentionCount} ${
            attentionCount ===
                1
                ? "issue"
                : "issues"
            } requiring attention`
        : "Workforce position clear"
    );

    }

    /* =========================================================
    WORKFORCE OUTLOOK
    ========================================================= */

    function renderWorkforceOutlook() {

    const root =
        getElement(
        "peopleOutlook"
        );


    if (
        !root
    ) {

        return;

    }


    const records =
        getContextPeople();


    const personIds =
        new Set(
        records.map(
            (person) =>
            person.id
        )
        );


    const today =
        todayDate();


    const sevenDays =
        addDays(
        today,
        7
        );


    const thirtyDays =
        addDays(
        today,
        30
        );


    /* ---------------------------------------------------------
        TODAY
    --------------------------------------------------------- */

    const deployedToday =
        records.filter(
        (person) =>
            getPersonAvailability(
            person
            ) ===
            "DEPLOYED"
        ).length;


    const availableToday =
        records.filter(
        (person) =>
            getPersonAvailability(
            person
            ) ===
            "AVAILABLE"
        ).length;


    const unavailableToday =
        records.filter(
        (person) =>
            getPersonAvailability(
            person
            ) ===
            "UNAVAILABLE"
        ).length;


    /* ---------------------------------------------------------
        NEXT 7 DAYS
    --------------------------------------------------------- */

    const upcomingAbsences =
        absences.filter(
        (absence) => {

            if (
            !personIds.has(
                absence.personId
            )
            ) {

            return false;

            }


            if (
            !isOperationalAbsence(
                absence
            )
            ) {

            return false;

            }


            return recordRangesOverlap(
            absence.startDate,
            absence.endDate,
            today,
            sevenDays
            );

        }
        ).length;


    const allocationConflicts =
        countAssignmentConflictsInWindow(
        records,
        today,
        sevenDays
        );


    const releases7 =
        getUpcomingAvailability(
        7
        )
        .filter(
            (record) =>
            personIds.has(
                record.person.id
            )
        )
        .length;


    /* ---------------------------------------------------------
        NEXT 30 DAYS
    --------------------------------------------------------- */

    const expiring30 =
        capabilities.filter(
        (capability) => {

            if (
            !personIds.has(
                capability.personId
            )
            ) {

            return false;

            }


            if (
            capability.active ===
                false
            ) {

            return false;

            }


            const expiry =
            parseDate(
                capability.expiryDate
            );


            return (
            expiry &&
            expiry >=
                today &&
            expiry <=
                thirtyDays
            );

        }
        ).length;


    const releases30 =
        getUpcomingAvailability(
        30
        )
        .filter(
            (record) =>
            personIds.has(
                record.person.id
            )
        )
        .length;


    const newCommitments30 =
        assignments.filter(
        (assignment) => {

            if (
            !personIds.has(
                assignment.personId
            )
            ) {

            return false;

            }


            if (
            assignment.status ===
                "ENDED"
            ) {

            return false;

            }


            const start =
            parseDate(
                assignment.assignedFrom
            );


            return (
            start &&
            start >
                today &&
            start <=
                thirtyDays
            );

        }
        ).length;


    root.innerHTML = `

        <article class="people-outlook-card">

        <span class="people-outlook-card__period">
            Today
        </span>

        <strong class="people-outlook-card__headline">
            Current deployment
        </strong>

        <div class="people-outlook-card__rows">

            <div>

            <span>
                Deployed
            </span>

            <strong>
                ${deployedToday}
            </strong>

            </div>


            <div>

            <span>
                Available
            </span>

            <strong>
                ${availableToday}
            </strong>

            </div>


            <div>

            <span>
                Unavailable
            </span>

            <strong>
                ${unavailableToday}
            </strong>

            </div>

        </div>

        </article>


        <article class="people-outlook-card">

        <span class="people-outlook-card__period">
            Next 7 Days
        </span>

        <strong class="people-outlook-card__headline">
            Immediate workforce movement
        </strong>

        <div class="people-outlook-card__rows">

            <div>

            <span>
                Leave / absence
            </span>

            <strong>
                ${upcomingAbsences}
            </strong>

            </div>


            <div>

            <span>
                Allocation conflicts
            </span>

            <strong>
                ${allocationConflicts}
            </strong>

            </div>


            <div>

            <span>
                Releasing from projects
            </span>

            <strong>
                ${releases7}
            </strong>

            </div>

        </div>

        </article>


        <article class="people-outlook-card">

        <span class="people-outlook-card__period">
            Next 30 Days
        </span>

        <strong class="people-outlook-card__headline">
            Forward resource position
        </strong>

        <div class="people-outlook-card__rows">

            <div>

            <span>
                Qualifications expiring
            </span>

            <strong>
                ${expiring30}
            </strong>

            </div>


            <div>

            <span>
                Workforce releases
            </span>

            <strong>
                ${releases30}
            </strong>

            </div>


            <div>

            <span>
                New commitments
            </span>

            <strong>
                ${newCommitments30}
            </strong>

            </div>

        </div>

        </article>

    `;


    setText(
        "peopleOutlookLabel",
        "Next 30 days"
    );

    }


    /* =========================================================
    ASSIGNMENT CONFLICTS IN WINDOW

    Same-project records are intentionally ignored.

    Only simultaneous assignments to DIFFERENT projects
    count as workforce allocation conflicts.
    ========================================================= */

    function countAssignmentConflictsInWindow(
    contextPeople,
    startDate,
    endDate
    ) {

    let conflicts =
        0;


    contextPeople.forEach(
        (person) => {

        const relevantAssignments =
            getPersonAssignments(
            person.id
            )
            .filter(
                (assignment) =>
                recordRangesOverlap(
                    assignment.assignedFrom,
                    assignment.assignedUntil,
                    startDate,
                    endDate
                )
            );


        let personHasConflict =
            false;


        for (
            let firstIndex = 0;
            firstIndex <
            relevantAssignments.length;
            firstIndex += 1
        ) {

            for (
            let secondIndex =
                firstIndex + 1;
            secondIndex <
                relevantAssignments.length;
            secondIndex += 1
            ) {

            const first =
                relevantAssignments[
                firstIndex
                ];


            const second =
                relevantAssignments[
                secondIndex
                ];


            if (
                first.projectId ===
                second.projectId
            ) {

                continue;

            }


            if (
                !recordRangesOverlap(
                first.assignedFrom,
                first.assignedUntil,
                second.assignedFrom,
                second.assignedUntil
                )
            ) {

                continue;

            }


            personHasConflict =
                true;


            break;

            }


            if (
            personHasConflict
            ) {

            break;

            }

        }


        if (
            personHasConflict
        ) {

            conflicts +=
            1;

        }

        }
    );


    return conflicts;

    }
    /* =========================================================
    NEEDS ATTENTION ENGINE

    PURPOSE

    This panel only shows actionable workforce exceptions.

    It must NOT flag general facts such as:
    - only one person holding a capability
    - someone simply being deployed
    - someone simply having holiday booked

    Those facts belong elsewhere unless they cause an
    actual operational problem.
    ========================================================= */

    function buildAttentionItems() {

    const contextPeople =
        getContextPeople();


    const items =
        [];


    contextPeople.forEach(
        (person) => {

        if (
            person.employmentStatus ===
            "LEFT"
        ) {

            return;

        }


        buildAssignmentConflictAlerts(
            person
        ).forEach(
            (item) =>
            items.push(
                item
            )
        );


        buildAssignmentAbsenceAlerts(
            person
        ).forEach(
            (item) =>
            items.push(
                item
            )
        );


        buildUnauthorisedAbsenceAlerts(
            person
        ).forEach(
            (item) =>
            items.push(
                item
            )
        );


        buildCompetenceAlerts(
            person
        ).forEach(
            (item) =>
            items.push(
                item
            )
        );

    });


    return deduplicateAttentionItems(
        items
    )
        .sort(
        (a, b) => {

            const severityDifference =
            severityPriority(
                a.severity
            )
            -
            severityPriority(
                b.severity
            );


            if (
            severityDifference !==
                0
            ) {

            return severityDifference;

            }


            return String(
            a.title ||
            ""
            ).localeCompare(
            String(
                b.title ||
                ""
            )
            );

        }
        );

    }


    /* =========================================================
    DIFFERENT PROJECT ALLOCATION CONFLICTS

    IMPORTANT:
    Multiple assignment records for the SAME project are
    not treated as an allocation conflict here.

    A conflict only exists where:
    - same person
    - different project IDs
    - assignment dates genuinely overlap
    - overlap is current or future
    ========================================================= */

    function buildAssignmentConflictAlerts(
    person
    ) {

    const alerts =
        [];


    const today =
        todayDate();


    const relevantAssignments =
        getPersonAssignments(
        person.id
        )
        .filter(
            (assignment) => {

            const end =
                parseDate(
                assignment.assignedUntil
                );


            return (
                !end ||
                end >=
                today
            );

            }
        );


    for (
        let firstIndex = 0;
        firstIndex <
        relevantAssignments.length;
        firstIndex += 1
    ) {

        for (
        let secondIndex =
            firstIndex + 1;
        secondIndex <
            relevantAssignments.length;
        secondIndex += 1
        ) {

        const first =
            relevantAssignments[
            firstIndex
            ];


        const second =
            relevantAssignments[
            secondIndex
            ];


        /*
        * Same project is not a cross-project
        * workforce conflict.
        */

        if (
            first.projectId ===
            second.projectId
        ) {

            continue;

        }


        if (
            !recordRangesOverlap(
            first.assignedFrom,
            first.assignedUntil,
            second.assignedFrom,
            second.assignedUntil
            )
        ) {

            continue;

        }


        const overlap =
            getRangeOverlap(
            first.assignedFrom,
            first.assignedUntil,
            second.assignedFrom,
            second.assignedUntil
            );


        if (
            overlap.end &&
            overlap.end <
            today
        ) {

            continue;

        }


        alerts.push({

            severity:
            "HIGH",

            title:
            "Overlapping project allocation",

            detail:
            `${person.displayName} · ${getProjectName(
                first.projectId
            )} / ${getProjectName(
                second.projectId
            )}${
                overlap.start
                ? ` · from ${formatDate(
                    overlap.start
                    )}`
                : ""
            }`,

            personId:
            person.id

        });

        }

    }


    return alerts;

    }


    /* =========================================================
    ASSIGNMENT / ABSENCE CONFLICTS

    Holiday, sickness, training etc. only become an alert
    where they overlap an actual project assignment.

    REQUESTED or DECLINED leave is not treated as an
    operational absence.
    ========================================================= */

    function buildAssignmentAbsenceAlerts(
    person
    ) {

    const alerts =
        [];


    const today =
        todayDate();


    const relevantAssignments =
        getPersonAssignments(
        person.id
        )
        .filter(
            (assignment) => {

            const end =
                parseDate(
                assignment.assignedUntil
                );


            return (
                !end ||
                end >=
                today
            );

            }
        );


    const blockingAbsences =
        getPersonAbsences(
        person.id
        )
        .filter(
            isOperationalAbsence
        )
        .filter(
            (absence) => {

            const end =
                parseDate(
                absence.endDate
                );


            return (
                !end ||
                end >=
                today
            );

            }
        );


    relevantAssignments.forEach(
        (assignment) => {

        blockingAbsences.forEach(
            (absence) => {

            if (
                !recordRangesOverlap(
                assignment.assignedFrom,
                assignment.assignedUntil,
                absence.startDate,
                absence.endDate
                )
            ) {

                return;

            }


            const overlap =
                getRangeOverlap(
                assignment.assignedFrom,
                assignment.assignedUntil,
                absence.startDate,
                absence.endDate
                );


            const absenceLabel =
                formatStatus(
                absence.absenceType ||
                "ABSENCE"
                );


            alerts.push({

                severity:
                absence.absenceType ===
                    "SICKNESS"
                    ||
                absence.absenceType ===
                    "UNAUTHORISED"
                    ? "HIGH"
                    : "WATCH",

                title:
                `${absenceLabel} overlaps project allocation`,

                detail:
                `${person.displayName} · ${getProjectName(
                    assignment.projectId
                )}${
                    overlap.start
                    ? ` · ${formatDate(
                        overlap.start
                        )}`
                    : ""
                }${
                    overlap.end
                    ? ` to ${formatDate(
                        overlap.end
                        )}`
                    : ""
                }`,

                personId:
                person.id

            });

            }
        );

        }
    );


    return alerts;

    }


    /* =========================================================
    UNAUTHORISED ABSENCE

    This remains actionable even where there is no project
    assignment because management normally needs to know.
    ========================================================= */

    function buildUnauthorisedAbsenceAlerts(
    person
    ) {

    return getPersonAbsences(
        person.id
    )
        .filter(
        (absence) =>
            absence.absenceType ===
            "UNAUTHORISED"
        )
        .filter(
        (absence) => {

            const today =
            todayDate();


            const start =
            parseDate(
                absence.startDate
            );


            const end =
            parseDate(
                absence.endDate
            );


            return dateWithin(
            today,
            start,
            end
            );

        }
        )
        .map(
        (absence) => ({

            severity:
            "HIGH",

            title:
            "Unauthorised absence",

            detail:
            `${person.displayName} · ${formatDateRange(
                absence.startDate,
                absence.endDate
            )}`,

            personId:
            person.id

        })
        );

    }


    /* =========================================================
    COMPETENCE ALERTS

    We deliberately do NOT alert simply because only one
    person holds a capability.

    We also avoid claiming every expiring capability affects
    every assignment.

    A HIGH alert is raised only where the project role appears
    to use that capability and the capability expires before
    the assignment ends.

    An already-expired active capability remains WATCH because
    the workforce record requires management attention.
    ========================================================= */

    function buildCompetenceAlerts(
    person
    ) {

    const alerts =
        [];


    const personCapabilities =
        getPersonCapabilities(
        person.id
        );


    const relevantAssignments =
        getPersonAssignments(
        person.id
        );


    personCapabilities.forEach(
        (capability) => {

        const expiry =
            parseDate(
            capability.expiryDate
            );


        if (
            !expiry
        ) {

            return;

        }


        if (
            isCapabilityExpired(
            capability
            )
        ) {

            alerts.push({

            severity:
                "WATCH",

            title:
                "Competence evidence expired",

            detail:
                `${person.displayName} · ${getCapabilityLabel(
                capability.capabilityCode
                )} · expired ${formatDate(
                expiry
                )}`,

            personId:
                person.id

            });


            return;

        }


        const affectedAssignment =
            relevantAssignments.find(
            (assignment) =>

                assignmentUsesCapability(
                assignment,
                capability
                )

                &&

                capabilityExpiresDuringAssignment(
                capability,
                assignment
                )
            );


        if (
            !affectedAssignment
        ) {

            return;

        }


        alerts.push({

            severity:
            "HIGH",

            title:
            "Competence expires during assignment",

            detail:
            `${person.displayName} · ${getCapabilityLabel(
                capability.capabilityCode
            )} · expires ${formatDate(
                expiry
            )} · ${getProjectName(
                affectedAssignment.projectId
            )}`,

            personId:
            person.id

        });

    });


    return alerts;

    }


    /* =========================================================
    DOES ASSIGNMENT USE CAPABILITY?

    Temporary bridge until project assignment roles use
    controlled roleCode values.

    Current records may contain free-text roleOnProject,
    therefore matching is intentionally conservative.
    ========================================================= */

    function assignmentUsesCapability(
    assignment,
    capability
    ) {

    const role =
        normaliseWorkforceText(
        assignment.roleOnProject
        );


    if (
        !role
    ) {

        return false;

    }


    const capabilityLabel =
        normaliseWorkforceText(
        getCapabilityLabel(
            capability.capabilityCode
        )
        );


    const capabilityCode =
        normaliseWorkforceText(
        capability.capabilityCode
        );


    if (
        !capabilityLabel &&
        !capabilityCode
    ) {

        return false;

    }


    return (

        (
        capabilityLabel &&
        (
            role.includes(
            capabilityLabel
            )
            ||
            capabilityLabel.includes(
            role
            )
        )
        )

        ||

        (
        capabilityCode &&
        (
            role.includes(
            capabilityCode
            )
            ||
            capabilityCode.includes(
            role
            )
        )
        )

    );

    }


    /* =========================================================
    CAPABILITY EXPIRY DURING ASSIGNMENT
    ========================================================= */

    function capabilityExpiresDuringAssignment(
    capability,
    assignment
    ) {

    const expiry =
        parseDate(
        capability.expiryDate
        );


    if (
        !expiry
    ) {

        return false;

    }


    const assignmentStart =
        parseDate(
        assignment.assignedFrom
        )
        ||
        new Date(
        1900,
        0,
        1
        );


    const assignmentEnd =
        parseDate(
        assignment.assignedUntil
        );


    /*
    * If an assignment has no end date it is open-ended,
    * therefore an upcoming expiry is relevant.
    */

    if (
        !assignmentEnd
    ) {

        return expiry >=
        assignmentStart;

    }


    return (
        expiry >=
        assignmentStart

        &&

        expiry <=
        assignmentEnd
    );

    }


    /* =========================================================
    OPERATIONAL ABSENCE
    ========================================================= */

    function isOperationalAbsence(
    absence
    ) {

    const status =
        cleanString(
        absence.status
        );


    if (
        status ===
        "REQUESTED"

        ||

        status ===
        "DECLINED"

        ||

        status ===
        "CANCELLED"
    ) {

        return false;

    }


    return true;

    }


    /* =========================================================
    RANGE OVERLAP
    ========================================================= */

    function recordRangesOverlap(
    startA,
    endA,
    startB,
    endB
    ) {

    const firstStart =
        parseDate(
        startA
        )
        ||
        new Date(
        1900,
        0,
        1
        );


    const firstEnd =
        parseDate(
        endA
        )
        ||
        new Date(
        2999,
        11,
        31
        );


    const secondStart =
        parseDate(
        startB
        )
        ||
        new Date(
        1900,
        0,
        1
        );


    const secondEnd =
        parseDate(
        endB
        )
        ||
        new Date(
        2999,
        11,
        31
        );


    return (
        firstStart <=
        secondEnd

        &&

        secondStart <=
        firstEnd
    );

    }


    /* =========================================================
    OVERLAP RANGE
    ========================================================= */

    function getRangeOverlap(
    startA,
    endA,
    startB,
    endB
    ) {

    const firstStart =
        parseDate(
        startA
        )
        ||
        new Date(
        1900,
        0,
        1
        );


    const firstEnd =
        parseDate(
        endA
        )
        ||
        new Date(
        2999,
        11,
        31
        );


    const secondStart =
        parseDate(
        startB
        )
        ||
        new Date(
        1900,
        0,
        1
        );


    const secondEnd =
        parseDate(
        endB
        )
        ||
        new Date(
        2999,
        11,
        31
        );


    const start =
        firstStart >
        secondStart
        ? firstStart
        : secondStart;


    const end =
        firstEnd <
        secondEnd
        ? firstEnd
        : secondEnd;


    return {

        start,

        end:
        end.getFullYear() >=
            2999
            ? null
            : end

    };

    }


    /* =========================================================
    NORMALISE WORKFORCE TEXT
    ========================================================= */

    function normaliseWorkforceText(
    value
    ) {

    return cleanString(
        value
    )
        .toLowerCase()
        .replaceAll(
        "_",
        " "
        )
        .replaceAll(
        "-",
        " "
        )
        .replace(
        /[^a-z0-9 ]/g,
        ""
        )
        .replace(
        /\s+/g,
        " "
        )
        .trim();

    }


    /* =========================================================
    RENDER NEEDS ATTENTION
    ========================================================= */

    function renderAttention() {

    const root =
        getElement(
        "peopleAttentionList"
        );


    if (
        !root
    ) {

        return;

    }


    const items =
        buildAttentionItems();


    setText(
        "peopleAttentionCount",
        `${items.length} ${
        items.length ===
            1
            ? "alert"
            : "alerts"
        }`
    );


    if (
        !items.length
    ) {

        root.innerHTML = `

        <div class="people-empty people-empty--compact">

            No current workforce issues require attention.

        </div>

        `;

        return;

    }


    root.innerHTML =
        items
        .map(
            (item) => `

            <article
                class="
                people-attention-row
                ${
                    item.severity ===
                    "HIGH"
                    ? "is-high"
                    : ""
                }
                "
            >

                <span
                class="
                    people-risk-chip
                    ${
                    item.severity ===
                        "HIGH"
                        ? "is-high"
                        : "is-watch"
                    }
                "
                >

                ${escapeHtml(
                    item.severity
                )}

                </span>


                <div>

                <strong>

                    ${escapeHtml(
                    item.title
                    )}

                </strong>

                <span>

                    ${escapeHtml(
                    item.detail
                    )}

                </span>

                </div>


                ${
                item.personId

                    ? `

                    <button
                        class="people-small-action"
                        type="button"
                        data-open-person="${escapeHtml(
                        item.personId
                        )}"
                    >

                        Open

                    </button>

                    `

                    : ""
                }

            </article>

            `
        )
        .join("");


    bindOpenPersonButtons(
        root
    );

    }

    /* =========================================================
    UPCOMING AVAILABILITY
    ========================================================= */

    function renderUpcomingAvailability() {

    /*
    * Supports either ID so we do not need another HTML
    * rewrite if the previous capacity-pipeline section
    * is already present.
    */

    const root =
        getElement(
        "upcomingAvailability"
        ) ||
        getElement(
        "capacityPipeline"
        );


    if (
        !root
    ) {

        return;

    }


    let records =
        getUpcomingAvailability(
        30
        );


    if (
        activeContextProjectId
    ) {

        records =
        records.filter(
            (record) =>
            record.currentProjectId ===
                activeContextProjectId
        );

    }


    const labelId =
        getElement(
        "upcomingAvailabilityLabel"
        )
        ? "upcomingAvailabilityLabel"
        : "capacityPipelineLabel";


    setText(
        labelId,
        records.length
        ? `${records.length} ${
            records.length ===
                1
                ? "person"
                : "people"
            }`
        : "No upcoming releases"
    );


    if (
        !records.length
    ) {

        root.innerHTML = `

        <div class="people-empty people-empty--compact">
            No current assignments are ending within the next 30 days.
        </div>

        `;

        return;

    }


    root.innerHTML = `

        <table class="people-capacity-table">

        <thead>

            <tr>

            <th>
                Person
            </th>

            <th>
                Current Project
            </th>

            <th>
                Role / Capability
            </th>

            <th>
                Finishes
            </th>

            <th>
                Position After
            </th>

            <th></th>

            </tr>

        </thead>


        <tbody>

            ${records
            .map(
                renderUpcomingAvailabilityRow
            )
            .join("")}

        </tbody>

        </table>

    `;


    bindOpenPersonButtons(
        root
    );

    }


    /* =========================================================
    UPCOMING AVAILABILITY ROW
    ========================================================= */

    function renderUpcomingAvailabilityRow(
    record
    ) {

    const person =
        record.person;


    const capabilityLabels =
        getPersonCapabilities(
        person.id
        )
        .filter(
            (capability) =>
            !isCapabilityExpired(
                capability
            )
        )
        .slice(
            0,
            3
        )
        .map(
            (capability) =>
            getCapabilityLabel(
                capability.capabilityCode
            )
        );


    const roleCapability =
        [
        person.primaryRole,
        ...capabilityLabels
        ]
        .filter(
            Boolean
        )
        .slice(
            0,
            4
        )
        .join(
            " · "
        );


    let afterText =
        record.availability.label;


    if (
        record.nextAssignment
    ) {

        const nextStart =
        parseDate(
            record.nextAssignment.assignedFrom
        );


        if (
        nextStart
        ) {

        afterText =
            `Next: ${getProjectName(
            record.nextAssignment.projectId
            )} · ${formatDate(
            nextStart
            )}`;

        }

    }


    return `

        <tr>

        <td class="people-name">

            <strong>
            ${escapeHtml(
                person.displayName
            )}
            </strong>

            <span>
            ${escapeHtml(
                person.employeeNumber ||
                "No internal reference"
            )}
            </span>

        </td>


        <td>

            ${escapeHtml(
            getProjectName(
                record.currentProjectId
            )
            )}

        </td>


        <td>

            ${escapeHtml(
            roleCapability ||
            "No capability recorded"
            )}

        </td>


        <td>

            <strong>
            ${escapeHtml(
                formatDate(
                record.finishDate
                )
            )}
            </strong>

        </td>


        <td>

            ${escapeHtml(
            afterText
            )}

        </td>


        <td>

            <button
            class="people-small-action"
            type="button"
            data-open-person="${escapeHtml(
                person.id
            )}"
            >
            Open
            </button>

        </td>

        </tr>

    `;

    }

    /* =========================================================
    AVAILABILITY CALENDAR
    ========================================================= */

    function renderAvailabilityCalendar() {

    const root =
        getElement(
        "workforceAvailabilityCalendar"
        );


    if (
        !root
    ) {

        return;

    }


    let records =
        getContextPeople();


    const startDate =
        new Date(
        availabilityMonthCursor
        );


    const visibleDates =
        Array.from(
        {
            length:
            48
        },
        (
            _,
            index
        ) =>
            addDays(
            startDate,
            index
            )
        );


    const endDate =
        visibleDates[
        visibleDates.length - 1
        ];


    const capabilityFilter =
        cleanString(
        getElement(
            "availabilityCapabilityFilter"
        )?.value
        );


    const statusFilter =
        cleanString(
        getElement(
            "availabilityStatusFilter"
        )?.value
        );


    if (
        capabilityFilter
    ) {

        records =
        records.filter(
            (person) =>
            getPersonCapabilities(
                person.id
            ).some(
                (capability) =>

                capability.active !==
                    false

                &&

                !isCapabilityExpired(
                    capability
                )

                &&

                capability.capabilityCode ===
                    capabilityFilter
            )
        );

    }


    if (
        statusFilter
    ) {

        records =
        records.filter(
            (person) =>
            personMatchesCalendarStatus(
                person,
                visibleDates,
                statusFilter
            )
        );

    }


    renderAvailabilityCapabilityFilter();


    setText(
        "availabilityPeriodLabel",
        `${formatDate(
        startDate
        )} - ${formatDate(
        endDate
        )}`
    );


    if (
        !records.length
    ) {

        root.innerHTML = `

        <div class="people-empty people-empty--calendar">
            No people match this workforce view.
        </div>

        `;

        return;

    }


    root.innerHTML =
        renderRollingAvailabilityCalendar(
        startDate,
        visibleDates,
        records
        );


    bindCalendarProjectToggles(
        root
    );

    }


    /* =========================================================
    CALENDAR STATUS FILTER
    ========================================================= */

    function personMatchesCalendarStatus(
    person,
    dates,
    status
    ) {

    return dates.some(
        (date) => {

        const position =
            getCalendarDayPosition(
            person,
            date
            );


        if (
            status ===
            "AVAILABLE"
        ) {

            return position.state ===
            "AVAILABLE";

        }


        if (
            status ===
            "DEPLOYED"
        ) {

            return position.state ===
            "DEPLOYED";

        }


        if (
            status ===
            "HOLIDAY"
        ) {

            return position.state ===
            "HOLIDAY";

        }


        if (
            status ===
            "TRAINING"
        ) {

            return position.state ===
            "TRAINING";

        }


        if (
            status ===
            "SICKNESS"
        ) {

            return position.state ===
            "SICKNESS";

        }


        if (
            status ===
            "UNAVAILABLE"
        ) {

            return position.state ===
            "UNAVAILABLE";

        }


        return true;

        }
    );

    }


    /* =========================================================
    CAPABILITY FILTER
    ========================================================= */

    function renderAvailabilityCapabilityFilter() {

    const select =
        getElement(
        "availabilityCapabilityFilter"
        );


    if (
        !select
    ) {

        return;

    }


    const selected =
        select.value;


    const codes =
        [
        ...new Set(
            capabilities
            .filter(
                (capability) =>

                capability.active !==
                    false

                &&

                !isCapabilityExpired(
                    capability
                )
            )
            .map(
                (capability) =>
                capability.capabilityCode
            )
        )
        ]
        .sort(
            (a, b) =>
            getCapabilityLabel(
                a
            ).localeCompare(
                getCapabilityLabel(
                b
                )
            )
        );


    select.innerHTML = `

        <option value="">
        All Capabilities
        </option>

        ${codes
        .map(
            (code) => `

            <option
                value="${escapeHtml(
                code
                )}"
            >
                ${escapeHtml(
                getCapabilityLabel(
                    code
                )
                )}
            </option>

            `
        )
        .join("")}

    `;


    select.value =
        selected;

    }


    /* =========================================================
    CALENDAR GROUP PROJECT
    ========================================================= */

    function getCalendarGroupingProjectId(
    person,
    startDate,
    endDate
    ) {

    const assignmentsInWindow =
        getPersonAssignments(
        person.id
        )
        .filter(
            (assignment) => {

            const from =
                parseDate(
                assignment.assignedFrom
                );


            const until =
                parseDate(
                assignment.assignedUntil
                );


            const effectiveFrom =
                from ||
                new Date(
                1900,
                0,
                1
                );


            const effectiveUntil =
                until ||
                new Date(
                2999,
                11,
                31
                );


            return (
                effectiveFrom <=
                endDate

                &&

                effectiveUntil >=
                startDate
            );

            }
        )
        .sort(
            compareAssignmentStarts
        );


    const assignmentAtStart =
        assignmentsInWindow.find(
        (assignment) =>
            assignmentContainsDate(
            assignment,
            startDate
            )
        );


    if (
        assignmentAtStart?.projectId
    ) {

        return assignmentAtStart.projectId;

    }


    const nextAssignment =
        assignmentsInWindow.find(
        (assignment) => {

            const start =
            parseDate(
                assignment.assignedFrom
            );


            return (
            start &&
            start >
                startDate
            );

        }
        );


    return (
        nextAssignment?.projectId ||
        "__AVAILABLE__"
    );

    }


    /* =========================================================
    PROJECT GROUPS
    ========================================================= */

    function buildCalendarProjectGroups(
    records,
    startDate,
    endDate
    ) {

    const groups =
        new Map();


    records.forEach(
        (person) => {

        const projectId =
            getCalendarGroupingProjectId(
            person,
            startDate,
            endDate
            );


        if (
            !groups.has(
            projectId
            )
        ) {

            groups.set(
            projectId,
            []
            );

        }


        groups
            .get(
            projectId
            )
            .push(
            person
            );

        }
    );


    return Array
        .from(
        groups.entries()
        )
        .map(
        (
            [
            projectId,
            projectPeople
            ]
        ) => ({

            projectId,

            label:
            projectId ===
                "__AVAILABLE__"
                ? "Available / Not Assigned"
                : getProjectName(
                    projectId
                ),

            people:
            projectPeople
                .slice()
                .sort(
                (a, b) =>
                    String(
                    a.displayName ||
                    ""
                    ).localeCompare(
                    String(
                        b.displayName ||
                        ""
                    )
                    )
                )

        })
        )
        .sort(
        (a, b) => {

            if (
            a.projectId ===
                "__AVAILABLE__"
            ) {

            return 1;

            }


            if (
            b.projectId ===
                "__AVAILABLE__"
            ) {

            return -1;

            }


            return a.label.localeCompare(
            b.label
            );

        }
        );

    }


    /* =========================================================
    ROLLING 48 DAY CALENDAR
    ========================================================= */

    function renderRollingAvailabilityCalendar(
    startDate,
    dates,
    records
    ) {

    const endDate =
        dates[
        dates.length - 1
        ];


    const monthGroups =
        [];


    dates.forEach(
        (date) => {

        const key =
            `${date.getFullYear()}-${date.getMonth()}`;


        let group =
            monthGroups.find(
            (item) =>
                item.key ===
                key
            );


        if (
            !group
        ) {

            group = {

            key,

            label:
                formatMonthYear(
                date
                ),

            dates:
                []

            };


            monthGroups.push(
            group
            );

        }


        group.dates.push(
            date
        );

        }
    );


    const projectGroups =
        buildCalendarProjectGroups(
        records,
        startDate,
        endDate
        );


    return `

        <div class="people-calendar-frame">

        <div
            class="people-calendar-grid people-calendar-grid--rolling"
            style="
            --calendar-days:${dates.length};
            "
        >

            <div class="people-calendar-corner">

            <span>
                Workforce
            </span>

            </div>


            ${monthGroups
            .map(
                (
                group,
                index
                ) => `

                <div
    class="
        people-calendar-month-label
        month-tone-${index % 3}
    "
    style="
        grid-column:span ${group.dates.length};
    "
    >

    <strong>
        ${escapeHtml(
        group.label
        )}
    </strong>

    </div>

                `
            )
            .join("")}


            <div class="people-calendar-grid__header is-person">

            Person

            </div>


            ${dates
            .map(
                (date) => {

                const toneClass =
                    getMonthToneClass(
                    date,
                    startDate
                    );


                return `

                    <div
                    class="
                        people-calendar-grid__header
                        ${toneClass}
                        ${
                        isWeekend(
                            date
                        )
                            ? "is-weekend"
                            : ""
                        }
                        ${
                        sameDate(
                            date,
                            todayDate()
                        )
                            ? "is-today"
                            : ""
                        }
                        ${
                        date.getDate() ===
                            1
                            ? "is-month-start"
                            : ""
                        }
                    "
                    title="${escapeHtml(
                        formatLongDate(
                        date
                        )
                    )}"
                    >

                    <span class="people-calendar-day-number">

                        ${date.getDate()}

                    </span>

                    <small>

                        ${formatCalendarWeekday(
                        date
                        )}

                    </small>

                    </div>

                `;

                }
            )
            .join("")}


            ${projectGroups
            .map(
                (group) =>
                renderCalendarProjectGroup(
                    group,
                    dates,
                    startDate
                )
            )
            .join("")}

        </div>

        </div>

    `;

    }


    /* =========================================================
    PROJECT GROUP
    ========================================================= */

    function renderCalendarProjectGroup(
    group,
    dates,
    startDate
    ) {

    const collapsed =
        collapsedCalendarProjects.has(
        group.projectId
        );


    return `

        <button
        class="
            people-calendar-project-row
            ${
            group.projectId ===
                "__AVAILABLE__"
                ? "is-unassigned"
                : ""
            }
        "
        type="button"
        data-calendar-project-toggle="${escapeHtml(
            group.projectId
        )}"
        >

        <span class="people-calendar-project-row__toggle">

            ${
            collapsed
                ? "▸"
                : "▾"
            }

        </span>


        <span class="people-calendar-project-row__title">

            ${escapeHtml(
            group.label
            )}

        </span>


        <span class="people-calendar-project-row__count">

            ${group.people.length}

            ${
            group.people.length ===
                1
                ? "person"
                : "people"
            }

        </span>

        </button>


        ${
        collapsed

            ? ""

            : group.people
                .map(
                (person) =>
                    renderCalendarPersonRow(
                    person,
                    dates,
                    startDate
                    )
                )
                .join("")
        }

    `;

    }


    /* =========================================================
    PERSON ROW
    ========================================================= */

    function renderCalendarPersonRow(
    person,
    dates,
    startDate
    ) {

    const current =
        getCurrentAssignment(
        person.id
        );


    const role =
        current?.roleOnProject ||
        person.primaryRole ||
        "Workforce";


    return `

        <div
        class="people-calendar-person"
        title="${escapeHtml(
            person.displayName
        )}"
        >

        <strong>

            ${escapeHtml(
            shortenName(
                person.displayName
            )
            )}

        </strong>

        <span>

            ${escapeHtml(
            role
            )}

        </span>

        </div>


        ${dates
        .map(
            (date) =>
            renderCalendarDay(
                person,
                date,
                startDate
            )
        )
        .join("")}

    `;

    }


    /* =========================================================
    CALENDAR DAY
    ========================================================= */

    function renderCalendarDay(
    person,
    date,
    startDate
    ) {

    const position =
        getCalendarDayPosition(
        person,
        date
        );


    const toneClass =
        getMonthToneClass(
        date,
        startDate
        );


    return `

        <div
        class="
            people-calendar-day
            ${toneClass}
            ${
            isWeekend(
                date
            )
                ? "is-weekend"
                : ""
            }
            ${
            sameDate(
                date,
                todayDate()
            )
                ? "is-today"
                : ""
            }
            ${
            date.getDate() ===
                1
                ? "is-month-start"
                : ""
            }
        "
        title="${escapeHtml(
            position.description
        )}"
        >

        <span
            class="
            people-calendar-block
            ${position.className}
            "
        ></span>

        </div>

    `;

    }


    /* =========================================================
    CALENDAR POSITION
    ========================================================= */

    function getCalendarDayPosition(
    person,
    date
    ) {

    if (
        person.employmentStatus ===
        "LEFT"
    ) {

        return {

        state:
            "UNAVAILABLE",

        className:
            "is-unavailable",

        description:
            `Not active in workforce · ${formatLongDate(
            date
            )}`

        };

    }


    const absence =
        getAbsenceOnDate(
        person.id,
        date
        );


    if (
        absence
    ) {

        if (
        absence.absenceType ===
            "HOLIDAY"
        ) {

        return {

            state:
            "HOLIDAY",

            className:
            "is-holiday",

            description:
            `Holiday · ${formatLongDate(
                date
            )}`

        };

        }


        if (
        absence.absenceType ===
            "TRAINING"
        ) {

        return {

            state:
            "TRAINING",

            className:
            "is-training",

            description:
            `Training · ${formatLongDate(
                date
            )}`

        };

        }


        if (
        absence.absenceType ===
            "SICKNESS"
        ) {

        return {

            state:
            "SICKNESS",

            className:
            "is-sickness",

            description:
            `Sickness · ${formatLongDate(
                date
            )}`

        };

        }


        return {

        state:
            "UNAVAILABLE",

        className:
            "is-unavailable",

        description:
            `${formatStatus(
            absence.absenceType ||
            "Unavailable"
            )} · ${formatLongDate(
            date
            )}`

        };

    }


    /*
    * IMPORTANT:
    *
    * Check every project assignment, not only the currently
    * selected project.
    *
    * Otherwise somebody assigned elsewhere could incorrectly
    * appear available.
    */

    const assignment =
        getAssignmentOnDate(
        person.id,
        date
        );


    if (
        assignment
    ) {

        return {

        state:
            "DEPLOYED",

        className:
            "is-deployed",

        description:
            `${getProjectName(
            assignment.projectId
            )} · ${
            assignment.roleOnProject ||
            person.primaryRole ||
            "Assigned"
            }`

        };

    }


    if (
        date.getDay() ===
        6 &&
        person.saturdayAvailable ===
        "NO"
    ) {

        return {

        state:
            "UNAVAILABLE",

        className:
            "is-unavailable",

        description:
            "Normally unavailable Saturday"

        };

    }


    if (
        date.getDay() ===
        0 &&
        person.sundayAvailable ===
        "NO"
    ) {

        return {

        state:
            "UNAVAILABLE",

        className:
            "is-unavailable",

        description:
            "Normally unavailable Sunday"

        };

    }


    return {

        state:
        "AVAILABLE",

        className:
        "is-available",

        description:
        `Available · ${formatLongDate(
            date
        )}`

    };

    }


    /* =========================================================
    MONTH TONE
    ========================================================= */

    function getMonthToneClass(
    date,
    startDate
    ) {

    const monthDifference =
        (
        date.getFullYear() *
        12 +
        date.getMonth()
        )
        -
        (
        startDate.getFullYear() *
        12 +
        startDate.getMonth()
        );


    const tone =
        (
        (
            monthDifference %
            3
        )
        +
        3
        )
        %
        3;


    return `month-tone-${tone}`;

    }


    /* =========================================================
    WEEKDAY
    ========================================================= */

    function formatCalendarWeekday(
    date
    ) {

    return new Intl.DateTimeFormat(
        "en-GB",
        {
        weekday:
            "short"
        }
    )
        .format(
        date
        )
        .slice(
        0,
        1
        );

    }


    /* =========================================================
    PROJECT TOGGLES
    ========================================================= */

    function bindCalendarProjectToggles(
    root
    ) {

    root
        .querySelectorAll(
        "[data-calendar-project-toggle]"
        )
        .forEach(
        (button) => {

            button.addEventListener(
            "click",
            () => {

                const projectId =
                button.dataset.calendarProjectToggle;


                if (
                collapsedCalendarProjects.has(
                    projectId
                )
                ) {

                collapsedCalendarProjects.delete(
                    projectId
                );

                } else {

                collapsedCalendarProjects.add(
                    projectId
                );

                }


                renderAvailabilityCalendar();

            }
            );

        }
        );

    }

    /* =========================================================
    CAPABILITY COVERAGE

    PURPOSE

    This section describes workforce capability capacity.

    It is NOT an alert panel.

    A capability having only one competent person does not
    automatically mean there is an operational problem.

    Actual shortages belong in Needs Attention when future
    resource requirements prove that demand cannot be met.
    ========================================================= */

    function renderCapabilityCoverage() {

    const root =
        getElement(
        "capabilityCoverage"
        );


    if (
        !root
    ) {

        return;

    }


    const contextPeople =
        getContextPeople();


    const contextIds =
        new Set(
        contextPeople.map(
            (person) =>
            person.id
        )
        );


    const grouped =
        new Map();


    capabilities
        .filter(
        (capability) =>

            capability.active !==
            false

            &&

            !isCapabilityExpired(
            capability
            )

            &&

            contextIds.has(
            capability.personId
            )
        )
        .forEach(
        (capability) => {

            if (
            !grouped.has(
                capability.capabilityCode
            )
            ) {

            grouped.set(
                capability.capabilityCode,
                []
            );

            }


            grouped
            .get(
                capability.capabilityCode
            )
            .push(
                capability
            );

        }
        );


    const positions =
        Array
        .from(
            grouped.entries()
        )
        .map(
            (
            [
                capabilityCode,
                capabilityRecords
            ]
            ) => {

            const competentPersonIds =
                [
                ...new Set(
                    capabilityRecords.map(
                    (capability) =>
                        capability.personId
                    )
                )
                ];


            const competentPeople =
                competentPersonIds
                .map(
                    (personId) =>
                    peopleById.get(
                        personId
                    )
                )
                .filter(
                    (person) =>

                    person

                    &&

                    person.employmentStatus !==
                        "LEFT"
                );


            const deployed =
                competentPeople.filter(
                (person) =>
                    getPersonAvailability(
                    person
                    ) ===
                    "DEPLOYED"
                ).length;


            const unavailable =
                competentPeople.filter(
                (person) =>
                    getPersonAvailability(
                    person
                    ) ===
                    "UNAVAILABLE"
                ).length;


            const available =
                competentPeople.filter(
                (person) =>
                    getPersonAvailability(
                    person
                    ) ===
                    "AVAILABLE"
                ).length;


            const expiring =
                capabilityRecords.filter(
                capabilityExpiresSoon
                ).length;


            return {

                capabilityCode,

                competent:
                competentPeople.length,

                deployed,

                available,

                unavailable,

                expiring

            };

            }
        )
        .filter(
            (position) =>
            position.competent >
                0
        )
        .sort(
            (a, b) =>
            getCapabilityLabel(
                a.capabilityCode
            ).localeCompare(
                getCapabilityLabel(
                b.capabilityCode
                )
            )
        );


    setText(
        "capabilityCoverageCount",
        `${positions.length} ${
        positions.length ===
            1
            ? "capability"
            : "capabilities"
        }`
    );


    if (
        !positions.length
    ) {

        root.innerHTML = `

        <div class="people-empty people-empty--compact">

            No capability records available for this workforce view.

        </div>

        `;

        return;

    }


    root.innerHTML =
        positions
        .map(
            (position) => {

            const capacityPosition =
                getCapabilityCapacityPosition(
                position
                );


            return `

                <article class="people-capability-card">

                <div class="people-capability-card__top">

                    <strong>

                    ${escapeHtml(
                        getCapabilityLabel(
                        position.capabilityCode
                        )
                    )}

                    </strong>


                    ${
                    position.expiring >
                        0

                        ? `

                        <span class="people-capability-expiry">

                            ${position.expiring}
                            ${
                            position.expiring ===
                                1
                                ? "expiring"
                                : "expiring"
                            }

                        </span>

                        `

                        : `

                        <span class="people-capability-expiry is-clear">

                            Current

                        </span>

                        `
                    }

                </div>


                <div class="people-capability-card__numbers">

                    <div class="people-capability-number">

                    <span>
                        Competent
                    </span>

                    <strong>
                        ${position.competent}
                    </strong>

                    </div>


                    <div class="people-capability-number">

                    <span>
                        Allocated
                    </span>

                    <strong>
                        ${position.deployed}
                    </strong>

                    </div>


                    <div class="people-capability-number">

                    <span>
                        Available
                    </span>

                    <strong>
                        ${position.available}
                    </strong>

                    </div>

                </div>


                <div class="people-capability-card__footer">

                    <span
                    class="
                        people-capability-status
                        ${capacityPosition.className}
                    "
                    >

                    ${escapeHtml(
                        capacityPosition.label
                    )}

                    </span>


                    ${
                    position.competent ===
                        1

                        ? `

                        <span class="people-capability-note">

                            Single holder

                        </span>

                        `

                        : ""
                    }

                </div>

                </article>

            `;

            }
        )
        .join("");

    }


    /* =========================================================
    CAPABILITY CAPACITY POSITION

    Neutral operational description only.

    Future resource requirements will determine whether
    lack of spare capacity is actually a problem.
    ========================================================= */

    function getCapabilityCapacityPosition(
    position
    ) {

    if (
        position.available >
        1
    ) {

        return {

        label:
            `${position.available} spare`,

        className:
            "has-spare"

        };

    }


    if (
        position.available ===
        1
    ) {

        return {

        label:
            "1 spare",

        className:
            "has-spare"

        };

    }


    if (
        position.unavailable >
        0
    ) {

        return {

        label:
            "No spare currently",

        className:
            "is-neutral"

        };

    }


    if (
        position.deployed ===
        position.competent
    ) {

        return {

        label:
            "Fully allocated",

        className:
            "is-neutral"

        };

    }


    return {

        label:
        "Current",

        className:
        "is-neutral"

    };

    }
    /* =========================================================
    PROJECT WORKFORCE POSITION
    ========================================================= */

    function renderProjectWorkforce() {

    const root =
        getElement(
        "deploymentOverview"
        );


    if (
        !root
    ) {

        return;

    }


    const grouped =
        new Map();


    people
        .filter(
        (person) =>
            person.employmentStatus !==
            "LEFT"
        )
        .forEach(
        (person) => {

            const assignment =
            getCurrentAssignment(
                person.id
            );


            if (
            !assignment ||
            !assignment.projectId
            ) {

            return;

            }


            if (
            !grouped.has(
                assignment.projectId
            )
            ) {

            grouped.set(
                assignment.projectId,
                []
            );

            }


            grouped
            .get(
                assignment.projectId
            )
            .push(
                {
                person,
                assignment
                }
            );

        }
        );


    setText(
        "deploymentPositionLabel",
        grouped.size
        ? `${grouped.size} active ${
            grouped.size ===
                1
                ? "project"
                : "projects"
            }`
        : "No current allocation"
    );


    if (
        !grouped.size
    ) {

        root.innerHTML = `

        <div class="people-empty people-empty--compact">
            No active project deployments recorded.
        </div>

        `;

        return;

    }


    root.innerHTML =
        Array.from(
        grouped.entries()
        )
        .map(
            (
            [
                projectId,
                projectPeople
            ]
            ) => `

            <article class="people-deployment-card">

                <strong>
                ${escapeHtml(
                    getProjectName(
                    projectId
                    )
                )}
                </strong>

                <span>
                Current workforce allocation
                </span>

                <span class="people-deployment-card__count">
                ${projectPeople.length}
                ${
                    projectPeople.length ===
                    1
                    ? "person"
                    : "people"
                }
                </span>


                <div class="people-deployment-card__position">

                ${projectPeople
                    .slice(
                    0,
                    4
                    )
                    .map(
                    (
                        {
                        person,
                        assignment
                        }
                    ) => `

                        <div>

                        <span>
                            ${escapeHtml(
                            person.displayName
                            )}
                        </span>

                        <strong>
                            ${escapeHtml(
                            assignment.roleOnProject ||
                            person.primaryRole ||
                            "Assigned"
                            )}
                        </strong>

                        </div>

                    `
                    )
                    .join("")}

                </div>

            </article>

            `
        )
        .join("");

    }

    /* =========================================================
    ASSIGNMENT PROJECT OPTIONS
    ========================================================= */

    function renderAssignmentProjectOptions() {

    const select =
        getElement(
        "personAssignmentProject"
        );


    if (
        !select
    ) {

        return;

    }


    select.innerHTML = `

        <option value="">
        Select Project
        </option>

        ${projects
        .slice()
        .sort(
            (a, b) =>
            String(
                a.name ||
                ""
            ).localeCompare(
                String(
                b.name ||
                ""
                )
            )
        )
        .map(
            (project) => `

            <option
                value="${escapeHtml(
                project.id
                )}"
            >
                ${escapeHtml(
                project.name ||
                "Project"
                )}
            </option>

            `
        )
        .join("")}

    `;

    }


    /* =========================================================
    ADD ASSIGNMENT
    ========================================================= */

    async function addPersonAssignment(
    event
    ) {

    event.preventDefault();


    if (
        !selectedPerson
    ) {

        return;

    }


    hideMessage(
        "personWorkspaceError"
    );


    const form =
        new FormData(
        event.currentTarget
        );


    const projectId =
        cleanString(
        form.get(
            "projectId"
        )
        );


    const assignedFrom =
        nullableString(
        form.get(
            "assignedFrom"
        )
        );


    const assignedUntil =
        nullableString(
        form.get(
            "assignedUntil"
        )
        );


    if (
        !projectId
    ) {

        showMessage(
        "personWorkspaceError",
        "Select a project."
        );

        return;

    }


    if (
        assignedFrom &&
        assignedUntil &&
        parseDate(
        assignedUntil
        ) <
        parseDate(
            assignedFrom
        )
    ) {

        showMessage(
        "personWorkspaceError",
        "Assignment end date cannot be before its start date."
        );

        return;

    }


    try {

        const reference =
        doc(
            collection(
            db,
            "peopleAssignments"
            )
        );


        const batch =
        writeBatch(
            db
        );


        batch.set(
        reference,
        {

            organisationId,

            personId:
            selectedPerson.id,

            projectId,

            roleOnProject:
            nullableString(
                form.get(
                "roleOnProject"
                )
            ),

            assignedFrom,

            assignedUntil,

            status:
            "ACTIVE",

            createdByUid:
            currentUid(),

            createdByName:
            currentUserName(),

            createdAt:
            serverTimestamp(),

            updatedByUid:
            currentUid(),

            updatedAt:
            serverTimestamp()

        }
        );


        await batch.commit();


        await reloadSelectedPersonWorkspace();


    } catch (error) {

        console.error(
        "NORMEX assignment creation failed:",
        error
        );


        showMessage(
        "personWorkspaceError",
        "The project assignment could not be saved."
        );

    }

    }


    /* =========================================================
    ADD ABSENCE
    ========================================================= */

    async function addPersonAbsence(
    event
    ) {

    event.preventDefault();


    if (
        !selectedPerson
    ) {

        return;

    }


    hideMessage(
        "personWorkspaceError"
    );


    const form =
        new FormData(
        event.currentTarget
        );


    const startDate =
        cleanString(
        form.get(
            "startDate"
        )
        );


    const endDate =
        cleanString(
        form.get(
            "endDate"
        )
        );


    if (
        !startDate ||
        !endDate
    ) {

        showMessage(
        "personWorkspaceError",
        "Start date and end date are required."
        );

        return;

    }


    if (
        parseDate(
        endDate
        ) <
        parseDate(
            startDate
        )
    ) {

        showMessage(
        "personWorkspaceError",
        "Absence end date cannot be before its start date."
        );

        return;

    }


    try {

        const reference =
        doc(
            collection(
            db,
            "peopleAbsences"
            )
        );


        const batch =
        writeBatch(
            db
        );


        batch.set(
        reference,
        {

            organisationId,

            personId:
            selectedPerson.id,

            absenceType:
            cleanString(
                form.get(
                "absenceType"
                )
            ) ||
            "OTHER",

            startDate,

            endDate,

            status:
            "APPROVED",

            createdByUid:
            currentUid(),

            createdByName:
            currentUserName(),

            createdAt:
            serverTimestamp(),

            updatedByUid:
            currentUid(),

            updatedAt:
            serverTimestamp()

        }
        );


        await batch.commit();


        await reloadSelectedPersonWorkspace();


    } catch (error) {

        console.error(
        "NORMEX absence creation failed:",
        error
        );


        showMessage(
        "personWorkspaceError",
        "The absence record could not be saved."
        );

    }

    }


    /* =========================================================
    RELOAD SELECTED PERSON
    ========================================================= */

    async function reloadSelectedPersonWorkspace() {

    const personId =
        selectedPerson?.id;


    hideInlineForms();


    await loadEverything();


    selectedPerson =
        personId
        ? peopleById.get(
            personId
            ) ||
            null
        : null;


    if (
        selectedPerson
    ) {

        renderPersonWorkspace();

    }

    }


    /* =========================================================
    INLINE FORMS
    ========================================================= */

    function hideInlineForms() {

    [
        "addCapabilityForm",
        "addAssignmentForm",
        "addAbsenceForm"
    ].forEach(
        (id) => {

        const element =
            getElement(
            id
            );


        if (
            element
        ) {

            element.hidden =
            true;

        }

        }
    );


    getElement(
        "addCapabilityForm"
    )?.reset();


    getElement(
        "addAssignmentForm"
    )?.reset();


    getElement(
        "addAbsenceForm"
    )?.reset();

    }


    /* =========================================================
    DATE RANGE FORMAT
    ========================================================= */

    function formatDateRange(
    start,
    end
    ) {

    if (
        !start &&
        !end
    ) {

        return "Ongoing";

    }


    if (
        start &&
        !end
    ) {

        return `From ${formatDate(
        start
        )}`;

    }


    if (
        !start &&
        end
    ) {

        return `Until ${formatDate(
        end
        )}`;

    }


    return `${formatDate(
        start
    )} - ${formatDate(
        end
    )}`;

    }
    /* =========================================================
    RESTORED PEOPLE SUPPORT FUNCTIONS

    Modal control
    Register
    Person workspace
    Capability creation
    Filters
    Formatting
    Attention helpers
    ========================================================= */


    /* =========================================================
    FORMAT DATE
    ========================================================= */

    function formatDate(
    value
    ) {

    const date =
        parseDate(
        value
        );


    if (
        !date
    ) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        "en-GB",
        {
        day:
            "2-digit",

        month:
            "short",

        year:
            "numeric"
        }
    ).format(
        date
    );

    }


    /* =========================================================
    LONG DATE
    ========================================================= */

    function formatLongDate(
    value
    ) {

    const date =
        parseDate(
        value
        );


    if (
        !date
    ) {

        return "";

    }


    return new Intl.DateTimeFormat(
        "en-GB",
        {
        weekday:
            "short",

        day:
            "2-digit",

        month:
            "short",

        year:
            "numeric"
        }
    ).format(
        date
    );

    }


    /* =========================================================
    MONTH / YEAR
    ========================================================= */

    function formatMonthYear(
    value
    ) {

    const date =
        parseDate(
        value
        );


    if (
        !date
    ) {

        return "";

    }


    return new Intl.DateTimeFormat(
        "en-GB",
        {
        month:
            "long",

        year:
            "numeric"
        }
    ).format(
        date
    );

    }


    /* =========================================================
    STATUS LABEL
    ========================================================= */

    function formatStatus(
    value
    ) {

    const text =
        cleanString(
        value
        );


    if (
        !text
    ) {

        return "";

    }


    return text
        .replaceAll(
        "_",
        " "
        )
        .toLowerCase()
        .replace(
        /\b\w/g,
        (letter) =>
            letter.toUpperCase()
        );

    }


    /* =========================================================
    SHORT NAME
    ========================================================= */

    function shortenName(
    value
    ) {

    const name =
        cleanString(
        value
        );


    if (
        name.length <=
        28
    ) {

        return name;

    }


    return `${name.slice(
        0,
        27
    )}…`;

    }


    /* =========================================================
    ESCAPE HTML
    ========================================================= */

    function escapeHtml(
    value
    ) {

    return String(
        value ?? ""
    )
        .replaceAll(
        "&",
        "&amp;"
        )
        .replaceAll(
        "<",
        "&lt;"
        )
        .replaceAll(
        ">",
        "&gt;"
        )
        .replaceAll(
        '"',
        "&quot;"
        )
        .replaceAll(
        "'",
        "&#039;"
        );

    }


    /* =========================================================
    ATTENTION SEVERITY
    ========================================================= */

    function severityPriority(
    severity
    ) {

    if (
        severity ===
        "HIGH"
    ) {

        return 0;

    }


    if (
        severity ===
        "WATCH"
    ) {

        return 1;

    }


    return 2;

    }


    /* =========================================================
    DEDUPLICATE ATTENTION
    ========================================================= */

    function deduplicateAttentionItems(
    items
    ) {

    const seen =
        new Set();


    return items.filter(
        (item) => {

        const key =
            [
            item.severity,
            item.title,
            item.detail,
            item.personId
            ]
            .map(
                (value) =>
                cleanString(
                    value
                )
            )
            .join(
                "|"
            );


        if (
            seen.has(
            key
            )
        ) {

            return false;

        }


        seen.add(
            key
        );


        return true;

        }
    );

    }


    /* =========================================================
    ADD PERSON MODAL
    ========================================================= */

    function openAddPersonModal() {

    const modal =
        getElement(
        "addPersonModal"
        );


    if (
        !modal
    ) {

        return;

    }


    hideMessage(
        "addPersonError"
    );


    modal.hidden =
        false;


    requestAnimationFrame(
        () => {

        getElement(
            "personFirstName"
        )?.focus();

        }
    );

    }


    function closeAddPersonModal() {

    const modal =
        getElement(
        "addPersonModal"
        );


    if (
        modal
    ) {

        modal.hidden =
        true;

    }


    getElement(
        "addPersonForm"
    )?.reset();


    hideMessage(
        "addPersonError"
    );

    }


    /* =========================================================
    CREATE PERSON
    ========================================================= */

    async function createPerson(
    event
    ) {

    event.preventDefault();


    hideMessage(
        "addPersonError"
    );


    const firstName =
        cleanString(
        getElement(
            "personFirstName"
        )?.value
        );


    const lastName =
        cleanString(
        getElement(
            "personLastName"
        )?.value
        );


    if (
        !firstName ||
        !lastName
    ) {

        showMessage(
        "addPersonError",
        "First name and last name are required."
        );


        return;

    }


    const displayName =
        `${firstName} ${lastName}`;


    const reference =
        doc(
        collection(
            db,
            "people"
        )
        );


    try {

        const batch =
        writeBatch(
            db
        );


        batch.set(
        reference,
        {

            organisationId,

            linkedUserUid:
            null,

            firstName,

            lastName,

            displayName,

            employeeNumber:
            nullableString(
                getElement(
                "personEmployeeNumber"
                )?.value
            ),

            employmentStatus:
            cleanString(
                getElement(
                "personEmploymentStatus"
                )?.value
            )
            ||
            "ACTIVE",

            primaryRole:
            nullableString(
                getElement(
                "personPrimaryRole"
                )?.value
            ),

            department:
            nullableString(
                getElement(
                "personDepartment"
                )?.value
            ),

            employmentType:
            nullableString(
                getElement(
                "personEmploymentType"
                )?.value
            ),

            normalWorkingPattern:
            nullableString(
                getElement(
                "personNormalWorkingPattern"
                )?.value
            ),

            saturdayAvailable:
            cleanString(
                getElement(
                "personSaturdayAvailable"
                )?.value
            )
            ||
            "ASK",

            sundayAvailable:
            cleanString(
                getElement(
                "personSundayAvailable"
                )?.value
            )
            ||
            "ASK",

            notes:
            nullableString(
                getElement(
                "personNotes"
                )?.value
            ),

            active:
            true,

            createdByUid:
            currentUid(),

            createdByName:
            currentUserName(),

            createdAt:
            serverTimestamp(),

            updatedByUid:
            currentUid(),

            updatedAt:
            serverTimestamp()

        }
        );


        await batch.commit();


        closeAddPersonModal();


        await loadEverything();


    } catch (error) {

        console.error(
        "NORMEX person creation failed:",
        error
        );


        showMessage(
        "addPersonError",
        "The person could not be saved."
        );

    }

    }


    /* =========================================================
    OPEN PERSON BUTTONS
    ========================================================= */

    function bindOpenPersonButtons(
    root = document
    ) {

    root
        .querySelectorAll(
        "[data-open-person]"
        )
        .forEach(
        (button) => {

            button.addEventListener(
            "click",
            () => {

                const personId =
                button.dataset.openPerson;


                openPersonWorkspace(
                personId
                );

            }
            );

        }
        );

    }


    /* =========================================================
    PERSON WORKSPACE
    ========================================================= */

    function openPersonWorkspace(
    personId
    ) {

    selectedPerson =
        peopleById.get(
        personId
        )
        ||
        null;


    if (
        !selectedPerson
    ) {

        return;

    }


    renderPersonWorkspace();


    const modal =
        getElement(
        "personWorkspaceModal"
        );


    if (
        modal
    ) {

        modal.hidden =
        false;

    }

    }


    function closePersonWorkspace() {

    const modal =
        getElement(
        "personWorkspaceModal"
        );


    if (
        modal
    ) {

        modal.hidden =
        true;

    }


    selectedPerson =
        null;


    hideInlineForms();


    hideMessage(
        "personWorkspaceError"
    );

    }


    /* =========================================================
    RENDER PERSON WORKSPACE
    ========================================================= */

    function renderPersonWorkspace() {

    if (
        !selectedPerson
    ) {

        return;

    }


    const person =
        selectedPerson;


    const currentAssignment =
        getCurrentAssignment(
        person.id
        );


    const currentAbsence =
        getCurrentAbsence(
        person.id
        );


    const personCapabilities =
        getPersonCapabilities(
        person.id
        );


    const personAssignments =
        getPersonAssignments(
        person.id
        )
        .slice()
        .sort(
            compareAssignmentStarts
        );


    const personAbsences =
        getPersonAbsences(
        person.id
        )
        .slice()
        .sort(
            (a, b) =>
            dateMilliseconds(
                parseDate(
                b.startDate
                )
            )
            -
            dateMilliseconds(
                parseDate(
                a.startDate
                )
            )
        );


    setText(
        "personWorkspaceReference",
        person.employeeNumber ||
        "No internal reference"
    );


    setText(
        "personWorkspaceName",
        person.displayName ||
        "Person"
    );


    setText(
        "personWorkspaceRole",
        [
        person.primaryRole,
        person.department
        ]
        .filter(
            Boolean
        )
        .join(
            " · "
        )
        ||
        "No primary role recorded"
    );


    const summary =
        getElement(
        "personWorkspaceSummary"
        );


    if (
        summary
    ) {

        summary.innerHTML = `

        <article>

            <span>
            Position
            </span>

            <strong>
            ${escapeHtml(
                formatStatus(
                getPersonAvailability(
                    person
                )
                )
            )}
            </strong>

        </article>


        <article>

            <span>
            Current Project
            </span>

            <strong>
            ${escapeHtml(
                currentAssignment
                ? getProjectName(
                    currentAssignment.projectId
                    )
                : "Not deployed"
            )}
            </strong>

        </article>


        <article>

            <span>
            Current Absence
            </span>

            <strong>
            ${escapeHtml(
                currentAbsence
                ? formatStatus(
                    currentAbsence.absenceType
                    )
                : "None"
            )}
            </strong>

        </article>


        <article>

            <span>
            Employment
            </span>

            <strong>
            ${escapeHtml(
                formatStatus(
                person.employmentStatus ||
                "ACTIVE"
                )
            )}
            </strong>

        </article>

        `;

    }


    const capabilitiesRoot =
        getElement(
        "personCapabilities"
        );


    if (
        capabilitiesRoot
    ) {

        capabilitiesRoot.innerHTML =
        personCapabilities.length

            ? personCapabilities
                .map(
                (capability) => `

                    <span
                    class="people-mini-chip"
                    title="${
                        capability.expiryDate
                        ? `Expires ${escapeHtml(
                            formatDate(
                                capability.expiryDate
                            )
                            )}`
                        : "No expiry date"
                    }"
                    >

                    ${escapeHtml(
                        getCapabilityLabel(
                        capability.capabilityCode
                        )
                    )}

                    </span>

                `
                )
                .join("")

            : `

            <div class="people-empty people-empty--compact">
                No capability records.
            </div>

            `;

    }


    const assignmentsRoot =
        getElement(
        "personAssignments"
        );


    if (
        assignmentsRoot
    ) {

        assignmentsRoot.innerHTML =
        personAssignments.length

            ? personAssignments
                .map(
                (assignment) => `

                    <article class="person-record">

                    <div>

                        <strong>

                        ${escapeHtml(
                            getProjectName(
                            assignment.projectId
                            )
                        )}

                        </strong>

                        <span>

                        ${escapeHtml(
                            assignment.roleOnProject ||
                            person.primaryRole ||
                            "Assigned"
                        )}

                        </span>

                    </div>


                    <div>

                        <strong>

                        ${escapeHtml(
                            formatDateRange(
                            assignment.assignedFrom,
                            assignment.assignedUntil
                            )
                        )}

                        </strong>

                        <span>

                        ${escapeHtml(
                            formatStatus(
                            assignment.status ||
                            "ACTIVE"
                            )
                        )}

                        </span>

                    </div>

                    </article>

                `
                )
                .join("")

            : `

            <div class="people-empty people-empty--compact">
                No project assignments.
            </div>

            `;

    }


    const absencesRoot =
        getElement(
        "personAbsences"
        );


    if (
        absencesRoot
    ) {

        absencesRoot.innerHTML =
        personAbsences.length

            ? personAbsences
                .map(
                (absence) => `

                    <article class="person-record">

                    <div>

                        <strong>

                        ${escapeHtml(
                            formatStatus(
                            absence.absenceType ||
                            "OTHER"
                            )
                        )}

                        </strong>

                        <span>

                        ${escapeHtml(
                            formatStatus(
                            absence.status ||
                            "APPROVED"
                            )
                        )}

                        </span>

                    </div>


                    <div>

                        <strong>

                        ${escapeHtml(
                            formatDateRange(
                            absence.startDate,
                            absence.endDate
                            )
                        )}

                        </strong>

                    </div>

                    </article>

                `
                )
                .join("")

            : `

            <div class="people-empty people-empty--compact">
                No leave or absence records.
            </div>

            `;

    }


    renderCapabilityOptions();


    renderAssignmentProjectOptions();

    }


    /* =========================================================
    CAPABILITY OPTIONS
    ========================================================= */

    function renderCapabilityOptions() {

    const select =
        getElement(
        "personCapabilityCode"
        );


    if (
        !select
    ) {

        return;

    }


    const options =
        PEOPLE_CAPABILITIES
        .map(
            (item) => {

            const code =
                item.code ||
                item.capabilityCode ||
                item.id;


            if (
                !code
            ) {

                return null;

            }


            return {

                code,

                label:
                item.label ||
                getCapabilityLabel(
                    code
                )

            };

            }
        )
        .filter(
            Boolean
        )
        .sort(
            (a, b) =>
            a.label.localeCompare(
                b.label
            )
        );


    select.innerHTML = `

        <option value="">
        Select Capability
        </option>

        ${options
        .map(
            (option) => `

            <option
                value="${escapeHtml(
                option.code
                )}"
            >

                ${escapeHtml(
                option.label
                )}

            </option>

            `
        )
        .join("")}

    `;

    }


    /* =========================================================
    ADD CAPABILITY
    ========================================================= */

    async function addPersonCapability(
    event
    ) {

    event.preventDefault();


    if (
        !selectedPerson
    ) {

        return;

    }


    hideMessage(
        "personWorkspaceError"
    );


    const capabilityCode =
        cleanString(
        getElement(
            "personCapabilityCode"
        )?.value
        );


    const expiryDate =
        nullableString(
        getElement(
            "personCapabilityExpiry"
        )?.value
        );


    if (
        !capabilityCode
    ) {

        showMessage(
        "personWorkspaceError",
        "Select a capability."
        );


        return;

    }


    const duplicate =
        getPersonCapabilities(
        selectedPerson.id
        ).some(
        (capability) =>
            capability.capabilityCode ===
            capabilityCode
        );


    if (
        duplicate
    ) {

        showMessage(
        "personWorkspaceError",
        "This capability is already recorded for this person."
        );


        return;

    }


    try {

        const reference =
        doc(
            collection(
            db,
            "peopleCapabilities"
            )
        );


        const batch =
        writeBatch(
            db
        );


        batch.set(
        reference,
        {

            organisationId,

            personId:
            selectedPerson.id,

            capabilityCode,

            expiryDate,

            active:
            true,

            createdByUid:
            currentUid(),

            createdByName:
            currentUserName(),

            createdAt:
            serverTimestamp(),

            updatedByUid:
            currentUid(),

            updatedAt:
            serverTimestamp()

        }
        );


        await batch.commit();


        await reloadSelectedPersonWorkspace();


    } catch (error) {

        console.error(
        "NORMEX capability creation failed:",
        error
        );


        showMessage(
        "personWorkspaceError",
        "The capability could not be saved."
        );

    }

    }


    /* =========================================================
    PROJECT REGISTER FILTER
    ========================================================= */

    function renderProjectFilter() {

    const select =
        getElement(
        "peopleProjectFilter"
        );


    if (
        !select
    ) {

        return;

    }


    const selected =
        select.value;


    select.innerHTML = `

        <option value="">
        All Projects
        </option>

        ${projects
        .slice()
        .sort(
            (a, b) =>
            String(
                a.name ||
                ""
            ).localeCompare(
                String(
                b.name ||
                ""
                )
            )
        )
        .map(
            (project) => `

            <option
                value="${escapeHtml(
                project.id
                )}"
            >

                ${escapeHtml(
                project.name ||
                "Project"
                )}

            </option>

            `
        )
        .join("")}

    `;


    select.value =
        selected;

    }


    /* =========================================================
    PEOPLE REGISTER FILTERS
    ========================================================= */

    function applyPeopleFilters() {

    const search =
        cleanString(
        getElement(
            "peopleSearchInput"
        )?.value
        ).toLowerCase();


    const status =
        cleanString(
        getElement(
            "peopleStatusFilter"
        )?.value
        );


    const projectId =
        cleanString(
        getElement(
            "peopleProjectFilter"
        )?.value
        );


    const availability =
        cleanString(
        getElement(
            "peopleAvailabilityFilter"
        )?.value
        );


    const filtered =
        people.filter(
        (person) => {

            const personCapabilities =
            getPersonCapabilities(
                person.id
            );


            const personAssignments =
            getPersonAssignments(
                person.id
            );


            const searchText =
            [
                person.displayName,
                person.employeeNumber,
                person.primaryRole,
                person.department,

                ...personCapabilities.map(
                (capability) =>
                    getCapabilityLabel(
                    capability.capabilityCode
                    )
                ),

                ...personAssignments.map(
                (assignment) =>
                    getProjectName(
                    assignment.projectId
                    )
                )
            ]
                .filter(
                Boolean
                )
                .join(
                " "
                )
                .toLowerCase();


            const projectMatch =
            !projectId
            ||
            personAssignments.some(
                (assignment) =>
                assignment.projectId ===
                    projectId
            );


            return (

            (
                !search
                ||
                searchText.includes(
                search
                )
            )

            &&

            (
                !status
                ||
                person.employmentStatus ===
                status
            )

            &&

            projectMatch

            &&

            (
                !availability
                ||
                getPersonAvailability(
                person
                ) ===
                availability
            )

            );

        }
        );


    renderPeopleRegister(
        filtered
    );

    }


    /* =========================================================
    PEOPLE REGISTER
    ========================================================= */

    function renderPeopleRegister(
    records
    ) {

    const root =
        getElement(
        "peopleRegister"
        );


    if (
        !root
    ) {

        return;

    }


    setText(
        "peopleRegisterCount",
        `${records.length} ${
        records.length ===
            1
            ? "person"
            : "people"
        }`
    );


    if (
        !records.length
    ) {

        root.innerHTML = `

        <div class="people-empty">

            No people match this view.

        </div>

        `;


        return;

    }


    root.innerHTML = `

        <table class="people-table">

        <thead>

            <tr>

            <th>
                Person
            </th>

            <th>
                Primary Role
            </th>

            <th>
                Current Project
            </th>

            <th>
                Key Capabilities
            </th>

            <th>
                Availability
            </th>

            <th>
                Weekend
            </th>

            <th>
                Status
            </th>

            <th></th>

            </tr>

        </thead>


        <tbody>

            ${records
            .map(
                renderPersonRegisterRow
            )
            .join("")}

        </tbody>

        </table>

    `;


    bindOpenPersonButtons(
        root
    );

    }


    /* =========================================================
    REGISTER ROW
    ========================================================= */

    function renderPersonRegisterRow(
    person
    ) {

    const assignment =
        getCurrentAssignment(
        person.id
        );


    const capabilityRecords =
        getPersonCapabilities(
        person.id
        )
        .filter(
            (capability) =>
            !isCapabilityExpired(
                capability
            )
        )
        .slice(
            0,
            3
        );


    return `

        <tr>

        <td class="people-name">

            <strong>

            ${escapeHtml(
                person.displayName ||
                "Unnamed person"
            )}

            </strong>

            <span>

            ${escapeHtml(
                person.employeeNumber ||
                "No internal reference"
            )}

            </span>

        </td>


        <td>

            ${escapeHtml(
            person.primaryRole ||
            "Not assigned"
            )}

        </td>


        <td>

            ${escapeHtml(
            assignment
                ? getProjectName(
                    assignment.projectId
                )
                : "Not deployed"
            )}

        </td>


        <td>

            <div class="people-capability-inline">

            ${
                capabilityRecords.length

                ? capabilityRecords
                    .map(
                        (capability) => `

                        <span class="people-mini-chip">

                            ${escapeHtml(
                            getCapabilityLabel(
                                capability.capabilityCode
                            )
                            )}

                        </span>

                        `
                    )
                    .join("")

                : "—"
            }

            </div>

        </td>


        <td>

            ${renderAvailabilityChip(
            getPersonAvailability(
                person
            )
            )}

        </td>


        <td>

            ${escapeHtml(
            formatWeekendAvailability(
                person
            )
            )}

        </td>


        <td>

            ${renderEmploymentStatusChip(
            person.employmentStatus
            )}

        </td>


        <td>

            <button
            class="people-small-action"
            type="button"
            data-open-person="${escapeHtml(
                person.id
            )}"
            >

            Open

            </button>

        </td>

        </tr>

    `;

    }


    /* =========================================================
    AVAILABILITY CHIP
    ========================================================= */

    function renderAvailabilityChip(
    status
    ) {

    const normalised =
        cleanString(
        status
        )
        ||
        "UNAVAILABLE";


    let className =
        "is-unavailable";


    if (
        normalised ===
        "AVAILABLE"
    ) {

        className =
        "is-available";

    }


    if (
        normalised ===
        "DEPLOYED"
    ) {

        className =
        "is-deployed";

    }


    return `

        <span
        class="
            people-availability-chip
            ${className}
        "
        >

        ${escapeHtml(
            formatStatus(
            normalised
            )
        )}

        </span>

    `;

    }


    /* =========================================================
    EMPLOYMENT STATUS CHIP
    ========================================================= */

    function renderEmploymentStatusChip(
    status
    ) {

    return `

        <span class="people-availability-chip">

        ${escapeHtml(
            formatStatus(
            status ||
            "ACTIVE"
            )
        )}

        </span>

    `;

    }


    /* =========================================================
    WEEKEND AVAILABILITY
    ========================================================= */

    function formatWeekendAvailability(
    person
    ) {

    const saturday =
        cleanString(
        person.saturdayAvailable
        )
        ||
        "ASK";


    const sunday =
        cleanString(
        person.sundayAvailable
        )
        ||
        "ASK";


    if (
        saturday ===
        "YES"
        &&
        sunday ===
        "YES"
    ) {

        return "Sat + Sun";

    }


    if (
        saturday ===
        "YES"
    ) {

        return "Saturday";

    }


    if (
        sunday ===
        "YES"
    ) {

        return "Sunday";

    }


    if (
        saturday ===
        "NO"
        &&
        sunday ===
        "NO"
    ) {

        return "No";

    }


    return "Confirm";

    }

    /* =========================================================
    MESSAGES
    ========================================================= */

    function hideMessage(
    id
    ) {

    const element =
        getElement(
        id
        );


    if (
        element
    ) {

        element.hidden =
        true;

    }

    }


    function showMessage(
    id,
    message
    ) {

    const element =
        getElement(
        id
        );


    if (
        !element
    ) {

        return;

    }


    element.textContent =
        message;


    element.hidden =
        false;

    }


    /* =========================================================
    EVENTS
    ========================================================= */

    function bindEvents() {

    getElement(
        "addPersonButton"
    )?.addEventListener(
        "click",
        openAddPersonModal
    );


    getElement(
        "closeAddPersonModal"
    )?.addEventListener(
        "click",
        closeAddPersonModal
    );


    getElement(
        "cancelAddPerson"
    )?.addEventListener(
        "click",
        closeAddPersonModal
    );


    getElement(
        "addPersonBackdrop"
    )?.addEventListener(
        "click",
        closeAddPersonModal
    );


    getElement(
        "addPersonForm"
    )?.addEventListener(
        "submit",
        createPerson
    );


    getElement(
        "peopleContextProject"
    )?.addEventListener(
        "change",
        (event) => {

        activeContextProjectId =
            event.target.value;


        const registerProjectFilter =
            getElement(
            "peopleProjectFilter"
            );


        if (
            registerProjectFilter
        ) {

            registerProjectFilter.value =
            activeContextProjectId;

        }


        renderEverything();

        }
    );


    getElement(
        "peopleQuickSearch"
    )?.addEventListener(
        "input",
        (event) => {

        const registerSearch =
            getElement(
            "peopleSearchInput"
            );


        if (
            registerSearch
        ) {

            registerSearch.value =
            event.target.value;

        }


        applyPeopleFilters();

        }
    );


    getElement(
        "availabilityPreviousButton"
    )?.addEventListener(
        "click",
        () => {

        availabilityMonthCursor =
    addDays(
        availabilityMonthCursor,
        -48
    );


        renderAvailabilityCalendar();

        }
    );


    getElement(
        "availabilityNextButton"
    )?.addEventListener(
        "click",
        () => {

        availabilityMonthCursor =
    addDays(
        availabilityMonthCursor,
        48
    );


        renderAvailabilityCalendar();

        }
    );


    getElement(
        "availabilityCapabilityFilter"
    )?.addEventListener(
        "change",
        renderAvailabilityCalendar
    );


    getElement(
        "availabilityStatusFilter"
    )?.addEventListener(
        "change",
        renderAvailabilityCalendar
    );


    getElement(
        "peopleSearchInput"
    )?.addEventListener(
        "input",
        (event) => {

        const quickSearch =
            getElement(
            "peopleQuickSearch"
            );


        if (
            quickSearch
        ) {

            quickSearch.value =
            event.target.value;

        }


        applyPeopleFilters();

        }
    );


    getElement(
        "peopleStatusFilter"
    )?.addEventListener(
        "change",
        applyPeopleFilters
    );


    getElement(
        "peopleProjectFilter"
    )?.addEventListener(
        "change",
        applyPeopleFilters
    );


    getElement(
        "peopleAvailabilityFilter"
    )?.addEventListener(
        "change",
        applyPeopleFilters
    );


    getElement(
        "closePersonWorkspace"
    )?.addEventListener(
        "click",
        closePersonWorkspace
    );


    getElement(
        "personWorkspaceBackdrop"
    )?.addEventListener(
        "click",
        closePersonWorkspace
    );


    getElement(
        "showAddCapabilityButton"
    )?.addEventListener(
        "click",
        () => {

        hideInlineForms();


        renderCapabilityOptions();


        const form =
            getElement(
            "addCapabilityForm"
            );


        if (
            form
        ) {

            form.hidden =
            false;

        }

        }
    );


    getElement(
        "cancelAddCapability"
    )?.addEventListener(
        "click",
        hideInlineForms
    );


    getElement(
        "addCapabilityForm"
    )?.addEventListener(
        "submit",
        addPersonCapability
    );


    getElement(
        "showAddAssignmentButton"
    )?.addEventListener(
        "click",
        () => {

        hideInlineForms();


        renderAssignmentProjectOptions();


        const form =
            getElement(
            "addAssignmentForm"
            );


        if (
            form
        ) {

            form.hidden =
            false;

        }

        }
    );


    getElement(
        "cancelAddAssignment"
    )?.addEventListener(
        "click",
        hideInlineForms
    );


    getElement(
        "addAssignmentForm"
    )?.addEventListener(
        "submit",
        addPersonAssignment
    );


    getElement(
        "showAddAbsenceButton"
    )?.addEventListener(
        "click",
        () => {

        hideInlineForms();


        const form =
            getElement(
            "addAbsenceForm"
            );


        if (
            form
        ) {

            form.hidden =
            false;

        }

        }
    );


    getElement(
        "cancelAddAbsence"
    )?.addEventListener(
        "click",
        hideInlineForms
    );


    getElement(
        "addAbsenceForm"
    )?.addEventListener(
        "submit",
        addPersonAbsence
    );

    }


    /* =========================================================
    START
    ========================================================= */

    waitForWorkspace();