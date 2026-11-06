# Content transfer flow
Source operations use the source context ID. Destination operations use the destination context ID.

1. Source: `xmc.contentTransfer.createContentTransfer` with `configuration.dataTrees`: one entry per selected item, each with `itemPath`, `scope` (`SingleItem` | `ItemAndDescendants`) and `mergeStrategy`. Shape in `src/models/contentTransfer.ts` (`DataTree`).
2. Source: `xmc.contentTransfer.getContentTransferStatus`, poll every `5` s, timeout `10` min, until completed
3. Source: `xmc.contentTransfer.getChunk` for each chunk, sequentially (one chunk at a time, then its save in step 4). Keep the chunk as a Blob.
4. Destination: `xmc.contentTransfer.saveChunk` for each chunk
5. Destination: `xmc.contentTransfer.completeChunkSetTransfer`
6. Destination: `xmc.contentTransfer.consumeFile`
7. Destination: `xmc.contentTransfer.getBlobState` to read the result
8. Source: `xmc.contentTransfer.deleteContentTransfer` (also run on failure, as cleanup)

## Modes
- Direct transfer: steps 1 to 8. Needs a source and a destination (they must differ).
- Download package: only steps 1 to 3 are relevant (source only). After step 3, bundle the chunks into a
  package file and offer it as a download. No destination is used. Step 8 still runs as cleanup so the
  source transfer is not left behind.
- Install from package: only steps 4 to 7 are relevant (destination only). The chunks come from an
  uploaded package instead of step 3. Steps 1 to 3 and 8 do not run.
  
## Package
- The package must keep everything steps 4 to 7 need: the chunk Blobs, and for each one its `chunksetId`
  and `chunkId`. Also keep the transfer id, the chunk count per chunk set, and the dataTrees that were
  requested (for display).
- Validate an uploaded package before step 4 and show the user what it contains. Ask the user to
  confirm the destination before installing.
- For install from package, step 4 needs a `transferId`. Use a new id generated with `crypto.randomUUID()`.

### Package file format (implemented by Download package)
A zip with this layout (`src/lib/contentPackage.ts`, types in `src/models/contentPackage.ts`):
- `manifest.json`: `formatVersion` (1), `transferId`, `createdAt` (ISO), `sourceEnvironmentName` (display only),
  `dataTrees` (the selection, for display), and `chunkSets`.
- Each chunk set: `chunkSetId`, `chunkCount`, `totalItemCount`, and `chunks`.
- Each chunk: `chunkId`, `file` (its path in the zip) and `isMedia` (from the getChunk `IsMedia` header, so
  Install can pass it to saveChunk).
- Chunk bytes: `chunks/set-<index>/chunk-<chunkId>.bin`, copied unchanged from the getChunk Blob.

Delivery (Download package):
- The zip is written in memory (chunks are compressed as they arrive) and offered through a Download button.
  One zip file.
- A save dialog was tried and removed: the Marketplace iframe blocks the file picker (SecurityError), and the
  streaming benefit did not justify it.

Install package (implemented in `src/components/content-transfer/InstallPackageMode.tsx`):
- The user uploads a zip. `readPackage` (`src/lib/contentPackage.ts`) checks it: manifest.json exists, formatVersion
  matches, every chunk file listed in the manifest exists and is not empty, and chunk counts match. All problems are
  shown together. Nothing is sent until the package is valid.
- The package contents are shown (source name, creation time, items, chunk counts). The user picks the destination
  and confirms. Destination must be chosen; source is not needed.
- Steps 4 to 7 run with a new transferId (`crypto.randomUUID()`). Each chunk is saved with the chunkSetId, chunkId
  and isMedia from the manifest. No source calls and no cleanup step.

## Failure handling
- Show which step failed and the error message.
- No retries. A failed step stops the run. Step 8 (cleanup) still runs, and a cleanup error is shown as a warning without hiding the original failure.