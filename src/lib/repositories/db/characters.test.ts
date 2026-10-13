import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMemoryBlobStore, setBlobStoreForTests } from "@/lib/blob";
import { characters } from "@/lib/db/schema";
import {
  createBuilderCharacter,
  createCloneCharacter,
  findOwnedCharacter,
  listCharactersByOwner,
  updateNiche,
} from "@/lib/repositories/db/characters";
import { ensureUser } from "@/lib/repositories/db/credits";
import { createTestDb, destroyTestDb, withCreditsEnforced, type TestDatabase } from "@/test/db";
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

describe("characters repository", () => {
  let client: PGlite;
  let db: TestDatabase;

  beforeEach(async () => {
    withCreditsEnforced(false);
    ({ client, db } = await createTestDb());
    setBlobStoreForTests(createMemoryBlobStore());
  });

  afterEach(async () => {
    setBlobStoreForTests(null);
    await destroyTestDb(client);
  });

  it("crée un builder et refuse l'accès à un autre owner", async () => {
    const ownerId = "user_owner1";
    const created = await createBuilderCharacter({
      ownerId,
      name: "Lina",
      traits: TRAITS,
      face: jpegStub(),
    });
    expect(created.door).toBe("builder");
    expect(created.traits).toEqual(TRAITS);
    expect(created.face.file).toContain(`characters/${ownerId}/`);

    const owned = await findOwnedCharacter(created.id, ownerId);
    expect(owned?.name).toBe("Lina");
    expect(await findOwnedCharacter(created.id, "user_other")).toBeNull();
  });

  it("crée un clone avec consentement et sources", async () => {
    const ownerId = "user_clone1";
    const photos = Array.from({ length: 7 }, () => ({
      buffer: jpegStub(),
      contentType: "image/jpeg" as const,
    }));
    const consent = new Date("2026-10-10T12:00:00.000Z");
    const created = await createCloneCharacter({
      ownerId,
      name: "Nora",
      photos,
      referenceIndex: 2,
      biometricConsentAt: consent,
    });
    expect(created.door).toBe("clone");
    expect(created.traits).toBeNull();
    expect(created.sources).toHaveLength(7);
    expect(created.biometricConsentAt).toBe(consent.toISOString());

    const rows = await db.select().from(characters).where(eq(characters.id, created.id));
    expect(rows[0]?.biometricConsentAt?.toISOString()).toBe(consent.toISOString());
  });

  it("liste par owner et met à jour la niche", async () => {
    const ownerId = "user_list1";
    await createBuilderCharacter({
      ownerId,
      name: "A",
      traits: TRAITS,
      face: jpegStub(),
    });
    const b = await createBuilderCharacter({
      ownerId,
      name: "B",
      traits: TRAITS,
      face: jpegStub(),
    });
    const list = await listCharactersByOwner(ownerId);
    expect(list.map((c) => c.name)).toEqual(["B", "A"]);

    const niche = await updateNiche(b.id, ownerId, {
      subject: "lifestyle",
      tone: "doux",
      audience: "femmes 25-34",
      promise: "contenu quotidien",
    });
    expect(niche?.subject).toBe("lifestyle");
    const listed = await listCharactersByOwner(ownerId);
    expect(listed.find((c) => c.id === b.id)?.nicheSubject).toBe("lifestyle");
  });

  it("applique door_traits : builder sans traits interdit", async () => {
    await ensureUser("user_x");
    const id = randomUUID();
    await expect(
      db.insert(characters).values({
        id,
        ownerId: "user_x",
        name: "Bad",
        door: "builder",
        traits: null,
        faceKey: "x",
        faceContentType: "image/jpeg",
        sources: [],
      }),
    ).rejects.toThrow();
  });
});
