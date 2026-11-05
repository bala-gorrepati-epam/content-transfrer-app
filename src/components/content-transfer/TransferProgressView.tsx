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
  chunks: "Copy chunks (source to destination)",
  complete: "Complete chunk sets (destination)",
  consume: "Consume files (destination)",
  blobState: "Confirm import (destination)",
  cleanup: "Clean up source transfer",
};

export function initialProgress(): TransferProgress {
  return Object.fromEntries(
    STEP_IDS.map((id) => [id, { status: "pending" } satisfies TransferStepState]),
  ) as TransferProgress;
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

interface TransferProgressViewProps {
  progress: TransferProgress;
  outcome: TransferOutcome | null;
}

export function TransferProgressView({ progress, outcome }: TransferProgressViewProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Progress</h2>

      <ol className="flex flex-col gap-2">
        {STEP_IDS.map((id) => {
          const step = progress[id];
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
