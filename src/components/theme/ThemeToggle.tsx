"use client";

import { useEffect, useState } from "react";
import { mdiWeatherNight, mdiWeatherSunny } from "@mdi/js";
import { Button } from "@/src/components/ui/button";
import { Icon } from "@/src/lib/icon";

type Theme = "light" | "dark";

const STORAGE_KEY = "content-transfer-theme";

// Stored per browser only. Storage can be blocked (e.g. inside the Marketplace iframe), so every
// access is guarded and the toggle still works for the current page view when it is.
function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the choice applies to this view only.
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Starts from the saved choice, else the system setting. The class is applied in an effect, so the
// server-rendered page is always light and the first paint may flash before the saved theme applies.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial =
      readStoredTheme() ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    writeStoredTheme(next);
  };

  const isDark = theme === "dark";
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon path={isDark ? mdiWeatherSunny : mdiWeatherNight} className="size-4" />
      {isDark ? "Light" : "Dark"}
    </Button>
  );
}
