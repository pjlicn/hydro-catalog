(function () {
  "use strict";

  const DATA_PATH = "./data/catalog.json";
  const ALLOWED_TYPES = [
    "Dataset",
    "Observation Product",
    "Model",
    "Method",
    "Benchmark",
    "Research Challenge"
  ];

  const state = {
    items: [],
    filtered: [],
    query: "",
    type: "",
    category: "",
    access: "",
    sort: "name"
  };

  const els = {
    searchInput: document.getElementById("search-input"),
    typeFilter: document.getElementById("type-filter"),
    categoryFilter: document.getElementById("category-filter"),
    accessFilter: document.getElementById("access-filter"),
    sortSelect: document.getElementById("sort-select"),
    clearFilters: document.getElementById("clear-filters"),
    catalogGrid: document.getElementById("catalog-grid"),
    resultCount: document.getElementById("result-count"),
    resultsSummary: document.getElementById("results-summary"),
    typeStats: document.getElementById("type-stats"),
    emptyState: document.getElementById("empty-state"),
    errorState: document.getElementById("error-state")
  };

  function asText(value, fallback) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : fallback;
    }
    return fallback;
  }

  function asArray(value) {
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean);
    }
    return [];
  }

  function normalizeItem(raw, index) {
    const type = asText(raw.type, "Needs verification");
    const safeType = ALLOWED_TYPES.includes(type) ? type : "Needs verification";
    return {
      id: asText(raw.id, `item-${index + 1}`),
      name: asText(raw.name, "Unnamed resource"),
      type: safeType,
      categories: asArray(raw.categories),
      description: asText(raw.description, "Needs verification"),
      spatialCoverage: asText(raw.spatialCoverage, ""),
      temporalResolution: asText(raw.temporalResolution, ""),
      spatialResolution: asText(raw.spatialResolution, ""),
      access: asText(raw.access, "Needs verification"),
      useCases: asArray(raw.useCases),
      limitations: asArray(raw.limitations),
      tags: asArray(raw.tags),
      url: asText(raw.url, ""),
      reference: asText(raw.reference, "Needs verification"),
      lastChecked: asText(raw.lastChecked, "Needs verification")
    };
  }

  function parseDateForSort(value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  }

  function collectSearchText(item) {
    const pieces = [
      item.name,
      item.type,
      item.description,
      item.spatialCoverage,
      ...item.categories,
      ...item.tags,
      ...item.useCases
    ];
    return pieces.join(" ").toLowerCase();
  }

  function updateFilterOptions() {
    const categories = new Set();
    const accessValues = new Set();
    const typeValues = new Set();

    state.items.forEach((item) => {
      typeValues.add(item.type);
      item.categories.forEach((c) => categories.add(c));
      if (item.access) {
        accessValues.add(item.access);
      }
    });

    fillSelect(els.typeFilter, Array.from(typeValues).sort());
    fillSelect(els.categoryFilter, Array.from(categories).sort());
    fillSelect(els.accessFilter, Array.from(accessValues).sort());
  }

  function fillSelect(selectEl, values) {
    const firstOption = selectEl.options[0];
    while (selectEl.options.length > 1) {
      selectEl.remove(1);
    }
    values.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      selectEl.appendChild(opt);
    });
    if (firstOption) {
      firstOption.selected = selectEl.value === "";
    }
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();

    state.filtered = state.items.filter((item) => {
      if (q && !collectSearchText(item).includes(q)) {
        return false;
      }
      if (state.type && item.type !== state.type) {
        return false;
      }
      if (state.category && !item.categories.includes(state.category)) {
        return false;
      }
      if (state.access && item.access !== state.access) {
        return false;
      }
      return true;
    });

    sortItems(state.filtered, state.sort);
    renderAll();
  }

  function sortItems(items, sortType) {
    items.sort((a, b) => {
      if (sortType === "type") {
        return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      }
      if (sortType === "recent") {
        const diff = parseDateForSort(b.lastChecked) - parseDateForSort(a.lastChecked);
        return diff || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }

  function renderAll() {
    renderStats();
    renderResultCount();
    renderCards();
  }

  function renderStats() {
    const countMap = new Map();
    ALLOWED_TYPES.forEach((type) => countMap.set(type, 0));

    state.filtered.forEach((item) => {
      if (!countMap.has(item.type)) {
        countMap.set(item.type, 0);
      }
      countMap.set(item.type, countMap.get(item.type) + 1);
    });

    els.resultsSummary.textContent = `Resources shown: ${state.filtered.length} of ${state.items.length}`;
    els.typeStats.textContent = "";

    countMap.forEach((count, type) => {
      const li = document.createElement("li");
      li.textContent = `${type}: ${count}`;
      els.typeStats.appendChild(li);
    });
  }

  function renderResultCount() {
    const count = state.filtered.length;
    els.resultCount.textContent = count === 1 ? "1 resource" : `${count} resources`;
  }

  function renderCards() {
    els.catalogGrid.textContent = "";

    if (state.filtered.length === 0) {
      els.emptyState.hidden = false;
      return;
    }

    els.emptyState.hidden = true;
    const frag = document.createDocumentFragment();
    state.filtered.forEach((item) => {
      frag.appendChild(buildCard(item));
    });
    els.catalogGrid.appendChild(frag);
  }

  function appendMeta(list, label, value) {
    if (!value) {
      return;
    }
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "meta-label";
    span.textContent = `${label}: `;
    li.appendChild(span);
    li.append(document.createTextNode(value));
    list.appendChild(li);
  }

  function appendDetailList(parent, title, values) {
    const block = document.createElement("div");
    block.className = "detail-block";
    const heading = document.createElement("h4");
    heading.textContent = title;
    block.appendChild(heading);

    if (!values.length) {
      const p = document.createElement("p");
      p.textContent = "Needs verification";
      block.appendChild(p);
    } else {
      const ul = document.createElement("ul");
      values.forEach((v) => {
        const li = document.createElement("li");
        li.textContent = v;
        ul.appendChild(li);
      });
      block.appendChild(ul);
    }
    parent.appendChild(block);
  }

  function buildCard(item) {
    const article = document.createElement("article");
    article.className = "catalog-card";
    article.setAttribute("aria-labelledby", `${item.id}-title`);

    const cardHead = document.createElement("div");
    cardHead.className = "card-head";

    const title = document.createElement("h3");
    title.id = `${item.id}-title`;
    title.textContent = item.name;
    cardHead.appendChild(title);

    const typeBadge = document.createElement("span");
    typeBadge.className = "resource-type";
    typeBadge.textContent = item.type;
    cardHead.appendChild(typeBadge);
    article.appendChild(cardHead);

    const desc = document.createElement("p");
    desc.className = "description";
    desc.textContent = item.description;
    article.appendChild(desc);

    const tags = document.createElement("ul");
    tags.className = "tag-list";
    const chosenTags = item.tags.length ? item.tags.slice(0, 6) : ["Needs verification"];
    chosenTags.forEach((tag) => {
      const li = document.createElement("li");
      li.textContent = tag;
      tags.appendChild(li);
    });
    article.appendChild(tags);

    const meta = document.createElement("ul");
    meta.className = "meta-list";
    appendMeta(meta, "Spatial coverage", item.spatialCoverage || "Needs verification");
    appendMeta(meta, "Temporal resolution", item.temporalResolution || "Needs verification");
    appendMeta(meta, "Access", item.access || "Needs verification");
    appendMeta(meta, "Last checked", item.lastChecked || "Needs verification");
    article.appendChild(meta);

    if (item.url) {
      const link = document.createElement("a");
      link.className = "card-link";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `Open external resource: ${item.name}`;
      article.appendChild(link);
    } else {
      const noLink = document.createElement("p");
      noLink.className = "detail-block";
      noLink.textContent = "External resource link: Needs verification";
      article.appendChild(noLink);
    }

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Use cases, limitations, and reference";
    details.appendChild(summary);

    appendDetailList(details, "Use cases", item.useCases);
    appendDetailList(details, "Limitations", item.limitations);

    const reference = document.createElement("div");
    reference.className = "detail-block";
    const refHeading = document.createElement("h4");
    refHeading.textContent = "Reference";
    const refText = document.createElement("p");
    refText.textContent = item.reference || "Needs verification";
    reference.appendChild(refHeading);
    reference.appendChild(refText);
    details.appendChild(reference);

    article.appendChild(details);
    return article;
  }

  function setError(message) {
    els.errorState.hidden = false;
    els.errorState.textContent = message;
  }

  function clearError() {
    els.errorState.hidden = true;
    els.errorState.textContent = "";
  }

  function wireEvents() {
    els.searchInput.addEventListener("input", () => {
      state.query = els.searchInput.value;
      applyFilters();
    });

    els.typeFilter.addEventListener("change", () => {
      state.type = els.typeFilter.value;
      applyFilters();
    });

    els.categoryFilter.addEventListener("change", () => {
      state.category = els.categoryFilter.value;
      applyFilters();
    });

    els.accessFilter.addEventListener("change", () => {
      state.access = els.accessFilter.value;
      applyFilters();
    });

    els.sortSelect.addEventListener("change", () => {
      state.sort = els.sortSelect.value;
      applyFilters();
    });

    els.clearFilters.addEventListener("click", () => {
      els.searchInput.value = "";
      els.typeFilter.value = "";
      els.categoryFilter.value = "";
      els.accessFilter.value = "";
      els.sortSelect.value = "name";

      state.query = "";
      state.type = "";
      state.category = "";
      state.access = "";
      state.sort = "name";
      applyFilters();
      els.searchInput.focus();
    });
  }

  async function init() {
    wireEvents();

    try {
      clearError();
      const response = await fetch(DATA_PATH, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Catalog file could not be loaded (${response.status}).`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Catalog data must be a JSON array.");
      }

      state.items = payload.map(normalizeItem);
      updateFilterOptions();
      applyFilters();
    } catch (error) {
      setError(
        "Unable to load catalog data. Start a local web server (for example: python -m http.server 8000) and reload."
      );
      els.resultsSummary.textContent = "Catalog unavailable";
      els.resultCount.textContent = "0 resources";
      els.typeStats.textContent = "";
      els.catalogGrid.textContent = "";
      els.emptyState.hidden = true;
      console.error(error);
    }
  }

  init();
})();
