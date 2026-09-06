import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const mockDb = vi.hoisted(() => ({
  influencer: { findFirst: vi.fn() },
  seedanceJob: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
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

const falSeedanceMock = vi.hoisted(() => ({
  submitFalSeedance: vi.fn(),
  checkFalSeedance: vi.fn(),
}));

const falRemixMock = vi.hoisted(() => ({
  submitFalKlingO3Remix: vi.fn(),
  checkFalKlingO3Remix: vi.fn(),
}));

const falKlingSceneMock = vi.hoisted(() => ({
  submitFalKlingO3I2v: vi.fn(),
  checkFalKlingO3I2v: vi.fn(),
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
vi.mock("@/server/services/video-providers/fal-seedance.provider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/server/services/video-providers/fal-seedance.provider")
    >();
  return { ...actual, ...falSeedanceMock };
});
vi.mock("@/server/services/video-providers/fal-kling-o3-remix.provider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/server/services/video-providers/fal-kling-o3-remix.provider")
    >();
  return { ...actual, ...falRemixMock };
});
vi.mock("@/server/services/video-providers/fal-kling-o3-i2v.provider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/server/services/video-providers/fal-kling-o3-i2v.provider")
    >();
  return { ...actual, ...falKlingSceneMock };
});

import {
  buildSeedanceWebhookUrl,
  createSeedanceJob,
} from "@/server/services/seedance.service";
import { createKlingSceneJob } from "@/server/services/kling-scene.service";
import {
  buildRemixWebhookUrl,
  createRemixJob,
} from "@/server/services/remix.service";
import {
  MISSING_REMIX_WEBHOOK_SECRET,
  MISSING_SEEDANCE_WEBHOOK_SECRET,
} from "@/server/services/fal-video-webhook";
import { FalQueueSubmitError } from "@/server/services/image-providers/fal-queue.client";
import { FAL_REFERENCE_POLICY_USER_MESSAGE } from "@/lib/generation-errors";

const pendingSeedance = {
  id: "job-s-1",
  userId: "u1",
  influencerId: "inf-1",
  status: "PENDING",
  creditsHeld: 180,
  durationSec: 10,
  resolution: "480p",
  mode: "REFERENCE_TO_VIDEO",
};

const pendingRemix = {
  id: "job-r-1",
  userId: "u1",
  influencerId: "inf-1",
  status: "PENDING",
  creditsHeld: 100,
  durationSec: 10,
  tier: "standard",
};

function stubInfluencer() {
  mockDb.influencer.findFirst.mockResolvedValue({
    id: "inf-1",
    name: "Luana",
    baseImageUrl: "https://cdn.example.com/luana.jpg",
    avatarUrl: null,
    identityPack: null,
  });
}

describe("Seedance webhook URL + fail-closed submit", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...env };
    process.env.NEXT_PUBLIC_APP_URL = "https://www.aurainfluenceai.com";
    delete process.env.SEEDANCE_WEBHOOK_SECRET;
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);
    creditsMock.refundCredits.mockResolvedValue(undefined);
    stubInfluencer();
    mockDb.seedanceJob.create.mockResolvedValue(pendingSeedance);
    mockDb.seedanceJob.findUnique.mockResolvedValue(pendingSeedance);
    mockDb.seedanceJob.updateMany.mockResolvedValue({ count: 1 });
    mockDb.seedanceJob.update.mockResolvedValue(pendingSeedance);
  });

  afterEach(() => {
    process.env = env;
  });

  it("builds a signed webhook URL that contains the job id and secret query", () => {
    process.env.SEEDANCE_WEBHOOK_SECRET = "seed-secret";
    const url = buildSeedanceWebhookUrl("job-s-1");
    expect(url).toBeDefined();
    const parsed = new URL(url!);
    expect(parsed.origin).toBe("https://www.aurainfluenceai.com");
    expect(parsed.pathname).toBe("/api/webhooks/fal-seedance");
    expect(parsed.searchParams.get("job")).toBe("job-s-1");
    expect(parsed.searchParams.get("secret")).toBe("seed-secret");
  });

  it("does not submit to Fal and refunds when SEEDANCE_WEBHOOK_SECRET is missing", async () => {
    await expect(
      createSeedanceJob({
        userId: "u1",
        influencerId: "inf-1",
        scenePrompt: "walking on a rooftop at sunset",
        requestedDuration: 10,
        requestedResolution: "480p",
        generateAudio: true,
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(falSeedanceMock.submitFalSeedance).not.toHaveBeenCalled();
    expect(mockDb.seedanceJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "job-s-1",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        data: expect.objectContaining({
          status: "REFUNDED",
          error: MISSING_SEEDANCE_WEBHOOK_SECRET,
        }),
      })
    );
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 180);
  });

  it("submits to Fal with the signed webhook URL when the secret is set", async () => {
    process.env.SEEDANCE_WEBHOOK_SECRET = "seed-secret";
    falSeedanceMock.submitFalSeedance.mockResolvedValue({
      requestId: "fal-req-1",
      modelId: "bytedance/seedance-2.5/image-to-video",
      mode: "image_to_video",
      payload: { image_url: "https://cdn.example.com/luana.jpg" },
      prompt: "ok",
    });

    const result = await createSeedanceJob({
      userId: "u1",
      influencerId: "inf-1",
      scenePrompt: "walking on a rooftop at sunset",
      requestedDuration: 10,
      requestedResolution: "480p",
      generateAudio: true,
    });

    expect(result.status).toBe("IN_PROGRESS");
    expect(result.mode).toBe("image_to_video");
    expect(falSeedanceMock.submitFalSeedance).toHaveBeenCalledTimes(1);
    const submitted = falSeedanceMock.submitFalSeedance.mock.calls[0][0];
    expect(submitted.webhookUrl).toContain("job=job-s-1");
    expect(submitted.webhookUrl).toContain("secret=seed-secret");
    expect(submitted.mode).toBe("image_to_video");
    expect(submitted.referenceImageUrls).toEqual([
      "https://cdn.example.com/luana.jpg",
    ]);
    expect(creditsMock.refundCredits).not.toHaveBeenCalled();
  });

  it("V1 canary: a 4-shot identity pack still submits i2v with only the frontal", async () => {
    process.env.SEEDANCE_WEBHOOK_SECRET = "seed-secret";
    mockDb.influencer.findFirst.mockResolvedValue({
      id: "inf-1",
      name: "Luana",
      baseImageUrl: "https://cdn.example.com/luana.jpg",
      avatarUrl: null,
      identityPack: {
        status: "ready",
        shots: [
          { id: "portrait_front", url: "https://cdn.example.com/luana.jpg" },
          { id: "profile", url: "https://cdn.example.com/profile.jpg" },
          { id: "three_quarter", url: "https://cdn.example.com/34.jpg" },
          { id: "full_body", url: "https://cdn.example.com/full.jpg" },
        ],
        updatedAt: "2026-09-06T00:00:00.000Z",
      },
    });
    falSeedanceMock.submitFalSeedance.mockResolvedValue({
      requestId: "fal-i2v-1",
      modelId: "bytedance/seedance-2.5/image-to-video",
      mode: "image_to_video",
      payload: { image_url: "https://cdn.example.com/luana.jpg" },
      prompt: "ok",
    });

    await createSeedanceJob({
      userId: "u1",
      influencerId: "inf-1",
      scenePrompt: "walking on a rooftop at sunset",
      requestedDuration: 10,
      requestedResolution: "480p",
      generateAudio: true,
    });

    const submitted = falSeedanceMock.submitFalSeedance.mock.calls[0][0];
    expect(submitted.mode).toBe("image_to_video");
    expect(submitted.referenceImageUrls).toEqual([
      "https://cdn.example.com/luana.jpg",
    ]);
    expect(mockDb.seedanceJob.create.mock.calls[0][0].data.mode).toBe(
      "IMAGE_TO_VIDEO"
    );
  });

  it("persists Fal 422 status + detail on job.error and sanitizes the user toast", async () => {
    process.env.SEEDANCE_WEBHOOK_SECRET = "seed-secret";
    falSeedanceMock.submitFalSeedance.mockRejectedValue(
      new FalQueueSubmitError(422, "Unexpected status code: 422")
    );

    let caught: unknown;
    try {
      await createSeedanceJob({
        userId: "u1",
        influencerId: "inf-1",
        scenePrompt: "walking on a rooftop at sunset",
        requestedDuration: 10,
        requestedResolution: "480p",
        generateAudio: true,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TRPCError);
    const trpcErr = caught as TRPCError;
    expect(trpcErr.message).toBe(FAL_REFERENCE_POLICY_USER_MESSAGE);
    expect(trpcErr.message).not.toContain("https://");
    expect(trpcErr.message).not.toContain("FAL_KEY");
    expect(trpcErr.message).not.toContain("seed-secret");
    expect(trpcErr.message).not.toContain("422");

    const persisted: string =
      mockDb.seedanceJob.updateMany.mock.calls[0][0].data.error;
    expect(persisted).toContain("422");
    expect(persisted).toContain("Unexpected status code: 422");
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 180);
  });
});

const pendingKlingScene = {
  id: "job-k-1",
  userId: "u1",
  influencerId: "inf-1",
  status: "PENDING",
  creditsHeld: 40,
  durationSec: 5,
  resolution: "standard",
  mode: "IMAGE_TO_VIDEO",
};

describe("Kling O3 scene I2V submit (SCENE_ENGINE default)", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...env };
    process.env.NEXT_PUBLIC_APP_URL = "https://www.aurainfluenceai.com";
    delete process.env.SEEDANCE_WEBHOOK_SECRET;
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);
    creditsMock.refundCredits.mockResolvedValue(undefined);
    stubInfluencer();
    mockDb.seedanceJob.create.mockResolvedValue(pendingKlingScene);
    mockDb.seedanceJob.findUnique.mockResolvedValue(pendingKlingScene);
    mockDb.seedanceJob.updateMany.mockResolvedValue({ count: 1 });
    mockDb.seedanceJob.update.mockResolvedValue(pendingKlingScene);
  });

  afterEach(() => {
    process.env = env;
  });

  it("does not submit Seedance and refunds when SEEDANCE_WEBHOOK_SECRET is missing", async () => {
    await expect(
      createKlingSceneJob({
        userId: "u1",
        influencerId: "inf-1",
        scenePrompt: "walking on a rooftop at sunset",
        requestedDuration: 5,
        generateAudio: false,
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(falKlingSceneMock.submitFalKlingO3I2v).not.toHaveBeenCalled();
    expect(falSeedanceMock.submitFalSeedance).not.toHaveBeenCalled();
    expect(mockDb.seedanceJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REFUNDED",
          error: MISSING_SEEDANCE_WEBHOOK_SECRET,
        }),
      })
    );
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 40);
  });

  it("queues Kling O3 I2V with falRequestId and never calls Seedance", async () => {
    process.env.SEEDANCE_WEBHOOK_SECRET = "seed-secret";
    falKlingSceneMock.submitFalKlingO3I2v.mockResolvedValue({
      requestId: "fal-kling-scene-1",
      modelId: "fal-ai/kling-video/o3/standard/image-to-video",
      payload: { image_url: "https://cdn.example.com/luana.jpg" },
      prompt: "walking on a rooftop at sunset",
    });

    const result = await createKlingSceneJob({
      userId: "u1",
      influencerId: "inf-1",
      scenePrompt: "walking on a rooftop at sunset",
      requestedDuration: 5,
      generateAudio: false,
    });

    expect(result.status).toBe("IN_PROGRESS");
    expect(result.mode).toBe("kling_o3_i2v");
    expect(result.cost).toBe(40);
    expect(result.durationSec).toBe(5);
    expect(falSeedanceMock.submitFalSeedance).not.toHaveBeenCalled();
    expect(falKlingSceneMock.submitFalKlingO3I2v).toHaveBeenCalledTimes(1);
    const submitted = falKlingSceneMock.submitFalKlingO3I2v.mock.calls[0][0];
    expect(submitted.imageUrl).toBe("https://cdn.example.com/luana.jpg");
    expect(submitted.duration).toBe(5);
    expect(submitted.generateAudio).toBe(false);
    expect(submitted.webhookUrl).toContain("job=job-k-1");
    expect(mockDb.seedanceJob.create.mock.calls[0][0].data.creditsHeld).toBe(
      40
    );
    expect(mockDb.seedanceJob.create.mock.calls[0][0].data.resolution).toBe(
      "standard"
    );
    expect(mockDb.seedanceJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          falRequestId: "fal-kling-scene-1",
          falModel: "fal-ai/kling-video/o3/standard/image-to-video",
        }),
      })
    );
    expect(creditsMock.refundCredits).not.toHaveBeenCalled();
  });

  it("sends only the frontal still even when the identity pack has 4 shots", async () => {
    process.env.SEEDANCE_WEBHOOK_SECRET = "seed-secret";
    mockDb.influencer.findFirst.mockResolvedValue({
      id: "inf-1",
      name: "Luana",
      baseImageUrl: "https://cdn.example.com/luana.jpg",
      avatarUrl: null,
      identityPack: {
        status: "ready",
        shots: [
          { id: "portrait_front", url: "https://cdn.example.com/front.jpg" },
          { id: "profile", url: "https://cdn.example.com/profile.jpg" },
          { id: "three_quarter", url: "https://cdn.example.com/34.jpg" },
          { id: "full_body", url: "https://cdn.example.com/full.jpg" },
        ],
        updatedAt: "2026-09-06T00:00:00.000Z",
      },
    });
    falKlingSceneMock.submitFalKlingO3I2v.mockResolvedValue({
      requestId: "fal-kling-front",
      modelId: "fal-ai/kling-video/o3/standard/image-to-video",
      payload: {},
      prompt: "ok",
    });

    await createKlingSceneJob({
      userId: "u1",
      influencerId: "inf-1",
      scenePrompt: "walking on a rooftop at sunset",
      requestedDuration: 5,
      generateAudio: false,
    });

    const submitted = falKlingSceneMock.submitFalKlingO3I2v.mock.calls[0][0];
    expect(submitted.imageUrl).toBe("https://cdn.example.com/front.jpg");
    expect(mockDb.seedanceJob.create.mock.calls[0][0].data.referenceImageUrls).toEqual(
      ["https://cdn.example.com/front.jpg"]
    );
  });

  it("holds 100 credits for 10s audio ON and refunds a Fal 422", async () => {
    process.env.SEEDANCE_WEBHOOK_SECRET = "seed-secret";
    const pendingAudioOn = { ...pendingKlingScene, creditsHeld: 100 };
    mockDb.seedanceJob.create.mockResolvedValue(pendingAudioOn);
    mockDb.seedanceJob.findUnique.mockResolvedValue(pendingAudioOn);
    falKlingSceneMock.submitFalKlingO3I2v.mockRejectedValue(
      new FalQueueSubmitError(422, "Unexpected status code: 422")
    );

    let caught: unknown;
    try {
      await createKlingSceneJob({
        userId: "u1",
        influencerId: "inf-1",
        scenePrompt: "walking on a rooftop at sunset",
        requestedDuration: 10,
        generateAudio: true,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TRPCError);
    expect((caught as TRPCError).message).toBe(
      FAL_REFERENCE_POLICY_USER_MESSAGE
    );
    expect((caught as TRPCError).message).not.toContain("images de référence Seedance");
    expect(mockDb.seedanceJob.create.mock.calls[0][0].data.creditsHeld).toBe(
      100
    );
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 100);
    expect(falSeedanceMock.submitFalSeedance).not.toHaveBeenCalled();
  });
});

describe("Remix webhook URL + fail-closed submit", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...env };
    process.env.NEXT_PUBLIC_APP_URL = "https://www.aurainfluenceai.com";
    delete process.env.REMIX_WEBHOOK_SECRET;
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);
    creditsMock.refundCredits.mockResolvedValue(undefined);
    stubInfluencer();
    mockDb.remixJob.create.mockResolvedValue(pendingRemix);
    mockDb.remixJob.findUnique.mockResolvedValue(pendingRemix);
    mockDb.remixJob.updateMany.mockResolvedValue({ count: 1 });
    mockDb.remixJob.update.mockResolvedValue(pendingRemix);
  });

  afterEach(() => {
    process.env = env;
  });

  it("builds a signed webhook URL that contains the job id and secret query", () => {
    process.env.REMIX_WEBHOOK_SECRET = "remix-secret";
    const url = buildRemixWebhookUrl("job-r-1");
    expect(url).toBeDefined();
    const parsed = new URL(url!);
    expect(parsed.origin).toBe("https://www.aurainfluenceai.com");
    expect(parsed.pathname).toBe("/api/webhooks/fal-remix");
    expect(parsed.searchParams.get("job")).toBe("job-r-1");
    expect(parsed.searchParams.get("secret")).toBe("remix-secret");
  });

  it("does not submit to Fal and refunds when REMIX_WEBHOOK_SECRET is missing", async () => {
    await expect(
      createRemixJob({
        userId: "u1",
        influencerId: "inf-1",
        tier: "standard",
        sourceVideoUrl: "https://cdn.example.com/clip.mp4",
        sourceDurationSec: 10,
        requestedDuration: 10,
        keepAudio: true,
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(falRemixMock.submitFalKlingO3Remix).not.toHaveBeenCalled();
    expect(mockDb.remixJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "job-r-1",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        data: expect.objectContaining({
          status: "REFUNDED",
          error: MISSING_REMIX_WEBHOOK_SECRET,
        }),
      })
    );
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 100);
  });

  it("submits to Fal with the signed webhook URL when the secret is set", async () => {
    process.env.REMIX_WEBHOOK_SECRET = "remix-secret";
    falRemixMock.submitFalKlingO3Remix.mockResolvedValue({
      requestId: "fal-remix-1",
      modelId: "fal-ai/kling-video/o3/standard/video-to-video/reference",
    });

    const result = await createRemixJob({
      userId: "u1",
      influencerId: "inf-1",
      tier: "standard",
      sourceVideoUrl: "https://cdn.example.com/clip.mp4",
      sourceDurationSec: 10,
      requestedDuration: 10,
      keepAudio: true,
    });

    expect(result.status).toBe("IN_PROGRESS");
    expect(falRemixMock.submitFalKlingO3Remix).toHaveBeenCalledTimes(1);
    const submitted = falRemixMock.submitFalKlingO3Remix.mock.calls[0][0];
    expect(submitted.webhookUrl).toContain("job=job-r-1");
    expect(submitted.webhookUrl).toContain("secret=remix-secret");
    expect(creditsMock.refundCredits).not.toHaveBeenCalled();
  });
});
