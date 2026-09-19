/* =========================================================
   NORMEX PLANT
   Shared Plant Workspace Navigation
========================================================= */

export const PLANT_NAV_ITEMS = Object.freeze([
  {
    key:
      "overview",

    label:
      "Overview",

    href:
      "/modules/contractor/plant/"
  },

  {
    key:
      "requests",

    label:
      "Requests",

    href:
      "/modules/contractor/plant/requests/"
  },

  {
    key:
      "fleet",

    label:
      "Fleet",

    href:
      "/modules/contractor/plant/fleet/"
  },

  {
    key:
      "availability",

    label:
      "Availability",

    href:
      "/modules/contractor/plant/availability/"
  },

  {
    key:
      "movements",

    label:
      "Movements",

    href:
      "/modules/contractor/plant/movements/"
  },

  {
    key:
      "defects",

    label:
      "Defects",

    href:
      "/modules/contractor/plant/defects/"
  },

  {
    key:
      "maintenance",

    label:
      "Maintenance",

    href:
      "/modules/contractor/plant/maintenance/"
  },

  {
    key:
      "compliance",

    label:
      "Compliance",

    href:
      "/modules/contractor/plant/compliance/"
  },

  {
    key:
      "suppliers",

    label:
      "Suppliers",

    href:
      "/modules/contractor/plant/suppliers/"
  }
]);


/* =========================================================
   DETECT ACTIVE PAGE
========================================================= */

export function getActivePlantPageFromPath(
  pathname =
    window.location.pathname
) {

  const normalised =
    String(
      pathname ||
      ""
    )
      .replace(
        /\/index\.html$/i,
        "/"
      )
      .replace(
        /\/+$/,
        "/"
      );


  if (
    normalised.endsWith(
      "/modules/contractor/plant/"
    )
  ) {

    return "overview";

  }


  const match =
    PLANT_NAV_ITEMS.find(
      (item) =>

        item.key !==
          "overview"

        &&

        normalised.includes(
          `/plant/${item.key}/`
        )
    );


  return (
    match?.key ||
    "overview"
  );

}


/* =========================================================
   RENDER PLANT SHELL
========================================================= */

export function renderPlantShell({
  activePage =
    getActivePlantPageFromPath(),

  target =
    "plantSubnav",

  workspaceName =
    "Fleet & Transport Control"
} = {}) {

  const root =
    typeof target ===
      "string"

      ? document.getElementById(
          target
        )

      : target;


  if (
    !root
  ) {

    return;

  }


  root.className =
    "plant-subnav";


  root.setAttribute(
    "aria-label",
    "Plant workspace navigation"
  );


  root.innerHTML = `

    <div class="plant-subnav__surface">


      <div class="plant-subnav__identity">


        <a
          class="plant-subnav__back"
          href="/modules/contractor/plant/"
        >
          Plant
        </a>


        <div class="plant-subnav__workspace">

          <span class="plant-subnav__eyebrow">
            Plant Workspace
          </span>

          <span class="plant-subnav__name">
            ${workspaceName}
          </span>

        </div>


      </div>


      <div class="plant-subnav__links">

        ${PLANT_NAV_ITEMS
          .map(
            (item) => `

              <a
                class="
                  plant-subnav__link
                  ${
                    item.key ===
                      activePage
                      ? "is-active"
                      : ""
                  }
                "
                href="${item.href}"
                ${
                  item.key ===
                    activePage
                    ? 'aria-current="page"'
                    : ""
                }
              >

                ${item.label}

              </a>

            `
          )
          .join("")}

      </div>


    </div>

  `;

}


/* =========================================================
   INITIALISE
========================================================= */

export function initialisePlantShell(
  options =
    {}
) {

  renderPlantShell({
    ...options,

    activePage:
      options.activePage ||
      getActivePlantPageFromPath()
  });

}