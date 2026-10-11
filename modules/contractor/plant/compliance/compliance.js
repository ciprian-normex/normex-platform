/* =========================================================
   NORMEX PLANT
   COMPLIANCE UI CONTROLLER

   UI-only skeleton.

   Firebase reads, evidence resolution and compliance
   derivation are intentionally left for Codex.
========================================================= */


const getElement = (
  id
) => document.getElementById(
  id
);


/* =========================================================
   STATE
========================================================= */

let complianceHorizonDays =
  30;

let complianceSummaryFilter =
  "";


/* =========================================================
   HORIZON
========================================================= */

function bindComplianceHorizon() {

  document.querySelectorAll(
    "[data-compliance-horizon]"
  ).forEach(
    (
      button
    ) => {

      button.addEventListener(
        "click",
        () => {

          complianceHorizonDays =
            Number(
              button.dataset.complianceHorizon
            );


          document.querySelectorAll(
            "[data-compliance-horizon]"
          ).forEach(
            (
              candidate
            ) => {

              candidate.classList.toggle(
                "is-active",
                candidate === button
              );

            }
          );


          /*
           * Integration pass will recalculate
           * urgent/upcoming compliance positions.
           */

        }
      );

    }
  );

}


/* =========================================================
   SUMMARY
========================================================= */

function clearComplianceSummaryFilter() {

  complianceSummaryFilter =
    "";


  document.querySelectorAll(
    "[data-compliance-summary]"
  ).forEach(
    (
      tile
    ) => {

      tile.classList.remove(
        "is-active"
      );

    }
  );


  const clearButton =
    getElement(
      "clearComplianceSummaryFilter"
    );


  if (
    clearButton
  ) {

    clearButton.hidden =
      true;

  }

}


function bindComplianceSummary() {

  document.querySelectorAll(
    "[data-compliance-summary]"
  ).forEach(
    (
      tile
    ) => {

      tile.addEventListener(
        "click",
        () => {

          const value =
            tile.dataset.complianceSummary || "";


          if (
            value ===
            complianceSummaryFilter
          ) {

            clearComplianceSummaryFilter();

            return;

          }


          complianceSummaryFilter =
            value;


          document.querySelectorAll(
            "[data-compliance-summary]"
          ).forEach(
            (
              candidate
            ) => {

              candidate.classList.toggle(
                "is-active",
                candidate === tile
              );

            }
          );


          const clearButton =
            getElement(
              "clearComplianceSummaryFilter"
            );


          if (
            clearButton
          ) {

            clearButton.hidden =
              false;

          }


          /*
           * Integration pass will apply filter
           * to Attention and Register.
           */

        }
      );

    }
  );


  getElement(
    "clearComplianceSummaryFilter"
  )?.addEventListener(
    "click",
    clearComplianceSummaryFilter
  );

}


/* =========================================================
   FILTERS
========================================================= */

function bindComplianceFilters() {

  [
    "complianceSearchInput",
    "complianceClassFilter",
    "complianceRequirementFilter",
    "complianceStateFilter",
    "complianceProjectFilter"
  ].forEach(
    (
      id
    ) => {

      const element =
        getElement(
          id
        );


      if (
        !element
      ) {

        return;

      }


      element.addEventListener(
        element.tagName === "INPUT"
          ? "input"
          : "change",
        () => {

          /*
           * Integration pass will filter
           * the derived compliance register.
           */

        }
      );

    }
  );

}


/* =========================================================
   REQUIREMENT CARDS
========================================================= */

function bindRequirementCards() {

  document.querySelectorAll(
    "[data-requirement-type]"
  ).forEach(
    (
      card
    ) => {

      card.addEventListener(
        "click",
        () => {

          const select =
            getElement(
              "complianceRequirementFilter"
            );


          if (
            !select
          ) {

            return;

          }


          select.value =
            card.dataset.requirementType || "";


          select.dispatchEvent(
            new Event(
              "change"
            )
          );

        }
      );

    }
  );

}


/* =========================================================
   DRAWER
========================================================= */

const complianceDrawer =
  getElement(
    "complianceDrawer"
  );


function openComplianceDrawer() {

  if (
    !complianceDrawer
  ) {

    return;

  }


  complianceDrawer.classList.add(
    "is-open"
  );


  complianceDrawer.setAttribute(
    "aria-hidden",
    "false"
  );

}


function closeComplianceDrawer() {

  if (
    !complianceDrawer
  ) {

    return;

  }


  complianceDrawer.classList.remove(
    "is-open"
  );


  complianceDrawer.setAttribute(
    "aria-hidden",
    "true"
  );

}


function bindComplianceDrawer() {

  getElement(
    "complianceDrawerClose"
  )?.addEventListener(
    "click",
    closeComplianceDrawer
  );


  getElement(
    "complianceDrawerBackdrop"
  )?.addEventListener(
    "click",
    closeComplianceDrawer
  );


  document.addEventListener(
    "click",
    (
      event
    ) => {

      const trigger =
        event.target.closest(
          "[data-open-compliance]"
        );


      if (
        !trigger
      ) {

        return;

      }


      /*
       * Integration pass will:
       * - resolve asset / requirement
       * - render evidence position
       * - set Open Asset link
       */

      openComplianceDrawer();

    }
  );

}


/* =========================================================
   KEYBOARD
========================================================= */

function bindKeyboard() {

  document.addEventListener(
    "keydown",
    (
      event
    ) => {

      if (
        event.key ===
        "Escape"
      ) {

        closeComplianceDrawer();

      }

    }
  );

}


/* =========================================================
   INITIALISE
========================================================= */

function initialiseComplianceUI() {

  bindComplianceHorizon();

  bindComplianceSummary();

  bindComplianceFilters();

  bindRequirementCards();

  bindComplianceDrawer();

  bindKeyboard();

}


initialiseComplianceUI();