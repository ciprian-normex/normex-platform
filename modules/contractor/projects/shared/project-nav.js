const PROJECT_NAV_ITEMS = [
  {
    id: "overview",
    label: "Overview",
    page: "index.html"
  },
  {
    id: "details",
    label: "Details",
    page: "details/"
  },
  {
    id: "readiness",
    label: "Readiness",
    page: "readiness/"
  },
  {
    id: "scope",
    label: "Scope",
    page: "scope/"
  },
  {
    id: "resources",
    label: "Resources",
    page: "resources/"
  },
  {
    id: "documents",
    label: "Documents",
    page: "documents/"
  },
  {
    id: "programme",
    label: "Programme",
    page: "programme/"
  },
  {
    id: "commercial",
    label: "Commercial",
    page: "commercial/"
  }
];


function getProjectId() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return params.get("id");
}


function getCurrentProjectNavId() {
  const path =
    window.location.pathname
      .toLowerCase()
      .replace(/\/index\.html$/, "/");


  const match =
    path.match(
      /\/modules\/contractor\/projects\/project\/([^/]+)/
    );


  if (!match) {
    return "overview";
  }


  const section =
    match[1];


  if (
    PROJECT_NAV_ITEMS.some(
      (item) =>
        item.id === section
    )
  ) {
    return section;
  }


  return "overview";
}


function getProjectHref(
  item,
  projectId
) {
  const root =
    "/modules/contractor/projects/project/";


  if (item.id === "overview") {
    return (
      `${root}?id=` +
      encodeURIComponent(
        projectId
      )
    );
  }


  return (
    `${root}${item.page}?id=` +
    encodeURIComponent(
      projectId
    )
  );
}


function createProjectNavItem(
  item,
  currentId,
  projectId
) {
  const anchor =
    document.createElement("a");


  anchor.className =
    "project-subnav__link";


  anchor.href =
    getProjectHref(
      item,
      projectId
    );


  anchor.textContent =
    item.label;


  if (
    item.id === currentId
  ) {
    anchor.classList.add(
      "is-active"
    );

    anchor.setAttribute(
      "aria-current",
      "page"
    );
  }


  return anchor;
}


export function renderProjectNav() {
  const root =
    document.getElementById(
      "projectSubnavLinks"
    );


  if (!root) return;


  const projectId =
    getProjectId();


  if (!projectId) {
    root.innerHTML = "";
    return;
  }


  const currentId =
    getCurrentProjectNavId();


  root.innerHTML = "";


  PROJECT_NAV_ITEMS.forEach(
    (item) => {
      root.appendChild(
        createProjectNavItem(
          item,
          currentId,
          projectId
        )
      );
    }
  );
}