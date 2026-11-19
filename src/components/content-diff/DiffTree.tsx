"use client";

import { mdiChevronDown, mdiChevronRight, mdiRefresh } from "@mdi/js";
import { Button } from "@/src/components/ui/button";
import { LoadingSpinner } from "@/src/components/ui/loading-spinner";
import { diffStatus } from "@/src/lib/contentDiff";
import { Icon } from "@/src/lib/icon";
import { cn } from "@/src/lib/utils";
import type { DiffStatus, SideItem } from "@/src/models/contentDiff";
import { COMPARE_ROOT_PATH, type DiffNodeState } from "@/src/utils/hooks/useContentDiff";

// Everything a row needs from the tree, passed down once instead of per prop.
export interface DiffTreeActions {
  nodes: Record<string, DiffNodeState>;
  sourceName: string;
  targetName: string;
  selectedPath: string | null;
  // Draws the column dividers and row separators, and boxes the empty side of a row.
  gridLines: boolean;
  onSelect: (path: string) => void;
  onToggle: (node: DiffNodeState) => void;
  onRetry: (node: DiffNodeState) => void;
  onRefresh: (node: DiffNodeState) => void;
}

const INDENT_PX = 20;
const EXPANDER_PX = 24; // width of the expand button slot, so names line up with or without it
const CELL_PAD_PX = 8; // inner padding of a cell when grid lines are on

// Marker colour and tooltip for one item on one side. Null when that side shows no marker.
interface Marker {
  color: string;
  label: string;
}

function markerFor(status: DiffStatus, side: "source" | "target", actions: DiffTreeActions): Marker | null {
  switch (status) {
    case "identical":
      return { color: "bg-success", label: "Identical" };
    case "modified":
      return { color: "bg-danger", label: "Differs" };
    case "unreadable":
      return { color: "bg-danger", label: "Fields unavailable" };
    case "sourceOnly":
      return side === "source" ? { color: "bg-warning", label: `Only in ${actions.sourceName}` } : null;
    case "targetOnly":
      return side === "target" ? { color: "bg-warning", label: `Only in ${actions.targetName}` } : null;
  }
}

interface ItemCellProps {
  item: SideItem | null;
  missingText: string;
  depth: number;
  gridLines: boolean;
  marker: Marker | null;
  // Set only on the side that holds the item, so the expand button never sits in an empty cell.
  expander: { expanded: boolean; canExpand: boolean; onToggle: () => void } | null;
  // Set only on the side that holds the item, and only for a loaded node that has children.
  onRefresh: (() => void) | null;
  loading: boolean;
  selectable: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

// One side of a tree row. An empty side shows its placeholder text at the same indent, so both columns line up.
function ItemCell({
  item,
  missingText,
  depth,
  gridLines,
  marker,
  expander,
  onRefresh,
  loading,
  selectable,
  isSelected,
  onSelect,
}: ItemCellProps) {
  const pad = gridLines ? CELL_PAD_PX : 0;

  if (!item) {
    return (
      <div
        className={cn(
          "text-xs italic text-muted-foreground",
          gridLines ? "m-1 rounded border border-dashed border-border py-2" : "py-1",
        )}
        style={{ paddingLeft: depth * INDENT_PX + EXPANDER_PX + pad }}
      >
        {missingText}
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", gridLines ? "py-2" : "py-1")}
      style={{ paddingLeft: depth * INDENT_PX + pad, paddingRight: pad }}
    >
      {expander?.canExpand ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label={expander.expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
          aria-expanded={expander.expanded}
          onClick={expander.onToggle}
        >
          <Icon path={expander.expanded ? mdiChevronDown : mdiChevronRight} className="size-4" />
        </Button>
      ) : (
        <span className="size-6 shrink-0" aria-hidden="true" />
      )}

      {marker && (
        <span
          role="img"
          aria-label={marker.label}
          title={marker.label}
          className={cn("size-2.5 shrink-0 rounded-full", marker.color)}
        />
      )}

      {selectable ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          title="Show field differences"
          className={cn(
            "truncate text-left text-sm font-medium underline-offset-4 hover:underline",
            isSelected && "text-primary",
          )}
        >
          {item.name}
        </button>
      ) : (
        <span className="truncate text-sm font-medium">{item.name}</span>
      )}
      {item.version === 0 && <span className="shrink-0 text-xs text-muted-foreground">(0 versions)</span>}
      <span className="min-w-0 truncate text-xs text-muted-foreground">{item.path}</span>

      {loading && <LoadingSpinner label="Loading" />}

      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-6 shrink-0"
          aria-label={`Refresh ${item.name}`}
          title="Refresh children"
          onClick={onRefresh}
        >
          <Icon path={mdiRefresh} className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

// A failed load, shown under the row it belongs to, with a retry.
function ErrorRow({ node, depth, actions }: { node: DiffNodeState; depth: number; actions: DiffTreeActions }) {
  return (
    <div
      className="flex items-center gap-2 py-1 text-sm text-destructive"
      style={{ paddingLeft: depth * INDENT_PX + EXPANDER_PX }}
    >
      <span>{node.error}</span>
      <Button variant="outline" size="sm" onClick={() => actions.onRetry(node)}>
        Retry
      </Button>
    </div>
  );
}

// One aligned row: the item on the source side (left) and on the target side (right).
function DiffRow({ node, depth, actions }: { node: DiffNodeState; depth: number; actions: DiffTreeActions }) {
  const status = diffStatus(node.source, node.target);
  if (!status) {
    // No item on either side has no row, but a failed load (for example of the root) still has to show.
    if (node.load !== "error") return null;
    return (
      <li>
        <ErrorRow node={node} depth={depth} actions={actions} />
      </li>
    );
  }

  const { gridLines } = actions;
  const canExpand = node.source?.hasChildren === true || node.target?.hasChildren === true;
  // The expand and refresh buttons sit on the side that holds the item: the source when it has it, otherwise the target.
  const hostSide = node.source ? "source" : "target";
  const canRefresh = canExpand && node.load === "loaded";
  const selectable = status === "modified" || status === "unreadable";
  const isSelected = actions.selectedPath === node.path;
  const expander = { expanded: node.expanded, canExpand, onToggle: () => actions.onToggle(node) };
  const refresh = canRefresh ? () => actions.onRefresh(node) : null;

  return (
    <li>
      <div
        className={cn(
          "grid grid-cols-2 rounded-md px-1",
          gridLines ? "divide-x divide-border border-b border-border" : "gap-4",
          isSelected && "bg-accent",
        )}
      >
        <ItemCell
          item={node.source}
          missingText={`Not in ${actions.sourceName}`}
          depth={depth}
          gridLines={gridLines}
          marker={markerFor(status, "source", actions)}
          expander={hostSide === "source" ? expander : null}
          onRefresh={hostSide === "source" ? refresh : null}
          loading={hostSide === "source" && node.load === "loading"}
          selectable={selectable}
          isSelected={isSelected}
          onSelect={() => actions.onSelect(node.path)}
        />
        <ItemCell
          item={node.target}
          missingText={`Not in ${actions.targetName}`}
          depth={depth}
          gridLines={gridLines}
          marker={markerFor(status, "target", actions)}
          expander={hostSide === "target" ? expander : null}
          onRefresh={hostSide === "target" ? refresh : null}
          loading={hostSide === "target" && node.load === "loading"}
          selectable={selectable}
          isSelected={isSelected}
          onSelect={() => actions.onSelect(node.path)}
        />
      </div>

      {node.load === "error" && <ErrorRow node={node} depth={depth} actions={actions} />}
    </li>
  );
}

// Visible rows in display order: the root, then each expanded node's children, depth first.
function visibleRows(nodes: Record<string, DiffNodeState>): { node: DiffNodeState; depth: number }[] {
  const rows: { node: DiffNodeState; depth: number }[] = [];
  const visit = (path: string, depth: number) => {
    const node = nodes[path];
    if (!node) return;
    rows.push({ node, depth });
    if (node.expanded) {
      for (const childPath of node.childPaths) visit(childPath, depth + 1);
    }
  };
  visit(COMPARE_ROOT_PATH, 0);
  return rows;
}

function Legend() {
  const items = [
    { color: "bg-success", label: "Identical" },
    { color: "bg-danger", label: "Different, or fields unavailable" },
    { color: "bg-warning", label: "Exists in one environment only" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", item.color)} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function TreeLoading() {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
      <LoadingSpinner label="Loading items" />
      <span>Loading items from both environments…</span>
    </div>
  );
}

interface DiffTreeProps {
  actions: DiffTreeActions;
}

// Two trees side by side, one per environment, drawn as aligned rows so an item sits next to its
// counterpart. Only the root is loaded up front; each node loads when expanded.
export function DiffTree({ actions }: DiffTreeProps) {
  const root = actions.nodes[COMPARE_ROOT_PATH];
  // Until the root has an answer from either side, show a loader rather than an empty tree.
  const rootPending = !root || ((root.load === "idle" || root.load === "loading") && !root.source && !root.target);
  if (rootPending) return <TreeLoading />;

  const rows = visibleRows(actions.nodes);

  return (
    <div className="flex flex-col gap-3">
      <Legend />
      <div className="max-h-[32rem] overflow-auto rounded-md border">
        <div className="min-w-[40rem]">
          <div
            className={cn(
              "sticky top-0 z-10 grid grid-cols-2 border-b bg-card px-3 py-2 text-xs font-medium uppercase text-muted-foreground",
              actions.gridLines ? "divide-x divide-border" : "gap-4",
            )}
          >
            <span className={cn("truncate", actions.gridLines && "pr-2")}>{actions.sourceName}</span>
            <span className={cn("truncate", actions.gridLines && "pl-2")}>{actions.targetName}</span>
          </div>
          <ul className="p-2">
            {rows.map(({ node, depth }) => (
              <DiffRow key={node.path} node={node} depth={depth} actions={actions} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
