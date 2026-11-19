import type { ItemNode } from "@/src/models/getItems";

// One field value as returned by `fields(ownFields: true, excludeStandardFields: true) { nodes { name value } }`.
export interface FieldNode {
  name: string;
  value: string | null;
}

// Field values of one item on one side, keyed by field name.
export type FieldValues = Map<string, string | null>;

// Result of reading an item's field values on one side. A read can fail for one item, for example
// when the item's template does not exist in that environment. Only that item is affected.
export type FieldsLoad = { ok: true; values: FieldValues } | { ok: false; error: string };

// An item as it exists on one side of the comparison, with its field values in the compared language.
// `version` is the number of versions in that language. 0 means the item has no version in it, so it has no
// field values there.
export interface SideItem extends ItemNode {
  version: number;
  fields: FieldsLoad;
}

// identical: on both sides with the same field values.
// modified: on both sides, at least one field value differs.
// unreadable: on both sides, but the field values could not be read on at least one side.
// sourceOnly / targetOnly: the item exists on one side only.
export type DiffStatus = "identical" | "modified" | "unreadable" | "sourceOnly" | "targetOnly";

// A language code as the authoring API takes it, for example "en" or "de-de". The same code is read on both
// environments.
export type CompareLanguage = string;

// A language offered in the comparison. `code` is sent to the API; `label` is what the user sees (for example
// "German" for "de-de").
export interface LanguageOption {
  code: CompareLanguage;
  label: string;
}

// English is always available and cannot be removed. Other languages are added in the UI and stored per browser
// (see lib/compareLanguages.ts).
export const ENGLISH = "en";
export const ENGLISH_LANGUAGE: LanguageOption = { code: ENGLISH, label: "English" };
