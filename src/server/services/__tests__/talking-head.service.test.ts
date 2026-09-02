import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";

const mockDb = vi.hoisted(() => ({
  influencer: {
    findFirst: vi.fn(),
  },
  talkingHeadJob: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({ db: mockDb }));

const creditsMock = vi.hoisted(() => ({
  checkCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
}));
vi.mock("@/server/services/credits.service", () => creditsMock);

const storageMock = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  uploadFromUrl: vi.fn(),
}));
vi.mock("@/server/services/storage.service", () => storageMock);

const resolveMock = vi.hoisted(() => ({
  resolvePublicMediaUrl: vi.fn(),
}));
vi.mock("@/server/lib/resolve-public-media-url", () => resolveMock);

const elevenMock = vi.hoisted(() => ({
  synthesizeSpeech: vi.fn(),
}));
vi.mock("@/server/services/elevenlabs.service", () => elevenMock);

const hedraMock = vi.hoisted(() => ({
  createAsset: vi.fn(),
  createGeneration: vi.fn(),
  getAssetUrl: vi.fn(),
  getGenerationStatus: vi.fn(),
  hedraModelSlug: vi.fn(() => "together/hedra-avatar"),
  isHedraConfigured: vi.fn(),
  uploadAsset: vi.fn(),
}));
vi.mock("@/server/services/hedra.service", () => hedraMock);

// Global fetch mock — used for downloading the portrait image during
// submission. Must return an OK response with a buffer.
const originalFetch = global.fetch;
beforeEach(() => {
  vi.clearAllMocks();
  hedraMock.isHedraConfigured.mockReturnValue(true);
  hedraMock.hedraModelSlug.mockReturnValue("together/hedra-avatar");
  process.env.ELEVENLABS_API_KEY = "test-el";
  process.env.HEDRA_API_KEY = "test-hedra";
  // @ts-expect-error stub
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "image/jpeg" }),
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  }));
});

afterEach(() => {
  global.fetch = originalFetch;
});

import {
  failTalkingHeadJob,
  pollTalkingHeadJob,
  readTalkingHeadConfig,
  startTalkingHeadJob,
} from "@/server/services/talking-head.service";

describe("talking-head.service — startTalkingHeadJob", () => {
  const validInfluencer = {
    id: "inf-1",
    name: "Luna",
    voiceId: "voice-abc",
    voiceProvider: "elevenlabs",
    voiceLanguage: "fr",
    voiceConsentAt: new Date("2026-05-01"),
    baseImageUrl: "https://cdn.example.com/luna.jpg",
    avatarUrl: null,
  };

  it("throws BAD_REQUEST when script is empty", async () => {
    await expect(
      startTalkingHeadJob({
        userId: "u1",
        influencerId: "inf-1",
        script: "   ",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.talkingHeadJob.create).not.toHaveBeenCalled();
  });

  it("throws PRECONDITION_FAILED when the character has no voice", async () => {
    mockDb.influencer.findFirst.mockResolvedValue({
      ...validInfluencer,
      voiceId: null,
    });
    resolveMock.resolvePublicMediaUrl.mockResolvedValue(
      "https://r2/portrait.jpg"
    );
    await expect(
      startTalkingHeadJob({
        userId: "u1",
        influencerId: "inf-1",
        script: "Hello world",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("throws PRECONDITION_FAILED when consent is missing", async () => {
    mockDb.influencer.findFirst.mockResolvedValue({
      ...validInfluencer,
      voiceConsentAt: null,
    });
    resolveMock.resolvePublicMediaUrl.mockResolvedValue(
      "https://r2/portrait.jpg"
    );
    await expect(
      startTalkingHeadJob({
        userId: "u1",
        influencerId: "inf-1",
        script: "Hello world",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("throws PRECONDITION_FAILED when Hedra is not configured", async () => {
    hedraMock.isHedraConfigured.mockReturnValue(false);
    mockDb.influencer.findFirst.mockResolvedValue(validInfluencer);
    resolveMock.resolvePublicMediaUrl.mockResolvedValue(
      "https://r2/portrait.jpg"
    );
    await expect(
      startTalkingHeadJob({
        userId: "u1",
        influencerId: "inf-1",
        script: "Hello",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("throws FORBIDDEN when credits are insufficient", async () => {
    mockDb.influencer.findFirst.mockResolvedValue(validInfluencer);
    resolveMock.resolvePublicMediaUrl.mockResolvedValue(
      "https://r2/portrait.jpg"
    );
    creditsMock.checkCredits.mockResolvedValue(false);
    await expect(
      startTalkingHeadJob({
        userId: "u1",
        influencerId: "inf-1",
        script: "Hello world",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(creditsMock.deductCredits).not.toHaveBeenCalled();
  });

  it("holds credits, submits Hedra assets and returns PROCESSING", async () => {
    mockDb.influencer.findFirst.mockResolvedValue(validInfluencer);
    resolveMock.resolvePublicMediaUrl.mockResolvedValue(
      "https://r2/portrait.jpg"
    );
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);

    // Persist a PENDING row → then rehydrate on submit path.
    const jobRow = {
      id: "job-1",
      userId: "u1",
      influencerId: "inf-1",
      script: "Hello world",
      voiceId: "voice-abc",
      voiceProvider: "elevenlabs",
      language: "fr",
      portraitImageUrl: "https://r2/portrait.jpg",
      hedraModelSlug: "together/hedra-avatar",
      creditsHeld: 4,
      status: "PENDING" as const,
    };
    mockDb.talkingHeadJob.create.mockResolvedValue(jobRow);
    mockDb.talkingHeadJob.findUnique.mockResolvedValue(jobRow);

    elevenMock.synthesizeSpeech.mockResolvedValue({
      audio: Buffer.from("mp3-bytes-mp3-bytes"),
      contentType: "audio/mpeg",
      charactersUsed: 11,
      modelId: "eleven_multilingual_v2",
    });
    storageMock.uploadFile.mockResolvedValue("https://r2/audio.mp3");
    hedraMock.createAsset
      .mockResolvedValueOnce({ assetId: "aud_1" })
      .mockResolvedValueOnce({ assetId: "img_1" });
    hedraMock.uploadAsset.mockResolvedValue(undefined);
    hedraMock.createGeneration.mockResolvedValue({
      generationId: "gen_42",
      modelSlug: "together/hedra-avatar",
    });
    mockDb.talkingHeadJob.update.mockResolvedValue({ ...jobRow, status: "PROCESSING" });

    const res = await startTalkingHeadJob({
      userId: "u1",
      influencerId: "inf-1",
      script: "Hello world", // 2 words → floors to min cost
    });

    expect(res.jobId).toBe("job-1");
    expect(res.status).toBe("PROCESSING");
    expect(creditsMock.deductCredits).toHaveBeenCalledWith("u1", res.estimatedCost);
    expect(elevenMock.synthesizeSpeech).toHaveBeenCalledWith({
      voiceId: "voice-abc",
      text: "Hello world",
    });
    // Hedra createGeneration is 9:16 720p and re-uses the audio+image asset ids.
    expect(hedraMock.createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        audioAssetId: "aud_1",
        imageAssetId: "img_1",
        aspectRatio: "9:16",
        resolution: "720p",
      })
    );
  });

  it("refunds credits and rethrows when Hedra submission fails", async () => {
    mockDb.influencer.findFirst.mockResolvedValue(validInfluencer);
    resolveMock.resolvePublicMediaUrl.mockResolvedValue(
      "https://r2/portrait.jpg"
    );
    creditsMock.checkCredits.mockResolvedValue(true);
    creditsMock.deductCredits.mockResolvedValue(undefined);
    const jobRow = {
      id: "job-2",
      userId: "u1",
      influencerId: "inf-1",
      script: "Hello world",
      voiceId: "voice-abc",
      voiceProvider: "elevenlabs",
      language: "fr",
      portraitImageUrl: "https://r2/portrait.jpg",
      hedraModelSlug: "together/hedra-avatar",
      creditsHeld: 4,
      status: "PENDING" as const,
    };
    mockDb.talkingHeadJob.create.mockResolvedValue(jobRow);
    // For failTalkingHeadJob lookup.
    mockDb.talkingHeadJob.findUnique.mockResolvedValue(jobRow);
    elevenMock.synthesizeSpeech.mockRejectedValue(new Error("boom"));

    await expect(
      startTalkingHeadJob({
        userId: "u1",
        influencerId: "inf-1",
        script: "Hello world",
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u1", 4);
    expect(mockDb.talkingHeadJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-2" },
        data: expect.objectContaining({ status: "REFUNDED" }),
      })
    );
  });
});

describe("pollTalkingHeadJob", () => {
  it("no-ops on terminal states", async () => {
    const job = {
      id: "j",
      userId: "u",
      influencerId: "i",
      status: "COMPLETED" as const,
      videoUrl: "https://r2/out.mp4",
      hedraGenerationId: "gen_x",
      creditsHeld: 0,
      script: "",
      voiceId: "",
      voiceProvider: "elevenlabs",
      language: "fr",
      portraitImageUrl: "https://r2/p.jpg",
    };
    mockDb.talkingHeadJob.findUnique.mockResolvedValue(job);

    await pollTalkingHeadJob("j");
    expect(hedraMock.getGenerationStatus).not.toHaveBeenCalled();
  });

  it("marks REFUNDED when Hedra reports error", async () => {
    const processing = {
      id: "j",
      userId: "u",
      influencerId: "i",
      status: "PROCESSING" as const,
      hedraGenerationId: "gen_bad",
      creditsHeld: 10,
      videoUrl: null,
      script: "",
      voiceId: "",
      voiceProvider: "elevenlabs",
      language: "fr",
      portraitImageUrl: "https://r2/p.jpg",
    };
    mockDb.talkingHeadJob.findUnique
      .mockResolvedValueOnce(processing) // first read
      .mockResolvedValue(processing); // failTalkingHeadJob lookup
    hedraMock.getGenerationStatus.mockResolvedValue({
      state: "error",
      error: "content policy",
      raw: {},
    });

    await pollTalkingHeadJob("j");
    expect(creditsMock.refundCredits).toHaveBeenCalledWith("u", 10);
    expect(mockDb.talkingHeadJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "j" },
        data: expect.objectContaining({ status: "REFUNDED" }),
      })
    );
  });
});

describe("failTalkingHeadJob", () => {
  it("is idempotent on already-failed jobs", async () => {
    mockDb.talkingHeadJob.findUnique.mockResolvedValue({
      id: "j",
      userId: "u",
      status: "REFUNDED",
      creditsHeld: 5,
    });
    await failTalkingHeadJob("j", "again");
    expect(creditsMock.refundCredits).not.toHaveBeenCalled();
    expect(mockDb.talkingHeadJob.update).not.toHaveBeenCalled();
  });
});

describe("readTalkingHeadConfig", () => {
  it("reflects env presence", () => {
    process.env.HEDRA_API_KEY = "";
    process.env.ELEVENLABS_API_KEY = "";
    hedraMock.isHedraConfigured.mockReturnValue(false);
    let cfg = readTalkingHeadConfig();
    expect(cfg.hedraConfigured).toBe(false);
    expect(cfg.elevenLabsConfigured).toBe(false);

    process.env.HEDRA_API_KEY = "x";
    process.env.ELEVENLABS_API_KEY = "y";
    hedraMock.isHedraConfigured.mockReturnValue(true);
    cfg = readTalkingHeadConfig();
    expect(cfg.hedraConfigured).toBe(true);
    expect(cfg.elevenLabsConfigured).toBe(true);
    expect(cfg.perSecondCost).toBeGreaterThan(0);
  });
});
