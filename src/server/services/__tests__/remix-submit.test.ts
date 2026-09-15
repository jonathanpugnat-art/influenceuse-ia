import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { FalQueueSubmitError } from "@/server/services/image-providers/fal-queue.client";
import {
  consumeRemixContentPolicyAdvance,
  REMIX_CONTENT_POLICY_RATE_LIMIT,
  REMIX_CONTENT_POLICY_USER_MESSAGE,
  resetRemixContentPolicyRateLimit,
} from "@/lib/remix-engine";

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

const viggleMock = vi.hoisted(() => ({
  submitViggleRemix: vi.fn(),
  checkViggleRemix: vi.fn(),
}));

const wanMock = vi.hoisted(() => ({
  submitFalWanReplaceRemix: vi.fn(),
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
vi.mock("@/server/services/video-providers/viggle-remix.provider", () => viggleMock);
vi.mock(
  "@/server/services/video-providers/fal-wan-replace-remix.provider",
  () => wanMock
);

import { uploadFromUrl } from "@/server/services/storage.service";
import { emitEvent } from "@/server/services/webhook.service";
import {
  createRemixJob,
  finalizeRemixJob,
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
  falModel: "fal-ai/kling-video/v2.6/standard/motion-control",
  metadata: {
    v: 2,
    engine: "motion_control_cascade",
    orientation: "video",
    attemptIndex: 0,
    attempts: [],
  },
};

function policyError() {
  return new FalQueueSubmitError(422, "content_policy: fitness body blocked");
}

const cascadeBase = {
  jobId: "job-r-1",
  userId: "u1",
  startIndex: 0,
  priorRecords: [],
  webhookUrl:
    "https://www.aurainfluenceai.com/api/webhooks/fal-remix?job=job-r-1&secret=x",
  videoUrl: "https://cdn.example.com/clip.mp4",
  frontalImageUrl: "https://cdn.example.com/luana.jpg",
  referenceImageUrls: [] as string[],
  duration: 10 as const,
  keepAudio: true,
  characterName: "Luana",
  extraPromptTail: null,
  tier: "standard" as const,
  engine: "motion_control_cascade" as const,
  orientation: "video" as const,
};

describe("submitRemixAttemptsUntilAccepted cascade", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRemixContentPolicyRateLimit();
    process.env = { ...env };
    delete process.env.VIGGLE_API_KEY;
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);
    creditsMock.refundCredits.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = env;
  });

  it("tries v2.6 then accepts v3 standard after content_policy", async () => {
    falMcMock.submitFalKlingMotionControlRemix
      .mockRejectedValueOnce(policyError())
      .mockResolvedValueOnce({
        requestId: "fal-mc-v3",
        modelId: "fal-ai/kling-video/v3/standard/motion-control",
        prompt: "Transfer the motion from the reference video.",
        payload: {},
      });

    const attempts = planRemixAttempts({
      engine: "motion_control_cascade",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: {},
    });
    const result = await submitRemixAttemptsUntilAccepted({
      ...cascadeBase,
      attempts,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.requestId).toBe("fal-mc-v3");
    expect(falMcMock.submitFalKlingMotionControlRemix).toHaveBeenCalledTimes(2);
    expect(
      falMcMock.submitFalKlingMotionControlRemix.mock.calls[0][0].modelId
    ).toBe("fal-ai/kling-video/v2.6/standard/motion-control");
    expect(
      falMcMock.submitFalKlingMotionControlRemix.mock.calls[0][0]
        .includeFaceElement
    ).toBe(false);
    expect(
      falMcMock.submitFalKlingMotionControlRemix.mock.calls[1][0].modelId
    ).toBe("fal-ai/kling-video/v3/standard/motion-control");
    expect(wanMock.submitFalWanReplaceRemix).not.toHaveBeenCalled();
  });

  it("after 3 content_policy with Viggle: v2.6 → Viggle → Wan, never a 4th", async () => {
    falMcMock.submitFalKlingMotionControlRemix.mockRejectedValue(policyError());
    wanMock.submitFalWanReplaceRemix.mockRejectedValue(policyError());
    viggleMock.submitViggleRemix.mockRejectedValue(policyError());

    const attempts = planRemixAttempts({
      engine: "motion_control_cascade",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: { VIGGLE_API_KEY: "vg-test" },
    });
    const result = await submitRemixAttemptsUntilAccepted({
      ...cascadeBase,
      attempts,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.userError).toBe(REMIX_CONTENT_POLICY_USER_MESSAGE);
    expect(falMcMock.submitFalKlingMotionControlRemix).toHaveBeenCalledTimes(1);
    expect(viggleMock.submitViggleRemix).toHaveBeenCalledTimes(1);
    expect(wanMock.submitFalWanReplaceRemix).toHaveBeenCalledTimes(1);
    expect(
      falMcMock.submitFalKlingMotionControlRemix.mock.calls[0][0].modelId
    ).not.toContain("/v3/pro/");
    expect(
      result.meta.attempts.every((a) => a.errorClass === "content_policy")
    ).toBe(true);
  });

  it("after v2.6 content_policy with Viggle accepts Viggle and skips Wan", async () => {
    falMcMock.submitFalKlingMotionControlRemix.mockRejectedValue(policyError());
    viggleMock.submitViggleRemix.mockResolvedValue({
      requestId: "render_123",
      modelId: "viggle.ai/v1/renders",
      prompt: "Viggle video remix (character + motion)",
      payload: {},
    });

    const attempts = planRemixAttempts({
      engine: "motion_control_cascade",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: { VIGGLE_API_KEY: "vg-test" },
    });
    const result = await submitRemixAttemptsUntilAccepted({
      ...cascadeBase,
      attempts,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.requestId).toBe("render_123");
    expect(falMcMock.submitFalKlingMotionControlRemix).toHaveBeenCalledTimes(1);
    expect(viggleMock.submitViggleRemix).toHaveBeenCalledTimes(1);
    expect(wanMock.submitFalWanReplaceRemix).not.toHaveBeenCalled();
  });

  it("stops the cascade after the per-user content_policy rate limit", async () => {
    for (let i = 0; i < REMIX_CONTENT_POLICY_RATE_LIMIT; i++) {
      expect(consumeRemixContentPolicyAdvance("u1")).toBe(true);
    }
    falMcMock.submitFalKlingMotionControlRemix.mockRejectedValue(policyError());

    const attempts = planRemixAttempts({
      engine: "motion_control_cascade",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: {},
    });
    const result = await submitRemixAttemptsUntilAccepted({
      ...cascadeBase,
      attempts,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.userError).toBe(REMIX_CONTENT_POLICY_USER_MESSAGE);
    expect(falMcMock.submitFalKlingMotionControlRemix).toHaveBeenCalledTimes(1);
    expect(wanMock.submitFalWanReplaceRemix).not.toHaveBeenCalled();
  });
});

describe("createRemixJob + handleRemixProviderFailure refund", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRemixContentPolicyRateLimit();
    process.env = { ...env };
    process.env.NEXT_PUBLIC_APP_URL = "https://www.aurainfluenceai.com";
    process.env.REMIX_WEBHOOK_SECRET = "remix-secret";
    delete process.env.REMIX_ENGINE;
    delete process.env.VIGGLE_API_KEY;
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

  it("refunds after content_policy exhausts the cascade on submit", async () => {
    falMcMock.submitFalKlingMotionControlRemix.mockRejectedValue(policyError());
    wanMock.submitFalWanReplaceRemix.mockRejectedValue(policyError());

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
    expect(falMcMock.submitFalKlingMotionControlRemix).toHaveBeenCalledTimes(2);
    expect(wanMock.submitFalWanReplaceRemix).toHaveBeenCalledTimes(1);
    expect(viggleMock.submitViggleRemix).not.toHaveBeenCalled();
    expect(falO3Mock.submitFalKlingO3Remix).not.toHaveBeenCalled();
  });

  it("refunds on webhook content_policy when no cascade step remains", async () => {
    mockDb.remixJob.findUnique.mockResolvedValue({
      ...pendingRemix,
      status: "IN_PROGRESS",
      sourceDurationSec: 10,
      durationSec: 10,
      falModel: "fal-ai/wan/v2.2-14b/animate/replace",
      metadata: {
        v: 2,
        engine: "motion_control_cascade",
        orientation: "video",
        attemptIndex: 2,
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

describe("finalizeRemixJob atomic falRequestId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRemixContentPolicyRateLimit();
    vi.mocked(uploadFromUrl).mockResolvedValue(
      "https://cdn.example.com/remix-out.mp4"
    );
    mockDb.remixJob.updateMany.mockResolvedValue({ count: 1 });
  });

  it("ignores a mismatched falRequestId without completing", async () => {
    mockDb.remixJob.findUnique.mockResolvedValue({
      ...pendingRemix,
      status: "IN_PROGRESS",
      falRequestId: "fal-current",
    });

    await finalizeRemixJob("job-r-1", {
      videoUrl: "https://fal.example/stale.mp4",
      requestId: "fal-stale",
    });

    expect(uploadFromUrl).not.toHaveBeenCalled();
    expect(mockDb.remixJob.updateMany).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it("ignores REFUNDED and never overwrites it", async () => {
    mockDb.remixJob.findUnique.mockResolvedValue({
      ...pendingRemix,
      status: "REFUNDED",
      falRequestId: "fal-mc-1",
    });

    await finalizeRemixJob("job-r-1", {
      videoUrl: "https://fal.example/late.mp4",
      requestId: "fal-mc-1",
    });

    expect(uploadFromUrl).not.toHaveBeenCalled();
    expect(mockDb.remixJob.updateMany).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
    expect(creditsMock.refundCredits).not.toHaveBeenCalled();
  });

  it("completes PENDING|IN_PROGRESS when falRequestId matches", async () => {
    mockDb.remixJob.findUnique.mockResolvedValue({
      ...pendingRemix,
      status: "IN_PROGRESS",
      falRequestId: "fal-mc-1",
    });

    await finalizeRemixJob("job-r-1", {
      videoUrl: "https://fal.example/ok.mp4",
      requestId: "fal-mc-1",
    });

    expect(uploadFromUrl).toHaveBeenCalled();
    expect(mockDb.remixJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "job-r-1",
          status: { in: ["PENDING", "IN_PROGRESS"] },
          falRequestId: "fal-mc-1",
        },
        data: expect.objectContaining({
          status: "COMPLETED",
          outputVideoUrl: "https://cdn.example.com/remix-out.mp4",
        }),
      })
    );
    expect(emitEvent).toHaveBeenCalledWith(
      "u1",
      "REMIX_COMPLETED",
      expect.objectContaining({ jobId: "job-r-1" })
    );
  });

  it("no-ops when updateMany claims zero rows (already terminal)", async () => {
    mockDb.remixJob.findUnique.mockResolvedValue({
      ...pendingRemix,
      status: "IN_PROGRESS",
      falRequestId: "fal-mc-1",
    });
    mockDb.remixJob.updateMany.mockResolvedValue({ count: 0 });

    await finalizeRemixJob("job-r-1", {
      videoUrl: "https://fal.example/ok.mp4",
      requestId: "fal-mc-1",
    });

    expect(emitEvent).not.toHaveBeenCalled();
  });
});
