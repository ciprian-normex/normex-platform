/* =========================================================
   NORMEX
   SHARED ROLE MODEL

   Purpose:
   - Single frontend source of truth for role codes
   - Human-readable role labels
   - Functional role relationships
   - Reusable review-assignment logic

   IMPORTANT:
   This file controls application behaviour only.
   Firestore rules remain the actual security boundary.
========================================================= */


/* =========================================================
   ROLE CODES
========================================================= */

export const ROLE_CODES = {

  WORKER:
    "WORKER",

  SUPERVISOR:
    "SUPERVISOR",

  SITE_MANAGER:
    "SITE_MANAGER",

  PROJECT_MANAGER:
    "PROJECT_MANAGER",

  SENIOR_PROJECT_MANAGER:
    "SENIOR_PROJECT_MANAGER",

  HEALTH_SAFETY:
    "HEALTH_SAFETY",

  SENIOR_HEALTH_SAFETY:
    "SENIOR_HEALTH_SAFETY",

  CONTRACTS_MANAGER:
    "CONTRACTS_MANAGER",

  PLANT_TRANSPORT_MANAGER:
    "PLANT_TRANSPORT_MANAGER",

  ORGANISATION_MANAGER:
    "ORGANISATION_MANAGER",

  PLATFORM_ADMIN:
    "PLATFORM_ADMIN"

};


/* =========================================================
   ROLE LABELS
========================================================= */

export const ROLE_LABELS = {

  WORKER:
    "Worker",

  SUPERVISOR:
    "Supervisor",

  SITE_MANAGER:
    "Site Manager",

  PROJECT_MANAGER:
    "Project Manager",

  SENIOR_PROJECT_MANAGER:
    "Senior Project Manager",

  HEALTH_SAFETY:
    "Health & Safety",

  SENIOR_HEALTH_SAFETY:
    "Senior Health & Safety",

  CONTRACTS_MANAGER:
    "Contracts Manager",

  PLANT_TRANSPORT_MANAGER:
    "Plant / Transport Manager",

  ORGANISATION_MANAGER:
    "Organisation Manager",

  PLATFORM_ADMIN:
    "Platform Administration"

};


/* =========================================================
   ACCESS LEVEL REFERENCE

   This is descriptive only.

   We do NOT use this table to decide functional authority.
   A numerically higher access level must not automatically
   inherit an unrelated specialist domain.
========================================================= */

export const ROLE_ACCESS_LEVELS = {

  WORKER:
    0,

  SUPERVISOR:
    1,

  SITE_MANAGER:
    2,

  PROJECT_MANAGER:
    3,

  SENIOR_PROJECT_MANAGER:
    4,

  HEALTH_SAFETY:
    4.5,

  SENIOR_HEALTH_SAFETY:
    4.6,

  CONTRACTS_MANAGER:
    5,

  PLANT_TRANSPORT_MANAGER:
    5.5,

  ORGANISATION_MANAGER:
    6,

  PLATFORM_ADMIN:
    99

};


/* =========================================================
   REVIEW ROLE GROUPS

   These are functional authority relationships.

   Example:
   An item assigned to HEALTH_SAFETY may be reviewed by:
   - Health & Safety
   - Senior Health & Safety
   - Platform Administration

   A Plant / Transport Manager is NOT included merely because
   their numeric access level is higher.
========================================================= */

export const REVIEW_ROLE_AUTHORITY = {

  HEALTH_SAFETY: [

    ROLE_CODES.HEALTH_SAFETY,

    ROLE_CODES.SENIOR_HEALTH_SAFETY,

    ROLE_CODES.PLATFORM_ADMIN

  ],


  SENIOR_HEALTH_SAFETY: [

    ROLE_CODES.SENIOR_HEALTH_SAFETY,

    ROLE_CODES.PLATFORM_ADMIN

  ],


  SITE_MANAGER: [

    ROLE_CODES.SITE_MANAGER,

    ROLE_CODES.PROJECT_MANAGER,

    ROLE_CODES.SENIOR_PROJECT_MANAGER,

    ROLE_CODES.CONTRACTS_MANAGER,

    ROLE_CODES.ORGANISATION_MANAGER,

    ROLE_CODES.PLATFORM_ADMIN

  ],


  PROJECT_MANAGER: [

    ROLE_CODES.PROJECT_MANAGER,

    ROLE_CODES.SENIOR_PROJECT_MANAGER,

    ROLE_CODES.CONTRACTS_MANAGER,

    ROLE_CODES.ORGANISATION_MANAGER,

    ROLE_CODES.PLATFORM_ADMIN

  ],


  SENIOR_PROJECT_MANAGER: [

    ROLE_CODES.SENIOR_PROJECT_MANAGER,

    ROLE_CODES.CONTRACTS_MANAGER,

    ROLE_CODES.ORGANISATION_MANAGER,

    ROLE_CODES.PLATFORM_ADMIN

  ],


  CONTRACTS_MANAGER: [

    ROLE_CODES.CONTRACTS_MANAGER,

    ROLE_CODES.ORGANISATION_MANAGER,

    ROLE_CODES.PLATFORM_ADMIN

  ],


  PLANT_TRANSPORT_MANAGER: [

    ROLE_CODES.PLANT_TRANSPORT_MANAGER,

    ROLE_CODES.ORGANISATION_MANAGER,

    ROLE_CODES.PLATFORM_ADMIN

  ],


  ORGANISATION_MANAGER: [

    ROLE_CODES.ORGANISATION_MANAGER,

    ROLE_CODES.PLATFORM_ADMIN

  ],


  PLATFORM_ADMIN: [

    ROLE_CODES.PLATFORM_ADMIN

  ]

};


/* =========================================================
   REVIEW ASSIGNMENT OPTIONS

   These are the roles currently sensible to expose in a
   generic "Assigned Reviewer Role" dropdown.

   We deliberately do not expose Worker / Supervisor because
   they are not currently review authorities for controlled
   project documents.

   Specialist roles such as:
   - Temporary Works Coordinator
   - Appointed Person
   - Design Manager
   - Engineer

   can be added here later when those roles are introduced.
========================================================= */

export const DOCUMENT_REVIEW_ROLE_CODES = [

  ROLE_CODES.SITE_MANAGER,

  ROLE_CODES.PROJECT_MANAGER,

  ROLE_CODES.SENIOR_PROJECT_MANAGER,

  ROLE_CODES.HEALTH_SAFETY,

  ROLE_CODES.SENIOR_HEALTH_SAFETY,

  ROLE_CODES.CONTRACTS_MANAGER,

  ROLE_CODES.PLANT_TRANSPORT_MANAGER,

  ROLE_CODES.ORGANISATION_MANAGER

];


/* =========================================================
   NORMALISE ROLE CODE

   Existing early NORMEX user records may still contain:

   role: "PLATFORM_ADMIN"

   while the new model uses:

   roleCode: "PLATFORM_ADMIN"

   This helper lets the workspace support both during the
   migration period.
========================================================= */

export function getProfileRoleCode(
  profile
) {

  if (!profile) {

    return null;

  }


  const roleCode =
    String(
      profile.roleCode ||
      profile.role ||
      ""
    )
      .trim()
      .toUpperCase();


  if (!roleCode) {

    /*
     * Level 99 remains an explicit platform override even if
     * an older user record does not yet contain roleCode.
     */

    if (
      Number(
        profile.accessLevel
      ) >= 99
    ) {

      return ROLE_CODES.PLATFORM_ADMIN;

    }


    return null;

  }


  return roleCode;

}


/* =========================================================
   ROLE LABEL
========================================================= */

export function getRoleLabel(
  roleCode
) {

  if (!roleCode) {

    return "Not Assigned";

  }


  return (
    ROLE_LABELS[
      roleCode
    ] ||
    formatRoleCode(
      roleCode
    )
  );

}


/* =========================================================
   CAN ROLE ACTION ASSIGNMENT
========================================================= */

export function canRoleReviewAssignment(
  userRoleCode,
  assignedRoleCode
) {

  if (
    !userRoleCode ||
    !assignedRoleCode
  ) {

    return false;

  }


  /*
   * Platform Administration always has explicit override.
   */

  if (
    userRoleCode ===
      ROLE_CODES.PLATFORM_ADMIN
  ) {

    return true;

  }


  const allowedRoles =
    REVIEW_ROLE_AUTHORITY[
      assignedRoleCode
    ] || [];


  return allowedRoles.includes(
    userRoleCode
  );

}


/* =========================================================
   CAN PROFILE ACTION ASSIGNMENT

   Convenient helper for pages that already have a complete
   NORMEX user profile.
========================================================= */

export function canProfileReviewAssignment(
  profile,
  assignedRoleCode
) {

  if (!profile) {

    return false;

  }


  /*
   * Maintain the explicit Level 99 override.
   */

  if (
    Number(
      profile.accessLevel
    ) >= 99
  ) {

    return true;

  }


  const userRoleCode =
    getProfileRoleCode(
      profile
    );


  return canRoleReviewAssignment(
    userRoleCode,
    assignedRoleCode
  );

}


/* =========================================================
   REVIEW ROLE OPTIONS

   Returns data ready for a select/dropdown.

   Example output:

   [
     {
       value: "PROJECT_MANAGER",
       label: "Project Manager"
     }
   ]
========================================================= */

export function getDocumentReviewRoleOptions() {

  return DOCUMENT_REVIEW_ROLE_CODES
    .map(
      (roleCode) => ({

        value:
          roleCode,

        label:
          getRoleLabel(
            roleCode
          )

      })
    );

}


/* =========================================================
   VALID ROLE
========================================================= */

export function isKnownRoleCode(
  roleCode
) {

  if (!roleCode) {

    return false;

  }


  return Object
    .values(
      ROLE_CODES
    )
    .includes(
      roleCode
    );

}


/* =========================================================
   VALID REVIEW ASSIGNMENT
========================================================= */

export function isValidDocumentReviewRole(
  roleCode
) {

  return DOCUMENT_REVIEW_ROLE_CODES
    .includes(
      roleCode
    );

}


/* =========================================================
   ROLE CODE FORMATTER
========================================================= */

function formatRoleCode(
  value
) {

  return String(
    value ||
    ""
  )
    .toLowerCase()
    .split("_")
    .map(
      (part) =>

        part.charAt(0)
          .toUpperCase() +
        part.slice(1)
    )
    .join(" ");

}