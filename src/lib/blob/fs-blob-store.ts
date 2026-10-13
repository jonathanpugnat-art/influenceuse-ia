import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BlobPresignOptions, BlobPutInput, BlobStore } from "@/lib/blob/types";

export function createFsBlobStore(root = path.join(process.cwd(), "data", "blobs")): BlobStore {
  function resolve(key: string): string {
    if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
      throw new Error("clé blob invalide");
    }
    return path.join(root, key);
  }

  return {
    async put(input: BlobPutInput) {
      const filePath = resolve(input.key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, input.body);
    },
    async copy(fromKey, toKey) {
      const source = await readFile(resolve(fromKey));
      await this.put({ key: toKey, body: source, contentType: "application/octet-stream" });
    },
    async get(key) {
      try {
        return await readFile(resolve(key));
      } catch {
        return null;
      }
    },
    async exists(key) {
      return (await this.get(key)) !== null;
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
    async presignGet(key, options?: BlobPresignOptions) {
      if (!(await this.exists(key))) throw new Error(`blob manquant: ${key}`);
      // FS driver keeps serving through existing API routes; callers pass the route path.
      const download = options?.downloadFileName
        ? `?download=${encodeURIComponent(options.downloadFileName)}`
        : "";
      return `fs://${key}${download}`;
    },
    async presignPut(key, options) {
      return `fs-put://${key}?contentType=${encodeURIComponent(options.contentType)}`;
    },
  };
}
