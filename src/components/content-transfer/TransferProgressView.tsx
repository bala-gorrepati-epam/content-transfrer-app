"use client";

import { CircleCheck, CircleX, Circle, LoaderCircle, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
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
      return <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Running" />;
    case "done":
      return <CircleCheck className="size-4 text-emerald-600" aria-label="Done" />;
    case "failed":
      return <CircleX className="size-4 text-destructive" aria-label="Failed" />;
    case "warning":
      return <TriangleAlert className="size-4 text-amber-600" aria-label="Warning" />;
    default:
      return <Circle className="size-4 text-muted-foreground/50" aria-label="Pending" />;
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
    <section className="flex flex-col gap-4">
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
        <Alert variant={outcome.kind === "failure" ? "destructive" : "default"}>
          <AlertTitle>{outcome.kind === "failure" ? "Transfer failed" : "Transfer finished"}</AlertTitle>
          <AlertDescription>{outcome.message}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
