// Click on the map → value of the active layer at that point (WMS GetFeatureInfo).

import { GEOSERVER_URL } from "../config.js";
import { formatTime, formatValue, h } from "../util.js";

// Values GeoServer returns for "no data" across the published rasters.
const GENERIC_NO_DATA = [-9999, 65535];

export function isNoData(value, surface) {
  if (typeof value !== "number" || !Number.isFinite(value)) return true;
  if (GENERIC_NO_DATA.includes(value)) return true;
  if (Math.abs(value) > 1e30) return true; // float32 min/max fill values (±3.4e38)
  const noData = surface.noData;
  return noData != null && Math.abs(value - noData) <= Math.abs(noData) * 1e-6;
}

function extractValue(data) {
  const props = data?.features?.[0]?.properties;
  if (!props) return null;
  if ("GRAY_INDEX" in props) return props.GRAY_INDEX;
  return Object.values(props).find((v) => typeof v === "number") ?? null;
}

/** Build a GetFeatureInfo request in the map's own CRS so it matches the rendered tiles. */
function featureInfoUrl(map, layer, latlng, time) {
  const crs = map.options.crs;
  const bounds = map.getBounds();
  const sw = crs.project(bounds.getSouthWest());
  const ne = crs.project(bounds.getNorthEast());
  const size = map.getSize();
  const point = map.latLngToContainerPoint(latlng).round();
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers: layer.wmsParams.layers,
    query_layers: layer.wmsParams.layers,
    styles: "",
    srs: crs.code,
    bbox: [sw.x, sw.y, ne.x, ne.y].join(","),
    width: size.x,
    height: size.y,
    x: point.x,
    y: point.y,
    info_format: "application/json",
    feature_count: "1",
  });
  if (time) params.set("time", time);
  return `${GEOSERVER_URL}?${params}`;
}

/** @param {() => ({layer, surface, time} | null)} getActive */
export function enableFeatureInfo(map, getActive) {
  let requestId = 0;

  map.on("click", async (event) => {
    const active = getActive();
    if (!active) return;
    const { layer, surface, time } = active;
    const id = ++requestId;

    const context = h("span", { class: "value-popup__context" }, `${surface.title} · ${formatTime(time)}`);
    const popup = L.popup({ maxWidth: 260 })
      .setLatLng(event.latlng)
      .setContent(h("div", { class: "value-popup" }, h("span", { class: "value-popup__context" }, "Loading value…")))
      .openOn(map);

    let content;
    try {
      const response = await fetch(featureInfoUrl(map, layer, event.latlng, time));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = extractValue(await response.json());
      const text = isNoData(value, surface)
        ? "No data at this location"
        : `${formatValue(value)}${surface.unit ? ` ${surface.unit}` : ""}`;
      content = h("div", { class: "value-popup" }, h("strong", { class: "value-popup__value" }, text), context);
    } catch (error) {
      console.error("GetFeatureInfo failed:", error);
      content = h("div", { class: "value-popup" }, "Could not retrieve the value here. Please try again.");
    }
    if (id === requestId && popup.isOpen()) popup.setContent(content);
  });
}
