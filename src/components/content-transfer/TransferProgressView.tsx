"use client";

import { mdiAlert, mdiCheckCircle, mdiCircleOutline, mdiCloseCircle } from "@mdi/js";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { LoadingSpinner } from "@/src/components/ui/loading-spinner";
import { Icon } from "@/src/lib/icon";
import type {
  TransferProgress,
  TransferStepId,
  TransferStepState,
} from "@/src/models/contentTransfer";

// Order matches the steps in docs/content-transfer-flow.md.
export const STEP_IDS: TransferStepId[] = [
  "create",
  "status",
  "chunks",
  "complete",
  "consume",
  "blobState",
  "cleanup",
];

const STEP_LABELS: Record<TransferStepId, string> = {
  create: "Create transfer (source)",
  status: "Wait for transfer to build (source)",
  chunks: "Copy chunks",
  complete: "Complete chunk sets (destination)",
  consume: "Consume files (destination)",
  blobState: "Confirm import (destination)",
  package: "Write package file",
  cleanup: "Clean up source transfer",
};

// Lists every step, so a step missing here is a compile error. Entries are never mutated
// (progress updates copy the object), so one shared "pending" value is safe.
export function initialProgress(): TransferProgress {
  const pending: TransferStepState = { status: "pending" };
  return {
    create: pending,
    status: pending,
    chunks: pending,
    complete: pending,
    consume: pending,
    blobState: pending,
    package: pending,
    cleanup: pending,
  };
}

export interface TransferOutcome {
  kind: "success" | "failure";
  message: string;
}

function StepIcon({ status }: { status: TransferStepState["status"] }) {
  switch (status) {
    case "running":
      return <LoadingSpinner label="Running" />;
    case "done":
      return <Icon path={mdiCheckCircle} title="Done" className="size-4 text-green-700" />;
    case "failed":
      return <Icon path={mdiCloseCircle} title="Failed" className="size-4 text-destructive" />;
    case "warning":
      return <Icon path={mdiAlert} title="Warning" className="size-4 text-amber-600" />;
    default:
      return <Icon path={mdiCircleOutline} title="Pending" className="size-4 text-muted-foreground/50" />;
  }
}

// Download package skips the destination steps, so it shows only the steps it runs.
export const DOWNLOAD_STEP_IDS: TransferStepId[] = ["create", "status", "chunks", "package", "cleanup"];

// Install package runs only the destination steps.
export const INSTALL_STEP_IDS: TransferStepId[] = ["chunks", "complete", "consume", "blobState"];

interface TransferProgressViewProps {
  progress: TransferProgress;
  outcome: TransferOutcome | null;
  steps?: TransferStepId[];
}

export function TransferProgressView({ progress, outcome, steps = STEP_IDS }: TransferProgressViewProps) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Progress</h2>

      <ol className="flex flex-col gap-2">
        {steps.map((id) => {
          // Defensive: a step with no entry shows as pending instead of crashing the panel.
          const step: TransferStepState = progress[id] ?? { status: "pending" };
          return (
            <li key={id} className="flex items-start gap-3">
              <span className="mt-0.5">
                <StepIcon status={step.status} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{STEP_LABELS[id]}</p>
                {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
                {step.error && (
                  <p className="text-xs text-destructive" role="alert">
                    {step.error}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {outcome && (
        <Alert variant={outcome.kind === "failure" ? "danger" : "default"}>
          <AlertTitle>{outcome.kind === "failure" ? "Transfer failed" : "Transfer finished"}</AlertTitle>
          <AlertDescription>{outcome.message}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
