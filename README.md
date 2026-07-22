# Hydrological Research Catalog (MVP)

A static GitHub Pages project site for curating hydrological datasets, observation products, models, methods, benchmarks, and research challenges.

Editorial note: this MVP includes starter entries marked for verification. Treat technical metadata as draft until reviewed by domain editors.

## Project Purpose

The Hydrological Research Catalog provides a searchable, filterable index of hydrology resources for researchers, students, and practitioners. The MVP focuses on transparent curation with minimal dependencies and straightforward maintenance.

## Directory Structure

```
.
|-- .github/
|   `-- copilot-instructions.md
|-- .nojekyll
|-- 404.html
|-- assets/
|   |-- css/
|   |   `-- styles.css
|   `-- js/
|       `-- app.js
|-- data/
|   `-- catalog.json
|-- index.html
`-- README.md
```

## Local Preview

Use a local HTTP server (required because the app fetches JSON):

```bash
python -m http.server 8000
```

Then open:

```
http://localhost:8000/
```

Do not rely on opening `index.html` via `file://` because browsers block fetch access in many local file contexts.

## Add or Edit a Catalog Entry

1. Open `data/catalog.json`.
2. Add or edit an object in the top-level array.
3. Keep the `id` unique.
4. Use one of the allowed `type` values:
	- Dataset
	- Observation Product
	- Model
	- Method
	- Benchmark
	- Research Challenge
5. Leave unknown values as empty strings/arrays or set to `Needs verification`.
6. Save and refresh the page.

## JSON Field Definitions

Each resource item supports:

- `id`: stable unique identifier string.
- `name`: display name.
- `type`: one of the supported top-level resource types.
- `categories`: list of thematic categories.
- `description`: short plain-language summary.
- `spatialCoverage`: geographic scope.
- `temporalResolution`: time-step/frequency.
- `spatialResolution`: grid or station resolution.
- `access`: access status (for example, Open, Registration, Mixed).
- `useCases`: list of common uses.
- `limitations`: list of known caveats.
- `tags`: list of keywords for discovery.
- `url`: primary external resource URL.
- `reference`: citation text, DOI text, or verification note.
- `lastChecked`: ISO-like date string (`YYYY-MM-DD`) or `Needs verification`.

Optional fields may be empty or omitted. The UI is designed to handle missing values safely.

## JSON Validation Command

```bash
python -m json.tool data/catalog.json
```

## GitHub Pages Deployment

This repository is intended as a project site at:

```
https://pjlicn.github.io/hydro-catalog/
```

Deployment checklist:

1. Confirm all asset/data links are relative (for example `./assets/...`, `./data/...`).
2. Ensure `.nojekyll` exists in repository root.
3. In GitHub repository settings, enable Pages from the default branch and root folder.
4. After publishing, verify the site loads under `/hydro-catalog/`.

## Editorial Verification Policy

- Starter entries are seed records and are not final authoritative metadata.
- Never invent references, DOI values, URLs, or technical specifications.
- If uncertain, use an empty value or `Needs verification`.
- Run periodic metadata checks and update `lastChecked` only after verification.

## Known MVP Limitations

- No backend, authentication, or database.
- No advanced faceted analytics beyond client-side filtering/sorting.
- No pagination yet; very large catalogs may require performance tuning.
- Starter content requires human editorial review before production-grade use.
