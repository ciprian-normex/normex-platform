const CONTRACTOR_NAV_ITEMS = [
  {
    id: "home",
    label: "Home",
    href: "/modules/contractor/"
  },
  {
    id: "projects",
    label: "Projects",
    href: "/modules/contractor/projects/"
  },
  {
    id: "operations",
    label: "Operations",
    href: "/modules/contractor/operations/"
  },
  {
    id: "people",
    label: "People",
    href: "/modules/contractor/people/"
  },
  {
    id: "plant",
    label: "Plant",
    href: "/modules/contractor/plant/"
  },
  {
    id: "assurance",
    label: "Assurance",
    href: "/modules/contractor/assurance/"
  },
  {
    id: "commercial",
    label: "Commercial",
    href: "/modules/contractor/commercial/"
  },
  {
    id: "reports",
    label: "Reports",
    href: "/modules/contractor/reports/"
  },
  {
    id: "admin",
    label: "Admin",
    href: "/modules/contractor/admin/"
  },
  {
    id: "support",
    label: "Support Tickets",
    href: "/modules/contractor/support/"
  }
];


function getCurrentNavId() {
  const path = window.location.pathname
    .toLowerCase()
    .replace(/\/index\.html$/, "/");

  if (
    path === "/modules/contractor/" ||
    path === "/modules/contractor"
  ) {
    return "home";
  }

  const match = path.match(
    /^\/modules\/contractor\/([^/]+)/
  );

  return match?.[1] || "home";
}


function createNavItem(item, currentId) {
  const anchor = document.createElement("a");

  anchor.className = "workspace-nav__link";
  anchor.href = item.href;
  anchor.textContent = item.label;

  if (item.id === currentId) {
    anchor.classList.add("is-active");

    anchor.setAttribute(
      "aria-current",
      "page"
    );
  }

  return anchor;
}


function createMobileMenuButton() {
  const button = document.createElement("button");

  button.id = "mobileMenuButton";
  button.className = "workspace-mobile-button";

  button.type = "button";

  button.setAttribute(
    "aria-label",
    "Open navigation"
  );

  button.setAttribute(
    "aria-expanded",
    "false"
  );

  button.innerHTML = `
    <span class="workspace-mobile-button__label">
      Menu
    </span>

    <span
      class="workspace-mobile-button__icon"
      aria-hidden="true"
    ></span>
  `;

  return button;
}


export function renderContractorNav() {
  const navSurface =
    document.getElementById(
      "contractorNavSurface"
    );

  const navRoot =
    document.getElementById(
      "contractorNavLinks"
    );

  const mobileNavRoot =
    document.getElementById(
      "contractorMobileNavLinks"
    );

  const currentId =
    getCurrentNavId();


  if (navRoot) {
    navRoot.innerHTML = "";

    CONTRACTOR_NAV_ITEMS.forEach(
      (item) => {
        navRoot.appendChild(
          createNavItem(
            item,
            currentId
          )
        );
      }
    );
  }


  if (mobileNavRoot) {
    mobileNavRoot.innerHTML = "";

    CONTRACTOR_NAV_ITEMS.forEach(
      (item) => {
        mobileNavRoot.appendChild(
          createNavItem(
            item,
            currentId
          )
        );
      }
    );
  }


  if (
    navSurface &&
    !document.getElementById(
      "mobileMenuButton"
    )
  ) {
    navSurface.appendChild(
      createMobileMenuButton()
    );
  }
}