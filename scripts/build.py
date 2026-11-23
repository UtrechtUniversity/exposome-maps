"""Build the website data and the static dataset pages from metadata.json.

Usage:  python scripts/build.py [--check]

  1. validates metadata.json (stops on errors)
  2. writes data/catalogue.json   (what the map and catalogue views read)
  3. writes catalogue_pages/<catalogue_page>.html for every dataset

--check   build in memory and exit 1 if any output file is out of date
          (used in CI to catch "forgot to run the build").
"""

from __future__ import annotations

import json
import sys

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

from catalogue_lib import (
    PAGES_DIR, ROOT, build_catalogue, load_raw, methodology_file, validate,
)

CATALOGUE_JSON = ROOT / "data" / "catalogue.json"
TEMPLATES_DIR = ROOT / "templates"

SITE = {
    "name": "Exposome Maps",
    "request_form": "https://utrechtuniversity.github.io/Exposome-Map-Documents/Data_request_form/",
    "policy": "https://utrechtuniversity.github.io/Exposome-Map-Documents/Data_Access_and_Publication_Policy/",
    "contact": "expanse@uu.nl",
}


def render_pages(catalogue: dict, raw: list[dict]) -> dict:
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "j2"]),
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )
    template = env.get_template("dataset.html.j2")
    surfaces_by_id = {s["id"]: s for s in catalogue["surfaces"]}

    outputs = {}
    for dataset in catalogue["datasets"]:
        surfaces = [surfaces_by_id[sid] for sid in dataset["surfaces"]]
        method_path = methodology_file(dataset["page"], dataset["theme"])
        methodology = Markup(method_path.read_text(encoding="utf-8")) if method_path else None
        html = template.render(
            site=SITE,
            dataset=dataset,
            surfaces=surfaces,
            details=surfaces[0]["details"],
            methodology=methodology,
        )
        outputs[PAGES_DIR / f"{dataset['page']}.html"] = html
    return outputs


def main() -> int:
    check = "--check" in sys.argv
    raw = load_raw()

    report = validate(raw)
    if report.errors:
        for line in report.errors:
            print(f"ERROR    {line}")
        print("\nBuild stopped: fix the errors above (python scripts/validate_metadata.py for details).")
        return 1

    catalogue = build_catalogue(raw)
    outputs = {CATALOGUE_JSON: json.dumps(catalogue, ensure_ascii=False, indent=1) + "\n"}
    outputs.update(render_pages(catalogue, raw))

    stale = []
    for path, content in outputs.items():
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == content:
            continue
        stale.append(path)
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")

    generated = {p.name for p in outputs if p.parent == PAGES_DIR}
    orphans = sorted(p.name for p in PAGES_DIR.glob("*.html") if p.name not in generated)

    rel = lambda p: p.relative_to(ROOT).as_posix()  # noqa: E731
    if check:
        if stale:
            print("Out of date (run python scripts/build.py):")
            print("\n".join(f"  {rel(p)}" for p in stale))
            return 1
        print("All generated files are up to date.")
    else:
        print(f"Wrote {len(stale)} file(s), {len(outputs) - len(stale)} unchanged.")
    if orphans:
        print("Pages without a dataset in metadata.json (delete if no longer needed):")
        print("\n".join(f"  catalogue_pages/{name}" for name in orphans))
    if report.warnings:
        print(f"{len(report.warnings)} metadata warning(s): run python scripts/validate_metadata.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
