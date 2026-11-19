"use client";

import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Label } from "@/src/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { EnvironmentSelect, type EnvironmentChoice } from "@/src/components/content-transfer/EnvironmentSelect";
import { DiffTree } from "@/src/components/content-diff/DiffTree";
import { FieldDiffPanel } from "@/src/components/content-diff/FieldDiffPanel";
import { ManageLanguagesDialog } from "@/src/components/content-diff/ManageLanguagesDialog";
import type { FeatureProps } from "@/src/features/registry";
import { diffStatus } from "@/src/lib/contentDiff";
import { ENGLISH, ENGLISH_LANGUAGE, type DiffStatus } from "@/src/models/contentDiff";
import { COMPARE_ROOT_PATH, useContentDiff, type DiffNodeState } from "@/src/utils/hooks/useContentDiff";
import { useCompareLanguages } from "@/src/utils/hooks/useCompareLanguages";

// Counts the statuses of every item that has been loaded so far, walking down from the root.
function countStatuses(nodes: Record<string, DiffNodeState>): Record<DiffStatus, number> {
  const counts: Record<DiffStatus, number> = {
    identical: 0,
    modified: 0,
    unreadable: 0,
    sourceOnly: 0,
    targetOnly: 0,
  };
  const pending = [COMPARE_ROOT_PATH];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || seen.has(path)) continue;
    seen.add(path);
    const node = nodes[path];
    if (!node) continue;
    const status = diffStatus(node.source, node.target);
    if (status) counts[status] += 1;
    pending.push(...node.childPaths);
  }
  return counts;
}

// Compare environments: pick a source, a target and a language, then walk the item tree under /sitecore.
// Each item is labelled identical, modified, or present on one side only. Modified items show
// their differing field values. Read-only: nothing is written to either environment.
export function ContentDiffMode({ client, environments }: FeatureProps) {
  const [sourceIndex, setSourceIndex] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(ENGLISH);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [showGridLines, setShowGridLines] = useState(false);
  const { languages, add: addLanguage, remove: removeLanguage } = useCompareLanguages();

  // If the selected language was removed in the dialog, fall back to English.
  const language = languages.some((option) => option.code === selectedLanguage) ? selectedLanguage : ENGLISH;
  const languageLabel = (languages.find((option) => option.code === language) ?? ENGLISH_LANGUAGE).label;

  // Environments are referenced by index, so context IDs stay out of the DOM.
  const choices: EnvironmentChoice[] = useMemo(
    () => environments.map((env, index) => ({ value: String(index), label: env.name })),
    [environments],
  );

  const source = sourceIndex !== null ? environments[Number(sourceIndex)] : undefined;
  const target = targetIndex !== null ? environments[Number(targetIndex)] : undefined;

  const diff = useContentDiff(client, source?.contextId ?? null, target?.contextId ?? null, language);
  const sourceName = source?.name ?? "Source";
  const targetName = target?.name ?? "Target";

  const selectedNode = selectedPath ? (diff.nodes[selectedPath] ?? null) : null;
  const counts = useMemo(() => countStatuses(diff.nodes), [diff.nodes]);
  const root = diff.nodes[COMPARE_ROOT_PATH];
  const rootMissingEverywhere = root?.load === "loaded" && !root.source && !root.target;

  // Changing an environment or the language starts a new comparison, so the selected item no longer applies.
  const handleSourceChange = (value: string) => {
    setSourceIndex(value);
    setSelectedPath(null);
  };
  const handleTargetChange = (value: string) => {
    setTargetIndex(value);
    setSelectedPath(null);
  };
  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
    setSelectedPath(null);
  };

  const handleClear = () => {
    setSourceIndex(null);
    setTargetIndex(null);
    setSelectedLanguage(ENGLISH);
    setSelectedPath(null);
  };

  const handleSelect = (path: string) => {
    setSelectedPath((current) => (current === path ? null : path));
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleClear}>
          Clear
        </Button>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-end gap-3">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger id="compare-language" aria-label="Language" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ManageLanguagesDialog languages={languages} onAdd={addLanguage} onRemove={removeLanguage} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <EnvironmentSelect
            id="compare-source-environment"
            label="Source"
            choices={choices}
            value={sourceIndex}
            disabledValue={targetIndex}
            onChange={handleSourceChange}
          />
          <EnvironmentSelect
            id="compare-target-environment"
            label="Target"
            choices={choices}
            value={targetIndex}
            disabledValue={sourceIndex}
            onChange={handleTargetChange}
          />
        </div>
      </section>

      {!diff.comparable && (
        <p className="text-sm text-muted-foreground">
          {source && target && sourceIndex === targetIndex
            ? "Choose two different environments to compare."
            : "Choose a source and a target environment to compare their items."}
        </p>
      )}

      {diff.comparable && (
        <>
          <p className="text-sm text-muted-foreground">
            Compared so far in {languageLabel}: {counts.identical} identical, {counts.modified} modified,{" "}
            {counts.unreadable} with fields unavailable, {counts.sourceOnly} only in {sourceName}, {counts.targetOnly}{" "}
            only in {targetName}. Expand an item to compare its children.
          </p>

          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Items</h2>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="compare-grid-lines"
                    checked={showGridLines}
                    onCheckedChange={(checked) => setShowGridLines(checked === true)}
                  />
                  <Label htmlFor="compare-grid-lines">Show grid lines</Label>
                </div>
              </div>
              {rootMissingEverywhere ? (
                <p className="text-sm text-muted-foreground">
                  {COMPARE_ROOT_PATH} does not exist in either environment in {languageLabel}.
                </p>
              ) : (
                <DiffTree
                  actions={{
                    nodes: diff.nodes,
                    sourceName,
                    targetName,
                    selectedPath,
                    gridLines: showGridLines,
                    onSelect: handleSelect,
                    onToggle: diff.toggle,
                    onRetry: diff.retry,
                    onRefresh: diff.refresh,
                  }}
                />
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Field differences</h2>
              <FieldDiffPanel node={selectedNode} sourceName={sourceName} targetName={targetName} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
