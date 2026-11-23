// Layer menu in the map sidebar. Every dataset is listed; a coloured dot shows where it
// comes from (UU on request / external source). Datasets without a map layer are shown
// greyed out and can't be selected. Structure, kept deliberately shallow:
//
//   [ Netherlands | Europe | Global ]   region switch (one region at a time)
//   ▸ Category                          <details> accordion, one open at a time
//       THEME                           small heading
//       ● Layer                         button (or greyed-out label)
//
// Searching shows matches from every region.

import { accessDot } from "../access.js";
import { MAP_HIDDEN_THEMES } from "../config.js";
import { groupBy, sortRegions } from "../data.js";
import { ICONS, h, icon, prettyLabel } from "../util.js";

/**
 * @param {HTMLElement} container      element for the menu
 * @param {HTMLElement} regionSwitch   element for the region buttons
 * @param {object[]} surfaces
 * @param {{onSelect: (surface) => void, onInfo: (surface) => void}} handlers
 */
export function createLayerMenu(container, regionSwitch, surfaces, { onSelect, onInfo }) {
  const listed = surfaces.filter((s) => !MAP_HIDDEN_THEMES.includes(s.themeKey));
  const byRegion = groupBy(listed, (s) => s.region);
  const regions = sortRegions(byRegion.keys());
  const entries = []; // { li, search }
  const sections = new Map(); // region -> section element
  // Start on the first region (in REGION_ORDER) that has layers you can actually show.
  let activeRegion = regions.find((r) => byRegion.get(r).some((s) => s.map)) ?? regions[0];
  let filtering = false;

  // ----- Region switch -----
  const regionButtons = regions.map((region) => {
    const button = h("button", { type: "button", class: "segmented__option", "aria-pressed": "false" }, region);
    button.addEventListener("click", () => setRegion(region));
    return button;
  });
  regionSwitch.replaceChildren(...regionButtons);
  regionSwitch.hidden = regions.length < 2;

  // ----- Menu -----
  for (const region of regions) {
    const section = h(
      "section",
      { class: "menu__region", dataset: { region } },
      h("h3", { class: "menu__region-title" }, region),
    );
    for (const [category, catSurfaces] of groupBy(byRegion.get(region), (s) => s.categoryKey)) {
      const body = h("div", { class: "menu__category-body" });
      for (const [theme, themeSurfaces] of groupBy(catSurfaces, (s) => s.themeKey)) {
        const list = h("ul", { class: "menu__items" });
        for (const surface of themeSurfaces) {
          const li = h("li", { class: "menu__item" }, renderItem(surface), renderInfo(surface));
          entries.push({ li, search: `${surface.title} ${surface.theme} ${surface.category}`.toLowerCase() });
          list.append(li);
        }
        body.append(
          h("div", { class: "menu__theme" }, h("h4", { class: "menu__theme-title" }, prettyLabel(theme)), list),
        );
      }
      section.append(h("details", { class: "menu__category" }, h("summary", {}, prettyLabel(category)), body));
    }
    sections.set(region, section);
    container.append(section);
  }

  function renderItem(surface) {
    if (!surface.map) {
      return h(
        "span",
        { class: "menu__unavailable", title: "Not available on the map: see the catalogue for this dataset" },
        accessDot(surface.access),
        surface.title,
        h("span", { class: "visually-hidden" }, " (not available on the map)"),
      );
    }
    const select = h(
      "button",
      { type: "button", class: "menu__select", "aria-pressed": "false", dataset: { layer: surface.map.layer } },
      accessDot(surface.access),
      surface.title,
    );
    select.addEventListener("click", () => onSelect(surface));
    return select;
  }

  function renderInfo(surface) {
    const button = h(
      "button",
      { type: "button", class: "icon-btn menu__info", "aria-label": `Metadata: ${surface.title}`, title: "Metadata" },
      icon(ICONS.info),
    );
    button.addEventListener("click", () => onInfo(surface));
    return button;
  }

  // Accordion: opening a category closes the others in the same region (unless searching).
  container.addEventListener(
    "toggle",
    (event) => {
      const details = event.target;
      if (filtering || !(details instanceof HTMLDetailsElement) || !details.open) return;
      for (const other of details.parentElement.querySelectorAll(":scope > details")) {
        if (other !== details) other.open = false;
      }
    },
    true,
  );

  function setRegion(region) {
    if (!sections.has(region)) return;
    activeRegion = region;
    regionButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(regions[i] === region)));
    updateVisibility();
  }

  function updateVisibility() {
    container.classList.toggle("is-filtering", filtering);
    regionSwitch.classList.toggle("is-disabled", filtering);
    for (const [region, section] of sections) {
      const hasVisible = section.querySelector(".menu__item:not([hidden])");
      section.hidden = filtering ? !hasVisible : region !== activeRegion;
    }
  }

  /** Show only items matching the query; returns the number of visible items. */
  function filter(query) {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    filtering = tokens.length > 0;
    let count = 0;
    for (const { li, search } of entries) {
      li.hidden = !tokens.every((t) => search.includes(t));
      if (!li.hidden) count += 1;
    }
    for (const group of container.querySelectorAll(".menu__theme, .menu__category")) {
      const hasVisible = group.querySelector(".menu__item:not([hidden])");
      group.hidden = !hasVisible;
      if (filtering && group instanceof HTMLDetailsElement) group.open = Boolean(hasVisible);
    }
    if (!filtering) {
      container.querySelectorAll(".menu__category").forEach((d) => (d.open = false));
      revealSelected({ scroll: false });
    }
    updateVisibility();
    return count;
  }

  function revealSelected({ scroll = true } = {}) {
    const selected = container.querySelector('.menu__select[aria-pressed="true"]');
    if (!selected) return;
    const details = selected.closest("details");
    if (details) details.open = true;
    if (scroll) selected.scrollIntoView({ block: "nearest" });
  }

  function setSelected(surface) {
    for (const button of container.querySelectorAll(".menu__select")) {
      button.setAttribute("aria-pressed", String(button.dataset.layer === surface.map.layer));
    }
    if (!filtering) setRegion(surface.region);
    revealSelected();
  }

  setRegion(activeRegion);
  return { filter, setSelected };
}
