"""Check metadata.json for errors and gaps.

Usage:  python scripts/validate_metadata.py [--strict]

Exits with status 1 on errors (or on warnings with --strict).
"""

import sys

from catalogue_lib import load_raw, validate


def main() -> int:
    strict = "--strict" in sys.argv
    report = validate(load_raw())
    for line in report.warnings:
        print(f"warning  {line}")
    for line in report.errors:
        print(f"ERROR    {line}")
    print(f"\n{len(report.errors)} error(s), {len(report.warnings)} warning(s)")
    if report.errors or (strict and report.warnings):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
