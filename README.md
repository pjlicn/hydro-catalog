# Hydrological Research Catalog

A curated, searchable guide to hydrological datasets, analytical and modeling methods, research challenges, software
platforms, and reference guides. The site is a dependency-free static application designed for GitHub Pages.

Live site: [Hydrological Research Catalog](https://pjlicn.github.io/hydro-catalog/)

## What the catalog covers

Resources are organized around five research themes:

- Hydrological Modeling
- Statistical & Analytical Methods
- Geospatial Computing
- Machine Learning & Differentiable Modeling
- Hydrometeorological Data & Platforms

The interface provides full-text search, multi-select filters, sorting, shareable URL state, responsive resource cards,
an accessible detail panel, and an interactive relationship network. All filtering and rendering happen in the
browser.

Search matches every space-separated term in any order, ignores case, and treats Unicode dashes like ordinary
hyphens. For example, `forecasting streamflow` and `streamflow forecasting` return the same results. Search includes
resource descriptions, access information, use cases, and limitations.

Expand a filter heading to browse its options. Category and Access have their own option searches; these narrow
the option list without changing your selected filters. Long lists initially show eight options plus all selected
options; use **Show all** to browse the rest. Selected counts appear in group headings. Selections within one group
are combined with OR, while different groups are combined with AND. Active chips let you remove individual filters;
**Clear all filters** also clears option searches and resets sorting.

## Project structure

```text
.
|-- assets/
|   |-- css/styles.css
|   `-- js/
|       |-- app.js
|       |-- network.js
|       |-- references.js
|       `-- theme.js
|-- data/catalog.json
|-- data/references.json
|-- scripts/validate_catalog.py
|-- index.html
|-- network.html
|-- references.html
|-- 404.html
|-- LICENSE
|-- LICENSE-CONTENT.md
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
- `type`: `Dataset`, `Method`, `Benchmark`, `Research Challenge`, `Software / Platform`, or `Reference / Guide`.
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
Legacy type filters for `Observation Product` and `Model` are normalized to `Dataset` and `Method`, respectively.

## Resource network

`network.html` presents the catalog as a dependency-free SVG network. Resource-to-resource candidates must share at
least one research theme and use weighted Jaccard similarity:

```text
0.75 * category Jaccard similarity + 0.25 * theme Jaccard similarity
```

Each resource retains its two highest-scoring candidate relationships; the selected pairs are merged into undirected
edges and ties are resolved deterministically by resource ID. Tags do not contribute to the score. Network links use
`network.html?resource=<id>` to center and highlight a resource, and browser back and forward restore the selected
node.

These edges describe metadata similarity only. They do not imply official integration, technical dependency,
interoperability, endorsement, or causation.

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

## License and permitted use

The original software implementation in this repository—including the authored HTML, CSS, JavaScript, Python
validation code, and original visual assets—is source-available under the
[PolyForm Noncommercial License 1.0.0](./LICENSE).

The original catalog compilation, editorial descriptions, documentation, and other non-software content that the
licensor is authorized to license are available under
[Creative Commons Attribution-NonCommercial 4.0 International](./LICENSE-CONTENT.md).

- Personal study, teaching, experimentation, noncommercial research, and qualifying educational, charitable,
  public-research, environmental-protection, public-health, and government use are permitted as specified by the
  applicable license.
- Commercial deployment, paid services, integration into a commercial product, or work performed for a commercial
  client requires separate written permission from [Peijun Li](https://pjlicn.github.io/cv/).
- This is a source-available project with noncommercial restrictions, not an OSI-approved open-source project.
- Third-party publications, facts, names, trademarks, official documentation, external websites, and linked materials
  are excluded. The licenses grant rights only to material Peijun Li owns or is authorized to license.

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

[https://pjlicn.github.io/hydro-catalog/](https://pjlicn.github.io/hydro-catalog/)

No build step, package manager, backend, authentication, or database is required.
