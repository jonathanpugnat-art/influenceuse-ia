import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $executeRaw: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

import {
  checkCredits,
  deductCredits,
  getCredits,
  resetCredits,
} from "@/server/services/credits.service";

describe("credits.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCredits", () => {
    it("returns used, limit and remaining when user exists", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        creditsUsed: 20,
        creditsLimit: 50,
      });
      const result = await getCredits("user-1");
      expect(result).toEqual({ used: 20, limit: 50, remaining: 30 });
    });

    it("remaining is at least 0 when used exceeds limit", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        creditsUsed: 80,
        creditsLimit: 50,
      });
      const result = await getCredits("user-1");
      expect(result.remaining).toBe(0);
    });

    it("throws NOT_FOUND when user does not exist", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      await expect(getCredits("unknown")).rejects.toThrow(TRPCError);
      await expect(getCredits("unknown")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("checkCredits", () => {
    it("returns true when user has enough credits", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        creditsUsed: 10,
        creditsLimit: 100,
      });
      const result = await checkCredits("user-1", 50);
      expect(result).toBe(true);
    });

    it("returns true when remaining equals cost", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        creditsUsed: 40,
        creditsLimit: 100,
      });
      const result = await checkCredits("user-1", 60);
      expect(result).toBe(true);
    });

    it("returns false when not enough credits", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        creditsUsed: 90,
        creditsLimit: 100,
      });
      const result = await checkCredits("user-1", 20);
      expect(result).toBe(false);
    });

    it("returns false when user not found", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      const result = await checkCredits("unknown", 1);
      expect(result).toBe(false);
    });

    it("returns false when remaining is 0 and cost > 0", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        creditsUsed: 100,
        creditsLimit: 100,
      });
      const result = await checkCredits("user-1", 1);
      expect(result).toBe(false);
    });
  });

  describe("deductCredits", () => {
    it("decrements credits atomically when user has enough", async () => {
      mockDb.$executeRaw.mockResolvedValue(1);
      await deductCredits("user-1", 5);
      expect(mockDb.$executeRaw).toHaveBeenCalled();
      expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    });

    it("throws FORBIDDEN when insufficient credits", async () => {
      mockDb.$executeRaw.mockResolvedValue(0);
      mockDb.user.findUnique.mockResolvedValue({
        creditsUsed: 95,
        creditsLimit: 100,
      });
      await expect(deductCredits("user-1", 10)).rejects.toThrow(TRPCError);
      await expect(deductCredits("user-1", 10)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("allows deducting exactly remaining (limit to 0 effectively)", async () => {
      mockDb.$executeRaw.mockResolvedValue(1);
      await deductCredits("user-1", 20);
      expect(mockDb.$executeRaw).toHaveBeenCalled();
    });
  });

  describe("resetCredits", () => {
    it("sets creditsUsed to 0", async () => {
      mockDb.user.update.mockResolvedValue({});
      await resetCredits("user-1");
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { creditsUsed: 0 },
      });
    });
  });
});
