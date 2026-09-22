import { auth, db } from "/js/firebase.js";
import { collection, getDocsFromServer, query, where, limit } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { initialisePlantShell } from "../shared/plant-shell.js";
import { escapePlantHtml as escape, formatPlantDate, formatCurrencyGBP } from "../shared/plant-utils.js";
import { SOURCE_NAMES, QUERY_LIMIT, overviewAccess, overviewContext, canAddPlant, sourceResult, loadedSource, failedSource, isComplete, buildOverview, buildManagement, filterManagementRows, buildAttentionQueue } from "./overview-model.js";

let profile = null;
let sources = {};
let generation = 0;
const root = document.getElementById("plantOverviewContent");
const status = document.getElementById("plantLoadStatus");
const refresh = document.getElementById("refreshPlant");
const ui = { filter: { kind: "all", label: "All loaded records" }, issue: "all", order: "high", allActions: false, pages: {}, sorts: {}, expanded: new Set() };
const money = value => value == null ? "Not assessed" : formatCurrencyGBP(value);
const date = value => value ? formatPlantDate(value) : "Not recorded";
const reference = asset => asset?.plantReference || asset?.plantId || asset?.id || "Organisation";
const assetLink = (asset, text = "View Asset") => asset ? `<a class="plant-record-link" href="../asset/index.html?id=${encodeURIComponent(asset.id)}">${escape(text)} &rarr;</a>` : "Review source information";
const pill = (text, tone = "neutral") => `<span class="plant-pill plant-pill--${tone}">${escape(text)}</span>`;
const empty = text => `<p class="plant-empty">${escape(text)}</p>`;
const heading = (title, extra = "") => `<header class="plant-section-heading"><h3>${escape(title)}</h3>${extra}</header>`;
const stateLabel = source => !source ? "Unavailable" : ["LOADED_WITH_DATA", "LOADED_EMPTY"].includes(source.state) && !source.complete ? "Partial / incomplete" : ({ LOADING: "Loading", LOADED_WITH_DATA: "Available", LOADED_EMPTY: "No records", PERMISSION_DENIED: "Restricted", UNAVAILABLE: "Unavailable", ERROR: "Error", NOT_ASSESSED: "Not assessed", NOT_APPLICABLE: "Not applicable" }[source.state] || "Unavailable");
const filterButton = (kind, value, label, content = label) => `<button type="button" class="plant-text-button" aria-pressed="${ui.filter.kind === kind && ui.filter.value === value}" data-filter="${kind}" data-value="${escape(value)}" data-label="${escape(label)}">${content}</button>`;
const sourceNote = (model, names) => names.some(name => !isComplete(model.sources[name])) ? '<p class="plant-note">Partial / incomplete information. Loaded records only; complete totals withheld.</p>' : "";

function table(id, columns, rows, pageSize = 10) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(ui.pages[id] || 0, pages - 1);
  ui.pages[id] = page;
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);
  return `<div class="plant-table-wrap"><table class="plant-table" aria-label="${escape(id)}"><thead><tr>${columns.map(name => `<th scope="col">${escape(name)}</th>`).join("")}</tr></thead><tbody>${visible.length ? visible.map(cells => `<tr>${cells.map((cell, i) => `<td data-label="${escape(columns[i])}"><div class="plant-cell">${cell}</div></td>`).join("")}</tr>${cells.detail ? `<tr class="plant-concern-detail" id="${escape(cells.detail.id)}" ${ui.expanded.has(cells.detail.key) ? "" : "hidden"}><td colspan="${columns.length}">${cells.detail.html}</td></tr>` : ""}`).join("") : `<tr><td colspan="${columns.length}">No matching records in loaded information.</td></tr>`}</tbody></table></div>${pages > 1 ? `<nav class="plant-pagination" aria-label="${escape(id)} pages"><button data-page="${id}" data-step="-1" ${page === 0 ? "disabled" : ""}>Previous</button><span>Page ${page + 1} of ${pages} &middot; ${rows.length} loaded rows</span><button data-page="${id}" data-step="1" ${page === pages - 1 ? "disabled" : ""}>Next</button></nav>` : ""}`;
}

function renderPosition(model, management) {
  const count = label => management.positions.find(item => item.label === label).count;
  const metrics = [
    ["Total Fleet", model.position[0].value, "all", ""],
    ["Assigned", count("Assigned"), "position", "Assigned"],
    ["Available", count("Available"), "position", "Available"],
    ["Hired", model.position[1].value, "hired", ""],
    ["Off road / hold", model.position[5].value, "position", "Off road / hold"],
    ["Due off-hire", model.access.costs ? model.finance.offHireAction : "Restricted", "due", ""]
  ];
  return `<section class="plant-position" aria-label="Plant Position">${metrics.map(([label, value, kind, filter]) => `<button class="plant-position-item" data-filter="${kind}" data-value="${filter}" data-label="${label}" ${value === "Restricted" || value === null ? "disabled" : ""}><span>${label}</span><strong class="${typeof value !== "number" ? "is-text" : ""}">${escape(value ?? "Not assessed")}</strong>${label === "Due off-hire" ? '<small>Overdue + next 14 days</small>' : label === "Available" ? '<small>Readiness not assessed</small>' : ""}</button>`).join("")}</section>`;
}

function renderCharts(model, management) {
  const total = management.rows.length;
  let offset = 0;
  const colors = ["#285b43", "#83a68b", "#a86350", "#b59a5c", "#687e91", "#adb9b0", "#d4dbd5"];
  const segments = management.chartComplete && total ? management.positions.map((item, index) => {
    const share = item.count / total * 100;
    const svg = item.count ? `<circle class="plant-ring-segment" cx="60" cy="60" r="45" pathLength="100" fill="none" stroke="${colors[index]}" stroke-width="15" stroke-dasharray="${share} ${100 - share}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)" role="button" tabindex="0" aria-pressed="${ui.filter.kind === "position" && ui.filter.value === item.label}" aria-label="${escape(item.label)}: ${item.count}. Filter loaded records" data-filter="position" data-value="${escape(item.label)}" data-label="${escape(item.label)}"><title>${escape(item.label)}: ${item.count}</title></circle>` : "";
    offset += share;
    return svg;
  }).join("") : "";
  const ring = `<div class="plant-ring"><svg viewBox="0 0 120 120" aria-label="Fleet position"><circle cx="60" cy="60" r="45" fill="none" stroke="#eef2ee" stroke-width="15"/>${segments}</svg><div><strong>${management.chartComplete ? total : "--"}</strong><span>${management.chartComplete ? "active assets" : "Incomplete"}</span></div></div>`;
  const legend = `<ul class="plant-chart-legend">${management.positions.map((item, index) => `<li><span style="background:${colors[index]}" aria-hidden="true"></span>${filterButton("position", item.label, item.label, `${escape(item.label)} <strong>${item.count ?? "--"}</strong>`)}</li>`).join("")}</ul>`;
  const fleet = `<section class="plant-panel plant-chart">${heading("Fleet Position", pill(management.chartComplete ? "Recorded position" : "Incomplete"))}<div class="plant-ring-layout">${ring}${legend}</div><p class="plant-note">Assignment does not confirm physical deployment. Safety and compliance remain unassessed.</p></section>`;
  let finance = empty("Restricted");
  if (model.access.costs) {
    const max = Math.max(1, ...management.bars.map(group => group.weekly));
    finance = model.finance.complete ? `<div class="plant-bars">${management.bars.map(group => `<button class="plant-bar" data-filter="project" data-value="${escape(group.key)}" data-label="${escape(group.label)}"><span>${escape(group.label)}</span><strong>${escape(money(group.weekly))}</strong><i style="width:${group.weekly / max * 100}%" aria-hidden="true"></i></button>`).join("") || empty("No active hire commitment recorded.")}</div>` : empty("Hire information incomplete. Complete commitment withheld.");
    finance += `<div class="plant-finance-figures"><div><span>Current weekly commitment</span><strong>${escape(money(model.finance.weekly))}</strong></div><div><span>Accrued exposure</span><strong>${escape(money(model.finance.exposure))}</strong></div><div>${filterButton("idle", "", "Idle / unassigned", `<span>Idle / unassigned per week</span><strong>${escape(money(model.finance.idleWeekly))}</strong>`)}</div></div><p class="plant-note">Estimated charges. Expected off-hire does not stop accrual.</p>`;
  }
  return `<div class="plant-charts">${fleet}<section class="plant-panel plant-finance plant-chart">${heading("Hire Exposure", pill(model.access.costs ? "Weekly commitment" : "Restricted", "light"))}${finance}</section></div>`;
}

function renderAttention(model, management) {
  const attention = buildAttentionQueue(model, management);
  const matches = concern => ui.issue === "all" || (ui.issue === "compliance" ? concern.asset?.complianceHold === true || concern.asset?.status === "COMPLIANCE_HOLD" : (concern.source || "asset") === ui.issue);
  let groups = attention.queue.filter(group => group.concerns.some(matches));
  if (ui.order === "low") groups = [...groups].sort((a, b) => a.level - b.level || (b.weekly ?? -1) - (a.weekly ?? -1));
  const rows = groups.map(group => {
    const id = "concerns-" + encodeURIComponent(group.key);
    const row = [assetLink(group.asset, reference(group.asset)), pill(group.label, group.tone), escape(group.primary.title), escape(group.impact) + (group.weekly !== null ? '<small>' + escape(money(group.weekly)) + '/week current commitment</small>' : ''), '<button class="plant-text-button" data-concerns="' + escape(group.key) + '" aria-controls="' + id + '" aria-expanded="' + ui.expanded.has(group.key) + '">' + group.concerns.length + ' active concern' + (group.concerns.length === 1 ? '' : 's') + ' &darr;</button>', escape(group.primary.nextAction)];
    const context = group.row ? '<p class="plant-concern-context">Project: ' + escape(group.row.allocation.label) + ' &middot; Location: ' + escape(group.asset.currentLocationLabel || 'Not confirmed') + (group.weekly !== null ? ' &middot; Hire: ' + escape(money(group.weekly)) + '/week' : '') + '</p>' : '';
    row.detail = { key: group.key, id, html: context + '<ul class="plant-concern-list">' + group.concerns.map(item => '<li><strong>' + escape(item.title) + '</strong><p>' + escape(String(item.currentPosition).replaceAll("_", " ").toLowerCase()) + (item.due ? ' &middot; Due: ' + escape(date(item.due)) : /off-hire/i.test(item.title) && item.expectedOffHire ? ' &middot; Expected off-hire: ' + escape(date(item.expectedOffHire)) : '') + (item.responsible ? ' &middot; Owner: ' + escape(item.responsible) : '') + '</p><p>' + escape(item.nextAction) + '</p></li>').join('') + '</ul>' + assetLink(group.asset) };
    return row;
  });
  const options = [["all", "All issues"], ["asset", "Asset / hire"], ["plantDefects", "Defects"], ["plantMaintenance", "Maintenance"], ["compliance", "Explicit compliance holds"], ["plantMovements", "Movements"], ["plantIssues", "Plant Issues"]];
  const financial = model.access.costs ? '<div class="plant-exception-finance"><span>Overdue off-hire commitment <strong>' + escape(money(attention.overdueWeekly)) + (attention.overdueWeekly !== null ? '/week' : '') + '</strong></span><span>Assets requiring commercial action <strong>' + escape(attention.commercialAssets ?? 'Not assessed') + '</strong></span><small>Current commitment on hires past expected off-hire; not a calculation of loss or savings.</small></div>' : '';
  return '<section id="attention" class="plant-panel plant-section">' + heading("Attention Required", pill("Asset exceptions", "warning")) + financial + '<div class="plant-table-tools"><label>Issue <select id="plantIssueFilter">' + options.map(([value, label]) => '<option value="' + value + '" ' + (ui.issue === value ? 'selected' : '') + '>' + label + '</option>').join('') + '</select></label><label>Priority <select id="plantPrioritySort"><option value="high" ' + (ui.order === 'high' ? 'selected' : '') + '>Highest first</option><option value="low" ' + (ui.order === 'low' ? 'selected' : '') + '>Lowest first</option></select></label></div>' + (rows.length ? table('attention', ['Plant', 'Attention', 'Primary issue', 'Known impact', 'Concerns', 'Next action'], rows, ui.allActions ? 10 : 6) : empty('No matching actions identified in loaded records. Safety and compliance remain unassessed.')) + (!ui.allActions && rows.length > 6 ? '<button class="plant-text-button" data-action="all-actions">View all loaded actions</button>' : '') + '</section>';
}

function renderOperations(model, management) {
  const specs = [["plantDefects", "Defects"], ["plantMaintenance", "Maintenance"], ["compliance", "Compliance"], ["plantMovements", "Movements"], ["plantIssues", "Plant Issues"]];
  return `<section class="plant-panel plant-section">${heading("Operational Control")}<div class="plant-operations">${specs.map(([name, title]) => {
    const item = model.operations.find(row => row.name === name);
    const primary = item.count === null ? name === "compliance" || item.state === "NOT_ASSESSED" ? (item.state === "UNAVAILABLE" ? "Unavailable" : "Not assessed") : stateLabel(model.sources[name]) : `${item.count} ${name === "plantMovements" ? "outstanding" : "open"}`;
    const due = management.attention.filter(row => row.source === name && row.title.startsWith("Overdue")).length;
    const next = model.upcoming.filter(row => row.title === (name === "plantMovements" ? "Movement" : "Maintenance") && row.day === management.day).length;
    const holds = management.rows.filter(row => row.asset.complianceHold === true || row.asset.status === "COMPLIANCE_HOLD").length;
    const secondary = item.state === "NOT_ASSESSED" && name === "plantMaintenance" ? "Maintenance baseline required" : name === "compliance" ? `${holds ? `${holds} known explicit holds` : isComplete(model.sources.plantAssets) ? "No explicit holds recorded" : "Explicit holds not fully assessed"}; evidence not assessed` : name === "plantMaintenance" || name === "plantMovements" ? `${isComplete(model.sources[name]) ? `${due} known overdue; ${next} recorded today` : "Dates not fully assessed"}` : item.note;
    return `<div class="plant-operation-row"><strong>${title}</strong>${pill(primary, item.count > 0 ? "warning" : "neutral")}<span>${escape(secondary)}</span><button class="plant-text-button" data-operation="${name}">Review &rarr;</button></div>`;
  }).join("")}</div><p class="plant-note">Review opens loaded actions or dates below. Standalone module workflows are not yet available.</p></section>`;
}

function managementSort(name, alternate) {
  return '<label class="plant-sort-label">Sort <select data-management-sort="' + name + '"><option value="default">' + (name === 'upcoming' ? 'Earliest first' : name === 'projects' ? 'Blockers first' : 'Cost pressure') + '</option><option value="alternate" ' + (ui.sorts[name] === 'alternate' ? 'selected' : '') + '>' + alternate + '</option></select></label>';
}

function renderManagement(model, management) {
  const rows = filterManagementRows(management.rows, ui.filter);
  const ids = new Set(rows.map(row => row.asset.id));
  const groups = management.projects.map(group => ({ ...group, rows: group.rows.filter(row => ids.has(row.asset.id)) })).filter(group => group.rows.length);
  if (ui.sorts.projects === "alternate") groups.sort((a, b) => a.label.localeCompare(b.label, "en-GB", { numeric: true }));
  const complete = isComplete(model.sources.plantAssets) && isComplete(model.sources.plantAssignments);
  const projectRows = groups.map(group => [filterButton("project", group.key, group.label, escape(group.label)) + `<small>${escape([...new Set(group.rows.map(row => row.asset.currentLocationLabel).filter(Boolean))].slice(0, 2).join(" / ") || "Location not confirmed")}</small>`, complete ? String(group.rows.length) : "Incomplete", complete && model.position[1].value !== null ? String(group.rows.filter(row => row.hired).length) : "Not assessed", complete ? String(group.rows.filter(row => row.blocked).length) : "Incomplete", escape(group.rows.find(row => row.blocked)?.issue?.title || (group.key === "unknown" ? "Allocation needs review" : group.rows.find(row => row.issue)?.issue?.title) || "No exception identified in loaded records")]);
  const filterBar = `<div id="management-filter" class="plant-filter-bar" tabindex="-1"><span>Showing: <strong>${escape(ui.filter.label)}</strong></span><button class="plant-text-button" data-action="reset">Reset filters</button></div>`;
  const projects = `<section id="projects" class="plant-panel plant-section">${heading("Plant by Project", managementSort("projects", "Project A-Z"))}${sourceNote(model, ["plantAssets", "plantAssignments"])}${table("projects", ["Project / location", "Assets", "Hired", "Off road / hold", "Key warning"], projectRows)}</section>`;
  const hires = rows.filter(row => row.hire).sort((a, b) => ui.sorts.hires === "alternate" ? (b.hire.estimate.weekly ?? -1) - (a.hire.estimate.weekly ?? -1) : model.hires.indexOf(a.hire) - model.hires.indexOf(b.hire)).map(row => [assetLink(row.asset, reference(row.asset)), escape(row.asset.supplierName || row.hire.hire?.supplierName || "Not recorded"), escape(row.allocation.label), escape(money(row.hire.estimate.weekly)), escape(date(row.hire.hire?.expectedOffHireDate)), escape(money(row.hire.estimate.estimatedCost)), escape(row.hire.reason), assetLink(row.asset, "Review")]);
  const watch = `<section id="hire-watch" class="plant-panel plant-section">${heading("Hire Watch", model.access.costs ? managementSort("hires", "Weekly rate: highest first") : "")}${model.access.costs ? sourceNote(model, ["plantAssets", "plantHireRecords"]) + table("hires", ["Plant", "Supplier", "Project", "Weekly rate", "Expected off-hire", "Accrued exposure", "Status", "Action"], hires) : empty("Restricted")}</section>`;
  const upcoming = model.upcoming.filter(item => (ui.filter.kind === "all" || ids.has(item.asset?.id)) && (!ui.upcoming || item.title === ui.upcoming)).sort((a, b) => ui.sorts.upcoming === "alternate" ? b.day - a.day : a.day - b.day).map(item => [escape(date(item.date)), escape(reference(item.asset)), `${escape(item.title)}${item.title === "Expected off-hire" ? '<small>Planning date. Charges continue until confirmed off-hire.</small>' : ""}`, escape(management.rows.find(row => row.asset.id === item.asset?.id)?.allocation.label || "Not established"), assetLink(item.asset)]);
  return `${filterBar}${projects}${watch}<section id="upcoming" class="plant-panel plant-section">${heading("Upcoming", managementSort("upcoming", "Latest first"))}${ui.upcoming ? `<p class="plant-note">Filtered to ${escape(ui.upcoming)}. Reset filters to show all events.</p>` : ""}${table("upcoming", ["Date", "Plant", "Event", "Project", "Action"], upcoming)}<p class="plant-note">Next 30 days; recorded dates only. Missing dates and unavailable sources remain unassessed.</p></section>`;
}

function renderDataStatus(model) {
  if (profile?.status !== "ACTIVE" || profile.roleCode !== "PLATFORM_ADMIN" || profile.accessLevel !== 99) return "";
  const entries = Object.entries(model.sources);
  return `<details class="plant-data-status"><summary>Data Status &middot; ${entries.filter(([, source]) => source.state !== "LOADING").length} sources checked <span>Details</span></summary><dl>${entries.map(([name, source]) => `<div><dt>${escape(SOURCE_NAMES[name])}</dt><dd>${escape(stateLabel(source))}</dd></div>`).join("")}</dl></details>`;
}

function render() {
  const model = buildOverview(sources, profile);
  const addLink = document.getElementById("addPlantLink");
  if (addLink) addLink.hidden = !canAddPlant(profile);
  if (model.context.state !== "READY") {
    root.innerHTML = `<section class="plant-panel">${heading("Workspace unavailable")}${empty(model.context.reason)}</section>`;
    root.setAttribute("aria-busy", "false");
    status.textContent = "Workspace access or organisation context required";
    return;
  }
  const management = buildManagement(model);
  const loading = Object.values(model.sources).some(source => source.state === "LOADING");
  root.setAttribute("aria-busy", String(loading));
  const latest = Object.values(model.sources).map(source => source.lastSuccess).filter(Boolean).sort().at(-1);
  status.textContent = loading ? "Updating current position" : `Updated ${latest ? new Date(latest).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "time unavailable"}${management.gaps.length ? " | Some information is incomplete" : ""}`;
  root.innerHTML = `<p class="plant-management-summary">${escape(management.summary)}</p>${management.gaps.length ? `<p class="plant-information-notice">${management.gaps.map(([name, source]) => `${escape(SOURCE_NAMES[name])}: ${escape(stateLabel(source))}`).join(" &middot; ")}. Known blockers remain visible.</p>` : ""}${renderPosition(model, management)}${renderCharts(model, management)}${renderAttention(model, management)}${renderOperations(model, management)}${renderManagement(model, management)}${renderDataStatus(model)}`;
}

function applyFilter(kind, value, label) {
  ui.filter = kind === "position" && ui.filter.kind === kind && ui.filter.value === value ? { kind: "all", label: "All Fleet" } : { kind, value, label };
  ui.upcoming = null;
  if (kind === "project" && value === "other") ui.filter.keys = buildManagement(buildOverview(sources, profile)).bars.find(group => group.key === "other")?.keys || [];
  ui.pages = {};
  render();
}
function resetFilters() {
  ui.filter = { kind: "all", label: "All loaded records" };
  ui.issue = "all";
  ui.upcoming = null;
  ui.order = "high";
  ui.allActions = false;
  ui.sorts = {};
  ui.pages = {};
  render();
}
function navigateTo(id) {
  document.getElementById(id)?.scrollIntoView?.({ behavior: "auto", block: "start" });
}
root.addEventListener("click", event => {
  const button = event.target.closest("button[data-filter], button[data-action], button[data-page], button[data-operation], button[data-concerns], circle[data-filter]");
  if (!button) return;
  if (button.dataset.concerns) {
    const key = button.dataset.concerns;
    if (ui.expanded.has(key)) ui.expanded.delete(key); else ui.expanded.add(key);
    const detail = document.getElementById(button.getAttribute("aria-controls"));
    if (detail) detail.hidden = !ui.expanded.has(key);
    button.setAttribute("aria-expanded", String(ui.expanded.has(key)));
  } else if (button.dataset.filter) {
    applyFilter(button.dataset.filter, button.dataset.value, button.dataset.label);
    navigateTo("management-filter");
  } else if (button.dataset.action === "reset") resetFilters();
  else if (button.dataset.action === "all-actions") { ui.allActions = true; ui.pages.attention = 0; render(); navigateTo("attention"); }
  else if (button.dataset.page) { const id = button.dataset.page; ui.pages[id] = Math.max(0, (ui.pages[id] || 0) + Number(button.dataset.step)); render(); navigateTo(id === "hires" ? "hire-watch" : id); }
  else if (button.dataset.operation) {
    ui.issue = button.dataset.operation;
    ui.pages.attention = 0;
    ui.filter = { kind: "all", label: "All loaded records" };
    ui.upcoming = ui.issue === "plantMovements" ? "Movement" : ui.issue === "plantMaintenance" ? "Maintenance" : null;
    render();
    const hasActions = buildManagement(buildOverview(sources, profile)).attention.some(item => item.source === ui.issue);
    navigateTo(ui.upcoming && !hasActions ? "upcoming" : "attention");
  }
});
root.addEventListener("keydown", event => {
  if (["Enter", " "].includes(event.key) && event.target.matches("circle[data-filter]")) { event.preventDefault(); applyFilter(event.target.dataset.filter, event.target.dataset.value, event.target.dataset.label); navigateTo("management-filter"); }
});
root.addEventListener("change", event => {
  if (event.target.dataset.managementSort) { ui.sorts[event.target.dataset.managementSort] = event.target.value; ui.pages[event.target.dataset.managementSort] = 0; }
  if (event.target.id === "plantIssueFilter") ui.issue = event.target.value;
  if (event.target.id === "plantPrioritySort") ui.order = event.target.value;
  ui.pages.attention = 0;
  render();
});
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

function initialise(nextProfile) { ui.expanded = new Set(); ui.sorts = {}; ui.filter = { kind: "all", label: "All loaded records" }; ui.issue = "all"; ui.upcoming = null; ui.pages = {}; ui.allActions = false; profile = nextProfile; return load(); }
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
