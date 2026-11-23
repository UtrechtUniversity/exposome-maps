// Data platforms view, rendered from data/platforms.json. Individual external
// datasets are not listed here: they are catalogue entries (see sources/).

import { PLATFORMS_URL } from "./config.js";
import { fetchJson } from "./data.js";
import { h } from "./util.js";

export async function renderPlatforms(container) {
  let data;
  try {
    data = await fetchJson(PLATFORMS_URL);
  } catch (error) {
    console.error("Could not load the data platforms list:", error);
    container.replaceChildren(h("p", { class: "empty-state" }, "The list of data platforms could not be loaded."));
    return;
  }

  container.replaceChildren(
    h("h1", { class: "page-title" }, "Data platforms"),
    h("p", { class: "page-intro" }, data.intro),
    h(
      "section",
      { class: "platforms__section" },
      h(
        "div",
        { class: "table-wrap" },
        h(
          "table",
          { class: "data-table" },
          h(
            "thead",
            {},
            h("tr", {}, ["Platform", "Description", "Provided by", "Extent"].map((t) => h("th", { scope: "col" }, t))),
          ),
          h(
            "tbody",
            {},
            data.items.map((item) =>
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
  );
}
