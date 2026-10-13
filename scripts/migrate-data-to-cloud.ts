/**
 * Migrates data/characters (+ trends) to Postgres + R2.
 * Usage:
 *   npx tsx scripts/migrate-data-to-cloud.ts
 *   npx tsx scripts/migrate-data-to-cloud.ts --apply
 *   npx tsx scripts/migrate-data-to-cloud.ts --apply --default-owner=user_xxx
 */
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { getBlobStore } from "../src/lib/blob";
import { faceKey, postKey, sourceKey } from "../src/lib/blob/keys";
import { getDb } from "../src/lib/db/client";
import { characters, posts, trends, users } from "../src/lib/db/schema";
import { ensureUser } from "../src/lib/repositories/db/jobs";
import { isUuid } from "../src/lib/storage-ids";

const apply = process.argv.includes("--apply");
const defaultOwnerArg = process.argv.find((arg) => arg.startsWith("--default-owner="));
const defaultOwner = defaultOwnerArg?.slice("--default-owner=".length);

type Report = {
  dryRun: boolean;
  characters: number;
  posts: number;
  trends: number;
  skipped: string[];
  errors: string[];
};

async function main() {
  const report: Report = {
    dryRun: !apply,
    characters: 0,
    posts: 0,
    trends: 0,
    skipped: [],
    errors: [],
  };

  const root = path.join(process.cwd(), "data");
  const charactersRoot = path.join(root, "characters");
  const blob = getBlobStore();
  const db = getDb();

  const entries = await readdir(charactersRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || !isUuid(entry.name)) continue;
    const dir = path.join(charactersRoot, entry.name);
    try {
      const raw = JSON.parse(await readFile(path.join(dir, "character.json"), "utf8")) as {
        id: string;
        ownerId?: string | null;
        name: string;
        door: "builder" | "clone";
        createdAt: string;
        traits: unknown;
        face: { file: string; contentType: "image/jpeg" | "image/png" | "image/webp" };
        sources: { file: string; contentType: "image/jpeg" | "image/png" | "image/webp" }[];
      };
      const ownerId = raw.ownerId ?? defaultOwner;
      if (!ownerId) {
        report.skipped.push(`${entry.name}: owner manquant`);
        continue;
      }
      const faceBuffer = await readFile(path.join(dir, raw.face.file));
      const face = faceKey(ownerId, raw.id, raw.face.contentType);
      if (apply) {
        await ensureUser(ownerId);
        await blob.put({ key: face, body: faceBuffer, contentType: raw.face.contentType });
        const storedSources = [];
        for (const [index, source] of raw.sources.entries()) {
          const bytes = await readFile(path.join(dir, "sources", source.file));
          const key = sourceKey(ownerId, raw.id, index, source.contentType);
          await blob.put({ key, body: bytes, contentType: source.contentType });
          storedSources.push({ key, contentType: source.contentType });
        }
        let niche = null;
        try {
          niche = JSON.parse(await readFile(path.join(dir, "niche.json"), "utf8"));
        } catch {
          niche = null;
        }
        await db.insert(users).values({ id: ownerId }).onConflictDoNothing();
        await db
          .insert(characters)
          .values({
            id: raw.id,
            ownerId,
            name: raw.name,
            door: raw.door,
            traits: raw.traits as never,
            faceKey: face,
            faceContentType: raw.face.contentType,
            sources: storedSources,
            niche,
            createdAt: new Date(raw.createdAt),
            updatedAt: new Date(),
          })
          .onConflictDoNothing();

        const postDir = path.join(dir, "posts");
        const postFiles = await readdir(postDir).catch(() => []);
        for (const file of postFiles) {
          if (!file.endsWith(".jpg")) continue;
          const postId = file.replace(/\.jpg$/, "");
          if (!isUuid(postId)) continue;
          const bytes = await readFile(path.join(postDir, file));
          const key = postKey(ownerId, raw.id, postId);
          await blob.put({ key, body: bytes, contentType: "image/jpeg" });
          const info = await stat(path.join(postDir, file));
          await db
            .insert(posts)
            .values({
              id: postId,
              characterId: raw.id,
              ownerId,
              status: "succeeded",
              imageKey: key,
              sourceKind: "legacy",
              sourceRef: "legacy",
              sourceLabel: "Import",
              prompt: "legacy import",
              createdAt: info.mtime,
              completedAt: info.mtime,
            })
            .onConflictDoNothing();
          report.posts += 1;
        }
      }
      report.characters += 1;
      console.log(
        apply ? "migrated" : "would migrate",
        entry.name,
        createHash("sha256").update(faceBuffer).digest("hex").slice(0, 12),
      );
    } catch (error) {
      report.errors.push(
        `${entry.name}: ${error instanceof Error ? error.message : "erreur"}`,
      );
    }
  }

  const trendsRoot = path.join(root, "trends");
  const trendFiles = await readdir(trendsRoot).catch(() => []);
  for (const file of trendFiles) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(await readFile(path.join(trendsRoot, file), "utf8")) as {
        hashtag: string;
        fetchedAt: string;
        reels: unknown[];
      };
      if (apply) {
        await db
          .insert(trends)
          .values({
            hashtag: raw.hashtag,
            reels: raw.reels as never,
            fetchedAt: new Date(raw.fetchedAt),
          })
          .onConflictDoNothing();
      }
      report.trends += 1;
    } catch (error) {
      report.errors.push(`trend ${file}: ${error instanceof Error ? error.message : "erreur"}`);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
