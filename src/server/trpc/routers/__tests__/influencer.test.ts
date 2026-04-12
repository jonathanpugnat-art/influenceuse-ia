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
}));

vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/lib/constants", () => ({
  PLANS: {
    FREE: { name: "Free", maxInfluencers: 1 },
    PRO: { name: "Pro", maxInfluencers: 5 },
    ENTERPRISE: { name: "Enterprise", maxInfluencers: Infinity },
  },
}));

import { createCallerFactory } from "@/server/trpc";
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
  });

  describe("getAll", () => {
    it("returns influencers for current user (filtered by userId)", async () => {
      mockDb.influencer.findMany.mockResolvedValue([sampleInfluencer]);
      mockDb.influencer.count.mockResolvedValue(1);

      const caller = createCaller({ userId: "clerk-123" });
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

      const caller = createCaller({ userId: "clerk-123" });
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

      const caller = createCaller({ userId: "clerk-123" });
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
  });

  describe("delete", () => {
    it("soft-deletes (sets status to ARCHIVED, no physical delete)", async () => {
      mockDb.influencer.findUnique.mockResolvedValue({
        ...sampleInfluencer,
        userId: "user-db-1",
      });
      mockDb.influencer.update.mockResolvedValue({});

      const caller = createCaller({ userId: "clerk-123" });
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

      const caller = createCaller({ userId: "clerk-123" });
      const result = await caller.influencer.getById({ id: "inf-1" });

      expect(result.id).toBe("inf-1");
      expect(result.name).toBe("Test Inf");
    });

    it("throws NOT_FOUND when influencer belongs to another user", async () => {
      mockDb.influencer.findUnique.mockResolvedValue({
        ...sampleInfluencer,
        userId: "other-user-id",
      });

      const caller = createCaller({ userId: "clerk-123" });
      await expect(caller.influencer.getById({ id: "inf-1" })).rejects.toThrow(
        TRPCError
      );
      await expect(caller.influencer.getById({ id: "inf-1" })).rejects.toMatchObject(
        { code: "NOT_FOUND" }
      );
    });
  });

  describe("UNAUTHORIZED", () => {
    it("throws UNAUTHORIZED when userId is missing", async () => {
      const caller = createCaller({ userId: null });

      await expect(caller.influencer.getAll({})).rejects.toThrow(TRPCError);
      await expect(caller.influencer.getAll({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
