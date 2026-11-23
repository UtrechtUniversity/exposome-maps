// Map view: wires the base map, data layer, time control, layer menu and sidebar.

import { MOBILE_QUERY } from "../config.js";
import { debounce, formatTime } from "../util.js";
import { createBaseMap } from "./baseMap.js";
import { createDataLayer } from "./dataLayer.js";
import { enableFeatureInfo } from "./featureInfo.js";
import { createLayerMenu } from "./layerMenu.js";
import { createTimeControl } from "./timeControl.js";

const $ = (id) => document.getElementById(id);

/**
 * @param {{catalogue: object, metadataDialog: object, onStateChange: (state) => void}} options
 */
export function createMapView({ catalogue, metadataDialog, onStateChange }) {
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
  const { map } = createBaseMap($("map"));
  let surface = null;
  let time = null;

  // ----- Feedback -----
  const spinner = $("layer-spinner");
  const toastEl = $("map-toast");
  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 5000);
  }

  const dataLayer = createDataLayer(map, {
    onLoading: () => {
      spinner.hidden = false;
    },
    onLoad: () => {
      spinner.hidden = true;
    },
    onTileErrors: () => toast("Some map tiles could not be loaded. The map server may be busy; try again shortly."),
  });
  enableFeatureInfo(map, () => dataLayer.active);

  // ----- Layer card (top of map) -----
  function updateLayerCard() {
    $("layer-card-empty").hidden = Boolean(surface);
    $("layer-card-body").hidden = !surface;
    if (!surface) return;
    $("layer-card-title").textContent = surface.title;
    $("layer-card-time").textContent = formatTime(time);
  }

  // ----- Time control -----
  const timeControl = createTimeControl({
    panel: $("time-panel"),
    picker: $("time-picker"),
    prev: $("time-prev"),
    next: $("time-next"),
    onChange(nextTime) {
      time = nextTime;
      dataLayer.show(surface, time);
      map.closePopup();
      updateLayerCard();
      emitState();
    },
  });

  // ----- Menu -----
  const menu = createLayerMenu($("layer-menu"), $("region-switch"), catalogue.surfaces, {
    onSelect: (s) => {
      selectSurface(s, time);
      if (isMobile()) setSidebarOpen(false);
    },
    onInfo: (s) => metadataDialog.open(s),
  });

  const filterInput = $("layer-filter");
  filterInput.addEventListener(
    "input",
    debounce(() => {
      $("layer-filter-empty").hidden = menu.filter(filterInput.value) > 0;
    }, 120),
  );

  // ----- Sidebar -----
  const sidebar = $("map-sidebar");
  const toggle = $("sidebar-toggle");
  function setSidebarOpen(open) {
    sidebar.dataset.open = String(open);
    toggle.setAttribute("aria-expanded", String(open));
  }
  toggle.addEventListener("click", () => setSidebarOpen(sidebar.dataset.open !== "true"));
  if (isMobile()) setSidebarOpen(false);

  // Keep Leaflet in sync with its container size (sidebar, window, tab switches).
  new ResizeObserver(() => map.invalidateSize()).observe($("map"));

  // ----- State -----
  function emitState() {
    const center = map.getCenter();
    onStateChange({
      layer: surface?.map.layer,
      time,
      z: map.getZoom(),
      ll: `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`,
    });
  }
  map.on("moveend", debounce(emitState, 300));

  function selectSurface(nextSurface, preferredTime) {
    surface = nextSurface;
    time = timeControl.setSurface(surface, preferredTime);
    dataLayer.show(surface, time);
    map.closePopup();
    menu.setSelected(surface);
    updateLayerCard();
    emitState();
  }

  return {
    /** Select a layer by GeoServer layer name; returns false if unknown. */
    selectLayer(layerName, preferredTime) {
      const next = catalogue.surfaceByLayer.get(layerName);
      if (!next) {
        toast(`Layer “${layerName}” is not available on the map.`);
        return false;
      }
      if (next !== surface) selectSurface(next, preferredTime ?? time);
      else if (preferredTime && preferredTime !== time && next.map.times.includes(preferredTime)) {
        time = timeControl.setSurface(next, preferredTime);
        dataLayer.show(next, time);
        updateLayerCard();
      }
      return true;
    },

    setView(z, ll) {
      const zoom = Number(z);
      const [lat, lng] = String(ll || "").split(",").map(Number);
      if (Number.isFinite(zoom) && Number.isFinite(lat) && Number.isFinite(lng)) map.setView([lat, lng], zoom);
    },

    /** Called when the map tab becomes visible. */
    shown() {
      map.invalidateSize();
      emitState();
    },
  };
}
