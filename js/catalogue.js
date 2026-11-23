// Catalogue view: all datasets as cards with search and filter chips.
// Cards are colour-coded by access route (UU on request vs external provider).

import { ACCESS_TYPES, accessBadge, accessButton, accessDot } from "./access.js";
import { datasetUrl, mapUrl, sortRegions, thumbnailUrl } from "./data.js";
import { debounce, h } from "./util.js";

const FILTERS = [
  {
    key: "access",
    label: "Access",
    value: (d) => d.access.type,
    display: (v) => ACCESS_TYPES[v]?.filterLabel ?? v,
    dot: true,
    order: ["request", "external"],
  },
  { key: "region", label: "Region", value: (d) => d.region, sort: sortRegions },
  { key: "category", label: "Category", value: (d) => d.category },
  {
    key: "time",
    label: "Time step",
    value: (d) => d.temporalResolution || "Not specified",
    order: ["Daily", "Monthly", "Annual", "Not specified"],
    secondary: true,
  },
  { key: "map", label: "Map", value: (d) => (d.mapLayer ? "On the map" : "Catalogue only"), secondary: true },
];

export function createCatalogue(catalogue) {
  const grid = document.getElementById("catalogue-grid");
  const filtersEl = document.getElementById("catalogue-filters");
  const primaryEl = document.getElementById("catalogue-filters-primary");
  const moreEl = document.getElementById("catalogue-filters-more");
  const moreToggle = document.getElementById("catalogue-filters-toggle");
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
    else if (filter.order) values.sort((a, b) => rank(filter.order, a) - rank(filter.order, b));

    const group = h("fieldset", { class: "filter-group" }, h("legend", {}, filter.label));
    if (filter.key === "access") group.title = "Yellow: request from Utrecht University. Teal: access at the provider.";
    for (const value of values) {
      const chip = h(
        "button",
        { type: "button", class: "chip", "aria-pressed": "false" },
        filter.dot ? accessDot({ type: value }) : null,
        filter.display ? filter.display(value) : value,
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
    (filter.secondary ? moreEl : primaryEl).append(group);
  }

  function setMoreOpen(open) {
    moreEl.hidden = !open;
    moreToggle.setAttribute("aria-expanded", String(open));
    updateMoreLabel();
  }
  function updateMoreLabel() {
    const activeSecondary = FILTERS.filter((f) => f.secondary).reduce((n, f) => n + active[f.key].size, 0);
    const base = moreEl.hidden ? "More filters" : "Fewer filters";
    moreToggle.textContent = activeSecondary ? `${base} (${activeSecondary})` : base;
  }
  moreToggle.addEventListener("click", () => setMoreOpen(moreEl.hidden));

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
    countEl.textContent = filtered ? `${shown} of ${items.length} datasets` : `${items.length} datasets`;
    emptyEl.hidden = shown > 0;
    clearButton.hidden = !filtered;
    updateMoreLabel();
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

function rank(order, value) {
  const i = order.indexOf(value);
  return i === -1 ? order.length : i;
}

function searchText(dataset, catalogue) {
  const surfaceTitles = dataset.surfaces.map((id) => catalogue.surfaceById.get(id)?.title || "");
  return [
    dataset.title,
    dataset.theme,
    dataset.category,
    dataset.region,
    dataset.page,
    dataset.summary,
    dataset.access.provider,
    dataset.access.type === "external" ? "external" : "uu utrecht request",
    ...surfaceTitles,
  ]
    .join(" ")
    .replace(/_/g, " ")
    .toLowerCase();
}

function renderCard(d) {
  const href = datasetUrl(d.page);
  const external = d.access.type === "external";
  const meta = [d.region, d.period, external ? d.access.provider : null].filter(Boolean).join(" · ");
  return h(
    "li",
    { class: `card card--${d.access.type}` },
    h(
      "a",
      { class: "card__media", href, tabindex: "-1", "aria-hidden": "true" },
      h("img", { src: thumbnailUrl(d.thumbnail), alt: "", loading: "lazy", width: "320", height: "200" }),
    ),
    h(
      "div",
      { class: "card__body" },
      h("div", { class: "card__top" }, accessBadge(d.access, { withProvider: false }), h("span", { class: "card__theme" }, d.theme)),
      h("h2", { class: "card__title" }, h("a", { href }, d.title)),
      d.summary ? h("p", { class: "card__summary" }, d.summary) : null,
      h("p", { class: "card__meta" }, meta),
      h(
        "div",
        { class: "card__actions" },
        h("a", { class: "btn btn--ghost btn--sm", href }, "Details"),
        d.mapLayer ? h("a", { class: "btn btn--primary btn--sm", href: mapUrl(d.mapLayer) }, "View on map") : null,
        external ? accessButton(d.access, { size: "sm" }) : null,
      ),
    ),
  );
}
