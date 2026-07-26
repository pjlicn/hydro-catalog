#!/usr/bin/env python3
"""Validate the Hydrological Research Catalog without third-party packages."""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "catalog.json"
REFERENCES_PATH = ROOT / "data" / "references.json"

ALLOWED_TYPES = {
    "Dataset",
    "Observation Product",
    "Model",
    "Method",
    "Benchmark",
    "Research Challenge",
    "Software / Platform",
}
ALLOWED_THEMES = {
    "Hydrological Modeling",
    "Statistical & Analytical Methods",
    "Geospatial Computing",
    "Machine Learning & Differentiable Modeling",
    "Hydrometeorological Data & Platforms",
}
ALLOWED_STATUSES = {"Verified", "Partially verified", "Needs verification"}
REQUIRED_TEXT_FIELDS = {
    "id",
    "name",
    "type",
    "description",
    "provider",
    "access",
    "verificationStatus",
}
REQUIRED_LIST_FIELDS = {"themes", "categories", "useCases", "limitations", "tags", "referenceIds"}
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def is_web_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def validate() -> list[str]:
    errors: list[str] = []
    try:
        payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"Could not read valid JSON from {CATALOG_PATH}: {exc}"]

    if not isinstance(payload, list):
        return ["The catalog root must be a JSON array."]

    seen_ids: set[str] = set()
    used_reference_ids: set[str] = set()
    for index, item in enumerate(payload):
        label = f"item {index + 1}"
        if not isinstance(item, dict):
            errors.append(f"{label}: must be an object.")
            continue

        item_id = item.get("id")
        if isinstance(item_id, str) and item_id:
            label = item_id
            if item_id in seen_ids:
                errors.append(f"{label}: duplicate id.")
            seen_ids.add(item_id)
            if not ID_PATTERN.fullmatch(item_id):
                errors.append(f"{label}: id must use lowercase kebab-case.")

        for field in REQUIRED_TEXT_FIELDS:
            value = item.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{label}: {field} must be a non-empty string.")

        for field in REQUIRED_LIST_FIELDS:
            value = item.get(field)
            if not isinstance(value, list) or not value:
                errors.append(f"{label}: {field} must be a non-empty array.")
            elif not all(isinstance(entry, str) and entry.strip() for entry in value):
                errors.append(f"{label}: {field} may only contain non-empty strings.")

        if item.get("type") not in ALLOWED_TYPES:
            errors.append(f"{label}: unsupported type {item.get('type')!r}.")

        themes = item.get("themes", [])
        if isinstance(themes, list):
            unknown_themes = set(themes) - ALLOWED_THEMES
            if unknown_themes:
                errors.append(f"{label}: unsupported themes {sorted(unknown_themes)!r}.")

        if item.get("verificationStatus") not in ALLOWED_STATUSES:
            errors.append(f"{label}: unsupported verificationStatus.")

        url = item.get("url", "")
        if url and (not isinstance(url, str) or not is_web_url(url)):
            errors.append(f"{label}: url must be an absolute HTTP(S) URL.")

        checked = item.get("lastChecked", "")
        if checked:
            try:
                date.fromisoformat(checked)
            except (TypeError, ValueError):
                errors.append(f"{label}: lastChecked must use YYYY-MM-DD.")

        reference_ids = item.get("referenceIds", [])
        if isinstance(reference_ids, list):
            used_reference_ids.update(
                reference_id for reference_id in reference_ids if isinstance(reference_id, str)
            )

    try:
        references = json.loads(REFERENCES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return errors + [f"Could not read valid JSON from {REFERENCES_PATH}: {exc}"]

    if not isinstance(references, list):
        return errors + ["The references root must be a JSON array."]

    seen_reference_ids: set[str] = set()
    for index, reference in enumerate(references):
        label = f"reference {index + 1}"
        if not isinstance(reference, dict):
            errors.append(f"{label}: must be an object.")
            continue

        reference_id = reference.get("id")
        if isinstance(reference_id, str) and reference_id:
            label = reference_id
            if reference_id in seen_reference_ids:
                errors.append(f"{label}: duplicate reference id.")
            seen_reference_ids.add(reference_id)
            if not ID_PATTERN.fullmatch(reference_id):
                errors.append(f"{label}: reference id must use lowercase kebab-case.")

        for field in {"id", "short", "citation", "url"}:
            value = reference.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{label}: {field} must be a non-empty string.")

        url = reference.get("url", "")
        if url and (not isinstance(url, str) or not is_web_url(url)):
            errors.append(f"{label}: url must be an absolute HTTP(S) URL.")

    unknown_reference_ids = used_reference_ids - seen_reference_ids
    if unknown_reference_ids:
        errors.append(f"Catalog contains unknown referenceIds {sorted(unknown_reference_ids)!r}.")

    uncited_reference_ids = seen_reference_ids - used_reference_ids
    if uncited_reference_ids:
        errors.append(f"References contains uncited works {sorted(uncited_reference_ids)!r}.")

    return errors


def main() -> int:
    errors = validate()
    if errors:
        print(f"Catalog validation failed with {len(errors)} error(s):", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    references = json.loads(REFERENCES_PATH.read_text(encoding="utf-8"))
    print(f"Catalog validation passed: {len(payload)} resources and {len(references)} cited works.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
