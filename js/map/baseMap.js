// Leaflet map with a theme-matched Esri basemap, place-name labels and standard controls.
// There is no basemap switcher: light mode uses Esri Light Gray, dark mode Esri Dark Gray.

import { MAP_VIEW } from "../config.js";
import { ICONS, icon } from "../util.js";

// "Powered by Esri" plus the services' own copyright text (copyrightText in their metadata).
const ESRI =
  'Powered by <a href="https://www.esri.com/">Esri</a> | ' +
  "Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community";
const ESRI_TILES = "https://services.arcgisonline.com/arcgis/rest/services/Canvas";

// Base (land, water, roads) and Reference (place names, borders) tiles per theme.
const THEMES = {
  light: { base: "World_Light_Gray_Base", labels: "World_Light_Gray_Reference" },
  dark: { base: "World_Dark_Gray_Base", labels: "World_Dark_Gray_Reference" },
};

const esriTiles = (service, pane) =>
  L.tileLayer(`${ESRI_TILES}/${service}/MapServer/tile/{z}/{y}/{x}`, {
    attribution: ESRI,
    pane,
    maxZoom: MAP_VIEW.maxZoom,
  });

export function createBaseMap(element) {
  const map = L.map(element, {
    zoomControl: false,
    center: MAP_VIEW.center,
    zoom: MAP_VIEW.zoom,
    minZoom: MAP_VIEW.minZoom,
    maxZoom: MAP_VIEW.maxZoom,
  });

  // Stacking: basemap < data layer < labels, so place names stay readable on top of the data.
  map.createPane("basemaps").style.zIndex = 150;
  map.getPane("basemaps").style.pointerEvents = "none";
  map.createPane("data").style.zIndex = 350;
  map.createPane("labels").style.zIndex = 450;
  map.getPane("labels").style.pointerEvents = "none";

  const layers = Object.fromEntries(
    Object.entries(THEMES).map(([theme, services]) => [
      theme,
      [esriTiles(services.base, "basemaps"), esriTiles(services.labels, "labels")],
    ]),
  );
  const currentTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  let shown = null;
  function showTheme(theme) {
    if (theme === shown) return;
    if (shown) layers[shown].forEach((layer) => map.removeLayer(layer));
    layers[theme].forEach((layer) => layer.addTo(map));
    shown = theme;
  }
  showTheme(currentTheme());
  window.addEventListener("themechange", () => showTheme(currentTheme()));

  L.control.zoom({ position: "topleft" }).addTo(map);
  createResetControl().addTo(map);
  L.control.scale({ position: "bottomright", imperial: false }).addTo(map);

  return { map };
}

function createResetControl() {
  const Control = L.Control.extend({
    options: { position: "topleft" },
    onAdd(map) {
      const bar = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-reset");
      const link = L.DomUtil.create("a", "", bar);
      link.href = "#";
      link.title = "Reset view";
      link.setAttribute("role", "button");
      link.setAttribute("aria-label", "Reset view");
      link.append(icon(ICONS.home));
      L.DomEvent.disableClickPropagation(bar);
      L.DomEvent.on(link, "click", (event) => {
        L.DomEvent.preventDefault(event);
        map.setView(MAP_VIEW.center, MAP_VIEW.zoom);
      });
      return bar;
    },
  });
  return new Control();
}
