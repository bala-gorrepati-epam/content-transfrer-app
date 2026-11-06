"use client";

import { useSyncExternalStore } from "react";
import { mdiWeatherNight, mdiWeatherSunny } from "@mdi/js";
import { Button } from "@/src/components/ui/button";
import { Icon } from "@/src/lib/icon";
import { THEME_STORAGE_KEY } from "@/src/lib/theme";

// The page's current theme is the "dark" class on <html>. The toggle reads it through
// useSyncExternalStore, so it always matches what is shown and never sets state in an effect.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function isDark() {
  return document.documentElement.classList.contains("dark");
}

function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Storage unavailable: the choice applies to this view only.
  }
}

export function ThemeToggle() {
  // Server render has no document, so it shows the light state; the client reads the real class.
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(!dark)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon path={dark ? mdiWeatherSunny : mdiWeatherNight} className="size-4" />
      {dark ? "Light" : "Dark"}
    </Button>
  );
}
