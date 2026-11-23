"""Shared helpers: load, normalise and validate the catalogue sources.

Two kinds of source feed the catalogue:

* metadata.json — Utrecht University (IRAS) datasets, edited by hand or exported
  from the metadata spreadsheet. These are obtained through the UU request form.
* sources/*.json — external metadata sources in the format described by
  sources/source.schema.json (written by converters). These link to the provider.

Everything the website reads is derived from them by scripts/build.py.
"""

from __future__ import annotations

import calendar
import json
import math
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
METADATA_FILE = ROOT / "metadata.json"
TITLES_FILE = ROOT / "content" / "dataset_titles.json"
METHODOLOGY_DIR = ROOT / "content" / "methodology"
PAGES_DIR = ROOT / "catalogue_pages"
THUMBNAIL_DIR = PAGES_DIR / "images" / "thumbnails"
FALLBACK_THUMBNAIL = "not_available"
SOURCES_DIR = ROOT / "sources"
SOURCE_SCHEMA_FILE = SOURCES_DIR / "source.schema.json"

# How UU datasets are obtained.
REQUEST_FORM_URL = "https://utrechtuniversity.github.io/Exposome-Map-Documents/Data_request_form/"
UU_SOURCE_ID = "uu"
UU_ACCESS = {
    "type": "request",
    "provider": "Utrecht University (IRAS)",
    "url": REQUEST_FORM_URL,
    "license": "",
}

REQUIRED_FIELDS = [
    "Surface ID", "Project", "Title", "Category", "Theme",
    "Temporal resolution", "catalogue_page",
]
TEMPORAL_RESOLUTIONS = {"Annual", "Monthly", "Daily"}
PLACEHOLDER_VALUES = {"", "no summary", "n/a", "na", "none"}

# Fields shown to users, in display order (metadata panel + dataset page).
DETAIL_FIELDS = [
    "Category", "Theme", "Summary", "File type", "Temporal resolution",
    "Time period", "Frequency", "Spatial resolution", "Extent", "Unit", "CRS",
    "No-data value", "Owner", "References", "Source project", "Comments",
    "Metadata last updated", "Dataset last revised",
]

# Normalised unit labels for display. Unknown units are shown as-is.
UNIT_DISPLAY = {
    "microgram per cubed meter": "µg/m³",
    "µg/m3": "µg/m³",
    "ng/m3": "ng/m³",
    "degrees c": "°C",
    "meter": "m",
    "percent": "%",
    "particles/cm3": "particles/cm³",
    "particles per cubed meter": "particles/m³",
    "j/m2": "J/m²",
    "m-1": "m⁻¹",
    "index": "",
    "count": "",
}


# --------------------------------------------------------------------------- #
# Parsing helpers
# --------------------------------------------------------------------------- #

def clean(value) -> str:
    return re.sub(r"\s+", " ", str(value if value is not None else "")).strip()


def is_placeholder(value) -> bool:
    return clean(value).lower() in PLACEHOLDER_VALUES


def split_list(value) -> list[str]:
    return [part.strip() for part in str(value or "").split(",") if part.strip()]


def parse_date(value) -> date | None:
    """Parse 'd-m-Y', 'd-m-y' or a bare 'YYYY' (-> 1 January)."""
    text = clean(value)
    if re.fullmatch(r"\d{4}", text):
        return date(int(text), 1, 1)
    match = re.fullmatch(r"(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})", text)
    if not match:
        return None
    day, month, year = (int(g) for g in match.groups())
    if year < 100:
        year += 2000
    try:
        return date(year, month, day)
    except ValueError:
        return None


def format_time(d: date, resolution: str) -> str:
    """WMS TIME value for a resolution: YYYY, YYYY-MM or YYYY-MM-DD."""
    if resolution == "Annual":
        return f"{d.year:04d}"
    if resolution == "Monthly":
        return f"{d.year:04d}-{d.month:02d}"
    return d.isoformat()


def parse_number(value) -> float | None:
    try:
        number = float(clean(value))
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def display_unit(unit) -> str:
    text = clean(unit)
    return UNIT_DISPLAY.get(text.lower(), text)


def format_page_title(page: str) -> str:
    return re.sub(r"\s+", " ", page.replace("PM2_5", "PM2.5").replace("_", " ")).strip()


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #

def load_raw() -> list[dict]:
    """Flatten metadata.json ({category: {theme: [surface, ...]}}) into a list."""
    with METADATA_FILE.open(encoding="utf-8") as fh:
        data = json.load(fh)
    items = []
    for category_key, themes in data.items():
        if not isinstance(themes, dict):
            continue
        for theme_key, surfaces in themes.items():
            if not isinstance(surfaces, list):
                continue
            for surface in surfaces:
                items.append({**surface, "_category_key": category_key, "_theme_key": theme_key})
    return items


def load_titles() -> dict[str, str]:
    if TITLES_FILE.exists():
        return json.loads(TITLES_FILE.read_text(encoding="utf-8"))
    return {}


def methodology_file(page: str, theme: str) -> Path | None:
    """Per-dataset methodology, falling back to a shared per-theme file."""
    for candidate in (METHODOLOGY_DIR / f"{page}.html", METHODOLOGY_DIR / f"theme-{slug(theme)}.html"):
        if candidate.exists():
            return candidate
    return None


def thumbnail_name(name: str) -> str:
    """A thumbnail file name in THUMBNAIL_DIR (without .png), an https URL, or the placeholder."""
    name = clean(name)
    if name.startswith("https://"):
        return name
    if name and (THUMBNAIL_DIR / f"{name}.png").exists():
        return name
    return FALLBACK_THUMBNAIL


# --------------------------------------------------------------------------- #
# Map availability
# --------------------------------------------------------------------------- #

def map_times(item: dict) -> list[str]:
    """Sorted, unique WMS TIME values that can be shown on the map."""
    resolution = clean(item.get("Temporal resolution"))
    start = parse_date(item.get("start_time"))
    end = parse_date(item.get("end_time"))
    chooseable = [d for d in map(parse_date, split_list(item.get("chooseable_in_map"))) if d]

    if chooseable:
        values = {format_time(d, resolution) for d in chooseable}
    elif resolution == "Annual":
        available = [d for d in map(parse_date, split_list(item.get("available"))) if d]
        if available:
            values = {format_time(d, resolution) for d in available}
        elif start and end:
            values = {f"{y:04d}" for y in range(start.year, end.year + 1)}
        else:
            values = set()
    elif resolution == "Monthly" and start and end:
        values = set()
        y, m = start.year, start.month
        while (y, m) <= (end.year, end.month):
            values.add(f"{y:04d}-{m:02d}")
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    elif resolution == "Daily" and start and end:
        values = {date.fromordinal(o).isoformat() for o in range(start.toordinal(), end.toordinal() + 1)}
    else:
        values = set()
    return sorted(values)


def coverage_label(item: dict) -> str:
    available = split_list(item.get("available"))
    if available:
        return ", ".join(available)
    return clean(item.get("Time period"))


# --------------------------------------------------------------------------- #
# Normalisation
# --------------------------------------------------------------------------- #

def details(item: dict) -> list[list[str]]:
    rows = []
    for key in DETAIL_FIELDS:
        value = clean(item.get(key))
        if key == "Unit":
            value = display_unit(value) or value
        if not is_placeholder(value):
            rows.append([key, value])
    return rows


def normalise_surface(item: dict) -> dict:
    show_on_map = item.get("show_on_map") is True
    xml = clean(item.get("Hosted XML file"))
    return {
        "id": item.get("Surface ID"),
        "source": UU_SOURCE_ID,
        "access": UU_ACCESS,
        "region": clean(item.get("Project")),
        "title": clean(item.get("Title")),
        "category": clean(item.get("Category")) or item["_category_key"],
        "categoryKey": item["_category_key"],
        "theme": clean(item.get("Theme")) or item["_theme_key"],
        "themeKey": item["_theme_key"],
        "page": clean(item.get("catalogue_page")),
        "temporalResolution": clean(item.get("Temporal resolution")),
        "period": clean(item.get("Time period")),
        "coverage": coverage_label(item),
        "spatialResolution": clean(item.get("Spatial resolution")),
        "unit": display_unit(item.get("Unit")),
        "noData": parse_number(item.get("No-data value")),
        "metadataUrl": xml if xml.startswith("http") else None,
        "details": details(item),
        "map": {
            "layer": clean(item.get("geoserver_layer")),
            "style": clean(item.get("geoserver_style")),
            "basemap": clean(item.get("default_basemap")) or None,
            "times": map_times(item),
            "url": None,        # null = UU GeoServer from js/config.js
            "legendUrl": None,  # null = "<style>_legend" rule
        } if show_on_map else None,
    }


def build_catalogue(raw: list[dict], sources: list[dict] | None = None) -> dict:
    """Merge UU metadata and (validated) external sources into the website catalogue."""
    uu = build_uu_catalogue(raw)
    surfaces, datasets = uu["surfaces"], uu["datasets"]
    for source in sources or []:
        for entry in source["data"]["datasets"]:
            surface, dataset = normalise_external(entry, source["data"]["source"])
            surfaces.append(surface)
            datasets.append(dataset)
    return {"surfaces": surfaces, "datasets": datasets}


def build_uu_catalogue(raw: list[dict]) -> dict:
    titles = load_titles()
    surfaces = [normalise_surface(item) for item in raw]
    raw_by_id = {item.get("Surface ID"): item for item in raw}

    datasets: dict[str, dict] = {}
    for surface in surfaces:
        page = surface["page"]
        if page not in datasets:
            first = raw_by_id[surface["id"]]
            datasets[page] = {
                "page": page,
                "title": titles.get(page) or format_page_title(page),
                "source": UU_SOURCE_ID,
                "access": UU_ACCESS,
                "region": surface["region"],
                "category": surface["category"],
                "theme": surface["theme"],
                "temporalResolution": surface["temporalResolution"],
                "period": surface["period"],
                "spatialResolution": surface["spatialResolution"],
                "extent": clean(first.get("Extent")),
                "summary": "" if is_placeholder(first.get("Summary")) else clean(first.get("Summary")),
                "thumbnail": thumbnail_name(first.get("thumbnail")),
                "surfaces": [],
                "mapLayer": None,
            }
        dataset = datasets[page]
        dataset["surfaces"].append(surface["id"])
        if surface["map"] and not dataset["mapLayer"]:
            dataset["mapLayer"] = surface["map"]["layer"]

    return {"surfaces": surfaces, "datasets": list(datasets.values())}


# --------------------------------------------------------------------------- #
# External sources (sources/*.json)
# --------------------------------------------------------------------------- #

def load_sources() -> list[dict]:
    """Read sources/*.json (files starting with "_" are skipped).

    Returns [{"path": Path, "data": dict | None, "error": str | None}].
    """
    sources = []
    for path in sorted(SOURCES_DIR.glob("*.json")):
        if path.name.startswith("_") or path == SOURCE_SCHEMA_FILE:
            continue
        try:
            data, error = json.loads(path.read_text(encoding="utf-8")), None
        except json.JSONDecodeError as exc:
            data, error = None, f"invalid JSON: {exc}"
        sources.append({"path": path, "data": data, "error": error})
    return sources


def normalise_external(entry: dict, source: dict) -> tuple[dict, dict]:
    """One external dataset -> (surface, dataset), in the same shape as UU entries."""
    ds_id = entry["id"]
    access = {
        "type": "external",
        "provider": clean(entry["provider"]),
        "url": entry["access_url"],
        "license": clean(entry.get("license")),
    }
    summary = clean(entry.get("summary"))
    rows = [
        ("Category", entry.get("category")),
        ("Theme", entry.get("theme")),
        ("Summary", summary),
        ("Provider", entry.get("provider")),
        ("Licence", entry.get("license")),
        ("Temporal resolution", entry.get("temporal_resolution")),
        ("Time period", entry.get("period")),
        ("Spatial resolution", entry.get("spatial_resolution")),
        ("Extent", entry.get("extent")),
        ("Unit", entry.get("unit")),
        ("Keywords", ", ".join(entry.get("keywords") or [])),
        ("References", entry.get("references")),
        ("Metadata source", source.get("name")),
    ]
    details = [[label, clean(value)] for label, value in rows if not is_placeholder(value)]

    map_config = entry.get("map")
    surface = {
        "id": ds_id,
        "source": source["id"],
        "access": access,
        "region": clean(entry["region"]),
        "title": clean(entry["title"]),
        "category": clean(entry["category"]),
        "categoryKey": clean(entry["category"]),
        "theme": clean(entry["theme"]),
        "themeKey": clean(entry["theme"]),
        "page": ds_id,
        "temporalResolution": clean(entry.get("temporal_resolution")),
        "period": clean(entry.get("period")),
        "coverage": clean(entry.get("period")),
        "spatialResolution": clean(entry.get("spatial_resolution")),
        "unit": display_unit(entry.get("unit")),
        "noData": None,
        "metadataUrl": entry.get("metadata_url"),
        "details": details,
        "map": {
            "layer": map_config["layer"],
            "style": clean(map_config.get("style")),
            "basemap": None,
            "times": list(map_config["times"]),
            "url": map_config["wms_url"],
            "legendUrl": map_config.get("legend_url"),
        } if map_config else None,
    }
    dataset = {
        "page": ds_id,
        "title": surface["title"],
        "source": source["id"],
        "access": access,
        "region": surface["region"],
        "category": surface["category"],
        "theme": surface["theme"],
        "temporalResolution": surface["temporalResolution"],
        "period": surface["period"],
        "spatialResolution": surface["spatialResolution"],
        "extent": clean(entry.get("extent")),
        "summary": summary,
        "thumbnail": thumbnail_name(entry.get("thumbnail")),
        "surfaces": [ds_id],
        "mapLayer": map_config["layer"] if map_config else None,
    }
    return surface, dataset


def validate_sources(sources: list[dict], raw: list[dict], report) -> None:
    """Schema-check each source file and check ids against each other and the UU data.

    Invalid files are removed from `sources`, so the build only merges valid ones.
    """
    schema = json.loads(SOURCE_SCHEMA_FILE.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    known_categories = {clean(i.get("Category")) for i in raw}
    # Page file names must be unique case-insensitively (Windows/macOS file systems).
    taken = {clean(i.get("catalogue_page")).lower(): "metadata.json" for i in raw}
    layers = {clean(i.get("geoserver_layer")): "metadata.json" for i in raw if i.get("show_on_map") is True}
    seen_source_ids = {UU_SOURCE_ID: "metadata.json"}

    for source in sources:
        where = f"sources/{source['path'].name}"
        if source["error"]:
            report.error(where, source["error"])
            continue
        data = source["data"]
        schema_errors = sorted(validator.iter_errors(data), key=lambda e: list(map(str, e.absolute_path)))
        for err in schema_errors:
            location = "/".join(str(p) for p in err.absolute_path) or "(root)"
            report.error(where, f"{location}: {err.message}")
        if schema_errors:
            source["error"] = "schema errors"
            continue

        source_id = data["source"]["id"]
        if source_id in seen_source_ids:
            report.error(where, f"source id '{source_id}' is already used by {seen_source_ids[source_id]}")
        seen_source_ids[source_id] = where

        for entry in data["datasets"]:
            ds_where = f"{where} > {entry['id']}"
            key = entry["id"].lower()
            if key in taken:
                report.error(ds_where, f"dataset id clashes with a dataset in {taken[key]}")
            taken[key] = where
            layer = (entry.get("map") or {}).get("layer")
            if layer:
                if layer in layers:
                    report.error(ds_where, f"map layer '{layer}' is also used in {layers[layer]}")
                layers[layer] = where
            if clean(entry["category"]) not in known_categories:
                known = ", ".join(sorted(c for c in known_categories if c))
                report.warn(ds_where, f"category '{entry['category']}' is new (known: {known})")
            if is_placeholder(entry.get("summary")):
                report.warn(ds_where, "no summary")
            if is_placeholder(entry.get("license")):
                report.warn(ds_where, "no licence given")

    sources[:] = [s for s in sources if not s["error"]]


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #

@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def error(self, where: str, message: str) -> None:
        self.errors.append(f"{where}: {message}")

    def warn(self, where: str, message: str) -> None:
        self.warnings.append(f"{where}: {message}")


def validate(raw: list[dict]) -> Report:
    report = Report()
    seen_ids: dict = {}
    seen_layers: dict = {}

    for item in raw:
        sid = item.get("Surface ID")
        where = f"Surface {sid} ({clean(item.get('Title')) or '?'})"

        for key in REQUIRED_FIELDS:
            missing = sid is None if key == "Surface ID" else is_placeholder(item.get(key))
            if missing:
                report.error(where, f"missing required field '{key}'")

        if sid in seen_ids:
            report.error(where, f"duplicate Surface ID (also used by '{seen_ids[sid]}')")
        seen_ids[sid] = clean(item.get("Title"))

        resolution = clean(item.get("Temporal resolution"))
        if resolution and resolution not in TEMPORAL_RESOLUTIONS:
            report.error(where, f"unknown Temporal resolution '{resolution}'")

        start, end = parse_date(item.get("start_time")), parse_date(item.get("end_time"))
        for key, value in (("start_time", start), ("end_time", end)):
            if clean(item.get(key)) and value is None:
                report.error(where, f"cannot parse {key} '{item.get(key)}' (expected d-m-YYYY)")
        if start and end and start > end:
            report.error(where, "start_time is after end_time")

        for key in ("chooseable_in_map", "available"):
            raw_value = str(item.get(key) or "")
            if re.search(r",\S", raw_value):
                report.warn(where, f"'{key}' has entries not separated by ', '")
            for entry in split_list(raw_value):
                parsed = parse_date(entry)
                if parsed is None:
                    report.error(where, f"cannot parse {key} entry '{entry}'")
                elif key == "chooseable_in_map" and start and end:
                    last_day = date(end.year, end.month, calendar.monthrange(end.year, end.month)[1])
                    if not (date(start.year, start.month, 1) <= parsed <= last_day):
                        report.warn(where, f"{key} entry '{entry}' is outside start_time–end_time")

        if item.get("show_on_map") is True:
            layer = clean(item.get("geoserver_layer"))
            if not layer:
                report.error(where, "show_on_map is true but geoserver_layer is empty")
            elif layer in seen_layers:
                report.error(where, f"geoserver_layer '{layer}' is also used by surface {seen_layers[layer]}")
            else:
                seen_layers[layer] = sid
            if not clean(item.get("geoserver_style")):
                report.error(where, "show_on_map is true but geoserver_style is empty (legend style would be missing)")
            if not map_times(item):
                report.error(where, "show_on_map is true but no map times could be derived")

        thumb = clean(item.get("thumbnail"))
        if thumb and not (THUMBNAIL_DIR / f"{thumb}.png").exists():
            report.warn(where, f"thumbnail '{thumb}.png' not found; the placeholder image will be used")
        if not clean(item.get("Hosted XML file")).startswith("http"):
            report.warn(where, "no hosted metadata XML")

    pages = {clean(i.get("catalogue_page")): clean(i.get("Theme")) for i in raw}
    no_method = [p for p, theme in sorted(pages.items()) if p and methodology_file(p, theme) is None]
    if no_method:
        report.warn("Methodology", f"{len(no_method)} of {len(pages)} datasets have no text in "
                    f"content/methodology/: {', '.join(no_method)}")
    summaries_missing = sum(1 for i in raw if is_placeholder(i.get("Summary")))
    if summaries_missing:
        report.warn("Summary", f"{summaries_missing} of {len(raw)} surfaces have no summary (field is hidden)")
    return report
