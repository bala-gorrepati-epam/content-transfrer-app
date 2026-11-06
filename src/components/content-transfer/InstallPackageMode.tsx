"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { EnvironmentSelect, type EnvironmentChoice } from "@/src/components/content-transfer/EnvironmentSelect";
import {
  INSTALL_STEP_IDS,
  TransferProgressView,
  initialProgress,
  type TransferOutcome,
} from "@/src/components/content-transfer/TransferProgressView";
import type { FeatureProps } from "@/src/features/registry";
import { PackageValidationError, readPackage, type ReadPackageResult } from "@/src/lib/contentPackage";
import { runInstallPackage } from "@/src/lib/contentTransfer";
import { useReportBusy } from "@/src/features/busy";
import {
  MERGE_STRATEGY_OPTIONS,
  SCOPE_OPTIONS,
  type TransferProgress,
} from "@/src/models/contentTransfer";

interface LoadedPackage extends ReadPackageResult {
  fileName: string;
}

// Install package: open a package made by Download package, check it, pick the destination, install.
export function InstallPackageMode({ client, environments }: FeatureProps) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<LoadedPackage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [destinationIndex, setDestinationIndex] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [outcome, setOutcome] = useState<TransferOutcome | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (running) progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [running]);

  useReportBusy(running);

  // Resets this tab, including the file picker so the same file can be chosen again.
  const handleClear = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoaded(null);
    setLoadError(null);
    setDestinationIndex(null);
    setConfirmOpen(false);
    setProgress(null);
    setOutcome(null);
  };

  // The package stores only the source environment's display name, not its context ID, so the
  // match is by name. An environment cannot receive the package it was exported from.
  const exportedFrom = loaded?.manifest.sourceEnvironmentName;

  // Environments are referenced by index, so context IDs stay out of the DOM.
  const choices: EnvironmentChoice[] = useMemo(
    () =>
      environments.map((env, index) => ({
        value: String(index),
        label: env.name,
        disabled: exportedFrom !== undefined && env.name === exportedFrom,
      })),
    [environments, exportedFrom],
  );
  const destination = destinationIndex !== null ? environments[Number(destinationIndex)] : undefined;
  const destinationIsSource = destination !== undefined && destination.name === exportedFrom;

  const totals = useMemo(() => {
    if (!loaded) return null;
    const chunkSets = loaded.manifest.chunkSets;
    return {
      chunkSets: chunkSets.length,
      chunks: chunkSets.reduce((sum, set) => sum + set.chunks.length, 0),
      items: chunkSets.reduce((sum, set) => sum + set.totalItemCount, 0),
    };
  }, [loaded]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setLoaded(null);
    setLoadError(null);
    setOutcome(null);
    setProgress(null);
    if (!file) return;

    setLoading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const next = { fileName: file.name, ...readPackage(bytes) };
      setLoaded(next);
      // A destination chosen before this package was opened may be the environment it came from.
      if (destination && destination.name === next.manifest.sourceEnvironmentName) {
        setDestinationIndex(null);
      }
    } catch (error) {
      setLoadError(
        error instanceof PackageValidationError
          ? error.message
          : "The file could not be read.",
      );
    } finally {
      setLoading(false);
    }
  };

  const canInstall = Boolean(loaded && destination) && !destinationIsSource && !running && !loading;

  const handleConfirm = async () => {
    if (!loaded || !destination) return;
    setConfirmOpen(false);
    setRunning(true);
    setOutcome(null);
    setProgress(initialProgress());
    try {
      const result = await runInstallPackage({
        client,
        destinationContextId: destination.contextId,
        manifest: loaded.manifest,
        files: loaded.files,
        onProgress: (step, state) =>
          setProgress((prev) => (prev ? { ...prev, [step]: state } : prev)),
      });
      setOutcome({ kind: "success", message: `Installed ${result.fileNames.length} file(s).` });
    } catch (error) {
      setOutcome({
        kind: "failure",
        message: error instanceof Error ? error.message : "Install failed.",
      });
    } finally {
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

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Package file</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          disabled={running}
          onChange={handleFile}
          className="text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
        />
        {loading && <p className="text-sm text-muted-foreground">Reading package…</p>}
        {loadError && (
          <div role="alert" className="whitespace-pre-line rounded-md border border-destructive p-3 text-sm text-destructive">
            <p className="font-medium">This package cannot be installed:</p>
            <p>{loadError}</p>
          </div>
        )}
      </section>

      {loaded && totals && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Package contents</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">File</dt>
              <dd>{loaded.fileName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Exported from</dt>
              <dd>{loaded.manifest.sourceEnvironmentName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(loaded.manifest.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contents</dt>
              <dd>
                {totals.items} item(s), {totals.chunks} chunk(s) in {totals.chunkSets} chunk set(s)
              </dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 text-sm text-muted-foreground">Items in the package</p>
            <ul className="flex flex-col gap-2 text-sm">
              {loaded.manifest.dataTrees.map((tree) => (
                <li key={tree.itemPath} className="rounded-md border p-2">
                  <p className="truncate font-mono text-xs">{tree.itemPath}</p>
                  <p className="text-xs text-muted-foreground">
                    {SCOPE_OPTIONS.find((o) => o.value === tree.scope)?.label} ·{" "}
                    {MERGE_STRATEGY_OPTIONS.find((o) => o.value === tree.mergeStrategy)?.label}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {loaded && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <EnvironmentSelect
              id="install-destination-environment"
              label="Destination"
              choices={choices}
              value={destinationIndex}
              disabled={running}
              onChange={setDestinationIndex}
            />
            {exportedFrom && (
              <p className="text-xs text-muted-foreground">
                {exportedFrom} is disabled because this package was exported from it.
              </p>
            )}
          </div>
          <div className="flex items-end justify-end">
            <Button disabled={!canInstall} onClick={() => setConfirmOpen(true)}>
              Install package
            </Button>
          </div>
        </section>
      )}

      {progress && (
        <div ref={progressRef} className="scroll-mt-6">
          <TransferProgressView progress={progress} outcome={outcome} steps={INSTALL_STEP_IDS} />
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm install</DialogTitle>
            <DialogDescription>
              Install {totals?.items ?? 0} item(s) from <strong>{loaded?.fileName}</strong> into{" "}
              <strong>{destination?.name}</strong>. Existing content may be overwritten, depending on each item&apos;s
              merge strategy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Install</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
