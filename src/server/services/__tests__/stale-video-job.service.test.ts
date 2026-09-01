import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  seedanceJob: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  remixJob: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const seedanceMock = vi.hoisted(() => ({
  reconcileSeedanceJob: vi.fn(),
  failSeedanceJob: vi.fn(),
}));

const remixMock = vi.hoisted(() => ({
  reconcileRemixJob: vi.fn(),
  failRemixJob: vi.fn(),
}));

vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/server/services/seedance.service", () => seedanceMock);
vi.mock("@/server/services/remix.service", () => remixMock);

import {
  failStaleVideoJobs,
  isOpenVideoJobStatus,
  isStaleVideoJob,
  settleOpenRemixJobIfStale,
  settleOpenSeedanceJobIfStale,
  STALE_VIDEO_JOB_ERROR,
  STALE_VIDEO_JOB_MS,
} from "@/server/services/stale-video-job.service";

describe("stale-video-job timeout (N = 20 min)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.seedanceJob.findMany.mockResolvedValue([]);
    mockDb.remixJob.findMany.mockResolvedValue([]);
  });

  it("documents N as 20 minutes", () => {
    expect(STALE_VIDEO_JOB_MS).toBe(20 * 60 * 1000);
  });

  it("isStaleVideoJob is true only after N", () => {
    const fresh = new Date(Date.now() - 5 * 60 * 1000);
    const stale = new Date(Date.now() - 21 * 60 * 1000);
    expect(isStaleVideoJob(fresh)).toBe(false);
    expect(isStaleVideoJob(stale)).toBe(true);
  });

  it("isOpenVideoJobStatus covers the spinner states only", () => {
    expect(isOpenVideoJobStatus("PENDING")).toBe(true);
    expect(isOpenVideoJobStatus("IN_PROGRESS")).toBe(true);
    expect(isOpenVideoJobStatus("COMPLETED")).toBe(false);
    expect(isOpenVideoJobStatus("FAILED")).toBe(false);
    expect(isOpenVideoJobStatus("REFUNDED")).toBe(false);
  });

  it("does nothing when no stale jobs exist", async () => {
    const result = await failStaleVideoJobs();
    expect(result).toEqual({ seedance: 0, remix: 0 });
    expect(seedanceMock.failSeedanceJob).not.toHaveBeenCalled();
    expect(remixMock.failRemixJob).not.toHaveBeenCalled();
  });

  it("queries only PENDING / IN_PROGRESS rows older than the cutoff", async () => {
    const before = Date.now();
    await failStaleVideoJobs();
    const seedanceWhere = mockDb.seedanceJob.findMany.mock.calls[0][0].where;
    const remixWhere = mockDb.remixJob.findMany.mock.calls[0][0].where;
    expect(seedanceWhere.status).toEqual({ in: ["PENDING", "IN_PROGRESS"] });
    expect(remixWhere.status).toEqual({ in: ["PENDING", "IN_PROGRESS"] });
    const cutoff: Date = seedanceWhere.createdAt.lt;
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(
      STALE_VIDEO_JOB_MS - 1_000
    );
    expect(before - cutoff.getTime()).toBeLessThan(STALE_VIDEO_JOB_MS + 5_000);
  });

  it("respects a custom cutoff and optional userId", async () => {
    const before = Date.now();
    await failStaleVideoJobs({ olderThanMs: 60_000, userId: "u-luana" });
    const where = mockDb.seedanceJob.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u-luana");
    const cutoff: Date = where.createdAt.lt;
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(59_000);
    expect(before - cutoff.getTime()).toBeLessThan(120_000);
  });

  it("reconciles then refunds a stale Seedance job still open (Luana case)", async () => {
    mockDb.seedanceJob.findMany.mockResolvedValue([
      { id: "job-luana", falRequestId: "fal-1" },
    ]);
    mockDb.seedanceJob.findUnique.mockResolvedValue({ status: "IN_PROGRESS" });

    const result = await failStaleVideoJobs();

    expect(seedanceMock.reconcileSeedanceJob).toHaveBeenCalledWith("job-luana");
    expect(seedanceMock.failSeedanceJob).toHaveBeenCalledWith(
      "job-luana",
      STALE_VIDEO_JOB_ERROR
    );
    expect(result).toEqual({ seedance: 1, remix: 0 });
  });

  it("does not refund if reconcile already completed the Seedance job", async () => {
    mockDb.seedanceJob.findMany.mockResolvedValue([
      { id: "job-ready", falRequestId: "fal-2" },
    ]);
    mockDb.seedanceJob.findUnique.mockResolvedValue({ status: "COMPLETED" });

    const result = await failStaleVideoJobs();

    expect(seedanceMock.reconcileSeedanceJob).toHaveBeenCalledWith("job-ready");
    expect(seedanceMock.failSeedanceJob).not.toHaveBeenCalled();
    expect(result).toEqual({ seedance: 0, remix: 0 });
  });

  it("refunds a PENDING Seedance job with no falRequestId (submit never landed)", async () => {
    mockDb.seedanceJob.findMany.mockResolvedValue([
      { id: "job-orphan", falRequestId: null },
    ]);
    mockDb.seedanceJob.findUnique.mockResolvedValue({ status: "PENDING" });

    await failStaleVideoJobs();

    expect(seedanceMock.reconcileSeedanceJob).not.toHaveBeenCalled();
    expect(seedanceMock.failSeedanceJob).toHaveBeenCalledWith(
      "job-orphan",
      STALE_VIDEO_JOB_ERROR
    );
  });

  it("reconciles then refunds a stale Remix job still open", async () => {
    mockDb.remixJob.findMany.mockResolvedValue([
      { id: "remix-1", falRequestId: "fal-r" },
    ]);
    mockDb.remixJob.findUnique.mockResolvedValue({ status: "IN_PROGRESS" });

    const result = await failStaleVideoJobs();

    expect(remixMock.reconcileRemixJob).toHaveBeenCalledWith("remix-1");
    expect(remixMock.failRemixJob).toHaveBeenCalledWith(
      "remix-1",
      STALE_VIDEO_JOB_ERROR
    );
    expect(result).toEqual({ seedance: 0, remix: 1 });
  });

  it("does not refund if reconcile already completed the Remix job", async () => {
    mockDb.remixJob.findMany.mockResolvedValue([
      { id: "remix-ok", falRequestId: "fal-ok" },
    ]);
    mockDb.remixJob.findUnique.mockResolvedValue({ status: "REFUNDED" });

    await failStaleVideoJobs();

    expect(remixMock.failRemixJob).not.toHaveBeenCalled();
  });
});

describe("settleOpen*JobIfStale (poll-on-read)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves a young Seedance job untouched", async () => {
    const job = {
      id: "young",
      status: "IN_PROGRESS",
      createdAt: new Date(),
      falRequestId: "fal",
    };
    const out = await settleOpenSeedanceJobIfStale(job);
    expect(out).toBe(job);
    expect(seedanceMock.failSeedanceJob).not.toHaveBeenCalled();
  });

  it("times out a stale Seedance job and returns the refreshed row", async () => {
    const job = {
      id: "old",
      status: "IN_PROGRESS",
      createdAt: new Date(Date.now() - 21 * 60 * 1000),
      falRequestId: "fal",
    };
    mockDb.seedanceJob.findUnique
      .mockResolvedValueOnce({ status: "IN_PROGRESS" })
      .mockResolvedValueOnce({
        ...job,
        status: "REFUNDED",
        error: STALE_VIDEO_JOB_ERROR,
      });

    const out = await settleOpenSeedanceJobIfStale(job);

    expect(seedanceMock.failSeedanceJob).toHaveBeenCalledWith(
      "old",
      STALE_VIDEO_JOB_ERROR
    );
    expect(out.status).toBe("REFUNDED");
  });

  it("leaves a young Remix job untouched", async () => {
    const job = {
      id: "young-r",
      status: "IN_PROGRESS",
      createdAt: new Date(),
      falRequestId: "fal",
    };
    const out = await settleOpenRemixJobIfStale(job);
    expect(out).toBe(job);
    expect(remixMock.failRemixJob).not.toHaveBeenCalled();
  });
});
