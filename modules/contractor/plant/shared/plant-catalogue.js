/* NORMEX Plant shared catalogue */

export const PLANT_TYPES = Object.freeze([
  { code: "EXCAVATOR", label: "Excavator", prefix: "EXC", group: "EARTHMOVING" },
  { code: "HIGH_REACH_EXCAVATOR", label: "High-Reach Excavator", prefix: "HRE", group: "EARTHMOVING" },
  { code: "TELEHANDLER", label: "Telehandler", prefix: "TEL", group: "MATERIAL_HANDLING" },
  { code: "FORKLIFT", label: "Forklift", prefix: "FLT", group: "MATERIAL_HANDLING" },
  { code: "BOBCAT", label: "Bobcat / Skid Steer", prefix: "BOB", group: "EARTHMOVING" },
  { code: "DUMPER", label: "Dumper", prefix: "DMP", group: "EARTHMOVING" },
  { code: "ROLLER", label: "Roller", prefix: "ROL", group: "EARTHMOVING" },
  { code: "MEWP", label: "MEWP", prefix: "MEW", group: "ACCESS" },
  { code: "SCISSOR_LIFT", label: "Scissor Lift", prefix: "SCL", group: "ACCESS" },
  { code: "BOOM_LIFT", label: "Boom Lift", prefix: "BML", group: "ACCESS" },
  { code: "CRANE", label: "Crane", prefix: "CRN", group: "LIFTING" },
  { code: "MOBILE_CRANE", label: "Mobile Crane", prefix: "MCR", group: "LIFTING" },
  { code: "CRUSHER", label: "Crusher", prefix: "CRS", group: "PROCESSING" },
  { code: "SCREENING_PLANT", label: "Screening Plant", prefix: "SCR", group: "PROCESSING" },
  { code: "GENERATOR", label: "Generator", prefix: "GEN", group: "POWER" },
  { code: "COMPRESSOR", label: "Compressor", prefix: "COM", group: "POWER" },
  { code: "ATTACHMENT", label: "Plant Attachment", prefix: "ATT", group: "ATTACHMENTS" },
  { code: "OTHER", label: "Other Plant", prefix: "PLT", group: "OTHER" }
]);

export const PLANT_OWNERSHIP_TYPES = Object.freeze([
  { code: "OWNED", label: "Owned" },
  { code: "HIRED", label: "Hired" },
  { code: "LEASED", label: "Leased" },
  { code: "CROSS_HIRED", label: "Cross-Hired" },
  { code: "OTHER", label: "Other" }
]);

export const PLANT_STATUSES = Object.freeze([
  { code: "AVAILABLE", label: "Available" },
  { code: "DEPLOYED", label: "Deployed" },
  { code: "RESERVED", label: "Reserved" },
  { code: "AWAITING_TRANSPORT", label: "Awaiting Transport" },
  { code: "IN_TRANSIT", label: "In Transit" },
  { code: "OFF_ROAD", label: "Off Road" },
  { code: "MAINTENANCE", label: "Maintenance" },
  { code: "COMPLIANCE_HOLD", label: "Compliance Hold" },
  { code: "OFF_HIRE_PENDING", label: "Off-Hire Pending" },
  { code: "INACTIVE", label: "Inactive" }
]);

export const PLANT_REQUEST_STATUSES = Object.freeze([
  "REQUESTED", "UNDER_REVIEW", "SOURCING", "RESERVED",
  "PARTIALLY_FULFILLED", "FULFILLED", "DECLINED", "CANCELLED"
]);

export const PLANT_MOVEMENT_STATUSES = Object.freeze([
  "PLANNED", "TRANSPORT_REQUESTED", "BOOKED", "READY_FOR_COLLECTION",
  "IN_TRANSIT", "DELIVERED", "CANCELLED"
]);

export const PLANT_DEFECT_STATUSES = Object.freeze([
  "REPORTED", "TRIAGED", "AWAITING_ENGINEER", "AWAITING_PARTS",
  "REPAIR_IN_PROGRESS", "READY_FOR_TEST", "RETURNED_TO_SERVICE", "CLOSED"
]);

export const PLANT_COMPLIANCE_STATUSES = Object.freeze([
  "CURRENT", "EXPIRING", "EXPIRED", "MISSING", "NOT_APPLICABLE"
]);

export const PLANT_HIRE_RATE_UNITS = Object.freeze(["DAY", "WEEK", "MONTH"]);

export function getPlantType(code) {
  return PLANT_TYPES.find((item) => item.code === code) || null;
}

export function getPlantTypeLabel(code) {
  return getPlantType(code)?.label || String(code || "Plant");
}

export function getPlantPrefix(code) {
  return getPlantType(code)?.prefix || "PLT";
}

export function getPlantOwnershipLabel(code) {
  return PLANT_OWNERSHIP_TYPES.find((item) => item.code === code)?.label || String(code || "");
}

export function getPlantStatusLabel(code) {
  return PLANT_STATUSES.find((item) => item.code === code)?.label || String(code || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
