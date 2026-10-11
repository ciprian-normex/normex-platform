import { app } from "/js/firebase.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";

const functions = getFunctions(app, "europe-west2");
const verifyCertificateCallable = httpsCallable(functions, "verifyInductionCertificate");

const elements = {
  error: document.querySelector("#certificateError"),
  organisationTop: document.querySelector("#certificateOrganisationTop"),
  workerName: document.querySelector("#certificateWorkerName"),
  number: document.querySelector("#certificateNumber"),
  company: document.querySelector("#certificateCompany"),
  role: document.querySelector("#certificateRole"),
  issuedAt: document.querySelector("#certificateIssuedAt"),
  expiresAt: document.querySelector("#certificateExpiresAt"),
  videoVersion: document.querySelector("#certificateVideoVersion"),
  statusStamp: document.querySelector("#certificateStatusStamp"),
  statusText: document.querySelector("#certificateStatusText"),
  statusIcon: document.querySelector("#certificateStatusIcon"),
  footerStatus: document.querySelector("#certificateFooterStatus"),
  organisationFooter: document.querySelector("#certificateOrganisationFooter"),
  generatedAt: document.querySelector("#certificateGeneratedAt"),
  qr: document.querySelector("#certificateQr"),
  verifyLink: document.querySelector("#certificateVerifyLink"),
  checkButton: document.querySelector("#checkInductionButton"),
  printButton: document.querySelector("#printCertificateButton")
};

initialise();

async function initialise() {
  wirePrint();

  const inductionNumber = requestedInductionNumber();

  if (!inductionNumber) {
    showError("No induction number was supplied.");
    return;
  }

  const verifyUrl = buildVerifyUrl(inductionNumber);

  if (elements.verifyLink) elements.verifyLink.href = verifyUrl;
  if (elements.checkButton) elements.checkButton.href = verifyUrl;

  try {
    const result = await verifyCertificateCallable({ inductionNumber });
    const data = result?.data;

    if (!data?.found || !data?.certificate) {
      showError(`No induction certificate was found for ${inductionNumber}.`);
      return;
    }

    renderCertificate(data.certificate);
    renderQr(verifyUrl);

  } catch (error) {
    console.error("[NORMEX Certificate]", error);
    showError("The certificate could not be loaded. Please try again.");
  }
}

function renderCertificate(record) {
  const organisationName = clean(
    record.organisationName ||
    record.contractor ||
    record.company ||
    "Organisation"
  );

  const status = resolvedStatus(record);

  setText(elements.organisationTop, organisationName);
  setText(elements.organisationFooter, organisationName);
  setText(elements.workerName, record.workerName || record.fullName || record.name || "—");
  setText(elements.number, record.inductionNumber || "—");
  setText(elements.company, organisationName);
  setText(elements.role, record.role || record.primaryTrade || record.trade || "—");
  setText(elements.issuedAt, formatDate(record.issuedAt || record.completedAt));
  setText(elements.expiresAt, formatDate(record.expiresAt || record.validUntil));
  setText(elements.videoVersion, record.videoVersion || "—");
  setText(elements.statusText, status.label);
  setText(elements.statusIcon, status.icon);
  setText(elements.footerStatus, status.label);
  setText(elements.generatedAt, formatDateTime(new Date()));

  if (elements.statusStamp) {
    elements.statusStamp.dataset.status = status.key;
  }

  document.title = `${record.inductionNumber || "Induction Certificate"} | NORMEX`;
}

function renderQr(verifyUrl) {
  if (!elements.qr) return;

  elements.qr.innerHTML = "";

  if (!window.QRCode) {
    elements.qr.textContent = "QR unavailable";
    return;
  }

  new window.QRCode(elements.qr, {
    text: verifyUrl,
    width: 160,
    height: 160,
    colorDark: "#102b1e",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel.M
  });

  window.setTimeout(normaliseQrLayers, 60);
}

function normaliseQrLayers() {
  if (!elements.qr) return;

  const image = elements.qr.querySelector("img");
  const canvas = elements.qr.querySelector("canvas");

  if (image && image.getAttribute("src")) {
    image.style.display = "block";
    image.style.width = "160px";
    image.style.height = "160px";
    canvas?.remove();
    return;
  }

  if (canvas) {
    canvas.style.display = "block";
    canvas.style.width = "160px";
    canvas.style.height = "160px";

    elements.qr
      .querySelectorAll("img")
      .forEach(node => node.remove());
  }
}

function resolvedStatus(record) {
  const raw = clean(record.status || "VALID").toUpperCase();
  const expiry = parseDate(record.expiresAt || record.validUntil);

  const expired = expiry && expiry.getTime() < endOfToday().getTime();

  if (expired || raw === "EXPIRED") {
    return { key: "EXPIRED", label: "EXPIRED", icon: "!" };
  }

  if (raw === "BLOCKED" || raw === "SUSPENDED" || raw === "INVALID") {
    return { key: "BLOCKED", label: "BLOCKED", icon: "!" };
  }

  return { key: "VALID", label: "VALID", icon: "✓" };
}

function wirePrint() {
  elements.printButton?.addEventListener("click", event => {
    event.preventDefault();
    window.print();
  });
}

function requestedInductionNumber() {
  const params = new URLSearchParams(window.location.search);

  return clean(
    params.get("id") ||
    params.get("inductionNumber")
  ).toUpperCase();
}

function buildVerifyUrl(inductionNumber) {
  return new URL(
    `../verify/?id=${encodeURIComponent(inductionNumber)}`,
    window.location.href
  ).href;
}

function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "—");
  }
}

function clean(value) {
  return String(value ?? "").trim();
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }
  ).format(date);
}

function formatDateTime(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

function endOfToday() {
  const now = new Date();

  now.setHours(23, 59, 59, 999);

  return now;
}

function showError(message) {
  if (!elements.error) return;

  elements.error.hidden = false;
  elements.error.textContent = message;
}
