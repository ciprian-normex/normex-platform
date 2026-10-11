import {
  app
} from "/js/firebase.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";


const verify =
  httpsCallable(
    getFunctions(
      app,
      "europe-west2"
    ),
    "verifyInductionCertificate"
  );


export async function getCertificate(
  id
) {
  return (
    await verify({
      inductionNumber:
        id
    })
  ).data;
}


export async function searchCertificates(
  query
) {
  return (
    await verify({
      searchQuery:
        query
    })
  ).data;
}


export function escapeHtml(value) {
  return String(
    value ??
    ""
  ).replace(
    /[&<>'"]/g,
    char =>
      ({
        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        "'":
          "&#39;",

        '"':
          "&quot;"
      })[char]
  );
}


export function formatDate(value) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  return Number.isNaN(
    date.getTime()
  )
    ? String(value)
    : new Intl.DateTimeFormat(
        "en-GB",
        {
          day:
            "2-digit",

          month:
            "long",

          year:
            "numeric"
        }
      ).format(date);
}


export function publicError(error) {
  console.error(
    "[NORMEX certificate verification]",
    error?.code,
    error
  );


  const code =
    String(
      error?.code ||
      ""
    ).replace(
      "functions/",
      ""
    );


  if (
    code === "invalid-argument"
  ) {
    return error?.message ||
      "Check the induction search and try again.";
  }


  if (
    code === "resource-exhausted"
  ) {
    return "Too many verification requests were made. Please wait and try again.";
  }


  return "Induction verification is temporarily unavailable. Please try again.";
}
