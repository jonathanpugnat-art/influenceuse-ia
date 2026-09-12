import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { FalQueueSubmitError } from "@/server/services/image-providers/fal-queue.client";
import { REMIX_CONTENT_POLICY_USER_MESSAGE } from "@/lib/remix-engine";

const mockDb = vi.hoisted(() => ({
  influencer: { findFirst: vi.fn() },
  remixJob: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const creditsMock = vi.hoisted(() => ({
  checkCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
}));

const falMcMock = vi.hoisted(() => ({
  submitFalKlingMotionControlRemix: vi.fn(),
  submitFalKlingO1V2vEdit: vi.fn(),
  checkFalRemixQueue: vi.fn(),
}));

const falO3Mock = vi.hoisted(() => ({
  submitFalKlingO3Remix: vi.fn(),
}));

vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/server/services/credits.service", () => creditsMock);
vi.mock("@/server/services/webhook.service", () => ({ emitEvent: vi.fn() }));
vi.mock("@/server/services/storage.service", () => ({ uploadFromUrl: vi.fn() }));
vi.mock("@/server/lib/resolve-public-media-url", () => ({
  resolvePublicMediaUrl: vi.fn(async (url: string | null | undefined) =>
    url?.startsWith("http") ? url : undefined
  ),
}));
vi.mock(
  "@/server/services/video-providers/fal-kling-motion-control-remix.provider",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/server/services/video-providers/fal-kling-motion-control-remix.provider")
      >();
    return { ...actual, ...falMcMock };
  }
);
vi.mock(
  "@/server/services/video-providers/fal-kling-o3-remix.provider",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/server/services/video-providers/fal-kling-o3-remix.provider")
      >();
    return { ...actual, ...falO3Mock };
  }
);

import {
  createRemixJob,
  handleRemixProviderFailure,
  submitRemixAttemptsUntilAccepted,
} from "@/server/services/remix.service";
import { planRemixAttempts } from "@/lib/remix-engine";

const pendingRemix = {
  id: "job-r-1",
  userId: "u1",
  influencerId: "inf-1",
  status: "PENDING" as const,
  creditsHeld: 100,
  durationSec: 10,
  sourceDurationSec: 10,
  sourceVideoUrl: "https://cdn.example.com/clip.mp4",
  frontalImageUrl: "https://cdn.example.com/luana.jpg",
  referenceImageUrls: [] as string[],
  keepAudio: true,
  tier: "standard",
  falRequestId: "fal-mc-1",
  falModel: "fal-ai/kling-video/v3/standard/motion-control",
  metadata: {
    v: 2,
    engine: "motion_control_v3_std",
    orientation: "video",
    attemptIndex: 0,
    attempts: [],
  },
};

function policyError() {
  return new FalQueueSubmitError(422, "content_policy: fitness body blocked");
}

describe("submitRemixAttemptsUntilAccepted", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...env };
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);
    creditsMock.refundCredits.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = env;
  });

  const baseInput = {
    jobId: "job-r-1",
    startIndex: 0,
    priorRecords: [],
    webhookUrl: "https://www.aurainfluenceai.com/api/webhooks/fal-remix?job=job-r-1&secret=x",
    videoUrl: "https://cdn.example.com/clip.mp4",
    frontalImageUrl: "https://cdn.example.com/luana.jpg",
    referenceImageUrls: [] as string[],
    duration: 10 as const,
    keepAudio: true,
    characterName: "Luana",
    extraPromptTail: null,
    tier: "standard" as const,
    engine: "motion_control_v3_std" as const,
    orientation: "video" as const,
  };

  it("retries inverse orientation after content_policy then accepts", async () => {
    falMcMock.submitFalKlingMotionControlRemix
      .mockRejectedValueOnce(policyError())
      .mockResolvedValueOnce({
        requestId: "fal-mc-image",
        modelId: "fal-ai/kling-video/v3/standard/motion-control",
        prompt: "Transfer the motion from the reference video.",
        payload: { character_orientation: "image" },
      });

    const attempts = planRemixAttempts({
      engine: "motion_control_v3_std",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: {},
    });
    const result = await submitRemixAttemptsUntilAccepted({
      ...baseInput,
      attempts,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.requestId).toBe("fal-mc-image");
    expect(falMcMock.submitFalKlingMotionControlRemix).toHaveBeenCalledTimes(2);
    expect(
      falMcMock.submitFalKlingMotionControlRemix.mock.calls[0][0].orientation
    ).toBe("video");
    expect(
      falMcMock.submitFalKlingMotionControlRemix.mock.calls[1][0].orientation
    ).toBe("image");
    expect(falMcMock.submitFalKlingO1V2vEdit).not.toHaveBeenCalled();
  });

  it("falls through to O1 then refunds with the FR toast when every engine is blocked", async () => {
    falMcMock.submitFalKlingMotionControlRemix.mockRejectedValue(policyError());
    falMcMock.submitFalKlingO1V2vEdit.mockRejectedValue(policyError());

    const attempts = planRemixAttempts({
      engine: "motion_control_v3_std",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: {},
    });
    const result = await submitRemixAttemptsUntilAccepted({
      ...baseInput,
      attempts,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.userError).toBe(REMIX_CONTENT_POLICY_USER_MESSAGE);
    expect(falMcMock.submitFalKlingMotionControlRemix).toHaveBeenCalledTimes(2);
    expect(falMcMock.submitFalKlingO1V2vEdit).toHaveBeenCalledTimes(1);
    expect(result.meta.attempts.every((a) => a.errorClass === "content_policy")).toBe(
      true
    );
  });
});

describe("createRemixJob + handleRemixProviderFailure refund", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...env };
    process.env.NEXT_PUBLIC_APP_URL = "https://www.aurainfluenceai.com";
    process.env.REMIX_WEBHOOK_SECRET = "remix-secret";
    delete process.env.REMIX_ENGINE;
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);
    creditsMock.refundCredits.mockResolvedValue(undefined);
    mockDb.influencer.findFirst.mockResolvedValue({
      id: "inf-1",
      name: "Luana",
      baseImageUrl: "https://cdn.example.com/luana.jpg",
      avatarUrl: null,
      identityPack: null,
    });
    mockDb.remixJob.create.mockResolvedValue(pendingRemix);
    mockDb.remixJob.findUnique.mockResolvedValue(pendingRemix);
    mockDb.remixJob.updateMany.mockResolvedValue({ count: 1 });
    mockDb.remixJob.update.mockResolvedValue(pendingRemix);
  });

  afterEach(() => {
    process.env = env;
  });

  it("refunds after content_policy exhausts fallbacks on submit", async () => {
    falMcMock.submitFalKlingMotionControlRemix.mockRejectedValue(policyError());
    falMcMock.submitFalKlingO1V2vEdit.mockRejectedValue(policyError());

    await expect(
      createRemixJob({
        userId: "u1",
        influencerId: "inf-1",
        tier: "standard",
        sourceVideoUrl: "https://cdn.example.com/clip.mp4",
        sourceDurationSec: 10,
        requestedDuration: 10,
        keepAudio: true,
        characterOrientation: "video",
      })
    ).rejects.toMatchObject({
      name: "TRPCError",
      message: REMIX_CONTENT_POLICY_USER_MESSAGE,
    } satisfies Partial<TRPCError>);

    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 100);
    expect(falO3Mock.submitFalKlingO3Remix).not.toHaveBeenCalled();
  });

  it("refunds on webhook content_policy when no fallback remains", async () => {
    mockDb.remixJob.findUnique.mockResolvedValue({
      ...pendingRemix,
      status: "IN_PROGRESS",
      sourceDurationSec: 25,
      durationSec: 15,
      metadata: {
        v: 2,
        engine: "motion_control_v3_std",
        orientation: "video",
        attemptIndex: 0,
        attempts: [],
      },
    });

    const outcome = await handleRemixProviderFailure(
      "job-r-1",
      "FAL submit failed (422): content_policy",
      "fal-mc-1"
    );

    expect(outcome).toBe("refunded");
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 100);
    expect(falMcMock.submitFalKlingMotionControlRemix).not.toHaveBeenCalled();
    expect(mockDb.remixJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REFUNDED",
          error: REMIX_CONTENT_POLICY_USER_MESSAGE,
        }),
      })
    );
  });
});
