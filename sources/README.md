# External metadata sources

Each JSON file in this folder is one **external metadata source**: a list of exposome datasets
that are published by another organisation. The build merges them into the catalogue next to the
Utrecht University datasets from `metadata.json`.

- **UU datasets** (`metadata.json`) are shown as **UU · On request** (yellow) and link to the data request form.
- **External datasets** (this folder) are shown as **External · \<provider\>** (teal) and link to `access_url`.

## Adding a source

1. Write (or generate with a converter) `sources/<source-id>.json` in the format below.
2. Run `python scripts/validate_metadata.py`, then fix any errors.
3. Run `python scripts/build.py`. Each dataset gets a page `catalogue_pages/<id>.html`.
4. Commit the source file together with the regenerated `data/catalogue.json` and `catalogue_pages/`.

Files whose name starts with `_` are ignored, which is useful for drafts. `source.schema.json` is the
formal definition ([JSON Schema 2020-12](https://json-schema.org/)). Converters can validate their output
against it directly, and editors such as VS Code use it for autocompletion through the `"$schema"` key.

## Format

```jsonc
{
  "$schema": "./source.schema.json",
  "source": {
    "id": "nationaal-georegister",          // unique; lowercase letters, digits, - . _
    "name": "Nationaal Georegister",        // shown as "Metadata source" on dataset pages
    "description": "Datasets harvested from the Dutch national geo-register",
    "url": "https://www.nationaalgeoregister.nl/",   // optional
    "updated": "2026-11-23"                 // optional, YYYY-MM-DD
  },
  "datasets": [
    {
      // Required
      "id": "national-noise-level-nl",      // unique across ALL sources and metadata.json
      "title": "National noise level",
      "category": "Physico-Chemical",       // reuse existing categories where possible
      "theme": "Noise",
      "region": "Netherlands",              // used for filtering: Europe, Netherlands, Global, …
      "provider": "RIVM",                   // shown on the badge and access button
      "access_url": "https://…",            // where users get the data (https only)

      // Optional
      "summary": "Calculated noise exposure.",
      "extent": "Netherlands",
      "license": "CC BY 4.0",
      "temporal_resolution": "Annual",
      "period": "2016 - 2022",
      "spatial_resolution": "10x10m",
      "unit": "dB",
      "keywords": ["noise", "road traffic"],
      "references": "…",
      "metadata_url": "https://…",          // link to the original metadata record
      "thumbnail": "noise_nl",              // file in catalogue_pages/images/thumbnails/ (no .png) or an https URL

      // Optional: show on the map from the provider's own WMS
      "map": {
        "wms_url": "https://…/wms",
        "layer": "workspace:layer_name",    // full WMS layer name
        "legend_url": "https://…",          // optional legend image
        "times": ["2016", "2022"]           // WMS TIME values; [""] for layers without a time dimension
      }
    }
  ]
}
```

## What the validator checks

- **Errors** (the build stops): the file is not valid JSON or does not match the schema; a missing
  required field; an `access_url` that is not `https`; a duplicate `source.id`; a dataset `id` that is
  already used in another source or in `metadata.json` (compared case-insensitively, because it becomes
  a file name); a map layer name that is already in use.
- **Warnings**: a category that doesn't exist yet in the catalogue (often a typo); no summary; no licence.

## Mapping from common metadata standards

These are suggestions for converter authors:

| This format | DCAT / DCAT-AP | ISO 19115 / 19139 | DataCite |
| --- | --- | --- | --- |
| `title` | `dct:title` | `citation/title` | `titles/title` |
| `summary` | `dct:description` (first sentence) | `abstract` | `descriptions/description` |
| `provider` | `dct:publisher` | `pointOfContact` (organisation) | `publisher` |
| `access_url` | `dcat:landingPage` or `dcat:accessURL` | `distributionInfo/onLine/linkage` | `url` / DOI resolver |
| `license` | `dct:license` | `resourceConstraints` | `rightsList/rights` |
| `period` | `dct:temporal` | `extent/temporalElement` | `dates` (Coverage) |
| `keywords` | `dcat:keyword` | `descriptiveKeywords` | `subjects` |
| `metadata_url` | record URI | `fileIdentifier` URL | DOI |

`category`, `theme` and `region` usually need a small lookup table in the converter, so that datasets
land in the same groups as the existing catalogue entries.
