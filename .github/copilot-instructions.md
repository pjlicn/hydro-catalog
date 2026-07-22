# Repository Copilot Instructions

This repository contains a static, data-driven GitHub Pages project site for a hydrological research catalog.

## Architecture

* Use semantic HTML, CSS, vanilla JavaScript, and JSON.
* Do not introduce a frontend framework, backend, database, package manager, or build system unless explicitly requested.
* Catalog content belongs in `data/catalog.json`.
* Presentation and application logic must remain separate from catalog data.
* The deployed site is a GitHub Pages project site under `/hydro-catalog/`.
* Always use paths that work under a repository subpath. Prefer relative URLs and never assume deployment at the domain root.

## Scientific content

* Do not invent scientific references, DOIs, URLs, spatial coverage, temporal resolution, licensing terms, or access conditions.
* Preserve uncertainty explicitly with empty values or `Needs verification`.
* Distinguish datasets, observation products, models, methods, benchmarks, and research challenges.
* Treat limitations and appropriate use cases as first-class catalog information.
* Update `lastChecked` only when the linked information has actually been verified.

## Frontend quality

* Keep the interface responsive, accessible, and keyboard usable.
* Use semantic HTML and visible focus states.
* Avoid unsafe insertion of JSON content through unescaped `innerHTML`.
* Handle missing optional fields gracefully.
* Avoid excessive animation and decorative effects.
* Keep the visual style professional and suitable for a scientific audience.
* Do not add dependencies solely for minor visual effects.

## Change discipline

* Keep changes focused on the requested task.
* Do not commit, push, publish, or alter repository settings unless explicitly requested.
* Update the README when structure, setup, data fields, or deployment behavior changes.
* Validate JSON after catalog edits with:
  `python -m json.tool data/catalog.json`
* When changing URLs or deployment paths, verify behavior under `/hydro-catalog/`.
* Summarize changed files and any unverified scientific content after completing a task.
