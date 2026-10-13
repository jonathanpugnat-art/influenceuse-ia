import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMemoryBlobStore, setBlobStoreForTests } from "@/lib/blob";
import { createBuilderCharacter } from "@/lib/repositories/db/characters";
import { listRefs, upsertRef } from "@/lib/repositories/db/face-refs";
import { createTestDb, destroyTestDb, withCreditsEnforced } from "@/test/db";
import type { PGlite } from "@electric-sql/pglite";

function jpegStub(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
}

const TRAITS = {
  gender: "femme",
  age: "25-34",
  eyes: "marron",
  hairLength: "long",
  hairColor: "chatain",
  body: "athletique",
  skin: "claire",
} as const;

describe("face-refs repository", () => {
  let client: PGlite;

  beforeEach(async () => {
    withCreditsEnforced(false);
    ({ client } = await createTestDb());
    setBlobStoreForTests(createMemoryBlobStore());
  });

  afterEach(async () => {
    setBlobStoreForTests(null);
    await destroyTestDb(client);
  });

  it("upsert par angle et liste par owner", async () => {
    const character = await createBuilderCharacter({
      ownerId: "user_refs1",
      name: "Refa",
      traits: TRAITS,
      face: jpegStub(),
    });

    await upsertRef({
      characterId: character.id,
      ownerId: "user_refs1",
      angle: "front",
      key: "k1",
      contentType: "image/jpeg",
      origin: "face",
    });
    await upsertRef({
      characterId: character.id,
      ownerId: "user_refs1",
      angle: "front",
      key: "k2",
      contentType: "image/jpeg",
      origin: "face",
      score: 0.9,
    });
    await upsertRef({
      characterId: character.id,
      ownerId: "user_refs1",
      angle: "three_quarter_left",
      key: "k3",
      contentType: "image/jpeg",
      origin: "generated",
    });

    const refs = await listRefs(character.id, "user_refs1");
    expect(refs).toHaveLength(2);
    expect(refs.find((r) => r.angle === "front")?.key).toBe("k2");
    expect(refs.find((r) => r.angle === "front")?.score).toBe(0.9);
  });
});
