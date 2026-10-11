/* =========================================================
   NORMEX PEOPLE
   PEOPLE OVERVIEW

   UI / INTEGRATION SKELETON ONLY
========================================================= */


/*
 * This page is deliberately not connected to Firestore yet.
 *
 * The HTML and CSS are the approved interface foundation.
 *
 * Later integration should derive data from canonical:
 *
 * - people
 * - projects
 * - published rota
 * - induction records
 * - professional records
 * - planned availability
 * - labour demand
 *
 * Do not invent duplicate People collections simply to
 * populate dashboard metrics.
 */


function handleWorkspaceReady() {

  const actor =
    window.NORMEX_CURRENT_USER;


  console.info(
    "[NORMEX People] Overview ready for future integration",
    {
      actorUid:
        actor?.uid ||
        null,

      organisationId:
        actor?.organisationId ||
        null
    }
  );

}


function initialisePeopleOverview() {

  if (
    window.NORMEX_CURRENT_USER
  ) {

    handleWorkspaceReady();

    return;

  }


  window.addEventListener(
    "normex:workspace-ready",
    handleWorkspaceReady,
    {
      once: true
    }
  );

}


initialisePeopleOverview();