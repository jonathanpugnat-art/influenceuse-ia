import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  content: {
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  contentBatch: { findUnique: vi.fn() },
}));
const mockGenerateContentImage = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/server/services/ai-image.service", () => ({
  generateContentImage: mockGenerateContentImage,
}));

import {
  processNextBatchSlice,
  getBatchStatus,
} from "@/server/services/batch.service";

function makeDraft(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    status: "DRAFT",
    type: "PHOTO",
    contentMode: "SFW",
    batchId: "b1",
    platforms: ["INSTAGRAM"],
    scheduledAt: new Date(Date.now() + 86_400_000),
    generationParams: {
      scene: "studio",
      pose: "portrait",
      outfit: "summer dress",
      expression: "smile",
      photoStyle: "natural",
      timeOfDay: "golden_hour",
    },
    influencer: {
      id: "i1",
      userId: "u1",
      age: 25,
      gender: "female",
      style: { ethnicity: "asian", hairColor: "black" },
      baseImageUrl: "https://example.com/face.jpg",
      avatarUrl: null,
    },
    ...overrides,
  };
}

describe("batch.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.content.update.mockResolvedValue(undefined);
    mockDb.content.count.mockResolvedValue(0);
  });

  it("returns zero counts when no drafts are pending", async () => {
    mockDb.content.findMany.mockResolvedValue([]);
    const result = await processNextBatchSlice();
    expect(result.generated).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockGenerateContentImage).not.toHaveBeenCalled();
  });

  it("generates each draft and promotes it to SCHEDULED when scheduledAt is future", async () => {
    mockDb.content.findMany.mockResolvedValue([makeDraft(), makeDraft({ id: "c2" })]);
    mockGenerateContentImage.mockResolvedValue({
      imageUrls: ["https://r2/u/1.jpg"],
      promptUsed: "p",
      negativePrompt: "n",
      parameters: {},
    });

    const result = await processNextBatchSlice({ sliceSize: 5 });

    expect(mockGenerateContentImage).toHaveBeenCalledTimes(2);
    expect(mockGenerateContentImage).toHaveBeenCalledWith(
      "u1",
      25,
      expect.any(Object),
      expect.objectContaining({
        sceneDescription: undefined,
      })
    );
    expect(result.generated).toBe(2);
    expect(result.failed).toBe(0);
    // Each draft is updated twice: once GENERATING, once SCHEDULED.
    const statuses = mockDb.content.update.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { status: string } }).data.status
    );
    expect(statuses).toContain("GENERATING");
    expect(statuses).toContain("SCHEDULED");
  });

  it("passes sceneDescription from content plan params to image generation", async () => {
    mockDb.content.findMany.mockResolvedValue([
      makeDraft({
        generationParams: {
          scene: "cafe",
          sceneDescription: "Parisian café terrace, golden hour, latte on table",
          pose: "candid",
          outfit: "linen blazer",
          expression: "natural",
          photoStyle: "editorial",
          timeOfDay: "golden_hour",
        },
      }),
    ]);
    mockGenerateContentImage.mockResolvedValue({
      imageUrls: ["https://r2/u/1.jpg"],
      promptUsed: "p",
      negativePrompt: "n",
      parameters: {},
    });

    await processNextBatchSlice({ sliceSize: 1 });

    expect(mockGenerateContentImage).toHaveBeenCalledWith(
      "u1",
      25,
      expect.any(Object),
      expect.objectContaining({
        scene: "cafe",
        sceneDescription: "Parisian café terrace, golden hour, latte on table",
      })
    );
  });

  it("marks the draft FAILED if image generation throws but keeps processing the next one", async () => {
    mockDb.content.findMany.mockResolvedValue([makeDraft(), makeDraft({ id: "c2" })]);
    mockGenerateContentImage
      .mockRejectedValueOnce(new Error("replicate boom"))
      .mockResolvedValueOnce({
        imageUrls: ["https://r2/u/2.jpg"],
        promptUsed: "p",
        negativePrompt: "n",
        parameters: {},
      });

    const result = await processNextBatchSlice({ sliceSize: 5 });

    expect(result.generated).toBe(1);
    expect(result.failed).toBe(1);
    const statuses = mockDb.content.update.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { status: string } }).data.status
    );
    expect(statuses).toContain("FAILED");
    expect(statuses).toContain("SCHEDULED");
  });

  it("getBatchStatus aggregates counts by status", async () => {
    mockDb.contentBatch.findUnique.mockResolvedValue({ id: "b1", name: "My batch" });
    mockDb.content.groupBy.mockResolvedValue([
      { status: "DRAFT", _count: { _all: 3 } },
      { status: "READY", _count: { _all: 2 } },
      { status: "FAILED", _count: { _all: 1 } },
    ]);

    const status = await getBatchStatus("b1");
    expect(status).toEqual({
      batchId: "b1",
      name: "My batch",
      total: 6,
      draft: 3,
      generating: 0,
      ready: 2,
      scheduled: 0,
      published: 0,
      failed: 1,
    });
  });
});
