import { auth, db } from "/js/firebase.js";
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { initialisePlantShell } from "/modules/contractor/plant/shared/plant-shell.js";
import { escapePlantHtml as esc, parsePlantDate } from "/modules/contractor/plant/shared/plant-utils.js";

const $ = (id) => document.getElementById(id);
const clean = (value) => String(value ?? "").trim();
const omit = (source) => Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined));
const label = (value) => clean(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
const PLANNING_WINDOW_DAYS = 30;

let profile, org, assets = [], records = [], filter = "";

const active = (record) => record && !["COMPLETED", "CANCELLED"].includes(clean(record.status).toUpperCase());

function manage(person, context = { organisationId: org }) {
  return !!(
    person?.status === "ACTIVE" &&
    person.organisationId === org &&
    context.organisationId === org &&
    (
      (person.roleCode === "PLATFORM_ADMIN" && person.accessLevel === 99) ||
      person.roleCode === "PLANT_TRANSPORT_MANAGER" ||
      person?.permissions?.canManagePlant ||
      person?.permissions?.canManageOrganisation
    )
  );
}

function owned(asset) {
  return clean(asset?.ownershipType || asset?.ownership).toUpperCase() === "OWNED";
}

function isRoadVehicle(asset) {
  const type = clean(asset?.plantType || asset?.assetType || asset?.vehicleType || asset?.equipmentType).toUpperCase();
  return ["ROAD_VEHICLE", "VEHICLE", "VAN", "TRUCK", "CAR"].some((token) => type.includes(token));
}

function assetName(asset) {
  if (!asset) return "Not recorded";
  const registration = asset.registrationNumber || asset.registration;
  return registration
    ? [registration, [asset.make || asset.manufacturer, asset.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")
    : [asset.plantReference || asset.plantId, [asset.manufacturer, asset.model].filter(Boolean).join(" "), asset.plantType].filter(Boolean).join(" · ");
}

function formatDate(value) {
  const date = parsePlantDate(value);
  if (!date) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function dayMonth(value) {
  const date = parsePlantDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

function differenceInDays(value, baseDate = new Date()) {
  const date = parsePlantDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  const current = new Date(baseDate);
  current.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - current.getTime()) / 86400000);
}

function planningDate(record) {
  if (!record) return null;
  const candidates = [
    record.dueDate,
    record.plannedDate,
    record.booking?.bookedAt,
    record.nextReviewDate,
    record.serviceDate,
    record.testDate,
    record.completedAt
  ];
  return candidates.map(parsePlantDate).find(Boolean) || null;
}

function motState(asset) {
  if (!asset || !asset.motExpiry) return { state: "NORMAL", days: Number.POSITIVE_INFINITY };
  const expiry = parsePlantDate(asset.motExpiry);
  if (!expiry) return { state: "NORMAL", days: Number.POSITIVE_INFINITY };
  const days = differenceInDays(expiry);
  if (days < 0) return { state: "EXPIRED", days };
  if (days <= 14) return { state: "URGENT", days };
  if (days <= PLANNING_WINDOW_DAYS) return { state: "ATTENTION", days };
  return { state: "NORMAL", days };
}

function maintenanceState(record) {
  if (!record) return "UPCOMING";
  if (["COMPLETED", "CANCELLED"].includes(clean(record.status).toUpperCase())) return "COMPLETED";
  if (record.booking?.availability === "PLANNED_UNAVAILABLE") return "UNAVAILABLE";
  const date = planningDate(record);
  if (!date) return "UPCOMING";
  const days = differenceInDays(date);
  if (days < 0) return "OVERDUE";
  if (record.booking?.bookedAt || record.booking?.bookedWith || record.provider) return "SCHEDULED";
  if (days <= PLANNING_WINDOW_DAYS) return "DUE";
  return "UPCOMING";
}

function stateLabel(state) {
  const labels = {
    OVERDUE: "OVERDUE",
    DUE: "DUE",
    SCHEDULED: "SCHEDULED",
    UNAVAILABLE: "UNAVAILABLE",
    UPCOMING: "UPCOMING",
    "IN PROGRESS": "IN PROGRESS",
    COMPLETED: "COMPLETED",
    ATTENTION: "ATTENTION",
    URGENT: "URGENT",
    EXPIRED: "MOT EXPIRED"
  };
  return labels[state] || "UPCOMING";
}

function stateDetail(record) {
  const state = maintenanceState(record);
  if (state === "SCHEDULED") return record?.booking?.bookedWith || "Booked";
  if (state === "UNAVAILABLE") return "Planned unavailable";
  if (state === "OVERDUE") return "Review required";
  if (state === "DUE") return "Due within 30 days";
  return "Upcoming";
}

function statusTone(statusText) {
  const value = clean(statusText).toUpperCase();
  if (value.includes("OVERDUE") || value.includes("EXPIRED")) return "danger";
  if (value.includes("URGENT") || value.includes("ATTENTION")) return "warning";
  if (value.includes("SCHEDULED") || value.includes("DUE")) return "info";
  return "neutral";
}

function assetAssignmentLabel(asset) {
  if (!asset) return "Not allocated";
  if (isRoadVehicle(asset)) {
    return asset.currentAssignedPersonName || asset.assignedToName || "Not allocated";
  }
  return asset.currentProjectName || asset.currentProjectId || "Not allocated";
}

function assetAssignmentContext(asset) {
  if (!asset) return "Not recorded";
  return asset.currentLocationLabel || "Location not confirmed";
}

function providerFor(record) {
  if (!record) return "Not booked";
  return record.provider || record.booking?.bookedWith || "Not booked";
}

function buildUpcomingItems() {
  const items = [];

  records.filter(active).forEach((record) => {
    const date = planningDate(record);
    if (!date) return;
    const days = differenceInDays(date);
    if (days < 0 || days > PLANNING_WINDOW_DAYS) return;

    items.push({
      kind: "maintenance",
      date,
      record,
      asset: assets.find((entry) => entry.id === record.assetId),
      label: label(record.maintenanceType || "Maintenance"),
      context: record.booking?.bookedWith ? "Scheduled" : "Due soon"
    });
  });

  assets.filter(owned).forEach((asset) => {
    if (!asset.motExpiry) return;
    const expiry = parsePlantDate(asset.motExpiry);
    if (!expiry) return;
    const days = differenceInDays(expiry);
    if (days < 0 || days > PLANNING_WINDOW_DAYS) return;

    items.push({
      kind: "mot",
      date: expiry,
      asset,
      label: "MOT",
      context: "MOT expiry"
    });
  });

  return items.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 6);
}

function buildAttentionItems() {
  const items = [];

  records.filter(active).forEach((record) => {
    const state = maintenanceState(record);
    const date = planningDate(record);
    const inWindow = date ? differenceInDays(date) >= 0 && differenceInDays(date) <= PLANNING_WINDOW_DAYS : false;
    const shouldInclude = ["OVERDUE", "DUE", "SCHEDULED", "UNAVAILABLE"].includes(state) || (state === "UPCOMING" && inWindow);
    if (!shouldInclude) return;

    items.push({
      kind: "maintenance",
      state,
      date: date || new Date(),
      record,
      asset: assets.find((entry) => entry.id === record.assetId),
      sort: date || new Date()
    });
  });

  assets.filter(owned).forEach((asset) => {
    const { state } = motState(asset);
    if (!["EXPIRED", "URGENT", "ATTENTION"].includes(state)) return;
    items.push({
      kind: "mot",
      state,
      date: parsePlantDate(asset.motExpiry) || new Date(),
      asset,
      sort: parsePlantDate(asset.motExpiry) || new Date()
    });
  });

  return items.sort((a, b) => new Date(a.sort) - new Date(b.sort));
}

function rowMatchesFilter(item, selectedFilter) {
  if (!selectedFilter) return true;

  if (item.kind === "mot") {
    if (selectedFilter === "mot") return true;
    return false;
  }

  const state = maintenanceState(item.record);

  switch (selectedFilter) {
    case "mot":
      return ["MOT", "MOT_TEST"].includes((item.record?.maintenanceType || "").toUpperCase());
    case "due":
      return state === "DUE" || state === "UPCOMING";
    case "overdue":
      return state === "OVERDUE";
    case "booked":
      return state === "SCHEDULED";
    case "unavailable":
      return state === "UNAVAILABLE";
    default:
      return true;
  }
}

function summaryCounts() {
  const open = records.filter(active);
  const motCount = assets.filter(owned).filter((asset) => ["EXPIRED", "URGENT", "ATTENTION"].includes(motState(asset).state)).length;
  const dueCount = open.filter((record) => maintenanceState(record) === "DUE").length;
  const overdueCount = open.filter((record) => maintenanceState(record) === "OVERDUE").length;
  const bookedCount = open.filter((record) => maintenanceState(record) === "SCHEDULED").length;
  const unavailableCount = open.filter((record) => maintenanceState(record) === "UNAVAILABLE").length;
  return [motCount, dueCount, overdueCount, bookedCount, unavailableCount];
}

function renderSummaryCounts() {
  const counts = summaryCounts();
  const tileKeys = ["mot", "due", "overdue", "booked", "unavailable"];

  document.querySelectorAll("#maintenanceSummary .position-tile").forEach((tile, index) => {
    tile.querySelector(".position-value").textContent = String(counts[index] || 0);
    tile.dataset.filter = tileKeys[index];
    tile.classList.toggle("is-selected", filter === tile.dataset.filter);
  });
}

function renderTimeline() {
  const panel = document.querySelector(".maintenance-timeline");
  if (!panel) return;

  const items = buildUpcomingItems();
  if (!items.length) {
    panel.innerHTML = '<div class="timeline-track"></div><div class="timeline-empty">No maintenance due in the next 30 days.</div>';
    return;
  }

  panel.innerHTML = `
    <div class="timeline-track"></div>
    ${items
      .map((item) => {
        const isMot = item.kind === "mot";
        const asset = item.asset || null;
        const displayDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(item.date);
        const dateParts = displayDate.split(" ");
        const day = dateParts[0];
        const month = dateParts[1];
        const category = isMot ? "MOT" : label(item.record?.maintenanceType || "Maintenance");
        const context = isMot ? "MOT expiry" : item.context || "Scheduled";
        const title = assetName(asset);

        return `
          <article class="timeline-item timeline-item--${isMot ? "mot" : "service"}">
            <div class="timeline-date">
              <strong>${esc(day)}</strong>
              <span>${esc(month)}</span>
            </div>
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <span class="timeline-category">${esc(category)}</span>
              <strong>${esc(title)}</strong>
              <span>${esc(context)}</span>
            </div>
          </article>
        `;
      })
      .join("")}
  `;
}

function renderAttention() {
  const rows = buildAttentionItems().filter((item) => rowMatchesFilter(item, filter));
  const element = $("maintenanceAttention");

  if (!rows.length) {
    element.innerHTML = '<div class="maintenance-empty-state">No maintenance attention items.</div>';
    return;
  }

  element.innerHTML = rows
    .map((item) => {
      const isMot = item.kind === "mot";
      const asset = item.asset || (item.record ? assets.find((entry) => entry.id === item.record.assetId) : null);
      const requirement = isMot ? "MOT" : label(item.record?.maintenanceType || "Maintenance");
      const dueLabel = isMot ? formatDate(asset?.motExpiry) : formatDate(item.record?.dueDate || item.record?.plannedDate || item.record?.booking?.bookedAt || item.record?.nextReviewDate);
      const statusText = isMot ? (item.state === "EXPIRED" ? "OVERDUE" : item.state === "URGENT" ? "URGENT" : "ATTENTION") : stateLabel(maintenanceState(item.record));
      const providerLabel = isMot ? "—" : providerFor(item.record);
      const providerMeta = isMot ? "MOT compliance" : (item.record?.booking?.bookedWith ? item.record.booking.bookedWith : "Not booked");
      const note = isMot ? "MOT compliance required" : item.record?.description || item.record?.conditionNote || "";
      const actionLabel = isMot ? "View Asset" : "Open";
      const assigned = assetAssignmentLabel(asset);

      return `
        <article class="maintenance-row maintenance-row--${isMot ? "mot" : "service"}">
          <div class="maintenance-signal">
            <span class="signal-dot signal-dot--${isMot ? "amber" : "blue"}"></span>
            <span>${esc(isMot ? "MOT" : requirement)}</span>
          </div>

          <div class="maintenance-asset">
            <strong class="maintenance-asset-reference">${esc(assetName(asset))}</strong>
            <span class="asset-title">${esc([asset?.make || asset?.manufacturer, asset?.model].filter(Boolean).join(" ") || "Owned asset")}</span>
            <small>${esc(asset?.plantType || asset?.assetType || "Owned asset")}</small>
          </div>

          <div class="maintenance-requirement">
            <span class="maintenance-label">Requirement</span>
            <strong>${esc(requirement)}</strong>
            ${note ? `<span class="maintenance-note">${esc(note)}</span>` : ""}
          </div>

          <div class="maintenance-due">
            <span class="maintenance-label">Due / expiry</span>
            <strong>${esc(dueLabel)}</strong>
            <span>${esc(isMot ? (item.state === "EXPIRED" ? "Expired" : item.state === "URGENT" ? "Urgent" : "Due soon") : stateDetail(item.record))}</span>
          </div>

          <div class="maintenance-status-column">
            <span class="maintenance-label">Status</span>
            <strong class="maintenance-status-pill maintenance-status-pill--${statusTone(statusText)}">${esc(statusText)}</strong>
            <span>${esc(isMot ? "Compliance" : item.record?.booking?.availability === "PLANNED_UNAVAILABLE" ? "Planned unavailable" : "Operational")}</span>
          </div>

          <div class="maintenance-assignment">
            <span class="maintenance-label">Provider / booking</span>
            <strong>${esc(providerLabel || "Not booked")}</strong>
            <span>${esc(providerMeta || "No booking recorded")}</span>
          </div>

          <div class="maintenance-last">
            <span class="maintenance-label">Assigned</span>
            <strong>${esc(assigned)}</strong>
            <span>${esc(assetAssignmentContext(asset))}</span>
          </div>

          <div class="maintenance-row-action">
            <button class="button-link" type="button" data-record="${(item.record || {}).id || ""}" data-asset="${asset?.id || ""}">${esc(actionLabel)} <span>→</span></button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRegister() {
  const searchValue = clean($("maintenanceSearch")?.value).toLowerCase();
  const typeValue = clean($("maintenanceTypeFilter")?.value || "");
  const statusValue = clean($("maintenanceStatusFilter")?.value || "");

  const rows = records.filter((record) => {
    if (!active(record)) return false;
    if (filter && !rowMatchesFilter({ kind: "maintenance", record, state: maintenanceState(record) }, filter)) return false;

    const asset = assets.find((entry) => entry.id === record.assetId);
    const searchTarget = [
      assetName(asset),
      record.maintenanceType,
      record.description,
      record.provider,
      record.booking?.bookedWith,
      assetAssignmentLabel(asset)
    ].join(" ").toLowerCase();

    const matchesSearch = !searchValue || searchTarget.includes(searchValue);
    const matchesType = !typeValue || label(record.maintenanceType || "") === label(typeValue);
    const matchesStatus = !statusValue || maintenanceState(record) === statusValue.toUpperCase().replace(/\s+/g, "_");
    return matchesSearch && matchesType && matchesStatus;
  });

  $("maintenanceCount").textContent = String(rows.length);

  $("maintenanceRegister").innerHTML = `
    <table class="maintenance-register-table">
      <thead>
        <tr>
          <th>Asset</th>
          <th>Requirement</th>
          <th>Due</th>
          <th>Position</th>
          <th>Booking</th>
          <th>Assigned / project</th>
          <th>Last work</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows.map((record) => {
          const asset = assets.find((entry) => entry.id === record.assetId);
          const state = maintenanceState(record);
          const assigned = assetAssignmentLabel(asset);
          const flagTone = state === "OVERDUE" ? "red" : state === "DUE" ? "amber" : state === "SCHEDULED" ? "blue" : state === "UNAVAILABLE" ? "green" : "amber";
          return `
            <tr>
              <td>
                <strong class="table-asset-reference">${esc(assetName(asset))}</strong>
                <span>${esc([asset?.make || asset?.manufacturer, asset?.model].filter(Boolean).join(" ") || "Owned asset")}</span>
              </td>
              <td>
                <strong>${esc(label(record.maintenanceType || "Maintenance"))}</strong>
                <span>${esc(record.description || "No notes recorded")}</span>
              </td>
              <td>
                <strong>${esc(formatDate(record.dueDate || record.plannedDate || record.booking?.bookedAt || record.nextReviewDate))}</strong>
                <span class="text-attention">${esc(record.booking?.bookedWith ? "Booked" : stateDetail(record))}</span>
              </td>
              <td><span class="status-pill status-pill--${flagTone}">${esc(stateLabel(state))}</span></td>
              <td>
                <strong>${esc(providerFor(record))}</strong>
                <span>${esc(record.booking?.availability === "PLANNED_UNAVAILABLE" ? "Planned unavailable" : record.booking?.bookedWith ? "Booking confirmed" : "Action required")}</span>
              </td>
              <td>
                <strong>${esc(assigned)}</strong>
                <span>${esc(assetAssignmentContext(asset))}</span>
              </td>
              <td>
                <strong>${esc(record.completedAt ? formatDate(record.completedAt) : "Not recorded")}</strong>
                <span>${esc(record.lastServiceDate ? `Service · ${formatDate(record.lastServiceDate)}` : "No recent work")}</span>
              </td>
              <td><button class="table-open-button" type="button" data-record="${record.id}">Open</button></td>
            </tr>
          `;
        }).join("") : '<tr><td colspan="8"><div class="maintenance-empty-state">No maintenance records match this filter.</div></td></tr>'}
      </tbody>
    </table>
  `;
}

function render() {
  renderSummaryCounts();
  renderTimeline();
  renderAttention();
  renderRegister();
}

function renderAssetOptions() {
  const select = $("maintenanceAssetSelect");
  if (!select) return;

  const currentValue = select.value;
  const ownedAssets = assets.filter(owned);
  select.innerHTML = '<option value="">Select owned asset</option>';
  ownedAssets
    .sort((first, second) => assetName(first).localeCompare(assetName(second)))
    .forEach((asset) => {
      const option = document.createElement("option");
      option.value = asset.id;
      option.textContent = assetName(asset);
      select.append(option);
    });

  if (assets.some((asset) => asset.id === currentValue && owned(asset))) {
    select.value = currentValue;
  }
}

async function load(name) {
  const snapshot = await getDocs(query(collection(db, name), where("organisationId", "==", org)));
  return snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
}

async function reload() {
  try {
    [assets, records] = await Promise.all([load("plantAssets"), load("plantMaintenance")]);
    renderAssetOptions();
    render();
    $("maintenanceStatus").textContent = "Maintenance control ready.";
  } catch (error) {
    $("maintenanceStatus").textContent = "Maintenance data unavailable.";
    $("maintenanceAttention").innerHTML = '<div class="maintenance-empty-state">No maintenance attention items.</div>';
    $("maintenanceRegister").innerHTML = '<div class="maintenance-empty-state">Maintenance data unavailable.</div>';
  }
}

function openAdd() {
  $("maintenanceForm").reset();
  renderAssetOptions();
  context();
  $("maintenanceDialog").showModal();
}

function context() {
  const selectedAsset = assets.find((entry) => entry.id === $("maintenanceAssetSelect").value);
  const panel = document.querySelector(".selected-maintenance-asset");
  if (!selectedAsset || !panel) return;

  panel.hidden = false;
  const reference = panel.querySelector(".selected-asset-reference");
  const model = panel.querySelector(".selected-maintenance-asset-main strong");
  if (reference) reference.textContent = selectedAsset.registrationNumber || selectedAsset.registration || selectedAsset.plantReference || selectedAsset.plantId || "Not recorded";
  if (model) model.textContent = [selectedAsset.make || selectedAsset.manufacturer, selectedAsset.model].filter(Boolean).join(" ") || "Not recorded";

  const details = [
    assetAssignmentLabel(selectedAsset),
    selectedAsset.currentProjectName || "Not recorded",
    selectedAsset.motExpiry || "Not recorded",
    selectedAsset.lastServiceDate || "Not recorded"
  ];

  panel.querySelectorAll(".selected-maintenance-context dd").forEach((element, index) => {
    if (details[index] !== undefined) element.textContent = details[index];
  });
}

async function create(event) {
  event.preventDefault();
  try {
    const selectedAsset = assets.find((entry) => entry.id === $("maintenanceAssetSelect").value);
    const uid = auth.currentUser?.uid;
    if (!selectedAsset || !owned(selectedAsset)) throw Error("Select an organisation-owned asset.");

    const data = omit({
      organisationId: org,
      assetId: selectedAsset.id,
      plantId: selectedAsset.plantId || selectedAsset.plantReference || null,
      plantReference: selectedAsset.plantReference || selectedAsset.plantId || null,
      registration: selectedAsset.registration || null,
      assetSnapshot: { identity: assetName(selectedAsset), assetType: selectedAsset.plantType || selectedAsset.assetType || null },
      maintenanceType: $("maintenanceType").value,
      description: clean($("maintenanceDescription").value) || null,
      dueDate: clean($("maintenanceDueDate").value) || null,
      mileageDue: Number($("maintenanceMileageDue").value) || null,
      operatingHoursDue: Number($("maintenanceHoursDue").value) || null,
      condition: clean($("maintenanceCondition").value) || null,
      conditionNote: clean($("maintenanceConditionNote").value) || null,
      nextReviewDate: clean($("maintenanceNextReview").value) || null,
      status: "UPCOMING",
      createdByUid: uid,
      createdByName: profile?.displayName || null,
      createdAt: serverTimestamp(),
      updatedByUid: uid,
      updatedByName: profile?.displayName || null,
      updatedAt: serverTimestamp()
    });

    await runTransaction(db, async (transaction) => {
      const userSnapshot = await transaction.get(doc(db, "users", uid));
      if (!userSnapshot.exists() || !manage(userSnapshot.data(), { organisationId: org })) {
        throw Error("Maintenance management permission required.");
      }
      transaction.set(doc(collection(db, "plantMaintenance")), data);
    });

    $("maintenanceDialog").close();
    await reload();
  } catch (error) {
    $("maintenanceStatus").textContent = error.message;
  }
}

function populateDrawer(record) {
  const asset = assets.find((entry) => entry.id === record?.assetId) || null;
  const drawer = $("maintenanceDrawer");
  const backDrop = $("maintenanceDrawerBackdrop");
  if (!drawer || !backDrop) return;

  const state = maintenanceState(record);
  const statusPill = drawer.querySelector(".drawer-status-line .status-pill");
  if (statusPill) {
    statusPill.className = `status-pill status-pill--${state === "OVERDUE" ? "red" : state === "DUE" ? "amber" : state === "SCHEDULED" ? "blue" : state === "UNAVAILABLE" ? "green" : "amber"}`;
    statusPill.textContent = stateLabel(state);
  }

  const drawerReference = drawer.querySelector(".drawer-asset-reference");
  if (drawerReference) drawerReference.textContent = assetName(asset);
  const drawerTitle = drawer.querySelector(".drawer-title-line span:last-child");
  if (drawerTitle) drawerTitle.textContent = asset?.model ? [asset.make || asset.manufacturer, asset.model].filter(Boolean).join(" ") : "Asset";
  const heading = drawer.querySelector(".drawer-asset-heading h2");
  if (heading) heading.textContent = label(record?.maintenanceType || "Maintenance");

  const detailValues = [
    assetAssignmentLabel(asset),
    asset?.currentProjectName || "Not recorded",
    asset?.motExpiry ? formatDate(asset.motExpiry) : "Not recorded",
    record?.dueDate || record?.plannedDate || record?.nextReviewDate ? formatDate(record.dueDate || record.plannedDate || record.nextReviewDate) : "Not recorded",
    asset?.lastServiceDate ? formatDate(asset.lastServiceDate) : "Not recorded",
    asset?.lastServiceMileage ? String(asset.lastServiceMileage) : "Not recorded",
    asset?.currentMileage ? String(asset.currentMileage) : "Not recorded",
    owned(asset) ? "Company owned" : "Not recorded"
  ];
  drawer.querySelectorAll(".maintenance-detail-grid dd").forEach((element, index) => {
    if (detailValues[index] !== undefined) element.textContent = detailValues[index];
  });

  backDrop.hidden = false;
  drawer.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
}

function openRecord(record) {
  if (!record) return;
  populateDrawer(record);
}

function closeRecord() {
  $("maintenanceDrawerBackdrop").hidden = true;
  $("maintenanceDrawer").hidden = true;
  $("maintenanceDrawer").setAttribute("aria-hidden", "true");
}

function bind() {
  $("addMaintenance").onclick = openAdd;
  $("maintenanceForm").onsubmit = create;
  $("maintenanceDialogClose").onclick = () => $("maintenanceDialog").close();
  $("maintenanceCancel").onclick = () => $("maintenanceDialog").close();
  $("maintenanceAssetSelect").onchange = context;
  $("maintenanceDrawerClose").onclick = closeRecord;
  $("maintenanceDrawerBackdrop").onclick = closeRecord;

  ["maintenanceSearch", "maintenanceTypeFilter", "maintenanceStatusFilter", "maintenanceAssetTypeFilter", "maintenanceProjectFilter"].forEach((id) => {
    const element = $(id);
    if (!element) return;
    element.addEventListener(id === "maintenanceSearch" ? "input" : "change", renderRegister);
  });

  document.querySelectorAll("#maintenanceSummary .position-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const nextFilter = tile.dataset.filter;
      filter = filter === nextFilter ? "" : nextFilter;
      render();
    });
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-record]");
    if (!button) return;
    const record = records.find((entry) => entry.id === button.dataset.record);
    if (record) openRecord(record);
  });
}

function wireDialogClose() {
  ["maintenanceDialog", "maintenanceBookingDialog", "maintenanceCompletionDialog"].map($).filter(Boolean).forEach((dialog) => {
    const close = () => dialog.open && dialog.close();
    dialog.querySelectorAll(".dialog-close,.button-secondary[type=button]").forEach((button) => button.addEventListener("click", close));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("maintenanceDrawer")?.hidden) closeRecord();
  });
}

function wait() {
  wireDialogClose();
  if (window.NORMEX_CURRENT_USER) init(window.NORMEX_CURRENT_USER);
  else window.addEventListener("normex:workspace-ready", (event) => init(event.detail.profile), { once: true });
}

async function init(profileData) {
  profile = profileData;
  org = profileData?.organisationId;
  initialisePlantShell({ activePage: "maintenance", workspaceName: "Fleet & Transport Control" });

  if (!org) {
    $("maintenanceStatus").textContent = "Unavailable: organisation context is missing.";
    return;
  }

  $("addMaintenance").hidden = !manage(profile);
  bind();
  await reload();
}

wait();
