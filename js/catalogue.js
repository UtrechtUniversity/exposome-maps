// Catalogue view: all datasets as cards with search and filter chips.

import { datasetUrl, mapUrl, sortProjects, thumbnailUrl } from "./data.js";
import { debounce, h } from "./util.js";

const FILTERS = [
  { key: "project", label: "Region", value: (d) => d.project, sort: sortProjects },
  { key: "category", label: "Category", value: (d) => d.category },
  { key: "time", label: "Time step", value: (d) => d.temporalResolution, order: ["Daily", "Monthly", "Annual"] },
  { key: "map", label: "Availability", value: (d) => (d.mapLayer ? "On the map" : "Catalogue only") },
];

export function createCatalogue(catalogue) {
  const grid = document.getElementById("catalogue-grid");
  const filtersEl = document.getElementById("catalogue-filters");
  const searchInput = document.getElementById("catalogue-search");
  const countEl = document.getElementById("catalogue-count");
  const emptyEl = document.getElementById("catalogue-empty");
  const clearButton = document.getElementById("catalogue-clear");

  const active = Object.fromEntries(FILTERS.map((f) => [f.key, new Set()]));
  const items = catalogue.datasets.map((dataset) => ({
    dataset,
    card: renderCard(dataset),
    search: searchText(dataset, catalogue),
  }));

  // Filter chips
  for (const filter of FILTERS) {
    const counts = new Map();
    for (const { dataset } of items) {
      const value = filter.value(dataset);
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    let values = [...counts.keys()];
    if (filter.sort) values = filter.sort(values);
    else if (filter.order) values.sort((a, b) => filter.order.indexOf(a) - filter.order.indexOf(b));

    const group = h("fieldset", { class: "filter-group" }, h("legend", {}, filter.label));
    for (const value of values) {
      const chip = h(
        "button",
        { type: "button", class: "chip", "aria-pressed": "false" },
        value,
        h("span", { class: "chip__count" }, String(counts.get(value))),
      );
      chip.addEventListener("click", () => {
        const set = active[filter.key];
        set.has(value) ? set.delete(value) : set.add(value);
        chip.setAttribute("aria-pressed", String(set.has(value)));
        apply();
      });
      group.append(chip);
    }
    filtersEl.append(group);
  }

  grid.append(...items.map((i) => i.card));

  function apply() {
    const tokens = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const { dataset, card, search } of items) {
      const matchesFilters = FILTERS.every((f) => active[f.key].size === 0 || active[f.key].has(f.value(dataset)));
      const visible = matchesFilters && tokens.every((t) => search.includes(t));
      card.hidden = !visible;
      if (visible) shown += 1;
    }
    const filtered = tokens.length > 0 || FILTERS.some((f) => active[f.key].size > 0);
    countEl.textContent = filtered
      ? `${shown} of ${items.length} datasets`
      : `${items.length} datasets`;
    emptyEl.hidden = shown > 0;
    clearButton.hidden = !filtered;
  }

  searchInput.addEventListener("input", debounce(apply, 120));
  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    Object.values(active).forEach((set) => set.clear());
    filtersEl.querySelectorAll(".chip").forEach((chip) => chip.setAttribute("aria-pressed", "false"));
    apply();
    searchInput.focus();
  });
  apply();
}

function searchText(dataset, catalogue) {
  const surfaceTitles = dataset.surfaces.map((id) => catalogue.surfaceById.get(id)?.title || "");
  return [dataset.title, dataset.theme, dataset.category, dataset.project, dataset.page, dataset.summary, ...surfaceTitles]
    .join(" ")
    .replace(/_/g, " ")
    .toLowerCase();
}

function renderCard(d) {
  const href = datasetUrl(d.page);
  const surfaceCount = d.surfaces.length;
  return h(
    "li",
    { class: "card" },
    h(
      "a",
      { class: "card__media", href, tabindex: "-1", "aria-hidden": "true" },
      h("img", { src: thumbnailUrl(d.thumbnail), alt: "", loading: "lazy", width: "320", height: "200" }),
    ),
    h(
      "div",
      { class: "card__body" },
      h("p", { class: "eyebrow" }, `${d.category} · ${d.theme}`),
      h("h2", { class: "card__title" }, h("a", { href }, d.title)),
      h(
        "ul",
        { class: "card__meta" },
        h("li", {}, d.project),
        h("li", {}, d.temporalResolution),
        d.period ? h("li", {}, d.period) : null,
        d.spatialResolution ? h("li", {}, d.spatialResolution) : null,
        h("li", {}, `${surfaceCount} surface${surfaceCount === 1 ? "" : "s"}`),
      ),
      h(
        "div",
        { class: "card__actions" },
        h("a", { class: "btn btn--ghost btn--sm", href }, "Details"),
        d.mapLayer
          ? h("a", { class: "btn btn--primary btn--sm", href: mapUrl(d.mapLayer) }, "View on map")
          : h("span", { class: "badge" }, "Catalogue only"),
      ),
    ),
  );
}
