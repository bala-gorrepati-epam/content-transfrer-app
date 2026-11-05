import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { BlobStateResponse, DataTree, TransferStepId, TransferStepState } from "@/src/models/contentTransfer";

// Polling, per docs/content-transfer-flow.md.
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60_000;

const DATABASE_NAME = "master";

// UNVERIFIED: transfer states other than "Completed". Any state not listed here fails the run,
// and its raw name is shown. Update once a real run reports the actual names.
const TRANSFER_IN_PROGRESS_STATES = new Set(["Pending", "InProgress", "Running", "Queued", "Created"]);

// UNVERIFIED: chunk ids may start at 0 or 1. Change to 1 if the first real run shows that.
const CHUNK_ID_START = 0;

// getBlobState: BlobState "Consumed" completes; a non-null Error fails; any other state keeps polling
// until the timeout. Only "Consumed" has been observed so far.
const BLOB_CONSUMED_STATE = "Consumed";

export type ProgressReporter = (step: TransferStepId, state: TransferStepState) => void;

export interface RunTransferArgs {
  client: ClientSDK;
  sourceContextId: string;
  destinationContextId: string;
  dataTrees: DataTree[];
  onProgress: ProgressReporter;
}

export interface RunTransferResult {
  transferId: string;
  fileNames: string[];
}

// Carries the step that failed, so the UI can show which step broke.
export class TransferStepError extends Error {
  readonly step: TransferStepId;

  constructor(step: TransferStepId, message: string) {
    super(message);
    this.name = "TransferStepError";
    this.step = step;
  }
}

type PollStep<T> =
  | { kind: "done"; value: T }
  | { kind: "pending"; detail?: string }
  | { kind: "failed"; message: string };

function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  try {
    return JSON.stringify(err) ?? "Unknown error";
  } catch {
    return "Unknown error";
  }
}

// SDK responses carry `error` when the call failed. The SDK's response type is a union, and not
// every branch has `error`, so the check uses `in`. Success responses for 202 calls have no body,
// so only the error is checked here.
function assertNoError(response: object | undefined, what: string) {
  if (!response) throw new Error(`${what}: no response received.`);
  if ("error" in response && response.error) {
    throw new Error(`${what}: ${errorMessage(response.error)}`);
  }
}

// The getChunk response reports whether the chunk is media in its Content-Disposition header, e.g.
// "form-data; ItemsProcessed=1; ItemsSkipped=0; IsMedia=false". saveChunk needs that value, so a
// missing value fails the run rather than guessing.
function readIsMedia(response: Response | undefined, chunkSetId: string, chunkId: number): boolean {
  const header = response?.headers.get("Content-Disposition") ?? "";
  const match = /(?:^|;)\s*IsMedia\s*=\s*(true|false)\s*(?:;|$)/i.exec(header);
  if (!match) {
    throw new Error(`Chunk ${chunkId} of chunk set ${chunkSetId} has no IsMedia value in its Content-Disposition header.`);
  }
  return match[1].toLowerCase() === "true";
}

// consumeFile takes the file name with a blob:// prefix; getBlobState takes it without one.
// The prefix is added only when missing, so a name that already has it is not doubled.
function toBlobFileName(contentTransferFileName: string): string {
  return contentTransferFileName.startsWith("blob://")
    ? contentTransferFileName
    : `blob://${contentTransferFileName}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function poll<T>(
  label: string,
  check: () => Promise<PollStep<T>>,
  onPending: (detail?: string) => void,
): Promise<T> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const result = await check();
    if (result.kind === "done") return result.value;
    if (result.kind === "failed") throw new Error(result.message);
    onPending(result.detail);
    if (Date.now() >= deadline) {
      throw new Error(`${label} did not finish within 10 minutes.`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

// Direct transfer: source -> destination, steps 1 to 8 from docs/content-transfer-flow.md.
// Progress is reported per step. On failure, the failed step is thrown as TransferStepError
// after cleanup has run.
export async function runTransfer({
  client,
  sourceContextId,
  destinationContextId,
  dataTrees,
  onProgress,
}: RunTransferArgs): Promise<RunTransferResult> {
  // One id per run, reused for every call that refers to this transfer.
  const transferId = crypto.randomUUID();
  const fileNames: string[] = [];
  let current: TransferStepId = "create";
  let failure: TransferStepError | null = null;

  try {
    // 1. Create (source). The transfer is built asynchronously, so step 2 polls.
    onProgress("create", { status: "running" });
    const created = await client.mutate("xmc.contentTransfer.createContentTransfer", {
      params: {
        query: { sitecoreContextId: sourceContextId },
        body: { transferId, configuration: { dataTrees } },
      },
    });
    assertNoError(created, "Create transfer");
    onProgress("create", { status: "done" });

    // 2. Status (source). Poll until completed; this gives the chunk sets to fetch.
    current = "status";
    onProgress("status", { status: "running" });
    const chunkSets = await poll(
      "Transfer",
      async () => {
        const res = await client.query("xmc.contentTransfer.getContentTransferStatus", {
          params: {
            path: { transferId },
            query: { sitecoreContextId: sourceContextId },
          },
        });
        if (res.error) throw new Error(errorMessage(res.error));
        assertNoError(res.data, "Read transfer status");
        const body = res.data?.data;
        if (!body) throw new Error("Read transfer status: empty response.");

        if (body.State === "Completed") {
          return { kind: "done", value: body.ChunkSetsMetadata };
        }
        if (TRANSFER_IN_PROGRESS_STATES.has(body.State)) {
          return { kind: "pending", detail: `State: ${body.State}` };
        }
        return { kind: "failed", message: `Transfer ended in state "${body.State}".` };
      },
      (detail) => onProgress("status", { status: "running", detail }),
    );
    onProgress("status", { status: "done" });

    // 3 and 4. Fetch each chunk from the source and save it to the destination, one at a time.
    current = "chunks";
    const totalChunks = chunkSets.reduce((sum, set) => sum + set.ChunkCount, 0);
    let savedChunks = 0;
    onProgress("chunks", { status: "running", detail: `0 of ${totalChunks}` });

    for (const set of chunkSets) {
      for (let index = 0; index < set.ChunkCount; index++) {
        const chunkId = CHUNK_ID_START + index;
        const chunkParams = {
          path: { transferId, chunksetId: set.ChunkSetId, chunkId },
        };

        const chunkRes = await client.query("xmc.contentTransfer.getChunk", {
          params: {
            ...chunkParams,
            query: { sitecoreContextId: sourceContextId },
          },
        });
        if (chunkRes.error) throw new Error(errorMessage(chunkRes.error));
        assertNoError(chunkRes.data, `Read chunk ${chunkId}`);
        const blob = chunkRes.data?.data;
        // Blob is passed through unchanged. An empty blob means the client did not return the body.
        if (!blob || !(blob.size > 0)) {
          throw new Error(`Chunk ${chunkId} of chunk set ${set.ChunkSetId} came back empty.`);
        }
        const isMedia = readIsMedia(chunkRes.data?.response, set.ChunkSetId, chunkId);

        const saved = await client.mutate("xmc.contentTransfer.saveChunk", {
          params: {
            ...chunkParams,
            query: { sitecoreContextId: destinationContextId, isMedia },
            body: blob,
          },
        });
        assertNoError(saved, `Save chunk ${chunkId}`);

        savedChunks += 1;
        onProgress("chunks", { status: "running", detail: `${savedChunks} of ${totalChunks}` });
      }
    }
    onProgress("chunks", { status: "done", detail: `${savedChunks} of ${totalChunks}` });

    // 5. Complete each chunk set (destination). Each one produces a file to consume.
    current = "complete";
    onProgress("complete", { status: "running" });
    for (const set of chunkSets) {
      const completed = await client.mutate("xmc.contentTransfer.completeChunkSetTransfer", {
        params: {
          path: { transferId, chunksetId: set.ChunkSetId },
          query: { sitecoreContextId: destinationContextId },
        },
      });
      assertNoError(completed, "Complete chunk set");
      const fileName = completed.data?.ContentTransferFileName;
      if (!fileName) throw new Error(`No file name returned for chunk set ${set.ChunkSetId}.`);
      fileNames.push(fileName);
    }
    onProgress("complete", { status: "done", detail: `${fileNames.length} file(s)` });

    // 6. Consume each file (destination). The call is asynchronous; step 7 checks its state.
    current = "consume";
    onProgress("consume", { status: "running" });
    for (const fileName of fileNames) {
      const consumed = await client.query("xmc.contentTransfer.consumeFile", {
        params: {
          query: {
            databaseName: DATABASE_NAME,
            fileName: toBlobFileName(fileName),
            sitecoreContextId: destinationContextId,
          },
        },
      });
      if (consumed.error) throw new Error(errorMessage(consumed.error));
      assertNoError(consumed.data, "Consume file");
    }
    onProgress("consume", { status: "done" });

    // 7. Blob state (destination). Poll each file until its BlobState is "Consumed".
    current = "blobState";
    for (const fileName of fileNames) {
      onProgress("blobState", { status: "running", detail: fileName });
      await poll(
        `Consuming ${fileName}`,
        async () => {
          const res = await client.query("xmc.contentTransfer.getBlobState", {
            params: {
              query: { fileName: fileName, sitecoreContextId: destinationContextId },
            },
          });
          if (res.error) throw new Error(errorMessage(res.error));
          assertNoError(res.data, "Read file state");
          // Typed locally: the installed SDK types do not match the real response.
          const body = res.data?.data as unknown as BlobStateResponse | undefined;
          if (body?.Error) {
            return {
              kind: "failed",
              message: `Consuming ${fileName} failed: ${errorMessage(body.Error)}`,
            };
          }
          if (body?.BlobState === BLOB_CONSUMED_STATE) return { kind: "done", value: undefined };
          return { kind: "pending", detail: `${fileName}: ${body?.BlobState ?? "no state"}` };
        },
        (detail) => onProgress("blobState", { status: "running", detail }),
      );
    }
    onProgress("blobState", { status: "done" });
  } catch (error) {
    failure = new TransferStepError(current, errorMessage(error));
    onProgress(current, { status: "failed", error: failure.message });
  }

  // 8. Cleanup (source). Runs on success and on failure so the source transfer is not left behind.
  // A cleanup error is a warning and never replaces the original failure.
  onProgress("cleanup", { status: "running" });
  try {
    const deleted = await client.mutate("xmc.contentTransfer.deleteContentTransfer", {
      params: {
        path: { transferId },
        query: { sitecoreContextId: sourceContextId },
      },
    });
    assertNoError(deleted, "Clean up source transfer");
    onProgress("cleanup", { status: "done" });
  } catch (error) {
    onProgress("cleanup", { status: "warning", error: errorMessage(error) });
  }

  if (failure) throw failure;
  return { transferId, fileNames };
}
