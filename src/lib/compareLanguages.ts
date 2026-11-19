import { ENGLISH, type LanguageOption } from "@/src/models/contentDiff";

// Languages the user added, kept per browser. English is not stored: it is always present.
export const COMPARE_LANGUAGES_STORAGE_KEY = "content-diff-languages";

// Used until the user changes the list.
export const DEFAULT_EXTRA_LANGUAGES: LanguageOption[] = [{ code: "de-de", label: "German" }];

const MAX_LABEL_LENGTH = 40;

// Language codes such as "en", "de-de" or "sr-Latn-RS": a 2 or 3 letter language, then optional subtags.
const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

export function isValidLanguageCode(code: string): boolean {
  return LANGUAGE_CODE.test(code);
}

export function isValidLanguageLabel(label: string): boolean {
  const trimmed = label.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LABEL_LENGTH;
}

// Language codes are not case-sensitive in Sitecore, so "de-DE" and "de-de" are the same language.
export function isSameLanguage(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// Stored entries are objects. Older versions stored only the code; those keep their label when it is a default.
function parseEntry(entry: unknown): LanguageOption | null {
  if (typeof entry === "string") {
    if (!isValidLanguageCode(entry) || isSameLanguage(entry, ENGLISH)) return null;
    const known = DEFAULT_EXTRA_LANGUAGES.find((option) => isSameLanguage(option.code, entry));
    return { code: entry, label: known?.label ?? entry };
  }
  if (entry && typeof entry === "object") {
    const { code, label } = entry as { code?: unknown; label?: unknown };
    if (typeof code !== "string" || typeof label !== "string") return null;
    if (!isValidLanguageCode(code) || !isValidLanguageLabel(label) || isSameLanguage(code, ENGLISH)) return null;
    return { code, label: label.trim() };
  }
  return null;
}

// Reads the user's extra languages. Storage can be blocked (for example inside the Marketplace iframe),
// so any failure falls back to the default list instead of breaking the feature.
export function loadExtraLanguages(): LanguageOption[] {
  if (typeof window === "undefined") return DEFAULT_EXTRA_LANGUAGES;
  try {
    const raw = window.localStorage.getItem(COMPARE_LANGUAGES_STORAGE_KEY);
    if (raw === null) return DEFAULT_EXTRA_LANGUAGES;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseEntry).filter((option): option is LanguageOption => option !== null);
  } catch {
    return DEFAULT_EXTRA_LANGUAGES;
  }
}

export function saveExtraLanguages(languages: LanguageOption[]): void {
  try {
    window.localStorage.setItem(COMPARE_LANGUAGES_STORAGE_KEY, JSON.stringify(languages));
  } catch {
    // Blocked storage: the list still works for this visit, it just is not remembered.
  }
}
