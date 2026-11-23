// Open data view, rendered from data/open-data.json.

import { OPEN_DATA_URL } from "./config.js";
import { fetchJson } from "./data.js";
import { h } from "./util.js";

export async function renderOpenData(container) {
  let data;
  try {
    data = await fetchJson(OPEN_DATA_URL);
  } catch (error) {
    console.error("Could not load open data list:", error);
    container.replaceChildren(h("p", { class: "empty-state" }, "The open data list could not be loaded."));
    return;
  }

  container.replaceChildren(
    h("h1", { class: "page-title" }, "Open exposome data"),
    h("p", { class: "page-intro" }, data.intro),
    ...data.sections.map((section) =>
      h(
        "section",
        { class: "open-data__section" },
        h("h2", {}, section.title),
        h(
          "div",
          { class: "table-wrap" },
          h(
            "table",
            { class: "data-table" },
            h(
              "thead",
              {},
              h("tr", {}, ["Name", "Description", "Source", "Extent"].map((t) => h("th", { scope: "col" }, t))),
            ),
            h(
              "tbody",
              {},
              section.items.map((item) =>
                h(
                  "tr",
                  {},
                  h("td", {}, h("a", { href: item.url, target: "_blank", rel: "noopener" }, item.name, " ↗")),
                  h("td", {}, item.description),
                  h("td", {}, item.source),
                  h("td", {}, item.extent),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
