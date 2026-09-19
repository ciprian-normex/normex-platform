import { auth, db } from "/js/firebase.js";
import { collection, getDocsFromServer, query, where, limit } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { initialisePlantShell } from "../shared/plant-shell.js";
import { escapePlantHtml as escape, formatPlantDate, formatCurrencyGBP } from "../shared/plant-utils.js";
import { getPlantTypeLabel } from "../shared/plant-catalogue.js";
import { validHireRate, weeklyHireRate } from "../shared/plant-hire.js";
import { SOURCE_NAMES, QUERY_LIMIT, overviewAccess, overviewContext, canAddPlant, sourceResult, loadedSource, failedSource, isComplete, sourceLabel, buildOverview } from "./overview-model.js";

let profile = null;
let sources = {};
let generation = 0;
const root = document.getElementById("plantOverviewContent");
const status = document.getElementById("plantLoadStatus");
const refresh = document.getElementById("refreshPlant");
const money = value => value == null ? "Not assessed" : formatCurrencyGBP(value);
const date = value => value ? formatPlantDate(value) : "Not recorded";
const reference = asset => asset?.plantReference || asset?.plantId || asset?.id || "Organisation";
const label = value => String(value || "Not assessed").replaceAll("_", " ").toLowerCase();
const machine = asset => [asset.manufacturer, asset.model].filter(Boolean).join(" ") || getPlantTypeLabel(asset.plantType);
const assetLink = asset => asset ? `<a class="plant-record-link" href="../asset/index.html?id=${encodeURIComponent(asset.id)}">View Asset <span aria-hidden="true">↗</span></a>` : "";
const pill = (text, tone = "neutral") => `<span class="plant-pill plant-pill--${tone}">${escape(text)}</span>`;
const empty = text => `<div class="plant-empty">${escape(text)}</div>`;
const heading = (eyebrow, title, extra = "") => `<header class="plant-section-heading"><div><p class="plant-eyebrow">${escape(eyebrow)}</p><h3>${escape(title)}</h3></div>${extra}</header>`;
const fact = (title, value) => `<div><dt>${escape(title)}</dt><dd>${escape(value || "Not recorded")}</dd></div>`;

function availability(result) {
  if (!result) return "Unavailable";
  if (["LOADED_WITH_DATA", "LOADED_EMPTY"].includes(result.state)) return result.complete ? "Not assessed" : "Partial";
  return { LOADING: "Loading", PERMISSION_DENIED: "Restricted", NOT_ASSESSED: "Not assessed" }[result.state] || "Unavailable";
}

function renderPosition(model) {
  const labels = ["Total fleet", "Hired / leased", "Owned", "Assigned", "Available", "Off road"];
  return `<section class="plant-position" aria-label="Plant Position">${model.position.map((metric, index) => {
    const inputs = [model.sources.plantAssets, ...([3, 4].includes(index) ? [model.sources.plantAssignments] : [])];
    const failed = inputs.find(source => !isComplete(source));
    const value = metric.value === null ? availability(failed || model.sources.plantAssets) : metric.value;
    return `<article class="plant-position-item ${index === 5 && metric.value > 0 ? "is-alert" : ""}"><span>${labels[index]}</span><strong class="${metric.value === null ? "is-text" : ""}">${escape(value)}</strong><small>${escape(index === 1 ? "Ownership recorded" : metric.note || "Recorded position")}</small></article>`;
  }).join("")}</section>`;
}

function renderAction(item) {
  const tone = item.priority === 0 ? "danger" : item.priority < 3 ? "warning" : "neutral";
  const context = item.asset ? `${reference(item.asset)} · ${machine(item.asset)}` : "Information coverage";
  return `<article class="plant-action plant-action--${tone}">
    <div class="plant-action-top"><span class="plant-action-identity">${escape(context)}</span>${pill(item.priority === 0 ? "Action required" : item.priority < 3 ? "Review" : "Data gap", tone)}</div>
    <h4>${escape(item.title)}</h4><p class="plant-action-why">${escape(item.why)}</p>
    <dl class="plant-action-facts">
      ${fact("Current position", label(item.currentPosition))}
      ${item.asset ? fact("Project / location", item.asset.currentProjectName || item.asset.currentLocationLabel || "Not confirmed") : ""}
      ${item.supplier ? fact("Supplier", item.supplier) : ""}
      ${item.responsible ? fact("Responsible", item.responsible) : ""}
      ${item.due || item.expectedOffHire ? fact(item.due ? "Due" : "Expected off-hire", date(item.due || item.expectedOffHire)) : ""}
      ${item.programmeImpact ? fact("Programme impact", item.programmeImpact) : ""}
      ${item.financial ? fact("Hire commitment", `${money(item.financial.daily)} / day · ${money(item.financial.weekly)} / week`) : ""}
    </dl>
    <div class="plant-action-next"><div><span>Next action</span><p>${escape(item.nextAction)}</p></div>${assetLink(item.asset)}</div>
  </article>`;
}

function renderAttention(model, loading) {
  const items = model.attention;
  return `<section class="plant-panel plant-attention">${heading("Operational priorities", "Attention Required", pill("Known exceptions", "warning"))}
    ${items.length ? items.slice(0, 4).map(renderAction).join("") : empty(loading ? "Loading exception information. Conclusions withheld." : "No actionable exceptions identified in loaded records. Maintenance and compliance remain unassessed.")}
    ${items.length > 4 ? `<details class="plant-more"><summary>Review ${items.length - 4} more recorded exceptions</summary>${items.slice(4).map(renderAction).join("")}</details>` : ""}
  </section>`;
}

function renderFinance(model) {
  if (!model.access.costs) return `<aside class="plant-panel plant-finance">${heading("Financial control", "Hire / Financial Position")}${empty("Restricted")}<p class="plant-note">Plant financial information requires authorised cost access.</p></aside>`;
  const finance = model.finance;
  const rows = [
    ["Active hired Plant", finance.active == null ? "Not assessed" : finance.active],
    ["Daily commitment", money(finance.daily)],
    ["Accrued exposure", money(finance.exposure)],
    ["Idle-hire exposure / week", money(finance.idleWeekly)],
    ["Off-hire requiring action", finance.offHireAction == null ? "Not assessed" : finance.offHireAction]
  ];
  return `<aside class="plant-panel plant-finance">${heading("Hire exposure", "Hire / Financial Position", pill(finance.complete ? "Estimated" : "Incomplete", "light"))}
    <div class="plant-finance-lead"><span>Weekly hire commitment</span><strong>${escape(money(finance.weekly))}</strong><small>Current hire periods · estimated charges</small></div>
    <dl class="plant-finance-rows">${rows.map(([title, value]) => fact(title, String(value))).join("")}</dl>
    <div class="plant-finance-footer"><span class="plant-eyebrow">Cost pressure</span><p>${finance.idle === null ? "Idle hire position not assessed." : `${finance.idle} hired asset${finance.idle === 1 ? "" : "s"} recorded available without an assignment.`}</p><small>Daily equivalent = weekly ÷ 7. Off-hire planning dates do not stop accrued charges.</small></div>
  </aside>`;
}

function renderAssetCard(item, costAccess) {
  const { asset, hire, issue } = item;
  const blocked = asset.safeToUse === false || asset.offRoad === true || asset.complianceHold === true || ["OFF_ROAD", "COMPLIANCE_HOLD"].includes(asset.status);
  const state = blocked ? "Off road / hold" : label(asset.status);
  return `<article class="plant-asset-card">
    <header><div><span class="plant-eyebrow">${escape(getPlantTypeLabel(asset.plantType))}</span><h4>${escape(reference(asset))}</h4></div>${pill(state, blocked ? "danger" : "neutral")}</header>
    <div class="plant-machine"><strong>${escape(machine(asset))}</strong><span>${escape(label(asset.ownershipType))}</span></div>
    <dl class="plant-asset-facts">${fact("Current project", asset.currentProjectName || "Not confirmed")}${fact("Current location", asset.currentLocationLabel || "Not confirmed")}${fact("Supplier", asset.supplierName || hire?.hire?.supplierName || "Not recorded")}${fact("Expected off-hire", costAccess ? date(hire?.hire?.expectedOffHireDate) : "Restricted")}</dl>
    ${hire && costAccess ? `<div class="plant-asset-hire"><span>Hire position</span><strong>${escape(money(hire.estimate.weekly))}<small> / week</small></strong></div>` : ""}
    <div class="plant-asset-action"><span class="plant-eyebrow">${issue ? "Next action" : "Asset review"}</span><p>${escape(item.nextAction)}</p>${assetLink(asset)}</div>
  </article>`;
}

function renderAssets(model) {
  const source = model.sources.plantAssets;
  return `<section class="plant-fleet-section">${heading("Current fleet", "Priority Assets", '<a class="plant-record-link" href="../fleet/index.html">Open Fleet ↗</a>')}
    <div class="plant-asset-grid ${model.assets.length === 1 ? "plant-asset-grid--single" : ""}">${model.assets.length ? model.assets.slice(0, 6).map(item => renderAssetCard(item, model.access.costs)).join("") : empty(isComplete(source) ? "No active assets recorded. Add Plant through Fleet to establish the current position." : `Fleet information ${availability(source).toLowerCase()}. Other known exceptions remain visible.`)}</div>
    ${model.assets.length > 6 ? '<p class="plant-note">Showing six priority assets from loaded records. Open Fleet for the register.</p>' : ""}
  </section>`;
}

function renderOperations(model) {
  const order = ["plantDefects", "plantMaintenance", "compliance", "plantMovements", "plantIssues"];
  return `<section class="plant-operational-section">${heading("Operational position", "Plant Controls")}<div class="plant-operation-grid">${order.map(name => {
    const item = model.operations.find(row => row.name === name);
    const state = item.count === null ? item.state === "NOT_ASSESSED" ? "Not assessed" : item.state === "PERMISSION_DENIED" ? "Restricted" : item.state.includes("PARTIAL") ? "Partial" : item.state === "LOADING" ? "Loading" : "Unavailable" : item.count > 0 ? `${item.count} open` : model.sources[name]?.state === "LOADED_EMPTY" ? "No records" : "No open items";
    return `<article class="plant-operation-card"><h4>${escape(name === "plantIssues" ? "Plant Issues" : item.label)}</h4>${pill(state, item.count > 0 ? "warning" : "neutral")}<p>${escape(item.note)}</p></article>`;
  }).join("")}</div></section>`;
}

function renderUpcoming(model) {
  return `<section class="plant-panel plant-upcoming">${heading("Next 30 days", "Upcoming", pill("Recorded dates"))}<ol class="plant-timeline">${model.upcoming.slice(0, 8).map(item => `<li><time>${escape(date(item.date))}</time><div><span class="plant-eyebrow">${escape(reference(item.asset))}</span><h4>${escape(item.title)}</h4><p>${escape(item.detail)}</p></div>${assetLink(item.asset)}</li>`).join("")}</ol>${!model.upcoming.length ? empty("No upcoming dates found in loaded records. Missing dates and unavailable sources remain unassessed.") : ""}${model.upcoming.length > 8 ? '<p class="plant-note">Showing the next eight recorded actions.</p>' : ""}</section>`;
}

function render() {
  const model = buildOverview(sources, profile);
  const addLink = document.getElementById("addPlantLink");
  if (addLink) addLink.hidden = !canAddPlant(profile);
  if (model.context.state !== "READY") {
    root.innerHTML = `<section class="plant-panel">${heading("Workspace access", model.context.state)}${empty(model.context.reason)}</section>`;
    root.setAttribute("aria-busy", "false");
    status.textContent = model.context.state;
    return;
  }
  const loading = Object.values(model.sources).some(source => source.state === "LOADING");
  const unavailable = Object.entries(model.sources).some(([name, source]) => !(name === "plantHireRecords" && !model.access.costs) && !isComplete(source));
  root.setAttribute("aria-busy", String(loading));
  status.textContent = loading ? "LOADING · Updating current position" : unavailable ? "DATA_UNAVAILABLE · Some information is incomplete; known records remain visible" : "Current records loaded · Safety and compliance remain unassessed";
  root.innerHTML = `${renderPosition(model)}
    <div class="plant-control-grid">${renderAttention(model, loading)}${renderFinance(model)}</div>
    ${renderAssets(model)}${renderOperations(model)}${renderUpcoming(model)}
    <details class="plant-coverage"><summary>Information coverage &amp; last successful reads</summary><ul>${Object.entries(model.sources).map(([name, source]) => `<li><strong>${escape(SOURCE_NAMES[name])}</strong> · ${escape(sourceLabel(source))} ${escape(source.reason)}${source.lastSuccess ? ` · ${escape(new Date(source.lastSuccess).toLocaleString("en-GB"))}` : ""}</li>`).join("")}</ul></details>`;
}
async function load() {
  const run = ++generation;
  const scope = profile?.organisationId;
  const access = overviewAccess(profile);
  sources = {};
  if (overviewContext(profile).state !== "READY") { refresh.disabled = false; render(); return; }
  for (const name of Object.keys(SOURCE_NAMES)) sources[name] = sourceResult(scope, name === "plantHireRecords" && !access.costs ? "PERMISSION_DENIED" : "LOADING", [], { reason: name === "plantHireRecords" && !access.costs ? "Restricted" : "" });
  render();
  refresh.disabled = true;
  const requests = Object.keys(SOURCE_NAMES).filter(name => name !== "plantHireRecords" || access.costs);
  await Promise.allSettled(requests.map(async name => {
    let timer;
    try {
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject({ code: "deadline-exceeded" }), 15000); });
      const snapshot = await Promise.race([getDocsFromServer(query(collection(db, name), where("organisationId", "==", scope), limit(QUERY_LIMIT))), timeout]);
      if (run !== generation) return;
      sources[name] = loadedSource(scope, snapshot.docs.map(document => ({ ...document.data(), id: document.id })));
    } catch (error) {
      if (run !== generation) return;
      sources[name] = failedSource(scope, error);
    } finally { clearTimeout(timer); }
    if (run === generation) render();
  }));
  if (run === generation) refresh.disabled = false;
}

function initialise(nextProfile) { profile = nextProfile; return load(); }
initialisePlantShell({ activePage: "overview", workspaceName: "Fleet & Transport Control" });
refresh.addEventListener("click", () => load());
window.addEventListener("normex:workspace-ready", event => initialise(event.detail.profile));
onAuthStateChanged(auth, user => {
  if (!user || profile && user.uid !== profile.uid) {
    generation++;
    profile = null;
    sources = {};
    render();
  }
});
if (window.NORMEX_CURRENT_USER) initialise(window.NORMEX_CURRENT_USER);
