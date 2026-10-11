import { auth, db } from "/js/firebase.js";
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { initialisePlantShell } from "/modules/contractor/plant/shared/plant-shell.js";
import { calculateHire } from "/modules/contractor/plant/shared/plant-hire.js";
import { escapePlantHtml as esc, parsePlantDate } from "/modules/contractor/plant/shared/plant-utils.js";

const $ = id => document.getElementById(id);
const clean = value => String(value ?? "").trim();
const upper = value => clean(value).toUpperCase();
const key = value => upper(value).replace(/[^A-Z0-9]+/g, "_");
const makeId = () => globalThis.crypto?.randomUUID?.() || `contact-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const labels = { PLANT_HIRE: "Plant Hire", VEHICLE_HIRE: "Vehicle Hire", TRANSPORT: "Transport", WORKSHOP: "Workshop", PARTS: "Parts", TYRES: "Tyres", INSPECTION: "Inspection", OTHER: "Other" };
const departments = { HIRE_DESK: "Hire Desk", BREAKDOWN: "Breakdown", WORKSHOP: "Workshop", TRANSPORT: "Transport", ACCOUNTS: "Accounts", SALES: "Sales", OTHER: "Other" };

let profile;
let organisationId;
let suppliers = [];
let hires = [];
let assets = [];
let maintenance = [];
let movements = [];
let failedReads = [];
let currentSupplierId = null;
let editingSupplierId = null;
let contactRows = [];
let filters = { search: "", category: "", status: "" };

function canManage(person = profile) {
  const permissions = person?.permissions || {};
  const role = upper(person?.roleCode || person?.role);
  return person?.status === "ACTIVE" && person.organisationId === organisationId && (
    Number(person.accessLevel) >= 99 || permissions.canManagePlant === true || permissions.canManageTransport === true || permissions.canManageOrganisation === true || ["ORGANISATION_MANAGER", "PLANT_TRANSPORT_MANAGER"].includes(role)
  );
}

function canViewCosts() {
  const permissions = profile?.permissions || {};
  return Number(profile?.accessLevel) >= 99 || canManage() || permissions.canViewCommercial === true || permissions.canManageCommercial === true;
}

function categories(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map(key).filter(value => labels[value]))];
}

function contact(value = {}) {
  return {
    contactId: clean(value.contactId || value.id) || makeId(),
    department: key(value.department),
    contactName: clean(value.contactName || value.name),
    jobTitle: clean(value.jobTitle),
    phone: clean(value.phone),
    mobile: clean(value.mobile),
    email: clean(value.email),
    availability: clean(value.availability),
    notes: clean(value.notes),
    isPrimary: value.isPrimary === true
  };
}

function supplier(data, id) {
  return { ...data, id, name: clean(data.name), categories: categories(data.categories || data.category), status: upper(data.status || "ACTIVE") === "INACTIVE" ? "INACTIVE" : "ACTIVE", contacts: Array.isArray(data.contacts) ? data.contacts.map(contact) : [], preferredSupplier: data.preferredSupplier === true, approvedSupplier: data.approvedSupplier === true };
}

function date(value) {
  const parsed = parsePlantDate(value);
  return parsed ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed) : "Not recorded";
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(number) : "Not recorded";
}

function activeHire(record) {
  return ["ACTIVE", "OFF_HIRE_REQUESTED"].includes(upper(record?.status)) && !record?.offHireConfirmedDate;
}

function linkedTo(record, supplierRecord) {
  if (!record || !supplierRecord) return false;
  if (record.supplierId === supplierRecord.id || record.transportSupplierId === supplierRecord.id) return true;
  const names = [record.supplierName, record.transportSupplier, record.provider].map(value => clean(value).toLowerCase()).filter(Boolean);
  return names.includes(supplierRecord.name.toLowerCase());
}

function related(supplierRecord) {
  return {
    hires: hires.filter(record => linkedTo(record, supplierRecord)),
    assets: assets.filter(record => linkedTo(record, supplierRecord)),
    maintenance: maintenance.filter(record => linkedTo(record, supplierRecord)),
    movements: movements.filter(record => linkedTo(record, supplierRecord))
  };
}

function exposure(records) {
  return records.filter(activeHire).map(record => calculateHire(record)).filter(result => result.state === "KNOWN").reduce((sum, result) => sum + result.estimatedCost, 0);
}

function primaryContact(supplierRecord) {
  return supplierRecord.contacts.find(item => item.isPrimary) || supplierRecord.contacts.find(item => item.contactName || item.phone || item.email);
}

function visibleSuppliers() {
  return suppliers.filter(item => {
    const text = [item.name, item.address, item.postcode, ...item.categories, ...item.contacts.flatMap(value => Object.values(value))].join(" ").toLowerCase();
    return (!filters.search || text.includes(filters.search.toLowerCase())) && (!filters.category || item.categories.includes(filters.category)) && (!filters.status || item.status === filters.status);
  });
}

function setPageStatus(text) {
  const target = $("supplierPageStatus");
  if (target) target.textContent = text;
}

function renderExposure() {
  const active = hires.filter(activeHire);
  $("supplierActiveHireCount").textContent = failedReads.includes("plantHireRecords") ? "Unavailable" : String(active.length);
  $("supplierCurrentExposure").textContent = !canViewCosts() ? "Restricted" : failedReads.includes("plantHireRecords") ? "Unavailable" : money(exposure(active));
  $("supplierWorkshopCount").textContent = failedReads.includes("plantSuppliers") ? "Unavailable" : String(suppliers.filter(item => item.categories.includes("WORKSHOP")).length);
  $("supplierTransportCount").textContent = failedReads.includes("plantSuppliers") ? "Unavailable" : String(suppliers.filter(item => item.categories.includes("TRANSPORT")).length);
}

function renderPerformance() {
  const linkedMaintenance = maintenance.filter(record => suppliers.some(item => linkedTo(record, item)));
  const openJobs = linkedMaintenance.filter(record => !["COMPLETED", "CANCELLED"].includes(upper(record.status))).length;
  const downtime = linkedMaintenance.reduce((sum, record) => sum + (Number(record.downtimeDays) || Number(record.plannedDowntimeDays) || 0), 0);
  $("supplierPerformanceMetrics").innerHTML = [["Active suppliers", suppliers.filter(item => item.status === "ACTIVE").length], ["Active hires", failedReads.includes("plantHireRecords") ? "Unavailable" : hires.filter(activeHire).length], ["Open linked jobs", failedReads.includes("plantMaintenance") ? "Unavailable" : openJobs], ["Recorded downtime", failedReads.includes("plantMaintenance") ? "Unavailable" : `${downtime} days`]].map(([name, value]) => `<div class="suppliers-performance-metric"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join("");
  const bars = suppliers.map(item => ({ name: item.name, days: maintenance.filter(record => linkedTo(record, item)).reduce((sum, record) => sum + (Number(record.downtimeDays) || Number(record.plannedDowntimeDays) || 0), 0) })).filter(item => item.days > 0).sort((a, b) => b.days - a.days);
  $("supplierDowntimeChart").innerHTML = failedReads.includes("plantMaintenance") ? `<div class="suppliers-truth-state">Supplier-linked downtime unavailable.</div>` : bars.length ? bars.map(item => `<div class="supplier-bar-row"><span>${esc(item.name)}</span><div><i style="width:${Math.max(8, Math.round(item.days / bars[0].days * 100))}%"></i></div><strong>${item.days}d</strong></div>`).join("") : `<div class="suppliers-truth-state">Not enough supplier-linked history yet.</div>`;
}

function renderCards() {
  const list = visibleSuppliers();
  $("supplierCount").textContent = String(list.length);
  if (!list.length) {
    $("supplierCardGrid").innerHTML = `<div class="suppliers-empty-state"><strong>${suppliers.length ? "No suppliers match this view" : "No suppliers recorded"}</strong><span>${suppliers.length ? "Adjust the search or filters to see other suppliers." : "Add your first Plant, transport or workshop supplier."}</span></div>`;
    return;
  }
  $("supplierCardGrid").innerHTML = list.map(item => {
    const main = primaryContact(item);
    const active = related(item).hires.filter(activeHire);
    const commitment = canViewCosts() ? exposure(active) : null;
    return `<article class="supplier-card"><div class="supplier-card__header"><div><div class="supplier-card__categories">${item.categories.map(value => `<span class="supplier-card__category">${esc(labels[value])}</span>`).join("")}</div><h4 class="supplier-card__name">${esc(item.name)}</h4><div class="supplier-card__location">${esc([item.address, item.postcode].filter(Boolean).join(" · ") || "Location not recorded")}</div></div><span class="supplier-card__status ${item.status === "INACTIVE" ? "is-inactive" : ""}">${item.status}</span></div><div class="supplier-card__contact"><div><span>Primary contact</span><strong>${esc(main?.contactName || main?.jobTitle || "Not recorded")}</strong></div><div><span>Reach</span><strong>${esc(main?.phone || main?.mobile || main?.email || "Not recorded")}</strong></div></div><div class="supplier-card__commercial"><div><span>Active hires</span><strong>${failedReads.includes("plantHireRecords") ? "Unavailable" : active.length}</strong></div><div><span>Current commitment</span><strong>${commitment === null ? "Restricted" : money(commitment)}</strong></div></div><div class="supplier-card__footer"><button class="suppliers-card-action" type="button" data-open-supplier="${esc(item.id)}">Open supplier</button></div></article>`;
  }).join("");
}

function renderContacts() {
  const rows = visibleSuppliers().flatMap(item => item.contacts.filter(value => value.contactName || value.phone || value.email).map(value => ({ supplier: item, contact: value })));
  $("supplierContactBody").innerHTML = rows.length ? rows.map(({ supplier: item, contact: value }) => `<tr><td>${esc(item.name)}</td><td>${esc(departments[value.department] || value.department || "Other")}</td><td><strong>${esc(value.contactName || "Not recorded")}</strong>${value.jobTitle ? `<small>${esc(value.jobTitle)}</small>` : ""}</td><td>${value.phone || value.mobile ? `<a href="tel:${esc(value.phone || value.mobile)}">${esc(value.phone || value.mobile)}</a>` : "Not recorded"}</td><td>${value.email ? `<a href="mailto:${esc(value.email)}">${esc(value.email)}</a>` : "Not recorded"}</td><td>${esc(value.availability || "Not recorded")}</td></tr>`).join("") : `<tr><td colspan="6"><div class="suppliers-empty-state suppliers-empty-state--table"><strong>No contacts match this view</strong><span>Contacts will appear here when recorded.</span></div></td></tr>`;
}

function renderAll() { renderExposure(); renderPerformance(); renderCards(); renderContacts(); }

async function readCollection(name) {
  const snapshot = await getDocs(query(collection(db, name), where("organisationId", "==", organisationId)));
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
}

async function reload() {
  setPageStatus("Loading supplier directory…");
  const names = ["plantSuppliers", "plantHireRecords", "plantAssets", "plantMaintenance", "plantMovements"];
  const results = await Promise.allSettled(names.map(readCollection));
  failedReads = results.flatMap((result, index) => result.status === "rejected" ? [names[index]] : []);
  const values = results.map(result => result.status === "fulfilled" ? result.value : []);
  suppliers = values[0].map((value, index) => supplier(value, value.id || String(index)));
  hires = values[1]; assets = values[2]; maintenance = values[3]; movements = values[4];
  setPageStatus(failedReads.length ? "Supplier directory loaded with unavailable linked data." : "Supplier directory ready.");
  renderAll();
}

function selectedCategories() { return [...$("supplierCategory").selectedOptions].map(option => option.value).filter(Boolean); }

function readForm() {
  return { name: clean($("supplierName").value), categories: selectedCategories(), status: upper($("supplierStatus").value), preferredSupplier: $("supplierPreferred").checked, approvedSupplier: $("supplierApproved").checked, mainPhone: clean($("supplierPhone").value) || null, mainEmail: clean($("supplierEmail").value) || null, address: clean($("supplierAddress").value) || null, postcode: clean($("supplierPostcode").value) || null, accountReference: clean($("supplierAccountReference").value) || null, paymentTerms: clean($("supplierPaymentTerms").value) || null, commercialNotes: clean($("supplierCommercialNotes").value) || null, notes: clean($("supplierNotes").value) || null, contacts: contactRows.map(contact) };
}

function renderContactEditor() {
  const root = $("supplierContactEditor");
  if (!contactRows.length) { root.innerHTML = `<div class="suppliers-empty-state"><strong>No department contacts</strong><span>Add more than one contact in the same department when needed.</span></div>`; return; }
  root.innerHTML = contactRows.map(value => `<div class="suppliers-contact-editor-row" data-contact-id="${esc(value.contactId)}"><select data-field="department"><option value="">Department</option>${Object.entries(departments).map(([id, name]) => `<option value="${id}">${name}</option>`).join("")}</select><input data-field="contactName" value="${esc(value.contactName)}" placeholder="Contact name" /><input data-field="jobTitle" value="${esc(value.jobTitle)}" placeholder="Job title" /><input data-field="phone" value="${esc(value.phone)}" placeholder="Phone" /><input data-field="mobile" value="${esc(value.mobile)}" placeholder="Mobile" /><input data-field="email" value="${esc(value.email)}" placeholder="Email" /><input data-field="availability" value="${esc(value.availability)}" placeholder="Availability" /><label class="supplier-contact-primary"><input type="checkbox" data-field="isPrimary" ${value.isPrimary ? "checked" : ""} /> Primary</label><button class="suppliers-contact-remove" type="button" data-remove-contact="${esc(value.contactId)}">×</button></div>`).join("");
  root.querySelectorAll("[data-contact-id]").forEach(row => { const item = contactRows.find(value => value.contactId === row.dataset.contactId); row.querySelector('[data-field="department"]').value = item.department; row.querySelectorAll("[data-field]").forEach(input => input.addEventListener("input", () => { item[input.dataset.field] = input.type === "checkbox" ? input.checked : input.value; })); });
  root.querySelectorAll("[data-remove-contact]").forEach(button => button.addEventListener("click", () => { contactRows = contactRows.filter(value => value.contactId !== button.dataset.removeContact); renderContactEditor(); }));
}

function openForm(item = null) {
  editingSupplierId = item?.id || null;
  $("supplierForm").reset();
  $("supplierDialogTitle").textContent = item ? "Edit Supplier" : "Add Supplier";
  $("supplierDialogDescription").textContent = item ? "Update supplier master data, contacts and operating status." : "Add organisation and operational contact information.";
  $("supplierName").value = item?.name || "";
  [...$("supplierCategory").options].forEach(option => { option.selected = item?.categories.includes(option.value) || false; });
  $("supplierStatus").value = item?.status || "ACTIVE"; $("supplierPreferred").checked = item?.preferredSupplier === true; $("supplierApproved").checked = item?.approvedSupplier === true;
  $("supplierPhone").value = item?.mainPhone || ""; $("supplierEmail").value = item?.mainEmail || ""; $("supplierAddress").value = item?.address || ""; $("supplierPostcode").value = item?.postcode || ""; $("supplierAccountReference").value = item?.accountReference || ""; $("supplierPaymentTerms").value = item?.paymentTerms || ""; $("supplierCommercialNotes").value = item?.commercialNotes || ""; $("supplierNotes").value = item?.notes || "";
  contactRows = (item?.contacts || []).map(contact); renderContactEditor(); $("supplierFormError").hidden = true; $("supplierDialog").showModal();
}

async function saveSupplier(event) {
  event.preventDefault();
  const error = $("supplierFormError"); const data = readForm();
  if (!data.name || !data.categories.length || !["ACTIVE", "INACTIVE"].includes(data.status)) { error.textContent = "Supplier name, at least one category and status are required."; error.hidden = false; return; }
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) { error.textContent = "Authentication is required to save suppliers."; error.hidden = false; return; }
  try {
    const reference = editingSupplierId ? doc(db, "plantSuppliers", editingSupplierId) : doc(collection(db, "plantSuppliers"));
    await runTransaction(db, async transaction => {
      const userSnapshot = await transaction.get(doc(db, "users", currentUid));
      if (!userSnapshot.exists() || !canManage(userSnapshot.data())) throw new Error("Supplier management permission required.");
      if (editingSupplierId) {
        const existing = await transaction.get(reference);
        if (!existing.exists() || existing.data().organisationId !== organisationId) throw new Error("Supplier record unavailable.");
        transaction.update(reference, { ...data, updatedByUid: currentUid, updatedByName: profile?.displayName || null, updatedAt: serverTimestamp() });
      } else {
        transaction.set(reference, { ...data, organisationId, createdByUid: currentUid, createdByName: profile?.displayName || null, createdAt: serverTimestamp(), updatedByUid: currentUid, updatedByName: profile?.displayName || null, updatedAt: serverTimestamp() });
      }
    });
    $("supplierDialog").close(); await reload();
  } catch (saveError) { error.textContent = saveError.message || "Supplier could not be saved."; error.hidden = false; }
}

function openDrawer(id) {
  const item = suppliers.find(value => value.id === id); if (!item) return;
  currentSupplierId = id; const data = related(item); const commitment = canViewCosts() ? exposure(data.hires) : null;
  $("supplierDrawerCategory").textContent = item.categories.map(value => labels[value]).join(" · ") || "Supplier"; $("supplierDrawerTitle").textContent = item.name; $("supplierDrawerSubtitle").textContent = `${item.status} · ${item.address || item.postcode || "Location not recorded"}`;
  $("supplierDrawerBody").innerHTML = `<section class="supplier-drawer-section"><h3>Supplier identity</h3><div class="supplier-drawer-facts"><div><span>Status</span><strong>${item.status}</strong></div><div><span>Flags</span><strong>${[item.preferredSupplier && "Preferred", item.approvedSupplier && "Approved"].filter(Boolean).join(" · ") || "Not recorded"}</strong></div><div><span>Main phone</span><strong>${item.mainPhone ? `<a href="tel:${esc(item.mainPhone)}">${esc(item.mainPhone)}</a>` : "Not recorded"}</strong></div><div><span>Main email</span><strong>${item.mainEmail ? `<a href="mailto:${esc(item.mainEmail)}">${esc(item.mainEmail)}</a>` : "Not recorded"}</strong></div><div><span>Account reference</span><strong>${esc(item.accountReference || "Not recorded")}</strong></div><div><span>Payment terms</span><strong>${esc(item.paymentTerms || "Not recorded")}</strong></div></div></section><section class="supplier-drawer-section"><h3>Contacts</h3>${item.contacts.length ? item.contacts.map(value => `<div class="supplier-drawer-contact"><strong>${esc(value.contactName || "Unnamed contact")}</strong><span>${esc(departments[value.department] || value.department || "Other")}${value.jobTitle ? ` · ${esc(value.jobTitle)}` : ""}</span><span>${esc(value.phone || value.mobile || value.email || "Not recorded")}</span></div>`).join("") : `<div class="suppliers-truth-state">No department contacts recorded.</div>`}</section><section class="supplier-drawer-section"><h3>Current operational exposure</h3><div class="supplier-drawer-facts"><div><span>Active hires</span><strong>${failedReads.includes("plantHireRecords") ? "Unavailable" : data.hires.filter(activeHire).length}</strong></div><div><span>Hire commitment</span><strong>${commitment === null ? "Restricted" : money(commitment)}</strong></div><div><span>Supplied assets</span><strong>${failedReads.includes("plantAssets") ? "Unavailable" : data.assets.length}</strong></div><div><span>Open maintenance</span><strong>${failedReads.includes("plantMaintenance") ? "Unavailable" : data.maintenance.filter(value => !["COMPLETED", "CANCELLED"].includes(upper(value.status))).length}</strong></div><div><span>Transport records</span><strong>${failedReads.includes("plantMovements") ? "Unavailable" : data.movements.length}</strong></div></div></section><section class="supplier-drawer-section"><h3>Linked records</h3><p class="supplier-drawer-note">Only supplier IDs or exact legacy supplier names are used for relationships.</p>${data.assets.length ? `<ul>${data.assets.map(value => `<li>${esc(value.plantReference || value.plantId || value.id)} · ${esc([value.manufacturer, value.model].filter(Boolean).join(" ") || "Asset")}</li>`).join("")}</ul>` : `<div class="suppliers-truth-state">No supplier-linked assets recorded.</div>`}</section><section class="supplier-drawer-section"><h3>Documents</h3><div class="suppliers-truth-state">Document uploads are unavailable because Storage rules deny all access. No document metadata was created.</div></section>`;
  $("editSupplierButton").hidden = !canManage(); $("supplierDrawer").classList.add("is-open"); $("supplierDrawer").setAttribute("aria-hidden", "false");
}

function closeDrawer() { $("supplierDrawer").classList.remove("is-open"); $("supplierDrawer").setAttribute("aria-hidden", "true"); }

function bind() {
  $("addSupplierButton").addEventListener("click", () => openForm()); $("supplierForm").addEventListener("submit", saveSupplier); $("supplierDialogClose").addEventListener("click", () => $("supplierDialog").close()); $("supplierCancelButton").addEventListener("click", () => $("supplierDialog").close()); $("addSupplierContactButton").addEventListener("click", () => { contactRows.push(contact()); renderContactEditor(); }); $("supplierDrawerClose").addEventListener("click", closeDrawer); $("supplierDrawerBackdrop").addEventListener("click", closeDrawer); $("editSupplierButton").addEventListener("click", () => { const item = suppliers.find(value => value.id === currentSupplierId); closeDrawer(); if (item) openForm(item); });
  ["supplierSearchInput", "supplierCategoryFilter", "supplierStatusFilter"].forEach(id => $(id).addEventListener(id === "supplierSearchInput" ? "input" : "change", () => { filters = { search: clean($("supplierSearchInput").value), category: $("supplierCategoryFilter").value, status: $("supplierStatusFilter").value }; renderCards(); renderContacts(); }));
  document.addEventListener("click", event => { const trigger = event.target.closest("[data-open-supplier]"); if (trigger) openDrawer(trigger.dataset.openSupplier); }); document.addEventListener("keydown", event => { if (event.key === "Escape") { closeDrawer(); if ($("supplierDialog")?.open) $("supplierDialog").close(); } });
}

async function init(profileData) {
  profile = profileData; organisationId = profileData?.organisationId; initialisePlantShell({ activePage: "suppliers", workspaceName: "Fleet & Transport Control" });
  if (!organisationId) { setPageStatus("Organisation context is missing."); return; }
  $("addSupplierButton").hidden = !canManage(); bind(); await reload();
}

if (window.NORMEX_CURRENT_USER) init(window.NORMEX_CURRENT_USER); else window.addEventListener("normex:workspace-ready", event => init(event.detail.profile), { once: true });
