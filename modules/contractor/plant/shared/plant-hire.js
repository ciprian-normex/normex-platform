/* Shared hire estimates. Calendar dates use the operating organisation's UK day.
 * These are estimates, not invoices: existing monthly conversion factors retained.
 */
const code = value => String(value ?? "").trim().toUpperCase();
export const isHireOwnership = value => ["HIRED", "LEASED", "CROSS_HIRED"].includes(code(value?.ownershipType ?? value));

export function calendarDay(value) {
  if (value == null || value === "" || typeof value === "boolean") return null;
  try {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() / 86400000 : null;
    }
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = type => parts.find(item => item.type === type).value;
    return Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day"))) / 86400000;
  } catch { return null; }
}

export function validHireRate(value) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

export function weeklyHireRate(rate, unit) {
  const value = validHireRate(rate);
  if (value === null) return null;
  let weekly;
  switch (code(unit)) {
    case "DAY": weekly = value * 7; break;
    case "WEEK": weekly = value; break;
    case "MONTH": weekly = value * 12 / 52; break;
    default: return null;
  }
  return Number.isFinite(weekly) ? weekly : null;
}

export function calculateHire(record, today = new Date()) {
  const unknown = reason => ({ state: "UNKNOWN", reason, days: null, estimatedCost: null, weekly: null });
  if (!record) return unknown("Hire record unavailable");
  const start = calendarDay(record.hireStartDate);
  const end = calendarDay(record.offHireConfirmedDate ?? today);
  if (start === null || end === null || end < start) return unknown("Hire dates invalid or unavailable");
  const days = end - start + 1;
  const rate = validHireRate(record.hireRate);
  const weekly = weeklyHireRate(record.hireRate, record.hireRateUnit);
  if (rate === null || weekly === null) return { ...unknown("Hire rate or unit unknown"), days };
  const divisor = { DAY: 1, WEEK: 7, MONTH: 30.4375 }[code(record.hireRateUnit)];
  const estimatedCost = days / divisor * rate;
  if (!Number.isFinite(estimatedCost) || !Number.isFinite(weekly)) return unknown("Hire estimate outside supported range");
  return { state: "KNOWN", days, estimatedCost, weekly, reason: "Estimated hire charges only" };
}

export function belongsToAsset(record, asset) {
  if (!asset?.organisationId || record?.organisationId !== asset.organisationId) return false;
  if (record.assetKey) return record.assetKey === asset.id;
  const keys = [asset.id, asset.plantId, asset.plantReference].filter(Boolean);
  return [record.plantId, record.plantReference, record.assetId].some(key => key && keys.includes(key));
}

export function selectHire(asset, records, { complete = true } = {}) {
  const related = records.filter(record => belongsToAsset(record, asset));
  const active = related.filter(record => ["ACTIVE", "OFF_HIRE_REQUESTED"].includes(code(record.status)) && !record.offHireConfirmedDate);
  const pointer = asset?.currentHireRecordId;
  if (pointer) {
    const record = related.find(item => item.id === pointer);
    if (record && !active.includes(record) && active.length) return { state: "UNKNOWN", record: null, reason: "Current hire reference conflicts with active hire records" };
    if (record) return { state: "SELECTED", record, reason: "Current hire reference" };
    return { state: "UNKNOWN", record: null, reason: "Current hire reference unavailable or invalid" };
  }
  if (active.length > 1) return { state: "AMBIGUOUS", record: null, reason: "Multiple active hire records — review hire history" };
  if (!complete) return { state: "UNKNOWN", record: null, reason: "Hire information incomplete" };
  if (active.length === 1) return { state: "SELECTED", record: active[0], reason: "Active hire" };
  if (related.length === 1) return { state: "SELECTED", record: related[0], reason: "Only linked hire record" };
  return { state: "UNKNOWN", record: null, reason: related.length ? "Current hire not identified — review hire history" : "Hire record not recorded" };
}
