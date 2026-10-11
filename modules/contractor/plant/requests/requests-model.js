export const REQUEST_TYPES = Object.freeze([
  "PLANT_REQUIRED",
  "SERVICE_REPAIR",
  "MOVEMENT",
  "OFF_HIRE",
  "REPLACEMENT",
  "OTHER"
]);

export const ITEM_ACTION_TYPES = Object.freeze([
  "SERVICE",
  "REPAIR",
  "REPLACE",
  "INVESTIGATE",
  "MOVE",
  "OFF_HIRE",
  "ALLOCATE",
  "OTHER"
]);

export const TERMINAL_ITEM_STATUSES = Object.freeze([
  "COMPLETED",
  "REJECTED",
  "CANCELLED"
]);

const code = (value) => String(value ?? "").trim().toUpperCase();

export function defaultActionType(requestType) {
  return ({
    PLANT_REQUIRED: "ALLOCATE",
    SERVICE_REPAIR: "REPAIR",
    MOVEMENT: "MOVE",
    OFF_HIRE: "OFF_HIRE",
    REPLACEMENT: "REPLACE",
    OTHER: "OTHER"
  })[code(requestType)] || "OTHER";
}

export function deriveParentStatus(items, fallback = "SUBMITTED") {
  const statuses = (Array.isArray(items) ? items : [])
    .map((item) => code(item?.status))
    .filter(Boolean);

  if (!statuses.length) return code(fallback) || "SUBMITTED";
  if (statuses.every((status) => status === "DRAFT")) return "DRAFT";
  if (statuses.every((status) => status === "CANCELLED")) return "CANCELLED";
  if (statuses.every((status) => ["REJECTED", "CANCELLED"].includes(status))) return "REJECTED";
  if (statuses.every((status) => TERMINAL_ITEM_STATUSES.includes(status))) return "COMPLETED";
  if (statuses.some((status) => ["IN_PROGRESS", "COMPLETED"].includes(status))) return "IN_PROGRESS";

  const approved = statuses.filter((status) => status === "APPROVED").length;
  const declined = statuses.filter((status) => ["REJECTED", "DEFERRED", "CANCELLED"].includes(status)).length;
  const pending = statuses.filter((status) => ["SUBMITTED", "UNDER_REVIEW"].includes(status)).length;

  if (approved === statuses.length) return "APPROVED";
  if (approved && (declined || pending)) return "PARTIALLY_APPROVED";
  if (statuses.some((status) => status === "UNDER_REVIEW")) return "UNDER_REVIEW";
  return "SUBMITTED";
}

export function hasDownstreamLinks(request) {
  return (Array.isArray(request?.items) ? request.items : []).some((item) =>
    [
      "linkedDefectId",
      "linkedMaintenanceId",
      "linkedMovementId",
      "linkedAssignmentId",
      "linkedHireRecordId"
    ].some((field) => Boolean(item?.[field]))
  );
}

export function attentionRank(request) {
  const status = code(request?.status);
  if (request?.safetyCritical === true) return 1;
  if (code(request?.priority) === "URGENT") return 2;
  if (["SUBMITTED", "UNDER_REVIEW"].includes(status)) return 3;
  if (status === "PARTIALLY_APPROVED") return 4;
  if (status === "APPROVED") return 5;
  return 6;
}

export function isOpenRequest(request) {
  return !["DRAFT", "COMPLETED", "REJECTED", "CANCELLED"].includes(code(request?.status));
}
