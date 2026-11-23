"""Shared helpers: load metadata.json, normalise it and validate it.

metadata.json stays the single source of truth (it is edited by hand or exported
from the metadata spreadsheet). Everything the website reads is derived from it
by scripts/build.py.
"""

from __future__ import annotations

import calendar
import json
import math
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
METADATA_FILE = ROOT / "metadata.json"
TITLES_FILE = ROOT / "content" / "dataset_titles.json"
METHODOLOGY_DIR = ROOT / "content" / "methodology"
PAGES_DIR = ROOT / "catalogue_pages"
THUMBNAIL_DIR = PAGES_DIR / "images" / "thumbnails"
FALLBACK_THUMBNAIL = "not_available"

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
    name = clean(name)
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
        "project": clean(item.get("Project")),
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
        "xml": xml if xml.startswith("http") else None,
        "details": details(item),
        "map": {
            "layer": clean(item.get("geoserver_layer")),
            "style": clean(item.get("geoserver_style")),
            "basemap": clean(item.get("default_basemap")) or None,
            "times": map_times(item),
        } if show_on_map else None,
    }


def build_catalogue(raw: list[dict]) -> dict:
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
                "project": surface["project"],
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
