import { app, auth, db } from "/js/firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import { ROLE_CODES, getAssignableAccountRoleOptions, getProfileRoleCode, getRoleLabel } from "/modules/contractor/shared/js/roles.js";

const $ = id => document.getElementById(id), clean = value => String(value ?? "").trim();
const functions = getFunctions(app, "europe-west2"), manageUserAccount = httpsCallable(functions, "manageUserAccount");
const EMPLOYMENT_LABELS = { EMPLOYEE: "Employee", AGENCY: "Agency", SUBCONTRACTOR: "Subcontractor" };
const STATUS_LABELS = { ACTIVE: "Active", INVITED: "Invited", INACTIVE: "Inactive" };
let profile = null, organisationId = null, accounts = [], selectedEmploymentFilter = "", selectedAccountUid = null, pendingStatusAction = null, loadingState = "LOADING", saving = false;

const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const displayName = account => clean(account.displayName) || [account.firstName, account.surname || account.lastName].map(clean).filter(Boolean).join(" ") || clean(account.email) || "Unnamed account";
const formatDate = value => { const date = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date) : "Not recorded"; };
const isPlatform = actor => getProfileRoleCode(actor) === ROLE_CODES.PLATFORM_ADMIN && Number(actor?.accessLevel) === 99 && actor?.status === "ACTIVE";
const canAdminister = actor => isPlatform(actor) || (getProfileRoleCode(actor) === ROLE_CODES.ORGANISATION_MANAGER && Number(actor?.accessLevel) === 6 && actor?.status === "ACTIVE" && actor?.permissions?.canManageUsers === true && actor?.permissions?.canManageOrganisation === true);
const canManage = account => canAdminister(profile) && account.uid !== auth.currentUser?.uid && (isPlatform(profile) || account.organisationId === organisationId) && Number(account.accessLevel) < Number(profile.accessLevel);
const selectedAccount = () => accounts.find(account => account.uid === selectedAccountUid) || null;

function showMessage(id, message) { const element = $(id); if (!element) return; element.textContent = message; element.hidden = false; }
function hideMessage(id) { const element = $(id); if (!element) return; element.textContent = ""; element.hidden = true; }
function setBusy(buttonId, busy, busyLabel) { const button = $(buttonId); if (!button) return; if (!button.dataset.label) button.dataset.label = button.textContent.trim(); button.disabled = busy; button.textContent = busy ? busyLabel : button.dataset.label; }
function truth(title, detail) { return `<div class="admin-empty-state"><strong>${esc(title)}</strong><span>${esc(detail)}</span></div>`; }

function authorityOptions(include = "") {
  const options = getAssignableAccountRoleOptions(profile);
  if (include && !options.some(option => option.value === include)) options.push({ value: include, label: getRoleLabel(include) });
  return options.map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("");
}

function populateAuthorityControls() {
  const filterValue = $("adminAuthorityFilter").value;
  $("adminAuthorityFilter").innerHTML = `<option value="">All accessible authority</option>${Object.values(ROLE_CODES).map(role => `<option value="${esc(role)}">${esc(getRoleLabel(role))}</option>`).join("")}`;
  $("adminAuthorityFilter").value = filterValue;
  $("inviteAuthority").innerHTML = authorityOptions();
  if ([...$("inviteAuthority").options].some(option => option.value === ROLE_CODES.WORKER)) $("inviteAuthority").value = ROLE_CODES.WORKER;
}

function renderLoading() {
  $("adminSystemStatus").textContent = "Loading organisation accounts…";
  ["adminActiveCount", "adminInvitedCount", "adminInactiveCount", "adminEmployeeCount", "adminAgencyCount", "adminSubcontractorCount", "adminDirectoryCount"].forEach(id => { $(id).textContent = "—"; });
  $("adminAccountTableBody").innerHTML = `<tr class="admin-empty-row"><td colspan="7">${truth("Loading account directory", "Current organisation accounts are being loaded.")}</td></tr>`;
}

function renderUnavailable(message) {
  $("adminSystemStatus").textContent = message;
  ["adminActiveCount", "adminInvitedCount", "adminInactiveCount", "adminEmployeeCount", "adminAgencyCount", "adminSubcontractorCount", "adminDirectoryCount"].forEach(id => { $(id).textContent = "Unavailable"; });
  $("adminAccountTableBody").innerHTML = `<tr class="admin-empty-row"><td colspan="7">${truth("Accounts unavailable", message)}</td></tr>`;
}

function filteredAccounts() {
  const search = clean($("adminSearchInput").value).toLowerCase(), status = $("adminStatusFilter").value, authority = $("adminAuthorityFilter").value;
  return accounts.filter(account => {
    const text = [account.firstName, account.surname, account.lastName, account.displayName, account.email, account.position, account.phone].join(" ").toLowerCase();
    return (!selectedEmploymentFilter || account.employmentType === selectedEmploymentFilter) && (!search || text.includes(search)) && (!status || account.status === status) && (!authority || getProfileRoleCode(account) === authority);
  }).sort((a, b) => displayName(a).localeCompare(displayName(b)));
}

function renderSummary() {
  const count = (field, value) => accounts.filter(account => account[field] === value).length;
  $("adminActiveCount").textContent = count("status", "ACTIVE");
  $("adminInvitedCount").textContent = count("status", "INVITED");
  $("adminInactiveCount").textContent = count("status", "INACTIVE");
  $("adminEmployeeCount").textContent = count("employmentType", "EMPLOYEE");
  $("adminAgencyCount").textContent = count("employmentType", "AGENCY");
  $("adminSubcontractorCount").textContent = count("employmentType", "SUBCONTRACTOR");
}

function renderDirectory() {
  if (loadingState !== "LOADED") return;
  const rows = filteredAccounts();
  $("adminDirectoryCount").textContent = rows.length;
  $("adminAccountTableBody").innerHTML = rows.length ? rows.map(account => `<tr data-account-uid="${esc(account.uid)}"><td><div class="admin-user-cell"><strong>${esc(displayName(account))}</strong><span>${esc(account.phone || "No phone recorded")}</span></div></td><td>${esc(EMPLOYMENT_LABELS[account.employmentType] || "Not recorded")}</td><td>${esc(account.position || "Not recorded")}</td><td>${esc(account.email || "Not recorded")}</td><td>${esc(getRoleLabel(getProfileRoleCode(account)))}</td><td><span class="admin-status-chip is-${esc(String(account.status || "unknown").toLowerCase())}">${esc(STATUS_LABELS[account.status] || "Unknown")}</span></td><td><button class="admin-row-button" type="button" data-account-action="OPEN" data-account-uid="${esc(account.uid)}">Open</button></td></tr>`).join("") : `<tr class="admin-empty-row"><td colspan="7">${truth(accounts.length ? "No matching accounts" : "No organisation accounts", accounts.length ? "Adjust the account filters." : "Invite the first user when organisation access is required.")}</td></tr>`;
}

function renderAll() { renderSummary(); renderDirectory(); }

async function loadAccounts() {
  loadingState = "LOADING"; renderLoading();
  try {
    const snapshot = await getDocs(query(collection(db, "users"), where("organisationId", "==", organisationId)));
    accounts = snapshot.docs.map(item => ({ uid: item.id, ...item.data() }));
    loadingState = "LOADED";
    $("adminSystemStatus").textContent = accounts.length ? "Organisation account administration ready." : "No organisation accounts are currently recorded.";
    renderAll();
  } catch (error) {
    accounts = []; loadingState = error?.code?.includes("permission-denied") ? "PERMISSION_DENIED" : "ERROR";
    console.error("Admin account directory load failed:", error);
    renderUnavailable(loadingState === "PERMISSION_DENIED" ? "You do not have permission to view organisation accounts." : "Account information is unavailable. Retry when the service is available.");
  }
}

function setEmploymentFilter(value) {
  selectedEmploymentFilter = value;
  document.querySelectorAll("[data-employment-filter]").forEach(button => button.classList.toggle("is-active", (button.dataset.employmentFilter || "") === value));
  renderDirectory();
}

function openInviteDialog() {
  $("inviteUserForm").reset(); $("inviteEmploymentType").value = "EMPLOYEE"; populateAuthorityControls(); hideMessage("inviteUserError"); $("inviteUserDialog").showModal();
}

function openEditDialog(account) {
  if (!account || !canManage(account)) return;
  $("editAccountUid").value = account.uid; $("editFirstName").value = account.firstName || ""; $("editSurname").value = account.surname || account.lastName || ""; $("editEmploymentType").value = account.employmentType || "EMPLOYEE"; $("editPosition").value = account.position || ""; $("editPhone").value = account.phone || "";
  const role = getProfileRoleCode(account) || "WORKER"; $("editAuthority").innerHTML = authorityOptions(role); $("editAuthority").value = role; hideMessage("editAccountError"); $("editAccountDialog").showModal();
}

function closeDialog(id) { const dialog = $(id); if (dialog?.open) dialog.close(); }

function openDrawer(uid) {
  const account = accounts.find(item => item.uid === uid); if (!account) return; selectedAccountUid = uid;
  $("adminAccountDrawerStatus").textContent = STATUS_LABELS[account.status] || "Account"; $("adminAccountDrawerTitle").textContent = displayName(account); $("adminAccountDrawerSubtitle").textContent = account.email || "Email not recorded";
  const facts = [["Email", account.email || "Not recorded"], ["Phone", account.phone || "Not recorded"], ["Employment", EMPLOYMENT_LABELS[account.employmentType] || "Not recorded"], ["Position", account.position || "Not recorded"], ["Authority", getRoleLabel(getProfileRoleCode(account))], ["Account status", STATUS_LABELS[account.status] || "Unknown"], ["Invitation", account.status === "INVITED" ? account.invitationLastSendStatus === "FAILED" ? "Delivery failed" : "Awaiting setup" : account.invitationStatus === "COMPLETED" ? "Completed" : "Not applicable"], ["Created", formatDate(account.createdAt)], ["Last update", formatDate(account.updatedAt)]];
  $("adminAccountDrawerBody").innerHTML = `<div class="admin-detail-grid">${facts.map(([name, value]) => `<div class="admin-detail-item"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>`;
  const manageable = canManage(account), personUrl = `/modules/contractor/people/?personId=${encodeURIComponent(account.personId || account.uid)}`;
  $("adminAccountDrawerActions").innerHTML = `<a class="admin-secondary-button" href="${personUrl}">Open Person Record</a>${manageable ? `<button class="admin-secondary-button" type="button" data-admin-action="EDIT">Edit Account</button>${account.status === "INVITED" ? `<button class="admin-secondary-button" type="button" data-admin-action="RESEND">Resend Invitation</button>` : ""}${["ACTIVE", "INVITED"].includes(account.status) ? `<button class="admin-secondary-button admin-button-danger" type="button" data-admin-action="DEACTIVATE">Deactivate</button>` : account.status === "INACTIVE" ? `<button class="admin-secondary-button admin-button-success" type="button" data-admin-action="REACTIVATE">Reactivate</button>` : ""}` : ""}`;
  $("adminAccountDrawer").classList.add("is-open"); $("adminAccountDrawer").setAttribute("aria-hidden", "false");
}

function closeDrawer() { selectedAccountUid = null; $("adminAccountDrawer").classList.remove("is-open"); $("adminAccountDrawer").setAttribute("aria-hidden", "true"); }

function openStatusDialog(account, action) {
  if (!account || !canManage(account)) return; pendingStatusAction = { uid: account.uid, action };
  const deactivate = action === "DEACTIVATE"; $("accountStatusDialogTitle").textContent = deactivate ? "Deactivate Account" : "Reactivate Account"; $("accountStatusDialogDescription").textContent = deactivate ? "This removes organisation access but preserves account and historical records." : "Restore organisation access for this existing account.";
  $("accountStatusSummary").innerHTML = `<strong>${esc(displayName(account))}</strong><span>${deactivate ? "The Auth identity, People record and historical references will be preserved." : "The same Auth identity and People record will be reused."}</span>`; hideMessage("accountStatusError"); $("accountStatusDialog").showModal();
}

function safeError(error) {
  const code = clean(error?.code).toLowerCase().split("/").pop();
  const reason = clean(error?.details?.reason).toUpperCase();
  const reasonMessages = {
    INVITATION_EMAIL_FAILED: "The account was created, but email delivery failed. Open the account and use Resend Invitation.",
    INVITATION_STATE_WRITE_FAILED: "The invitation may have been sent, but its delivery status could not be recorded. Check the account before resending.",
    ORPHAN_AUTH_IDENTITY: "An incomplete Auth identity exists for this email. Platform recovery is required before inviting it again.",
    AUTH_ROLLBACK_FAILED: "The account action was only partially completed. Platform recovery is required before retrying.",
    WRONG_ORGANISATION: "This account cannot be managed from the current organisation.",
    SELF_MANAGEMENT_DENIED: "You cannot change your own authority or account status here.",
    TARGET_NOT_BELOW_ACTOR: "Peer and higher-authority accounts cannot be managed.",
    AUTHORITY_NOT_BELOW_ACTOR: "Select an authority below your own.",
    INVALID_STATUS_TRANSITION: "That account status change is not allowed. Refresh the directory and try again."
  };
  if (reasonMessages[reason]) return reasonMessages[reason];
  const codeMessages = {
    "unauthenticated": "Your session is no longer authenticated. Sign in again and retry.",
    "permission-denied": "You do not have permission to manage this account or assign that authority.",
    "already-exists": "An account already exists for this email. Refresh the directory and open the existing account.",
    "invalid-argument": "Check the required account details and enter a valid email address.",
    "failed-precondition": "This account action is not available in its current state. Refresh the directory and try again.",
    "resource-exhausted": "Please wait before resending this invitation.",
    "unavailable": "The account service is temporarily unavailable. Try again shortly.",
    "internal": "The account service could not complete this action. Retry once, then contact platform support if it continues."
  };
  return codeMessages[code] || "The account action could not be completed. Retry or contact platform support.";
}

async function callAction(data) { const result = await manageUserAccount(data); return result.data; }

async function submitInvite(event) {
  event.preventDefault(); if (saving) return; saving = true; hideMessage("inviteUserError"); setBusy("inviteUserSubmit", true, "Sending…");
  try {
    const result = await callAction({ action: "INVITE", firstName: clean($("inviteFirstName").value), surname: clean($("inviteSurname").value), email: clean($("inviteEmail").value), employmentType: $("inviteEmploymentType").value, position: clean($("invitePosition").value), phone: clean($("invitePhone").value), roleCode: $("inviteAuthority").value || "WORKER" });
    await loadAccounts();
    if (result.outcome === "INVITED") { closeDialog("inviteUserDialog"); $("adminSystemStatus").textContent = "Invitation sent and the linked People record was created."; }
    else {
      const messages = { EXISTING_ACTIVE: "This email already belongs to an active account.", INVITATION_PENDING: "An invitation is already pending for this email.", EXISTING_INACTIVE: "An inactive account already exists. Open it to reactivate the existing identity." };
      closeDialog("inviteUserDialog");
      $("adminSystemStatus").textContent = messages[result.outcome] || "An account already exists for this email.";
      if (result.account?.uid) openDrawer(result.account.uid);
    }
  } catch (error) { console.error("Invite user failed:", error); showMessage("inviteUserError", safeError(error)); if (error?.details?.uid) await loadAccounts(); }
  finally { saving = false; setBusy("inviteUserSubmit", false); }
}

async function submitEdit(event) {
  event.preventDefault(); if (saving) return; const account = accounts.find(item => item.uid === $("editAccountUid").value); if (!account || !canManage(account)) return;
  saving = true; hideMessage("editAccountError"); setBusy("editAccountSave", true, "Saving…");
  try { await callAction({ action: "UPDATE", uid: account.uid, firstName: clean($("editFirstName").value), surname: clean($("editSurname").value), employmentType: $("editEmploymentType").value, position: clean($("editPosition").value), phone: clean($("editPhone").value), roleCode: $("editAuthority").value }); closeDialog("editAccountDialog"); await loadAccounts(); openDrawer(account.uid); $("adminSystemStatus").textContent = "Account and linked People identity updated."; }
  catch (error) { console.error("Update account failed:", error); showMessage("editAccountError", safeError(error)); }
  finally { saving = false; setBusy("editAccountSave", false); }
}

async function submitStatus(event) {
  event.preventDefault(); if (saving || !pendingStatusAction) return; const pending = { ...pendingStatusAction }; saving = true; hideMessage("accountStatusError"); setBusy("accountStatusConfirm", true, "Updating…");
  try { await callAction({ action: pending.action, uid: pending.uid }); pendingStatusAction = null; closeDialog("accountStatusDialog"); closeDrawer(); await loadAccounts(); $("adminSystemStatus").textContent = pending.action === "DEACTIVATE" ? "Account access deactivated; records were preserved." : "Existing account reactivated."; }
  catch (error) { console.error("Account status update failed:", error); showMessage("accountStatusError", safeError(error)); }
  finally { saving = false; setBusy("accountStatusConfirm", false); }
}

async function resendInvitation(account) {
  if (saving || !account || !canManage(account)) return; saving = true;
  try { await callAction({ action: "RESEND", uid: account.uid }); await loadAccounts(); openDrawer(account.uid); $("adminSystemStatus").textContent = "Invitation email resent."; }
  catch (error) { console.error("Resend invitation failed:", error); $("adminSystemStatus").textContent = safeError(error); }
  finally { saving = false; }
}

function bind() {
  $("inviteUserButton").addEventListener("click", openInviteDialog);
  document.querySelectorAll("[data-employment-filter]").forEach(button => button.addEventListener("click", () => setEmploymentFilter(button.dataset.employmentFilter || "")));
  ["adminSearchInput", "adminStatusFilter", "adminAuthorityFilter"].forEach(id => $(id).addEventListener($(id).tagName === "INPUT" ? "input" : "change", renderDirectory));
  $("adminAccountTableBody").addEventListener("click", event => { const target = event.target.closest("[data-account-uid]"); if (target) openDrawer(target.dataset.accountUid); });
  $("adminAccountDrawerActions").addEventListener("click", event => { const button = event.target.closest("[data-admin-action]"); if (!button) return; const account = selectedAccount(); if (button.dataset.adminAction === "EDIT") openEditDialog(account); if (button.dataset.adminAction === "RESEND") resendInvitation(account); if (["DEACTIVATE", "REACTIVATE"].includes(button.dataset.adminAction)) openStatusDialog(account, button.dataset.adminAction); });
  $("inviteUserForm").addEventListener("submit", submitInvite); $("editAccountForm").addEventListener("submit", submitEdit); $("accountStatusForm").addEventListener("submit", submitStatus);
  [["inviteUserDialogClose", "inviteUserDialog"], ["inviteUserCancel", "inviteUserDialog"], ["editAccountDialogClose", "editAccountDialog"], ["editAccountCancel", "editAccountDialog"], ["accountStatusDialogClose", "accountStatusDialog"], ["accountStatusCancel", "accountStatusDialog"]].forEach(([button, dialog]) => $(button).addEventListener("click", () => closeDialog(dialog)));
  ["inviteUserDialog", "editAccountDialog", "accountStatusDialog"].forEach(id => $(id).addEventListener("click", event => event.target === $(id) && closeDialog(id)));
  $("adminAccountDrawerClose").addEventListener("click", closeDrawer); $("adminAccountDrawerBackdrop").addEventListener("click", closeDrawer); document.addEventListener("keydown", event => event.key === "Escape" && closeDrawer());
}

async function initialise(nextProfile) {
  profile = nextProfile; organisationId = clean(profile?.organisationId); populateAuthorityControls();
  if (!organisationId || !canAdminister(profile)) { $("inviteUserButton").disabled = true; renderUnavailable("Organisation user-administration authority is required."); return; }
  await loadAccounts();
}

bind();
if (window.NORMEX_CURRENT_USER) initialise(window.NORMEX_CURRENT_USER); else window.addEventListener("normex:workspace-ready", event => initialise(event.detail.profile), { once: true });
