(function () {
  "use strict";

  const DATA_PATH = "./data/catalog.json";
  const REFERENCES_PATH = "./data/references.json";
  const MOBILE_QUERY = window.matchMedia("(max-width: 760px)");
  const filterViews = new Map();
  const isolatedElements = new Map();
  let lastFocusTarget = null;
  const ALLOWED_TYPES = [
    "Dataset",
    "Method",
    "Benchmark",
    "Research Challenge",
    "Software / Platform",
    "Reference / Guide"
  ];
  const LEGACY_TYPE_ALIASES = new Map([
    ["Observation Product", "Dataset"],
    ["Model", "Method"]
  ]);
  const THEMES = [
    {
      name: "Hydrological Modeling",
      slug: "hydrological-modeling",
      icon: "≈",
      description: "Process-based, conceptual, and routing models"
    },
    {
      name: "Statistical & Analytical Methods",
      slug: "statistical-analytical-methods",
      icon: "∿",
      description: "Time-series, dimensionality, and inference methods"
    },
    {
      name: "Geospatial Computing",
      slug: "geospatial-computing",
      icon: "⌖",
      description: "Desktop, cloud, and library-based spatial tools"
    },
    {
      name: "Machine Learning & Differentiable Modeling",
      slug: "machine-learning-differentiable-modeling",
      icon: "δ",
      description: "Learning systems that connect data and physics"
    },
    {
      name: "Hydrometeorological Data & Platforms",
      slug: "hydrometeorological-data-platforms",
      icon: "◉",
      description: "In situ, satellite, gridded, and archive products"
    }
  ];
  const FILTER_CONFIG = [
    { key: "types", param: "type", label: "Resource type", itemKey: "type" },
    { key: "themes", param: "theme", label: "Research theme", itemKey: "themes" },
    { key: "categories", param: "category", label: "Category", itemKey: "categories" },
    { key: "access", param: "access", label: "Access", itemKey: "access" },
    { key: "statuses", param: "status", label: "Verification", itemKey: "verificationStatus" }
  ];

  const state = {
    items: [],
    references: new Map(),
    filtered: [],
    query: "",
    types: [],
    themes: [],
    categories: [],
    access: [],
    statuses: [],
    sort: "name",
    resource: "",
    lastFocused: null
  };

  const els = {
    heroForm: document.getElementById("hero-search-form"),
    heroSearch: document.getElementById("hero-search"),
    catalogSearch: document.getElementById("catalog-search"),
    filterGroups: document.getElementById("filter-groups"),
    clearFilters: document.getElementById("clear-filters"),
    activeFilters: document.getElementById("active-filters"),
    sortSelect: document.getElementById("sort-select"),
    catalogGrid: document.getElementById("catalog-grid"),
    resultCount: document.getElementById("result-count"),
    emptyState: document.getElementById("empty-state"),
    errorState: document.getElementById("error-state"),
    themeGrid: document.getElementById("theme-grid"),
    mobileFilterButton: document.getElementById("mobile-filter-button"),
    mobileFilterCount: document.getElementById("mobile-filter-count"),
    mobileFilterClose: document.getElementById("mobile-filter-close"),
    filterPanel: document.getElementById("filter-panel"),
    filterBackdrop: document.getElementById("filter-backdrop"),
    detailPanel: document.getElementById("detail-panel"),
    detailBackdrop: document.getElementById("detail-backdrop"),
    detailClose: document.getElementById("detail-close"),
    detailContent: document.getElementById("detail-content"),
    stats: {
      resources: document.getElementById("stat-resources"),
      types: document.getElementById("stat-types"),
      verified: document.getElementById("stat-verified")
    }
  };

  function text(value, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function list(value) {
    return Array.isArray(value)
      ? value.map((entry) => text(entry)).filter(Boolean)
      : [];
  }

  function normalizeItem(raw, index) {
    const candidateType = text(raw.type, "Needs verification");
    return {
      id: text(raw.id, `resource-${index + 1}`),
      name: text(raw.name, "Unnamed resource"),
      type: ALLOWED_TYPES.includes(candidateType) ? candidateType : "Needs verification",
      themes: list(raw.themes),
      categories: list(raw.categories),
      description: text(raw.description, "Description needs verification."),
      provider: text(raw.provider),
      spatialCoverage: text(raw.spatialCoverage),
      temporalResolution: text(raw.temporalResolution),
      spatialResolution: text(raw.spatialResolution),
      access: text(raw.access, "Needs verification"),
      verificationStatus: text(raw.verificationStatus, "Needs verification"),
      useCases: list(raw.useCases),
      limitations: list(raw.limitations),
      tags: list(raw.tags),
      url: text(raw.url),
      referenceIds: list(raw.referenceIds),
      lastChecked: text(raw.lastChecked)
    };
  }

  function normalizeReference(raw) {
    return {
      id: text(raw.id),
      short: text(raw.short),
      citation: text(raw.citation),
      url: text(raw.url)
    };
  }

  function referencesForResource(item) {
    return item.referenceIds
      .map((id) => state.references.get(id))
      .filter(Boolean)
      .sort((a, b) => a.citation.localeCompare(b.citation));
  }

  function slugForTheme(theme) {
    const match = THEMES.find((entry) => entry.name === theme);
    return match ? match.slug : theme.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function themeForSlug(slug) {
    const match = THEMES.find((entry) => entry.slug === slug);
    return match ? match.name : "";
  }

  function uniqueValues(itemKey) {
    const values = new Set();
    state.items.forEach((item) => {
      const value = item[itemKey];
      if (Array.isArray(value)) {
        value.forEach((entry) => values.add(entry));
      } else if (value) {
        values.add(value);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  function countValue(itemKey, value) {
    return state.items.filter((item) => {
      const candidate = item[itemKey];
      return Array.isArray(candidate) ? candidate.includes(value) : candidate === value;
    }).length;
  }

  function renderThemes() {
    els.themeGrid.textContent = "";
    THEMES.forEach((theme) => {
      const count = countValue("themes", theme.name);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "theme-card";
      button.dataset.theme = theme.name;

      const icon = document.createElement("span");
      icon.className = "theme-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = theme.icon;

      const title = document.createElement("strong");
      title.textContent = theme.name;
      const description = document.createElement("span");
      description.textContent = theme.description;
      const total = document.createElement("small");
      total.textContent = `${count} ${count === 1 ? "resource" : "resources"} →`;

      button.append(icon, title, description, total);
      button.addEventListener("click", () => {
        state.themes = [theme.name];
        syncControls();
        applyFilters({ scroll: true });
      });
      els.themeGrid.appendChild(button);
    });
  }

  function renderFilterGroups() {
    els.filterGroups.textContent = "";
    FILTER_CONFIG.forEach((config) => {
      const values = config.key === "themes"
        ? THEMES.map((theme) => theme.name).filter((value) => countValue(config.itemKey, value))
        : uniqueValues(config.itemKey);
      if (!values.length) return;

      const group = document.createElement("details");
      group.className = "filter-group";
      group.dataset.filterGroup = config.key;
      group.open = ["types", "themes"].includes(config.key);
      const summary = document.createElement("summary");
      const heading = document.createElement("span");
      summary.appendChild(heading);
      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.className = "sr-only";
      legend.textContent = config.label;
      fieldset.appendChild(legend);
      const view = { config, group, heading, options: [], query: "", expanded: false };
      filterViews.set(config.key, view);

      if (["categories", "access"].includes(config.key)) {
        const searchLabel = document.createElement("label");
        searchLabel.className = "option-search";
        searchLabel.textContent = `Find ${config.key === "categories" ? "categories" : "access options"}`;
        const search = document.createElement("input");
        search.type = "search";
        search.autocomplete = "off";
        search.addEventListener("input", () => {
          view.query = normalizeSearch(search.value);
          updateFilterView(view);
        });
        view.search = search;
        searchLabel.appendChild(search);
        fieldset.appendChild(searchLabel);
      }

      values.forEach((value) => {
        const label = document.createElement("label");
        label.className = "filter-option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = value;
        checkbox.dataset.filterKey = config.key;
        checkbox.addEventListener("change", handleFilterChange);
        const name = document.createElement("span");
        name.textContent = value;
        const count = document.createElement("span");
        count.textContent = countValue(config.itemKey, value);
        label.append(checkbox, name, count);
        fieldset.appendChild(label);
        view.options.push({ value, label, checkbox });
      });
      const empty = document.createElement("p");
      empty.className = "filter-options-empty";
      empty.textContent = "No matching options. Selected options remain visible.";
      empty.setAttribute("role", "status");
      view.empty = empty;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "filter-options-toggle";
      toggle.addEventListener("click", () => {
        view.expanded = !view.expanded;
        updateFilterView(view);
        if (toggle.hidden) summary.focus();
      });
      view.toggle = toggle;
      fieldset.append(empty, toggle);
      group.append(summary, fieldset);
      els.filterGroups.appendChild(group);
      updateFilterView(view);
    });
  }

  function updateFilterView(view, expandSelected = false) {
    const selected = state[view.config.key];
    view.heading.textContent = `${view.config.label}${selected.length ? ` (${selected.length} selected)` : ""}`;
    if (expandSelected && selected.length) view.group.open = true;
    const matches = view.options.filter((option) => normalizeSearch(option.value).includes(view.query));
    const visible = new Set((view.expanded ? matches : matches.slice(0, 8)).map((option) => option.value));
    view.options.forEach(({ value, label, checkbox }) => {
      checkbox.checked = selected.includes(value);
      label.hidden = !visible.has(value) && !checkbox.checked;
    });
    view.empty.hidden = matches.length !== 0;
    view.toggle.hidden = matches.length <= 8;
    view.toggle.textContent = view.expanded ? "Show fewer" : `Show all (${matches.length})`;
    view.toggle.setAttribute("aria-expanded", String(view.expanded));
  }

  function handleFilterChange(event) {
    const key = event.target.dataset.filterKey;
    const selected = Array.from(els.filterGroups.querySelectorAll(`input[data-filter-key="${key}"]:checked`))
      .map((input) => input.value);
    state[key] = selected;
    applyFilters();
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || "";
    FILTER_CONFIG.forEach((config) => {
      const values = params.getAll(config.param);
      if (config.key === "themes") {
        state[config.key] = values.map(themeForSlug).filter(Boolean);
      } else if (config.key === "types") {
        state[config.key] = Array.from(new Set(
          values.map((value) => LEGACY_TYPE_ALIASES.get(value) || value)
        ));
      } else {
        state[config.key] = values;
      }
    });
    state.sort = ["name", "type", "recent"].includes(params.get("sort")) ? params.get("sort") : "name";
    state.resource = params.get("resource") || "";
  }

  function writeUrlState(mode = "replace") {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    FILTER_CONFIG.forEach((config) => {
      state[config.key].forEach((value) => {
        params.append(config.param, config.key === "themes" ? slugForTheme(value) : value);
      });
    });
    if (state.sort !== "name") params.set("sort", state.sort);
    if (state.resource) params.set("resource", state.resource);
    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash || ""}`;
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", nextUrl);
  }

  function syncControls() {
    els.heroSearch.value = state.query;
    els.catalogSearch.value = state.query;
    els.sortSelect.value = state.sort;
    els.filterGroups.querySelectorAll("input[data-filter-key]").forEach((input) => {
      input.checked = state[input.dataset.filterKey].includes(input.value);
    });
    filterViews.forEach((view) => updateFilterView(view, true));
  }

  function normalizeSearch(value) {
    return value.normalize("NFKC").toLowerCase().replace(/[\u2010-\u2015\u2212]/g, "-").trim();
  }

  function itemSearchText(item) {
    return normalizeSearch([
      item.name,
      item.type,
      item.description,
      item.provider,
      item.spatialCoverage,
      item.access,
      ...item.themes,
      ...item.categories,
      ...item.tags,
      ...item.useCases,
      ...item.limitations
    ].join(" "));
  }

  function matchesSelected(itemValue, selected) {
    if (!selected.length) return true;
    return Array.isArray(itemValue)
      ? selected.some((value) => itemValue.includes(value))
      : selected.includes(itemValue);
  }

  function applyFilters(options = {}) {
    const terms = normalizeSearch(state.query).split(/\s+/).filter(Boolean);
    state.filtered = state.items.filter((item) => {
      const searchable = itemSearchText(item);
      if (!terms.every((term) => searchable.includes(term))) return false;
      return FILTER_CONFIG.every((config) => matchesSelected(item[config.itemKey], state[config.key]));
    });

    state.filtered.sort((a, b) => {
      if (state.sort === "type") return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      if (state.sort === "recent") {
        const aDate = Date.parse(a.lastChecked) || Number.NEGATIVE_INFINITY;
        const bDate = Date.parse(b.lastChecked) || Number.NEGATIVE_INFINITY;
        return bDate - aDate || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

    renderResults();
    renderActiveFilters();
    filterViews.forEach((view) => updateFilterView(view));
    writeUrlState();
    if (options.scroll) {
      document.getElementById("catalog").scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    }
  }

  function statusClass(status) {
    if (status === "Verified") return "verified";
    if (status === "Needs verification") return "needs-verification";
    return "";
  }

  function createBadge(label, className) {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = label;
    return badge;
  }

  function renderResults() {
    els.catalogGrid.textContent = "";
    els.emptyState.hidden = state.filtered.length !== 0;
    const resultTotal = document.createElement("strong");
    resultTotal.textContent = state.filtered.length;
    els.resultCount.textContent = "";
    els.resultCount.append(
      resultTotal,
      document.createTextNode(` ${state.filtered.length === 1 ? "resource" : "resources"} found`)
    );
    if (!state.filtered.length) return;

    const fragment = document.createDocumentFragment();
    state.filtered.forEach((item) => {
      const card = document.createElement("article");
      card.className = "resource-card";
      card.dataset.resourceId = item.id;

      const top = document.createElement("div");
      top.className = "card-top";
      const title = document.createElement("h3");
      title.textContent = item.name;
      top.append(title, createBadge(item.type, "type-badge"));

      const description = document.createElement("p");
      description.className = "card-description";
      description.textContent = item.description;

      const tagRow = document.createElement("div");
      tagRow.className = "tag-row";
      [...item.categories, ...item.tags].slice(0, 4).forEach((tag) => {
        tagRow.appendChild(createBadge(tag, "tag"));
      });

      const footer = document.createElement("div");
      footer.className = "card-footer";
      const cardActions = document.createElement("div");
      cardActions.className = "card-actions";
      const networkLink = document.createElement("a");
      networkLink.className = "card-network-link";
      networkLink.href = `./network.html?resource=${encodeURIComponent(item.id)}`;
      networkLink.textContent = "Network ↗";
      networkLink.setAttribute("aria-label", `View ${item.name} in the resource network`);
      const detailsButton = document.createElement("button");
      detailsButton.type = "button";
      detailsButton.className = "card-open";
      detailsButton.textContent = "View details →";
      detailsButton.addEventListener("click", () => openDetail(item.id, detailsButton));
      cardActions.append(networkLink, detailsButton);
      footer.append(
        createBadge(item.verificationStatus, `status-badge ${statusClass(item.verificationStatus)}`),
        cardActions
      );

      card.append(top, description, tagRow, footer);
      card.addEventListener("click", (event) => {
        if (!event.target.closest("a, button")) openDetail(item.id, detailsButton);
      });
      fragment.appendChild(card);
    });
    els.catalogGrid.appendChild(fragment);
  }

  function renderActiveFilters() {
    els.activeFilters.textContent = "";
    const chips = [];
    if (state.query) chips.push({ key: "query", value: state.query, label: `Search: ${state.query}` });
    FILTER_CONFIG.forEach((config) => {
      state[config.key].forEach((value) => chips.push({ key: config.key, value, label: value }));
    });

    chips.forEach((chip) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.setAttribute("aria-label", `Remove filter ${chip.label}`);
      button.append(document.createTextNode(chip.label), createBadge("×", ""));
      button.addEventListener("click", () => {
        if (chip.key === "query") state.query = "";
        else state[chip.key] = state[chip.key].filter((value) => value !== chip.value);
        syncControls();
        applyFilters();
      });
      els.activeFilters.appendChild(button);
    });

    const count = chips.length;
    els.mobileFilterCount.textContent = count ? `(${count})` : "";
  }

  function clearFilters() {
    state.query = "";
    FILTER_CONFIG.forEach((config) => { state[config.key] = []; });
    state.sort = "name";
    filterViews.forEach((view) => {
      view.query = "";
      view.expanded = false;
      if (view.search) view.search.value = "";
    });
    syncControls();
    applyFilters();
  }

  function appendDefinition(listElement, label, value) {
    if (!value) return;
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const definition = document.createElement("dd");
    definition.textContent = value;
    wrapper.append(term, definition);
    listElement.appendChild(wrapper);
  }

  function appendListSection(parent, headingText, values) {
    if (!values.length) return;
    const section = document.createElement("section");
    section.className = "detail-section";
    const heading = document.createElement("h3");
    heading.textContent = headingText;
    const listElement = document.createElement("ul");
    values.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      listElement.appendChild(item);
    });
    section.append(heading, listElement);
    parent.appendChild(section);
  }

  function appendReferencesSection(parent, references) {
    if (!references.length) return;
    const section = document.createElement("section");
    section.className = "detail-section detail-references-section";
    const heading = document.createElement("h3");
    heading.textContent = "References";
    const listElement = document.createElement("ol");
    listElement.className = "detail-references-list";

    references.forEach((reference) => {
      const item = document.createElement("li");
      const citation = document.createElement("p");
      citation.textContent = reference.citation;
      const actions = document.createElement("div");
      actions.className = "detail-reference-actions";

      if (reference.url) {
        const sourceLink = document.createElement("a");
        sourceLink.href = reference.url;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = "Open source ↗";
        sourceLink.setAttribute("aria-label", `Open source for ${reference.short}`);
        actions.appendChild(sourceLink);
      }

      const listLink = document.createElement("a");
      listLink.href = `./references.html#${reference.id}`;
      listLink.textContent = "View in all references →";
      listLink.setAttribute("aria-label", `View ${reference.short} in all references`);
      actions.appendChild(listLink);

      item.append(citation, actions);
      listElement.appendChild(item);
    });

    section.append(heading, listElement);
    parent.appendChild(section);
  }

  function renderDetail(item) {
    els.detailContent.textContent = "";
    const hero = document.createElement("div");
    hero.className = "detail-hero";
    const badges = document.createElement("div");
    badges.className = "detail-badges";
    badges.append(
      createBadge(item.type, "type-badge"),
      createBadge(item.verificationStatus, `status-badge ${statusClass(item.verificationStatus)}`)
    );
    const title = document.createElement("h2");
    title.id = "detail-title";
    title.textContent = item.name;
    const description = document.createElement("p");
    description.textContent = item.description;
    const relatedReferences = referencesForResource(item);
    if (relatedReferences.length) {
      description.append(document.createTextNode(" "));
      const citations = document.createElement("span");
      citations.className = "inline-citations";
      citations.append(document.createTextNode("("));
      relatedReferences.forEach((reference, index) => {
        if (index) citations.append(document.createTextNode("; "));
        const citationLink = document.createElement("a");
        citationLink.href = `./references.html#${reference.id}`;
        citationLink.textContent = reference.short;
        citationLink.setAttribute("aria-label", `View reference for ${reference.short}`);
        citations.appendChild(citationLink);
      });
      citations.append(document.createTextNode(")"));
      description.appendChild(citations);
    }
    const tags = document.createElement("div");
    tags.className = "tag-row";
    item.themes.forEach((theme) => tags.appendChild(createBadge(theme, "tag")));
    hero.append(badges, title, description, tags);

    const metaSection = document.createElement("section");
    metaSection.className = "detail-section";
    const metaHeading = document.createElement("h3");
    metaHeading.textContent = "Resource profile";
    const meta = document.createElement("dl");
    meta.className = "detail-meta";
    appendDefinition(meta, "Provider", item.provider);
    appendDefinition(meta, "Access", item.access);
    appendDefinition(meta, "Spatial coverage", item.spatialCoverage);
    appendDefinition(meta, "Spatial resolution", item.spatialResolution);
    appendDefinition(meta, "Temporal resolution", item.temporalResolution);
    appendDefinition(meta, "Last checked", item.lastChecked);
    metaSection.append(metaHeading, meta);

    els.detailContent.append(hero, metaSection);
    appendListSection(els.detailContent, "Use cases", item.useCases);
    appendListSection(els.detailContent, "Limitations", item.limitations);

    const actions = document.createElement("div");
    actions.className = "detail-actions";
    const networkLink = document.createElement("a");
    networkLink.className = "detail-network-link";
    networkLink.href = `./network.html?resource=${encodeURIComponent(item.id)}`;
    networkLink.textContent = "View in network →";
    actions.appendChild(networkLink);
    if (item.url) {
      const link = document.createElement("a");
      link.className = "official-link";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.type === "Reference / Guide" ? "Open guide ↗" : "Open official resource ↗";
      actions.appendChild(link);
    }
    els.detailContent.appendChild(actions);
    appendReferencesSection(els.detailContent, relatedReferences);
  }

  function openDetail(id, trigger, historyMode = "push") {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) {
      state.resource = "";
      writeUrlState();
      closeDetail(false);
      return;
    }
    if (!els.detailPanel.classList.contains("open")) {
      state.lastFocused = trigger || document.activeElement;
    }
    if (els.filterPanel.classList.contains("open")) closeMobileFilters(false);
    state.resource = id;
    renderDetail(item);
    els.detailPanel.scrollTop = 0;
    els.detailPanel.classList.add("open");
    els.detailPanel.setAttribute("aria-hidden", "false");
    els.detailBackdrop.hidden = false;
    syncPanelAccessibility();
    if (historyMode) writeUrlState(historyMode);
    els.detailClose.focus({ preventScroll: true });
  }

  function closeDetail(updateHistory = true) {
    const wasOpen = els.detailPanel.classList.contains("open");
    els.detailPanel.classList.remove("open");
    els.detailBackdrop.hidden = true;
    state.resource = "";
    syncPanelAccessibility();
    if (updateHistory) writeUrlState("push");
    if (wasOpen) restoreFocus(state.lastFocused);
  }

  function openMobileFilters() {
    if (!MOBILE_QUERY.matches) return;
    els.filterPanel.classList.add("open");
    els.mobileFilterButton.setAttribute("aria-expanded", "true");
    els.filterBackdrop.hidden = false;
    syncPanelAccessibility();
    els.mobileFilterClose.focus();
  }

  function closeMobileFilters(returnFocus = true) {
    els.filterPanel.classList.remove("open");
    els.mobileFilterButton.setAttribute("aria-expanded", "false");
    els.filterBackdrop.hidden = true;
    syncPanelAccessibility();
    if (returnFocus) restoreFocus(els.mobileFilterButton);
  }

  function isFocusable(element) {
    return element && element.isConnected &&
      element.matches('a[href], button, input, select, textarea, summary, [tabindex]') &&
      !element.matches(":disabled") && !element.closest("[inert], [hidden]") &&
      element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  }

  function restoreFocus(preferred) {
    const fallback = [preferred, els.mobileFilterButton, els.catalogSearch, els.sortSelect]
      .find(isFocusable);
    if (fallback) fallback.focus({ preventScroll: true });
  }

  function syncPanelAccessibility() {
    isolatedElements.forEach((wasInert, element) => { element.inert = wasInert; });
    isolatedElements.clear();
    const detailOpen = els.detailPanel.classList.contains("open");
    const filterOpen = MOBILE_QUERY.matches && els.filterPanel.classList.contains("open");
    els.detailPanel.inert = !detailOpen;
    els.detailPanel.setAttribute("aria-hidden", String(!detailOpen));
    if (detailOpen) els.detailPanel.setAttribute("aria-modal", "true");
    else els.detailPanel.removeAttribute("aria-modal");
    els.filterPanel.inert = MOBILE_QUERY.matches && !filterOpen;
    if (MOBILE_QUERY.matches) {
      els.filterPanel.setAttribute("role", "dialog");
      els.filterPanel.setAttribute("aria-hidden", String(!filterOpen));
    } else {
      els.filterPanel.removeAttribute("role");
      els.filterPanel.removeAttribute("aria-hidden");
    }
    if (filterOpen) els.filterPanel.setAttribute("aria-modal", "true");
    else els.filterPanel.removeAttribute("aria-modal");
    document.body.classList.toggle("panel-open", detailOpen || filterOpen);

    // Isolate sibling branches at every level: the filter lives inside <main>.
    const activePanel = detailOpen ? els.detailPanel : filterOpen ? els.filterPanel : null;
    for (let branch = activePanel; branch && branch !== document.body; branch = branch.parentElement) {
      Array.from(branch.parentElement.children).forEach((sibling) => {
        if (sibling === branch || sibling.classList.contains("backdrop") || sibling.tagName === "SCRIPT") return;
        isolatedElements.set(sibling, sibling.inert);
        sibling.inert = true;
      });
    }
  }

  function trapFocus(event, container) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(container.querySelectorAll('a[href], summary, button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(isFocusable);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  function wireEvents() {
    syncPanelAccessibility();
    document.addEventListener("focusin", (event) => {
      if (event.target !== document.body) lastFocusTarget = event.target;
    });
    MOBILE_QUERY.addEventListener("change", () => {
      // CSS may hide the focused control before the media-query event arrives.
      const focusWasInFilters = els.filterPanel.contains(document.activeElement) ||
        (document.activeElement === document.body && els.filterPanel.contains(lastFocusTarget));
      els.filterPanel.classList.remove("open");
      els.mobileFilterButton.setAttribute("aria-expanded", "false");
      els.filterBackdrop.hidden = true;
      syncPanelAccessibility();
      if (focusWasInFilters) restoreFocus(MOBILE_QUERY.matches ? els.mobileFilterButton : els.catalogSearch);
    });
    els.heroForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = els.heroSearch.value;
      syncControls();
      applyFilters({ scroll: true });
    });
    document.querySelectorAll("[data-search]").forEach((button) => {
      button.addEventListener("click", () => {
        state.query = button.dataset.search;
        syncControls();
        applyFilters({ scroll: true });
      });
    });
    els.catalogSearch.addEventListener("input", () => {
      state.query = els.catalogSearch.value;
      els.heroSearch.value = state.query;
      applyFilters();
    });
    els.sortSelect.addEventListener("change", () => {
      state.sort = els.sortSelect.value;
      applyFilters();
    });
    els.clearFilters.addEventListener("click", clearFilters);
    els.emptyState.querySelector("button").addEventListener("click", clearFilters);
    els.mobileFilterButton.addEventListener("click", openMobileFilters);
    els.mobileFilterClose.addEventListener("click", () => closeMobileFilters());
    els.filterBackdrop.addEventListener("click", () => closeMobileFilters());
    els.detailClose.addEventListener("click", () => closeDetail());
    els.detailBackdrop.addEventListener("click", () => closeDetail());

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (els.detailPanel.classList.contains("open")) closeDetail();
        else if (els.filterPanel.classList.contains("open")) closeMobileFilters();
      }
      if (els.detailPanel.classList.contains("open")) trapFocus(event, els.detailPanel);
      else if (els.filterPanel.classList.contains("open")) trapFocus(event, els.filterPanel);
    });

    window.addEventListener("popstate", () => {
      const previousResource = state.resource;
      readUrlState();
      syncControls();
      applyFilters();
      if (state.resource) openDetail(state.resource, null, null);
      else if (previousResource) closeDetail(false);
    });
  }

  function updateStats() {
    els.stats.resources.textContent = state.items.length;
    els.stats.types.textContent = new Set(state.items.map((item) => item.type)).size;
    els.stats.verified.textContent = state.items.filter((item) => item.verificationStatus === "Verified").length;
  }

  async function init() {
    wireEvents();
    try {
      const [catalogResponse, referencesResponse] = await Promise.all([
        fetch(DATA_PATH, { cache: "no-store" }),
        fetch(REFERENCES_PATH, { cache: "no-store" })
      ]);
      if (!catalogResponse.ok) throw new Error(`Catalog request failed with status ${catalogResponse.status}.`);
      if (!referencesResponse.ok) throw new Error(`References request failed with status ${referencesResponse.status}.`);
      const [payload, referencesPayload] = await Promise.all([
        catalogResponse.json(),
        referencesResponse.json()
      ]);
      if (!Array.isArray(payload)) throw new Error("Catalog data must be a JSON array.");
      if (!Array.isArray(referencesPayload)) throw new Error("References data must be a JSON array.");
      state.items = payload.map(normalizeItem);
      state.references = new Map(
        referencesPayload
          .map(normalizeReference)
          .map((reference) => [reference.id, reference])
      );
      renderThemes();
      renderFilterGroups();
      readUrlState();
      syncControls();
      applyFilters();
      updateStats();
      if (state.resource) openDetail(state.resource, null, null);
    } catch (error) {
      els.errorState.hidden = false;
      els.errorState.textContent = "The catalog could not be loaded. Run this project through a local HTTP server and try again.";
      els.resultCount.textContent = "Catalog unavailable";
      console.error(error);
    }
  }

  init();
})();
