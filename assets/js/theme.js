(function () {
  "use strict";

  const STORAGE_KEY = "hydro-catalog-theme";
  const DARK_QUERY = "(prefers-color-scheme: dark)";
  const THEME_COLORS = {
    light: "#073b4c",
    dark: "#0d2027"
  };

  function savedTheme() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : "";
    } catch (error) {
      return "";
    }
  }

  function systemTheme() {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  }

  function activeTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function updateControls(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const nextTheme = theme === "dark" ? "light" : "dark";
      button.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
      button.setAttribute("title", `Switch to ${nextTheme} theme`);
      button.setAttribute("aria-pressed", String(theme === "dark"));
    });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = THEME_COLORS[theme];
    updateControls(theme);
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // The selected theme still applies for this page when storage is unavailable.
    }
  }

  applyTheme(savedTheme() || systemTheme());

  document.addEventListener("DOMContentLoaded", () => {
    updateControls(activeTheme());
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const theme = activeTheme() === "dark" ? "light" : "dark";
        storeTheme(theme);
        applyTheme(theme);
      });
    });
  });

  function handleSystemThemeChange(event) {
    if (!savedTheme()) applyTheme(event.matches ? "dark" : "light");
  }

  const colorScheme = window.matchMedia(DARK_QUERY);
  if (typeof colorScheme.addEventListener === "function") {
    colorScheme.addEventListener("change", handleSystemThemeChange);
  } else {
    colorScheme.addListener(handleSystemThemeChange);
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) applyTheme(savedTheme() || systemTheme());
  });
})();
