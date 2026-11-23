// Loading the generated catalogue (data/catalogue.json) and lookup helpers.

import { DATA_URL, PAGES_PATH, REGION_ORDER, THUMBNAIL_PATH } from "./config.js";

export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

/**
 * @returns {Promise<{surfaces: object[], datasets: object[], surfaceById: Map,
 *   surfaceByLayer: Map, datasetByPage: Map}>}
 */
export async function loadCatalogue() {
  const data = await fetchJson(DATA_URL);
  return {
    ...data,
    surfaceById: new Map(data.surfaces.map((s) => [s.id, s])),
    surfaceByLayer: new Map(data.surfaces.filter((s) => s.map).map((s) => [s.map.layer, s])),
    datasetByPage: new Map(data.datasets.map((d) => [d.page, d])),
  };
}

/** Group items by key, keeping first-seen order. */
export function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

export function sortRegions(names) {
  const rank = (name) => {
    const i = REGION_ORDER.indexOf(name);
    return i === -1 ? REGION_ORDER.length : i;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function datasetUrl(page) {
  return `${PAGES_PATH}${encodeURIComponent(page)}.html`;
}

/** Thumbnail file name (in THUMBNAIL_PATH, without .png) or a full https URL. */
export function thumbnailUrl(name) {
  if (/^https:\/\//.test(name)) return name;
  return `${THUMBNAIL_PATH}${encodeURIComponent(name)}.png`;
}

export function mapUrl(layer, time) {
  const params = new URLSearchParams({ view: "map", layer });
  if (time) params.set("time", time);
  return `#${params}`;
}
