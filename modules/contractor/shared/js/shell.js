import {
  auth,
  db
} from "/js/firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  renderContractorNav
} from "./nav.js";


const config =
  window.NORMEX_CONTRACTOR_CONFIG || {};


function getElement(id) {
  return document.getElementById(id);
}


function setText(id, value) {
  const element = getElement(id);

  if (!element) return;

  element.textContent = value || "";
}


async function getUserProfile(uid) {
  const reference = doc(
    db,
    "users",
    uid
  );

  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    uid: snapshot.id,
    ...snapshot.data()
  };
}


function canUseWorkspace(profile) {
  if (!profile) {
    return false;
  }

  if (profile.status !== "ACTIVE") {
    return false;
  }

  if (Number(profile.accessLevel) >= 99) {
    return true;
  }

  return (
    profile.workspaceAccess?.contractor === true
  );
}


function organisationMatches(profile) {
  if (Number(profile.accessLevel) >= 99) {
    return true;
  }

  const expectedOrganisationId =
    config.organisation?.id;

  return (
    profile.organisationId ===
    expectedOrganisationId
  );
}


function applyOrganisationIdentity() {
  const organisation =
    config.organisation || {};

  const workspace =
    config.workspace || {};

  setText(
    "workspaceOrganisationName",
    organisation.name || "Organisation"
  );

  setText(
    "workspaceOrganisationCode",
    organisation.code || ""
  );

  setText(
    "workspaceLabel",
    workspace.label || "Organisation Workspace"
  );

  setText(
    "workspaceFooterOrganisation",
    organisation.name || ""
  );
}


function applyUserProfile(profile) {
  setText(
    "workspaceUserName",
    profile.displayName ||
      profile.email ||
      "User"
  );

  setText(
    "workspaceUserRole",
    formatRole(
      profile.role,
      profile.accessLevel
    )
  );
}


function formatRole(role, accessLevel) {
  if (Number(accessLevel) >= 99) {
    return "Platform Administration";
  }

  if (!role) {
    return `Level ${accessLevel ?? ""}`.trim();
  }

  return role
    .toLowerCase()
    .split("_")
    .map((part) => {
      return (
        part.charAt(0).toUpperCase() +
        part.slice(1)
      );
    })
    .join(" ");
}


function showWorkspace() {
  document.documentElement.classList.add(
    "workspace-ready"
  );

  document.body.classList.add(
    "workspace-loaded"
  );
}


function openMobileNav() {
  const panel = getElement(
    "contractorMobileNav"
  );

  const button = getElement(
    "mobileMenuButton"
  );

  if (!panel || !button) return;

  panel.hidden = false;

  requestAnimationFrame(() => {
    panel.classList.add("is-open");
  });

  button.setAttribute(
    "aria-expanded",
    "true"
  );

  document.body.classList.add(
    "mobile-nav-open"
  );
}


function closeMobileNav() {
  const panel = getElement(
    "contractorMobileNav"
  );

  const button = getElement(
    "mobileMenuButton"
  );

  if (!panel || !button) return;

  panel.classList.remove("is-open");

  button.setAttribute(
    "aria-expanded",
    "false"
  );

  document.body.classList.remove(
    "mobile-nav-open"
  );

  window.setTimeout(() => {
    if (!panel.classList.contains("is-open")) {
      panel.hidden = true;
    }
  }, 180);
}


function bindShellControls() {
  const logoutButton = getElement(
    "workspaceLogoutButton"
  );

  const mobileMenuButton = getElement(
    "mobileMenuButton"
  );

  const mobileNavClose = getElement(
    "mobileNavClose"
  );

  const mobileNavBackdrop = getElement(
    "mobileNavBackdrop"
  );


  logoutButton?.addEventListener(
    "click",
    async () => {
      try {
        await signOut(auth);
      } finally {
        window.location.replace("/");
      }
    }
  );


  mobileMenuButton?.addEventListener(
    "click",
    () => {
      const expanded =
        mobileMenuButton.getAttribute(
          "aria-expanded"
        ) === "true";

      if (expanded) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    }
  );


  mobileNavClose?.addEventListener(
    "click",
    closeMobileNav
  );


  mobileNavBackdrop?.addEventListener(
    "click",
    closeMobileNav
  );


  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeMobileNav();
      }
    }
  );
}


async function initialiseWorkspace(user) {
  try {
    const profile =
      await getUserProfile(user.uid);

    if (
      !canUseWorkspace(profile) ||
      !organisationMatches(profile)
    ) {
      await signOut(auth);

      window.location.replace("/");
      return;
    }

    applyOrganisationIdentity();
    applyUserProfile(profile);

   

   window.NORMEX_CURRENT_USER = profile;

window.dispatchEvent(
  new CustomEvent(
    "normex:workspace-ready",
    {
      detail: {
        profile
      }
    }
  )
);

showWorkspace();

  } catch (error) {
    console.error(
      "NORMEX workspace initialisation error:",
      error
    );

    await signOut(auth);

    window.location.replace("/");
  }
}


applyOrganisationIdentity();
renderContractorNav();
bindShellControls();


onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      window.location.replace("/");
      return;
    }

    await initialiseWorkspace(user);
  }
);