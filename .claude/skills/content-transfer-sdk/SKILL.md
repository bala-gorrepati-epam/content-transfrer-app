---
name: content-transfer-sdk
description: Exact SDK parameters, call order and data handoffs for the SitecoreAI content transfer flow (createContentTransfer, getContentTransferStatus, getChunk, saveChunk, completeChunkSetTransfer, consumeFile, getBlobState, deleteContentTransfer). Use when writing, changing or debugging code that copies items between two SitecoreAI environments with the Marketplace SDK xmc package.
---

# Content transfer SDK guide

Source of truth: the installed types in `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-content-transfer/` (`types.gen.d.ts` for params and responses, `augmentation.gen.d.ts` for query vs mutate). If this skill disagrees with them, the installed types win.

## How to use this skill
1. Plan with the flow table and the rules below.
2. Before writing a call, read its section in `references/operations.md`.
3. Never guess param names, casing, method or environment.

## Calls
- Operation names: `xmc.contentTransfer.<operation>`.
- Query (`client.query`): `getContentTransferStatus`, `getChunk`, `consumeFile`, `getBlobState`.
- Mutation (`client.mutate`): `createContentTransfer`, `saveChunk`, `completeChunkSetTransfer`, `deleteContentTransfer`.
- Params go in `{ params: { path?, query?, body? } }`.
- Result shapes differ:
  - Mutation: the body is `result.data`, and errors are in `result.error`.
  - Query: the SDK result is `result.data`, so the body is `result.data.data`, raw headers are `result.data.response`, and errors are in `result.error`.
- Every operation takes `sitecoreContextId` in `query`. Pass it explicitly.
- SOURCE = environment items are copied from. DESTINATION = environment items are written to.
- Response casing is inconsistent. Use the casing shown in the reference.

## Flow

| Step | Operation | Environment | Needs | Produces |
|------|-----------|-------------|-------|----------|
| 1 | createContentTransfer | SOURCE | `transferId` (ours), dataTrees | 202, no body |
| 2 | getContentTransferStatus | SOURCE | `transferId` | `State`, `ChunkSetsMetadata[]` |
| 3 | getChunk | SOURCE | `transferId`, `chunksetId`, `chunkId` | `Blob` and `Content-Disposition` header |
| 4 | saveChunk | DESTINATION | same ids as step 3, the `Blob`, `isMedia` | 201, no body |
| 5 | completeChunkSetTransfer | DESTINATION | `transferId`, `chunksetId` | `ContentTransferFileName` |
| 6 | consumeFile | DESTINATION | `databaseName`, `fileName` (with `blob://`) | 202, no body |
| 7 | getBlobState | DESTINATION | `fileName` (without `blob://`) | `BlobState`, `Error` |
| 8 | deleteContentTransfer | SOURCE | `transferId` | 202, no body |

## Rules across steps
- Generate `transferId` once per run with `crypto.randomUUID()`. Reuse it in steps 1 to 5 and 8.
- `chunksetId` values come from `ChunkSetsMetadata[].ChunkSetId` (step 2). Loop `chunkId` over each chunk set's `ChunkCount`, and use the same ids for steps 3 and 4.
- Do not call getChunk until step 2 reports `State` as `Completed`.
- Call step 5 once per chunk set, after all its chunks are saved. Keep every returned `ContentTransferFileName`.
- 202 means asynchronous. Poll step 2 after creating the transfer, and step 7 after consuming.
- Step 6 takes the file name with a `blob://` prefix. Step 7 takes it without the prefix.
- Always run step 8, also when an earlier step fails, so source transfers are not left behind.
- Keep chunk data as a `Blob` from step 3 to step 4. Never convert it to text or JSON.
- `isMedia` for saveChunk comes from the same chunk's `Content-Disposition` header in step 3. If the value is missing, fail the run rather than guess.
- The dataTrees fields (`itemPath`, `scope`, `mergeStrategy`) are optional in the types. Make them required in our own wrapper types.
- Enum values are exact:
  - Scope: `SingleItem`, `ItemAndDescendants`.
  - MergeStrategy: `OverrideExistingItem`, `KeepExistingItem`, `LatestWin`, `OverrideExistingTree`. There is no `SkipIfExist`.
- Never log bearer tokens or context IDs.
