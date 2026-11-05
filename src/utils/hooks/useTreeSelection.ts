"use client";

import { useCallback, useMemo, useState } from "react";
import type { MergeStrategy, Scope, SelectedItem } from "@/src/models/contentTransfer";

export const DEFAULT_SCOPE: Scope = "SingleItem";
export const DEFAULT_MERGE_STRATEGY: MergeStrategy = "OverrideExistingItem";

// True when `path` is strictly below `ancestor`. The trailing "/" stops "/sitecore/a"
// from matching "/sitecore/ab".
function isDescendant(path: string, ancestor: string) {
  return path.startsWith(ancestor + "/");
}

// Multi-select keyed by item path. Keeps the dataTrees free of overlaps: an item selected
// with ItemAndDescendants covers everything below it, so nothing below can be selected separately.
export function useTreeSelection() {
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});

  // Path of the ItemAndDescendants selection that covers `path`, or null.
  const coveredBy = useCallback(
    (path: string): string | null => {
      for (const sel of Object.values(selected)) {
        if (sel.scope === "ItemAndDescendants" && isDescendant(path, sel.path)) return sel.path;
      }
      return null;
    },
    [selected],
  );

  const select = useCallback((item: { path: string; name: string }) => {
    setSelected((prev) => {
      if (prev[item.path]) return prev;
      // Covered items are disabled in the UI; this guard keeps the invariant even if the UI slips.
      if (Object.values(prev).some((s) => s.scope === "ItemAndDescendants" && isDescendant(item.path, s.path))) {
        return prev;
      }
      return {
        ...prev,
        [item.path]: {
          path: item.path,
          name: item.name,
          scope: DEFAULT_SCOPE,
          mergeStrategy: DEFAULT_MERGE_STRATEGY,
        },
      };
    });
  }, []);

  const deselect = useCallback((path: string) => {
    setSelected((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const setScope = useCallback((path: string, scope: Scope) => {
    setSelected((prev) => {
      const current = prev[path];
      if (!current || current.scope === scope) return prev;
      const next: Record<string, SelectedItem> = {};
      for (const [key, sel] of Object.entries(prev)) {
        // Switching to ItemAndDescendants makes separate selections below this item redundant.
        if (scope === "ItemAndDescendants" && isDescendant(key, path)) continue;
        next[key] = key === path ? { ...sel, scope } : sel;
      }
      return next;
    });
  }, []);

  const setMergeStrategy = useCallback((path: string, mergeStrategy: MergeStrategy) => {
    setSelected((prev) => {
      const current = prev[path];
      if (!current || current.mergeStrategy === mergeStrategy) return prev;
      return { ...prev, [path]: { ...current, mergeStrategy } };
    });
  }, []);

  const clear = useCallback(() => setSelected({}), []);

  const items = useMemo(() => Object.values(selected), [selected]);

  return { items, selected, select, deselect, setScope, setMergeStrategy, clear, coveredBy };
}
