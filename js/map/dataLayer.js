// The GeoServer WMS data layer, its legend and opacity control.

import { GEOSERVER_URL, GEOSERVER_WORKSPACE, LEGEND_STYLE_SUFFIX, MOBILE_QUERY } from "../config.js";
import { ICONS, h, icon } from "../util.js";

const TILE_ERROR_THRESHOLD = 5;

/** WMS tile layer that retries a failed tile a couple of times with backoff. */
const RetryingWMS = L.TileLayer.WMS.extend({
  options: { maxRetries: 2 },

  createTile(coords, done) {
    const tile = document.createElement("img");
    tile.alt = "";
    tile.setAttribute("role", "presentation");
    const url = this.getTileUrl(coords);
    let attempt = 0;

    tile.onload = () => done(null, tile);
    tile.onerror = () => {
      if (attempt < this.options.maxRetries) {
        attempt += 1;
        setTimeout(() => {
          tile.src = url;
        }, 500 * 2 ** attempt);
      } else {
        done(new Error(`Tile failed: ${url}`), tile);
      }
    };
    tile.src = url;
    return tile;
  },
});

/** WMS endpoint: the provider's own (external layers) or the UU GeoServer. */
export function wmsUrl(surface) {
  return surface.map.url || GEOSERVER_URL;
}

/** UU layers live in the GeoServer workspace; external layers use their full name as given. */
export function qualifiedLayerName(surface) {
  return surface.map.url ? surface.map.layer : `${GEOSERVER_WORKSPACE}:${surface.map.layer}`;
}

/**
 * Legend graphic URL. External layers may give their own; for UU layers the rule is:
 * the legend style is always the layer style + "_legend".
 */
export function legendUrl(surface) {
  if (surface.map.legendUrl) return surface.map.legendUrl;
  if (surface.map.url) return null; // external layer without a legend
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetLegendGraphic",
    format: "image/png",
    style: `${GEOSERVER_WORKSPACE}:${surface.map.style}${LEGEND_STYLE_SUFFIX}`,
    STRICT: "false",
  });
  return `${GEOSERVER_URL}?${params}`;
}

/**
 * @param {L.Map} map
 * @param {{onLoading: Function, onLoad: Function, onTileErrors: Function}} hooks
 */
export function createDataLayer(map, { onLoading, onLoad, onTileErrors }) {
  let layer = null;
  let surface = null;
  let time = null;
  let opacity = 1;
  let tileErrors = 0;
  let legendShown = false;

  const legend = createLegendControl({
    onOpacity(value) {
      opacity = value;
      layer?.setOpacity(value);
    },
  });

  function show(nextSurface, nextTime) {
    // Same layer, other date: just update the TIME parameter.
    if (layer && surface?.id === nextSurface.id) {
      if (nextTime !== time) {
        time = nextTime;
        tileErrors = 0;
        layer.setParams({ time });
      }
      return;
    }

    if (layer) map.removeLayer(layer);
    surface = nextSurface;
    time = nextTime;
    tileErrors = 0;

    // styles: "" renders with the layer's own (default) style on the server.
    layer = new RetryingWMS(wmsUrl(surface), {
      layers: qualifiedLayerName(surface),
      ...(time ? { time } : {}), // layers without a time dimension get no TIME parameter
      styles: "",
      format: "image/png8",
      version: "1.1.0",
      transparent: true,
      pane: "data",
      opacity,
      tileSize: 128,
      keepBuffer: 3,
      updateWhenIdle: true,
      updateWhenZooming: false,
    });
    layer.on("loading", onLoading);
    layer.on("load", onLoad);
    layer.on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors === TILE_ERROR_THRESHOLD) onTileErrors();
    });
    layer.addTo(map);

    legend.update(surface);
    if (!legendShown) {
      legend.control.addTo(map);
      legendShown = true;
    }
  }

  function clear() {
    if (layer) map.removeLayer(layer);
    layer = surface = time = null;
    legend.control.remove();
    legendShown = false;
  }

  return {
    show,
    clear,
    get active() {
      return layer ? { layer, surface, time } : null;
    },
  };
}

function createLegendControl({ onOpacity }) {
  const title = h("p", { class: "legend-panel__title" });
  const img = h("img", { class: "legend-panel__img", alt: "" });
  const slider = h("input", {
    type: "range",
    id: "opacity-slider",
    min: "0",
    max: "1",
    step: "0.05",
    value: "1",
  });
  const output = h("output", { for: "opacity-slider" }, "100%");
  const body = h(
    "div",
    { class: "legend-panel__body", id: "legend-body" },
    img,
    h("div", { class: "opacity-control" }, h("label", { for: "opacity-slider" }, "Opacity"), slider, output),
  );
  const collapse = h(
    "button",
    {
      type: "button",
      class: "legend-panel__collapse",
      "aria-expanded": "true",
      "aria-controls": "legend-body",
      "aria-label": "Collapse legend",
    },
    icon(ICONS.chevronDown),
  );
  const panel = h("div", { class: "legend-panel" }, h("div", { class: "legend-panel__header" }, title, collapse), body);

  slider.addEventListener("input", () => {
    const value = Number(slider.value);
    output.textContent = `${Math.round(value * 100)}%`;
    onOpacity(value);
  });
  function setExpanded(expanded) {
    collapse.setAttribute("aria-expanded", String(expanded));
    collapse.setAttribute("aria-label", expanded ? "Collapse legend" : "Expand legend");
    body.hidden = !expanded;
  }
  collapse.addEventListener("click", () => setExpanded(collapse.getAttribute("aria-expanded") !== "true"));
  setExpanded(!window.matchMedia(MOBILE_QUERY).matches); // start collapsed on small screens
  img.addEventListener("error", () => {
    img.hidden = true;
  });

  const control = L.control({ position: "bottomleft" });
  control.onAdd = () => {
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);
    return panel;
  };

  return {
    control,
    update(surface) {
      title.replaceChildren(surface.title);
      if (surface.unit) title.append(h("span", { class: "legend-panel__unit" }, surface.unit));
      img.hidden = false;
      img.alt = `Legend for ${surface.title}`;
      const url = legendUrl(surface);
      img.hidden = !url;
      if (url) img.src = url;
    },
  };
}
