import type { DiffStatus, FieldValues, SideItem } from "@/src/models/contentDiff";
import type { ItemNode } from "@/src/models/getItems";

// Field names whose values differ between the two sides, sorted. A field present on only one side
// counts as a difference: an empty value and a missing field are not the same.
export function differingFields(source: FieldValues, target: FieldValues): string[] {
  const names = new Set([...source.keys(), ...target.keys()]);
  const differing: string[] = [];
  for (const name of names) {
    if (!source.has(name) || !target.has(name) || source.get(name) !== target.get(name)) {
      differing.push(name);
    }
  }
  return differing.sort();
}

// Field values of a side, or null when they could not be read there.
export function valuesOf(item: SideItem | null): FieldValues | null {
  return item && item.fields.ok ? item.fields.values : null;
}

// True when the item has at least one version in the compared language.
export function hasVersion(item: SideItem): boolean {
  return item.version > 0;
}

export function diffStatus(source: SideItem | null, target: SideItem | null): DiffStatus | null {
  if (source && target) {
    // An item with no version in the language is absent there, so the other side is the only one that exists.
    // Neither side has a version: both are empty in this language, which is identical.
    const sourceHas = hasVersion(source);
    const targetHas = hasVersion(target);
    if (!sourceHas && !targetHas) return "identical";
    if (!sourceHas) return "targetOnly";
    if (!targetHas) return "sourceOnly";

    const sourceValues = valuesOf(source);
    const targetValues = valuesOf(target);
    if (!sourceValues || !targetValues) return "unreadable";
    return differingFields(sourceValues, targetValues).length === 0 ? "identical" : "modified";
  }
  if (source) return "sourceOnly";
  if (target) return "targetOnly";
  return null;
}

export interface ChildPair<T extends ItemNode> {
  path: string;
  source: T | null;
  target: T | null;
}

// Pairs the children of one parent by path. The same path on both sides is the same item.
// Ordered by name so both sides read the same way.
export function pairChildren<T extends ItemNode>(sourceChildren: T[], targetChildren: T[]): ChildPair<T>[] {
  const pairs = new Map<string, ChildPair<T>>();
  for (const source of sourceChildren) {
    pairs.set(source.path, { path: source.path, source, target: null });
  }
  for (const target of targetChildren) {
    const existing = pairs.get(target.path);
    if (existing) existing.target = target;
    else pairs.set(target.path, { path: target.path, source: null, target });
  }
  return [...pairs.values()].sort((a, b) => {
    const nameA = (a.source ?? a.target)?.name ?? a.path;
    const nameB = (b.source ?? b.target)?.name ?? b.path;
    return nameA.localeCompare(nameB) || a.path.localeCompare(b.path);
  });
}
