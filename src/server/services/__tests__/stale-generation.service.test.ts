import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  content: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  generationJob: {
    updateMany: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

import {
  failStaleGenerations,
  STALE_GENERATION_ERROR,
} from "@/server/services/stale-generation.service";

describe("stale-generation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when no stale content exists", async () => {
    mockDb.content.findMany.mockResolvedValue([]);
    const result = await failStaleGenerations();
    expect(result).toEqual({ failedContents: 0, failedJobs: 0 });
    expect(mockDb.content.updateMany).not.toHaveBeenCalled();
    expect(mockDb.generationJob.updateMany).not.toHaveBeenCalled();
  });

  it("only targets non-batch GENERATING contents without media", async () => {
    mockDb.content.findMany.mockResolvedValue([]);
    await failStaleGenerations();
    const where = mockDb.content.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("GENERATING");
    expect(where.batchId).toBe(null);
    expect(where.mediaUrls).toEqual({ isEmpty: true });
    expect(where.updatedAt.lt).toBeInstanceOf(Date);
  });

  it("fails stale contents and their pending jobs with an actionable error", async () => {
    mockDb.content.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    mockDb.content.updateMany.mockResolvedValue({ count: 2 });
    mockDb.generationJob.updateMany.mockResolvedValue({ count: 2 });

    const result = await failStaleGenerations();

    expect(result).toEqual({ failedContents: 2, failedJobs: 2 });
    expect(mockDb.content.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1", "c2"] }, status: "GENERATING" },
      data: { status: "FAILED" },
    });
    expect(mockDb.generationJob.updateMany).toHaveBeenCalledWith({
      where: {
        contentId: { in: ["c1", "c2"] },
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: { status: "FAILED", error: STALE_GENERATION_ERROR },
    });
  });

  it("respects a custom cutoff", async () => {
    mockDb.content.findMany.mockResolvedValue([]);
    const before = Date.now();
    await failStaleGenerations({ olderThanMs: 60_000 });
    const cutoff: Date =
      mockDb.content.findMany.mock.calls[0][0].where.updatedAt.lt;
    // Cutoff must be ~60s in the past, not the default 20 min.
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(59_000);
    expect(before - cutoff.getTime()).toBeLessThan(120_000);
  });
});
