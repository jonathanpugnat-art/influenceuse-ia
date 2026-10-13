import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";

export async function getOwnedPost(ownerId: string, characterId: string, postId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(posts)
    .where(
      and(eq(posts.id, postId), eq(posts.characterId, characterId), eq(posts.ownerId, ownerId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getPostById(postId: string) {
  const db = getDb();
  const rows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return rows[0] ?? null;
}
