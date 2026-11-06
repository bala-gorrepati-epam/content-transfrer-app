import type { DataTree } from "@/src/models/contentTransfer";

// Package file written by Download package and read by Install package.
// Zip layout:
//   manifest.json
//   chunks/set-<index>/chunk-<chunkId>.bin   (one per chunk, the raw Blob from getChunk)
export const PACKAGE_FORMAT_VERSION = 1;

export interface PackageChunk {
  chunkId: number;
  // Path of the chunk inside the zip.
  file: string;
  // From the getChunk Content-Disposition header. Install passes it to saveChunk.
  isMedia: boolean;
}

export interface PackageChunkSet {
  chunkSetId: string;
  chunkCount: number;
  totalItemCount: number;
  chunks: PackageChunk[];
}

export interface PackageManifest {
  formatVersion: number;
  transferId: string;
  createdAt: string; // ISO 8601
  // Display only. Never a context ID.
  sourceEnvironmentName: string;
  // The selection that was exported, for display.
  dataTrees: DataTree[];
  chunkSets: PackageChunkSet[];
}
