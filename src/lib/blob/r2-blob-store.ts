import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { BlobPresignOptions, BlobPutInput, BlobStore } from "@/lib/blob/types";
import { getEnv } from "@/lib/env";

export function createR2BlobStore(): BlobStore {
  const env = getEnv();
  const accountId = env.R2_ACCOUNT_ID!;
  const bucket = env.R2_BUCKET_NAME!;
  const jurisdiction = env.R2_JURISDICTION === "eu" ? "eu." : "";
  const endpoint = `https://${accountId}.${jurisdiction}r2.cloudflarestorage.com`;

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });

  return {
    async put(input: BlobPutInput) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    },
    async copy(fromKey, toKey) {
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${fromKey}`,
          Key: toKey,
        }),
      );
    },
    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = await result.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      } catch {
        return null;
      }
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async presignGet(key, options?: BlobPresignOptions) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: options?.downloadFileName
          ? `attachment; filename="${options.downloadFileName.replace(/"/g, "")}"`
          : undefined,
      });
      return getSignedUrl(client, command, {
        expiresIn: options?.expiresInSeconds ?? 300,
      });
    },
    async presignPut(key, options) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: options.contentType,
      });
      return getSignedUrl(client, command, {
        expiresIn: options.expiresInSeconds ?? 900,
      });
    },
  };
}
