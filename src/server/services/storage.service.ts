import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";
import archiver from "archiver";
import { nanoid } from "nanoid";
import * as fs from "fs";
import * as path from "path";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "influenceuse-ia";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const isR2Configured =
  !!R2_ACCOUNT_ID && !!R2_ACCESS_KEY_ID && !!R2_SECRET_ACCESS_KEY;

let s3Client: S3Client | null = null;
let r2Disabled = false;

function getS3Client(): S3Client | null {
  if (r2Disabled || !isR2Configured) return null;
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

function disableR2(error: unknown) {
  r2Disabled = true;
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(`[storage] R2 access failed (${msg}). Falling back to local storage for this session.`);
}

// ──────────────────────────────────────────────
// Local fallback helpers
// ──────────────────────────────────────────────

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
}

function localPath(key: string): string {
  return path.join(LOCAL_UPLOAD_DIR, key.replace(/\//g, "_"));
}

function localUrl(key: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/uploads/${key.replace(/\//g, "_")}`;
}

function saveLocal(key: string, buffer: Buffer): string {
  ensureLocalDir();
  fs.writeFileSync(localPath(key), buffer);
  return localUrl(key);
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Upload a file buffer to storage.
 * Returns the public URL.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const key = `${nanoid(8)}/${filename}`;

  const client = getS3Client();
  if (client) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
      return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;
    } catch (error) {
      disableR2(error);
    }
  }

  return saveLocal(key, buffer);
}

/**
 * Upload a buffer and return the storage key (for generating presigned URLs).
 */
export async function uploadFileReturnKey(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const key = `${nanoid(8)}/${filename}`;

  const client = getS3Client();
  if (client) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
      return key;
    } catch (error) {
      disableR2(error);
    }
  }

  ensureLocalDir();
  fs.writeFileSync(localPath(key), buffer);
  return key;
}

/**
 * Download from a URL and re-upload to storage.
 * Returns the public URL.
 */
export async function uploadFromUrl(
  sourceUrl: string,
  filename: string
): Promise<string> {
  const response = await axios.get(sourceUrl, {
    responseType: "arraybuffer",
    timeout: 60_000,
  });

  const buffer = Buffer.from(response.data);
  const contentType =
    (response.headers["content-type"] as string) ?? "application/octet-stream";

  return uploadFile(buffer, filename, contentType);
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();
  if (client) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        })
      );
      return;
    } catch (error) {
      disableR2(error);
    }
  }

  const fp = localPath(key);
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
  }
}

/**
 * Get a signed URL for temporary access.
 */
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  if (client) {
    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });
      return getSignedUrl(client, command, { expiresIn });
    } catch (error) {
      disableR2(error);
    }
  }

  return localUrl(key);
}

/**
 * Download files from URLs and add them to a ZIP archive, then upload to storage.
 * Returns a signed URL valid for 24 hours (or the local URL when using fallback).
 */
export async function createZipBundleFromUrls(
  files: { url: string; filename: string }[],
  captionText?: string
): Promise<string> {
  const downloads = await Promise.all(
    files.map(async (file) => {
      const resp = await axios.get(file.url, {
        responseType: "arraybuffer",
        timeout: 60_000,
      });
      return { filename: file.filename, buffer: Buffer.from(resp.data) };
    })
  );

  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    for (const dl of downloads) {
      archive.append(dl.buffer, { name: dl.filename });
    }

    if (captionText) {
      archive.append(captionText, { name: "content.txt" });
    }

    archive.finalize();
  });

  const zipFilename = `bundle-${nanoid(8)}.zip`;
  const url = await uploadFile(zipBuffer, zipFilename, "application/zip");

  if (!r2Disabled && isR2Configured) {
    return getPresignedUrl(url, 86400);
  }
  return url;
}
