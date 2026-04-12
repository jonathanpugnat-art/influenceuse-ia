import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  content: { findMany: vi.fn() },
}));

const mockPublishContent = vi.hoisted(() => vi.fn());
const mockSavePublishResults = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/server/services/publisher.service", () => ({
  publishContent: mockPublishContent,
  savePublishResults: mockSavePublishResults,
}));

import { checkAndPublish } from "@/server/services/scheduler.service";

describe("scheduler.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSavePublishResults.mockResolvedValue(undefined);
  });

  it("calls publishContent twice when 2 contents are due", async () => {
    const dueContents = [
      {
        id: "c1",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 60000),
        platforms: ["INSTAGRAM"],
        influencer: { id: "i1", name: "Inf1", socialAccounts: [] },
      },
      {
        id: "c2",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 120000),
        platforms: ["INSTAGRAM"],
        influencer: { id: "i2", name: "Inf2", socialAccounts: [] },
      },
    ];
    mockDb.content.findMany.mockResolvedValue(dueContents);
    mockPublishContent
      .mockResolvedValueOnce([{ platform: "INSTAGRAM", status: "SUCCESS" }])
      .mockResolvedValueOnce([{ platform: "INSTAGRAM", status: "SUCCESS" }]);

    const result = await checkAndPublish();

    expect(mockDb.content.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "SCHEDULED", scheduledAt: expect.any(Object) },
      })
    );
    expect(mockPublishContent).toHaveBeenCalledTimes(2);
    expect(mockSavePublishResults).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
    expect(result.published).toBe(2);
  });

  it("does not call publishContent when 0 contents are due", async () => {
    mockDb.content.findMany.mockResolvedValue([]);

    const result = await checkAndPublish();

    expect(mockPublishContent).not.toHaveBeenCalled();
    expect(mockSavePublishResults).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, published: 0, failed: 0 });
  });

  it("continues with next content when publishContent throws for one", async () => {
    const dueContents = [
      {
        id: "c1",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 60000),
        platforms: ["INSTAGRAM"],
        influencer: { id: "i1", name: "Inf1", socialAccounts: [] },
      },
      {
        id: "c2",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 120000),
        platforms: ["INSTAGRAM"],
        influencer: { id: "i2", name: "Inf2", socialAccounts: [] },
      },
    ];
    mockDb.content.findMany.mockResolvedValue(dueContents);
    mockPublishContent
      .mockRejectedValueOnce(new Error("Publish error"))
      .mockResolvedValueOnce([{ platform: "INSTAGRAM", status: "SUCCESS" }]);

    const result = await checkAndPublish();

    expect(mockPublishContent).toHaveBeenCalledTimes(2);
    expect(mockSavePublishResults).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.published).toBe(1);
  });
});
