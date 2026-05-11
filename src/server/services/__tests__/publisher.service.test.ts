import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  publishResult: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  content: { update: vi.fn() },
  socialAccount: { update: vi.fn() },
  webhook: { findMany: vi.fn(), update: vi.fn() },
  webhookDelivery: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((t: string) => t),
  encrypt: vi.fn((t: string) => t),
}));

const mockInstagram = vi.hoisted(() => ({
  publishPhoto: vi.fn(),
  publishCarousel: vi.fn(),
  publishReel: vi.fn(),
  refreshToken: vi.fn(),
}));
const mockTiktok = vi.hoisted(() => ({ publishVideo: vi.fn() }));
const mockOnlyfans = vi.hoisted(() => ({ prepareBundle: vi.fn() }));

vi.mock("@/server/services/instagram.service", () => mockInstagram);
vi.mock("@/server/services/tiktok.service", () => mockTiktok);
vi.mock("@/server/services/onlyfans.service", () => mockOnlyfans);

import { publishContent, savePublishResults } from "@/server/services/publisher.service";

const baseContent = {
  id: "content-1",
  type: "PHOTO" as const,
  caption: "Test",
  hashtags: [],
  mediaUrls: ["https://example.com/img.jpg"],
  thumbnailUrl: null,
  scheduledAt: null,
  platforms: ["INSTAGRAM" as const, "TIKTOK" as const],
  influencer: {
    id: "inf-1",
    socialAccounts: [
      {
        id: "sa-ig",
        platform: "INSTAGRAM" as const,
        accessToken: "tok-ig",
        refreshToken: null,
        platformUserId: "ig-123",
        tokenExpiresAt: null,
        isConnected: true,
      },
      {
        id: "sa-tt",
        platform: "TIKTOK" as const,
        accessToken: "tok-tt",
        refreshToken: null,
        platformUserId: null,
        tokenExpiresAt: null,
        isConnected: true,
      },
    ],
  },
};

describe("publisher.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstagram.publishPhoto.mockResolvedValue({ mediaId: "ig-media-1" });
    mockTiktok.publishVideo.mockResolvedValue({ publishId: "tt-1" });
    mockDb.publishResult.create.mockResolvedValue({});
    mockDb.publishResult.findMany.mockResolvedValue([]);
    mockDb.publishResult.findFirst.mockResolvedValue(null);
    mockDb.content.update.mockResolvedValue({
      id: "content-1",
      type: "PHOTO",
      caption: "Test",
      hashtags: [],
      mediaUrls: [],
      thumbnailUrl: null,
      platforms: ["INSTAGRAM", "TIKTOK"],
      publishedAt: new Date(),
      influencer: { id: "inf-1", name: "Inf", userId: "u1" },
    });
    // No active webhooks by default → emitEvent is a no-op.
    mockDb.webhook.findMany.mockResolvedValue([]);
  });

  describe("publishContent", () => {
    it("calls Instagram and TikTok when content has both platforms (REEL)", async () => {
      const content = {
        ...baseContent,
        type: "REEL" as const,
        platforms: ["INSTAGRAM", "TIKTOK"] as Array<"INSTAGRAM" | "TIKTOK">,
        mediaUrls: ["https://example.com/video.mp4"],
      };
      mockInstagram.publishReel.mockResolvedValue({ mediaId: "ig-reel-1" });
      const results = await publishContent(content);
      expect(mockInstagram.publishReel).toHaveBeenCalledTimes(1);
      expect(mockTiktok.publishVideo).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("SUCCESS");
      expect(results[1].status).toBe("SUCCESS");
    });

    it("when one platform throws, other is still processed and result contains FAILED and SUCCESS", async () => {
      // Reject 3 times so the withRetry helper exhausts and surfaces the error.
      mockInstagram.publishReel.mockRejectedValue(new Error("IG permanent error"));
      mockTiktok.publishVideo.mockResolvedValue({ publishId: "tt-1" });
      const content = {
        ...baseContent,
        type: "REEL" as const,
        platforms: ["INSTAGRAM", "TIKTOK"] as Array<"INSTAGRAM" | "TIKTOK">,
        mediaUrls: ["https://example.com/video.mp4"],
      };
      const results = await publishContent(content);
      expect(results).toHaveLength(2);
      const failed = results.find((r) => r.status === "FAILED");
      const success = results.find((r) => r.status === "SUCCESS");
      expect(failed).toBeDefined();
      expect(success).toBeDefined();
      expect(failed?.error).toContain("IG permanent error");
    });

    it("skips a platform that already has a SUCCESS PublishResult (idempotency)", async () => {
      mockDb.publishResult.findMany.mockResolvedValue([
        { platform: "INSTAGRAM", externalPostId: "ig-prev", publishedAt: new Date() },
      ]);
      const content = {
        ...baseContent,
        type: "REEL" as const,
        platforms: ["INSTAGRAM", "TIKTOK"] as Array<"INSTAGRAM" | "TIKTOK">,
        mediaUrls: ["https://example.com/video.mp4"],
      };
      mockInstagram.publishReel.mockResolvedValue({ mediaId: "ig-reel-1" });
      const results = await publishContent(content);
      expect(mockInstagram.publishReel).not.toHaveBeenCalled();
      expect(mockTiktok.publishVideo).toHaveBeenCalledTimes(1);
      expect(results.find((r) => r.platform === "INSTAGRAM")?.externalPostId).toBe("ig-prev");
    });
  });

  describe("savePublishResults", () => {
    it("creates results, marks content PUBLISHED when at least one success", async () => {
      await savePublishResults("content-1", [
        { platform: "INSTAGRAM", status: "SUCCESS", externalPostId: "ig-1", publishedAt: new Date() },
        { platform: "TIKTOK", status: "FAILED", error: "No token" },
      ]);
      // SUCCESS only created if no findFirst match (we returned null) → 2 creates.
      expect(mockDb.publishResult.create).toHaveBeenCalledTimes(2);
      expect(mockDb.content.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "content-1" },
          data: expect.objectContaining({ status: "PUBLISHED", scheduledAt: null }),
        })
      );
    });

    it("does not duplicate a PublishResult SUCCESS when one already exists for the same platform", async () => {
      mockDb.publishResult.findFirst.mockResolvedValueOnce({ id: "pr-existing" });
      await savePublishResults("content-1", [
        { platform: "INSTAGRAM", status: "SUCCESS", externalPostId: "ig-1" },
      ]);
      expect(mockDb.publishResult.create).not.toHaveBeenCalled();
    });

    it("updates content to FAILED when all results failed", async () => {
      await savePublishResults("content-1", [
        { platform: "INSTAGRAM", status: "FAILED", error: "Err1" },
        { platform: "TIKTOK", status: "FAILED", error: "Err2" },
      ]);
      expect(mockDb.publishResult.create).toHaveBeenCalledTimes(2);
      expect(mockDb.content.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "content-1" },
          data: expect.objectContaining({ status: "FAILED", scheduledAt: null }),
        })
      );
    });
  });
});
