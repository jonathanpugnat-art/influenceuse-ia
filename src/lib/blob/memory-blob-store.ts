import type { BlobPresignOptions, BlobPutInput, BlobStore } from "@/lib/blob/types";

export function createMemoryBlobStore(): BlobStore {
  const objects = new Map<string, { body: Buffer; contentType: string }>();

  return {
    async put(input: BlobPutInput) {
      objects.set(input.key, { body: Buffer.from(input.body), contentType: input.contentType });
    },
    async copy(fromKey, toKey) {
      const source = objects.get(fromKey);
      if (!source) throw new Error(`blob manquant: ${fromKey}`);
      objects.set(toKey, { body: Buffer.from(source.body), contentType: source.contentType });
    },
    async get(key) {
      return objects.get(key)?.body ?? null;
    },
    async exists(key) {
      return objects.has(key);
    },
    async delete(key) {
      objects.delete(key);
    },
    async presignGet(key, options?: BlobPresignOptions) {
      if (!objects.has(key)) throw new Error(`blob manquant: ${key}`);
      const download = options?.downloadFileName
        ? `?download=${encodeURIComponent(options.downloadFileName)}`
        : "";
      return `memory://${key}${download}`;
    },
    async presignPut(key, options) {
      return `memory-put://${key}?contentType=${encodeURIComponent(options.contentType)}`;
    },
  };
}
