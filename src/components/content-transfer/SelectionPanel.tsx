"use client";

import { mdiClose } from "@mdi/js";
import { Button } from "@/src/components/ui/button";
import { Icon } from "@/src/lib/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import {
  MERGE_STRATEGY_OPTIONS,
  SCOPE_OPTIONS,
  type MergeStrategy,
  type Scope,
  type SelectedItem,
} from "@/src/models/contentTransfer";

interface SelectionPanelProps {
  items: SelectedItem[];
  disabled?: boolean;
  onChangeScope: (path: string, scope: Scope) => void;
  onChangeMergeStrategy: (path: string, mergeStrategy: MergeStrategy) => void;
  onRemove: (path: string) => void;
}

// Selected items, each with its own Scope and MergeStrategy. These become the dataTrees of the transfer.
export function SelectionPanel({
  items,
  disabled,
  onChangeScope,
  onChangeMergeStrategy,
  onRemove,
}: SelectionPanelProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing selected yet. Tick items in the tree to add them.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.path} className="rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="truncate text-xs text-muted-foreground">{item.path}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={`Remove ${item.name}`}
              disabled={disabled}
              onClick={() => onRemove(item.path)}
            >
              <Icon path={mdiClose} className="size-4" />
            </Button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Select
              value={item.scope}
              disabled={disabled}
              onValueChange={(value) => onChangeScope(item.path, value as Scope)}
            >
              <SelectTrigger className="w-full" aria-label={`Scope for ${item.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={item.mergeStrategy}
              disabled={disabled}
              onValueChange={(value) => onChangeMergeStrategy(item.path, value as MergeStrategy)}
            >
              <SelectTrigger className="w-full" aria-label={`Merge strategy for ${item.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MERGE_STRATEGY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </li>
      ))}
    </ul>
  );
}
