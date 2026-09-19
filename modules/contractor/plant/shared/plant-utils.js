/* NORMEX Plant shared utilities */

import { getPlantPrefix, getPlantStatusLabel, getPlantTypeLabel } from "./plant-catalogue.js";

export const cleanPlantString = (value) => String(value ?? "").trim();
export const nullablePlantString = (value) => cleanPlantString(value) || null;

export function escapePlantHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function parsePlantDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPlantDate(value) {
  const date = parsePlantDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatPlantDateTime(value) {
  const date = parsePlantDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

export function formatCurrencyGBP(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export function buildPlantReference(plantTypeCode, sequence) {
  const numericSequence = Number(sequence);
  if (!Number.isInteger(numericSequence) || numericSequence < 1) {
    throw new Error("A positive integer plant sequence is required.");
  }
  return `${getPlantPrefix(plantTypeCode)}-${String(numericSequence).padStart(4, "0")}`;
}

export function getPlantDisplayName(asset) {
  if (!asset) return "Plant";
  const reference = cleanPlantString(asset.plantReference || asset.normexPlantId);
  const model = [asset.manufacturer, asset.model].map(cleanPlantString).filter(Boolean).join(" ");
  return [reference, model || getPlantTypeLabel(asset.plantType)].filter(Boolean).join(" · ");
}

export function getDerivedPlantStatus(asset) {
  if (!asset || asset.active === false) return "INACTIVE";
  if (asset.safeToUse === false || asset.offRoad === true) return "OFF_ROAD";
  if (asset.complianceHold === true) return "COMPLIANCE_HOLD";
  if (asset.inTransit === true) return "IN_TRANSIT";
  return asset.status || "AVAILABLE";
}

export const getDerivedPlantStatusLabel = (asset) => getPlantStatusLabel(getDerivedPlantStatus(asset));

export function dateRangesOverlap(startA, endA, startB, endB) {
  const aStart = parsePlantDate(startA) || new Date(1900, 0, 1);
  const aEnd = parsePlantDate(endA) || new Date(2999, 11, 31);
  const bStart = parsePlantDate(startB) || new Date(1900, 0, 1);
  const bEnd = parsePlantDate(endB) || new Date(2999, 11, 31);
  return aStart <= bEnd && bStart <= aEnd;
}

export const isHireOwnership = (asset) => ["HIRED", "CROSS_HIRED"].includes(asset?.ownershipType);

export function calculateHireExposure(hireRecord, asAt = new Date()) {
  if (!hireRecord) return null;
  const rate = Number(hireRecord.hireRate);
  if (!Number.isFinite(rate) || rate < 0) return null;
  const start = parsePlantDate(hireRecord.hireStartDate);
  const end = parsePlantDate(hireRecord.offHireConfirmedDate || hireRecord.hireEndDate) || asAt;
  if (!start || end < start) return null;
  const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
  const unit = hireRecord.hireRateUnit || "WEEK";
  let units = days;
  if (unit === "WEEK") units = days / 7;
  if (unit === "MONTH") units = days / 30.4375;
  return { days, units, estimatedCost: units * rate };
}
