import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

const mockDb = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  influencer: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  influencerAnalytics: { create: vi.fn() },
  generationJob: { findMany: vi.fn() },
}));

vi.mock("@/server/db", () => ({ db: mockDb }));
// Minimal `PLANS` mock — only the fields actually consumed by the router
// under test need to be present. We include every tier (FREE/STARTER/PRO/
// ENTERPRISE) because `stripe.service.ts` (transitively imported via the
// billing router) reads `PLANS.<tier>.credits` at module load time.
vi.mock("@/lib/constants", () => ({
  PLANS: {
    FREE: { name: "Free", maxInfluencers: 1, credits: 50, hasAutoPublish: false },
    STARTER: { name: "Creator", maxInfluencers: 2, credits: 500, hasAutoPublish: true },
    PRO: { name: "Pro", maxInfluencers: 5, credits: 1500, hasAutoPublish: true },
    ENTERPRISE: {
      name: "Agency",
      maxInfluencers: Infinity,
      credits: 5000,
      hasAutoPublish: true,
    },
  },
  CREDIT_PACK_CATALOG: [
    { id: "small", credits: 100, priceEur: 9 },
    { id: "medium", credits: 500, priceEur: 39 },
    { id: "large", credits: 1500, priceEur: 99 },
  ],
  // `seedance-config` (transitively loaded via the app router) reads
  // credit-per-second constants at module load, so the partial mock must
  // surface every CREDIT_COSTS field consumed at import time. Extend as
  // needed when new video providers land.
  CREDIT_COSTS: {
    SEEDANCE_480P_PER_SEC: 18,
    SEEDANCE_720P_PER_SEC: 36,
    KLING_SCENE_I2V_AUDIO_OFF_PER_SEC: 8,
    KLING_SCENE_I2V_AUDIO_ON_PER_SEC: 10,
    TALKING_HEAD_PER_SEC: 8,
  },
  MAX_TALKING_HEAD_SEC: 30,
  MAX_TALKING_HEAD_WORDS: 80,
  TALKING_HEAD_WORDS_PER_SEC: 2.5,
}));

import { createCallerFactory, mockTRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/trpc/router";

const createCaller = createCallerFactory(appRouter);

describe("influencer router", () => {
  const dbUser = { id: "user-db-1", clerkId: "clerk-123", plan: "FREE" };
  const sampleInfluencer = {
    id: "inf-1",
    userId: "user-db-1",
    name: "Test Inf",
    slug: "test-inf-abc",
    status: "ACTIVE",
    socialAccounts: [],
    analytics: {},
    _count: { contents: 0 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.user.findUnique.mockResolvedValue(dbUser);
    mockDb.influencer.count.mockResolvedValue(0);
    mockDb.influencerAnalytics.create.mockResolvedValue({});
    mockDb.generationJob.findMany.mockResolvedValue([]);
  });

  describe("getAll", () => {
    it("returns influencers for current user (filtered by userId)", async () => {
      mockDb.influencer.findMany.mockResolvedValue([sampleInfluencer]);
      mockDb.influencer.count.mockResolvedValue(1);

      const caller = createCaller(mockTRPCContext("clerk-123"));
      const result = await caller.influencer.getAll({});

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: "clerk-123" },
      });
      expect(mockDb.influencer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-db-1" }),
        })
      );
      expect(result.influencers).toHaveLength(1);
      expect(result.influencers[0].name).toBe("Test Inf");
      expect(result.total).toBe(1);
    });
  });

  describe("create", () => {
    it("throws FORBIDDEN when plan limit reached", async () => {
      mockDb.influencer.count.mockResolvedValue(1); // FREE plan maxInfluencers = 1

      const caller = createCaller(mockTRPCContext("clerk-123"));
      await expect(
        caller.influencer.create({
          name: "Second Inf",
          bio: "A short bio for tests that is long enough.",
          personality: "Friendly and creative personality for tests.",
          niche: "LIFESTYLE",
          age: 25,
          style: {},
          isNsfw: false,
        })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.influencer.create({
          name: "Second Inf",
          bio: "A short bio for tests that is long enough.",
          personality: "Friendly and creative personality for tests.",
          niche: "LIFESTYLE",
          age: 25,
          style: {},
          isNsfw: false,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mockDb.influencer.create).not.toHaveBeenCalled();
    });

    it("creates an influencer and returns it", async () => {
      mockDb.influencer.count.mockResolvedValue(0);
      mockDb.influencer.create.mockResolvedValue({
        ...sampleInfluencer,
        name: "New Inf",
        slug: "new-inf-xyz",
      });

      const caller = createCaller(mockTRPCContext("clerk-123"));
      const result = await caller.influencer.create({
        name: "New Inf",
        bio: "A short bio for tests that is long enough.",
        personality: "Friendly and creative personality for tests.",
        niche: "LIFESTYLE",
        age: 25,
        style: {},
        isNsfw: false,
      });

      expect(mockDb.influencer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-db-1",
            name: "New Inf",
            niche: "LIFESTYLE",
            age: 25,
          }),
        })
      );
      expect(result.name).toBe("New Inf");
      expect(result.id).toBe("inf-1");
    });

    // ── Sprint 14 — social accounts wiring ──────────────────────────────
    it("persists social accounts nested when handles are provided", async () => {
      mockDb.influencer.count.mockResolvedValue(0);
      mockDb.influencer.create.mockResolvedValue({
        ...sampleInfluencer,
        name: "With Socials",
      });

      const caller = createCaller(mockTRPCContext("clerk-123"));
      await caller.influencer.create({
        name: "With Socials",
        bio: "A short bio for tests that is long enough.",
        personality: "Friendly and creative personality for tests.",
        niche: "LIFESTYLE",
        age: 25,
        style: {},
        isNsfw: false,
        socialAccounts: [
          { platform: "INSTAGRAM", username: "@luna.fit" },
          { platform: "TIKTOK", username: "luna_fit_official" },
        ],
      });

      const createCall = mockDb.influencer.create.mock.calls[0]?.[0];
      const nested = createCall?.data?.socialAccounts?.create as Array<{
        platform: string;
        username: string;
        isConnected: boolean;
      }>;
      expect(nested).toHaveLength(2);
      // Leading "@" is stripped before insert
      const ig = nested.find((a) => a.platform === "INSTAGRAM");
      expect(ig?.username).toBe("luna.fit");
      // Non-prefixed handles pass through untouched
      const tk = nested.find((a) => a.platform === "TIKTOK");
      expect(tk?.username).toBe("luna_fit_official");
      // Wizard handles are always declared, never OAuth-connected
      expect(nested.every((a) => a.isConnected === false)).toBe(true);
    });

    it("skips socialAccounts.create when the array is empty or absent", async () => {
      mockDb.influencer.count.mockResolvedValue(0);
      mockDb.influencer.create.mockResolvedValue(sampleInfluencer);

      const caller = createCaller(mockTRPCContext("clerk-123"));
      await caller.influencer.create({
        name: "No Socials",
        bio: "A short bio for tests that is long enough.",
        personality: "Friendly and creative personality for tests.",
        niche: "LIFESTYLE",
        age: 25,
        style: {},
        isNsfw: false,
      });

      const createCall = mockDb.influencer.create.mock.calls[0]?.[0];
      expect(createCall?.data?.socialAccounts).toBeUndefined();
    });

    it("de-dupes when the same platform appears twice (keeps last)", async () => {
      mockDb.influencer.count.mockResolvedValue(0);
      mockDb.influencer.create.mockResolvedValue(sampleInfluencer);

      const caller = createCaller(mockTRPCContext("clerk-123"));
      await caller.influencer.create({
        name: "Dup Socials",
        bio: "A short bio for tests that is long enough.",
        personality: "Friendly and creative personality for tests.",
        niche: "LIFESTYLE",
        age: 25,
        style: {},
        isNsfw: false,
        socialAccounts: [
          { platform: "INSTAGRAM", username: "first" },
          { platform: "INSTAGRAM", username: "second" },
        ],
      });

      const createCall = mockDb.influencer.create.mock.calls[0]?.[0];
      const nested = createCall?.data?.socialAccounts?.create as Array<{
        username: string;
      }>;
      expect(nested).toHaveLength(1);
      expect(nested[0]?.username).toBe("second");
    });
  });

  // ── Sprint 14 — appearance collision guard ───────────────────────────
  describe("checkAppearanceCollision", () => {
    it("excludes the caller's own influencers from the count", async () => {
      mockDb.influencer.count.mockResolvedValue(2);

      const caller = createCaller(mockTRPCContext("clerk-123"));
      const result = await caller.influencer.checkAppearanceCollision({
        fingerprint: "a3f1d20c",
      });

      expect(mockDb.influencer.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            appearanceFingerprint: "a3f1d20c",
            status: { not: "ARCHIVED" },
            NOT: { userId: "user-db-1" },
          }),
        })
      );
      expect(result.count).toBe(2);
      expect(result.hasCollision).toBe(true);
    });

    it("reports hasCollision=false when count is 0", async () => {
      mockDb.influencer.count.mockResolvedValue(0);

      const caller = createCaller(mockTRPCContext("clerk-123"));
      const result = await caller.influencer.checkAppearanceCollision({
        fingerprint: "deadbeef",
      });

      expect(result.count).toBe(0);
      expect(result.hasCollision).toBe(false);
    });
  });

  describe("delete", () => {
    it("soft-deletes (sets status to ARCHIVED, no physical delete)", async () => {
      mockDb.influencer.findUnique.mockResolvedValue({
        ...sampleInfluencer,
        userId: "user-db-1",
      });
      mockDb.influencer.update.mockResolvedValue({});

      const caller = createCaller(mockTRPCContext("clerk-123"));
      const result = await caller.influencer.delete({ id: "inf-1" });

      expect(mockDb.influencer.update).toHaveBeenCalledWith({
        where: { id: "inf-1" },
        data: { status: "ARCHIVED" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("getById", () => {
    it("returns influencer when found and owned by user", async () => {
      mockDb.influencer.findUnique.mockResolvedValue({
        ...sampleInfluencer,
        userId: "user-db-1",
        socialAccounts: [],
        analytics: {},
        contents: [],
        _count: { contents: 0 },
      });

      const caller = createCaller(mockTRPCContext("clerk-123"));
      const result = await caller.influencer.getById({ id: "inf-1" });

      expect(result.id).toBe("inf-1");
      expect(result.name).toBe("Test Inf");
    });

    it("throws NOT_FOUND when influencer belongs to another user", async () => {
      mockDb.influencer.findUnique.mockResolvedValue({
        ...sampleInfluencer,
        userId: "other-user-id",
      });

      const caller = createCaller(mockTRPCContext("clerk-123"));
      await expect(caller.influencer.getById({ id: "inf-1" })).rejects.toThrow(
        TRPCError
      );
      await expect(caller.influencer.getById({ id: "inf-1" })).rejects.toMatchObject(
        { code: "NOT_FOUND" }
      );
    });

    // QA face-lock bug: the feed used to receive contents without any error
    // context, so a FAILED photo showed a raw "FAILED" badge with no way to
    // learn why. `getById` now folds the latest GenerationJob.error into each
    // FAILED content, formatted via `formatGenerationErrorForUser` so the
    // face-lock French copy reaches the tile + modal.
    it("attaches formatted French error message to FAILED contents", async () => {
      mockDb.influencer.findUnique.mockResolvedValue({
        ...sampleInfluencer,
        userId: "user-db-1",
        socialAccounts: [],
        analytics: {},
        contents: [
          {
            id: "content-ok",
            status: "READY",
            contentMode: "SFW",
            type: "PHOTO",
            mediaUrls: ["https://cdn/x.jpg"],
            thumbnailUrl: "https://cdn/x.jpg",
            platforms: [],
            caption: null,
          },
          {
            id: "content-failed",
            status: "FAILED",
            contentMode: "SFW",
            type: "PHOTO",
            mediaUrls: [],
            thumbnailUrl: null,
            platforms: [],
            caption: null,
          },
        ],
        _count: { contents: 2 },
      });
      mockDb.generationJob.findMany.mockResolvedValue([
        { contentId: "content-failed", error: "[face-lock] PuLID timed out" },
      ]);

      const caller = createCaller(mockTRPCContext("clerk-123"));
      const result = await caller.influencer.getById({ id: "inf-1" });

      expect(mockDb.generationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contentId: { in: ["content-failed"] } },
        })
      );
      expect(result.contents).toHaveLength(2);
      const ok = result.contents.find((c) => c.id === "content-ok")!;
      const failed = result.contents.find((c) => c.id === "content-failed")!;
      expect(ok.errorMessage).toBeNull();
      expect(failed.errorMessage).toBeTruthy();
      expect(failed.errorMessage).toContain("verrouillage du visage");
    });

    it("returns null errorMessage and skips the job lookup when nothing failed", async () => {
      mockDb.influencer.findUnique.mockResolvedValue({
        ...sampleInfluencer,
        userId: "user-db-1",
        socialAccounts: [],
        analytics: {},
        contents: [
          {
            id: "content-ok",
            status: "READY",
            contentMode: "SFW",
            type: "PHOTO",
            mediaUrls: ["https://cdn/x.jpg"],
            thumbnailUrl: "https://cdn/x.jpg",
            platforms: [],
            caption: null,
          },
        ],
        _count: { contents: 1 },
      });

      const caller = createCaller(mockTRPCContext("clerk-123"));
      const result = await caller.influencer.getById({ id: "inf-1" });

      expect(mockDb.generationJob.findMany).not.toHaveBeenCalled();
      expect(result.contents[0].errorMessage).toBeNull();
    });
  });

  describe("UNAUTHORIZED", () => {
    it("throws UNAUTHORIZED when userId is missing", async () => {
      const caller = createCaller(mockTRPCContext(null));

      await expect(caller.influencer.getAll({})).rejects.toThrow(TRPCError);
      await expect(caller.influencer.getAll({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
