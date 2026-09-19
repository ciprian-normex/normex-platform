/* =========================================================
   NORMEX
   PEOPLE CAPABILITY CATALOGUE
========================================================= */

export const PEOPLE_CAPABILITIES = [

  {
    code: "SITE_MANAGER",
    label: "Site Manager",
    group: "Management"
  },

  {
    code: "PROJECT_MANAGER",
    label: "Project Manager",
    group: "Management"
  },

  {
    code: "LOGISTICS_MANAGER",
    label: "Logistics Manager",
    group: "Management"
  },

  {
    code: "HEALTH_SAFETY",
    label: "Health & Safety",
    group: "Management"
  },

  {
    code: "DEMOLITION_OPERATIVE",
    label: "Demolition Operative",
    group: "Demolition"
  },

  {
    code: "MANUAL_STRIPOUT",
    label: "Manual Stripout",
    group: "Demolition"
  },

  {
    code: "BURNER",
    label: "Burner / Hot Works",
    group: "Demolition"
  },

  {
    code: "EXCAVATOR_OPERATOR",
    label: "Excavator Operator",
    group: "Plant"
  },

  {
    code: "HIGH_REACH_EXCAVATOR",
    label: "High-Reach Excavator",
    group: "Plant"
  },

  {
    code: "MUNCHING",
    label: "Excavator Munching",
    group: "Plant"
  },

  {
    code: "TELEHANDLER_OPERATOR",
    label: "Telehandler Operator",
    group: "Plant"
  },

  {
    code: "BOBCAT_OPERATOR",
    label: "Bobcat Operator",
    group: "Plant"
  },

  {
    code: "MEWP_OPERATOR",
    label: "MEWP Operator",
    group: "Plant"
  },

  {
    code: "IPAF_3A",
    label: "IPAF 3A",
    group: "Access"
  },

  {
    code: "IPAF_3B",
    label: "IPAF 3B",
    group: "Access"
  },

  {
    code: "IPAF_3A_3B",
    label: "IPAF 3A / 3B",
    group: "Access"
  },

  {
    code: "BANKSMAN",
    label: "Banksman",
    group: "Logistics"
  },

  {
    code: "SLINGER_SIGNALLER",
    label: "Slinger / Signaller",
    group: "Lifting"
  },

  {
    code: "LIFT_SUPERVISOR",
    label: "Lift Supervisor",
    group: "Lifting"
  },

  {
    code: "APPOINTED_PERSON_LIFTING",
    label: "Appointed Person - Lifting",
    group: "Lifting"
  },

  {
    code: "FIRE_WATCHER",
    label: "Fire Watcher",
    group: "Safety"
  },

  {
    code: "FIRST_AIDER",
    label: "First Aider",
    group: "Safety"
  },

  {
    code: "TEMPORARY_WORKS_COORDINATOR",
    label: "Temporary Works Coordinator",
    group: "Temporary Works"
  },

  {
    code: "TEMPORARY_WORKS_SUPERVISOR",
    label: "Temporary Works Supervisor",
    group: "Temporary Works"
  }

];


export function getCapabilityLabel(
  code
) {

  return (
    PEOPLE_CAPABILITIES.find(
      (item) =>
        item.code ===
          code
    )?.label
    ||
    code
    ||
    "Capability"
  );

}


export function getCapabilityGroup(
  code
) {

  return (
    PEOPLE_CAPABILITIES.find(
      (item) =>
        item.code ===
          code
    )?.group
    ||
    "Other"
  );

}


export function getCapabilitiesGrouped() {

  const groups =
    new Map();


  PEOPLE_CAPABILITIES.forEach(
    (item) => {

      if (
        !groups.has(
          item.group
        )
      ) {

        groups.set(
          item.group,
          []
        );

      }


      groups
        .get(
          item.group
        )
        .push(
          item
        );

    }
  );


  return groups;

}