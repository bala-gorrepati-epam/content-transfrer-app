// Wrapper types for content transfer. The SDK types make dataTree fields optional;
// the app always sets them, so they are required here.

export type Scope = "SingleItem" | "ItemAndDescendants";

export type MergeStrategy = "OverrideExistingItem" | "KeepExistingItem" | "LatestWin" | "OverrideExistingTree";

export interface SelectedItem {
  path: string;
  name: string;
  scope: Scope;
  mergeStrategy: MergeStrategy;
}

export interface DataTree {
  itemPath: string;
  scope: Scope;
  mergeStrategy: MergeStrategy;
}

export type TransferStepId =
  | "create"
  | "status"
  | "chunks"
  | "complete"
  | "consume"
  | "blobState"
  | "package" // download mode only: builds the zip
  | "cleanup";

// An environment the user can pick. Context ID is for xmc calls only and is never rendered.
export interface EnvironmentOption {
  contextId: string;
  // Display name (tenant display name), never the context ID.
  name: string;
}

export type StepStatus = "pending" | "running" | "done" | "failed" | "warning";

export interface TransferStepState {
  status: StepStatus;
  detail?: string;
  error?: string;
}

export type TransferProgress = Record<TransferStepId, TransferStepState>;

// Observed getBlobState response. The installed SDK types declare `status` and `details` instead,
// which does not match the real API, so this shape is typed here.
export interface BlobStateResponse {
  BlobState?: string; // e.g. "Consumed"
  Error?: unknown; // null when consuming has not failed
  ConsumedName?: string;
  Actions?: { Details?: string };
}

// Display labels and option lists shared by the selection panel, the confirm dialog and the progress view.
export const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "SingleItem", label: "Single item" },
  { value: "ItemAndDescendants", label: "Item and descendants" },
];

export const MERGE_STRATEGY_OPTIONS: { value: MergeStrategy; label: string }[] = [
  { value: "OverrideExistingItem", label: "Override existing item" },
  { value: "KeepExistingItem", label: "Keep existing item" },
  { value: "LatestWin", label: "Latest wins" },
  { value: "OverrideExistingTree", label: "Override existing tree" },
];
