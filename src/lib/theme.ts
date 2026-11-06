// Theme is stored per browser. The key is shared by the layout script and the toggle.
export const THEME_STORAGE_KEY = "content-transfer-theme";

// Runs before first paint (see app/layout.tsx), so the saved or system theme applies without a flash.
// Storage can be blocked (e.g. inside the Marketplace iframe), so it is wrapped in try/catch.
export const themeInitScript = `(function () {
  try {
    var saved = localStorage.getItem("${THEME_STORAGE_KEY}");
    var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();`;
