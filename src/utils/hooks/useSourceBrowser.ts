"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { EnvironmentChoice } from "@/src/components/content-transfer/EnvironmentSelect";
import type { TreeActions } from "@/src/components/content-transfer/TreeNode";
import type { EnvironmentOption } from "@/src/models/contentTransfer";
import { useSourceTree } from "@/src/utils/hooks/useSourceTree";
import { useTreeSelection } from "@/src/utils/hooks/useTreeSelection";

// Source environment choice, source item tree and item selection. Shared by every feature that
// browses a source. Environments are referenced by index, so context IDs stay out of the DOM.
export function useSourceBrowser(client: ClientSDK, environments: EnvironmentOption[]) {
  const [sourceIndex, setSourceIndex] = useState<string | null>(null);

  const choices: EnvironmentChoice[] = useMemo(
    () => environments.map((env, index) => ({ value: String(index), label: env.name })),
    [environments],
  );

  const source = sourceIndex !== null ? environments[Number(sourceIndex)] : undefined;
  const sourceContextId = source?.contextId ?? null;

  const tree = useSourceTree(client, sourceContextId);
  const selection = useTreeSelection();

  // Selections belong to one source. A new source starts with no selection.
  const clearSelection = selection.clear;
  useEffect(() => {
    clearSelection();
  }, [sourceContextId, clearSelection]);

  const treeActions: TreeActions = {
    nodes: tree.nodes,
    isSelected: (path) => Boolean(selection.selected[path]),
    coveredBy: selection.coveredBy,
    onToggle: tree.toggle,
    onLoadMore: tree.loadMore,
    onRetry: tree.retry,
    onSelect: selection.select,
    onDeselect: selection.deselect,
  };

  return { choices, sourceIndex, setSourceIndex, source, tree, selection, treeActions };
}
