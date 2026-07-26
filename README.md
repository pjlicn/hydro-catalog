# Hydrological Research Catalog

A curated, searchable guide to hydrological datasets, observation products, models, analytical methods, research
challenges, and software platforms. The site is a dependency-free static application designed for GitHub Pages.

## What the catalog covers

Resources are organized around five research themes:

- Hydrological Modeling
- Statistical & Analytical Methods
- Geospatial Computing
- Machine Learning & Differentiable Modeling
- Hydrometeorological Data & Platforms

The interface provides full-text search, multi-select filters, sorting, shareable URL state, responsive resource cards,
and an accessible detail panel. All filtering and rendering happen in the browser.

## Project structure

```text
.
|-- assets/
|   |-- css/styles.css
|   `-- js/app.js
|-- data/catalog.json
|-- data/references.json
|-- scripts/validate_catalog.py
|-- index.html
|-- references.html
|-- 404.html
`-- README.md
```

## Local preview

The application fetches its JSON data, so it must run through HTTP rather than `file://`.

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`.

## Validate the catalog

The validator uses only the Python standard library:

```bash
python scripts/validate_catalog.py
```

For syntax-only validation:

```bash
python -m json.tool data/catalog.json
```

## Add or edit a resource

Edit `data/catalog.json`. Every entry requires:

- `id`: unique lowercase kebab-case identifier.
- `name`: public resource name.
- `type`: `Dataset`, `Observation Product`, `Model`, `Method`, `Benchmark`, `Research Challenge`, or
  `Software / Platform`.
- `themes`: one or more of the five controlled research themes above.
- `categories`: specific discovery categories.
- `description`: concise plain-language summary.
- `provider`: maintaining organization or research community.
- `access`: access description such as `Open`, `Registration`, `Licensed`, `Mixed`, or `Open literature`.
- `verificationStatus`: `Verified`, `Partially verified`, or `Needs verification`.
- `useCases`, `limitations`, and `tags`: non-empty string arrays.
- `url`: primary official project, documentation, or publication URL.
- `referenceIds`: one or more IDs from `data/references.json`.
- `lastChecked`: the actual source-review date in `YYYY-MM-DD` format.

Spatial and temporal fields may be empty when they do not apply, especially for software and general methods.

## URL state

Search and filter state is encoded in query parameters so a catalog view can be shared:

```text
?q=soil+moisture&type=Dataset&theme=hydrometeorological-data-platforms
```

Resource details use `resource=<id>` and work with browser forward/back navigation.

## Citations and references

Resource details include compact author–year citations after the description and complete AGU-style references at
the end of the panel. Both use the same reference IDs. Citation links open the corresponding entry on
`references.html`.

Citation metadata lives in `data/references.json`:

- `id`: unique lowercase kebab-case identifier used as the page anchor.
- `short`: compact author–year text, such as `Li et al., 2025`.
- `citation`: complete AGU-style reference.
- `url`: publisher page or persistent identifier.

Each catalog resource declares a non-empty `referenceIds` array. Only works cited by at least one resource belong in
the references file. The validation script checks reference IDs, URLs, missing links, and uncited entries.

## Color theme

The catalog supports light and dark themes. A first visit follows the operating-system preference; using the header
toggle stores an explicit choice in `localStorage` under `hydro-catalog-theme` and applies it across catalog pages.
Theme colors are defined as custom properties in `assets/css/styles.css`.

## Editorial policy

- Prefer official project pages, official documentation, data-provider pages, and primary literature.
- Never infer DOI values, licensing, coverage, resolution, access conditions, or verification dates.
- Use `Partially verified` when the resource identity and core description are sourced but important metadata remains
  uncertain.
- Use `Needs verification` for draft records that have not received source review.
- Keep limitations and appropriate use cases alongside descriptive metadata.
- Run the validator after every catalog change.

## GitHub Pages

The site uses relative paths and includes `.nojekyll`, so it works as a project site under:

```text
https://pjlicn.github.io/hydro-catalog/
```

No build step, package manager, backend, authentication, or database is required.
