"use client";

import { mdiChevronDown, mdiChevronRight } from "@mdi/js";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { LoadingSpinner } from "@/src/components/ui/loading-spinner";
import { Icon } from "@/src/lib/icon";
import type { TreeNodeState } from "@/src/utils/hooks/useSourceTree";

// Everything a row needs from its parent, passed down once instead of per prop.
export interface TreeActions {
  nodes: Record<string, TreeNodeState>;
  isSelected: (path: string) => boolean;
  coveredBy: (path: string) => string | null;
  onToggle: (node: TreeNodeState) => void;
  onLoadMore: (node: TreeNodeState) => void;
  onRetry: (node: TreeNodeState) => void;
  onSelect: (item: { path: string; name: string }) => void;
  onDeselect: (path: string) => void;
}

const INDENT_PX = 20;

interface TreeNodeProps {
  node: TreeNodeState;
  depth: number;
  actions: TreeActions;
}

// One row of the source tree plus its loaded children. Children render only when expanded.
export function TreeNode({ node, depth, actions }: TreeNodeProps) {
  const name = node.item?.name ?? node.path;
  const isSelected = actions.isSelected(node.path);
  // A covered item is disabled: an ancestor selected with ItemAndDescendants already includes it.
  const isCovered = actions.coveredBy(node.path) !== null;
  const canExpand = node.item?.hasChildren === true;
  const isLoading = node.load === "loading";
  const indent = { paddingLeft: depth * INDENT_PX };

  return (
    <li>
      <div className="flex items-center gap-2 py-1" style={indent}>
        {canExpand ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label={node.expanded ? `Collapse ${name}` : `Expand ${name}`}
            aria-expanded={node.expanded}
            onClick={() => actions.onToggle(node)}
          >
            <Icon path={node.expanded ? mdiChevronDown : mdiChevronRight} className="size-4" />
          </Button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden="true" />
        )}

        <Checkbox
          checked={isSelected}
          disabled={isCovered}
          aria-label={`Select ${name}`}
          onCheckedChange={(checked) =>
            checked === true ? actions.onSelect({ path: node.path, name }) : actions.onDeselect(node.path)
          }
        />

        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{node.path}</span>

        {isCovered && <Badge variant="default">Covered</Badge>}
        {isLoading && <LoadingSpinner label="Loading" />}
      </div>

      {node.load === "error" && (
        <div
          className="flex items-center gap-2 py-1 text-sm text-destructive"
          style={{ paddingLeft: depth * INDENT_PX + 32 }}
        >
          <span>{node.error}</span>
          <Button variant="outline" size="sm" onClick={() => actions.onRetry(node)}>
            Retry
          </Button>
        </div>
      )}

      {node.expanded && (node.childPaths.length > 0 || node.pageInfo?.hasNextPage) && (
        <ul>
          {node.childPaths.map((childPath) => {
            const child = actions.nodes[childPath];
            return child ? <TreeNode key={childPath} node={child} depth={depth + 1} actions={actions} /> : null;
          })}

          {node.pageInfo?.hasNextPage && (
            <li style={{ paddingLeft: (depth + 1) * INDENT_PX + 32 }} className="py-1">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={isLoading}
                onClick={() => actions.onLoadMore(node)}
              >
                {isLoading ? "Loading…" : "Load more"}
              </Button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
