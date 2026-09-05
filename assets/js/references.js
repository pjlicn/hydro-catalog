(function () {
  "use strict";

  const REFERENCES_PATH = "./data/references.json";
  const listElement = document.getElementById("references-list");
  const countElement = document.getElementById("reference-count");
  const errorElement = document.getElementById("references-error");

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeReference(raw) {
    return {
      id: text(raw.id),
      short: text(raw.short),
      citation: text(raw.citation),
      url: text(raw.url)
    };
  }

  function render(references) {
    listElement.textContent = "";
    const fragment = document.createDocumentFragment();

    references
      .sort((a, b) => a.citation.localeCompare(b.citation))
      .forEach((reference) => {
        const item = document.createElement("li");
        item.id = reference.id;

        const citation = document.createElement("p");
        citation.textContent = reference.citation;
        item.appendChild(citation);

        if (reference.url) {
          const link = document.createElement("a");
          link.href = reference.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Open source ↗";
          link.setAttribute("aria-label", `Open source for ${reference.short}`);
          item.appendChild(link);
        }
        fragment.appendChild(item);
      });

    listElement.appendChild(fragment);
    countElement.textContent = `${references.length} cited ${references.length === 1 ? "work" : "works"}`;

    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "auto", block: "center" }));
      }
    }
  }

  async function init() {
    try {
      const response = await fetch(REFERENCES_PATH, { cache: "no-store" });
      if (!response.ok) throw new Error(`References request failed with status ${response.status}.`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error("References data must be a JSON array.");
      render(payload.map(normalizeReference));
    } catch (error) {
      countElement.textContent = "References unavailable";
      errorElement.hidden = false;
      errorElement.textContent = "The references could not be loaded. Run this project through a local HTTP server and try again.";
      console.error(error);
    }
  }

  init();
})();
