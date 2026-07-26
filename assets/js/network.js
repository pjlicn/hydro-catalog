(function () {
  "use strict";

  const DATA_PATH = "./data/catalog.json";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const WIDTH = 1200;
  const HEIGHT = 760;
  const THEMES = [
    "Hydrological Modeling",
    "Statistical & Analytical Methods",
    "Geospatial Computing",
    "Machine Learning & Differentiable Modeling",
    "Hydrometeorological Data & Platforms"
  ];
  const THEME_CENTERS = [
    { x: 600, y: 105 },
    { x: 1000, y: 300 },
    { x: 850, y: 650 },
    { x: 350, y: 650 },
    { x: 200, y: 300 }
  ];

  const state = {
    items: [],
    itemMap: new Map(),
    resourceNodes: new Map(),
    similarityEdges: [],
    visibleIds: new Set(),
    query: "",
    theme: "",
    type: "",
    selectedId: "",
    hoveredId: "",
    transform: { x: 0, y: 0, k: 1 },
    nodeElements: new Map(),
    edgeElements: [],
    drag: null,
    pan: null,
    suppressClick: false
  };

  const els = {
    search: document.getElementById("network-search"),
    themeFilter: document.getElementById("network-theme-filter"),
    typeFilter: document.getElementById("network-type-filter"),
    zoomIn: document.getElementById("network-zoom-in"),
    zoomOut: document.getElementById("network-zoom-out"),
    fit: document.getElementById("network-fit"),
    reset: document.getElementById("network-reset"),
    alert: document.getElementById("network-alert"),
    canvas: document.getElementById("network-canvas"),
    svg: document.getElementById("network-svg"),
    viewport: document.getElementById("network-viewport"),
    similarityEdgeLayer: document.getElementById("network-similarity-edges"),
    resourceNodeLayer: document.getElementById("network-resource-nodes"),
    empty: document.getElementById("network-empty"),
    inspector: document.getElementById("network-inspector"),
    legend: document.getElementById("network-legend"),
    accessibleList: document.getElementById("network-accessible-list")
  };

  function text(value, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function list(value) {
    return Array.isArray(value) ? value.map((entry) => text(entry)).filter(Boolean) : [];
  }

  function normalizeItem(raw, index) {
    return {
      id: text(raw.id, `resource-${index + 1}`),
      name: text(raw.name, "Unnamed resource"),
      type: text(raw.type, "Needs verification"),
      themes: list(raw.themes),
      categories: list(raw.categories),
      tags: list(raw.tags),
      description: text(raw.description, "Description unavailable."),
      provider: text(raw.provider),
      spatialCoverage: text(raw.spatialCoverage),
      temporalResolution: text(raw.temporalResolution),
      spatialResolution: text(raw.spatialResolution),
      access: text(raw.access, "Needs verification"),
      verificationStatus: text(raw.verificationStatus, "Needs verification"),
      useCases: list(raw.useCases),
      limitations: list(raw.limitations),
      url: text(raw.url),
      lastChecked: text(raw.lastChecked)
    };
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function sharedValues(left, right) {
    const rightValues = new Set(right);
    return Array.from(new Set(left.filter((value) => rightValues.has(value))));
  }

  function edgeKey(left, right) {
    return [left, right].sort().join("|");
  }

  function jaccard(left, right, shared) {
    const unionSize = new Set([...left, ...right]).size;
    return unionSize ? shared.length / unionSize : 0;
  }

  function buildSimilarityEdges(items) {
    const candidates = [];
    const incident = new Map(items.map((item) => [item.id, []]));

    for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
        const left = items[leftIndex];
        const right = items[rightIndex];
        const categories = sharedValues(left.categories, right.categories);
        const themes = sharedValues(left.themes, right.themes);
        if (!themes.length) continue;
        const categorySimilarity = jaccard(left.categories, right.categories, categories);
        const themeSimilarity = jaccard(left.themes, right.themes, themes);
        const edge = {
          source: left.id,
          target: right.id,
          categories,
          themes,
          categorySimilarity,
          themeSimilarity,
          score: (0.75 * categorySimilarity) + (0.25 * themeSimilarity),
          key: edgeKey(left.id, right.id)
        };
        candidates.push(edge);
        incident.get(left.id).push(edge);
        incident.get(right.id).push(edge);
      }
    }

    const selected = new Map();
    items.forEach((item) => {
      incident
        .get(item.id)
        .sort((left, right) => right.score - left.score || left.key.localeCompare(right.key))
        .slice(0, 2)
        .forEach((edge) => selected.set(edge.key, edge));
    });

    return Array.from(selected.values()).sort((left, right) => left.key.localeCompare(right.key));
  }

  function hashFraction(value, salt = 0) {
    let hash = 2166136261 ^ salt;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function themeIndex(theme) {
    const index = THEMES.indexOf(theme);
    return index >= 0 ? index : 0;
  }

  function buildNodes(items) {
    state.resourceNodes.clear();
    items.forEach((item) => {
      const centers = item.themes.map((theme) => THEME_CENTERS[themeIndex(theme)]);
      const center = centers.reduce(
        (total, candidate) => ({ x: total.x + candidate.x, y: total.y + candidate.y }),
        { x: 0, y: 0 }
      );
      center.x /= centers.length || 1;
      center.y /= centers.length || 1;
      const angle = hashFraction(item.id, 17) * Math.PI * 2;
      const radius = 35 + (hashFraction(item.id, 41) * 105);
      state.resourceNodes.set(item.id, {
        id: item.id,
        item,
        x: center.x + (Math.cos(angle) * radius),
        y: center.y + (Math.sin(angle) * radius),
        vx: 0,
        vy: 0
      });
    });
  }

  function runLayout() {
    const nodes = Array.from(state.resourceNodes.values());
    const similarityEdges = state.similarityEdges;

    for (let tick = 0; tick < 220; tick += 1) {
      const cooling = 1 - (tick / 260);

      nodes.forEach((node) => {
        const centers = node.item.themes.map((theme) => THEME_CENTERS[themeIndex(theme)]);
        const target = centers.reduce(
          (total, center) => ({ x: total.x + center.x, y: total.y + center.y }),
          { x: 0, y: 0 }
        );
        target.x /= centers.length || 1;
        target.y /= centers.length || 1;
        node.vx += (target.x - node.x) * 0.0038 * cooling;
        node.vy += (target.y - node.y) * 0.0038 * cooling;
      });

      for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
          const left = nodes[leftIndex];
          const right = nodes[rightIndex];
          let dx = right.x - left.x;
          let dy = right.y - left.y;
          let distance = Math.hypot(dx, dy);
          if (distance < 0.1) {
            dx = 0.1;
            dy = 0.1;
            distance = Math.hypot(dx, dy);
          }
          if (distance >= 78) continue;
          const push = (78 - distance) * 0.018 * cooling;
          const ux = dx / distance;
          const uy = dy / distance;
          left.vx -= ux * push;
          left.vy -= uy * push;
          right.vx += ux * push;
          right.vy += uy * push;
        }
      }

      similarityEdges.forEach((edge) => {
        const source = state.resourceNodes.get(edge.source);
        const target = state.resourceNodes.get(edge.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const pull = (distance - 115) * 0.0028 * cooling;
        const ux = dx / distance;
        const uy = dy / distance;
        source.vx += ux * pull;
        source.vy += uy * pull;
        target.vx -= ux * pull;
        target.vy -= uy * pull;
      });

      nodes.forEach((node) => {
        node.vx *= 0.77;
        node.vy *= 0.77;
        node.x = Math.min(WIDTH - 55, Math.max(55, node.x + node.vx));
        node.y = Math.min(HEIGHT - 55, Math.max(55, node.y + node.vy));
      });
    }
  }

  function matchesFilters(item) {
    if (state.theme && !item.themes.includes(state.theme)) return false;
    if (state.type && item.type !== state.type) return false;
    if (!state.query) return true;
    const haystack = [
      item.name,
      item.type,
      item.provider,
      item.description,
      ...item.themes,
      ...item.categories,
      ...item.tags
    ].join(" ").toLowerCase();
    return haystack.includes(state.query.toLowerCase());
  }

  function createLine(edge, className, source, target) {
    const line = svgElement("line", {
      class: `network-edge ${className}`,
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y
    });
    line.dataset.source = edge.source;
    line.dataset.target = edge.target;
    return line;
  }

  function truncateLabel(value) {
    return value.length > 28 ? `${value.slice(0, 26)}…` : value;
  }

  function createResourceNode(node) {
    const primaryIndex = themeIndex(node.item.themes[0]);
    const group = svgElement("g", {
      class: `network-node network-resource-node theme-color-${primaryIndex}`,
      transform: `translate(${node.x} ${node.y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `Inspect ${node.item.name}, ${node.item.type}`
    });
    group.dataset.resourceId = node.id;

    if (node.item.themes.length > 1) {
      const secondaryIndex = themeIndex(node.item.themes[1]);
      group.appendChild(svgElement("circle", {
        class: `network-node-ring theme-stroke-${secondaryIndex}`,
        r: 15
      }));
    }
    group.appendChild(svgElement("circle", { class: "network-node-core", r: 10 }));
    const label = svgElement("text", { x: 16, y: 4 });
    label.textContent = truncateLabel(node.item.name);
    group.appendChild(label);

    group.addEventListener("click", () => {
      if (!state.suppressClick) selectResource(node.id);
    });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectResource(node.id);
      }
    });
    group.addEventListener("mouseenter", () => {
      state.hoveredId = node.id;
      updateHighlight();
    });
    group.addEventListener("mouseleave", () => {
      state.hoveredId = "";
      updateHighlight();
    });
    group.addEventListener("focus", () => {
      state.hoveredId = node.id;
      updateHighlight();
    });
    group.addEventListener("blur", () => {
      state.hoveredId = "";
      updateHighlight();
    });
    return group;
  }

  function edgeExplanation(edge) {
    const themeLabel = edge.themes.length === 1 ? "Shared theme" : "Shared themes";
    const categoryText = edge.categories.length
      ? `Shared categories: ${edge.categories.join(", ")}`
      : "No shared categories";
    return `${themeLabel}: ${edge.themes.join(", ")}. ${categoryText}. Weighted similarity ${Math.round(edge.score * 100)}%.`;
  }

  function renderAccessibleList(items) {
    els.accessibleList.textContent = "";
    const fragment = document.createDocumentFragment();
    items
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((item) => {
        const listItem = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.resourceId = item.id;
        button.textContent = `${item.name} — ${item.type}`;
        button.addEventListener("click", () => selectResource(item.id));
        listItem.appendChild(button);
        fragment.appendChild(listItem);
      });
    els.accessibleList.appendChild(fragment);
  }

  function renderGraph() {
    [els.similarityEdgeLayer, els.resourceNodeLayer]
      .forEach((layer) => { layer.textContent = ""; });
    state.nodeElements.clear();
    state.edgeElements = [];

    const visibleItems = state.items.filter(matchesFilters);
    state.visibleIds = new Set(visibleItems.map((item) => item.id));

    state.similarityEdges.forEach((edge) => {
      if (!state.visibleIds.has(edge.source) || !state.visibleIds.has(edge.target)) return;
      const source = state.resourceNodes.get(edge.source);
      const target = state.resourceNodes.get(edge.target);
      const line = createLine(edge, "network-similarity-edge", source, target);
      const title = svgElement("title");
      title.textContent = edgeExplanation(edge);
      line.appendChild(title);
      els.similarityEdgeLayer.appendChild(line);
      state.edgeElements.push({ edge, element: line });
    });

    visibleItems.forEach((item) => {
      const node = state.resourceNodes.get(item.id);
      const group = createResourceNode(node);
      els.resourceNodeLayer.appendChild(group);
      state.nodeElements.set(item.id, group);
    });

    els.empty.hidden = visibleItems.length !== 0;
    els.svg.dataset.resourceNodes = String(visibleItems.length);
    els.svg.dataset.similarityEdges = String(state.edgeElements.length);
    renderAccessibleList(visibleItems);
    updatePositions();
    updateHighlight();
    renderInspector();
  }

  function updatePositions() {
    state.nodeElements.forEach((element, id) => {
      const node = state.resourceNodes.get(id);
      element.setAttribute("transform", `translate(${node.x} ${node.y})`);
    });
    state.edgeElements.forEach(({ edge, element }) => {
      const source = state.resourceNodes.get(edge.source);
      const target = state.resourceNodes.get(edge.target);
      element.setAttribute("x1", source.x);
      element.setAttribute("y1", source.y);
      element.setAttribute("x2", target.x);
      element.setAttribute("y2", target.y);
    });
  }

  function relatedResourceIds(id) {
    const related = new Set();
    state.similarityEdges.forEach((edge) => {
      if (edge.source === id) related.add(edge.target);
      if (edge.target === id) related.add(edge.source);
    });
    return related;
  }

  function updateHighlight() {
    const activeId = state.hoveredId || state.selectedId;
    const related = activeId ? relatedResourceIds(activeId) : new Set();

    state.nodeElements.forEach((element, id) => {
      element.classList.toggle("selected", id === state.selectedId);
      element.classList.toggle("active", id === activeId || related.has(id));
      element.classList.toggle("dimmed", Boolean(activeId) && id !== activeId && !related.has(id));
    });
    state.edgeElements.forEach(({ edge, element }) => {
      const active = edge.source === activeId || edge.target === activeId;
      element.classList.toggle("active", active);
      element.classList.toggle("dimmed", Boolean(activeId) && !active);
    });
    els.accessibleList.querySelectorAll("button").forEach((button) => {
      if (button.dataset.resourceId === state.selectedId) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  }

  function createBadge(label, className = "tag") {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = label;
    return badge;
  }

  function statusClass(status) {
    if (status === "Verified") return "verified";
    if (status === "Needs verification") return "needs-verification";
    return "";
  }

  function similarityNeighbors(id) {
    return state.similarityEdges
      .filter((edge) => edge.source === id || edge.target === id)
      .map((edge) => ({
        edge,
        item: state.itemMap.get(edge.source === id ? edge.target : edge.source)
      }))
      .filter((candidate) => candidate.item)
      .sort((left, right) => right.edge.score - left.edge.score || left.item.name.localeCompare(right.item.name));
  }

  function appendCount(parent) {
    const visibleCount = state.visibleIds.size;
    const count = document.createElement("p");
    count.id = "network-count";
    count.className = "network-count";
    count.textContent = `${visibleCount} of ${state.items.length} resources shown`;
    parent.appendChild(count);
  }

  function appendInspectorDefinition(listElement, label, value) {
    if (!value) return;
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const definition = document.createElement("dd");
    definition.textContent = value;
    wrapper.append(term, definition);
    listElement.appendChild(wrapper);
  }

  function appendInspectorList(parent, headingText, values) {
    if (!values.length) return;
    const section = document.createElement("section");
    section.className = "network-inspector-section";
    const heading = document.createElement("h3");
    heading.textContent = headingText;
    const listElement = document.createElement("ul");
    values.forEach((value) => {
      const listItem = document.createElement("li");
      listItem.textContent = value;
      listElement.appendChild(listItem);
    });
    section.append(heading, listElement);
    parent.appendChild(section);
  }

  function renderInspector() {
    els.inspector.textContent = "";
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Selected resource";
    els.inspector.appendChild(eyebrow);

    const item = state.itemMap.get(state.selectedId);
    if (!item) {
      const heading = document.createElement("h2");
      heading.textContent = "Explore a connection";
      const description = document.createElement("p");
      description.textContent = "Select a resource node to see why it is connected and open its full catalog details.";
      els.inspector.append(heading, description);
      appendCount(els.inspector);
      return;
    }

    const heading = document.createElement("h2");
    heading.textContent = item.name;
    const profile = document.createElement("article");
    profile.className = "network-resource-profile";
    const badges = document.createElement("div");
    badges.className = "network-inspector-badges";
    badges.append(
      createBadge(item.type, "type-badge"),
      createBadge(item.verificationStatus, `status-badge ${statusClass(item.verificationStatus)}`)
    );
    const description = document.createElement("p");
    description.textContent = item.description;
    const themeList = document.createElement("div");
    themeList.className = "tag-row";
    item.themes.forEach((theme) => themeList.appendChild(createBadge(theme)));

    const meta = document.createElement("dl");
    meta.className = "network-inspector-meta";
    appendInspectorDefinition(meta, "Provider", item.provider);
    appendInspectorDefinition(meta, "Access", item.access);
    appendInspectorDefinition(meta, "Spatial coverage", item.spatialCoverage);
    appendInspectorDefinition(meta, "Spatial resolution", item.spatialResolution);
    appendInspectorDefinition(meta, "Temporal resolution", item.temporalResolution);
    appendInspectorDefinition(meta, "Last checked", item.lastChecked);

    const taxonomy = document.createElement("div");
    taxonomy.className = "network-inspector-taxonomy";
    [...item.categories, ...item.tags].forEach((value) => taxonomy.appendChild(createBadge(value)));

    const actions = document.createElement("div");
    actions.className = "network-inspector-actions";
    const detailLink = document.createElement("a");
    detailLink.className = "network-primary-link";
    detailLink.href = `./?resource=${encodeURIComponent(item.id)}`;
    detailLink.textContent = "Open resource details →";
    actions.appendChild(detailLink);
    if (item.url) {
      const officialLink = document.createElement("a");
      officialLink.href = item.url;
      officialLink.target = "_blank";
      officialLink.rel = "noopener noreferrer";
      officialLink.textContent = "Official source ↗";
      actions.appendChild(officialLink);
    }

    profile.append(heading, badges, description, themeList, meta);
    appendInspectorList(profile, "Use cases", item.useCases);
    appendInspectorList(profile, "Limitations", item.limitations);
    if (taxonomy.childElementCount) {
      const taxonomySection = document.createElement("section");
      taxonomySection.className = "network-inspector-section";
      const taxonomyHeading = document.createElement("h3");
      taxonomyHeading.textContent = "Categories & tags";
      taxonomySection.append(taxonomyHeading, taxonomy);
      profile.appendChild(taxonomySection);
    }
    profile.appendChild(actions);
    els.inspector.appendChild(profile);

    const neighborHeading = document.createElement("h3");
    neighborHeading.textContent = "Related resources";
    els.inspector.appendChild(neighborHeading);
    const neighbors = similarityNeighbors(item.id);
    if (!neighbors.length) {
      const empty = document.createElement("p");
      empty.className = "network-neighbor-empty";
      empty.textContent = "No related resources are available for the current catalog metadata.";
      els.inspector.appendChild(empty);
    } else {
      const listElement = document.createElement("ul");
      listElement.className = "network-neighbor-list";
      neighbors.forEach(({ edge, item: neighbor }) => {
        const listItem = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = neighbor.name;
        button.addEventListener("click", () => selectResource(neighbor.id));
        const reason = document.createElement("span");
        reason.textContent = edgeExplanation(edge);
        listItem.append(button, reason);
        listElement.appendChild(listItem);
      });
      els.inspector.appendChild(listElement);
    }
    appendCount(els.inspector);
  }

  function writeResourceUrl(id, historyMode = "push") {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("resource", id);
    else url.searchParams.delete("resource");
    const method = historyMode === "replace" ? "replaceState" : "pushState";
    window.history[method]({}, "", url);
  }

  function showAlert(message) {
    els.alert.textContent = message;
    els.alert.hidden = !message;
  }

  function centerNode(id) {
    const node = state.resourceNodes.get(id);
    if (!node) return;
    const zoom = 1.45;
    state.transform = {
      x: (WIDTH / 2) - (node.x * zoom),
      y: (HEIGHT / 2) - (node.y * zoom),
      k: zoom
    };
    applyTransform();
  }

  function selectResource(id, options = {}) {
    const { historyMode = "push", center = true } = options;
    const item = state.itemMap.get(id);
    if (!item) {
      showAlert(`Resource “${id}” was not found. Showing the full network instead.`);
      state.selectedId = "";
      writeResourceUrl("", "replace");
      updateHighlight();
      renderInspector();
      return;
    }

    if (!matchesFilters(item)) {
      state.query = "";
      state.theme = "";
      state.type = "";
      syncControls();
      renderGraph();
    }

    showAlert("");
    state.selectedId = id;
    if (historyMode) writeResourceUrl(id, historyMode);
    updateHighlight();
    renderInspector();
    if (center) centerNode(id);
  }

  function clearSelection(updateHistory = true) {
    state.selectedId = "";
    state.hoveredId = "";
    if (updateHistory) writeResourceUrl("");
    updateHighlight();
    renderInspector();
  }

  function syncControls() {
    els.search.value = state.query;
    els.themeFilter.value = state.theme;
    els.typeFilter.value = state.type;
  }

  function applyFilters() {
    if (state.selectedId && !matchesFilters(state.itemMap.get(state.selectedId))) {
      clearSelection(true);
    }
    renderGraph();
  }

  function applyTransform() {
    els.viewport.setAttribute(
      "transform",
      `translate(${state.transform.x} ${state.transform.y}) scale(${state.transform.k})`
    );
  }

  function zoomAt(factor, x = WIDTH / 2, y = HEIGHT / 2) {
    const previous = state.transform.k;
    const next = Math.min(3, Math.max(0.45, previous * factor));
    const scale = next / previous;
    state.transform.x = x - ((x - state.transform.x) * scale);
    state.transform.y = y - ((y - state.transform.y) * scale);
    state.transform.k = next;
    applyTransform();
  }

  function resetView() {
    state.transform = { x: 0, y: 0, k: 1 };
    applyTransform();
  }

  function fitVisibleNodes() {
    const nodes = Array.from(state.visibleIds)
      .map((id) => state.resourceNodes.get(id))
      .filter(Boolean);
    if (!nodes.length) {
      resetView();
      return;
    }
    const minX = Math.min(...nodes.map((node) => node.x));
    const maxX = Math.max(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxY = Math.max(...nodes.map((node) => node.y));
    const padding = 95;
    const contentWidth = Math.max(maxX - minX, 120);
    const contentHeight = Math.max(maxY - minY, 120);
    const zoom = Math.min(
      2.2,
      Math.max(
        0.55,
        Math.min((WIDTH - (padding * 2)) / contentWidth, (HEIGHT - (padding * 2)) / contentHeight)
      )
    );
    state.transform = {
      x: (WIDTH / 2) - (((minX + maxX) / 2) * zoom),
      y: (HEIGHT / 2) - (((minY + maxY) / 2) * zoom),
      k: zoom
    };
    applyTransform();
  }

  function resetNetwork() {
    state.query = "";
    state.theme = "";
    state.type = "";
    state.selectedId = "";
    state.hoveredId = "";
    syncControls();
    writeResourceUrl("");
    renderGraph();
    resetView();
    showAlert("");
  }

  function eventPoint(event) {
    const bounds = els.svg.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * HEIGHT
    };
  }

  function wirePointerControls() {
    els.svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const point = eventPoint(event);
      zoomAt(event.deltaY < 0 ? 1.12 : 0.89, point.x, point.y);
    }, { passive: false });

    els.svg.addEventListener("pointerdown", (event) => {
      const resourceElement = event.target.closest(".network-resource-node");
      const point = eventPoint(event);
      els.svg.setPointerCapture(event.pointerId);
      if (resourceElement) {
        const id = resourceElement.dataset.resourceId;
        const node = state.resourceNodes.get(id);
        state.drag = {
          id,
          startX: event.clientX,
          startY: event.clientY,
          offsetX: ((point.x - state.transform.x) / state.transform.k) - node.x,
          offsetY: ((point.y - state.transform.y) / state.transform.k) - node.y
        };
      } else {
        state.pan = {
          startX: event.clientX,
          startY: event.clientY,
          originX: state.transform.x,
          originY: state.transform.y
        };
      }
    });

    els.svg.addEventListener("pointermove", (event) => {
      if (state.drag) {
        const point = eventPoint(event);
        const node = state.resourceNodes.get(state.drag.id);
        node.x = ((point.x - state.transform.x) / state.transform.k) - state.drag.offsetX;
        node.y = ((point.y - state.transform.y) / state.transform.k) - state.drag.offsetY;
        node.x = Math.min(WIDTH - 35, Math.max(35, node.x));
        node.y = Math.min(HEIGHT - 35, Math.max(35, node.y));
        if (Math.hypot(event.clientX - state.drag.startX, event.clientY - state.drag.startY) > 4) {
          state.suppressClick = true;
        }
        updatePositions();
      } else if (state.pan) {
        const bounds = els.svg.getBoundingClientRect();
        state.transform.x = state.pan.originX + ((event.clientX - state.pan.startX) * WIDTH / bounds.width);
        state.transform.y = state.pan.originY + ((event.clientY - state.pan.startY) * HEIGHT / bounds.height);
        applyTransform();
      }
    });

    function endPointer(event) {
      if (els.svg.hasPointerCapture(event.pointerId)) els.svg.releasePointerCapture(event.pointerId);
      state.drag = null;
      state.pan = null;
      window.setTimeout(() => { state.suppressClick = false; }, 0);
    }

    els.svg.addEventListener("pointerup", endPointer);
    els.svg.addEventListener("pointercancel", endPointer);
  }

  function populateControls() {
    THEMES.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme;
      option.textContent = theme;
      els.themeFilter.appendChild(option);
    });
    Array.from(new Set(state.items.map((item) => item.type)))
      .sort((left, right) => left.localeCompare(right))
      .forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        els.typeFilter.appendChild(option);
      });
  }

  function renderLegend() {
    const fragment = document.createDocumentFragment();
    THEMES.forEach((theme, index) => {
      const item = document.createElement("span");
      const dot = document.createElement("i");
      dot.className = `network-legend-dot theme-bg-${index}`;
      item.append(dot, document.createTextNode(theme));
      fragment.appendChild(item);
    });
    const similarityEdge = document.createElement("span");
    similarityEdge.innerHTML = '<i class="network-legend-line similarity-line"></i>Weighted metadata similarity';
    fragment.append(similarityEdge);
    els.legend.appendChild(fragment);
  }

  function wireEvents() {
    els.search.addEventListener("input", () => {
      state.query = els.search.value.trim();
      applyFilters();
    });
    els.themeFilter.addEventListener("change", () => {
      state.theme = els.themeFilter.value;
      applyFilters();
    });
    els.typeFilter.addEventListener("change", () => {
      state.type = els.typeFilter.value;
      applyFilters();
    });
    els.zoomIn.addEventListener("click", () => zoomAt(1.2));
    els.zoomOut.addEventListener("click", () => zoomAt(0.8));
    els.fit.addEventListener("click", fitVisibleNodes);
    els.reset.addEventListener("click", resetNetwork);
    window.addEventListener("popstate", () => {
      const id = new URL(window.location.href).searchParams.get("resource") || "";
      if (id) selectResource(id, { historyMode: "", center: true });
      else clearSelection(false);
    });
    wirePointerControls();
  }

  async function init() {
    wireEvents();
    renderLegend();
    try {
      const response = await fetch(DATA_PATH, { cache: "no-store" });
      if (!response.ok) throw new Error(`Catalog request failed with status ${response.status}.`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error("Catalog data must be a JSON array.");
      state.items = payload.map(normalizeItem);
      state.itemMap = new Map(state.items.map((item) => [item.id, item]));
      state.similarityEdges = buildSimilarityEdges(state.items);
      buildNodes(state.items);
      runLayout();
      populateControls();
      renderGraph();
      applyTransform();

      const requestedId = new URL(window.location.href).searchParams.get("resource") || "";
      if (requestedId) selectResource(requestedId, { historyMode: "", center: true });
    } catch (error) {
      showAlert("The resource network could not be loaded. Run this project through a local HTTP server and try again.");
      els.empty.hidden = false;
      els.empty.querySelector("strong").textContent = "Network unavailable";
      els.empty.querySelector("span").textContent = "The catalog data could not be loaded.";
      console.error(error);
    }
  }

  init();
})();
