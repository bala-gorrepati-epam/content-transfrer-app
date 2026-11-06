import { Zip, ZipDeflate, strFromU8, unzipSync } from "fflate";
import { PACKAGE_FORMAT_VERSION, type PackageManifest } from "@/src/models/contentPackage";

export const MANIFEST_FILE = "manifest.json";

// Where the package bytes go. Download uses the in-memory sink.
export interface PackageSink {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

// Writes one zip incrementally: each entry is compressed and pushed to the sink as it is added.
export class PackageZipWriter {
  private readonly zip: Zip;
  private pending: Promise<void> = Promise.resolve();
  private writeError: unknown = null;

  constructor(private readonly sink: PackageSink) {
    this.zip = new Zip((err, data) => {
      if (err) {
        this.writeError ??= err;
        return;
      }
      // Writes are queued so they reach the sink in order.
      this.pending = this.pending.then(() => this.sink.write(data));
    });
  }

  addFile(name: string, data: Uint8Array) {
    const entry = new ZipDeflate(name, { level: 6 });
    this.zip.add(entry);
    entry.push(data, true);
  }

  // Ends the zip, waits for every queued write, then closes the sink.
  async finish(): Promise<void> {
    this.zip.end();
    await this.pending;
    if (this.writeError) throw this.writeError;
    await this.sink.close();
  }
}

// In-memory sink, exposed as a Blob for the Download button.
export function createMemorySink() {
  const parts: Uint8Array[] = [];
  const sink: PackageSink = {
    write: async (data) => {
      parts.push(data);
    },
    close: async () => {},
    abort: async () => {
      parts.length = 0;
    },
  };
  return {
    sink,
    toBlob: () => new Blob(parts as unknown as BlobPart[], { type: "application/zip" }),
  };
}

export class PackageValidationError extends Error {}

export interface ReadPackageResult {
  manifest: PackageManifest;
  // Chunk bytes by their `file` path in the manifest.
  files: Map<string, Uint8Array>;
}

// Reads and validates an uploaded package. Every problem found is listed in one error, so the
// user sees the whole list at once.
export function readPackage(bytes: Uint8Array): ReadPackageResult {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new PackageValidationError("The file is not a valid zip package.");
  }

  const manifestBytes = entries[MANIFEST_FILE];
  if (!manifestBytes) {
    throw new PackageValidationError("manifest.json is missing. This is not a content package.");
  }

  let manifest: PackageManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as PackageManifest;
  } catch {
    throw new PackageValidationError("manifest.json is not valid JSON.");
  }

  const problems: string[] = [];
  if (manifest.formatVersion !== PACKAGE_FORMAT_VERSION) {
    problems.push(`Unsupported package format ${String(manifest.formatVersion)}. Expected ${PACKAGE_FORMAT_VERSION}.`);
  }
  if (typeof manifest.transferId !== "string" || manifest.transferId === "") {
    problems.push("transferId is missing.");
  }
  if (!Array.isArray(manifest.chunkSets) || manifest.chunkSets.length === 0) {
    problems.push("The package has no chunk sets.");
  }

  const files = new Map<string, Uint8Array>();
  for (const set of Array.isArray(manifest.chunkSets) ? manifest.chunkSets : []) {
    if (!set.chunkSetId) problems.push("A chunk set has no chunkSetId.");
    if (!Array.isArray(set.chunks)) {
      problems.push(`Chunk set ${set.chunkSetId} has no chunk list.`);
      continue;
    }
    if (set.chunks.length !== set.chunkCount) {
      problems.push(
        `Chunk set ${set.chunkSetId} lists ${set.chunks.length} chunk(s) but chunkCount is ${set.chunkCount}.`,
      );
    }
    for (const chunk of set.chunks) {
      const label = `Chunk ${String(chunk.chunkId)} of chunk set ${set.chunkSetId}`;
      if (typeof chunk.chunkId !== "number") problems.push(`${label} has no valid chunkId.`);
      if (typeof chunk.isMedia !== "boolean") problems.push(`${label} has no valid isMedia value.`);
      const data = entries[chunk.file];
      if (!data) {
        problems.push(`${label} is missing from the zip (${chunk.file}).`);
        continue;
      }
      if (data.byteLength === 0) problems.push(`${label} is empty.`);
      files.set(chunk.file, data);
    }
  }

  if (problems.length > 0) throw new PackageValidationError(problems.join("\n"));
  return { manifest, files };
}
