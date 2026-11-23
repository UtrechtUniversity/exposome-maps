// Leaflet map with basemaps and standard controls.

import { MAP_VIEW } from "../config.js";
import { ICONS, icon } from "../util.js";

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// Esri Light/Dark Gray Canvas: "Powered by Esri" plus the service's own copyright text
// (copyrightText from the MapServer metadata).
const ESRI =
  'Powered by <a href="https://www.esri.com/">Esri</a> | ' +
  "Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community";
const ESRI_TILES = "https://services.arcgisonline.com/arcgis/rest/services/Canvas";

export function createBaseMap(element) {
  const map = L.map(element, {
    zoomControl: false,
    center: MAP_VIEW.center,
    zoom: MAP_VIEW.zoom,
    minZoom: MAP_VIEW.minZoom,
  });

  // Basemaps live in their own pane under the data layers.
  map.createPane("basemaps").style.zIndex = 150;
  map.getPane("basemaps").style.pointerEvents = "none";
  map.createPane("data").style.zIndex = 350;

  const basemaps = {
    light: L.tileLayer(`${ESRI_TILES}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      attribution: ESRI,
      pane: "basemaps",
    }),
    dark: L.tileLayer(`${ESRI_TILES}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      attribution: ESRI,
      pane: "basemaps",
    }),
    osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: OSM,
      pane: "basemaps",
    }),
  };
  const themeBasemap = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  basemaps[themeBasemap()].addTo(map);

  L.control.zoom({ position: "topleft" }).addTo(map);
  createResetControl().addTo(map);
  L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
  L.control
    .layers(
      { "Light background": basemaps.light, "Dark background": basemaps.dark, OpenStreetMap: basemaps.osm },
      {},
      { position: "topright", collapsed: window.matchMedia("(max-width: 900px)").matches },
    )
    .addTo(map);

  /** Switch basemap by key ("light" | "dark" | "osm"); the layer switcher follows. */
  function setBasemap(key) {
    const target = basemaps[key];
    if (!target || map.hasLayer(target)) return;
    Object.values(basemaps).forEach((layer) => map.removeLayer(layer));
    target.addTo(map);
  }

  // Follow the site theme (light ↔ dark background) unless OpenStreetMap was chosen.
  window.addEventListener("themechange", () => {
    if (!map.hasLayer(basemaps.osm)) setBasemap(themeBasemap());
  });

  return { map, setBasemap };
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
