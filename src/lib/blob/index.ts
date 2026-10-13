import { createFsBlobStore } from "@/lib/blob/fs-blob-store";
import { createMemoryBlobStore } from "@/lib/blob/memory-blob-store";
import { createR2BlobStore } from "@/lib/blob/r2-blob-store";
import type { BlobStore } from "@/lib/blob/types";
import { getEnv } from "@/lib/env";

let cached: BlobStore | null = null;

export function getBlobStore(): BlobStore {
  if (cached) return cached;
  const env = getEnv();
  cached = env.BLOB_DRIVER === "r2" ? createR2BlobStore() : createFsBlobStore();
  return cached;
}

export function setBlobStoreForTests(store: BlobStore | null): void {
  cached = store;
}

export { createMemoryBlobStore };
