import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { BlobStateResponse, DataTree, TransferStepId, TransferStepState } from "@/src/models/contentTransfer";
import type { PackageChunkSet, PackageManifest } from "@/src/models/contentPackage";
import { PACKAGE_FORMAT_VERSION } from "@/src/models/contentPackage";
import { PackageZipWriter, MANIFEST_FILE, type PackageSink } from "@/src/lib/contentPackage";

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

// Direct transfer: source -> destination, steps 1 to 8.
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

// Download package: source only, steps 1 to 3 plus cleanup (8), then the zip is built.
export interface RunDownloadArgs {
  client: ClientSDK;
  sourceContextId: string;
  sourceEnvironmentName: string;
  dataTrees: DataTree[];
  transferId: string;
  // Where the zip is written. Chunks are written as they arrive, so memory stays flat.
  sink: PackageSink;
  onProgress: ProgressReporter;
}

export interface RunDownloadResult {
  transferId: string;
  chunkCount: number;
}

// Install package: destination only, steps 4 to 7 from a package file. No source, so no cleanup.
export interface RunInstallArgs {
  client: ClientSDK;
  destinationContextId: string;
  manifest: PackageManifest;
  // Chunk bytes by their `file` path in the manifest.
  files: Map<string, Uint8Array>;
  onProgress: ProgressReporter;
}

export interface RunInstallResult {
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

// Everything the source-side step helpers need for one run.
interface RunContext {
  client: ClientSDK;
  sourceContextId: string;
  transferId: string;
  onProgress: ProgressReporter;
}

// Everything the destination-side step helpers need for one run.
interface DestinationContext {
  client: ClientSDK;
  destinationContextId: string;
  transferId: string;
  onProgress: ProgressReporter;
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

// Step 8: runs on success and on failure so the source transfer is not left behind.
// A cleanup error is a warning and never replaces the original failure.
async function cleanupSource(ctx: RunContext) {
  ctx.onProgress("cleanup", { status: "running" });
  try {
    const deleted = await ctx.client.mutate("xmc.contentTransfer.deleteContentTransfer", {
      params: {
        path: { transferId: ctx.transferId },
        query: { sitecoreContextId: ctx.sourceContextId },
      },
    });
    assertNoError(deleted, "Clean up source transfer");
    ctx.onProgress("cleanup", { status: "done" });
  } catch (error) {
    ctx.onProgress("cleanup", { status: "warning", error: errorMessage(error) });
  }
}

type StepStarter = (step: TransferStepId, detail?: string) => void;

// Runs one transfer. A failure is attributed to the step that was started last, and cleanup
// always runs before the error is thrown.
async function runSteps<T>(ctx: RunContext, body: (start: StepStarter) => Promise<T>): Promise<T> {
  let current: TransferStepId = "create";
  const start: StepStarter = (step, detail) => {
    current = step;
    ctx.onProgress(step, { status: "running", detail });
  };

  let outcome: { ok: true; value: T } | { ok: false; error: TransferStepError };
  try {
    outcome = { ok: true, value: await body(start) };
  } catch (error) {
    const failed = new TransferStepError(current, errorMessage(error));
    ctx.onProgress(current, { status: "failed", error: failed.message });
    outcome = { ok: false, error: failed };
  }

  await cleanupSource(ctx);
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

// Install-side runner. No source and no cleanup, so a failure is only attributed and rethrown.
async function runDestinationSteps<T>(
  onProgress: ProgressReporter,
  body: (start: StepStarter) => Promise<T>,
): Promise<T> {
  let current: TransferStepId = "chunks";
  const start: StepStarter = (step, detail) => {
    current = step;
    onProgress(step, { status: "running", detail });
  };
  try {
    return await body(start);
  } catch (error) {
    const failed = new TransferStepError(current, errorMessage(error));
    onProgress(current, { status: "failed", error: failed.message });
    throw failed;
  }
}

// Step 1 (source). The transfer is built asynchronously; waitForChunkSets polls it.
async function createTransfer(ctx: RunContext, dataTrees: DataTree[]) {
  const created = await ctx.client.mutate("xmc.contentTransfer.createContentTransfer", {
    params: {
      query: { sitecoreContextId: ctx.sourceContextId },
      body: { transferId: ctx.transferId, configuration: { dataTrees } },
    },
  });
  assertNoError(created, "Create transfer");
}

// Step 2 (source). Polls until the transfer is Completed and returns its chunk sets.
async function waitForChunkSets(ctx: RunContext, onPending: (detail?: string) => void) {
  return poll(
    "Transfer",
    async () => {
      const res = await ctx.client.query("xmc.contentTransfer.getContentTransferStatus", {
        params: {
          path: { transferId: ctx.transferId },
          query: { sitecoreContextId: ctx.sourceContextId },
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
    onPending,
  );
}

// Step 3 (source): one chunk. The Blob is returned unchanged, with its IsMedia flag.
async function fetchChunk(ctx: RunContext, set: { ChunkSetId: string }, chunkId: number) {
  const chunkRes = await ctx.client.query("xmc.contentTransfer.getChunk", {
    params: {
      path: { transferId: ctx.transferId, chunksetId: set.ChunkSetId, chunkId },
      query: { sitecoreContextId: ctx.sourceContextId },
    },
  });
  if (chunkRes.error) throw new Error(errorMessage(chunkRes.error));
  assertNoError(chunkRes.data, `Read chunk ${chunkId}`);
  const blob = chunkRes.data?.data;
  // An empty blob means the client did not return the body.
  if (!blob || !(blob.size > 0)) {
    throw new Error(`Chunk ${chunkId} of chunk set ${set.ChunkSetId} came back empty.`);
  }
  const isMedia = readIsMedia(chunkRes.data?.response, set.ChunkSetId, chunkId);
  return { blob, isMedia };
}

function chunkIdsOf(set: { ChunkCount: number }): number[] {
  return Array.from({ length: set.ChunkCount }, (_, index) => CHUNK_ID_START + index);
}

// Steps 5 to 7 (destination), shared by Transfer and Install package. Completes each chunk set,
// consumes the files, then waits until each one reports Consumed. Returns the file names.
async function importOnDestination(
  ctx: DestinationContext,
  start: StepStarter,
  chunkSetIds: string[],
): Promise<string[]> {
  const { client, destinationContextId, transferId, onProgress } = ctx;

  // 5. Complete each chunk set (destination). Each one produces a file to consume.
  start("complete");
  const fileNames: string[] = [];
  for (const chunkSetId of chunkSetIds) {
    const completed = await client.mutate("xmc.contentTransfer.completeChunkSetTransfer", {
      params: {
        path: { transferId, chunksetId: chunkSetId },
        query: { sitecoreContextId: destinationContextId },
      },
    });
    assertNoError(completed, "Complete chunk set");
    const fileName = completed.data?.ContentTransferFileName;
    if (!fileName) throw new Error(`No file name returned for chunk set ${chunkSetId}.`);
    fileNames.push(fileName);
  }
  onProgress("complete", { status: "done", detail: `${fileNames.length} file(s)` });

  // 6. Consume each file (destination). The call is asynchronous; step 7 checks its state.
  start("consume");
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
  start("blobState");
  for (const fileName of fileNames) {
    onProgress("blobState", { status: "running", detail: fileName });
    await poll(
      `Consuming ${fileName}`,
      async () => {
        const res = await client.query("xmc.contentTransfer.getBlobState", {
          params: {
            query: { fileName, sitecoreContextId: destinationContextId },
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
  return fileNames;
}

// Direct transfer: source -> destination, steps 1 to 8 from docs/content-transfer-flow.md.
// On failure, the failed step is thrown as TransferStepError after cleanup has run.
export async function runTransfer({
  client,
  sourceContextId,
  destinationContextId,
  dataTrees,
  onProgress,
}: RunTransferArgs): Promise<RunTransferResult> {
  // One id per run, reused for every call that refers to this transfer.
  const ctx: RunContext = { client, sourceContextId, transferId: crypto.randomUUID(), onProgress };
  const { transferId } = ctx;

  const fileNames = await runSteps(ctx, async (start) => {
    start("create");
    await createTransfer(ctx, dataTrees);
    onProgress("create", { status: "done" });

    start("status");
    const chunkSets = await waitForChunkSets(ctx, (detail) => onProgress("status", { status: "running", detail }));
    onProgress("status", { status: "done" });

    // 3 and 4. Fetch each chunk from the source and save it to the destination, one at a time.
    const totalChunks = chunkSets.reduce((sum, set) => sum + set.ChunkCount, 0);
    let savedChunks = 0;
    start("chunks", `0 of ${totalChunks}`);
    for (const set of chunkSets) {
      for (const chunkId of chunkIdsOf(set)) {
        const { blob, isMedia } = await fetchChunk(ctx, set, chunkId);

        const saved = await client.mutate("xmc.contentTransfer.saveChunk", {
          params: {
            path: { transferId, chunksetId: set.ChunkSetId, chunkId },
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

    // 5 to 7. Complete, consume and confirm on the destination.
    return importOnDestination(
      { client, destinationContextId, transferId, onProgress },
      start,
      chunkSets.map((set) => set.ChunkSetId),
    );
  });

  return { transferId, fileNames };
}

// Download package: exports the selection from the source and bundles it into one zip.
// Steps 1 to 3, with each chunk written into the zip as it is fetched, then cleanup (step 8).
// The zip keeps everything Install needs: chunk bytes, chunkSetId and chunkId per chunk, IsMedia,
// and the transfer details.
export async function runDownloadPackage({
  client,
  sourceContextId,
  sourceEnvironmentName,
  dataTrees,
  transferId,
  sink,
  onProgress,
}: RunDownloadArgs): Promise<RunDownloadResult> {
  const ctx: RunContext = { client, sourceContextId, transferId, onProgress };

  return runSteps(ctx, async (start) => {
    const writer = new PackageZipWriter(sink);
    let fetched = 0;
    try {
      start("create");
      await createTransfer(ctx, dataTrees);
      onProgress("create", { status: "done" });

      start("status");
      const chunkSets = await waitForChunkSets(ctx, (detail) => onProgress("status", { status: "running", detail }));
      onProgress("status", { status: "done" });

      // 3. Fetch each chunk and write it into the zip right away, so only one chunk is in memory at a time.
      const totalChunks = chunkSets.reduce((sum, set) => sum + set.ChunkCount, 0);
      const manifestSets: PackageChunkSet[] = [];

      start("chunks", `0 of ${totalChunks}`);
      for (const [setIndex, set] of chunkSets.entries()) {
        const chunks: PackageChunkSet["chunks"] = [];
        for (const chunkId of chunkIdsOf(set)) {
          const { blob, isMedia } = await fetchChunk(ctx, set, chunkId);
          const file = `chunks/set-${setIndex}/chunk-${chunkId}.bin`;
          writer.addFile(file, new Uint8Array(await blob.arrayBuffer()));
          chunks.push({ chunkId, file, isMedia });

          fetched += 1;
          onProgress("chunks", { status: "running", detail: `${fetched} of ${totalChunks}` });
        }
        manifestSets.push({
          chunkSetId: set.ChunkSetId,
          chunkCount: set.ChunkCount,
          totalItemCount: set.TotalItemCount,
          chunks,
        });
      }
      onProgress("chunks", { status: "done", detail: `${fetched} of ${totalChunks}` });

      // The manifest goes last: it lists every chunk, so it can only be written once they are all known.
      start("package");
      const manifest: PackageManifest = {
        formatVersion: PACKAGE_FORMAT_VERSION,
        transferId,
        createdAt: new Date().toISOString(),
        sourceEnvironmentName,
        dataTrees,
        chunkSets: manifestSets,
      };
      writer.addFile(MANIFEST_FILE, new TextEncoder().encode(JSON.stringify(manifest, null, 2)));
      await writer.finish();
      onProgress("package", { status: "done" });
    } catch (error) {
      // Discard the partial file so the user is not left with a broken package.
      await sink.abort().catch(() => undefined);
      throw error;
    }

    return { transferId, chunkCount: fetched };
  });
}

// Install package: imports a validated package into the destination. Steps 4 to 7.
// A new transferId is generated, as docs/content-transfer-flow.md requires. The source is not used,
// so there is no cleanup step.
export async function runInstallPackage({
  client,
  destinationContextId,
  manifest,
  files,
  onProgress,
}: RunInstallArgs): Promise<RunInstallResult> {
  const transferId = crypto.randomUUID();

  return runDestinationSteps(onProgress, async (start) => {
    // 4. Save each chunk to the destination with the ids and IsMedia value from the package.
    const totalChunks = manifest.chunkSets.reduce((sum, set) => sum + set.chunks.length, 0);
    let savedChunks = 0;
    start("chunks", `0 of ${totalChunks}`);
    for (const set of manifest.chunkSets) {
      for (const chunk of set.chunks) {
        const bytes = files.get(chunk.file);
        if (!bytes) throw new Error(`Chunk ${chunk.chunkId} of chunk set ${set.chunkSetId} is missing from the package.`);

        const saved = await client.mutate("xmc.contentTransfer.saveChunk", {
          params: {
            path: { transferId, chunksetId: set.chunkSetId, chunkId: chunk.chunkId },
            query: { sitecoreContextId: destinationContextId, isMedia: chunk.isMedia },
            // Bytes go to the SDK unchanged. The cast only tells TypeScript the buffer type.
            body: new Blob([bytes as unknown as BlobPart]),
          },
        });
        assertNoError(saved, `Save chunk ${chunk.chunkId}`);

        savedChunks += 1;
        onProgress("chunks", { status: "running", detail: `${savedChunks} of ${totalChunks}` });
      }
    }
    onProgress("chunks", { status: "done", detail: `${savedChunks} of ${totalChunks}` });

    // 5 to 7. Complete, consume and confirm on the destination.
    const fileNames = await importOnDestination(
      { client, destinationContextId, transferId, onProgress },
      start,
      manifest.chunkSets.map((set) => set.chunkSetId),
    );
    return { transferId, fileNames };
  });
}
