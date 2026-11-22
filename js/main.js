// Entry point: loads the catalogue and wires the views, dialogs and URL state.

import { createCatalogue } from "./catalogue.js";
import { createMetadataDialog, setupInfoDialog } from "./dialogs.js";
import { loadCatalogue } from "./data.js";
import { createMapView } from "./map/mapView.js";
import { renderOpenData } from "./openData.js";
import { createTabs } from "./tabs.js";
import { readHash, writeHash } from "./urlState.js";

const VIEWS = ["map", "catalogue", "open-data"];

function showBanner(message) {
  const banner = document.getElementById("app-banner");
  banner.textContent = message;
  banner.hidden = false;
}

async function main() {
  setupInfoDialog(document.getElementById("about-button"));
  const metadataDialog = createMetadataDialog();

  let mapState = {};
  let mapView = null;

  const tabs = createTabs(document.querySelector(".site-nav"), {
    onChange(view, { changed }) {
      metadataDialog.close();
      if (view === "map") mapView?.shown();
      else writeHash({ view });
      if (changed && view !== "map") document.getElementById(`view-${view}`).scrollTop = 0;
    },
  });

  renderOpenData(document.getElementById("open-data"));

  let catalogue;
  try {
    catalogue = await loadCatalogue();
  } catch (error) {
    console.error("Could not load the data catalogue:", error);
    showBanner("The data catalogue could not be loaded. Please refresh the page or try again later.");
    return;
  }

  mapView = createMapView({
    catalogue,
    metadataDialog,
    onStateChange(state) {
      mapState = state;
      if (tabs.current === "map") writeHash({ view: "map", ...mapState });
    },
  });
  createCatalogue(catalogue);

  function applyHash() {
    const params = readHash();
    const view = VIEWS.includes(params.view) ? params.view : "map";
    tabs.select(view); // show the map first so Leaflet has a size before moving it
    if (view === "map") {
      if (params.z && params.ll) mapView.setView(params.z, params.ll);
      if (params.layer) mapView.selectLayer(params.layer, params.time);
    }
  }

  // Links such as "#view=map&layer=X" (catalogue cards, dataset pages) fire hashchange.
  window.addEventListener("hashchange", applyHash);
  applyHash();
}

main();
