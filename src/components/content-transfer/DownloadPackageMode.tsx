"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { EnvironmentSelect } from "@/src/components/content-transfer/EnvironmentSelect";
import { SelectionPanel } from "@/src/components/content-transfer/SelectionPanel";
import { SourceTree } from "@/src/components/content-transfer/SourceTree";
import {
  DOWNLOAD_STEP_IDS,
  TransferProgressView,
  initialProgress,
  type TransferOutcome,
} from "@/src/components/content-transfer/TransferProgressView";
import type { FeatureProps } from "@/src/features/registry";
import { createMemorySink } from "@/src/lib/contentPackage";
import { runDownloadPackage } from "@/src/lib/contentTransfer";
import type { TransferProgress } from "@/src/models/contentTransfer";
import { useSourceBrowser } from "@/src/utils/hooks/useSourceBrowser";
import { useReportBusy } from "@/src/features/busy";

interface PackageResult {
  fileName: string;
  blob: Blob;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Creating the package failed.";
}

// Download package: pick a source, select items in its tree, build a zip package and download it.
// The package is built in memory and offered through the Download button. No destination is used.
// Install package reads this file.
export function DownloadPackageMode({ client, environments }: FeatureProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [outcome, setOutcome] = useState<TransferOutcome | null>(null);
  const [result, setResult] = useState<PackageResult | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Scroll the progress panel into view when a run starts (same as Transfer).
  useEffect(() => {
    if (running) progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [running]);

  const { choices, sourceIndex, setSourceIndex, source, tree, selection, treeActions } = useSourceBrowser(
    client,
    environments,
  );

  const canCreate = Boolean(source) && selection.items.length > 0 && !running;

  useReportBusy(running);

  // Resets this tab. The tree and selection clear themselves when the source is cleared.
  const handleClear = () => {
    setSourceIndex(null);
    setResult(null);
    setProgress(null);
    setOutcome(null);
  };

  const handleCreate = async () => {
    if (!source || running) return;
    const transferId = crypto.randomUUID();
    const fileName = `content-package-${transferId}.zip`;
    setRunning(true);
    setOutcome(null);
    setResult(null);
    setProgress(initialProgress());

    const memory = createMemorySink();
    try {
      const packaged = await runDownloadPackage({
        client,
        sourceContextId: source.contextId,
        sourceEnvironmentName: source.name,
        dataTrees: selection.items.map((item) => ({
          itemPath: item.path,
          scope: item.scope,
          mergeStrategy: item.mergeStrategy,
        })),
        transferId,
        sink: memory.sink,
        onProgress: (step, state) =>
          setProgress((prev) => (prev ? { ...prev, [step]: state } : prev)),
      });
      setResult({ fileName, blob: memory.toBlob() });
      setOutcome({
        kind: "success",
        message: `Package built with ${packaged.chunkCount} chunk(s). Download it below.`,
      });
    } catch (error) {
      setOutcome({ kind: "failure", message: errorText(error) });
    } finally {
      setRunning(false);
    }
  };

  // The object URL exists only while the download is triggered, then it is released.
  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
          id="download-source-environment"
          label="Source"
          choices={choices}
          value={sourceIndex}
          disabled={running}
          onChange={setSourceIndex}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Source items</h2>
          {source ? (
            <SourceTree nodes={tree.nodes} actions={treeActions} />
          ) : (
            <p className="text-sm text-muted-foreground">Choose a source environment to browse items.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Selected items</h2>
          <SelectionPanel
            items={selection.items}
            disabled={running}
            onChangeScope={selection.setScope}
            onChangeMergeStrategy={selection.setMergeStrategy}
            onRemove={selection.deselect}
          />
          <div className="flex justify-end">
            <Button disabled={!canCreate} onClick={handleCreate}>
              Create package
            </Button>
          </div>
        </section>
      </div>

      {progress && (
        <div ref={progressRef} className="scroll-mt-6 flex flex-col gap-4">
          <TransferProgressView progress={progress} outcome={outcome} steps={DOWNLOAD_STEP_IDS} />
          {result && (
            <div>
              <Button variant="outline" onClick={handleDownload}>
                Download {result.fileName}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
