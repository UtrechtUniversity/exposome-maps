// Layer menu in the map sidebar: Project › Category › Theme › Surface.
// Built with <details>/<summary> for native keyboard and screen-reader support.

import { MAP_HIDDEN_THEMES } from "../config.js";
import { groupBy, sortProjects } from "../data.js";
import { ICONS, h, icon, prettyLabel } from "../util.js";

/**
 * @param {HTMLElement} container
 * @param {object[]} surfaces
 * @param {{onSelect: (surface) => void, onInfo: (surface) => void}} handlers
 */
export function createLayerMenu(container, surfaces, { onSelect, onInfo }) {
  const entries = []; // { surface, li, search }
  let filtering = false;

  const visible = surfaces.filter((s) => !MAP_HIDDEN_THEMES.includes(s.themeKey));
  const byProject = groupBy(visible, (s) => s.project);

  for (const project of sortProjects(byProject.keys())) {
    const section = h("section", { class: "menu__project" }, h("h3", { class: "menu__project-title" }, project));
    for (const [category, catSurfaces] of groupBy(byProject.get(project), (s) => s.categoryKey)) {
      const categoryEl = h(
        "details",
        { class: "menu__category" },
        h("summary", {}, prettyLabel(category), countBadge(catSurfaces)),
      );
      for (const [theme, themeSurfaces] of groupBy(catSurfaces, (s) => s.themeKey)) {
        const list = h("ul", { class: "menu__items" });
        for (const surface of themeSurfaces) {
          const li = renderItem(surface);
          entries.push({
            surface,
            li,
            search: `${surface.title} ${surface.theme} ${surface.category} ${project}`.toLowerCase(),
          });
          list.append(li);
        }
        categoryEl.append(
          h(
            "details",
            { class: "menu__theme" },
            h("summary", {}, prettyLabel(theme), countBadge(themeSurfaces)),
            list,
          ),
        );
      }
      section.append(categoryEl);
    }
    container.append(section);
  }

  // Accordion behaviour: opening a group closes its siblings (unless filtering).
  container.addEventListener(
    "toggle",
    (event) => {
      const details = event.target;
      if (filtering || !(details instanceof HTMLDetailsElement) || !details.open) return;
      for (const sibling of details.parentElement.children) {
        if (sibling !== details && sibling instanceof HTMLDetailsElement && sibling.className === details.className) {
          sibling.open = false;
        }
      }
    },
    true,
  );

  function countBadge(list) {
    const n = list.filter((s) => s.map).length;
    return h("span", { class: "menu__count", "aria-label": `${n} map layers` }, String(n));
  }

  function renderItem(surface) {
    const info = h(
      "button",
      { type: "button", class: "icon-btn menu__info", "aria-label": `Metadata: ${surface.title}`, title: "Metadata" },
      icon(ICONS.info),
    );
    info.addEventListener("click", () => onInfo(surface));

    if (!surface.map) {
      return h(
        "li",
        { class: "menu__item", dataset: { catalogueOnly: "" } },
        h("span", { class: "menu__label" }, surface.title, " ", h("span", { class: "badge" }, "Catalogue only")),
        info,
      );
    }
    const select = h(
      "button",
      { type: "button", class: "menu__select", "aria-pressed": "false", dataset: { layer: surface.map.layer } },
      surface.title,
    );
    select.addEventListener("click", () => onSelect(surface));
    return h("li", { class: "menu__item" }, select, info);
  }

  /** Show only items matching the query; returns the number of visible items. */
  function filter(query, { showCatalogueOnly }) {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    filtering = tokens.length > 0;
    let count = 0;
    for (const { surface, li, search } of entries) {
      const show = (surface.map || showCatalogueOnly) && tokens.every((t) => search.includes(t));
      li.hidden = !show;
      if (show) count += 1;
    }
    // Hide empty groups; expand groups with matches while searching.
    for (const details of container.querySelectorAll(".menu__theme, .menu__category")) {
      const hasVisible = [...details.querySelectorAll(".menu__item")].some((li) => !li.hidden);
      details.hidden = !hasVisible;
      if (filtering) details.open = hasVisible;
    }
    for (const section of container.querySelectorAll(".menu__project")) {
      section.hidden = !section.querySelector("details:not([hidden])");
    }
    if (!filtering) revealSelected({ scroll: false });
    return count;
  }

  function revealSelected({ scroll = true } = {}) {
    const selected = container.querySelector('.menu__select[aria-pressed="true"]');
    if (!selected) return;
    for (let el = selected.closest("details"); el; el = el.parentElement.closest("details")) el.open = true;
    if (scroll) selected.scrollIntoView({ block: "nearest" });
  }

  function setSelected(layerName) {
    for (const button of container.querySelectorAll(".menu__select")) {
      button.setAttribute("aria-pressed", String(button.dataset.layer === layerName));
    }
    revealSelected();
  }

  return { filter, setSelected };
}
