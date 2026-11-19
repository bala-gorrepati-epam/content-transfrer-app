"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isSameLanguage,
  isValidLanguageCode,
  isValidLanguageLabel,
  loadExtraLanguages,
  saveExtraLanguages,
} from "@/src/lib/compareLanguages";
import { ENGLISH, ENGLISH_LANGUAGE, type LanguageOption } from "@/src/models/contentDiff";

// The languages offered in Compare environments: English first, then the ones the user added.
// Adding returns an error message to show, or null when the language was added.
export function useCompareLanguages() {
  // Read on the client only: this feature mounts after the Marketplace client is ready.
  const [extra, setExtra] = useState<LanguageOption[]>(loadExtraLanguages);

  useEffect(() => {
    saveExtraLanguages(extra);
  }, [extra]);

  const languages = useMemo(() => [ENGLISH_LANGUAGE, ...extra], [extra]);

  const add = useCallback(
    (codeInput: string, labelInput: string): string | null => {
      const code = codeInput.trim();
      const label = labelInput.trim();
      if (!isValidLanguageCode(code)) return "Enter a language code such as de-de or fr-fr.";
      if (!isValidLanguageLabel(label)) return "Enter a label of up to 40 characters, such as German.";
      if (languages.some((existing) => isSameLanguage(existing.code, code))) {
        return `${code} is already in the list.`;
      }
      setExtra((prev) => [...prev, { code, label }]);
      return null;
    },
    [languages],
  );

  const remove = useCallback((code: string) => {
    // English is always available, so it is never removed.
    if (isSameLanguage(code, ENGLISH)) return;
    setExtra((prev) => prev.filter((existing) => existing.code !== code));
  }, []);

  return { languages, add, remove };
}
