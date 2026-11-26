"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { EnvironmentSelect } from "@/src/components/content-transfer/EnvironmentSelect";
import { SelectionPanel } from "@/src/components/content-transfer/SelectionPanel";
import { SourceTree } from "@/src/components/content-transfer/SourceTree";
import {
  TransferProgressView,
  initialProgress,
  type TransferOutcome,
} from "@/src/components/content-transfer/TransferProgressView";
import { checkDestinationPermissions } from "@/src/lib/destinationPermissions";
import { runTransfer } from "@/src/lib/contentTransfer";
import {
  MERGE_STRATEGY_OPTIONS,
  SCOPE_OPTIONS,
  type DataTree,
  type EnvironmentOption,
  type TransferProgress,
} from "@/src/models/contentTransfer";
import { LoadingSpinner } from "@/src/components/ui/loading-spinner";
import { useSourceBrowser } from "@/src/utils/hooks/useSourceBrowser";
import { useAccessToken } from "@/src/utils/hooks/useAccessToken";
import { useReportBusy } from "@/src/features/busy";

interface TransferModeProps {
  client: ClientSDK;
  environments: EnvironmentOption[];
}

// Transfer mode: pick source and destination, select items in the source tree, run the transfer.
export function TransferMode({ client, environments }: TransferModeProps) {
  const [destinationIndex, setDestinationIndex] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  // True only while the destination rights are being checked, before the transfer starts.
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [outcome, setOutcome] = useState<TransferOutcome | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const getAccessToken = useAccessToken();

  // Bring the progress panel into view when a run starts. Runs in an effect so the panel
  // is already rendered (progress is set in the same update as running).
  useEffect(() => {
    if (running) progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [running]);

  const { choices, sourceIndex, setSourceIndex, source, tree, selection, treeActions } = useSourceBrowser(
    client,
    environments,
  );

  const destination = destinationIndex !== null ? environments[Number(destinationIndex)] : undefined;

  const sameEnvironment = sourceIndex !== null && sourceIndex === destinationIndex;
  const canRun = Boolean(source && destination) && !sameEnvironment && selection.items.length > 0 && !running;

  useReportBusy(running);

  // Resets this tab. The tree and selection clear themselves when the source is cleared.
  const handleClear = () => {
    setSourceIndex(null);
    setDestinationIndex(null);
    setConfirmOpen(false);
    setProgress(null);
    setOutcome(null);
  };

  const handleSourceChange = (value: string) => {
    setSourceIndex(value);
    // Destination must differ from source; clear it if the new source matches.
    if (value === destinationIndex) setDestinationIndex(null);
  };

  const handleConfirm = async () => {
    if (!source || !destination) return;
    setConfirmOpen(false);
    setRunning(true);
    setOutcome(null);
    const dataTrees: DataTree[] = selection.items.map((item) => ({
      itemPath: item.path,
      scope: item.scope,
      mergeStrategy: item.mergeStrategy,
    }));
    try {
      // Check the destination before anything is read from the source or written to it.
      setCheckingPermissions(true);
      const problems = await checkDestinationPermissions(getAccessToken, destination.contextId, dataTrees);
      //setCheckingPermissions(false);
      if (problems.length > 0) {
        setProgress(initialProgress());
        setOutcome({
          kind: "failure",
          message: `Transfer not started. You do not have the rights needed in ${destination.name}. Fix the issues below, or remove those items from the transfer.`,
          details: problems.map((problem) => `${problem.path}: ${problem.reason.trim()}`),
        });
        return;
      }

      setProgress(initialProgress());
      const result = await runTransfer({
        client,
        sourceContextId: source.contextId,
        destinationContextId: destination.contextId,
        dataTrees,
        onProgress: (step, state) => setProgress((prev) => (prev ? { ...prev, [step]: state } : prev)),
      });
      setOutcome({ kind: "success", message: `Transferred ${result.fileNames.length} file(s).` });
    } catch (error) {
      setOutcome({
        kind: "failure",
        message: error instanceof Error ? error.message : "Transfer failed.",
      });
    } finally {
      setCheckingPermissions(false);
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={running} onClick={handleClear}>
          Clear
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <EnvironmentSelect
          id="source-environment"
          label="Source"
          choices={choices}
          value={sourceIndex}
          disabled={running}
          onChange={handleSourceChange}
        />
        <EnvironmentSelect
          id="destination-environment"
          label="Destination"
          choices={choices}
          value={destinationIndex}
          disabledValue={sourceIndex}
          disabled={running}
          onChange={setDestinationIndex}
        />
      </section>

      {sameEnvironment && (
        <p className="text-sm text-destructive">Source and destination must be different environments.</p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Source items</h2>
          {source ? (
            <SourceTree nodes={tree.nodes} actions={treeActions} />
          ) : (
            <p className="text-sm text-muted-foreground">Choose a source environment to browse items.</p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Selected items</h2>
          <SelectionPanel
            items={selection.items}
            disabled={running}
            onChangeScope={selection.setScope}
            onChangeMergeStrategy={selection.setMergeStrategy}
            onRemove={selection.deselect}
          />
          <div className="flex justify-end">
            <Button disabled={!canRun} onClick={() => setConfirmOpen(true)}>
              Run transfer
            </Button>
          </div>
        </section>
      </div>

      {checkingPermissions && (
        // Full-screen overlay: the page is dimmed and clicks are blocked until the check finishes.
        <div aria-busy="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-6 shadow-lg">
            <LoadingSpinner label="Checking destination permissions" className="size-6" />
            <span className="text-sm">Checking the rights needed in {destination?.name}…</span>
          </div>
        </div>
      )}

      {progress && !checkingPermissions && (
        <div ref={progressRef} className="scroll-mt-6">
          <TransferProgressView progress={progress} outcome={outcome} />
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm transfer</DialogTitle>
            <DialogDescription>
              Copy {selection.items.length} item(s) from <strong>{source?.name}</strong> to{" "}
              <strong>{destination?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-64 flex-col gap-2 overflow-auto text-sm">
            {selection.items.map((item) => (
              <li key={item.path} className="rounded-md border p-2">
                <p className="font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.path}</p>
                <p className="text-xs text-muted-foreground">
                  {SCOPE_OPTIONS.find((o) => o.value === item.scope)?.label} ·{" "}
                  {MERGE_STRATEGY_OPTIONS.find((o) => o.value === item.mergeStrategy)?.label}
                </p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Start transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
