import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  NSFW_CONSENT_REQUIRED_MESSAGE,
  NSFW_ENGINE_UNREACHABLE_MESSAGE,
  WAVESPEED_MISSING_KEY_MESSAGE,
} from "@/lib/wavespeed-spicy-config";

const mockDb = vi.hoisted(() => ({
  influencer: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  wavespeedSpicyJob: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mediaAsset: {
    create: vi.fn(),
  },
}));

const creditsMock = vi.hoisted(() => ({
  checkCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
}));

const resolveMock = vi.hoisted(() => ({
  resolvePublicMediaUrl: vi.fn(),
}));

const providerMock = vi.hoisted(() => ({
  submitWavespeedSpicy: vi.fn(),
  checkWavespeedSpicy: vi.fn(),
}));

vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/server/services/credits.service", () => creditsMock);
vi.mock("@/server/lib/resolve-public-media-url", () => resolveMock);
vi.mock("@/server/services/storage.service", () => ({
  uploadFromUrl: vi.fn(),
}));
vi.mock("@/server/services/webhook.service", () => ({
  emitEvent: vi.fn(),
}));
vi.mock("@/server/services/video-providers/wavespeed-spicy.provider", () => providerMock);
vi.mock("@/lib/identity-pack", () => ({
  parseIdentityPack: () => null,
}));

import {
  createWavespeedSpicyJob,
  failWavespeedSpicyJob,
} from "@/server/services/wavespeed-spicy.service";

const baseEnv = { ...process.env };

describe("createWavespeedSpicyJob gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...baseEnv };
    delete process.env.NSFW_ENGINE;
    delete process.env.WAVESPEED_API_KEY;
  });

  afterEach(() => {
    process.env = { ...baseEnv };
  });

  it("flag off = unreachable (no hold)", async () => {
    await expect(
      createWavespeedSpicyJob({
        userId: "u1",
        plan: "PRO",
        influencerId: "inf-1",
        prompt: "slow motion",
        requestedDuration: 5,
        requestedResolution: "720p",
        consentAccepted: true,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: NSFW_ENGINE_UNREACHABLE_MESSAGE,
    });
    expect(creditsMock.deductCredits).not.toHaveBeenCalled();
    expect(mockDb.wavespeedSpicyJob.create).not.toHaveBeenCalled();
  });

  it("flag on without key = fail-closed FR toast (no hold)", async () => {
    process.env.NSFW_ENGINE = "wavespeed_spicy";
    await expect(
      createWavespeedSpicyJob({
        userId: "u1",
        plan: "PRO",
        influencerId: "inf-1",
        prompt: "slow motion",
        requestedDuration: 5,
        requestedResolution: "720p",
        consentAccepted: true,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: WAVESPEED_MISSING_KEY_MESSAGE,
    });
    expect(creditsMock.deductCredits).not.toHaveBeenCalled();
  });

  it("consent required", async () => {
    process.env.NSFW_ENGINE = "wavespeed_spicy";
    process.env.WAVESPEED_API_KEY = "ws_test";
    mockDb.influencer.findFirst.mockResolvedValue({
      id: "inf-1",
      name: "Luna",
      age: 24,
      isNsfw: true,
      baseImageUrl: "https://cdn.example.com/luna.jpg",
      avatarUrl: null,
      identityPack: null,
    });
    resolveMock.resolvePublicMediaUrl.mockResolvedValue(
      "https://cdn.example.com/luna.jpg"
    );

    await expect(
      createWavespeedSpicyJob({
        userId: "u1",
        plan: "PRO",
        influencerId: "inf-1",
        prompt: "slow motion",
        requestedDuration: 5,
        requestedResolution: "720p",
        consentAccepted: false,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: NSFW_CONSENT_REQUIRED_MESSAGE,
    });
    expect(creditsMock.deductCredits).not.toHaveBeenCalled();
  });

  it("does not route Creator / Free", async () => {
    process.env.NSFW_ENGINE = "wavespeed_spicy";
    process.env.WAVESPEED_API_KEY = "ws_test";
    await expect(
      createWavespeedSpicyJob({
        userId: "u1",
        plan: "STARTER",
        influencerId: "inf-1",
        prompt: "slow motion",
        requestedDuration: 5,
        requestedResolution: "720p",
        consentAccepted: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("holds credits then refunds if WaveSpeed submit fails", async () => {
    process.env.NSFW_ENGINE = "wavespeed_spicy";
    process.env.WAVESPEED_API_KEY = "ws_test";
    mockDb.influencer.findFirst.mockResolvedValue({
      id: "inf-1",
      name: "Luna",
      age: 24,
      isNsfw: true,
      baseImageUrl: "https://cdn.example.com/luna.jpg",
      avatarUrl: null,
      identityPack: null,
    });
    resolveMock.resolvePublicMediaUrl.mockResolvedValue(
      "https://cdn.example.com/luna.jpg"
    );
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);
    mockDb.influencer.update.mockResolvedValue({});
    mockDb.wavespeedSpicyJob.create.mockResolvedValue({
      id: "job-ws",
      userId: "u1",
      influencerId: "inf-1",
      creditsHeld: 24,
      status: "PENDING",
    });
    mockDb.wavespeedSpicyJob.findUnique.mockResolvedValue({
      id: "job-ws",
      userId: "u1",
      influencerId: "inf-1",
      creditsHeld: 24,
      status: "PENDING",
      durationSec: 5,
      resolution: "720p",
    });
    mockDb.wavespeedSpicyJob.updateMany.mockResolvedValue({ count: 1 });
    providerMock.submitWavespeedSpicy.mockRejectedValue(
      new Error("upstream 500")
    );

    await expect(
      createWavespeedSpicyJob({
        userId: "u1",
        plan: "PRO",
        influencerId: "inf-1",
        prompt: "slow turn toward camera",
        requestedDuration: 5,
        requestedResolution: "720p",
        consentAccepted: true,
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(creditsMock.deductCredits).toHaveBeenCalledWith("u1", 24);
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 24);
  });
});

describe("failWavespeedSpicyJob claim-then-refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creditsMock.refundCredits.mockResolvedValue(undefined);
  });

  it("refunds once when two callers race", async () => {
    mockDb.wavespeedSpicyJob.findUnique.mockResolvedValue({
      id: "job-ws",
      userId: "u1",
      influencerId: "inf-1",
      status: "IN_PROGRESS",
      creditsHeld: 24,
      durationSec: 5,
      resolution: "720p",
    });
    let claimed = 0;
    mockDb.wavespeedSpicyJob.updateMany.mockImplementation(async () => {
      claimed += 1;
      return { count: claimed === 1 ? 1 : 0 };
    });

    await Promise.all([
      failWavespeedSpicyJob("job-ws", "timeout"),
      failWavespeedSpicyJob("job-ws", "poll failed"),
    ]);

    expect(creditsMock.refundCredits).toHaveBeenCalledTimes(1);
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 24);
  });

  it("does not refund a COMPLETED job", async () => {
    mockDb.wavespeedSpicyJob.findUnique.mockResolvedValue({
      id: "job-ws",
      userId: "u1",
      status: "COMPLETED",
      creditsHeld: 24,
    });
    mockDb.wavespeedSpicyJob.updateMany.mockResolvedValue({ count: 0 });
    await failWavespeedSpicyJob("job-ws", "stale");
    expect(creditsMock.refundCredits).not.toHaveBeenCalled();
  });
});
