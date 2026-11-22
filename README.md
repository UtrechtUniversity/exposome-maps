# Exposome Maps

Interactive map and data catalogue of exposome data layers from the ExposomeNL and EXPANSE projects.
Map layers are served by GeoServer at `exposome.uu.nl`; this repository is the static website.

## What's new

- 9/6/2026: Food environment datasets added to the catalogue
- 25/5/2026: Monthly minimum and maximum temperature datasets added to the catalogue
- 23/4/2026: Exposome Maps 1.0 is ready!

## Project structure

```
index.html              App shell: Map, Catalogue and Open data views
info-page.html          Content of the "About" dialog
metadata.json           SOURCE OF TRUTH for all datasets and surfaces (edit this)
data/
  catalogue.json        GENERATED from metadata.json — read by the website
  open-data.json        List of external open datasets/platforms (edit directly)
catalogue_pages/        GENERATED dataset pages (+ images/thumbnails/)
content/
  dataset_titles.json   Display titles for dataset pages (optional per dataset)
  methodology/          Methodology text: <catalogue_page>.html or theme-<theme>.html
templates/dataset.html.j2   Template for the dataset pages
scripts/
  build.py              Validate metadata, write data/catalogue.json and catalogue_pages/
  validate_metadata.py  Report errors and gaps in metadata.json
css/                    tokens.css (colours, spacing…), base.css, app.css, dataset.css
js/                     ES modules — main.js is the entry point; config.js holds endpoints
```

No bundler or Node is needed: the JavaScript runs as native ES modules, and Leaflet/flatpickr
are loaded from pinned CDN versions with integrity hashes.

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

(ES modules and `fetch` don't work from `file://`, so use a local server.)

To test against a local GeoServer, change `GEOSERVER_URL` in [js/config.js](js/config.js).

## Adding or changing a dataset

1. Edit `metadata.json` (one entry per surface; surfaces with the same `catalogue_page` form one dataset).
2. Optional: add a display title to `content/dataset_titles.json` and methodology text to
   `content/methodology/<catalogue_page>.html` (or a shared `theme-<theme>.html`).
3. Add a thumbnail to `catalogue_pages/images/thumbnails/<thumbnail>.png`.
4. Build:

   ```bash
   pip install -r requirements.txt   # once
   python scripts/build.py
   ```

   The build stops on metadata errors. `python scripts/validate_metadata.py` lists all warnings
   (missing thumbnails, methodology, summaries, XML links, malformed date lists).
5. Commit `metadata.json` together with the regenerated `data/catalogue.json` and `catalogue_pages/`.
   CI fails if the generated files are out of date.

### Fields that drive the map

| Field | Meaning |
| --- | --- |
| `show_on_map` | `true` to list the surface as a map layer |
| `geoserver_layer` | Layer name in the `EXPANSE_map` workspace (must be unique) |
| `geoserver_style` | Layer style; the legend is always requested as `<geoserver_style>_legend` |
| `Temporal resolution` | `Annual`, `Monthly` or `Daily` — sets the date control and WMS `TIME` format |
| `chooseable_in_map` | Comma-separated dates shown on the map (`d-m-YYYY`, or `YYYY` for annual). Empty = all of `available`, or the full `start_time`–`end_time` range |
| `default_basemap` | `dark` / `light` / `osm` to switch basemap when the layer is shown |
| `No-data value` | Value treated as "no data" in the click popup |

`Local path to XML file` and other internal fields are not copied to `data/catalogue.json`.
Note that `metadata.json` itself is still public if the whole repository is deployed.

## Shareable links

The address bar always reflects the current map, e.g.
`index.html#view=map&layer=NO2B25_AAV&time=2023&z=7&ll=52.1,5.3`.
Catalogue cards and dataset pages link into the map the same way.
