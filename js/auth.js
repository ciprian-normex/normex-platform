import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");

const loginPanel = document.getElementById("loginPanel");
const loadingPanel = document.getElementById("loadingPanel");
const accessPanel = document.getElementById("accessPanel");


function showPanel(panel) {
  [loginPanel, loadingPanel, accessPanel].forEach((item) => {
    if (!item) return;
    item.hidden = item !== panel;
  });
}


function showError(message) {
  if (!loginError) return;

  loginError.textContent = message || "";
  loginError.hidden = !message;
}


function setLoginBusy(isBusy) {
  if (!loginButton) return;

  loginButton.disabled = isBusy;
  loginButton.textContent = isBusy ? "Signing in..." : "Sign in";
}


async function getUserProfile(uid) {
  const profileRef = doc(db, "users", uid);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    uid: snapshot.id,
    ...snapshot.data()
  };
}


function canUseContractorWorkspace(profile) {
  if (!profile) return false;

  if (profile.status !== "ACTIVE") {
    return false;
  }

  if (profile.accessLevel >= 99) {
    return true;
  }

  return profile.workspaceAccess?.contractor === true;
}


async function routeAuthenticatedUser(user) {
  showPanel(loadingPanel);

  try {
    const profile = await getUserProfile(user.uid);

    if (!profile) {
      await signOut(auth);

      showPanel(loginPanel);
      showError(
        "Your account is authenticated but no NORMEX user profile has been configured."
      );

      return;
    }


    if (profile.status !== "ACTIVE") {
      await signOut(auth);

      showPanel(loginPanel);
      showError("This NORMEX account is not active.");

      return;
    }


    if (canUseContractorWorkspace(profile)) {
      window.location.replace("/modules/contractor/");
      return;
    }


    showPanel(accessPanel);

  } catch (error) {
    console.error("NORMEX authentication routing error:", error);

    await signOut(auth);

    showPanel(loginPanel);
    showError(
      "NORMEX could not load your account. Please try again."
    );
  }
}


if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    showError("");

    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      showError("Enter your email address and password.");
      return;
    }

    setLoginBusy(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    } catch (error) {
      console.error("NORMEX sign-in error:", error);

      showError(
        "The email address or password is incorrect."
      );

      setLoginBusy(false);
    }
  });
}


onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showPanel(loginPanel);
    setLoginBusy(false);
    return;
  }

  await routeAuthenticatedUser(user);
});