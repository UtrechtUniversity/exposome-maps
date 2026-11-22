// "About" dialog (first visit only) and the metadata drawer. Both use native
// <dialog> + showModal(): focus trapping, Esc to close and backdrop come for free.

import { INFO_URL, STORAGE_KEYS } from "./config.js";
import { datasetUrl, mapUrl } from "./data.js";
import { h, storageGet, storageSet } from "./util.js";

function closeOnBackdropClick(dialog) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

export function setupInfoDialog(button) {
  const dialog = document.getElementById("info-dialog");
  const content = document.getElementById("info-content");
  let loaded = false;

  async function open() {
    if (!loaded) {
      try {
        const response = await fetch(INFO_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        content.innerHTML = await response.text(); // same-origin, trusted content
        loaded = true;
      } catch (error) {
        console.error("Could not load info page:", error);
        content.textContent = "The information page could not be loaded. Please try again later.";
      }
    }
    if (!dialog.open) dialog.showModal();
  }

  button.addEventListener("click", open);
  closeOnBackdropClick(dialog);

  // Show automatically on the first visit only.
  if (!storageGet(STORAGE_KEYS.infoSeen)) {
    storageSet(STORAGE_KEYS.infoSeen, "1");
    open();
  }
}

export function createMetadataDialog() {
  const dialog = document.getElementById("metadata-dialog");
  const eyebrow = document.getElementById("metadata-eyebrow");
  const title = document.getElementById("metadata-title");
  const list = document.getElementById("metadata-list");
  const actions = document.getElementById("metadata-actions");
  closeOnBackdropClick(dialog);

  return {
    /** @param {{showMapLink?: boolean}} options */
    open(surface, { showMapLink = false } = {}) {
      eyebrow.textContent = `${surface.project} · Surface ${surface.id}`;
      title.textContent = surface.title;
      list.replaceChildren(
        ...surface.details.map(([label, value]) => h("div", {}, h("dt", {}, label), h("dd", {}, value))),
      );
      actions.replaceChildren(
        h("a", { class: "btn btn--secondary btn--sm", href: datasetUrl(surface.page) }, "Dataset page"),
        surface.xml
          ? h("a", { class: "btn btn--ghost btn--sm", href: surface.xml, target: "_blank", rel: "noopener" }, "Metadata (XML)")
          : null,
        showMapLink && surface.map
          ? h("a", { class: "btn btn--primary btn--sm", href: mapUrl(surface.map.layer) }, "View on map")
          : null,
      );
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
