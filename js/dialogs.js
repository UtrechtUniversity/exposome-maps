// "About" dialog (shown on the first visit) and the metadata drawer. Both use native
// <dialog> + showModal(): focus trapping, Esc to close and backdrop come for free.

import { INFO_URL, STORAGE_KEYS } from "./config.js";
import { datasetUrl } from "./data.js";
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

// All metadata is shown, with the most useful facts first.
const KEY_FIELDS = ["Summary", "Time period", "Spatial resolution", "Unit", "Extent", "Owner", "Provider"];

function metaRows(rows) {
  return rows.map(([label, value]) => h("div", {}, h("dt", {}, label), h("dd", {}, value)));
}

export function createMetadataDialog() {
  const dialog = document.getElementById("metadata-dialog");
  const eyebrow = document.getElementById("metadata-eyebrow");
  const title = document.getElementById("metadata-title");
  const list = document.getElementById("metadata-list");
  const actions = document.getElementById("metadata-actions");
  closeOnBackdropClick(dialog);

  return {
    open(surface) {
      eyebrow.textContent = [surface.region, surface.theme].filter(Boolean).join(" · ");
      title.textContent = surface.title;

      const key = KEY_FIELDS.map((label) => surface.details.find(([l]) => l === label)).filter(Boolean);
      const rest = surface.details.filter(([label]) => !KEY_FIELDS.includes(label));
      list.replaceChildren(...metaRows([...key, ...rest]));

      const buttons = [
        h("a", { class: "btn btn--secondary btn--sm", href: datasetUrl(surface.page) }, "Dataset page"),
        surface.metadataUrl
          ? h(
              "a",
              { class: "btn btn--ghost btn--sm", href: surface.metadataUrl, target: "_blank", rel: "noopener" },
              surface.access.type === "external" ? "Original metadata ↗" : "Metadata (XML)",
            )
          : null,
      ];
      actions.replaceChildren(...buttons.filter(Boolean));
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
