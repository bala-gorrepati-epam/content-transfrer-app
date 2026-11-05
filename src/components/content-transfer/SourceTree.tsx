"use client";

import { ROOT_PATH, type TreeNodeState } from "@/src/utils/hooks/useSourceTree";
import { TreeNode, type TreeActions } from "@/src/components/content-transfer/TreeNode";

interface SourceTreeProps {
  nodes: Record<string, TreeNodeState>;
  actions: TreeActions;
}

// Source item tree. Only the root is rendered up front; everything else loads when expanded.
export function SourceTree({ nodes, actions }: SourceTreeProps) {
  const root = nodes[ROOT_PATH];
  if (!root) return <p className="text-sm text-muted-foreground">Loading items…</p>;

  return (
    <div className="max-h-[32rem] overflow-auto rounded-md border p-2">
      <ul>
        <TreeNode node={root} depth={0} actions={actions} />
      </ul>
    </div>
  );
}
