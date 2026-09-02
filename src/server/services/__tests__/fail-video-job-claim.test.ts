import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  seedanceJob: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  remixJob: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const creditsMock = vi.hoisted(() => ({
  checkCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
}));

vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/server/services/credits.service", () => creditsMock);
vi.mock("@/server/services/webhook.service", () => ({
  emitEvent: vi.fn(),
}));
vi.mock("@/server/services/storage.service", () => ({
  uploadFromUrl: vi.fn(),
}));
vi.mock("@/server/services/video-providers/fal-seedance.provider", () => ({
  buildFalSeedancePayload: vi.fn(),
  checkFalSeedance: vi.fn(),
  submitFalSeedance: vi.fn(),
}));
vi.mock("@/server/services/video-providers/fal-kling-o3-remix.provider", () => ({
  buildFalKlingO3RemixPayload: vi.fn(),
  checkFalKlingO3Remix: vi.fn(),
  submitFalKlingO3Remix: vi.fn(),
}));

import { failSeedanceJob } from "@/server/services/seedance.service";
import { failRemixJob } from "@/server/services/remix.service";

const openSeedance = {
  id: "job-s",
  userId: "u1",
  influencerId: "inf-1",
  status: "IN_PROGRESS",
  creditsHeld: 180,
  durationSec: 10,
  resolution: "480p",
  mode: "IMAGE_TO_VIDEO",
};

const openRemix = {
  id: "job-r",
  userId: "u1",
  influencerId: "inf-1",
  status: "IN_PROGRESS",
  creditsHeld: 40,
  durationSec: 10,
  tier: "standard",
};

describe("failSeedanceJob claim-then-refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creditsMock.refundCredits.mockResolvedValue(undefined);
  });

  it("refunds once when two callers race on the same open job", async () => {
    mockDb.seedanceJob.findUnique.mockResolvedValue(openSeedance);
    let claimed = 0;
    mockDb.seedanceJob.updateMany.mockImplementation(async () => {
      claimed += 1;
      return { count: claimed === 1 ? 1 : 0 };
    });

    await Promise.all([
      failSeedanceJob("job-s", "timeout"),
      failSeedanceJob("job-s", "webhook failed"),
    ]);

    expect(mockDb.seedanceJob.updateMany).toHaveBeenCalledTimes(2);
    expect(creditsMock.refundCredits).toHaveBeenCalledTimes(1);
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 180);
    const where = mockDb.seedanceJob.updateMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["PENDING", "IN_PROGRESS"] });
  });

  it("does not refund a COMPLETED job", async () => {
    mockDb.seedanceJob.findUnique.mockResolvedValue({
      ...openSeedance,
      status: "COMPLETED",
    });
    mockDb.seedanceJob.updateMany.mockResolvedValue({ count: 0 });

    await failSeedanceJob("job-s", "stale");

    expect(creditsMock.refundCredits).not.toHaveBeenCalled();
  });
});

describe("failRemixJob claim-then-refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creditsMock.refundCredits.mockResolvedValue(undefined);
  });

  it("refunds once when two callers race on the same open job", async () => {
    mockDb.remixJob.findUnique.mockResolvedValue(openRemix);
    let claimed = 0;
    mockDb.remixJob.updateMany.mockImplementation(async () => {
      claimed += 1;
      return { count: claimed === 1 ? 1 : 0 };
    });

    await Promise.all([
      failRemixJob("job-r", "timeout"),
      failRemixJob("job-r", "webhook failed"),
    ]);

    expect(mockDb.remixJob.updateMany).toHaveBeenCalledTimes(2);
    expect(creditsMock.refundCredits).toHaveBeenCalledTimes(1);
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 40);
    const where = mockDb.remixJob.updateMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["PENDING", "IN_PROGRESS"] });
  });

  it("does not refund a COMPLETED job", async () => {
    mockDb.remixJob.findUnique.mockResolvedValue({
      ...openRemix,
      status: "COMPLETED",
    });
    mockDb.remixJob.updateMany.mockResolvedValue({ count: 0 });

    await failRemixJob("job-r", "stale");

    expect(creditsMock.refundCredits).not.toHaveBeenCalled();
  });
});
