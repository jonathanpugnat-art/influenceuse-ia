export type BlobPutInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type BlobPresignOptions = {
  expiresInSeconds?: number;
  downloadFileName?: string;
};

export type BlobPresignPutOptions = {
  contentType: string;
  expiresInSeconds?: number;
};

export type BlobStore = {
  put(input: BlobPutInput): Promise<void>;
  copy(fromKey: string, toKey: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /**
   * For fs: returns an app-relative path the API route can stream.
   * For r2: returns a signed HTTPS URL.
   */
  presignGet(key: string, options?: BlobPresignOptions): Promise<string>;
  /** Signed PUT URL for direct client uploads (R2); fs/memory use a local scheme. */
  presignPut(key: string, options: BlobPresignPutOptions): Promise<string>;
};
